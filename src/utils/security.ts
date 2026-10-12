export function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]!)
}

export function safeExternalUrl(value: string): string | null {
  if (!value.trim()) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch { return null }
}

/** Only accept links that Google Maps itself can create. */
export function safeGoogleMapsUrl(value: string): string | null {
  const safeUrl = safeExternalUrl(value)
  if (!safeUrl) return null

  const url = new URL(safeUrl)
  if (url.protocol !== 'https:') return null

  const host = url.hostname.toLowerCase()
  const isShortLink = host === 'maps.app.goo.gl' || (host === 'goo.gl' && url.pathname.startsWith('/maps'))
  const isGoogleDomain = host === 'google.com' || host.endsWith('.google.com') || host === 'google.com.tw' || host.endsWith('.google.com.tw')
  const isMapsPage = host.startsWith('maps.') || url.pathname === '/maps' || url.pathname.startsWith('/maps/')

  return isShortLink || (isGoogleDomain && isMapsPage) ? url.href : null
}

/** Build a no-key Google Maps iframe URL from the project's public place address. */
export function createGoogleMapsEmbedUrl(address: string): string | null {
  const query = address.trim()
  return query ? `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed` : null
}

export function parseYouTubeUrl(value: string): string | null {
  if (!value.trim()) return null
  try {
    const url = new URL(value)
    let id = ''
    const host = url.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0]
    else if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') id = url.searchParams.get('v') ?? ''
      else if (/^\/(embed|shorts)\//.test(url.pathname)) id = url.pathname.split('/')[2] ?? ''
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null
  } catch { return null }
}

export function normalizeFileName(name: string, fallback = 'file'): string {
  const lastDot = name.lastIndexOf('.')
  const rawBase = lastDot > 0 ? name.slice(0, lastDot) : name
  const rawExt = lastDot > 0 ? name.slice(lastDot + 1).toLowerCase() : ''
  const base = rawBase.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || fallback
  const ext = rawExt.replace(/[^a-z0-9]/g, '').slice(0, 8)
  return ext ? `${base}.${ext}` : base
}
