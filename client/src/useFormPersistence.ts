import { useEffect, Dispatch, SetStateAction } from 'react'

export function loadFormPersistence<T extends object>(
  key: string,
  fallback: T,
): T {
  const merged: Partial<T> = {}
  Object.keys(fallback).forEach((field) => {
    const item = localStorage.getItem(`${key}-${field}`)
    if (item !== null) {
      try {
        ;(merged as Record<string, unknown>)[field] = JSON.parse(item)
      } catch {
        ;(merged as Record<string, unknown>)[field] = item
      }
    }
  })
  const entire = localStorage.getItem(key)
  if (entire) {
    try {
      Object.assign(merged, JSON.parse(entire))
    } catch {
      // ignore parse errors
    }
  }
  return { ...fallback, ...merged }
}

export default function useFormPersistence<T extends object>(key: string, data: T) {
  useEffect(() => {
    Object.entries(data).forEach(([field, value]) => {
      localStorage.setItem(`${key}-${field}`, JSON.stringify(value))
    })
    localStorage.setItem(key, JSON.stringify(data))
  }, [key, data])
}

export function clearFormPersistence(key: string) {
  Object.keys(localStorage).forEach((k) => {
    if (k === key || k.startsWith(`${key}-`)) {
      localStorage.removeItem(k)
    }
  })
}
