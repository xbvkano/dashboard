import { MockSmsTransport } from '../../src/services/messaging/smsTransport'

describe('smsTransport MMS', () => {
  it('MockSmsTransport logs mediaPublicUrls when sending MMS', async () => {
    const t = new MockSmsTransport()
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {})
    await t.send({
      toE164: '+15551234567',
      body: '',
      mediaPublicUrls: ['https://cdn.example.com/outbound.jpg'],
    })
    const combined = JSON.stringify(spy.mock.calls)
    expect(combined).toContain('mediaUrls')
    expect(combined).toContain('outbound.jpg')
    spy.mockRestore()
  })
})
