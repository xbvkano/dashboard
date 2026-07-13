export interface PricingResult {
  teamSize: number | null
  price: number | null
  requiresReview: boolean
  message?: string
  size?: string
  extraCleanerAmount?: number | null
  baseboardsPrice?: number | null
  carpetShampoo?: { rooms: number; ratePerRoom: number; total: number } | null
}

export interface ResultField {
  id: string
  label: string
  value: string
}

interface PricingResultProps {
  result: PricingResult | null
  loading?: boolean
  error?: string | null
}

function buildResultFields(result: PricingResult): ResultField[] {
  if (result.requiresReview) {
    return []
  }
  const fields: ResultField[] = []
  if (result.size) {
    fields.push({ id: 'size', label: 'Estimated Size (SQFT)', value: result.size })
  }
  if (result.teamSize != null) {
    fields.push({ id: 'teamSize', label: 'Team Size', value: String(result.teamSize) })
  }
  if (result.price != null) {
    fields.push({ id: 'price', label: 'Base Price', value: `$${result.price}` })
  }
  if (result.extraCleanerAmount != null) {
    fields.push({
      id: 'extraCleaner',
      label: 'Extra Cleaner',
      value: `$${result.extraCleanerAmount}`,
    })
  }
  if (result.carpetShampoo) {
    const { rooms, ratePerRoom, total } = result.carpetShampoo
    fields.push({
      id: 'carpetShampoo',
      label: 'Carpet Shampoo',
      value: `${rooms} room${rooms !== 1 ? 's' : ''} × $${ratePerRoom} = $${total}`,
    })
  }
  if (result.baseboardsPrice != null) {
    fields.push({
      id: 'baseboards',
      label: 'Baseboards Add-on',
      value: `$${result.baseboardsPrice}`,
    })
  }
  return fields
}

export default function PricingResult({ result, loading, error }: PricingResultProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Calculating…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (!result) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        Select inputs above to see pricing.
      </div>
    )
  }

  if (result.requiresReview) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-900">
          {result.message ?? 'Price requires supervisor review'}
        </p>
      </div>
    )
  }

  const fields = buildResultFields(result)

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Result</h3>
      <dl className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.id}>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {field.label}
            </dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900">{field.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
