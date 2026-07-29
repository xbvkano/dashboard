import { useEffect, useMemo, useRef, useState } from 'react'
import {
  allActiveVariablesFilled,
  excludedKeysFromInstanceBody,
  formatPriceForMessage,
  formatServiceTypeForMessage,
  getTemplateVariableKeys,
  keysPresentInBody,
  removeVariableFromBodyWithAnchor,
  reinsertTokenInBody,
  renderMessageBankTemplate,
  type RemovedVariableAnchor,
} from '../../../../shared/messageBank'
import { copyTextToClipboard } from '../../../contactActions'
import {
  fetchMessageBankTemplates,
  type MessageBankTemplateDto,
} from '../../Messages/MessageBank/messageBankApi'
import TemplatePlaceholderPreview from '../../Messages/MessageBank/TemplatePlaceholderPreview'
import VariableFieldList from '../../Messages/MessageBank/VariableFieldList'

type Props = {
  serviceType: string
  price: number | null
  /** Estimated sqft from calculator — prefills {{home_size}} when present. */
  homeSize?: string | null
}

/** Templates usable from the calculator: any that include price and/or name. */
function usesPriceOrName(template: MessageBankTemplateDto): boolean {
  return (
    template.builtinVariables.includes('PRICE') ||
    template.builtinVariables.includes('NAME')
  )
}

function buildInitialValues(
  template: MessageBankTemplateDto,
  price: string,
  serviceType: string,
  homeSize: string,
): Record<string, string> {
  const values: Record<string, string> = {}
  for (const key of getTemplateVariableKeys(template)) {
    if (key === 'price') values[key] = price
    else if (key === 'serviceType') values[key] = serviceType
    else if (key === 'home_size') values[key] = homeSize
    else values[key] = ''
  }
  return values
}

export default function CalculatorMessageTemplates({
  serviceType,
  price,
  homeSize,
}: Props) {
  const [templates, setTemplates] = useState<MessageBankTemplateDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [excludedKeys, setExcludedKeys] = useState<string[]>([])
  const [instanceBody, setInstanceBody] = useState('')
  const [copied, setCopied] = useState(false)
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const removedVariableAnchorsRef = useRef<Record<string, RemovedVariableAnchor>>({})

  const formattedPrice = useMemo(() => formatPriceForMessage(price), [price])
  const formattedServiceType = useMemo(
    () => formatServiceTypeForMessage(serviceType),
    [serviceType],
  )
  const formattedHomeSize = (homeSize ?? '').trim()

  const quoteTemplates = useMemo(
    () => templates.filter(usesPriceOrName).sort((a, b) => a.name.localeCompare(b.name)),
    [templates],
  )

  const selected = useMemo(
    () => quoteTemplates.find((t) => t.id === selectedId) ?? null,
    [quoteTemplates, selectedId],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchMessageBankTemplates()
      .then((data) => {
        if (!cancelled) setTemplates(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load templates')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selected) {
      setValues({})
      setExcludedKeys([])
      setInstanceBody('')
      setFocusedKey(null)
      setCopied(false)
      removedVariableAnchorsRef.current = {}
      return
    }
    setValues(
      buildInitialValues(selected, formattedPrice, formattedServiceType, formattedHomeSize),
    )
    setExcludedKeys([])
    setInstanceBody(selected.body)
    setFocusedKey(null)
    setCopied(false)
    removedVariableAnchorsRef.current = {}
  }, [selected, formattedPrice, formattedServiceType, formattedHomeSize])

  const renderedBody = useMemo(
    () =>
      selected ? renderMessageBankTemplate(instanceBody, values, excludedKeys) : '',
    [selected, instanceBody, values, excludedKeys],
  )

  const canCopy =
    selected != null &&
    allActiveVariablesFilled(selected, values, excludedKeys) &&
    renderedBody.trim().length > 0

  if (!formattedPrice) return null

  function applyInstanceBody(nextBody: string) {
    if (!selected) return
    setInstanceBody(nextBody)
    setExcludedKeys(excludedKeysFromInstanceBody(selected, nextBody))
    const present = keysPresentInBody(nextBody)
    for (const key of Object.keys(removedVariableAnchorsRef.current)) {
      if (present.has(key)) delete removedVariableAnchorsRef.current[key]
    }
  }

  function handleSelect(template: MessageBankTemplateDto) {
    setSelectedId((prev) => (prev === template.id ? null : template.id))
  }

  function handleValueChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function handleRemove(key: string) {
    const result = removeVariableFromBodyWithAnchor(instanceBody, key)
    if (!result) return
    removedVariableAnchorsRef.current[key] = result.anchor
    applyInstanceBody(result.body)
  }

  function handleUndoRemove(key: string) {
    const nextBody = reinsertTokenInBody(
      instanceBody,
      key,
      removedVariableAnchorsRef.current[key],
    )
    delete removedVariableAnchorsRef.current[key]
    applyInstanceBody(nextBody)
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-700">SMS templates</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Prefills {'{{Price}}'} ({formattedPrice})
          {formattedServiceType ? (
            <>
              {' '}
              and {'{{ServiceType}}'} ({formattedServiceType})
            </>
          ) : null}
          when present. Fill name or other fields, then copy.
        </p>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading templates…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && quoteTemplates.length === 0 && (
        <p className="text-sm text-slate-500">
          No Message Bank templates use price or name yet.
        </p>
      )}

      {!loading && !error && quoteTemplates.length > 0 && (
        <ul className="space-y-2">
          {quoteTemplates.map((template) => {
            const isOpen = selectedId === template.id
            return (
              <li key={template.id} className="rounded-lg border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleSelect(template)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-slate-50"
                >
                  <span className="text-sm font-medium text-slate-900">{template.name}</span>
                  <span className="text-xs text-slate-500 shrink-0">{isOpen ? 'Hide' : 'Use'}</span>
                </button>
                {isOpen && selected && (
                  <div className="border-t border-slate-100 px-3 py-3 space-y-3 bg-slate-50/60">
                    <TemplatePlaceholderPreview
                      template={selected}
                      instanceBody={instanceBody}
                      values={values}
                      excludedKeys={excludedKeys}
                      highlightKey={focusedKey}
                      variant="main"
                    />
                    <VariableFieldList
                      template={selected}
                      instanceBody={instanceBody}
                      values={values}
                      excludedKeys={excludedKeys}
                      onValueChange={handleValueChange}
                      onRemove={handleRemove}
                      onUndoRemove={handleUndoRemove}
                      onFieldFocus={setFocusedKey}
                      onFieldBlur={() => setFocusedKey(null)}
                    />
                    {!canCopy && (
                      <p className="text-xs text-amber-700">
                        Fill remaining fields (or remove unused ones) to copy a complete message.
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={!canCopy}
                      onClick={async () => {
                        await copyTextToClipboard(renderedBody)
                        setCopied(true)
                        setTimeout(() => setCopied(false), 2000)
                      }}
                      className="w-full min-h-[44px] rounded-lg bg-slate-800 text-white text-sm font-semibold disabled:opacity-40 hover:bg-slate-700"
                    >
                      {copied ? 'Copied!' : 'Copy message'}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
