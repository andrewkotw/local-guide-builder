export const MAX_VIDEO_SIZE = 50 * 1024 * 1024

export function validateVideoFile(file: Pick<File, 'name' | 'type' | 'size'>): string | null {
  if (file.type !== 'video/mp4' && !file.name.toLowerCase().endsWith('.mp4')) return '請選擇 MP4 格式的影片'
  if (file.size > MAX_VIDEO_SIZE) return `這支影片超過 50MB。請改用較小的影片，或上傳 YouTube 後貼上分享網址。`
  return null
}
