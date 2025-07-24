import { useEffect } from 'react'

export default function useFormPersistence<T>(
  key: string,
  data: T,
  setData: (d: T) => void,
) {
  useEffect(() => {
    const stored = sessionStorage.getItem(key)
    if (stored) {
      try {
        setData(JSON.parse(stored))
      } catch {
        // ignore
      }
      sessionStorage.removeItem(key)
    }
  }, [key, setData])

  useEffect(() => {
    const handler = () => {
      sessionStorage.setItem(key, JSON.stringify(data))
    }
    window.addEventListener('pagehide', handler)
    return () => {
      window.removeEventListener('pagehide', handler)
    }
  }, [key, data])
}
