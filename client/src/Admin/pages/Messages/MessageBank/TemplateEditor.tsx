import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BUILTIN_VARIABLE_META,
  isDuplicateTemplateNameInGroup,
  parseVariablesFromBody,
  renderMessageBankTemplate,
  suggestUniqueTemplateName,
  syncTemplateVariablesFromBody,
  type CustomVariableDef,
} from '../../../../shared/messageBank'
import CustomVariablesEditor from './CustomVariablesEditor'
import DuplicateTemplateNameModal from './DuplicateTemplateNameModal'
import {
  createMessageBankTemplate,
  formatApiError,
  updateMessageBankTemplate,
  type MessageBankTemplateDto,
  type MessageBankGroupDto,
} from './messageBankApi'

type Props = {
  template: MessageBankTemplateDto | null
  isNew: boolean
  templates: MessageBankTemplateDto[]
  groups: MessageBankGroupDto[]
  onSaved: (t: MessageBankTemplateDto) => void
  onDeleted: () => void
  onBack?: () => void
}

export default function TemplateEditor({
  template,
  isNew,
  templates,
  groups,
  onSaved,
  onDeleted,
  onBack,
}: Props) {
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [customVariables, setCustomVariables] = useState<CustomVariableDef[]>([])
  const [groupId, setGroupId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicateModal, setDuplicateModal] = useState<{
    attemptedName: string
    suggestedName: string
  } | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (template) {
      setName(template.name)
      setBody(template.body)
      setCustomVariables(template.customVariables ?? [])
      setGroupId(template.groupId ?? null)
    } else if (isNew) {
      setName('')
      setBody('')
      setCustomVariables([])
      setGroupId(null)
    }
    setError(null)
  }, [template, isNew])

  const insertAtCursor = useCallback((token: string) => {
    const el = bodyRef.current
    if (!el) {
      setBody((prev) => prev + token)
      return
    }
    const start = el.selectionStart ?? body.length
    const end = el.selectionEnd ?? body.length
    setBody((prev) => prev.slice(0, start) + token + prev.slice(end))
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + token.length
      el.setSelectionRange(pos, pos)
    })
  }, [body.length])

  const parsed = parseVariablesFromBody(body)
  const preview = renderMessageBankTemplate(body, {}, [])

  async function persistTemplate(saveName: string) {
    setSaving(true)
    setError(null)
    try {
      const synced = syncTemplateVariablesFromBody(body, customVariables)
      const payload = {
        name: saveName.trim(),
        body: body.trim(),
        builtinVariables: synced.builtinVariables,
        customVariables: synced.customVariables,
        groupId,
      }
      const saved = template && !isNew
        ? await updateMessageBankTemplate(template.id, payload)
        : await createMessageBankTemplate(payload)
      setDuplicateModal(null)
      onSaved(saved)
    } catch (e) {
      const msg = formatApiError(e)
      try {
        const parsed = JSON.parse((e as Error).message) as {
          error?: string
          suggestedName?: string
        }
        if (parsed.suggestedName) {
          setDuplicateModal({
            attemptedName: saveName.trim(),
            suggestedName: parsed.suggestedName,
          })
          return
        }
      } catch {
        /* ignore */
      }
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    if (!name.trim() || !body.trim()) {
      setError('Name and body are required')
      return
    }
    const trimmedName = name.trim()
    const excludeId = template && !isNew ? template.id : undefined
    if (isDuplicateTemplateNameInGroup(trimmedName, groupId, templates, excludeId)) {
      setDuplicateModal({
        attemptedName: trimmedName,
        suggestedName: suggestUniqueTemplateName(trimmedName, groupId, templates, excludeId),
      })
      return
    }
    await persistTemplate(trimmedName)
  }

  if (!template && !isNew) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-slate-500 text-sm">
        Select a template or create a new one.
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-200 shrink-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="md:hidden min-h-[44px] min-w-[44px] text-slate-600"
            aria-label="Back"
          >
            ←
          </button>
        )}
        <h2 className="flex-1 font-semibold text-slate-900 truncate">
          {isNew ? 'New template' : 'Edit template'}
        </h2>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="min-h-[44px] px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Template name</label>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[16px] md:text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Group</label>
          <select
            value={groupId ?? ''}
            onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[16px] md:text-sm"
          >
            <option value="">General</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Message body</label>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {Object.values(BUILTIN_VARIABLE_META).map((m) => (
              <button
                key={m.token}
                type="button"
                onClick={() => insertAtCursor(m.token)}
                className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 min-h-[36px]"
              >
                + {m.label}
              </button>
            ))}
          </div>
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className="w-full rounded-xl border border-slate-300 px-3 py-3 text-[16px] md:text-sm leading-relaxed max-h-[40dvh] resize-y"
            spellCheck
          />
          {parsed.customKeys.length > 0 && (
            <p className="text-xs text-slate-500 mt-1">
              Tokens in body: {parsed.builtinKeys.length} built-in, {parsed.customKeys.length} custom
            </p>
          )}
        </div>

        <CustomVariablesEditor
          customVariables={customVariables}
          onChange={setCustomVariables}
          onInsertToken={insertAtCursor}
        />

        <div>
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Preview (empty values)</h3>
          <pre className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg p-3 border border-slate-100">
            {preview || '—'}
          </pre>
        </div>
      </div>

      <DuplicateTemplateNameModal
        open={duplicateModal != null}
        attemptedName={duplicateModal?.attemptedName ?? ''}
        suggestedName={duplicateModal?.suggestedName ?? ''}
        onUseSuggested={() => {
          if (!duplicateModal) return
          setName(duplicateModal.suggestedName)
          void persistTemplate(duplicateModal.suggestedName)
        }}
        onChangeName={() => {
          setDuplicateModal(null)
          requestAnimationFrame(() => nameRef.current?.focus())
        }}
      />
    </div>
  )
}
