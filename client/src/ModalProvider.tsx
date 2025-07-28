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
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => close(modal.type === 'confirm' ? false : undefined)}
          >
            <div
              className="bg-white p-4 rounded max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-4 whitespace-pre-line">{modal.message}</p>
              {modal.type === 'alert' ? (
                <div className="text-right">
                  <button
                    className="px-4 py-1 bg-blue-500 text-white rounded"
                    onClick={() => close(undefined)}
                  >
                    OK
                  </button>
                </div>
              ) : (
                <div className="flex justify-end gap-2">
                  <button className="px-4 py-1" onClick={() => close(false)}>
                    Cancel
                  </button>
                  <button
                    className="px-4 py-1 bg-blue-500 text-white rounded"
                    onClick={() => close(true)}
                  >
                    OK
                  </button>
                </div>
              )}
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
