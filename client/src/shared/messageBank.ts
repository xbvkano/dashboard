/** Built-in variable keys (lowercase) */
export type BuiltinVariableKey = 'name' | 'price' | 'serviceType'

export type CustomVariableDef = {
  key: string
  label: string
}

export type MessageBankTemplateShape = {
  id?: number
  name: string
  body: string
  builtinVariables: Array<'NAME' | 'PRICE' | 'SERVICE_TYPE'>
  customVariables: CustomVariableDef[]
}

export const BUILTIN_VARIABLE_META: Record<
  BuiltinVariableKey,
  { token: string; label: string; enumValue: 'NAME' | 'PRICE' | 'SERVICE_TYPE' }
> = {
  name: { token: '{{Name}}', label: 'Name', enumValue: 'NAME' },
  price: { token: '{{Price}}', label: 'Price', enumValue: 'PRICE' },
  serviceType: { token: '{{ServiceType}}', label: 'Service Type', enumValue: 'SERVICE_TYPE' },
}

const BUILTIN_TOKEN_TO_KEY: Record<string, BuiltinVariableKey> = {
  Name: 'name',
  Price: 'price',
  ServiceType: 'serviceType',
}

const TOKEN_REGEX = /\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g

export function slugifyVariableKey(label: string, existingKeys: string[] = []): string {
  let base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
  if (!base) base = 'variable'
  if (['name', 'price', 'servicetype'].includes(base.replace(/_/g, ''))) {
    base = `custom_${base}`
  }
  let key = base
  let n = 2
  while (existingKeys.includes(key)) {
    key = `${base}_${n}`
    n++
  }
  return key
}

export function tokenForKey(key: string): string {
  const builtin = Object.entries(BUILTIN_VARIABLE_META).find(([k]) => k === key)
  if (builtin) return builtin[1].token
  return `{{${key}}}`
}

export function parseVariablesFromBody(body: string): {
  builtinKeys: BuiltinVariableKey[]
  customKeys: string[]
} {
  const builtinSet = new Set<BuiltinVariableKey>()
  const customSet = new Set<string>()
  let match: RegExpExecArray | null
  const re = new RegExp(TOKEN_REGEX.source, 'g')
  while ((match = re.exec(body)) !== null) {
    const raw = match[1]
    const builtin = BUILTIN_TOKEN_TO_KEY[raw]
    if (builtin) {
      builtinSet.add(builtin)
    } else {
      customSet.add(raw)
    }
  }
  return {
    builtinKeys: Array.from(builtinSet),
    customKeys: Array.from(customSet),
  }
}

export function builtinKeysToEnums(keys: BuiltinVariableKey[]): Array<'NAME' | 'PRICE' | 'SERVICE_TYPE'> {
  return keys.map((k) => BUILTIN_VARIABLE_META[k].enumValue)
}

export function enumsToBuiltinKeys(
  enums: Array<'NAME' | 'PRICE' | 'SERVICE_TYPE'>,
): BuiltinVariableKey[] {
  const map: Record<string, BuiltinVariableKey> = {
    NAME: 'name',
    PRICE: 'price',
    SERVICE_TYPE: 'serviceType',
  }
  return enums.map((e) => map[e]).filter(Boolean)
}

export function formatPriceForMessage(value: string | number | null | undefined): string {
  if (value == null || value === '') return ''
  const raw = String(value).trim().replace(/^\$/, '')
  const num = Number(raw)
  if (!Number.isNaN(num) && raw !== '') return `$${num}`
  return String(value).trim()
}

/** Single variable value as it would appear in a rendered message. */
export function renderValueForKey(key: string, value: string): string {
  if (key === 'price') return formatPriceForMessage(value)
  return String(value ?? '').trim()
}

function collapseWhitespace(text: string): string {
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/  +/g, ' ').trim()
}

const ANCHOR_CONTEXT_LEN = 24

export type RemovedVariableAnchor = {
  /** Exact gap index in the body immediately after removal. */
  insertAt: number
  /** Snapshot of body right after removal (for fast exact undo). */
  bodyAfterRemoval: string
  /** Text immediately before the removed token. */
  beforeAnchor: string
  /** Text immediately after the removed token. */
  afterAnchor: string
}

/** @deprecated Use RemovedVariableAnchor */
export type RemovedVariablePosition = {
  index: number
  bodyLength: number
}

