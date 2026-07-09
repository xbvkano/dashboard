import { useEffect, useMemo, useRef, useState } from 'react'
import {
  allActiveVariablesFilled,
  detectRemovedVariables,
  excludedKeysFromInstanceBody,
  getTemplateVariableKeys,
  keysPresentInBody,
  removeVariableFromBodyWithAnchor,
  reinsertTokenInBody,
  renderMessageBankTemplate,
  type RemovedVariableAnchor,
} from '../../../../shared/messageBank'
import type { MessageBankTemplateDto } from './messageBankApi'
import ResetTemplateConfirmModal from './ResetTemplateConfirmModal'
import TemplatePlaceholderPreview from './TemplatePlaceholderPreview'
import VariableFieldList from './VariableFieldList'

type Props = {
  templates: MessageBankTemplateDto[]
  initialTemplateId?: number | null
  onBack?: () => void
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}

export default function UseTemplatePanel({ templates, initialTemplateId, onBack }: Props) {
  const [templateId, setTemplateId] = useState<number | null>(initialTemplateId ?? null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [excludedKeys, setExcludedKeys] = useState<string[]>([])
  const [instanceBody, setInstanceBody] = useState('')
  const [copied, setCopied] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editDraft, setEditDraft] = useState('')
  const removedVariableAnchorsRef = useRef<Record<string, RemovedVariableAnchor>>({})

  const template = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId],
  )

  const renderedBody = useMemo(
    () =>
      template
        ? renderMessageBankTemplate(instanceBody, values, excludedKeys)
        : '',
    [template, instanceBody, values, excludedKeys],
  )

  useEffect(() => {
    if (initialTemplateId != null) setTemplateId(initialTemplateId)
  }, [initialTemplateId])

  useEffect(() => {
    if (!template) {
      setValues({})
      setExcludedKeys([])
      setInstanceBody('')
      setEditMode(false)
      setEditDraft('')
      removedVariableAnchorsRef.current = {}
      return
    }
    const keys = getTemplateVariableKeys(template)
    const empty: Record<string, string> = {}
    for (const k of keys) empty[k] = ''
    setValues(empty)
    setExcludedKeys([])
    setInstanceBody(template.body)
    setEditMode(false)
    setEditDraft('')
    removedVariableAnchorsRef.current = {}
  }, [template])

  function applyInstanceBody(nextBody: string) {
    if (!template) return
    setInstanceBody(nextBody)
    setExcludedKeys(excludedKeysFromInstanceBody(template, nextBody))
    const present = keysPresentInBody(nextBody)
    for (const key of Object.keys(removedVariableAnchorsRef.current)) {
      if (present.has(key)) delete removedVariableAnchorsRef.current[key]
    }
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

  function performReset() {
    if (!template) return
    const keys = getTemplateVariableKeys(template)
    const empty: Record<string, string> = {}
    for (const k of keys) empty[k] = ''
    setValues(empty)
    setExcludedKeys([])
    setInstanceBody(template.body)
    setEditMode(false)
    setEditDraft('')
    setShowResetConfirm(false)
    removedVariableAnchorsRef.current = {}
  }

  function openEditMode() {
    setEditDraft(instanceBody)
    setEditMode(true)
  }

  function saveEdit() {
    if (!template) return
    const newRemovals = detectRemovedVariables(instanceBody, editDraft, template)
    Object.assign(removedVariableAnchorsRef.current, newRemovals)
    applyInstanceBody(editDraft)
    setEditMode(false)
    setEditDraft('')
  }

  function cancelEdit() {
    setEditMode(false)
    setEditDraft('')
  }

  const canCopy = renderedBody.trim().length > 0
  const sendReady = template
    ? allActiveVariablesFilled(template, values, excludedKeys)
    : false

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-200 shrink-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="min-h-[44px] min-w-[44px] text-slate-600"
            aria-label="Back"
          >
            ←
          </button>
        )}
        <h2 className="flex-1 font-semibold text-slate-900 truncate">Use template</h2>
        {template && (
          <>
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              disabled={editMode}
              className="min-h-[40px] px-3 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={editMode ? cancelEdit : openEditMode}
              className="min-h-[40px] px-3 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {editMode ? 'Cancel' : 'Edit'}
            </button>
          </>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Template</label>
          <select
            value={templateId ?? ''}
            onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[16px] md:text-sm"
          >
            <option value="">Select…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {template && (
          <>
            {editMode ? (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Edit message
                  <span className="block text-xs font-normal text-slate-500 mt-0.5">
                    Variables appear as labels like {'{{Name}}'}.
                  </span>
                </label>
                <textarea
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  autoFocus
                  className="w-full min-h-[200px] rounded-xl border border-slate-300 px-3 py-3 text-[16px] md:text-sm leading-relaxed resize-y font-mono"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="min-h-[44px] px-4 rounded-xl text-slate-700 hover:bg-slate-100 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveEdit}
                    className="min-h-[44px] px-4 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <TemplatePlaceholderPreview
                template={template}
                instanceBody={instanceBody}
                values={values}
                excludedKeys={excludedKeys}
                highlightKey={focusedKey}
                variant="main"
              />
            )}

            {!editMode && (
              <VariableFieldList
                template={template}
                instanceBody={instanceBody}
                values={values}
                excludedKeys={excludedKeys}
                onValueChange={handleValueChange}
                onRemove={handleRemove}
                onUndoRemove={handleUndoRemove}
                onFieldFocus={setFocusedKey}
                onFieldBlur={() => setFocusedKey(null)}
              />
            )}

            {!sendReady && !editMode && (
              <p className="text-xs text-amber-700">Fill all active variables to get a complete message.</p>
            )}
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          disabled={!canCopy || editMode}
          onClick={async () => {
            await copyText(renderedBody)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className="w-full min-h-[48px] rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-40"
        >
          {copied ? 'Copied!' : 'Copy to clipboard'}
        </button>
      </div>

      <ResetTemplateConfirmModal
        open={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={performReset}
      />
    </div>
  )
}
