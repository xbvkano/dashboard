import {
  sanitizePathSegment,
  utcDateFolder,
  buildPermanentAppointmentImageKey,
  buildTempOpenAiImageKey,
  clientFolderFromExtractedContact,
} from '../../src/services/appointmentExtraction/pathUtils'

describe('pathUtils', () => {
  it('sanitizePathSegment removes unsafe characters', () => {
    expect(sanitizePathSegment('Jane/Doe')).toBe('Jane-Doe')
  })

  it('utcDateFolder returns YYYY-MM-DD', () => {
    expect(utcDateFolder(new Date('2026-04-13T12:00:00.000Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('buildPermanentAppointmentImageKey uses appointments/{day}/{client}/photos/', () => {
    const k = buildPermanentAppointmentImageKey({
      clientFolder: 'Test Client',
      dayFolder: '2026-04-13',
      mimeType: 'image/jpeg',
    })
    expect(k.startsWith('appointments/2026-04-13/Test Client/photos/')).toBe(true)
    expect(k.endsWith('.jpg')).toBe(true)
  })

  it('clientFolderFromExtractedContact prefers name then phone', () => {
    expect(clientFolderFromExtractedContact({ clientName: 'Jane', clientPhone: '+15551234567' })).toBe('Jane')
    expect(clientFolderFromExtractedContact({ clientName: '', clientPhone: '+1 (555) 123-4567' })).toMatch(/555/)
    expect(clientFolderFromExtractedContact({ clientName: null, clientPhone: null })).toBe('unknown')
  })

  it('buildTempOpenAiImageKey uses temp/openai', () => {
    const k = buildTempOpenAiImageKey({ runId: 'run-1', mimeType: 'image/png' })
    expect(k.startsWith('temp/openai/run-1/')).toBe(true)
    expect(k.endsWith('.png')).toBe(true)
  })
})
