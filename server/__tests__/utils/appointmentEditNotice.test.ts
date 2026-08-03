import {
  buildAppointmentEditNotice,
  hasEmployeeNotifiableAppointmentChanges,
  type AppointmentEditSnapshot,
} from '../../src/utils/appointmentEditNotice'

function snap(partial: Partial<AppointmentEditSnapshot> = {}): AppointmentEditSnapshot {
  return {
    address: '100 Main St',
    instructions: 'Gate 1111',
    date: '2026-08-03',
    time: '09:00',
    type: 'STANDARD',
    size: '1500-2000',
    price: 200,
    notes: 'Cash',
    ...partial,
  }
}

describe('hasEmployeeNotifiableAppointmentChanges', () => {
  it('is true when address, instructions, date, or time changes', () => {
    expect(
      hasEmployeeNotifiableAppointmentChanges({
        previous: snap(),
        current: snap({ address: '200 Oak' }),
      }),
    ).toBe(true)
    expect(
      hasEmployeeNotifiableAppointmentChanges({
        previous: snap(),
        current: snap({ instructions: 'New gate' }),
      }),
    ).toBe(true)
    expect(
      hasEmployeeNotifiableAppointmentChanges({
        previous: snap(),
        current: snap({ date: '2026-08-04' }),
      }),
    ).toBe(true)
    expect(
      hasEmployeeNotifiableAppointmentChanges({
        previous: snap(),
        current: snap({ time: '14:00' }),
      }),
    ).toBe(true)
  })

  it('is false when only type, size, price, or notes change', () => {
    expect(
      hasEmployeeNotifiableAppointmentChanges({
        previous: snap(),
        current: snap({ type: 'DEEP', size: '2000-2500', price: 999, notes: 'Zelle' }),
      }),
    ).toBe(false)
  })
})

describe('buildAppointmentEditNotice', () => {
  it('always identifies the house with the original address', () => {
    const body = buildAppointmentEditNotice({
      previous: snap({ address: '100 Main St' }),
      current: snap({ address: '200 Oak Ave' }),
    })
    expect(body).toContain('Appointment Edit Notice')
    expect(body).toMatch(/^Appointment Edit Notice\nAddress: 100 Main St/m)
    expect(body).toContain('Address updated: 200 Oak Ave')
  })

  it('lists instructions as the new body only (no diff)', () => {
    const body = buildAppointmentEditNotice({
      previous: snap({ instructions: 'Old gate' }),
      current: snap({ instructions: 'New gate 4521, dog outside' }),
    })
    expect(body).toContain('Instructions updated: New gate 4521, dog outside')
    expect(body).not.toContain('Old gate')
  })

  it('lists date and time when they change, but not type/size/price/notes', () => {
    const body = buildAppointmentEditNotice({
      previous: snap(),
      current: snap({
        date: '2026-08-04',
        time: '14:00',
        type: 'DEEP',
        size: '2000-2500',
        price: 275,
        notes: 'Zelle',
      }),
    })
    expect(body).toContain('Date updated: 2026-08-04')
    expect(body).toContain('Time updated: 14:00')
    expect(body).not.toContain('Type updated:')
    expect(body).not.toContain('Size updated:')
    expect(body).not.toContain('Price updated:')
    expect(body).not.toContain('Notes updated:')
  })

  it('omits change lines when fields are unchanged', () => {
    const body = buildAppointmentEditNotice({
      previous: snap(),
      current: snap(),
    })
    expect(body).toContain('Address: 100 Main St')
    expect(body).not.toContain('updated:')
  })

  it('treats null/empty instructions as cleared when previous had text', () => {
    const body = buildAppointmentEditNotice({
      previous: snap({ instructions: 'Gate 1' }),
      current: snap({ instructions: null }),
    })
    expect(body).toContain('Instructions updated: (none)')
  })

  it('ends with do-not-respond footer', () => {
    const body = buildAppointmentEditNotice({
      previous: snap(),
      current: snap({ time: '10:00' }),
    })
    expect(body).toMatch(/Please do not respond to this message\s*$/)
  })

  it('normalizes whitespace when comparing and reporting instructions', () => {
    const body = buildAppointmentEditNotice({
      previous: snap({ instructions: '  Gate 1  ' }),
      current: snap({ instructions: 'Gate 1' }),
    })
    expect(body).not.toContain('Instructions updated:')
  })
})
