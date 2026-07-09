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
import type { MessageBankGroupDto, MessageBankTemplateDto } from './messageBankApi'
import ResetTemplateConfirmModal from './ResetTemplateConfirmModal'
import TemplatePlaceholderPreview from './TemplatePlaceholderPreview'
import VariableFieldList from './VariableFieldList'

type Props = {
  templates: MessageBankTemplateDto[]
  groups: MessageBankGroupDto[]
  initialTemplateId?: number | null
  onBack?: () => void
}

type SelectedGroupId = number | null | 'root'

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

export default function UseTemplatePanel({
  templates,
  groups,
  initialTemplateId,
  onBack,
}: Props) {
  const [selectedGroupId, setSelectedGroupId] = useState<SelectedGroupId>('root')
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

  const groupedTemplates = useMemo(() => {
    const byGroup: Record<string, MessageBankTemplateDto[]> = { general: [] }
    for (const g of groups) byGroup[String(g.id)] = []
    for (const t of templates) {
      if (t.groupId == null) byGroup.general.push(t)
      else {
        const k = String(t.groupId)
        if (!byGroup[k]) byGroup[k] = []
        byGroup[k].push(t)
      }
    }
    for (const k of Object.keys(byGroup)) {
      byGroup[k].sort((a, b) => a.name.localeCompare(b.name))
    }
    return byGroup
  }, [templates, groups])

  const groupTemplates =
    selectedGroupId === 'root'
      ? []
      : selectedGroupId === null
        ? groupedTemplates.general
        : groupedTemplates[String(selectedGroupId)] ?? []

  const headerTitle = template
    ? template.name
    : selectedGroupId === 'root'
      ? 'Use template'
      : selectedGroupId === null
        ? 'General'
        : (groups.find((g) => g.id === selectedGroupId)?.name ?? 'Group')

  useEffect(() => {
    if (initialTemplateId == null) return
    const t = templates.find((x) => x.id === initialTemplateId)
    setTemplateId(initialTemplateId)
    if (t) setSelectedGroupId(t.groupId ?? null)
  }, [initialTemplateId, templates])

  const renderedBody = useMemo(
    () =>
      template
        ? renderMessageBankTemplate(instanceBody, values, excludedKeys)
        : '',
    [template, instanceBody, values, excludedKeys],
  )

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

  const showPickerBack = template != null || selectedGroupId !== 'root'
  const showExitBack = onBack != null && selectedGroupId === 'root' && template == null

  function handleHeaderBack() {
    if (template != null) {
      setTemplateId(null)
      setEditMode(false)
      setEditDraft('')
      return
    }
    if (selectedGroupId !== 'root') {
      setSelectedGroupId('root')
      return
    }
    onBack?.()
  }

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-200 shrink-0">
        {(showPickerBack || showExitBack) && (
          <button
            type="button"
            onClick={handleHeaderBack}
            className="min-h-[44px] min-w-[44px] text-slate-600"
            aria-label="Back"
          >
            ←
          </button>
        )}
        <h2 className="flex-1 font-semibold text-slate-900 truncate">{headerTitle}</h2>
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
        {!template && selectedGroupId === 'root' && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">
              Choose a group
            </p>
            {templates.length === 0 ? (
              <p className="text-sm text-slate-500">No templates yet.</p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedGroupId(null)}
                  className="w-full min-h-[52px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50 active:bg-slate-100"
                >
                  <span className="text-sm font-semibold text-slate-900">General</span>
                  <span className="text-xs text-slate-500 block">
                    {groupedTemplates.general.length} template
                    {groupedTemplates.general.length === 1 ? '' : 's'}
                  </span>
                </button>
                {groups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedGroupId(g.id)}
                    className="w-full min-h-[52px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50 active:bg-slate-100"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full border border-slate-200 shrink-0"
                        style={{ backgroundColor: g.color }}
                      />
                      <span className="text-sm font-semibold text-slate-900">{g.name}</span>
                    </div>
                    <span className="text-xs text-slate-500 block pl-5">
                      {(groupedTemplates[String(g.id)] ?? []).length} template
                      {(groupedTemplates[String(g.id)] ?? []).length === 1 ? '' : 's'}
                    </span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}

        {!template && selectedGroupId !== 'root' && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">
              Choose a template
            </p>
            {groupTemplates.length === 0 ? (
              <p className="text-sm text-slate-500">No templates in this group yet.</p>
            ) : (
              groupTemplates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplateId(t.id)}
                  className="w-full min-h-[52px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left hover:bg-slate-50 active:bg-slate-100"
                >
                  <span className="text-sm font-semibold text-slate-900">{t.name}</span>
                </button>
              ))
            )}
          </div>
        )}

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

      {template && (
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
      )}

      <ResetTemplateConfirmModal
        open={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={performReset}
      />
    </div>
  )
}
