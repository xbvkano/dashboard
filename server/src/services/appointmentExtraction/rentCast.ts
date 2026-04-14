import axios from 'axios'
import { getSizeRange } from '../../data/teamSizeData'

const DEFAULT_BASE = 'https://api.rentcast.io/v1'

/**
 * Returns a size bucket string (e.g. 1500-2000) from RentCast squareFootage, or null.
 */
export async function lookupSizeBucketFromAddress(address: string): Promise<string | null> {
  const key = process.env.RENTCAST_API_KEY?.trim()
  if (!key) return null

  const trimmed = address.trim()
  if (!trimmed) return null

  const base = (process.env.RENTCAST_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, '')

  try {
    const res = await axios.get(`${base}/properties`, {
      params: { address: trimmed, limit: 1 },
      headers: {
        Accept: 'application/json',
        'X-Api-Key': key,
      },
      timeout: 20_000,
    })

    const data = res.data
    const first = Array.isArray(data) ? data[0] : data?.data?.[0] ?? data
    const sqft = first?.squareFootage
    if (typeof sqft !== 'number' || !Number.isFinite(sqft) || sqft <= 0) {
      return null
    }
    return getSizeRange(String(Math.round(sqft)))
  } catch (e) {
    console.warn('[rentcast] Property lookup failed:', e instanceof Error ? e.message : e)
    return null
  }
}
