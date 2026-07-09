import { useMemo, useState } from 'react'
import type { MessageBankGroupDto, MessageBankTemplateDto } from './messageBankApi'

type Props = {
  templates: MessageBankTemplateDto[]
  groups: MessageBankGroupDto[]
  selectedId: number | null
  loading: boolean
  selectedGroupId: number | null | 'root'
  onSelectGroup: (groupId: number | null | 'root') => void
  onManageGroups: () => void
  onSelect: (id: number) => void
  onNew: () => void
  onDelete: (id: number) => void
  onUse: (id: number) => void
}

export default function TemplateList({
  templates,
  groups,
  selectedId,
  loading,
  selectedGroupId,
  onSelectGroup,
  onManageGroups,
  onSelect,
  onNew,
  onDelete,
  onUse,
}: Props) {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase()
    const byName = qq ? templates.filter((t) => t.name.toLowerCase().includes(qq)) : templates
    if (selectedGroupId === 'root') return []
    return selectedGroupId == null
      ? byName.filter((t) => t.groupId == null)
      : byName.filter((t) => t.groupId === selectedGroupId)
  }, [templates, q, selectedGroupId])

  if (loading) {
    return (
      <div className="p-4 text-sm text-slate-500">Loading templates…</div>
    )
  }

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="p-3 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search templates…"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-[16px] md:text-sm"
          />
          <button
            type="button"
            onClick={onManageGroups}
            className="min-h-[44px] px-3 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50"
          >
            Groups
          </button>
        </div>
        <button
          type="button"
          onClick={onNew}
          className="w-full min-h-[48px] rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 active:bg-blue-800"
        >
          + New template
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {selectedGroupId === 'root' ? (
          <div className="p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">
              Message groups
            </p>
            <button
              type="button"
              onClick={() => onSelectGroup(null)}
              className="w-full min-h-[52px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50 active:bg-slate-100"
            >
              <span className="text-sm font-semibold text-slate-900">General</span>
              <span className="text-xs text-slate-500 block">
                {templates.filter((t) => t.groupId == null).length} templates
              </span>
            </button>
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => onSelectGroup(g.id)}
                className="w-full min-h-[52px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50 active:bg-slate-100"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full border border-slate-200"
                    style={{ backgroundColor: g.color }}
                  />
                  <span className="text-sm font-semibold text-slate-900">{g.name}</span>
                </div>
                <span className="text-xs text-slate-500 block">
                  {templates.filter((t) => t.groupId === g.id).length} templates
                </span>
              </button>
            ))}
            {groups.length === 0 && (
              <p className="text-sm text-slate-500 px-1">No groups yet.</p>
            )}
          </div>
        ) : (
          <>
            <div className="p-2 border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
              <button
                type="button"
                onClick={() => onSelectGroup('root')}
                className="min-h-[44px] px-3 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50"
              >
                ← All groups
              </button>
            </div>
            {filtered.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">
                No templates in this group yet. Create one to get started.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filtered.map((t) => {
                  const selected = selectedId === t.id
                  return (
                    <li key={t.id}>
                      <div
                        className={`flex items-stretch ${
                          selected ? 'bg-blue-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onSelect(t.id)}
                          className="flex-1 text-left px-4 py-3 min-h-[56px]"
                        >
                          <span className="font-medium text-slate-900 line-clamp-2">{t.name}</span>
                          <span className="text-xs text-slate-500 mt-0.5 block">
                            {t.builtinVariables.length + t.customVariables.length} variable
                            {t.builtinVariables.length + t.customVariables.length === 1 ? '' : 's'}
                          </span>
                        </button>
                        <div className="flex flex-col justify-center gap-1 pr-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => onUse(t.id)}
                            className="text-xs font-medium text-blue-600 min-h-[36px] px-2"
                          >
                            Use
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(t.id)}
                            className="text-xs text-red-600 min-h-[36px] px-2"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
