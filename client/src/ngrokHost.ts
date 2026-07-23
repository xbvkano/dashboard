/**
 * Hostnames served through HTTPS tunnels (ngrok, Cloudflare quick tunnels, etc.).
 * Used so the client can switch to same-origin `/api` (Vite proxy) and avoid mixed content.
 */
export function isNgrokHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase()
  if (!h) return false
  return (
    /\.ngrok-free\.app$/i.test(h) ||
    /\.ngrok\.io$/i.test(h) ||
    /\.ngrok\.app$/i.test(h) ||
    /\.ngrok-free\.dev$/i.test(h) ||
    /\.ngrok\.dev$/i.test(h) ||
    /\.trycloudflare\.com$/i.test(h) ||
    /\.cfargotunnel\.com$/i.test(h)
  )
}

export function isNgrokBrowserContext(): boolean {
  if (typeof window === 'undefined') return false
  return isNgrokHostname(window.location.hostname)
}
