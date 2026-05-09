import { describe, expect, it } from 'vitest'
import { defaultDraft, type BookAppointmentDraft } from './Inbox/components/BookAppointmentModal'
import { screenshotDraftFromExtraction } from './screenshotBookingDraft'

function oldDraft(): BookAppointmentDraft {
  return {
    clientName: 'Old Client',
    clientPhone: '15555550100',
    appointmentAddress: 'Old address',
    price: '999',
    date: '2026-01-01',
    time: '09:00',
    notes: 'old notes',
    datePastOverride: true,
    size: '1000-1500',
    serviceType: 'DEEP',
  }
}

describe('screenshotDraftFromExtraction', () => {
  it('starts a fresh screenshot extraction from a clean draft', () => {
    expect(
      screenshotDraftFromExtraction({
        clientName: 'New Client',
        appointmentAddress: 'New address',
      }),
    ).toEqual({
      ...defaultDraft(),
      clientName: 'New Client',
      appointmentAddress: 'New address',
    })
  })

  it('can intentionally merge extract-again results into the current draft', () => {
    expect(
      screenshotDraftFromExtraction(
        {
          appointmentAddress: 'Updated address',
          price: '250',
        },
        oldDraft(),
      ),
    ).toEqual({
      ...oldDraft(),
      appointmentAddress: 'Updated address',
      price: '250',
    })
  })
})
