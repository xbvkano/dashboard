import { Request, Response } from 'express'
import { PrismaClient, MessageBankBuiltinVariable } from '@prisma/client'
import {
  parseCustomVariablesJson,
  suggestUniqueTemplateName,
  syncTemplateVariablesFromBody,
  isDuplicateTemplateNameInGroup,
  type CustomVariableDef,
  type TemplateNameRef,
} from '../services/messaging/messageBank'

const prisma = new PrismaClient()

function toDto(row: {
  id: number
  name: string
  body: string
  builtinVariables: MessageBankBuiltinVariable[]
  customVariables: unknown
  groupId: number | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    name: row.name,
    body: row.body,
    builtinVariables: row.builtinVariables,
    customVariables: parseCustomVariablesJson(row.customVariables),
    groupId: row.groupId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function validateCustomVariables(customVariables: CustomVariableDef[]): string | null {
  const keys = new Set<string>()
  for (const cv of customVariables) {
    if (!cv.label?.trim()) return 'Custom variable label is required'
    if (!cv.key?.trim()) return 'Custom variable key is required'
    if (keys.has(cv.key)) return `Duplicate custom variable key: ${cv.key}`
    keys.add(cv.key)
  }
  return null
}

async function loadTemplatesInGroup(
  groupId: number | null,
  excludeId?: number,
): Promise<TemplateNameRef[]> {
  const rows = await prisma.messageBankTemplate.findMany({
    where: {
      groupId: groupId ?? null,
      ...(excludeId != null ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true, name: true, groupId: true },
  })
  return rows.map((r) => ({ id: r.id, name: r.name, groupId: r.groupId }))
}

async function assertUniqueTemplateNameInGroup(
  name: string,
  groupId: number | null,
  excludeId?: number,
): Promise<{ ok: true } | { ok: false; suggestedName: string }> {
  const inGroup = await loadTemplatesInGroup(groupId, excludeId)
  if (!isDuplicateTemplateNameInGroup(name, groupId, inGroup, excludeId)) {
    return { ok: true }
  }
  return {
    ok: false,
    suggestedName: suggestUniqueTemplateName(name, groupId, inGroup, excludeId),
  }
}

export async function listMessageBankTemplates(_req: Request, res: Response) {
  try {
    const rows = await prisma.messageBankTemplate.findMany({
      orderBy: { name: 'asc' },
    })
    res.json(rows.map(toDto))
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to fetch message bank templates' })
  }
}

export async function getMessageBankTemplate(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' })
  try {
    const row = await prisma.messageBankTemplate.findUnique({ where: { id } })
    if (!row) return res.status(404).json({ error: 'Template not found' })
    res.json(toDto(row))
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to fetch template' })
  }
}

export async function createMessageBankTemplate(req: Request, res: Response) {
  try {
    const { name, body, builtinVariables, customVariables, groupId } = req.body as {
      name?: string
      body?: string
      builtinVariables?: MessageBankBuiltinVariable[]
      customVariables?: CustomVariableDef[]
      groupId?: number | null
    }
    if (!name?.trim() || !body?.trim()) {
      return res.status(400).json({ error: 'name and body are required' })
    }
    const customs = parseCustomVariablesJson(customVariables ?? [])
    const customErr = validateCustomVariables(customs)
    if (customErr) return res.status(400).json({ error: customErr })

    const resolvedGroupId = groupId ?? null
    const nameCheck = await assertUniqueTemplateNameInGroup(name.trim(), resolvedGroupId)
    if (!nameCheck.ok) {
      return res.status(409).json({
        error: 'A template with this name already exists in this group',
        suggestedName: nameCheck.suggestedName,
      })
    }

    const synced = syncTemplateVariablesFromBody(body, customs)
    const row = await prisma.messageBankTemplate.create({
      data: {
        name: name.trim(),
        body: body.trim(),
        builtinVariables: builtinVariables?.length ? builtinVariables : synced.builtinVariables,
        customVariables: synced.customVariables,
        groupId: resolvedGroupId,
      },
    })
    res.json(toDto(row))
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to create template' })
  }
}

export async function updateMessageBankTemplate(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' })
  try {
    const { name, body, builtinVariables, customVariables, groupId } = req.body as {
      name?: string
      body?: string
      builtinVariables?: MessageBankBuiltinVariable[]
      customVariables?: CustomVariableDef[]
      groupId?: number | null
    }
    if (!name?.trim() || !body?.trim()) {
      return res.status(400).json({ error: 'name and body are required' })
    }
    const customs = parseCustomVariablesJson(customVariables ?? [])
    const customErr = validateCustomVariables(customs)
    if (customErr) return res.status(400).json({ error: customErr })

    const resolvedGroupId = groupId ?? null
    const nameCheck = await assertUniqueTemplateNameInGroup(name.trim(), resolvedGroupId, id)
    if (!nameCheck.ok) {
      return res.status(409).json({
        error: 'A template with this name already exists in this group',
        suggestedName: nameCheck.suggestedName,
      })
    }

    const synced = syncTemplateVariablesFromBody(body, customs)
    const row = await prisma.messageBankTemplate.update({
      where: { id },
      data: {
        name: name.trim(),
        body: body.trim(),
        builtinVariables: builtinVariables?.length ? builtinVariables : synced.builtinVariables,
        customVariables: synced.customVariables,
        groupId: resolvedGroupId,
      },
    })
    res.json(toDto(row))
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to update template' })
  }
}

export async function deleteMessageBankTemplate(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' })
  try {
    await prisma.messageBankTemplate.delete({ where: { id } })
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to delete template' })
  }
}

// ---- Groups ----

export async function listMessageBankGroups(_req: Request, res: Response) {
  try {
    const rows = await prisma.messageBankGroup.findMany({ orderBy: { name: 'asc' } })
    res.json(
      rows.map((g) => ({
        id: g.id,
        name: g.name,
        color: g.color,
        createdAt: g.createdAt.toISOString(),
        updatedAt: g.updatedAt.toISOString(),
      })),
    )
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to fetch message bank groups' })
  }
}

export async function createMessageBankGroup(req: Request, res: Response) {
  try {
    const { name, color } = req.body as { name?: string; color?: string }
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' })
    const c = color?.trim() || '#FFFFFF'
    const row = await prisma.messageBankGroup.create({
      data: { name: name.trim(), color: c },
    })
    res.json({
      id: row.id,
      name: row.name,
      color: row.color,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to create group' })
  }
}

export async function updateMessageBankGroup(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' })
  try {
    const { name, color } = req.body as { name?: string; color?: string }
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' })
    const c = color?.trim() || '#FFFFFF'
    const row = await prisma.messageBankGroup.update({
      where: { id },
      data: { name: name.trim(), color: c },
    })
    res.json({
      id: row.id,
      name: row.name,
      color: row.color,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to update group' })
  }
}

export async function deleteMessageBankGroup(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' })
  try {
    // Move templates to General (null group) implicitly via SetNull
    await prisma.messageBankGroup.delete({ where: { id } })
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to delete group' })
  }
}
