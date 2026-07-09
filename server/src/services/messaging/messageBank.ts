/** Server mirror of client/src/shared/messageBank.ts — keep in sync. */

export type BuiltinVariableKey = 'name' | 'price' | 'serviceType'

export type CustomVariableDef = {
  key: string
  label: string
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

export function parseCustomVariablesJson(raw: unknown): CustomVariableDef[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x) => x && typeof x === 'object' && typeof (x as any).key === 'string')
    .map((x) => ({
      key: String((x as any).key),
      label: String((x as any).label ?? (x as any).key),
    }))
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
