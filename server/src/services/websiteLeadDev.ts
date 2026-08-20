import {
  isVisitedLead,
  listAllWebsiteItems,
  needsLeadVisitedReset,
  websiteItemId,
} from './leadUnreadCounts'

type FetchLike = typeof fetch

function websiteBase(): string {
  return (process.env.WEBSITE_SERVER_URL || '').replace(/\/$/, '')
}

async function websiteJson(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const response = await fetchImpl(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
  })
  const text = await response.text()
  let json: unknown = null
  if (text) {
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = text
    }
  }
  return { ok: response.ok, status: response.status, json }
}

async function patchVisited(
  fetchImpl: FetchLike,
  base: string,
  kind: 'quotes' | 'calls',
  id: number,
  visited: boolean,
): Promise<{ ok: boolean; status: number }> {
  const out = await websiteJson(fetchImpl, `${base}/api/${kind}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ visited }),
  })
  return { ok: out.ok, status: out.status }
}

function collectIds(rows: unknown[], predicate: (row: unknown) => boolean): number[] {
  const ids: number[] = []
  const seen = new Set<number>()
  for (const row of rows) {
    if (!predicate(row)) continue
    const id = websiteItemId(row)
    if (id == null || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function tryCreateQuote(fetchImpl: FetchLike, base: string): Promise<boolean> {
  const stamp = Date.now()
  const out = await websiteJson(fetchImpl, `${base}/api/quotes`, {
    method: 'POST',
    body: JSON.stringify({
      name: `DevTools Test Form ${stamp}`,
      number: '5550012345',
      address: '123 DevTools St',
      size: '2000',
      date: todayYmd(),
      service: 'standard',
      baseboards: false,
      fridgeInside: false,
      ovenInside: false,
      done: false,
      price: 0,
      carpetShampooRooms: 0,
      blacklist: false,
      source: 'devtools',
      visited: false,
    }),
  })
  return out.ok
}

async function tryCreateCall(fetchImpl: FetchLike, base: string): Promise<boolean> {
  const out = await websiteJson(fetchImpl, `${base}/api/calls`, {
    method: 'POST',
    body: JSON.stringify({
      caller: '5550012345',
      called: '7255774523',
      size: '2000',
      service: 'standard',
      section: 'DevTools',
      price: 0,
      visited: false,
    }),
  })
  return out.ok
}

async function unvisitExisting(
  fetchImpl: FetchLike,
  base: string,
  kind: 'quotes' | 'calls',
  count: number,
): Promise<number> {
  const items = await listAllWebsiteItems({ fetchImpl, listUrl: `${base}/api/${kind}` })
  const visited = items.filter(isVisitedLead)
  let n = 0
  for (const row of visited) {
    if (n >= count) break
    const id = websiteItemId(row)
    if (id == null) continue
    const out = await patchVisited(fetchImpl, base, kind, id, false)
    if (out.ok) n += 1
  }
  return n
}

const MAX_RESET_PASSES = 20

async function resetKind(
  fetchImpl: FetchLike,
  base: string,
  kind: 'quotes' | 'calls',
): Promise<{ marked: number; attempted: number; failures: number[] }> {
  let marked = 0
  let attempted = 0
  const failures: number[] = []
  const alreadyFailed = new Set<number>()

  for (let pass = 0; pass < MAX_RESET_PASSES; pass++) {
    const [unvisitedPage, allPage] = await Promise.all([
      listAllWebsiteItems({ fetchImpl, listUrl: `${base}/api/${kind}?visited=false` }),
      listAllWebsiteItems({ fetchImpl, listUrl: `${base}/api/${kind}` }),
    ])
    const ids = collectIds([...unvisitedPage, ...allPage], needsLeadVisitedReset).filter(
      (id) => !alreadyFailed.has(id),
    )
    if (ids.length === 0) break

    let markedThisPass = 0
    for (const id of ids) {
      attempted += 1
      const out = await patchVisited(fetchImpl, base, kind, id, true)
      if (out.ok) {
        marked += 1
        markedThisPass += 1
      } else {
        failures.push(id)
        alreadyFailed.add(id)
      }
    }
    if (markedThisPass === 0) break
  }

  return { marked, attempted, failures }
}

export async function resetUnvisitedLeads(args?: { fetchImpl?: FetchLike }): Promise<{
  forms: number
  calls: number
  formsAttempted: number
  callsAttempted: number
  formFailures: number[]
  callFailures: number[]
}> {
  const base = websiteBase()
  if (!base) throw new Error('WEBSITE_SERVER_URL is not configured')
  const fetchImpl = args?.fetchImpl ?? fetch
  const [quotes, calls] = await Promise.all([
    resetKind(fetchImpl, base, 'quotes'),
    resetKind(fetchImpl, base, 'calls'),
  ])
  return {
    forms: quotes.marked,
    calls: calls.marked,
    formsAttempted: quotes.attempted,
    callsAttempted: calls.attempted,
    formFailures: quotes.failures,
    callFailures: calls.failures,
  }
}

export async function createUnvisitedLeads(args: {
  forms: boolean
  calls: boolean
  fetchImpl?: FetchLike
}): Promise<{ forms: number; calls: number; method: string }> {
  const base = websiteBase()
  if (!base) throw new Error('WEBSITE_SERVER_URL is not configured')
  const fetchImpl = args.fetchImpl ?? fetch
  let forms = 0
  let calls = 0
  const methods: string[] = []

  if (args.forms) {
    if (await tryCreateQuote(fetchImpl, base)) {
      forms = 1
      methods.push('created-quote')
    } else {
      forms = await unvisitExisting(fetchImpl, base, 'quotes', 1)
      if (forms > 0) methods.push('unvisited-existing-quote')
    }
  }
  if (args.calls) {
    if (await tryCreateCall(fetchImpl, base)) {
      calls = 1
      methods.push('created-call')
    } else {
      calls = await unvisitExisting(fetchImpl, base, 'calls', 1)
      if (calls > 0) methods.push('unvisited-existing-call')
    }
  }
  return { forms, calls, method: methods.join(', ') || 'none' }
}
