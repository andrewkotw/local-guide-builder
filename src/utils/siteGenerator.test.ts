import JSZip from 'jszip'
import { createSampleProject } from '../data'
import { buildSiteFiles } from './siteGenerator'
import { createWebsiteZip } from './zip'

function completeProject() {
  const p = createSampleProject(); p.photos = [{ id: 'p1', fileName: '封面 photo.jpg', blob: new Blob(['img'], { type: 'image/jpeg' }), originalSize: 3, processedSize: 3, captionZh: '', captionEn: '', alt: '封面' }]; p.coverId = 'p1'; p.privacy = { noPrivateData: true, mediaPermission: true, understandsPublic: true, checkedBackground: true }; return p
}

describe('完成網站', () => {
  it('ZIP 包含必要檔案與圖片', async () => {
    const zip = await JSZip.loadAsync(await createWebsiteZip(completeProject()))
    expect(Object.keys(zip.files)).toEqual(expect.arrayContaining(['index.html', 'style.css', 'project.json', 'site-info.json', 'README.txt']))
    expect(Object.keys(zip.files).some((name) => name.startsWith('images/') && name.endsWith('.jpg'))).toBe(true)
  })
  it('選填欄位空白時不產生空白區塊', () => {
    const p = completeProject(); p.hours = ''; p.fee = ''; p.notice = ''; p.noticeEn = ''; p.mapsUrl = ''; p.transportZh = ''; p.transportEn = ''; p.youtubeUrl = ''; p.video = null
    const html = buildSiteFiles(p).html
    expect(html).not.toContain('開放時間</strong>'); expect(html).not.toContain('費用</strong>'); expect(html).not.toContain('參觀提醒'); expect(html).not.toContain('id="video"'); expect(html).not.toContain('id="transport"'); expect(html).not.toContain('在 Google Maps 開啟')
  })
  it('學生文字只會作為文字顯示', () => {
    const p = completeProject(); p.titleZh = '<script>alert(1)</script>'
    const html = buildSiteFiles(p).html; expect(html).not.toContain('<script>alert(1)</script>'); expect(html).toContain('&lt;script&gt;')
  })
  it('照片提供可用鍵盤操作的放大按鈕與對話框', () => {
    const files = buildSiteFiles(completeProject()); const document = new DOMParser().parseFromString(files.html, 'text/html')
    const button = document.querySelector<HTMLButtonElement>('.photo-zoom')
    expect(button?.type).toBe('button'); expect(button?.getAttribute('aria-label')).toBe('放大檢視：封面')
    expect(button?.dataset.photoSrc).toBe('images/photo-01.jpg'); expect(document.querySelector('dialog#photo-lightbox')).not.toBeNull()
    expect(files.css).toContain('cursor: zoom-in')
  })
  it('參觀亮點使用有編號且可適應手機的卡片版面', () => {
    const files = buildSiteFiles(completeProject())
    const document = new DOMParser().parseFromString(files.html, 'text/html')

    expect(document.querySelector('.highlights-heading .eyebrow')?.textContent).toBe("DON'T MISS")
    expect(document.querySelectorAll('.highlights ol > li')).toHaveLength(3)
    expect(files.css).toContain('counter-reset: highlight-card')
    expect(files.css).toMatch(/@media\s*\(max-width:780px\)\s*\{\s*\.highlights ol\s*\{\s*grid-template-columns: 1fr/)
  })
  it('每位組員心得會安全顯示在網站最後一個內容區塊', () => {
    const p = completeProject()
    p.reflections = [
      { id: 'member-1', memberLabel: '12 號', text: '我負責拍照，學會了分工。' },
      { id: 'member-2', memberLabel: '<script>壞人</script>', text: '<img src=x onerror=alert(1)>這是心得' },
    ]
    const files = buildSiteFiles(p)
    const document = new DOMParser().parseFromString(files.html, 'text/html')

    expect(document.querySelectorAll('#reflections .reflection-card')).toHaveLength(2)
    expect(document.querySelector('main section:last-child')?.id).toBe('reflections')
    expect(document.querySelector('#reflections')?.textContent).toContain('我負責拍照，學會了分工。')
    expect(document.querySelector('#reflections script')).toBeNull()
    expect(document.querySelector('#reflections img')).toBeNull()
    expect(files.css).toContain('.reflection-grid')
  })
  it('安全的自訂 CSS 會套用到預覽與匯出，危險內容會被忽略', () => {
    const p = completeProject()
    p.customCss = 'body { font-size: 23px; }'
    expect(buildSiteFiles(p).css).toContain('body { font-size: 23px; }')
    p.customCss = '</style><script>window.__cssXss = true</script>'
    const files = buildSiteFiles(p)
    expect(files.css).not.toContain('window.__cssXss')
    expect(files.html).not.toContain('__cssXss')
  })
  it('有效的 Google Maps 網址會產生安全小地圖並保留外開連結', () => {
    const p = completeProject()
    p.address = '臺北市信義區市府路 45 號'
    p.mapsUrl = 'https://maps.app.goo.gl/AbCdEf123'
    const files = buildSiteFiles(p)
    const document = new DOMParser().parseFromString(files.html, 'text/html')
    const frame = document.querySelector<HTMLIFrameElement>('.map-embed iframe')
    const link = document.querySelector<HTMLAnchorElement>('.map-link')

    expect(frame?.src).toContain('https://maps.google.com/maps?q=')
    expect(frame?.src).toContain('output=embed')
    expect(frame?.getAttribute('loading')).toBe('lazy')
    expect(frame?.title).toContain('位置地圖')
    expect(link?.href).toBe('https://maps.app.goo.gl/AbCdEf123')
    expect(link?.rel).toContain('noopener')
    expect(files.css).toContain('.map-embed')
  })
  it('非 Google Maps 網址不會產生 iframe 或外部連結', () => {
    const p = completeProject()
    p.mapsUrl = 'https://example.com/pretend-map'
    const document = new DOMParser().parseFromString(buildSiteFiles(p).html, 'text/html')
    expect(document.querySelector('.map-embed')).toBeNull()
    expect(document.querySelector('.map-link')).toBeNull()
  })
})
