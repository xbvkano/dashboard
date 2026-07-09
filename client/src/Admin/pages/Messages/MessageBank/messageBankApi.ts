import { API_BASE_URL, fetchJson } from '../../../../api'
import type { CustomVariableDef } from '../../../../shared/messageBank'

export type MessageBankTemplateDto = {
  id: number
  name: string
  body: string
  builtinVariables: Array<'NAME' | 'PRICE' | 'SERVICE_TYPE'>
  customVariables: CustomVariableDef[]
  groupId: number | null
  createdAt: string
  updatedAt: string
}

const base = `${API_BASE_URL}/message-bank/templates`
const groupsBase = `${API_BASE_URL}/message-bank/groups`

export type MessageBankGroupDto = {
  id: number
  name: string
  color: string
  createdAt: string
  updatedAt: string
}

export async function fetchMessageBankTemplates(): Promise<MessageBankTemplateDto[]> {
  return fetchJson(base)
}

export async function fetchMessageBankTemplate(id: number): Promise<MessageBankTemplateDto> {
  return fetchJson(`${base}/${id}`)
}

export async function createMessageBankTemplate(payload: {
  name: string
  body: string
  builtinVariables?: Array<'NAME' | 'PRICE' | 'SERVICE_TYPE'>
  customVariables?: CustomVariableDef[]
  groupId?: number | null
}): Promise<MessageBankTemplateDto> {
  return fetchJson(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function updateMessageBankTemplate(
  id: number,
  payload: {
    name: string
    body: string
    builtinVariables?: Array<'NAME' | 'PRICE' | 'SERVICE_TYPE'>
    customVariables?: CustomVariableDef[]
    groupId?: number | null
  },
): Promise<MessageBankTemplateDto> {
  return fetchJson(`${base}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function deleteMessageBankTemplate(id: number): Promise<{ ok: boolean }> {
  return fetchJson(`${base}/${id}`, { method: 'DELETE' })
}

export async function fetchMessageBankGroups(): Promise<MessageBankGroupDto[]> {
  return fetchJson(groupsBase)
}

export async function createMessageBankGroup(payload: {
  name: string
  color: string
}): Promise<MessageBankGroupDto> {
  return fetchJson(groupsBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function updateMessageBankGroup(
  id: number,
  payload: { name: string; color: string },
): Promise<MessageBankGroupDto> {
  return fetchJson(`${groupsBase}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function deleteMessageBankGroup(id: number): Promise<{ ok: boolean }> {
  return fetchJson(`${groupsBase}/${id}`, { method: 'DELETE' })
}

export function formatApiError(e: unknown): string {
  if (e instanceof Error) {
    try {
      const parsed = JSON.parse(e.message) as { error?: string }
      if (parsed.error) return parsed.error
    } catch {
      /* ignore */
    }
    return e.message
  }
  return 'Request failed'
}
