import { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL, fetchJson } from '../../../../api'
import PricingResult, { type PricingResult as PricingResultType } from './PricingResult'
import {
  searchModes,
  defaultSizeTypeValues,
  defaultBedBathValues,
  type SearchModeId,
  type SizeTypeSearchValues,
  type BedBathSearchValues,
  type CalculatorSearchValues,
} from './searchModes'

export default function PricingCalculator() {
  const [activeMode, setActiveMode] = useState<SearchModeId>('sizeType')
  const [sizeTypeValues, setSizeTypeValues] = useState<SizeTypeSearchValues>(defaultSizeTypeValues)
  const [bedBathValues, setBedBathValues] = useState<BedBathSearchValues>(defaultBedBathValues)
  const [carpetShampooRooms, setCarpetShampooRooms] = useState(0)
  const [result, setResult] = useState<PricingResultType | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enabledModes = searchModes.filter((m) => m.enabled)
  const currentMode = searchModes.find((m) => m.id === activeMode && m.enabled)
  const SearchComponent = currentMode?.component

  const values: CalculatorSearchValues =
    activeMode === 'sizeType' ? sizeTypeValues : bedBathValues

  const handleValuesChange = (next: CalculatorSearchValues) => {
    if (activeMode === 'sizeType') {
      setSizeTypeValues(next as SizeTypeSearchValues)
    } else {
      setBedBathValues(next as BedBathSearchValues)
    }
  }

  const calculate = useCallback(async () => {
    const carpetRooms = carpetShampooRooms > 0 ? carpetShampooRooms : undefined

    if (activeMode === 'sizeType') {
      const { size, type } = sizeTypeValues
      if (!size || !type) {
        setResult(null)
        setError(null)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const data = await fetchJson<PricingResultType>(`${API_BASE_URL}/pricing/calculate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'sizeType', size, type, carpetShampooRooms: carpetRooms }),
        })
        setResult(data)
      } catch (err) {
        setResult(null)
        setError(err instanceof Error ? err.message : 'Failed to calculate pricing')
      } finally {
        setLoading(false)
      }
      return
    }

    const { bedrooms, bathrooms, type } = bedBathValues
    if (!bedrooms || !bathrooms || !type) {
      setResult(null)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await fetchJson<PricingResultType>(`${API_BASE_URL}/pricing/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'bedBath',
          bedrooms: Number(bedrooms),
          bathrooms: Number(bathrooms),
          type,
          carpetShampooRooms: carpetRooms,
        }),
      })
      setResult(data)
    } catch (err) {
      setResult(null)
      setError(err instanceof Error ? err.message : 'Failed to calculate pricing')
    } finally {
      setLoading(false)
    }
  }, [activeMode, sizeTypeValues, bedBathValues, carpetShampooRooms])

  useEffect(() => {
    const timer = setTimeout(() => {
      calculate()
    }, 300)
    return () => clearTimeout(timer)
  }, [calculate])

  return (
    <div className="space-y-6">
      {enabledModes.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {enabledModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setActiveMode(mode.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                activeMode === mode.id
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      )}

      {SearchComponent && (
        <SearchComponent values={values} onChange={handleValuesChange} />
      )}

      <label className="block max-w-xs">
        <span className="mb-1 block text-sm font-medium text-slate-700">
          Carpet Shampoo Rooms
        </span>
        <input
          type="number"
          min={0}
          value={carpetShampooRooms || ''}
          onChange={(e) => setCarpetShampooRooms(Math.max(0, parseInt(e.target.value, 10) || 0))}
          placeholder="0"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      <PricingResult result={result} loading={loading} error={error} />
    </div>
  )
}
