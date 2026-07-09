import type { MessageBankTemplateDto } from './messageBankApi'
import {
  BUILTIN_VARIABLE_META,
  getVariableKeysInBodyOrder,
  labelForVariableKey,
  type BuiltinVariableKey,
} from '../../../../shared/messageBank'

type Props = {
  template: MessageBankTemplateDto
  instanceBody: string
  values: Record<string, string>
  excludedKeys: string[]
  onValueChange: (key: string, value: string) => void
  onRemove: (key: string) => void
  onUndoRemove: (key: string) => void
  onFieldFocus?: (key: string) => void
  onFieldBlur?: () => void
}

export default function VariableFieldList({
  template,
  instanceBody,
  values,
  excludedKeys,
  onValueChange,
  onRemove,
  onUndoRemove,
  onFieldFocus,
  onFieldBlur,
}: Props) {
  const allKeys = getVariableKeysInBodyOrder({ ...template, body: instanceBody })
  const activeKeys = allKeys.filter((k) => !excludedKeys.includes(k))
  const removedKeys = allKeys.filter((k) => excludedKeys.includes(k))

  return (
    <div className="space-y-4">
      {activeKeys.length > 0 && (
        <div className="space-y-3">
          {activeKeys.map((key) => {
            const label = labelForVariableKey(key, template)
            const isBuiltin = key in BUILTIN_VARIABLE_META
            return (
              <div key={key} className="flex gap-2 items-start">
                <div className="flex-1 min-w-0">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {label}
                    {isBuiltin && (
                      <span className="ml-1.5 text-xs font-normal text-slate-400">(built-in)</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={values[key] ?? ''}
                    onChange={(e) => onValueChange(key, e.target.value)}
                    onFocus={() => onFieldFocus?.(key)}
                    onBlur={() => onFieldBlur?.()}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[16px] md:text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(key)}
                  className="shrink-0 mt-7 min-h-[44px] min-w-[44px] rounded-lg text-slate-500 hover:bg-slate-100 active:bg-slate-200 text-sm"
                  aria-label={`Remove ${label}`}
                  title="Remove from this message"
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      )}

      {removedKeys.length > 0 && (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs font-medium text-slate-500 mb-2">Removed</p>
          <div className="flex flex-wrap gap-2">
            {removedKeys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => onUndoRemove(key)}
                className="text-sm text-blue-600 hover:underline min-h-[44px] px-2"
              >
                Undo {labelForVariableKey(key, template)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function isBuiltinKey(key: string): key is BuiltinVariableKey {
  return key in BUILTIN_VARIABLE_META
}
