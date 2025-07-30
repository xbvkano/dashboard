import React from 'react'

export interface HomePanelCard {
  key: React.Key
  content: React.ReactNode
  actionLabel?: string
  onAction?: () => void
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
        className="bg-gray-50 overflow-y-auto"
        style={{ maxHeight: '20rem', minHeight: '20rem' }}
      >
        <ul className="divide-y">
          {cards.map((c) => (
            <li key={c.key} className="p-3 flex justify-between items-center">
              <div>{c.content}</div>
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
