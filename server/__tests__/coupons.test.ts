/**
 * Tests for the Coupons API proxy: URL building, 503 when WEBSITE_SERVER_URL
 * is missing, forwarding to external API, and 204/no-body handling.
 */

const mockFetch = jest.fn()
const originalEnv = process.env

beforeAll(() => {
  ;(global as any).fetch = mockFetch
})

afterAll(() => {
  process.env = originalEnv
  ;(global as any).fetch = undefined
})

beforeEach(() => {
  jest.clearAllMocks()
})

import { Request, Response } from 'express'
import { proxy, couponsUrl } from '../src/routes/coupons'

function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    path: '/coupons',
    url: '/coupons',
    body: undefined,
    headers: {},
    params: {},
    query: {},
    ...overrides,
  } as Request
}

function mockResponse(): Response {
  const res = {} as Response
  res.status = jest.fn().mockReturnThis()
  res.json = jest.fn().mockReturnThis()
  res.send = jest.fn().mockReturnThis()
  return res
}

describe('couponsUrl', () => {
  it('builds list URL with base and /api/coupons', () => {
    const req = mockRequest({ path: '/coupons', url: '/coupons' })
    expect(couponsUrl(req, 'https://example.com')).toBe('https://example.com/api/coupons')
  })

  it('builds URL with trailing slash removed from base', () => {
    const req = mockRequest({ path: '/coupons', url: '/coupons' })
    expect(couponsUrl(req, 'https://example.com/')).toBe('https://example.com/api/coupons')
  })

  it('builds get-one URL with id', () => {
    const req = mockRequest({
      path: '/coupons/550e8400-e29b-41d4-a716-446655440000',
      url: '/coupons/550e8400-e29b-41d4-a716-446655440000',
    })
    expect(couponsUrl(req, 'https://api.example.com')).toBe(
      'https://api.example.com/api/coupons/550e8400-e29b-41d4-a716-446655440000'
    )
  })

  it('builds validate URL', () => {
    const req = mockRequest({
      path: '/coupons/validate',
      url: '/coupons/validate',
    })
    expect(couponsUrl(req, 'https://site.com')).toBe('https://site.com/api/coupons/validate')
  })

  it('appends query string when present', () => {
    const req = mockRequest({ path: '/coupons', url: '/coupons?foo=bar' })
    expect(couponsUrl(req, 'https://example.com')).toBe('https://example.com/api/coupons?foo=bar')
  })
})

describe('proxy', () => {
  it('returns 503 when WEBSITE_SERVER_URL is not set', async () => {
    const prev = process.env.WEBSITE_SERVER_URL
    delete process.env.WEBSITE_SERVER_URL
    const req = mockRequest()
    const res = mockResponse()
    await proxy(req, res)
    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.json).toHaveBeenCalledWith({
      message: 'Coupons API URL not configured (WEBSITE_SERVER_URL).',
    })
    expect(mockFetch).not.toHaveBeenCalled()
    process.env.WEBSITE_SERVER_URL = prev
  })

  it('forwards GET /coupons and returns JSON', async () => {
    process.env.WEBSITE_SERVER_URL = 'https://website.example.com'
    mockFetch.mockResolvedValue({
      status: 200,
      text: () => Promise.resolve(JSON.stringify([{ id: '1', name: 'SAVE10' }])),
    })
    const req = mockRequest({ method: 'GET', path: '/coupons', url: '/coupons' })
    const res = mockResponse()
    await proxy(req, res)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://website.example.com/api/coupons',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: undefined,
      })
    )
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith([{ id: '1', name: 'SAVE10' }])
  })

  it('forwards POST /coupons with body', async () => {
    process.env.WEBSITE_SERVER_URL = 'https://api.test.com'
    mockFetch.mockResolvedValue({
      status: 201,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            id: 'new-uuid',
            name: 'SAVE10',
            type: 'percent',
            value: '10',
            expireDate: '2025-12-31T23:59:59.000Z',
            useCount: 0,
          })
        ),
    })
    const body = {
      name: 'SAVE10',
      type: 'percent',
      value: '10',
      expireDate: '2025-12-31T23:59:59.000Z',
      useCount: 0,
    }
    const req = mockRequest({
      method: 'POST',
      path: '/coupons',
      url: '/coupons',
      body,
    })
    const res = mockResponse()
    await proxy(req, res)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test.com/api/coupons',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(body),
      })
    )
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-uuid', name: 'SAVE10' })
    )
  })

  it('forwards PATCH /coupons/:id and returns updated coupon', async () => {
    process.env.WEBSITE_SERVER_URL = 'https://site.com'
    mockFetch.mockResolvedValue({
      status: 200,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            id: 'abc-123',
            name: 'SAVE15',
            type: 'percent',
            value: '15',
            expireDate: '2026-01-31T23:59:59.000Z',
            useCount: 2,
          })
        ),
    })
    const req = mockRequest({
      method: 'PATCH',
      path: '/coupons/abc-123',
      url: '/coupons/abc-123',
      body: { value: '15' },
    })
    const res = mockResponse()
    await proxy(req, res)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://site.com/api/coupons/abc-123',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ value: '15' }),
      })
    )
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'SAVE15', value: '15' })
    )
  })

  it('forwards DELETE and returns 204 with no body', async () => {
    process.env.WEBSITE_SERVER_URL = 'https://site.com'
    mockFetch.mockResolvedValue({
      status: 204,
      text: () => Promise.resolve(''),
    })
    const req = mockRequest({
      method: 'DELETE',
      path: '/coupons/xyz-789',
      url: '/coupons/xyz-789',
    })
    const res = mockResponse()
    await proxy(req, res)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://site.com/api/coupons/xyz-789',
      expect.objectContaining({ method: 'DELETE' })
    )
    expect(res.status).toHaveBeenCalledWith(204)
    expect(res.send).toHaveBeenCalledWith()
    expect(res.json).not.toHaveBeenCalled()
  })

  it('returns 502 when fetch throws', async () => {
    process.env.WEBSITE_SERVER_URL = 'https://site.com'
    mockFetch.mockRejectedValue(new Error('Network error'))
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const req = mockRequest()
    const res = mockResponse()
    await proxy(req, res)
    expect(res.status).toHaveBeenCalledWith(502)
    expect(res.json).toHaveBeenCalledWith({ message: 'Failed to reach Coupons API.' })
    consoleSpy.mockRestore()
  })

  it('forwards 400 error response from API', async () => {
    process.env.WEBSITE_SERVER_URL = 'https://site.com'
    mockFetch.mockResolvedValue({
      status: 400,
      text: () => Promise.resolve(JSON.stringify({ message: 'Missing required fields.' })),
    })
    const req = mockRequest({ method: 'POST', path: '/coupons', url: '/coupons', body: {} })
    const res = mockResponse()
    await proxy(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ message: 'Missing required fields.' })
  })
})
