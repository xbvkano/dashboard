import {
  labelForVariableKey,
  parseBodySegments,
  renderValueForKey,
  type MessageBankTemplateShape,
} from '../../../../shared/messageBank'

type Props = {
  template: MessageBankTemplateShape
  instanceBody: string
  values: Record<string, string>
  excludedKeys: string[]
  highlightKey?: string | null
  variant?: 'default' | 'main' | 'page'
}

export default function TemplatePlaceholderPreview({
  template,
  instanceBody,
  values,
  excludedKeys,
  highlightKey,
  variant = 'default',
}: Props) {
  const excluded = new Set(excludedKeys)
  const segments = parseBodySegments(instanceBody)
  const isMain = variant === 'main'
  const isPage = variant === 'page'

  if (segments.length === 0) return null

  const renderSegments = (textClass: string) =>
    segments.map((seg, i) => {
      if (seg.type === 'text') {
        return (
          <span key={i} className={textClass}>
            {seg.text}
          </span>
        )
      }
      const label = labelForVariableKey(seg.key, template)
      const excludedVar = excluded.has(seg.key)
      const value = renderValueForKey(seg.key, values[seg.key] ?? '')
      const highlighted = highlightKey === seg.key
      const pillText = excludedVar ? label : value || label
      return (
        <span
          key={i}
          className={`inline-flex items-center mx-0.5 px-2 py-0.5 rounded-md text-xs font-medium align-baseline ${
            excludedVar
              ? 'bg-slate-200 text-slate-400 line-through'
              : highlighted
                ? 'bg-blue-200 text-blue-900 ring-2 ring-blue-400'
                : value
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-900'
          }`}
          title={excludedVar ? `${label} (removed)` : label}
        >
          {pillText}
        </span>
      )
    })

  if (isPage) {
    return (
      <div
        className="min-h-[200px] flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[16px] leading-relaxed whitespace-pre-wrap break-words cursor-default select-none"
        aria-readonly="true"
      >
        {renderSegments('text-slate-600')}
      </div>
    )
  }

  if (isMain) {
    return (
      <div
        className="min-h-[240px] max-h-[40dvh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[16px] md:text-sm leading-relaxed whitespace-pre-wrap break-words cursor-default select-none"
        aria-readonly="true"
      >
        {renderSegments('text-slate-600')}
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs font-medium text-slate-500 mb-1.5">Where variables appear</p>
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words">
        {renderSegments('text-slate-700')}
      </div>
    </div>
  )
}
