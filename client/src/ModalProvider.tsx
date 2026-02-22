import { createContext, useContext, useState, ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalContextProps {
  alert: (message: string) => Promise<void>
  confirm: (message: string) => Promise<boolean>
}

interface ModalState {
  type: 'alert' | 'confirm'
  message: string
  resolve: (value: any) => void
}

const ModalContext = createContext<ModalContextProps | null>(null)

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState | null>(null)

  const alert = (message: string) =>
    new Promise<void>((resolve) => setModal({ type: 'alert', message, resolve }))

  const confirm = (message: string) =>
    new Promise<boolean>((resolve) => setModal({ type: 'confirm', message, resolve }))

  const close = (result: any) => {
    modal?.resolve(result)
    setModal(null)
  }

  return (
    <ModalContext.Provider value={{ alert, confirm }}>
      {children}
      {modal &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[10010]"
            onClick={() => close(modal.type === 'confirm' ? false : undefined)}
          >
            <div
              className="bg-white rounded-xl shadow-lg border-2 border-slate-200 max-w-sm w-full overflow-hidden max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 shrink-0">
                <h3 className="text-lg font-semibold text-slate-800">
                  {modal.type === 'alert' ? 'Notice' : 'Confirm'}
                </h3>
              </div>
              <div className="p-4 overflow-y-auto min-h-0 flex-1">
                <p className="text-sm text-slate-600 whitespace-pre-line mb-4">{modal.message}</p>
                {modal.type === 'alert' ? (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                      onClick={() => close(undefined)}
                    >
                      OK
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition-colors"
                      onClick={() => close(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                      onClick={() => close(true)}
                    >
                      OK
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </ModalContext.Provider>
  )
}

export function useModal() {
  const ctx = useContext(ModalContext)
  if (!ctx) throw new Error('useModal must be inside ModalProvider')
  return ctx
}
