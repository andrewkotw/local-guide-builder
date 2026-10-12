import JSZip from 'jszip'
import { createSampleProject } from '../data'
import type { PhotoAsset, ProjectData } from '../types'
import { buildSiteFiles } from './siteGenerator'
import { projectToJson } from './serialization'
import { createProjectBackup, createWebsiteZip, readProjectBackup, websiteArchiveName } from './zip'

function photo(id: string, originalFileName: string, marker: string): PhotoAsset {
  return {
    id, originalFileName, fileName: originalFileName.replace(/\.[^.]+$/, '.jpg'),
    blob: new Blob([`jpeg-${marker}`], { type: 'image/jpeg' }), originalSize: 100, processedSize: 20,
    captionZh: `說明 ${marker}`, captionEn: `caption ${marker}`, alt: `替代文字 ${marker}`,
  }
}

function reliableProject(): ProjectData {
  const project = createSampleProject()
  project.photos = [
    photo('photo-a', '中文 照片（完成版）#1.PNG', 'a'),
    photo('photo-b', 'my photo (final) & copy.jpg', 'b'),
    photo('photo-c', '中文 照片（完成版）#1.PNG', 'c'),
  ]
  project.coverId = 'photo-a'
  project.videoMode = 'local'
  project.video = { fileName: '介紹 影片（最終版）#1.mp4', size: 9, blob: new Blob(['mp4-bytes'], { type: 'video/mp4' }) }
  project.privacy = { noPrivateData: true, mediaPermission: true, understandsPublic: true, checkedBackground: true }
  return project
}

