import { API_BASE_URL, fetchJson } from '../api'
import {
  EMPTY_ACTION_COUNTS,
  normalizeActionCounts,
  type ActionCounts,
  type LeadUnreadCounts,
  type MessageUnreadCounts,
} from './actionCounts'

export async function fetchMessagingUnreadCounts(): Promise<MessageUnreadCounts> {
  const data = await fetchJson(`${API_BASE_URL}/messaging/unread-counts`)
  return normalizeActionCounts({ messages: data, leads: EMPTY_ACTION_COUNTS.leads }).messages
}

export async function fetchLeadUnreadCounts(): Promise<LeadUnreadCounts> {
  const data = await fetchJson(`${API_BASE_URL}/api/lead-unread-counts`)
  return normalizeActionCounts({ messages: EMPTY_ACTION_COUNTS.messages, leads: data }).leads
}

export async function fetchActionCounts(): Promise<ActionCounts> {
  const [messages, leads] = await Promise.all([
    fetchMessagingUnreadCounts().catch(() => EMPTY_ACTION_COUNTS.messages),
    fetchLeadUnreadCounts().catch(() => EMPTY_ACTION_COUNTS.leads),
  ])
  return { messages, leads }
}

export async function postMarkAllLeadsRead(opts?: {
  forms?: boolean
  calls?: boolean
}): Promise<{ forms: number; calls: number }> {
  const data = await fetchJson(`${API_BASE_URL}/api/leads/mark-all-read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      forms: opts?.forms !== false,
      calls: opts?.calls !== false,
    }),
  })
  return {
    forms: typeof data?.forms === 'number' ? data.forms : 0,
    calls: typeof data?.calls === 'number' ? data.calls : 0,
  }
}
