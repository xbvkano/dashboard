import { useEffect } from 'react'

export default function useFormPersistence<T>(
  key: string,
  data: T,
  setData: (d: T) => void,
) {
  useEffect(() => {
    const stored = localStorage.getItem(key)
    if (stored) {
      try {
        setData(JSON.parse(stored))
      } catch {
        // ignore parse errors
      }
    }
  }, [key, setData])

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(data))
  }, [key, data])
}