describe('備份與完成網站的檔案可靠性', () => {
  it('使用安全、不重複且與原始檔名無關的網站路徑', () => {
    const files = buildSiteFiles(reliableProject())
    expect([...files.photoPaths.values()]).toEqual(['images/photo-01.jpg', 'images/photo-02.jpg', 'images/photo-03.jpg'])
    expect(new Set(files.photoPaths.values()).size).toBe(3)
    expect(files.videoPath).toBe('media/video.mp4')
  })

  it('專案備份保留原始檔名、二進位素材並可完整匯入', async () => {
    const original = reliableProject(); const blob = await createProjectBackup(original); const zip = await JSZip.loadAsync(blob)
    expect(Object.keys(zip.files)).toEqual(expect.arrayContaining(['project.json', 'images/photo-a.jpg', 'images/photo-b.jpg', 'images/photo-c.jpg', 'media/video.mp4']))
    const restored = await readProjectBackup(blob)
    expect(restored.photos.map((item) => item.originalFileName)).toEqual(original.photos.map((item) => item.originalFileName))
    expect(restored.photos.map((item) => item.blob.size)).toEqual(original.photos.map((item) => item.blob.size))
    expect(restored.video?.fileName).toBe(original.video?.fileName)
    expect(restored.video?.blob.size).toBe(original.video?.blob.size)
  })

  it('完成網站 ZIP 的所有本機引用存在、相對且可再次匯入', async () => {
    const project = reliableProject(); const blob = await createWebsiteZip(project); const zip = await JSZip.loadAsync(blob)
    const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir)
    expect(names).toEqual(expect.arrayContaining([
      'index.html', 'style.css', 'project.json', 'site-info.json', 'README.txt',
      'images/photo-01.jpg', 'images/photo-02.jpg', 'images/photo-03.jpg', 'media/video.mp4',
    ]))
    const html = await zip.file('index.html')!.async('string'); const document = new DOMParser().parseFromString(html, 'text/html')
    const refs = [...document.querySelectorAll<HTMLImageElement | HTMLVideoElement | HTMLLinkElement>('img[src],video[src],link[href]')].map((element) => element.getAttribute('src') ?? element.getAttribute('href') ?? '')
    const coverRef = document.querySelector<HTMLElement>('.hero')?.getAttribute('style')?.match(/url\('([^']+)'\)/)?.[1]
    if (coverRef) refs.push(coverRef)
    for (const ref of refs) {
      expect(ref).not.toMatch(/^\//); expect(ref).not.toContain('..'); expect(zip.file(ref), `ZIP 缺少 ${ref}`).not.toBeNull()
    }
    expect(refs).toContain('style.css'); expect(refs).toContain('media/video.mp4')
    const restored = await readProjectBackup(blob)
    expect(restored.photos).toHaveLength(3); expect(restored.video?.fileName).toBe('介紹 影片（最終版）#1.mp4')
  })

  it('site-info.json 格式正確且封面路徑存在', async () => {
    const blob = await createWebsiteZip(reliableProject()); const zip = await JSZip.loadAsync(blob)
    const info = JSON.parse(await zip.file('site-info.json')!.async('string')) as Record<string, unknown>
    expect(info).toEqual({ schemaVersion: 1, titleZh: '清風老街', titleEn: 'Breeze Old Street', type: '歷史文化', groupName: '清風探索隊', coverImage: 'images/photo-01.jpg', summary: '沿著紅磚街屋，發現小鎮的百年故事。' })
    expect(zip.file(String(info.coverImage))).not.toBeNull()
  })

  it('完成網站 ZIP 使用類型、英文名稱與小組名稱組成安全檔名', () => {
    const project = reliableProject()
    project.titleEn = 'Breeze Old Street (East) & West'
    project.groupName = '清風／探索隊'
    expect(websiteArchiveName(project)).toBe('歷史文化-Breeze-Old-Street-East-West-清風-探索隊.zip')
  })

  it('惡意 HTML 與 script 只會顯示為文字，且網站不依賴開發環境', async () => {
    const project = reliableProject(); project.titleZh = `<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>`; project.introZh = `<a href="javascript:alert(1)">危險</a>`; project.mapsUrl = 'javascript:alert(1)'
    const blob = await createWebsiteZip(project); const zip = await JSZip.loadAsync(blob); const html = await zip.file('index.html')!.async('string')
    const document = new DOMParser().parseFromString(html, 'text/html')
    expect(document.querySelectorAll('script')).toHaveLength(1); expect(document.querySelector('script')?.hasAttribute('data-site-tools')).toBe(true); expect(html).not.toContain('<img src=x')
    expect([...document.querySelectorAll('a')].some((link) => link.getAttribute('href')?.toLowerCase().startsWith('javascript:'))).toBe(false)
    expect(html).toContain('&lt;script&gt;'); expect(html).not.toMatch(/localhost|127\.0\.0\.1|\/src\/|node_modules|vite/i)
  })

  it('沒有影片和選填資料時不產生空白區塊或 media 引用', async () => {
    const project = reliableProject(); project.video = null; project.youtubeUrl = ''; project.hours = ''; project.fee = ''; project.notice = ''; project.noticeEn = ''; project.mapsUrl = ''; project.transportZh = ''; project.transportEn = ''
    const blob = await createWebsiteZip(project); const zip = await JSZip.loadAsync(blob); const html = await zip.file('index.html')!.async('string')
    expect(Object.keys(zip.files).some((name) => name.startsWith('media/') && !zip.files[name].dir)).toBe(false)
    expect(html).not.toContain('id="video"'); expect(html).not.toContain('id="transport"'); expect(html).not.toContain('開放時間</strong>'); expect(html).not.toContain('費用</strong>')
  })

  it.each([
    ['youtu.be', 'https://youtu.be/dQw4w9WgXcQ'],
    ['youtube.com/watch', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
    ['YouTube Shorts', 'https://youtube.com/shorts/dQw4w9WgXcQ'],
  ])('%s 只準備 youtube-nocookie 安全嵌入與原站連結', (_label, url) => {
    const project = reliableProject(); project.videoMode = 'youtube'; project.video = null; project.youtubeUrl = url
    const html = buildSiteFiles(project).html
    expect(html).toContain('data-youtube-embed="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"')
    expect(html).toContain('href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"')
    expect(html).not.toContain('<iframe'); expect(html).not.toContain('youtu.be/')
  })

  it('無效 YouTube 網址不產生 iframe', () => {
    const project = reliableProject(); project.videoMode = 'youtube'; project.video = null; project.youtubeUrl = 'https://example.com/not-youtube'
    const html = buildSiteFiles(project).html; expect(html).not.toContain('<iframe'); expect(html).not.toContain('id="video"')
  })

  it('損壞或不是 ZIP 的備份只顯示容易理解的中文錯誤', async () => {
    await expect(readProjectBackup(new Blob(['not-a-zip']))).rejects.toThrow('無法開啟這份作品備份')
  })

  it('拒絕欄位缺漏或照片代號重複的備份，不暴露程式例外', async () => {
    const missingFields = new JSZip(); missingFields.file('project.json', JSON.stringify({ version: 1, photos: [] }))
    await expect(readProjectBackup(await missingFields.generateAsync({ type: 'blob' }))).rejects.toThrow('這份作品備份缺少必要的文字欄位')

    const json = projectToJson(reliableProject())
    json.photos[1].id = json.photos[0].id
    const duplicateIds = new JSZip(); duplicateIds.file('project.json', JSON.stringify(json)); duplicateIds.file(`images/${json.photos[0].id}.jpg`, 'photo')
    await expect(readProjectBackup(await duplicateIds.generateAsync({ type: 'blob' }))).rejects.toThrow('這份作品備份含有無法辨識的照片資料')
  })
})
