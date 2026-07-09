import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  allActiveVariablesFilled,
  detectRemovedVariables,
  excludedKeysFromInstanceBody,
  getTemplateVariableKeys,
  keysPresentInBody,
  missingActiveVariableLabels,
  removeVariableFromBody,
  removeVariableFromBodyWithAnchor,
  reinsertTokenInBody,
  renderMessageBankTemplate,
  type RemovedVariableAnchor,
} from '../../../../shared/messageBank'
import type { MessageBankTemplateDto } from './messageBankApi'
import { useMessageBankDrafts } from './MessageBankDraftsContext'
import { useMessageBankFullPageLayout } from './useMessageBankFullPageLayout'
import ResetTemplateConfirmModal from './ResetTemplateConfirmModal'
import TemplatePlaceholderPreview from './TemplatePlaceholderPreview'
import VariableFieldList from './VariableFieldList'

type Props = {
  open: boolean
  onClose: () => void
  template: MessageBankTemplateDto | null
  conversationId: number
  initialValues: Record<string, string>
  onSend: (text: string) => void | Promise<void>
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

export default function MessageBankUseModal({
  open,
  onClose,
  template,
  conversationId,
  initialValues,
  onSend,
}: Props) {
  const { getDraft, setDraft, clearDraft } = useMessageBankDrafts()
  const fullPage = useMessageBankFullPageLayout()
  const [values, setValues] = useState<Record<string, string>>({})
  const [excludedKeys, setExcludedKeys] = useState<string[]>([])
  const [instanceBody, setInstanceBody] = useState('')
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editDraft, setEditDraft] = useState('')
  const removedVariableAnchorsRef = useRef<Record<string, RemovedVariableAnchor>>({})
  const activeSessionKeyRef = useRef<string | null>(null)

  const renderedBody = useMemo(
    () =>
      template
        ? renderMessageBankTemplate(instanceBody, values, excludedKeys)
        : '',
    [template, instanceBody, values, excludedKeys],
  )

  function resetSessionState() {
    setValues({})
    setExcludedKeys([])
    setInstanceBody('')
    setEditMode(false)
    setEditDraft('')
    setShowResetConfirm(false)
    setFocusedKey(null)
    setCopied(false)
    removedVariableAnchorsRef.current = {}
  }

  function loadFreshSession(nextTemplate: MessageBankTemplateDto) {
    const existing = getDraft(conversationId, nextTemplate.id)
    if (existing) {
      let restoredInstance = existing.instanceBody ?? nextTemplate.body
      if (!existing.instanceBody) {
        for (const key of existing.excludedVariableKeys) {
          restoredInstance = removeVariableFromBody(restoredInstance, key)
        }
      }
      setValues(existing.variableValues)
      setInstanceBody(restoredInstance)
      setExcludedKeys(excludedKeysFromInstanceBody(nextTemplate, restoredInstance))
      removedVariableAnchorsRef.current = {}
      return
    }
    const keys = getTemplateVariableKeys(nextTemplate)
    const nextValues: Record<string, string> = {}
    for (const k of keys) {
      nextValues[k] = initialValues[k] ?? ''
    }
    setValues(nextValues)
    setExcludedKeys([])
    setInstanceBody(nextTemplate.body)
    removedVariableAnchorsRef.current = {}
  }

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open || !template) {
      activeSessionKeyRef.current = null
      resetSessionState()
      return
    }

    const sessionKey = `${conversationId}:${template.id}`
    if (activeSessionKeyRef.current === sessionKey) return
    activeSessionKeyRef.current = sessionKey
    loadFreshSession(template)
  }, [open, template, conversationId, getDraft, initialValues])

  const canSend = useMemo(
    () =>
      template != null &&
      allActiveVariablesFilled(template, values, excludedKeys) &&
      renderedBody.trim().length > 0,
    [template, values, excludedKeys, renderedBody],
  )

  const missingLabels = useMemo(
    () => (template ? missingActiveVariableLabels(template, values, excludedKeys) : []),
    [template, values, excludedKeys],
  )

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
    const nextValues: Record<string, string> = {}
    for (const k of keys) nextValues[k] = initialValues[k] ?? ''
    setValues(nextValues)
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

  function handleSaveDraft() {
    if (!template) return
    setDraft(conversationId, {
      templateId: template.id,
      body: renderedBody,
      instanceBody,
      variableValues: values,
      excludedVariableKeys: excludedKeys,
      updatedAt: new Date().toISOString(),
    })
    onClose()
  }

  async function handleSend() {
    if (!canSend || sending) return
    setSending(true)
    try {
      await onSend(renderedBody.trim())
      clearDraft(conversationId, template.id)
      onClose()
    } finally {
      setSending(false)
    }
  }

  if (!open || !template) return null

  const previewVariant = fullPage ? 'page' : 'main'

  const inner = (
    <>
      <div
        className={`flex items-center gap-2 border-b border-slate-200 shrink-0 ${
          fullPage ? 'px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]' : 'px-4 pb-3'
        }`}
      >
        {fullPage && (
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 shrink-0 text-lg"
            aria-label="Back"
          >
            ←
          </button>
        )}
        <h2 className="flex-1 min-w-0 text-lg font-semibold text-slate-900 truncate">
          {template.name}
        </h2>
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
        {!fullPage && (
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 shrink-0"
          >
            Close
          </button>
        )}
      </div>

      <div
        className={`flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 space-y-4 ${
          fullPage ? 'flex flex-col' : ''
        }`}
      >
        {editMode ? (
          <div className={`space-y-2 ${fullPage ? 'flex flex-col flex-1 min-h-0' : ''}`}>
            <label className="block text-sm font-medium text-slate-700">
              Edit message
              <span className="block text-xs font-normal text-slate-500 mt-0.5">
                Variables appear as labels like {'{{Name}}'}. Removing a label removes that
                variable from this message.
              </span>
            </label>
            <textarea
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              autoFocus
              className={`w-full rounded-xl border border-slate-300 px-3 py-3 text-[16px] md:text-sm leading-relaxed resize-y font-mono ${
                fullPage
                  ? 'flex-1 min-h-[200px]'
                  : 'min-h-[240px] max-h-[40dvh] overflow-y-auto'
              }`}
            />
            <div className="flex justify-end gap-2 shrink-0">
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
            variant={previewVariant}
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
      </div>

      <div className="shrink-0 border-t border-slate-200 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2 bg-white">
        {!canSend && missingLabels.length > 0 && !editMode && (
          <p className="text-xs text-amber-700 text-center">
            Fill in {missingLabels.join(', ')} to send
          </p>
        )}
        <div className={`grid gap-2 ${fullPage ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'}`}>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={editMode}
            className="min-h-[48px] rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 text-sm disabled:opacity-40"
          >
            Draft
          </button>
          <button
            type="button"
            disabled={!renderedBody.trim() || editMode}
            onClick={async () => {
              await copyText(renderedBody)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
            className="min-h-[48px] rounded-xl border border-blue-200 bg-blue-50 text-blue-700 font-semibold text-sm disabled:opacity-40"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            type="button"
            disabled={!canSend || sending || editMode}
            onClick={() => void handleSend()}
            className="min-h-[48px] rounded-xl bg-blue-600 text-white font-semibold text-sm disabled:opacity-40"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>

      <ResetTemplateConfirmModal
        open={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={performReset}
      />
    </>
  )

  if (fullPage) {
    return createPortal(
      <div
        className="fixed inset-0 z-[110] flex flex-col bg-white min-h-0 h-[100dvh] overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {inner}
      </div>,
      document.body,
    )
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-slate-900/60 backdrop-blur-sm md:items-center md:justify-center md:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex flex-col flex-1 min-h-0 w-full max-w-lg mx-auto bg-white rounded-t-2xl md:rounded-2xl md:shadow-xl md:flex-none md:max-h-[85vh] overflow-hidden pt-[max(0.75rem,env(safe-area-inset-top))]">
        {inner}
      </div>
    </div>,
    document.body,
  )
}
