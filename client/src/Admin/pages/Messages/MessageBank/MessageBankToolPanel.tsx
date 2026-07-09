import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchMessageBankGroups,
  fetchMessageBankTemplates,
  type MessageBankGroupDto,
  type MessageBankTemplateDto,
} from './messageBankApi'
import { useMessageBankDrafts } from './MessageBankDraftsContext'

type Props = {
  conversationId: number
  onSelectTemplate: (template: MessageBankTemplateDto) => void
  onBack: () => void
}

type SelectedGroupId = number | null | 'root' | 'drafts'

function snippet(text: string, max = 48): string {
  const t = text.trim().replace(/\s+/g, ' ')
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

export default function MessageBankToolPanel({
  conversationId,
  onSelectTemplate,
  onBack,
}: Props) {
  const [templates, setTemplates] = useState<MessageBankTemplateDto[]>([])
  const [groups, setGroups] = useState<MessageBankGroupDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { hasDraft, listDraftsForConversation, getDraft } = useMessageBankDrafts()
  const [selectedGroupId, setSelectedGroupId] = useState<SelectedGroupId>('root')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([fetchMessageBankTemplates(), fetchMessageBankGroups()])
      .then(([list, grp]) => {
        if (cancelled) return
        setTemplates(list)
        setGroups(grp)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const conversationDrafts = useMemo(
    () => listDraftsForConversation(conversationId),
    [listDraftsForConversation, conversationId],
  )

  const draftTemplates = useMemo(() => {
    const byId = new Map(templates.map((t) => [t.id, t]))
    return conversationDrafts
      .map((d) => {
        const t = byId.get(d.templateId)
        if (!t) return null
        return { template: t, draft: d }
      })
      .filter((x): x is { template: MessageBankTemplateDto; draft: (typeof conversationDrafts)[0] } =>
        Boolean(x),
      )
  }, [conversationDrafts, templates])

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

  const activeTemplates =
    selectedGroupId === 'root' || selectedGroupId === 'drafts'
      ? []
      : selectedGroupId === null
        ? groupedTemplates.general
        : groupedTemplates[String(selectedGroupId)] ?? []

  const headerTitle =
    selectedGroupId === 'root'
      ? 'Message Bank'
      : selectedGroupId === 'drafts'
        ? 'Drafts'
        : selectedGroupId == null
          ? 'General'
          : (groups.find((g) => g.id === selectedGroupId)?.name ?? 'Group')

  return (
    <div className="flex flex-col max-h-[40dvh] min-h-0">
      <div className="flex items-center justify-between px-2 py-1.5 shrink-0 border-b border-slate-100">
        <button
          type="button"
          onClick={() => {
            if (selectedGroupId !== 'root') setSelectedGroupId('root')
            else onBack()
          }}
          className="text-sm text-blue-600 min-h-[44px] px-2 font-medium"
        >
          ← Back
        </button>
        <span className="text-sm font-semibold text-slate-800">{headerTitle}</span>
        <Link
          to="/dashboard/messages/message-bank"
          className="text-xs text-slate-500 min-h-[44px] px-2 flex items-center"
        >
          Manage
        </Link>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        {loading && <p className="text-sm text-slate-500 text-center py-4">Loading…</p>}
        {error && <p className="text-sm text-red-600 text-center py-4">{error}</p>}
        {!loading && !error && templates.length === 0 && (
          <div className="text-center py-4 px-2">
            <p className="text-sm text-slate-500 mb-2">No templates yet.</p>
            <Link
              to="/dashboard/messages/message-bank"
              className="text-sm font-medium text-blue-600"
            >
              Create one in Message Bank
            </Link>
          </div>
        )}
        {!loading && templates.length > 0 && selectedGroupId === 'root' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {draftTemplates.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedGroupId('drafts')}
                className="min-h-[56px] rounded-xl border border-amber-200 bg-amber-50 px-2 py-2 text-left hover:bg-amber-100 active:bg-amber-100"
              >
                <span className="text-sm font-medium text-amber-900 line-clamp-2">Drafts</span>
                <span className="text-xs text-amber-700">
                  {draftTemplates.length} draft{draftTemplates.length === 1 ? '' : 's'}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedGroupId(null)}
              className="min-h-[56px] rounded-xl border border-slate-200 bg-white px-2 py-2 text-left hover:bg-slate-50 active:bg-slate-100"
            >
              <span className="text-sm font-medium text-slate-900 line-clamp-2">General</span>
              <span className="text-xs text-slate-500">
                {(groupedTemplates.general ?? []).length} templates
              </span>
            </button>
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedGroupId(g.id)}
                className="min-h-[56px] rounded-xl border border-slate-200 bg-white px-2 py-2 text-left hover:bg-slate-50 active:bg-slate-100"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-slate-200"
                    style={{ backgroundColor: g.color }}
                  />
                  <span className="text-sm font-medium text-slate-900 line-clamp-2">{g.name}</span>
                </div>
                <span className="text-xs text-slate-500">
                  {(groupedTemplates[String(g.id)] ?? []).length} templates
                </span>
              </button>
            ))}
          </div>
        )}

        {!loading && selectedGroupId === 'drafts' && (
          <div className="space-y-2">
            {draftTemplates.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No drafts in this chat.</p>
            ) : (
              draftTemplates.map(({ template: t, draft }) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTemplate(t)}
                  className="w-full min-h-[56px] rounded-xl border border-amber-200 bg-white px-3 py-2 text-left hover:bg-amber-50 active:bg-amber-100"
                >
                  <span className="text-sm font-medium text-slate-900 line-clamp-1">{t.name}</span>
                  <span className="text-xs text-slate-500 block line-clamp-2 mt-0.5">
                    {snippet(getDraft(conversationId, t.id)?.body ?? draft.body)}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {!loading &&
          templates.length > 0 &&
          selectedGroupId !== 'root' &&
          selectedGroupId !== 'drafts' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {activeTemplates.map((t) => {
              const draft = hasDraft(conversationId, t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTemplate(t)}
                  className="relative min-h-[56px] rounded-xl border border-slate-200 bg-white px-2 py-2 text-left hover:bg-slate-50 active:bg-slate-100 active:scale-[0.98] transition-transform"
                >
                  {draft && (
                    <span
                      className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500"
                      title="Draft saved"
                    />
                  )}
                  <span className="text-sm font-medium text-slate-900 line-clamp-2">{t.name}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
