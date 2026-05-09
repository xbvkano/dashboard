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
    | 'size'
    | 'serviceType'
  >
>

export function screenshotDraftFromExtraction(
  extracted: ExtractedScreenshotDraft,
  existingDraft?: BookAppointmentDraft,
): BookAppointmentDraft {
  const base = existingDraft ?? defaultDraft()
  return {
    ...base,
    clientName: extracted.clientName ?? base.clientName,
    clientPhone: extracted.clientPhone ?? base.clientPhone,
    appointmentAddress: extracted.appointmentAddress ?? base.appointmentAddress,
    price: extracted.price ?? base.price,
    date: extracted.date ?? base.date,
    time: extracted.time ?? base.time,
    notes: extracted.notes ?? base.notes,
    size: extracted.size ?? base.size,
    serviceType: (extracted.serviceType ?? base.serviceType) as BookAppointmentDraft['serviceType'],
  }
}
