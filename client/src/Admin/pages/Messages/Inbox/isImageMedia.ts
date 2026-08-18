/** True when MMS/media should open in the photo viewer (not audio, video, or other files). */
export function isImageMedia(m: { mimeType?: string | null; fileName?: string | null }): boolean {
  const mime = (m.mimeType ?? '').toLowerCase().split(';')[0].trim()
  if (mime.startsWith('image/')) return true
  if (mime.startsWith('audio/') || mime.startsWith('video/')) return false
  if (mime && mime !== 'application/octet-stream') return false
  return Boolean(m.fileName && /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(m.fileName))
}

export function isAudioMedia(m: { mimeType?: string | null; fileName?: string | null }): boolean {
  const mime = (m.mimeType ?? '').toLowerCase().split(';')[0].trim()
  if (mime.startsWith('audio/')) return true
  if (mime.startsWith('image/') || mime.startsWith('video/')) return false
  return Boolean(m.fileName && /\.(mp3|m4a|aac|amr|ogg|wav|opus|caf)$/i.test(m.fileName))
}
