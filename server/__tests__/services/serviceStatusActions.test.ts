/**
 * Pure decision helpers for first-wins SMS / Pushover rules.
 */
import {
  resolveOnTheWayActions,
  resolveArrivedActions,
  resolveThirtyMinutesActions,
} from '../../src/services/serviceStatusActions'

describe('serviceStatusActions decisions', () => {
  describe('ON_THE_WAY', () => {
    it('first teammate sends SMS and Pushover', () => {
      const result = resolveOnTheWayActions({
        alreadyClickedByThisEmployee: false,
        teamAlreadySentSms: false,
      })
      expect(result).toEqual({
        outcome: 'ok',
        recordClick: true,
        sendSms: true,
        sendPushover: true,
      })
    })

    it('later teammate skips SMS but still sends Pushover', () => {
      const result = resolveOnTheWayActions({
        alreadyClickedByThisEmployee: false,
        teamAlreadySentSms: true,
      })
      expect(result).toEqual({
        outcome: 'ok',
        recordClick: true,
        sendSms: false,
        sendPushover: true,
      })
    })

    it('duplicate click by same employee is a no-op', () => {
      const result = resolveOnTheWayActions({
        alreadyClickedByThisEmployee: true,
        teamAlreadySentSms: true,
      })
      expect(result).toEqual({
        outcome: 'already_handled',
        recordClick: false,
        sendSms: false,
        sendPushover: false,
      })
    })
  })

  describe('ARRIVED', () => {
    it('always Pushover, never SMS', () => {
      expect(
        resolveArrivedActions({ alreadyClickedByThisEmployee: false }),
      ).toEqual({
        outcome: 'ok',
        recordClick: true,
        sendSms: false,
        sendPushover: true,
      })
    })

    it('duplicate click by same employee is a no-op', () => {
      expect(
        resolveArrivedActions({ alreadyClickedByThisEmployee: true }),
      ).toEqual({
        outcome: 'already_handled',
        recordClick: false,
        sendSms: false,
        sendPushover: false,
      })
    })
  })

  describe('THIRTY_MINUTES_LEFT', () => {
    it('first click sends SMS and Pushover', () => {
      expect(
        resolveThirtyMinutesActions({ anyTeamMemberAlreadyClicked: false }),
      ).toEqual({
        outcome: 'ok',
        recordClick: true,
        sendSms: true,
        sendPushover: true,
      })
    })

    it('later clicks are ignored entirely', () => {
      expect(
        resolveThirtyMinutesActions({ anyTeamMemberAlreadyClicked: true }),
      ).toEqual({
        outcome: 'ignored',
        recordClick: false,
        sendSms: false,
        sendPushover: false,
      })
    })
  })
})