/** Map a join index in raw (pre-collapse) text to the equivalent index in collapsed text. */
export function mapJoinIndexThroughCollapse(
  raw: string,
  collapsed: string,
  rawJoinIndex: number,
): number {
  let rawPos = 0
  let collapsedPos = 0

  while (rawPos < rawJoinIndex && collapsedPos < collapsed.length) {
    if (raw[rawPos] === collapsed[collapsedPos]) {
      rawPos++
      collapsedPos++
      continue
    }
    if (/\s/.test(raw[rawPos])) {
      rawPos++
      continue
    }
    break
  }

  while (rawPos < rawJoinIndex && /\s/.test(raw[rawPos] ?? '')) {
    rawPos++
  }

  return Math.min(collapsedPos, collapsed.length)
}

/** Build undo metadata for removing a variable token from a body (read-only). */
export function buildRemovalAnchor(body: string, key: string): RemovedVariableAnchor | null {
  const token = tokenForKey(key)
  const index = body.indexOf(token)
  if (index < 0) return null

  const beforeAnchor = body.slice(Math.max(0, index - ANCHOR_CONTEXT_LEN), index)
  const afterAnchor = body.slice(index + token.length, index + token.length + ANCHOR_CONTEXT_LEN)
  const rawWithout = body.slice(0, index) + body.slice(index + token.length)
  const bodyAfterRemoval = collapseWhitespace(rawWithout)
  const insertAt = mapJoinIndexThroughCollapse(rawWithout, bodyAfterRemoval, index)

  return { insertAt, bodyAfterRemoval, beforeAnchor, afterAnchor }
}

export function removeVariableFromBody(body: string, key: string): string {
  const anchor = buildRemovalAnchor(body, key)
  return anchor?.bodyAfterRemoval ?? collapseWhitespace(body)
}

/** Remove a variable and return the new body plus anchor metadata for undo. */
export function removeVariableFromBodyWithAnchor(
  body: string,
  key: string,
): { body: string; anchor: RemovedVariableAnchor } | null {
  const anchor = buildRemovalAnchor(body, key)
  if (!anchor) return null
  return { body: anchor.bodyAfterRemoval, anchor }
}

/** Detect variables removed between two body versions (e.g. edit save). */
export function detectRemovedVariables(
  prevBody: string,
  nextBody: string,
  template: MessageBankTemplateShape,
): Record<string, RemovedVariableAnchor> {
  const prevPresent = keysPresentInBody(prevBody)
  const nextPresent = keysPresentInBody(nextBody)
  const result: Record<string, RemovedVariableAnchor> = {}

  for (const key of getTemplateVariableKeys(template)) {
    if (prevPresent.has(key) && !nextPresent.has(key)) {
      const anchor = buildRemovalAnchor(prevBody, key)
      if (anchor) result[key] = anchor
    }
  }
  return result
}

function findNearestInsertionPoint(body: string, targetIndex: number): number {
  if (body.length === 0) return 0
  const clamped = Math.max(0, Math.min(targetIndex, body.length))
  if (clamped === 0 || clamped === body.length) return clamped
  if (/\s/.test(body.charAt(clamped)) || /\s/.test(body.charAt(clamped - 1))) return clamped

  let best = clamped
  let bestDist = Infinity
  for (let i = 0; i <= body.length; i++) {
    const isBoundary =
      i === 0 ||
      i === body.length ||
      /\s/.test(body.charAt(i)) ||
      /\s/.test(body.charAt(i - 1))
    if (!isBoundary) continue
    const dist = Math.abs(i - targetIndex)
    if (dist < bestDist || (dist === bestDist && i >= clamped && best < clamped)) {
      bestDist = dist
      best = i
    }
  }
  return best
}

function findAnchorInsertionPoint(
  body: string,
  beforeAnchor: string,
  afterAnchor: string,
): number | null {
  if (!beforeAnchor && !afterAnchor) return null

  if (beforeAnchor && afterAnchor) {
    let bestIdx = -1
    for (let i = 0; i <= body.length - beforeAnchor.length; i++) {
      if (!body.startsWith(beforeAnchor, i)) continue
      const gapStart = i + beforeAnchor.length
      const remainder = body.slice(gapStart).replace(/^\s+/, '')
      if (remainder.startsWith(afterAnchor)) {
        bestIdx = gapStart
      }
    }
    if (bestIdx >= 0) return bestIdx
  }

  if (beforeAnchor) {
    const idx = body.lastIndexOf(beforeAnchor)
    if (idx >= 0) return idx + beforeAnchor.length
  }

  if (afterAnchor) {
    const idx = body.indexOf(afterAnchor)
    if (idx >= 0) return idx
  }

  return null
}

