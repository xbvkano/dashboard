import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMediaQuery } from '../Inbox/useMediaQuery'
import TemplateList from './TemplateList'
import TemplateEditor from './TemplateEditor'
import UseTemplatePanel from './UseTemplatePanel'
import EditGroupModal from './EditGroupModal'
import CreateGroupModal from './CreateGroupModal'
import {
  deleteMessageBankTemplate,
  deleteMessageBankGroup,
  fetchMessageBankGroups,
  fetchMessageBankTemplates,
  formatApiError,
  type MessageBankGroupDto,
  type MessageBankTemplateDto,
} from './messageBankApi'

type MobileView = 'list' | 'editor' | 'use'
type GroupsModalMode = 'closed' | 'open'
type SelectedGroupId = number | null | 'root'

export default function MessageBank() {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [templates, setTemplates] = useState<MessageBankTemplateDto[]>([])
  const [groups, setGroups] = useState<MessageBankGroupDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [mobileView, setMobileView] = useState<MobileView>('list')
  const [useTemplateId, setUseTemplateId] = useState<number | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<SelectedGroupId>('root')
  const [groupsModal, setGroupsModal] = useState<GroupsModalMode>('closed')
  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<MessageBankGroupDto | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, grp] = await Promise.all([fetchMessageBankTemplates(), fetchMessageBankGroups()])
      setTemplates(list)
      setGroups(grp)
    } catch (e) {
      setError(formatApiError(e))
      setTemplates([])
      setGroups([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selected = templates.find((t) => t.id === selectedId) ?? null

  function handleSelect(id: number) {
    setSelectedId(id)
    setIsNew(false)
    if (!isDesktop) setMobileView('editor')
  }

  function handleNew() {
    setSelectedId(null)
    setIsNew(true)
    if (!isDesktop) setMobileView('editor')
  }

  function handleSaved(t: MessageBankTemplateDto) {
    setTemplates((prev) => {
      const idx = prev.findIndex((x) => x.id === t.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = t
        return next
      }
      return [...prev, t].sort((a, b) => a.name.localeCompare(b.name))
    })
    setSelectedId(t.id)
    setIsNew(false)
    if (!isDesktop) setMobileView('editor')
  }

  async function handleDelete(id: number) {
    try {
      await deleteMessageBankTemplate(id)
      setTemplates((prev) => prev.filter((t) => t.id !== id))
      if (selectedId === id) {
        setSelectedId(null)
        setIsNew(false)
        if (!isDesktop) setMobileView('list')
      }
    } catch (e) {
      window.alert(formatApiError(e))
      throw e
    }
  }

  function handleOpenUse() {
    setUseTemplateId(null)
    if (!isDesktop) setMobileView('use')
  }

  const showList = isDesktop || mobileView === 'list'
  const showEditor = isDesktop || mobileView === 'editor'
  const showUse = !isDesktop && mobileView === 'use'

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden h-[calc(100dvh-3.5rem)] max-h-[calc(100dvh-3.5rem)]">
      {(isDesktop || mobileView === 'list') && (
        <div className="shrink-0 px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between gap-2">
          <div>
            <Link
              to="/dashboard/messages"
              className="text-sm text-blue-600 hover:underline"
            >
              ← Messages
            </Link>
            <h1 className="text-xl font-semibold text-slate-900 mt-1">Message Bank</h1>
          </div>
        </div>
      )}

      {error && (
        <p className="shrink-0 px-4 py-2 text-sm text-red-600 bg-red-50">{error}</p>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden md:px-2 md:py-2 md:gap-2">
        {showList && (
          <div
            className={`flex min-h-0 flex-col overflow-hidden bg-white border border-slate-200 ${
              isDesktop ? 'w-80 shrink-0 rounded-xl shadow-sm' : 'flex-1 w-full'
            } ${!isDesktop && mobileView !== 'list' ? 'hidden' : ''}`}
          >
            <TemplateList
              templates={templates}
              groups={groups}
              selectedId={selectedId}
              loading={loading}
              selectedGroupId={selectedGroupId}
              onSelectGroup={setSelectedGroupId}
              onManageGroups={() => setGroupsModal('open')}
              onSelect={handleSelect}
              onNew={handleNew}
              onDelete={(id) => void handleDelete(id)}
              onOpenUse={handleOpenUse}
            />
          </div>
        )}

        {showEditor && (
          <div
            className={`flex min-h-0 flex-col overflow-hidden bg-white border border-slate-200 ${
              isDesktop ? 'flex-1 rounded-xl shadow-sm' : 'flex-1 w-full'
            } ${!isDesktop && mobileView !== 'editor' ? 'hidden' : ''}`}
          >
            <TemplateEditor
              template={selected}
              isNew={isNew}
              templates={templates}
              groups={groups}
              onSaved={handleSaved}
              onDeleted={() => {
                setSelectedId(null)
                setIsNew(false)
              }}
              onBack={!isDesktop ? () => setMobileView('list') : undefined}
            />
          </div>
        )}

        {isDesktop && (
          <div className="flex min-h-0 w-96 shrink-0 flex-col overflow-hidden bg-white border border-slate-200 rounded-xl shadow-sm">
            <UseTemplatePanel templates={templates} groups={groups} initialTemplateId={useTemplateId} />
          </div>
        )}

        {showUse && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
            <UseTemplatePanel
              templates={templates}
              groups={groups}
              initialTemplateId={useTemplateId}
              onBack={() => setMobileView('list')}
            />
          </div>
        )}
      </div>

      <CreateGroupModal
        open={createGroupOpen}
        onClose={() => setCreateGroupOpen(false)}
        onCreated={(created) => {
          setGroups((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
        }}
      />

      <EditGroupModal
        group={editingGroup}
        onClose={() => setEditingGroup(null)}
        onSaved={(updated) => {
          setGroups((prev) =>
            prev.map((x) => (x.id === updated.id ? updated : x)).sort((a, b) => a.name.localeCompare(b.name)),
          )
        }}
      />

      {groupsModal === 'open' && (
        <div className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Groups</h2>
              <button
                type="button"
                onClick={() => setGroupsModal('closed')}
                className="min-h-[44px] min-w-[44px] rounded-lg text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[70dvh] overflow-y-auto">
              <button
                type="button"
                onClick={() => setCreateGroupOpen(true)}
                className="w-full min-h-[48px] rounded-xl bg-blue-600 text-white font-semibold"
              >
                + New group
              </button>

              <div className="space-y-2">
                {groups.map((g) => (
                  <div key={g.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
                    <span className="w-4 h-4 rounded-full border border-slate-200" style={{ backgroundColor: g.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{g.name}</p>
                      <p className="text-xs text-slate-500">{g.color}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingGroup(g)}
                      className="min-h-[44px] px-3 rounded-lg border border-slate-200 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm(`Delete group \"${g.name}\"? Templates will move to General.`)) return
                        try {
                          await deleteMessageBankGroup(g.id)
                          setGroups((prev) => prev.filter((x) => x.id !== g.id))
                          // Optimistically move templates to General
                          setTemplates((prev) => prev.map((t) => (t.groupId === g.id ? { ...t, groupId: null } : t)))
                          if (selectedGroupId === g.id) setSelectedGroupId('root')
                        } catch (e) {
                          window.alert(formatApiError(e))
                        }
                      }}
                      className="min-h-[44px] px-3 rounded-lg text-sm text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                ))}
                {groups.length === 0 && <p className="text-sm text-slate-500">No groups yet.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
