import {
  countUnvisitedFromWebsiteList,
  countUnvisitedItems,
  EMPTY_LEAD_UNREAD_COUNTS,
  fetchLeadUnreadCounts,
  listAllWebsiteItems,
  needsLeadVisitedReset,
  nextWebsiteListOffset,
  parseWebsiteListPage,
  websiteItemId,
} from '../../src/services/leadUnreadCounts'

function jsonResponse(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response)
}

describe('lead unread counting', () => {
  it('counts only visited === false', () => {
    expect(
      countUnvisitedItems([
        { id: 1, visited: false },
        { id: 2, visited: true },
        { id: 3 },
        { id: 4, visited: false },
      ]),
    ).toBe(2)
  })

  it('coerces numeric string ids and treats not-true visited as resettable', () => {
    expect(websiteItemId({ id: '12' })).toBe(12)
    expect(websiteItemId({ id: 12 })).toBe(12)
    expect(needsLeadVisitedReset({ id: 1, visited: false })).toBe(true)
    expect(needsLeadVisitedReset({ id: 1 })).toBe(true)
    expect(needsLeadVisitedReset({ id: 1, visited: true })).toBe(false)
  })

  it('parses paged website list payloads', () => {
    expect(parseWebsiteListPage({ data: [{ id: 1 }], total: 9, nextOffset: 5 })).toEqual({
      items: [{ id: 1 }],
      reportedTotal: 9,
      nextOffset: 5,
    })
    expect(parseWebsiteListPage({ data: [{ id: 1 }], total: '9', nextOffset: '20' })).toEqual({
      items: [{ id: 1 }],
      reportedTotal: 9,
      nextOffset: 20,
    })
    expect(parseWebsiteListPage([{ id: 2 }])).toEqual({
      items: [{ id: 2 }],
      reportedTotal: 1,
      nextOffset: null,
    })
  })

  it('continues paging when nextOffset is a string', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ id: 1, visited: false }],
          total: 2,
          nextOffset: '1',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ id: 2, visited: false }],
          total: 2,
          nextOffset: null,
        }),
      )
    await expect(
      listAllWebsiteItems({ fetchImpl: fetchImpl as any, listUrl: 'https://site.test/api/quotes' }),
    ).resolves.toEqual([
      { id: 1, visited: false },
      { id: 2, visited: false },
    ])
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(String(fetchImpl.mock.calls[1][0])).toContain('offset=1')
  })

  it('keeps paging when total is larger than the first page and hasMore/nextOffset are missing', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ id: 1, visited: false }],
          total: 3,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ id: 2, visited: false }],
          total: 3,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ id: 3, visited: false }],
          total: 3,
        }),
      )
    await expect(
      listAllWebsiteItems({ fetchImpl: fetchImpl as any, listUrl: 'https://site.test/api/calls' }),
    ).resolves.toHaveLength(3)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(nextWebsiteListOffset({
      page: { items: [{ id: 1 }], reportedTotal: 3, nextOffset: null },
      currentOffset: 0,
      fetchedCount: 1,
    })).toBe(1)
  })

  it('trusts total when visited=false filter is honored', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({
        data: [
          { id: 1, visited: false },
          { id: 2, visited: false },
        ],
        total: 7,
        nextOffset: 2,
      }),
    )
    await expect(
      countUnvisitedFromWebsiteList({ fetchImpl: fetchImpl as any, listUrl: 'https://site.test/api/quotes' }),
    ).resolves.toBe(7)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('pages and counts unvisited when the filter is ignored', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            { id: 1, visited: false },
            { id: 2, visited: true },
          ],
          total: 100,
          nextOffset: 2,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ id: 3, visited: false }],
          total: 3,
          nextOffset: null,
        }),
      )
    await expect(
      countUnvisitedFromWebsiteList({ fetchImpl: fetchImpl as any, listUrl: 'https://site.test/api/calls' }),
    ).resolves.toBe(2)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('returns zeros when website URL is missing or fetch fails', async () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {})
    await expect(fetchLeadUnreadCounts({ baseUrl: '' })).resolves.toEqual(EMPTY_LEAD_UNREAD_COUNTS)
    const fetchImpl = jest.fn().mockRejectedValue(new Error('offline'))
    await expect(
      fetchLeadUnreadCounts({ baseUrl: 'https://site.test', fetchImpl: fetchImpl as any }),
    ).resolves.toEqual(EMPTY_LEAD_UNREAD_COUNTS)
    err.mockRestore()
  })
})
