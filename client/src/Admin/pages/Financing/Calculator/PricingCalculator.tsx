import { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL, fetchJson } from '../../../../api'
import PricingResult, { type PricingResult as PricingResultType } from './PricingResult'
import {
  searchModes,
  defaultSizeTypeValues,
  type SearchModeId,
  type SizeTypeSearchValues,
} from './searchModes'

export default function PricingCalculator() {
  const [activeMode, setActiveMode] = useState<SearchModeId>('sizeType')
  const [values, setValues] = useState<SizeTypeSearchValues>(defaultSizeTypeValues)
  const [result, setResult] = useState<PricingResultType | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enabledModes = searchModes.filter((m) => m.enabled)
  const currentMode = searchModes.find((m) => m.id === activeMode && m.enabled)
  const SearchComponent = currentMode?.component

  const calculate = useCallback(async (size: string, type: string) => {
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
        body: JSON.stringify({ mode: 'sizeType', size, type }),
      })
      setResult(data)
    } catch (err) {
      setResult(null)
      setError(err instanceof Error ? err.message : 'Failed to calculate pricing')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeMode === 'sizeType') {
        calculate(values.size, values.type)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [values, activeMode, calculate])

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
        <SearchComponent values={values} onChange={setValues} />
      )}

      <PricingResult result={result} loading={loading} error={error} />
    </div>
  )
}
