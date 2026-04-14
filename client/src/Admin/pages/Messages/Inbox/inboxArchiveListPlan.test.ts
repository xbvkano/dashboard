import { describe, expect, it } from 'vitest'
import { inboxListAfterStatusPatch } from './inboxArchiveListPlan'

describe('inboxListAfterStatusPatch', () => {
  it('after unarchive while viewing archived, load OPEN inbox and leave archived mode', () => {
    expect(inboxListAfterStatusPatch('OPEN', true)).toEqual({
      fetchStatus: 'OPEN',
      setShowArchived: false,
    })
  })

  it('after archive while viewing inbox, load ARCHIVED list and enter archived mode', () => {
    expect(inboxListAfterStatusPatch('ARCHIVED', false)).toEqual({
      fetchStatus: 'ARCHIVED',
      setShowArchived: true,
    })
  })

  it('no list switch when archiving from archived view (restore is OPEN branch)', () => {
    expect(inboxListAfterStatusPatch('ARCHIVED', true)).toBeNull()
  })

  it('no list switch when restoring from inbox (already open)', () => {
    expect(inboxListAfterStatusPatch('OPEN', false)).toBeNull()
  })
})
