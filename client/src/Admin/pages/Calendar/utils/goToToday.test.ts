import { describe, expect, it } from 'vitest'
import {
  businessTodayDate,
  isSameLocalDay,
  isSelectedBusinessToday,
  parseLocalDateString,
} from './goToToday'
import { businessTodayLocalDateString } from '../types'

describe('parseLocalDateString', () => {
  it('parses YYYY-MM-DD as local midnight', () => {
    const d = parseLocalDateString('2026-07-13')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(6)
    expect(d.getDate()).toBe(13)
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
  })

  it('returns Invalid Date for bad input', () => {
    expect(Number.isNaN(parseLocalDateString('not-a-date').getTime())).toBe(true)
  })
})

describe('isSameLocalDay', () => {
  it('compares calendar days ignoring time', () => {
    const a = new Date(2026, 6, 13, 9, 30)
    const b = new Date(2026, 6, 13, 23, 0)
    const c = new Date(2026, 6, 14, 0, 0)
    expect(isSameLocalDay(a, b)).toBe(true)
    expect(isSameLocalDay(a, c)).toBe(false)
  })
})

describe('business today helpers', () => {
  it('businessTodayDate matches businessTodayLocalDateString', () => {
    const today = businessTodayDate()
    const key = businessTodayLocalDateString()
    const [y, m, d] = key.split('-').map(Number)
    expect(today.getFullYear()).toBe(y)
    expect(today.getMonth()).toBe(m - 1)
    expect(today.getDate()).toBe(d)
  })

  it('isSelectedBusinessToday is true for business today and false otherwise', () => {
    expect(isSelectedBusinessToday(businessTodayDate())).toBe(true)
    expect(isSelectedBusinessToday(new Date(2000, 0, 1))).toBe(false)
  })
})
