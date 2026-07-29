import type { Call, FormData } from '../../../../external_prisma_schemas/website_schema'
import type { ConversationDetail } from '../Inbox/messagingApi'
import type { ThreadContact } from '../Inbox/types'
import {
  formatPriceForMessage,
  formatServiceTypeForMessage,
} from '../../../../shared/messageBank'

export type BookAppointmentDraftLike = {
  clientName?: string
  clientPhone?: string
  price?: string
  serviceType?: string
}

export type ResolvedBuiltinVariables = {
  name: string
  price: string
  serviceType: string
}

function phoneDigits(value: string): string {
  return value.replace(/\D/g, '')
}

function phonesMatch(a: string, b: string): boolean {
  const da = phoneDigits(a)
  const db = phoneDigits(b)
  if (!da || !db) return false
  if (da === db) return true
  if (da.length === 10 && db.length === 11 && db.endsWith(da)) return true
  if (db.length === 10 && da.length === 11 && da.endsWith(db)) return true
  return da.slice(-10) === db.slice(-10)
}

function pickQuote(quotes: FormData[], phone: string): FormData | null {
  const matches = quotes.filter((q) => phonesMatch(q.number ?? '', phone))
  if (matches.length === 0) return null
  const unvisited = matches.filter((q) => q.visited === false)
  const pool = unvisited.length > 0 ? unvisited : matches
  return pool.sort((a, b) => {
    const ta = new Date(String(a.dateCreated)).getTime()
    const tb = new Date(String(b.dateCreated)).getTime()
    return tb - ta
  })[0]
}

function pickCall(calls: Call[], phone: string): Call | null {
  const matches = calls.filter((c) => phonesMatch(c.caller ?? '', phone))
  if (matches.length === 0) return null
  const unvisited = matches.filter((c) => c.visited === false)
  const pool = unvisited.length > 0 ? unvisited : matches
  return pool.sort((a, b) => {
    const ta = new Date(String(a.createdAt)).getTime()
    const tb = new Date(String(b.createdAt)).getTime()
    return tb - ta
  })[0]
}

export function resolveMessageBankVariables(input: {
  detail: ConversationDetail | null
  threadContact: ThreadContact | null
  bookingDraft?: BookAppointmentDraftLike | null
  quotes?: FormData[]
  calls?: Call[]
}): ResolvedBuiltinVariables {
  const { detail, threadContact, bookingDraft, quotes = [], calls = [] } = input
  const phone =
    detail?.contactPoint?.value ??
    threadContact?.phoneE164 ??
    bookingDraft?.clientPhone ??
    ''

  let name = ''
  if (bookingDraft?.clientName?.trim()) name = bookingDraft.clientName.trim()
  else if (detail?.client?.name?.trim()) name = detail.client.name.trim()
  else if (threadContact?.contactName?.trim()) name = threadContact.contactName.trim()
  else {
    const quote = pickQuote(quotes, phone)
    if (quote?.name?.trim()) name = quote.name.trim()
  }

  let price = ''
  if (bookingDraft?.price?.trim()) price = formatPriceForMessage(bookingDraft.price)
  else {
    const quote = pickQuote(quotes, phone)
    if (quote?.price != null) price = formatPriceForMessage(quote.price)
    else {
      const call = pickCall(calls, phone)
      if (call?.price != null) price = formatPriceForMessage(call.price)
    }
  }

  let serviceType = ''
  if (bookingDraft?.serviceType) serviceType = formatServiceTypeForMessage(bookingDraft.serviceType)
  else {
    const openSession = detail?.sessions?.find((s) => !s.closedAt)
    if (openSession?.bookingIntent?.trim()) {
      serviceType = formatServiceTypeForMessage(openSession.bookingIntent)
    } else {
      const quote = pickQuote(quotes, phone)
      if (quote?.service?.trim()) serviceType = quote.service.trim()
      else {
        const call = pickCall(calls, phone)
        if (call?.service?.trim()) serviceType = call.service.trim()
      }
    }
  }

  return { name, price, serviceType }
}

export function resolvedToVariableValues(resolved: ResolvedBuiltinVariables): Record<string, string> {
  return {
    name: resolved.name,
    price: resolved.price,
    serviceType: resolved.serviceType,
  }
}
