import { defaultDraft, type BookAppointmentDraft } from './Inbox/components/BookAppointmentModal'

type ExtractedScreenshotDraft = Partial<
  Pick<
    BookAppointmentDraft,
    | 'clientName'
    | 'clientPhone'
    | 'appointmentAddress'
    | 'price'
    | 'date'
    | 'time'
    | 'notes'
    | 'instructions'
    | 'size'
    | 'serviceType'
  >
>

export function screenshotDraftFromExtraction(
  extracted: ExtractedScreenshotDraft,
  existingDraft?: BookAppointmentDraft,
): BookAppointmentDraft {
  const base = existingDraft ?? defaultDraft()
  // Fresh extract: missing size stays unselected (''). Re-merge into an existing draft: keep prior size if AI omitted it.
  const size =
    extracted.size != null && String(extracted.size).trim()
      ? String(extracted.size).trim()
      : existingDraft
        ? base.size
        : ''
  return {
    ...base,
    clientName: extracted.clientName ?? base.clientName,
    clientPhone: extracted.clientPhone ?? base.clientPhone,
    appointmentAddress: extracted.appointmentAddress ?? base.appointmentAddress,
    price: extracted.price ?? base.price,
    date: extracted.date ?? base.date,
    time: extracted.time ?? base.time,
    notes: extracted.notes ?? base.notes,
    instructions: extracted.instructions ?? base.instructions,
    size,
    serviceType: (extracted.serviceType ?? base.serviceType) as BookAppointmentDraft['serviceType'],
  }
}
