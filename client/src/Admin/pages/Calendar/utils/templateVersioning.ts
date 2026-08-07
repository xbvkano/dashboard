/** Matches names like "Weekly Clean old(1)" or "Weekly Clean old(12)". */
export const SUPERSEDED_TEMPLATE_NAME_RE = /\s+old\((\d+)\)$/

export function isSupersededTemplateName(templateName: string): boolean {
  return SUPERSEDED_TEMPLATE_NAME_RE.test(templateName.trim())
}
