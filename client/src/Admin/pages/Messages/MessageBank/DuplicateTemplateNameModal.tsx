type Props = {
  open: boolean
  attemptedName: string
  suggestedName: string
  onUseSuggested: () => void
  onChangeName: () => void
}

export default function DuplicateTemplateNameModal({
  open,
  attemptedName,
  suggestedName,
  onUseSuggested,
  onChangeName,
}: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center sm:p-4 bg-black/40">
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-2xl shadow-xl border border-slate-200 p-4 sm:p-5"
        role="dialog"
        aria-labelledby="duplicate-template-name-title"
      >
        <h2 id="duplicate-template-name-title" className="text-lg font-semibold text-slate-900">
          Name already in use
        </h2>
        <p className="text-sm text-slate-600 mt-2">
          A template named <span className="font-semibold text-slate-900">{attemptedName}</span>{' '}
          already exists in this group.
        </p>
        <p className="text-sm text-slate-600 mt-2">
          Suggested name:{' '}
          <span className="font-semibold text-slate-900">{suggestedName}</span>
        </p>

        <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={onChangeName}
            className="min-h-[44px] px-4 rounded-xl text-slate-700 hover:bg-slate-100"
          >
            Change name
          </button>
          <button
            type="button"
            onClick={onUseSuggested}
            className="min-h-[44px] px-4 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
          >
            Use suggested name
          </button>
        </div>
      </div>
    </div>
  )
}
