import {
  getLocalDayRangeUtc,
  getTomorrowLocalDayRangeUtcFrom,
  legacyUtcMidnightDateToLocalStartUtc,
  localDateStringToStartOfDayUtc,
  utcInstantToLocalDateString,
} from '../../src/utils/appointmentTimezone'

const LA = 'America/Los_Angeles'

describe('appointmentTimezone', () => {
  it('localDateStringToStartOfDayUtc uses LA wall calendar (PST vs UTC offset)', () => {
    const d = localDateStringToStartOfDayUtc('2026-01-10', LA)
    expect(d.toISOString()).toBe('2026-01-10T08:00:00.000Z')
  })

  it('utcInstantToLocalDateString formats the LA calendar day', () => {
    const instant = new Date('2026-01-10T08:00:00.000Z')
    expect(utcInstantToLocalDateString(instant, LA)).toBe('2026-01-10')
  })

  it('DST: spring-forward day is 23 hours wide in UTC', () => {
    const { start, endExclusive } = getLocalDayRangeUtc('2025-03-09', LA)
    expect(endExclusive.getTime() - start.getTime()).toBe(23 * 60 * 60 * 1000)
  })

  it('DST: fall-back day is 25 hours wide in UTC', () => {
    const { start, endExclusive } = getLocalDayRangeUtc('2025-11-02', LA)
    expect(endExclusive.getTime() - start.getTime()).toBe(25 * 60 * 60 * 1000)
  })

  it('getTomorrowLocalDayRangeUtcFrom returns the next Pacific calendar day for an instant', () => {
    const asOf = new Date('2025-02-20T19:00:00Z')
    const { start, endExclusive } = getTomorrowLocalDayRangeUtcFrom(asOf, LA)
    const key = utcInstantToLocalDateString(start, LA)
    expect(key).toBe('2025-02-21')
    expect(endExclusive.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000)
  })

  it('legacyUtcMidnightDateToLocalStartUtc maps naive UTC y/m/d to LA start-of-day', () => {
    const legacy = new Date(Date.UTC(2026, 3, 14))
    const anchor = legacyUtcMidnightDateToLocalStartUtc(legacy, LA)
    expect(anchor.toISOString()).toBe(localDateStringToStartOfDayUtc('2026-04-14', LA).toISOString())
  })
})
