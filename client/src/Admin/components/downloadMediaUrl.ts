/** Fetch a media URL as a blob and trigger a download; fall back to opening a new tab. */
export async function downloadMediaUrl(url: string, fileName: string): Promise<void> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) throw new Error('fetch failed')
    const blob = await res.blob()
    const u = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = u
    a.download = fileName || 'attachment'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(u)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
