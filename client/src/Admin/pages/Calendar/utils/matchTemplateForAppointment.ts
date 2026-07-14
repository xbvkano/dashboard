import type { AppointmentTemplate } from '../types'

/** Prefer templateId; fall back to address/type/size match (calendar Book Again behavior). */
export function matchTemplateForAppointment(
  templates: AppointmentTemplate[],
  appt: {
    templateId?: number | null
    address?: string | null
    type?: string | null
    size?: string | null
  },
): AppointmentTemplate | null {
  if (appt.templateId != null) {
    const byId = templates.find((t) => t.id === appt.templateId)
    if (byId) return byId
  }
  return (
    templates.find(
      (t) =>
        t.address === (appt.address ?? '') &&
        t.type === appt.type &&
        (t.size || '') === (appt.size || ''),
    ) ?? null
  )
}
