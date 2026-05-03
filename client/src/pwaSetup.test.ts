import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const srcDir = dirname(fileURLToPath(import.meta.url))
const clientRoot = join(srcDir, '..')

function readText(path: string): string {
  return readFileSync(path, 'utf8')
}

/** Map root-relative URL (e.g. `/icons/x.png`) to `client/public` path on disk. */
function publicFileFromWebPath(webPath: string): string {
  if (!webPath.startsWith('/')) {
    throw new Error(`Expected root-relative path, got: ${webPath}`)
  }
  return join(clientRoot, 'public', webPath.replace(/^\//, ''))
}

describe('PWA manifest', () => {
  const manifestPath = join(clientRoot, 'public', 'manifest.webmanifest')

  it('parses as JSON and includes required install fields', () => {
    const raw = readText(manifestPath)
    const m = JSON.parse(raw) as Record<string, unknown>

    expect(typeof m.name).toBe('string')
    expect((m.name as string).length).toBeGreaterThan(0)
    expect(typeof m.short_name).toBe('string')
    expect((m.short_name as string).length).toBeGreaterThan(0)
    expect(m.start_url).toBe('/')
    expect(m.scope).toBe('/')
    expect(m.display).toBe('standalone')
    expect(typeof m.background_color).toBe('string')
    expect(typeof m.theme_color).toBe('string')
    expect(Array.isArray(m.icons)).toBe(true)
  })

  it('declares 192 and 512 PNG icons pointing at existing files', () => {
    const m = JSON.parse(readText(manifestPath)) as {
      icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>
    }

    const sizes = m.icons.map((i) => i.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')

    for (const icon of m.icons) {
      expect(icon.type).toBe('image/png')
      expect(icon.src).toMatch(/^\/icons\//)
      const abs = publicFileFromWebPath(icon.src)
      expect(existsSync(abs), `missing icon file: ${abs}`).toBe(true)
    }
  })
})

describe('PWA HTML (index.html)', () => {
  const indexPath = join(clientRoot, 'index.html')
  const manifestPath = join(clientRoot, 'public', 'manifest.webmanifest')

  it('links manifest and iOS touch icon with expected hrefs', () => {
    const html = readText(indexPath)
    expect(html).toContain('href="/manifest.webmanifest"')
    expect(html).toContain('rel="apple-touch-icon"')
    expect(html).toContain('href="/icons/pwa_icon_180.png"')
    expect(html).toContain('sizes="180x180"')
  })

  it('includes standalone / install meta tags', () => {
    const html = readText(indexPath)
    expect(html).toContain('name="apple-mobile-web-app-capable"')
    expect(html).toContain('content="yes"')
    expect(html).toContain('name="mobile-web-app-capable"')
    expect(html).toMatch(/name="theme-color"\s+content="[^"]+"/)
  })

  it('matches manifest theme_color so Safari and manifest stay in sync', () => {
    const html = readText(indexPath)
    const m = JSON.parse(readText(manifestPath)) as { theme_color: string }
    expect(html).toContain(`content="${m.theme_color}"`)
  })

  it('references an existing public touch icon asset', () => {
    const touch = publicFileFromWebPath('/icons/pwa_icon_180.png')
    expect(existsSync(touch)).toBe(true)
  })
})
