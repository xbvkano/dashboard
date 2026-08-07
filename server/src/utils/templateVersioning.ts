/** Matches names like "Weekly Clean old(1)" or "Weekly Clean old(12)". */
export const SUPERSEDED_TEMPLATE_NAME_RE = /\s+old\((\d+)\)$/

export function stripSupersededSuffix(templateName: string): string {
  return templateName.replace(SUPERSEDED_TEMPLATE_NAME_RE, '').trim()
}

export function isSupersededTemplateName(templateName: string): boolean {
  return SUPERSEDED_TEMPLATE_NAME_RE.test(templateName.trim())
}

/**
 * Next free `"{baseName} old(n)"` for a client, given existing template names.
 */
export function nextOldTemplateName(baseName: string, existingNames: string[]): string {
  const base = baseName.trim()
  let max = 0
  for (const name of existingNames) {
    const trimmed = name.trim()
    if (!trimmed.startsWith(base)) continue
    const m = trimmed.slice(base.length).match(/^\s+old\((\d+)\)$/)
    if (m) {
      const n = parseInt(m[1], 10)
      if (!Number.isNaN(n) && n > max) max = n
    }
  }
  return `${base} old(${max + 1})`
}
