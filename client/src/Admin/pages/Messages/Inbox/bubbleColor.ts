const DEFAULT_OUTBOUND_BG = '#3b82f6' // tailwind blue-500

/** Relative luminance 0–1; used to pick readable text color */
export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex)
  if (!rgb) return 0.2
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const x = c / 255
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function outboundBubbleStyle(senderBubbleColor: string | null | undefined): {
  backgroundColor: string
  color: string
  timeClass: string
} {
  const bg = senderBubbleColor && /^#[0-9A-Fa-f]{6}$/.test(senderBubbleColor) ? senderBubbleColor : DEFAULT_OUTBOUND_BG
  const lum = relativeLuminance(bg)
  const darkText = lum > 0.55
  return {
    backgroundColor: bg,
    color: darkText ? '#0f172a' : '#ffffff',
    timeClass: darkText ? 'text-slate-600' : 'text-white/80',
  }
}
