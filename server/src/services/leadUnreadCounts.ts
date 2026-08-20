export type LeadUnreadCounts = {
  forms: number
  calls: number
  total: number
}

export const EMPTY_LEAD_UNREAD_COUNTS: LeadUnreadCounts = { forms: 0, calls: 0, total: 0 }

const PAGE_SIZE = 200
const MAX_PAGES = 25

type FetchLike = typeof fetch

type WebsitePage = {
  items: unknown[]
  reportedTotal: number | null
  nextOffset: number | null
}

export function isUnvisitedLead(row: unknown): boolean {
  if (!row || typeof row !== 'object') return false
  return (row as { visited?: unknown }).visited === false
}

export function isVisitedLead(row: unknown): boolean {
  if (!row || typeof row !== 'object') return false
  return (row as { visited?: unknown }).visited === true
}

export function websiteItemId(row: unknown): number | null {
  if (!row || typeof row !== 'object') return null
  const id = (row as { id?: unknown }).id
  if (typeof id === 'number' && Number.isFinite(id)) return id
  if (typeof id === 'string' && /^\d+$/.test(id.trim())) return parseInt(id.trim(), 10)
  return null
}

/** Unvisited in the Leads UI is `visited === false`; treat missing/null as unvisited for reset. */
export function needsLeadVisitedReset(row: unknown): boolean {
  if (!row || typeof row !== 'object') return false
  return (row as { visited?: unknown }).visited !== true
}

export function countUnvisitedItems(items: unknown[]): number {
  return items.filter(isUnvisitedLead).length
}

function coerceFiniteNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw)
    if (Number.isFinite(n)) return n
  }
  return null
}

export function parseWebsiteListPage(json: unknown): WebsitePage {
  if (Array.isArray(json)) {
    return { items: json, reportedTotal: json.length, nextOffset: null }
  }
  if (!json || typeof json !== 'object') {
    return { items: [], reportedTotal: null, nextOffset: null }
  }
  const rec = json as {
    data?: unknown
    total?: unknown
    hasMore?: unknown
    nextOffset?: unknown
  }
  const items = Array.isArray(rec.data) ? rec.data : []
  const reportedTotal = coerceFiniteNumber(rec.total)
  let nextOffset = coerceFiniteNumber(rec.nextOffset)
  if (nextOffset == null && rec.hasMore === true && items.length > 0) {
    nextOffset = items.length
  }
  return { items, reportedTotal, nextOffset }
}

/** Next list offset, including when `total` is larger than this page but nextOffset/hasMore are missing. */
export function nextWebsiteListOffset(args: {
  page: WebsitePage
  currentOffset: number
  fetchedCount: number
}): number | null {
  if (args.page.items.length === 0) return null
  if (args.page.nextOffset != null) return args.page.nextOffset
  if (args.page.reportedTotal != null && args.fetchedCount < args.page.reportedTotal) {
    return args.currentOffset + args.page.items.length
  }
  return null
}

async function fetchJsonPage(
  fetchImpl: FetchLike,
  url: string,
): Promise<WebsitePage> {
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`Website list failed with status ${response.status}`)
  }
  const text = await response.text()
  if (!text) return { items: [], reportedTotal: 0, nextOffset: null }
  return parseWebsiteListPage(JSON.parse(text))
}

export async function countUnvisitedFromWebsiteList(args: {
  fetchImpl: FetchLike
  listUrl: string
}): Promise<number> {
  const firstUrl = `${args.listUrl}${args.listUrl.includes('?') ? '&' : '?'}visited=false&count=${PAGE_SIZE}&offset=0`
  const first = await fetchJsonPage(args.fetchImpl, firstUrl)
  const filterHonored = first.items.length === 0 || first.items.every(isUnvisitedLead)
  if (filterHonored && first.reportedTotal != null) {
    return first.reportedTotal
  }

  let count = countUnvisitedItems(first.items)
  let fetched = first.items.length
  let offset = nextWebsiteListOffset({
    page: first,
    currentOffset: 0,
    fetchedCount: fetched,
  })
  let pages = 1
  while (offset != null && pages < MAX_PAGES) {
    const url = `${args.listUrl}${args.listUrl.includes('?') ? '&' : '?'}visited=false&count=${PAGE_SIZE}&offset=${offset}`
    const page = await fetchJsonPage(args.fetchImpl, url)
    count += countUnvisitedItems(page.items)
    fetched += page.items.length
    pages += 1
    const currentOffset: number = offset
    offset = nextWebsiteListOffset({
      page,
      currentOffset,
      fetchedCount: fetched,
    })
    if (page.items.length === 0 || offset === currentOffset) break
  }
  return count
}

export async function listAllWebsiteItems(args: {
  fetchImpl: FetchLike
  listUrl: string
}): Promise<unknown[]> {
  const items: unknown[] = []
  let offset: number | null = 0
  let pages = 0
  while (offset != null && pages < MAX_PAGES) {
    const currentOffset: number = offset
    const joiner = args.listUrl.includes('?') ? '&' : '?'
    const url = `${args.listUrl}${joiner}count=${PAGE_SIZE}&limit=${PAGE_SIZE}&offset=${currentOffset}`
    const page = await fetchJsonPage(args.fetchImpl, url)
    items.push(...page.items)
    pages += 1
    if (page.items.length === 0) break
    offset = nextWebsiteListOffset({
      page,
      currentOffset,
      fetchedCount: items.length,
    })
    if (offset === currentOffset) break
  }
  return items
}

export async function fetchLeadUnreadCounts(args?: {
  baseUrl?: string
  fetchImpl?: FetchLike
}): Promise<LeadUnreadCounts> {
  const base = (args?.baseUrl ?? process.env.WEBSITE_SERVER_URL ?? '').replace(/\/$/, '')
  const fetchImpl = args?.fetchImpl ?? fetch
  if (!base) return { ...EMPTY_LEAD_UNREAD_COUNTS }
  try {
    const [forms, calls] = await Promise.all([
      countUnvisitedFromWebsiteList({ fetchImpl, listUrl: `${base}/api/quotes` }),
      countUnvisitedFromWebsiteList({ fetchImpl, listUrl: `${base}/api/calls` }),
    ])
    return { forms, calls, total: forms + calls }
  } catch (e) {
    console.error('[lead-unread-counts] website fetch failed', e)
    return { ...EMPTY_LEAD_UNREAD_COUNTS }
  }
}
