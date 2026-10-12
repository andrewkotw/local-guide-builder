import type { ProjectData, ProjectJson, PhotoAsset, VideoAsset } from '../types'
import { validateCustomCss } from './customCss'

const PLACE_TYPES = ['景點', '美食', '廟宇', '歷史文化', '其他']
const THEMES = ['nature', 'history', 'modern']
const VIDEO_MODES = ['youtube', 'local']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value)
}

/** 在讀取任何素材前檢查外來 JSON，避免畸形備份在畫面操作時造成例外。 */
export function assertValidProjectJson(value: unknown): asserts value is ProjectJson {
  if (!isRecord(value) || value.version !== 1) throw new Error('這份作品備份的格式不正確或版本不支援')
  const stringFields = [
    'updatedAt', 'titleZh', 'titleEn', 'taglineZh', 'taglineEn', 'address', 'hours', 'fee', 'groupName',
    'introZh', 'introEn', 'recommendation', 'notice', 'mapsUrl', 'transportZh', 'transportEn', 'youtubeUrl', 'coverId',
  ]
  if (stringFields.some((field) => typeof value[field] !== 'string')) throw new Error('這份作品備份缺少必要的文字欄位，請重新下載備份')
  for (const field of ['recommendationEn', 'noticeEn']) {
    if (value[field] !== undefined && typeof value[field] !== 'string') throw new Error('這份作品備份的英文推薦原因或參觀提醒格式不正確，請重新下載備份')
  }
  if (typeof value.type !== 'string' || !PLACE_TYPES.includes(value.type)) throw new Error('這份作品備份的景點類型不正確')
  if (typeof value.theme !== 'string' || !THEMES.includes(value.theme)) throw new Error('這份作品備份的視覺主題不正確')
  if (typeof value.videoMode !== 'string' || !VIDEO_MODES.includes(value.videoMode)) throw new Error('這份作品備份的影片設定不正確')
  if (value.customCss !== undefined && typeof value.customCss !== 'string') throw new Error('這份作品備份的自訂外觀格式不正確')
  if (value.customCssFileName !== undefined && typeof value.customCssFileName !== 'string') throw new Error('這份作品備份的自訂外觀檔名不正確')
  if (value.customCssMode !== undefined && value.customCssMode !== 'override' && value.customCssMode !== 'replace') throw new Error('這份作品備份的自訂外觀模式不正確')
  if (typeof value.customCss === 'string') {
    const cssError = validateCustomCss(value.customCss)
    if (cssError && value.customCss.trim()) throw new Error(`這份作品備份的自訂外觀無法使用：${cssError}`)
  }

  if (!Array.isArray(value.highlights) || value.highlights.length > 3 || value.highlights.some((item) => !isRecord(item) || !validId(item.id) || typeof item.textZh !== 'string' || typeof item.textEn !== 'string')) {
    throw new Error('這份作品備份的參觀亮點格式不正確')
  }
  if (value.reflections !== undefined) {
    if (!Array.isArray(value.reflections) || value.reflections.length > 50 || value.reflections.some((item) => !isRecord(item) || !validId(item.id) || typeof item.memberLabel !== 'string' || typeof item.text !== 'string') || new Set(value.reflections.map((item) => (item as Record<string, unknown>).id)).size !== value.reflections.length) {
      throw new Error('這份作品備份的小組心得格式不正確')
    }
  }
  if (!Array.isArray(value.photos) || value.photos.length > 8) throw new Error('這份作品備份的照片資料不正確')
  const ids = new Set<string>()
  for (const photo of value.photos) {
    if (!isRecord(photo) || !validId(photo.id) || ids.has(photo.id) || typeof photo.fileName !== 'string' || !photo.fileName ||
      (photo.originalFileName !== undefined && typeof photo.originalFileName !== 'string') || !isNonNegativeNumber(photo.originalSize) ||
      !isNonNegativeNumber(photo.processedSize) || typeof photo.captionZh !== 'string' || typeof photo.captionEn !== 'string' || typeof photo.alt !== 'string') {
      throw new Error('這份作品備份含有無法辨識的照片資料')
    }
    ids.add(photo.id)
  }
  const coverId = value.coverId
  if (value.photos.length && (typeof coverId !== 'string' || !coverId || !ids.has(coverId))) throw new Error('這份作品備份找不到原本設定的封面照片')

  if (value.video !== null && (!isRecord(value.video) || typeof value.video.fileName !== 'string' || !value.video.fileName || !isNonNegativeNumber(value.video.size))) {
    throw new Error('這份作品備份的影片資料不正確')
  }
  const privacy = value.privacy
  if (!isRecord(privacy) || ['noPrivateData', 'mediaPermission', 'understandsPublic', 'checkedBackground'].some((field) => typeof privacy[field] !== 'boolean')) {
    throw new Error('這份作品備份的公開確認資料不正確')
  }
}

export function assertValidStoredProject(value: unknown): asserts value is ProjectData {
  assertValidProjectJson(value)
  const stored = value as ProjectData
  if (stored.photos.some((photo) => !(photo.blob instanceof Blob)) || (stored.video && !(stored.video.blob instanceof Blob))) {
    throw new Error('這台電腦上的自動備份缺少照片或影片資料')
  }
}

export function projectToJson(project: ProjectData): ProjectJson {
  const { photos, video, ...rest } = project
  return {
    ...rest,
    photos: photos.map(({ blob, ...photo }) => { void blob; return photo }),
    video: video ? (({ blob, ...metadata }) => { void blob; return metadata })(video) : null,
  }
}

export function restoreProject(json: ProjectJson, photoBlobs: Map<string, Blob>, videoBlob?: Blob): ProjectData {
  const photos: PhotoAsset[] = json.photos.map((p) => {
    const blob = photoBlobs.get(p.id)
    if (!blob) throw new Error(`找不到照片：${p.fileName}`)
    return { ...p, originalFileName: p.originalFileName ?? p.fileName, blob }
  })
  let video: VideoAsset | null = null
  if (json.video) {
    if (!videoBlob) throw new Error(`找不到影片：${json.video.fileName}`)
    video = { ...json.video, blob: videoBlob }
  }
  return { ...json, recommendationEn: json.recommendationEn ?? '', noticeEn: json.noticeEn ?? '', reflections: json.reflections ?? [], customCss: json.customCss ?? '', customCssFileName: json.customCssFileName ?? '', photos, video }
}
