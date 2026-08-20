export type MessageUnreadCounts = {
  client: number
  employee: number
  total: number
}

export type LeadUnreadCounts = {
  forms: number
  calls: number
  total: number
}

export type ActionCounts = {
  messages: MessageUnreadCounts
  leads: LeadUnreadCounts
}

export const EMPTY_ACTION_COUNTS: ActionCounts = {
  messages: { client: 0, employee: 0, total: 0 },
  leads: { forms: 0, calls: 0, total: 0 },
}

export type ActionCountNotification = {
  title: string
  body: string
  href: string
}

function clampCount(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

export function normalizeActionCounts(input: {
  messages?: Partial<MessageUnreadCounts> | null
  leads?: Partial<LeadUnreadCounts> | null
}): ActionCounts {
  const client = clampCount(input.messages?.client)
  const employee = clampCount(input.messages?.employee)
  const forms = clampCount(input.leads?.forms)
  const calls = clampCount(input.leads?.calls)
  return {
    messages: { client, employee, total: client + employee },
    leads: { forms, calls, total: forms + calls },
  }
}

export function messagesHomeHref(messages: MessageUnreadCounts): string {
  if (messages.client > 0 && messages.employee === 0) return '/dashboard/messages/inbox'
  if (messages.employee > 0 && messages.client === 0) return '/dashboard/messages/employee-inbox'
  return '/dashboard/messages'
}

export function actionCountNotification(args: {
  previous: ActionCounts | null
  next: ActionCounts
  tabHidden: boolean
}): ActionCountNotification | null {
  if (!args.tabHidden || args.previous == null) return null
  const prev = args.previous
  const next = args.next
  const parts: string[] = []
  const clientRose = next.messages.client > prev.messages.client
  const employeeRose = next.messages.employee > prev.messages.employee
  const formsRose = next.leads.forms > prev.leads.forms
  const callsRose = next.leads.calls > prev.leads.calls
  if (clientRose) parts.push(`Client inbox: ${next.messages.client}`)
  if (employeeRose) parts.push(`Employee inbox: ${next.messages.employee}`)
  if (formsRose) parts.push(`Forms: ${next.leads.forms}`)
  if (callsRose) parts.push(`Calls: ${next.leads.calls}`)
  if (parts.length === 0) return null

  const messagesRose = clientRose || employeeRose
  const leadsRose = formsRose || callsRose
  const messageIncrease =
    Math.max(0, next.messages.client - prev.messages.client) +
    Math.max(0, next.messages.employee - prev.messages.employee)
  const leadIncrease =
    Math.max(0, next.leads.forms - prev.leads.forms) + Math.max(0, next.leads.calls - prev.leads.calls)

  let title = 'New activity'
  if (messagesRose && !leadsRose) {
    title = messageIncrease > 1 || (clientRose && employeeRose) ? 'New messages' : 'New message'
  } else if (leadsRose && !messagesRose) {
    title = leadIncrease > 1 || (formsRose && callsRose) ? 'New leads' : 'New lead'
  }

  let href = '/dashboard/messages'
  if (leadsRose && !messagesRose) href = '/dashboard/messages/leads'
  else if (messagesRose && !leadsRose) href = messagesHomeHref(next.messages)

  return { title, body: parts.join(' · '), href }
}
