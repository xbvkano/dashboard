/** Hostnames served through ngrok tunnels (dev on phone, etc.). */
export function isNgrokHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase()
  if (!h) return false
  return (
    /\.ngrok-free\.app$/i.test(h) ||
    /\.ngrok\.io$/i.test(h) ||
    /\.ngrok\.app$/i.test(h) ||
    /\.ngrok-free\.dev$/i.test(h) ||
    /\.ngrok\.dev$/i.test(h)
  )
}

export function isNgrokBrowserContext(): boolean {
  if (typeof window === 'undefined') return false
  return isNgrokHostname(window.location.hostname)
}