function resolveReinsertIndex(body: string, anchor: RemovedVariableAnchor | undefined): number {
  if (!anchor) return body.length

  if (body === anchor.bodyAfterRemoval) {
    return anchor.insertAt
  }

  const anchorPoint = findAnchorInsertionPoint(body, anchor.beforeAnchor, anchor.afterAnchor)
  if (anchorPoint !== null) {
    return anchorPoint
  }

  if (anchor.bodyAfterRemoval.length > 0) {
    const target = Math.round((anchor.insertAt / anchor.bodyAfterRemoval.length) * body.length)
    return findNearestInsertionPoint(body, target)
  }

  return body.length
}

function formatTokenInsertion(before: string, token: string, after: string): string {
  const sepBefore = before.length > 0 && !/\s$/.test(before) ? ' ' : ''
  let afterAdj = after
  if (/^\s+[,;:.!?)]/.test(afterAdj)) {
    afterAdj = afterAdj.replace(/^\s+/, '')
  }
  const sepAfter =
    afterAdj.length > 0 && !/^\s/.test(afterAdj) && !/^[,.;:!?)]/.test(afterAdj) ? ' ' : ''
  return before + sepBefore + token + sepAfter + afterAdj
}

/** Put a variable token back into an instance body, near its prior position when possible. */
export function reinsertTokenInBody(
  body: string,
  key: string,
  anchor?: RemovedVariableAnchor,
): string {
  const token = tokenForKey(key)
  if (body.includes(token)) return body

  const insertAt = resolveReinsertIndex(body, anchor)
  const before = body.slice(0, insertAt)
  const after = body.slice(insertAt)
  return formatTokenInsertion(before, token, after)
}

