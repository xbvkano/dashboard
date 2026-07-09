import { useState } from 'react'
import {
  slugifyVariableKey,
  tokenForKey,
  type CustomVariableDef,
} from '../../../../shared/messageBank'
import AddCustomVariableModal from './AddCustomVariableModal'

type Props = {
  customVariables: CustomVariableDef[]
  onChange: (next: CustomVariableDef[]) => void
  onInsertToken: (token: string) => void
}

export default function CustomVariablesEditor({
  customVariables,
  onChange,
  onInsertToken,
}: Props) {
  const [addOpen, setAddOpen] = useState(false)

  function confirmAddVariable(label: string) {
    const existingKeys = customVariables.map((c) => c.key)
    const key = slugifyVariableKey(label, existingKeys)
    const next = [...customVariables, { key, label }]
    onChange(next)
    onInsertToken(tokenForKey(key))
  }

  function updateLabel(index: number, label: string) {
    const next = customVariables.map((c, i) => (i === index ? { ...c, label } : c))
    onChange(next)
  }

  function removeAt(index: number) {
    onChange(customVariables.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">Custom variables</h3>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 min-h-[44px] px-2"
        >
          + Add
        </button>
      </div>
      {customVariables.length === 0 ? (
        <p className="text-sm text-slate-500">No custom variables yet.</p>
      ) : (
        <ul className="space-y-2">
          {customVariables.map((cv, i) => (
            <li key={cv.key} className="flex gap-2 items-center">
              <input
                type="text"
                value={cv.label}
                onChange={(e) => updateLabel(i, e.target.value)}
                placeholder="Label"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-[16px] md:text-sm"
              />
              <code className="text-xs text-slate-500 shrink-0 hidden sm:inline">{`{{${cv.key}}}`}</code>
              <button
                type="button"
                onClick={() => onInsertToken(tokenForKey(cv.key))}
                className="text-xs text-blue-600 min-h-[44px] px-2 shrink-0"
              >
                Insert
              </button>
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="text-slate-500 min-h-[44px] min-w-[44px] shrink-0"
                aria-label="Remove custom variable"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <AddCustomVariableModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onConfirm={confirmAddVariable}
      />
    </div>
  )
}
