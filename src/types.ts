export type PlaceType = '景點' | '美食' | '廟宇' | '歷史文化' | '其他'
export type ThemeId = 'nature' | 'history' | 'modern'

export interface Highlight { id: string; textZh: string; textEn: string }
export interface MemberReflection { id: string; memberLabel: string; text: string }
export interface PhotoAsset {
  id: string
  /** 學生看到的原始檔名；舊版備份可能沒有此欄位。 */
  originalFileName?: string
  fileName: string
  blob: Blob
  originalSize: number
  processedSize: number
  captionZh: string
  captionEn: string
  alt: string
}
export interface VideoAsset { fileName: string; size: number; blob: Blob }
export interface PrivacyChecks { noPrivateData: boolean; mediaPermission: boolean; understandsPublic: boolean; checkedBackground: boolean }

export interface ProjectData {
  version: 1
  updatedAt: string
  titleZh: string
  titleEn: string
  type: PlaceType
  taglineZh: string
  taglineEn: string
  address: string
  hours: string
  fee: string
  groupName: string
  introZh: string
  introEn: string
  highlights: Highlight[]
  reflections: MemberReflection[]
  recommendation: string
  recommendationEn: string
  notice: string
  noticeEn: string
  mapsUrl: string
  transportZh: string
  transportEn: string
  videoMode: 'youtube' | 'local'
  youtubeUrl: string
  video: VideoAsset | null
  photos: PhotoAsset[]
  coverId: string
  theme: ThemeId
  customCss: string
  customCssFileName: string
  /** Missing in older backups, which used additive overrides. */
  customCssMode?: 'override' | 'replace'
  privacy: PrivacyChecks
}

export interface ProjectJson extends Omit<ProjectData, 'photos' | 'video'> {
  photos: Array<Omit<PhotoAsset, 'blob'>>
  video: Omit<VideoAsset, 'blob'> | null
}

/** 老師端班級首頁產生器會讀取的固定交換格式。 */
export interface SiteInfo {
  schemaVersion: 1
  titleZh: string
  titleEn: string
  type: PlaceType
  groupName: string
  coverImage: string
  summary: string
}

export interface ValidationIssue { field: string; step: number; message: string }
