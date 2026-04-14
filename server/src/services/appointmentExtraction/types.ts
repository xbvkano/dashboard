export type ExtractionServiceType = 'STANDARD' | 'DEEP' | 'MOVE_IN_OUT'

export type ExtractionFieldKey =
  | 'clientName'
  | 'clientPhone'
  | 'appointmentAddress'
  | 'price'
  | 'date'
  | 'time'
  | 'notes'
  | 'size'
  | 'serviceType'

export type AppointmentExtractionDraft = {
  clientName?: string
  /** Customer phone from screenshots (E.164 or US 10-digit) — required for CRM booking outside a thread */
  clientPhone?: string
  appointmentAddress?: string
  price?: string
  date?: string
  time?: string
  notes?: string
  size?: string
  serviceType?: '' | ExtractionServiceType
}

/** Per-field highlight for the booking modal */
export type FieldHighlightReason = 'ai_missing' | 'lookup_failed'

export type ExtractAppointmentResult = {
  draft: AppointmentExtractionDraft
  missingRequiredFields: ExtractionFieldKey[]
  notFoundNotes: string[]
  sizeSource: 'thread' | 'rentcast' | null
  sizeLookupFailed: boolean
  fieldHighlights: Partial<Record<ExtractionFieldKey, FieldHighlightReason>>
  storedImages?: Array<{ storageKey: string; publicUrl: string }>
}

export type RawAiExtraction = {
  clientName?: string | null
  clientPhone?: string | null
  appointmentAddress?: string | null
  price?: number | string | null
  date?: string | null
  time?: string | null
  notes?: string | null
  size?: string | null
  serviceType?: string | null
  missingOrUncertain?: string[] | null
}
