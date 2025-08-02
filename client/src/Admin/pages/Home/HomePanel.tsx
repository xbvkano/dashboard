import React from 'react'

export interface HomePanelCard {
  key: React.Key
  content: React.ReactNode
  actionLabel?: string
  onAction?: () => void
  done?: boolean
  onToggleDone?: (checked: boolean) => void
}

interface Props {
  title: string
  cards: HomePanelCard[]
  className?: string
}

export default function HomePanel({ title, cards, className = '' }: Props) {
  return (
    <div className={`bg-white rounded shadow flex flex-col ${className}`}>
      <div className="p-3 font-medium border-b">{title}</div>
      <div
        className="bg-gray-50 overflow-y-auto p-3"
        style={{ maxHeight: '20rem', minHeight: '20rem' }}
      >
        <ul className="space-y-3">
          {cards.map((c) => (
            <li
              key={c.key}
              className={`rounded shadow p-3 flex justify-between items-center ${c.done ? 'bg-green-100' : 'bg-white'}`}
            >
              <div className="flex items-center gap-2">
                {c.onToggleDone && (
                  <input
                    type="checkbox"
                    checked={!!c.done}
                    onChange={(e) => c.onToggleDone!(e.target.checked)}
                  />
                )}
                <div>{c.content}</div>
              </div>
              {c.onAction && (
                <button
                  className="text-blue-500 text-sm"
                  onClick={c.onAction}
                >
                  {c.actionLabel || 'View'}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
