import { describe, expect, it } from 'vitest'
import { SERVICE_STATUS_BUBBLE_COLOR } from './bubbleColor'

describe('SERVICE_STATUS_BUBBLE_COLOR', () => {
  it('is purple hex matching server constant', () => {
    expect(SERVICE_STATUS_BUBBLE_COLOR).toBe('#7C3AED')
  })
})
