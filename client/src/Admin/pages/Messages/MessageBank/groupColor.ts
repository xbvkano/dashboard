export function normalizeHexColor(color: string): string {
  const c = color.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(c)) {
    const [, r, g, b] = c.match(/^#(.)(.)(.)$/) ?? []
    if (r && g && b) return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return '#ffffff'
}
