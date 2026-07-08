import { SIZE_OPTIONS, APPOINTMENT_TYPE_OPTIONS } from '../../../../shared/sizeOptions'

export interface SizeTypeSearchValues {
  size: string
  type: string
}

interface SizeTypeSearchProps {
  values: SizeTypeSearchValues
  onChange: (values: SizeTypeSearchValues) => void
}

export default function SizeTypeSearch({ values, onChange }: SizeTypeSearchProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Size (SQFT)</span>
        <select
          value={values.size}
          onChange={(e) => onChange({ ...values, size: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Select size…</option>
          {SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
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
