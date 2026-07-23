import { resolveOutboundBubbleColor } from '../../src/utils/messageBubbleDisplay'
import { SERVICE_STATUS_BUBBLE_COLOR } from '../../src/constants/serviceStatus'

describe('resolveOutboundBubbleColor', () => {
  it('prefers bubbleColorOverride over staff color', () => {
    expect(
      resolveOutboundBubbleColor({
        bubbleColorOverride: SERVICE_STATUS_BUBBLE_COLOR,
        staffBubbleColor: '#3b82f6',
      }),
    ).toBe(SERVICE_STATUS_BUBBLE_COLOR)
  })

  it('falls back to staff color when no override', () => {
    expect(
      resolveOutboundBubbleColor({
        bubbleColorOverride: null,
        staffBubbleColor: '#112233',
      }),
    ).toBe('#112233')
  })

  it('returns null when neither is set', () => {
    expect(
      resolveOutboundBubbleColor({
        bubbleColorOverride: null,
        staffBubbleColor: null,
      }),
    ).toBeNull()
  })

  it('ignores invalid override hex', () => {
    expect(
      resolveOutboundBubbleColor({
        bubbleColorOverride: 'purple',
        staffBubbleColor: '#aabbcc',
      }),
    ).toBe('#aabbcc')
  })
})
