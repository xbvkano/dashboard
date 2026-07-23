import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  combinePhone,
  formatNationalInput,
  maxNationalDigits,
  splitPhone,
} from '../../formatPhone'

type PhoneInputProps = {
  id?: string
  value: string
  onChange: (combined: string) => void
  required?: boolean
  disabled?: boolean
  className?: string
  nationalPlaceholder?: string
}

const inputClassDefault = 'border p-2 rounded'
const codeInputClass = 'w-16 border p-2 rounded text-center'

/** Map "N digits before caret" → selection index in a formatted display string. */
function caretPosForDigitCount(display: string, digitsBefore: number): number {
  if (digitsBefore <= 0) {
    return display.startsWith('(') ? 1 : 0
  }
  let seen = 0
  for (let i = 0; i < display.length; i++) {
    if (/\d/.test(display[i]!)) {
      seen++
      if (seen === digitsBefore) return i + 1
    }
  }
  return display.length
}

export default function PhoneInput({
  id,
  value,
  onChange,
  required,
  disabled,
  className = inputClassDefault,
  nationalPlaceholder = '(702)-555-0199',
}: PhoneInputProps) {
  const [countryCode, setCountryCode] = useState(() => splitPhone(value).countryCode)
  const [national, setNational] = useState(() => splitPhone(value).national)
  const nationalRef = useRef<HTMLInputElement>(null)
  const pendingCaretDigitsRef = useRef<number | null>(null)

  useEffect(() => {
    const parts = splitPhone(value)
    const current = combinePhone(countryCode, national)
    if (value === current) return
    setCountryCode(parts.countryCode)
    setNational(parts.national)
  }, [value, countryCode, national])

  useLayoutEffect(() => {
    const digitsBefore = pendingCaretDigitsRef.current
    if (digitsBefore == null || !nationalRef.current) return
    pendingCaretDigitsRef.current = null
    const display = nationalRef.current.value
    const pos = caretPosForDigitCount(display, digitsBefore)
    nationalRef.current.setSelectionRange(pos, pos)
  }, [national, countryCode])

  const emit = (code: string, nat: string, caretDigitsBefore?: number) => {
    if (caretDigitsBefore != null) pendingCaretDigitsRef.current = caretDigitsBefore
    setCountryCode(code)
    setNational(nat)
    onChange(combinePhone(code, nat))
  }

  const handleCodeChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 3)
    const code = digits || '1'
    const maxNat = maxNationalDigits(code)
    emit(code, national.slice(0, maxNat))
  }

  const handleNationalChange = (raw: string) => {
    // Digits from the national field only — never re-parse a display country code
    const maxNat = maxNationalDigits(countryCode)
    const nextDigits = raw.replace(/\D/g, '').slice(0, maxNat)
    const caret = nationalRef.current?.selectionStart ?? nextDigits.length
    const digitsBefore = raw.slice(0, caret).replace(/\D/g, '').length
    emit(countryCode || '1', nextDigits, digitsBefore)
  }

  const handleNationalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Backspace' && e.key !== 'Delete') return
    const input = e.currentTarget
    const start = input.selectionStart ?? 0
    const end = input.selectionEnd ?? 0
    if (start !== end) return // selection: let default + onChange handle it

    const display = input.value
    const code = countryCode || '1'

    if (e.key === 'Backspace') {
      if (start === 0) return
      // If the char before the caret is punctuation, skip it and delete the prior digit
      if (/\d/.test(display[start - 1]!)) return

      e.preventDefault()
      let i = start - 1
      while (i >= 0 && !/\d/.test(display[i]!)) i--
      if (i < 0) return

      const digitIndex = display.slice(0, i + 1).replace(/\D/g, '').length - 1
      const newNat = national.slice(0, digitIndex) + national.slice(digitIndex + 1)
      emit(code, newNat, digitIndex)
      return
    }

    // Delete: skip punctuation after caret and remove the next digit
    if (start >= display.length) return
    if (/\d/.test(display[start]!)) return

    e.preventDefault()
    let i = start
    while (i < display.length && !/\d/.test(display[i]!)) i++
    if (i >= display.length) return

    const digitIndex = display.slice(0, i + 1).replace(/\D/g, '').length - 1
    const newNat = national.slice(0, digitIndex) + national.slice(digitIndex + 1)
    emit(code, newNat, digitIndex)
  }

  const codeId = id ? `${id}-country` : undefined

  return (
    <div className="flex gap-2 items-center">
      <div className="flex items-center gap-0.5 shrink-0">
        <span className="text-slate-500 text-sm select-none" aria-hidden>
          +
        </span>
        <input
          id={codeId}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-country-code"
          aria-label="Country code"
          value={countryCode}
          onChange={(e) => handleCodeChange(e.target.value)}
          disabled={disabled}
          className={codeInputClass}
        />
      </div>
      <input
        ref={nationalRef}
        id={id}
        name="number"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={formatNationalInput(countryCode, national)}
        onChange={(e) => handleNationalChange(e.target.value)}
        onKeyDown={handleNationalKeyDown}
        required={required}
        disabled={disabled}
        placeholder={nationalPlaceholder}
        className={`flex-1 min-w-0 ${className}`}
      />
    </div>
  )
}
