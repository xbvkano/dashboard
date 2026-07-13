import { APPOINTMENT_TYPE_OPTIONS } from '../../../../shared/sizeOptions'

export const BEDROOM_OPTIONS = [1, 2, 3, 4] as const
export const BATHROOM_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4] as const

export interface BedBathSearchValues {
  bedrooms: string
  bathrooms: string
  type: string
}

interface BedBathSearchProps {
  values: BedBathSearchValues
  onChange: (values: BedBathSearchValues) => void
}

export default function BedBathSearch({ values, onChange }: BedBathSearchProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Bedrooms</span>
        <select
          value={values.bedrooms}
          onChange={(e) => onChange({ ...values, bedrooms: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Select…</option>
          {BEDROOM_OPTIONS.map((n) => (
            <option key={n} value={String(n)}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Bathrooms</span>
        <select
          value={values.bathrooms}
          onChange={(e) => onChange({ ...values, bathrooms: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Select…</option>
          {BATHROOM_OPTIONS.map((n) => (
            <option key={n} value={String(n)}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Type</span>
        <select
          value={values.type}
          onChange={(e) => onChange({ ...values, type: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Select type…</option>
          {APPOINTMENT_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
