import type { ProjectData, ValidationIssue } from '../types'
import { parseYouTubeUrl, safeGoogleMapsUrl } from './security'

export function validateProject(p: ProjectData): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const need = (field: keyof ProjectData, step: number, label: string) => {
    if (!String(p[field] ?? '').trim()) issues.push({ field, step, message: `請填寫「${label}」` })
  }
  need('titleZh', 0, '景點中文名稱'); need('titleEn', 0, '景點英文名稱')
  need('taglineZh', 0, '一句中文特色介紹'); need('taglineEn', 0, '一句英文特色介紹')
  need('address', 0, '地址'); need('groupName', 0, '小組名稱')
  need('introZh', 1, '中文介紹'); need('introEn', 1, '英文介紹'); need('recommendation', 1, '推薦原因')
  if (!p.highlights.some((h) => h.textZh.trim() || h.textEn.trim())) issues.push({ field: 'highlights', step: 1, message: '請至少填寫一項參觀亮點' })
  if (!p.photos.length) issues.push({ field: 'photos', step: 2, message: '請至少加入一張照片' })
  if (p.photos.length && !p.coverId) issues.push({ field: 'photos', step: 2, message: '請選一張照片作為封面' })
  if (p.videoMode === 'youtube' && p.youtubeUrl.trim() && !parseYouTubeUrl(p.youtubeUrl)) issues.push({ field: 'youtubeUrl', step: 3, message: 'YouTube 網址格式不正確，請貼上影片分享網址' })
  if (p.mapsUrl.trim() && !safeGoogleMapsUrl(p.mapsUrl)) issues.push({ field: 'mapsUrl', step: 3, message: '地圖網址格式不正確，請貼上 Google Maps 的 https:// 分享網址' })
  if (!p.reflections.length) issues.push({ field: 'reflections', step: 4, message: '請至少新增一位組員的心得' })
  p.reflections.forEach((reflection, index) => {
    if (!reflection.memberLabel.trim()) issues.push({ field: `reflection-${reflection.id}-memberLabel`, step: 4, message: `請填寫第 ${index + 1} 位組員的暱稱或座號` })
    if (!reflection.text.trim()) issues.push({ field: `reflection-${reflection.id}-text`, step: 4, message: `請填寫第 ${index + 1} 位組員的心得` })
  })
  const privacyLabels: Array<[keyof ProjectData['privacy'], string]> = [
    ['noPrivateData', '確認沒有填寫私人資料'], ['mediaPermission', '確認照片與影片可用於課堂網站'],
    ['understandsPublic', '了解網站公開後可能被看到'], ['checkedBackground', '檢查畫面中沒有不適合公開的個人資料'],
  ]
  privacyLabels.forEach(([key, label]) => { if (!p.privacy[key]) issues.push({ field: `privacy.${key}`, step: 4, message: `請${label}` }) })
  return issues
}
