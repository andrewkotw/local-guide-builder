import JSZip from 'jszip'
import type { ProjectData, ProjectJson, SiteInfo } from '../types'
import { buildSiteFiles } from './siteGenerator'
import { normalizeFileName } from './security'
import { assertValidProjectJson, projectToJson, restoreProject } from './serialization'

const MAX_BACKUP_SIZE = 120 * 1024 * 1024
const MAX_PROJECT_JSON_SIZE = 2 * 1024 * 1024
const MAX_STORED_PHOTO_SIZE = 15 * 1024 * 1024
const MAX_STORED_VIDEO_SIZE = 50 * 1024 * 1024

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.hidden = true; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function createProjectBackup(project: ProjectData): Promise<Blob> {
  const zip = new JSZip(); zip.file('project.json', JSON.stringify(projectToJson(project), null, 2))
  project.photos.forEach((photo) => zip.file(`images/${photo.id}.jpg`, photo.blob))
  if (project.video) zip.file('media/video.mp4', project.video.blob)
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}

export async function readProjectBackup(file: Blob): Promise<ProjectData> {
  try {
    if (file.size > MAX_BACKUP_SIZE) throw new Error('這份作品備份超過 120MB，請確認是否選錯檔案')
    const zip = await JSZip.loadAsync(file)
    const entries = Object.values(zip.files)
    if (entries.length > 50) throw new Error('這份作品備份包含太多檔案，請確認是否選錯檔案')
    const declaredSize = entries.reduce((total, entry) => {
      const data = (entry as unknown as { _data?: { uncompressedSize?: number } })._data
      return total + (typeof data?.uncompressedSize === 'number' ? data.uncompressedSize : 0)
    }, 0)
    if (declaredSize > MAX_BACKUP_SIZE) throw new Error('這份作品備份解開後超過 120MB，為了保護電腦記憶體，無法開啟')
    const jsonFile = zip.file('project.json'); if (!jsonFile) throw new Error('這不是可開啟的作品備份檔：裡面找不到 project.json')
    const jsonText = await jsonFile.async('string')
    if (new Blob([jsonText]).size > MAX_PROJECT_JSON_SIZE) throw new Error('這份作品備份的文字資料異常過大，無法安全開啟')
    const parsed: unknown = JSON.parse(jsonText)
    assertValidProjectJson(parsed)
    const json: ProjectJson = parsed
    const blobs = new Map<string, Blob>()
    for (const [index, photo] of json.photos.entries()) {
      const candidates = [
        `images/${photo.id}.jpg`,
        `images/photo-${String(index + 1).padStart(2, '0')}.jpg`,
        `images/${String(index + 1).padStart(2, '0')}-${normalizeFileName(photo.fileName, 'photo')}`,
      ]
      const entry = candidates.map((path) => zip.file(path)).find(Boolean)
      if (!entry) throw new Error(`備份中缺少照片：${photo.originalFileName ?? photo.fileName}`)
      const blob = await entry.async('blob')
      if (blob.size > MAX_STORED_PHOTO_SIZE) throw new Error(`備份中的照片太大：${photo.originalFileName ?? photo.fileName}`)
      blobs.set(photo.id, blob)
    }
    let videoBlob: Blob | undefined
    if (json.video) {
      const entry = zip.file('media/video.mp4') ?? zip.file(`media/${normalizeFileName(json.video.fileName, 'video.mp4')}`)
      if (!entry) throw new Error(`備份中缺少影片：${json.video.fileName}`)
      videoBlob = await entry.async('blob')
      if (videoBlob.size > MAX_STORED_VIDEO_SIZE) throw new Error(`備份中的影片超過 50MB：${json.video.fileName}`)
    }
    return restoreProject(json, blobs, videoBlob)
  } catch (reason) {
    if (reason instanceof Error && /^(這不是|這份|備份中)/.test(reason.message)) throw reason
    throw new Error('無法開啟這份作品備份。檔案可能已損壞，請重新下載或選擇另一份備份。')
  }
}

export async function createWebsiteZip(project: ProjectData): Promise<Blob> {
  const zip = new JSZip(); const site = buildSiteFiles(project)
  zip.file('index.html', site.html); zip.file('style.css', site.css); zip.file('project.json', JSON.stringify(projectToJson(project), null, 2))
  project.photos.forEach((photo) => zip.file(site.photoPaths.get(photo.id)!, photo.blob))
  if (project.video && site.videoPath) zip.file(site.videoPath, project.video.blob)
  const cover = project.photos.find((p) => p.id === project.coverId) ?? project.photos[0]
  zip.file('site-info.json', JSON.stringify(createSiteInfo(project, cover ? site.photoPaths.get(cover.id) : ''), null, 2))
  zip.file('README.txt', `網站使用說明\n\n1. 解壓縮後，雙擊 index.html 可以在電腦上預覽網站。\n2. index.html、style.css、images 資料夾，以及 media 資料夾（如果有）不可隨意刪除。\n3. 請把整個 ZIP 檔交給老師，不要只交其中一個檔案。\n4. 請不要直接修改檔名，否則照片或影片可能無法顯示。\n5. YouTube 不允許在直接雙擊開啟的本機網頁中嵌入播放；本機預覽會提供前往 YouTube 的按鈕，發布到網站網址後才會顯示播放器。\n6. Google Maps 小地圖與 YouTube 影片需要網路；地圖下方仍有另開 Google Maps 的按鈕。\n7. 網站發布到網路後，任何取得網址的人都可能看到內容，請再次確認沒有私人資料。\n`)
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}

export async function downloadProjectBackup(project: ProjectData): Promise<void> { downloadBlob(await createProjectBackup(project), `${normalizeFileName(project.titleZh || '我的在地網站')}.localguide`) }
export async function downloadWebsite(project: ProjectData): Promise<void> { downloadBlob(await createWebsiteZip(project), websiteArchiveName(project)) }

export function createSiteInfo(project: ProjectData, coverImage?: string): SiteInfo {
  const cover = project.photos.find((photo) => photo.id === project.coverId) ?? project.photos[0]
  return {
    schemaVersion: 1,
    titleZh: project.titleZh.trim(),
    titleEn: project.titleEn.trim(),
    type: project.type,
    groupName: project.groupName.trim(),
    coverImage: coverImage ?? (cover ? `images/${cover.fileName}` : ''),
    summary: project.taglineZh.trim(),
  }
}

function archiveNamePart(value: string, fallback: string): string {
  // 小數點在這裡不是副檔名分隔符，先換成連字號，避免名稱被誤判成副檔名。
  return normalizeFileName(value.trim().replace(/\./g, '-'), fallback)
}

export function websiteArchiveName(project: ProjectData): string {
  const type = archiveNamePart(project.type, '其他')
  const title = archiveNamePart(project.titleEn, 'Untitled-Place')
  const group = archiveNamePart(project.groupName, '未命名小組')
  return `${type}-${title}-${group}.zip`
}
