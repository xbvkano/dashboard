import { describe, expect, it } from 'vitest'
import { shouldRestoreDeepLinkOnReload } from './AdminDashboard'

describe('shouldRestoreDeepLinkOnReload', () => {
  it('restores deep link when reload lands on /dashboard', () => {
    expect(
      shouldRestoreDeepLinkOnReload({
        historyAction: 'POP',
        pathname: '/dashboard',
        search: '',
        hash: '',
        navType: 'reload',
        lastDashboardHref: '/dashboard/messages/screenshot-booking',
      }),
    ).toEqual({ to: '/dashboard/messages/screenshot-booking' })
  })

  it('restores deep link when reload lands on /dashboard/messages', () => {
    expect(
      shouldRestoreDeepLinkOnReload({
        historyAction: 'POP',
        pathname: '/dashboard/messages',
        search: '',
        hash: '',
        navType: 'reload',
        lastDashboardHref: '/dashboard/messages/screenshot-booking',
      }),
    ).toEqual({ to: '/dashboard/messages/screenshot-booking' })
  })

  it('does not restore on PUSH navigation (e.g. clicking Home)', () => {
    expect(
      shouldRestoreDeepLinkOnReload({
        historyAction: 'PUSH',
        pathname: '/dashboard',
        search: '',
        hash: '',
        navType: 'reload',
        lastDashboardHref: '/dashboard/messages/screenshot-booking',
      }),
    ).toBeNull()
  })

  it('does not restore when landing has search/hash', () => {
    expect(
      shouldRestoreDeepLinkOnReload({
        historyAction: 'POP',
        pathname: '/dashboard',
        search: '?x=1',
        hash: '',
        navType: 'reload',
        lastDashboardHref: '/dashboard/messages/screenshot-booking',
      }),
    ).toBeNull()
  })

  it('does not restore when navType is not reload', () => {
    expect(
      shouldRestoreDeepLinkOnReload({
        historyAction: 'POP',
        pathname: '/dashboard',
        search: '',
        hash: '',
        navType: 'navigate',
        lastDashboardHref: '/dashboard/messages/screenshot-booking',
      }),
    ).toBeNull()
  })

  it('when landing on /dashboard/messages, only restores deeper messages routes', () => {
    expect(
      shouldRestoreDeepLinkOnReload({
        historyAction: 'POP',
        pathname: '/dashboard/messages',
        search: '',
        hash: '',
        navType: 'reload',
        lastDashboardHref: '/dashboard/calendar',
      }),
    ).toBeNull()
  })
})

