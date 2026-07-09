import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const MESSAGING_MESSAGE_BANK_DRAFTS_KEY = 'messagingMessageBankDrafts'

export type MessageBankDraft = {
  templateId: number
  body: string
  /** Tokenized body for this message instance ({{Name}}, etc.). */
  instanceBody?: string
  variableValues: Record<string, string>
  excludedVariableKeys: string[]
  updatedAt: string
}

type DraftStore = Record<string, MessageBankDraft>

function draftKey(conversationId: number, templateId: number): string {
  return `${conversationId}:${templateId}`
}

function readInitialDrafts(): DraftStore {
  try {
    const raw = localStorage.getItem(MESSAGING_MESSAGE_BANK_DRAFTS_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as DraftStore
  } catch {
    return {}
  }
}

function persistDrafts(store: DraftStore): void {
  try {
    localStorage.setItem(MESSAGING_MESSAGE_BANK_DRAFTS_KEY, JSON.stringify(store))
  } catch {
    /* ignore */
  }
}

type Ctx = {
  getDraft: (conversationId: number, templateId: number) => MessageBankDraft | null
  hasDraft: (conversationId: number, templateId: number) => boolean
  listDraftsForConversation: (conversationId: number) => MessageBankDraft[]
  setDraft: (conversationId: number, draft: MessageBankDraft) => void
  clearDraft: (conversationId: number, templateId: number) => void
}

const MessageBankDraftsContext = createContext<Ctx | null>(null)

export function MessageBankDraftsProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<DraftStore>(readInitialDrafts)

  useEffect(() => {
    persistDrafts(drafts)
  }, [drafts])

  const getDraft = useCallback(
    (conversationId: number, templateId: number) => {
      return drafts[draftKey(conversationId, templateId)] ?? null
    },
    [drafts],
  )

  const hasDraft = useCallback(
    (conversationId: number, templateId: number) => {
      return Boolean(drafts[draftKey(conversationId, templateId)])
    },
    [drafts],
  )

  const listDraftsForConversation = useCallback(
    (conversationId: number) => {
      const prefix = `${conversationId}:`
      return Object.entries(drafts)
        .filter(([key]) => key.startsWith(prefix))
        .map(([, draft]) => draft)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },
    [drafts],
  )

  const setDraft = useCallback((conversationId: number, draft: MessageBankDraft) => {
    setDrafts((prev) => ({
      ...prev,
      [draftKey(conversationId, draft.templateId)]: {
        ...draft,
        updatedAt: new Date().toISOString(),
      },
    }))
  }, [])

  const clearDraft = useCallback((conversationId: number, templateId: number) => {
    setDrafts((prev) => {
      const next = { ...prev }
      delete next[draftKey(conversationId, templateId)]
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ getDraft, hasDraft, listDraftsForConversation, setDraft, clearDraft }),
    [getDraft, hasDraft, listDraftsForConversation, setDraft, clearDraft],
  )

  return (
    <MessageBankDraftsContext.Provider value={value}>{children}</MessageBankDraftsContext.Provider>
  )
}

export function useMessageBankDrafts(): Ctx {
  const ctx = useContext(MessageBankDraftsContext)
  if (!ctx) throw new Error('useMessageBankDrafts must be used within MessageBankDraftsProvider')
  return ctx
}