export function renderMessageBankTemplate(
  body: string,
  values: Record<string, string>,
  excludedKeys: string[] = [],
): string {
  const excluded = new Set(excludedKeys)
  let out = body
  for (const [key, meta] of Object.entries(BUILTIN_VARIABLE_META)) {
    const token = meta.token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(token, 'g')
    if (excluded.has(key)) {
      out = out.replace(re, '')
    } else {
      const val = key === 'price' ? formatPriceForMessage(values[key]) : (values[key] ?? '')
      out = out.replace(re, val)
    }
  }
  const customKeys = parseVariablesFromBody(body).customKeys
  for (const key of customKeys) {
    const token = `{{${key}}}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(token, 'g')
    if (excluded.has(key)) {
      out = out.replace(re, '')
    } else {
      out = out.replace(re, values[key] ?? '')
    }
  }
  return collapseWhitespace(out)
}

export function getTemplateVariableKeys(template: MessageBankTemplateShape): string[] {
  const builtins = enumsToBuiltinKeys(template.builtinVariables)
  const customs = (template.customVariables ?? []).map((c) => c.key)
  return [...builtins, ...customs]
}

export type TemplateNameRef = {
  id?: number
  name: string
  groupId: number | null
}

const TEMPLATE_NAME_COUNTER_SUFFIX_RE = /^(.+?) \((\d+)\)$/

function normalizeTemplateNameForCompare(name: string): string {
  return name.trim().toLowerCase()
}

export function stripTemplateNameCounterSuffix(name: string): string {
  const trimmed = name.trim()
  const match = trimmed.match(TEMPLATE_NAME_COUNTER_SUFFIX_RE)
  if (match) return match[1].trim()
  return trimmed
}

function templateNamesEqual(a: string, b: string): boolean {
  return normalizeTemplateNameForCompare(a) === normalizeTemplateNameForCompare(b)
}

function templatesInGroup(
  templates: TemplateNameRef[],
  groupId: number | null,
  excludeId?: number,
): TemplateNameRef[] {
  return templates.filter(
    (t) => t.groupId === groupId && (excludeId == null || t.id !== excludeId),
  )
}

function isNameTakenInGroup(
  name: string,
  groupId: number | null,
  templates: TemplateNameRef[],
  excludeId?: number,
): boolean {
  return templatesInGroup(templates, groupId, excludeId).some((t) =>
    templateNamesEqual(t.name, name),
  )
}

export function isDuplicateTemplateNameInGroup(
  name: string,
  groupId: number | null,
  templates: TemplateNameRef[],
  excludeId?: number,
): boolean {
  return isNameTakenInGroup(name.trim(), groupId, templates, excludeId)
}

/** First free Windows-style name: "Base (2)", "Base (3)", … within the same group. */
export function suggestUniqueTemplateName(
  name: string,
  groupId: number | null,
  templates: TemplateNameRef[],
  excludeId?: number,
): string {
  const base = stripTemplateNameCounterSuffix(name)
  let n = 2
  while (n < 10_000) {
    const candidate = `${base} (${n})`
    if (!isNameTakenInGroup(candidate, groupId, templates, excludeId)) return candidate
    n++
  }
  return `${base} (${n})`
}

export function getVariableKeysInBodyOrder(template: MessageBankTemplateShape): string[] {
  const ordered: string[] = []
  const seen = new Set<string>()
  let match: RegExpExecArray | null
  const re = new RegExp(TOKEN_REGEX.source, 'g')
  while ((match = re.exec(template.body)) !== null) {
    const raw = match[1]
    const builtin = BUILTIN_TOKEN_TO_KEY[raw]
    const key = builtin ?? raw
    if (!seen.has(key)) {
      seen.add(key)
      ordered.push(key)
    }
  }
  for (const k of getTemplateVariableKeys(template)) {
    if (!seen.has(k)) ordered.push(k)
  }
  return ordered
}

/** Keys whose {{token}} appears in the given instance body. */
export function keysPresentInBody(body: string): Set<string> {
  const parsed = parseVariablesFromBody(body)
  return new Set([...parsed.builtinKeys, ...parsed.customKeys])
}

/** Template variable keys missing from an instance body (removed for this message). */
export function excludedKeysFromInstanceBody(
  template: MessageBankTemplateShape,
  instanceBody: string,
): string[] {
  const present = keysPresentInBody(instanceBody)
  return getTemplateVariableKeys(template).filter((key) => !present.has(key))
}

export type BodySegment =
  | { type: 'text'; text: string }
  | { type: 'token'; key: string; token: string }

export function parseBodySegments(body: string): BodySegment[] {
  const segments: BodySegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  const re = new RegExp(TOKEN_REGEX.source, 'g')
  while ((match = re.exec(body)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', text: body.slice(lastIndex, match.index) })
    }
    const raw = match[1]
    const builtin = BUILTIN_TOKEN_TO_KEY[raw]
    const key = builtin ?? raw
    segments.push({ type: 'token', key, token: match[0] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < body.length) {
    segments.push({ type: 'text', text: body.slice(lastIndex) })
  }
  return segments
}

export function labelForVariableKey(
  key: string,
  template: MessageBankTemplateShape,
): string {
  const builtin = BUILTIN_VARIABLE_META[key as BuiltinVariableKey]
  if (builtin) return builtin.label
  const custom = template.customVariables?.find((c) => c.key === key)
  return custom?.label ?? key
}

export function allActiveVariablesFilled(
  template: MessageBankTemplateShape,
  values: Record<string, string>,
  excludedKeys: string[] = [],
): boolean {
  const excluded = new Set(excludedKeys)
  const keys = getTemplateVariableKeys(template)
  return keys
    .filter((k) => !excluded.has(k))
    .every((k) => String(values[k] ?? '').trim() !== '')
}

export function missingActiveVariableLabels(
  template: MessageBankTemplateShape,
  values: Record<string, string>,
  excludedKeys: string[] = [],
): string[] {
  const excluded = new Set(excludedKeys)
  const keys = getTemplateVariableKeys(template)
  return keys
    .filter((k) => !excluded.has(k) && String(values[k] ?? '').trim() === '')
    .map((k) => labelForVariableKey(k, template))
}

export function syncTemplateVariablesFromBody(
  body: string,
  customVariables: CustomVariableDef[],
): {
  builtinVariables: Array<'NAME' | 'PRICE' | 'SERVICE_TYPE'>
  customVariables: CustomVariableDef[]
} {
  const parsed = parseVariablesFromBody(body)
  const builtinVariables = builtinKeysToEnums(parsed.builtinKeys)
  const customKeySet = new Set(parsed.customKeys)
  const kept = customVariables.filter((c) => customKeySet.has(c.key))
  const keptKeys = new Set(kept.map((c) => c.key))
  for (const key of parsed.customKeys) {
    if (!keptKeys.has(key)) {
      kept.push({ key, label: key.replace(/_/g, ' ') })
    }
  }
  return { builtinVariables, customVariables: kept }
}
