import type { PhotoAsset } from '../types'

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_IMAGE_SIZE = 15 * 1024 * 1024
export const MAX_IMAGE_PIXELS = 50_000_000

export async function processPhoto(file: File): Promise<PhotoAsset> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) throw new Error('請選擇 JPG、PNG 或 WebP 圖片')
  if (file.size > MAX_IMAGE_SIZE) throw new Error('這張照片超過 15MB，請先選擇較小的照片')
  let bitmap: ImageBitmap | null = null
  let canvas: HTMLCanvasElement | null = null
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    if (bitmap.width * bitmap.height > MAX_IMAGE_PIXELS) throw new Error('image-too-large')
    const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * ratio)); const height = Math.max(1, Math.round(bitmap.height * ratio))
    canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('canvas')
    // JPEG 不支援透明；先鋪白底，避免透明 PNG 在部分瀏覽器變成黑底。
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)
    const outputCanvas = canvas
    const blob = await new Promise<Blob>((resolve, reject) => outputCanvas.toBlob((result) => result ? resolve(result) : reject(new Error('encode')), 'image/jpeg', 0.82))
    return { id: crypto.randomUUID(), originalFileName: file.name, fileName: `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`, blob, originalSize: file.size, processedSize: blob.size, captionZh: '', captionEn: '', alt: '' }
  } catch (reason) {
    if (reason instanceof Error && reason.message === 'image-too-large') throw new Error('這張照片的長寬尺寸太大。請先在手機相簿縮小照片，再重新選擇。')
    throw new Error('這張照片讀不到。請先在手機相簿或「小畫家」打開，再另存成 JPG 後重新選擇。')
  } finally {
    bitmap?.close()
    if (canvas) { canvas.width = 1; canvas.height = 1 }
  }
}

export function movePhoto<T>(photos: T[], from: number, to: number): T[] {
  if (from < 0 || from >= photos.length || to < 0 || to >= photos.length || from === to) return [...photos]
  const copy = [...photos]; const [item] = copy.splice(from, 1); copy.splice(to, 0, item); return copy
}
