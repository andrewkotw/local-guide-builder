import { createSampleProject } from '../data'
import { validateProject } from './validation'

describe('必填欄位驗證', () => {
  it('列出缺少的主要資料、照片與隱私確認', () => {
    const project = createSampleProject(); project.titleZh = ''; project.photos = []; project.coverId = ''
    const fields = validateProject(project).map((item) => item.field)
    expect(fields).toContain('titleZh'); expect(fields).toContain('photos'); expect(fields).toContain('privacy.noPrivateData')
  })
  it('完整資料可以通過', () => {
    const p = createSampleProject(); p.photos = [{ id: 'p1', fileName: 'a.jpg', blob: new Blob(['x']), originalSize: 1, processedSize: 1, captionZh: '', captionEn: '', alt: '照片' }]; p.coverId = 'p1'; p.privacy = { noPrivateData: true, mediaPermission: true, understandsPublic: true, checkedBackground: true }
    expect(validateProject(p)).toEqual([])
  })
  it('地圖欄位只接受 Google Maps 分享網址', () => {
    const p = createSampleProject()
    p.mapsUrl = 'https://example.com/not-a-map'
    expect(validateProject(p).map((item) => item.field)).toContain('mapsUrl')
    p.mapsUrl = 'https://maps.app.goo.gl/AbCdEf123'
    expect(validateProject(p).map((item) => item.field)).not.toContain('mapsUrl')
  })
  it('每一位組員都要填代稱與心得，但不限制字數', () => {
    const p = createSampleProject()
    p.reflections = [{ id: 'member-1', memberLabel: '', text: '' }]
    expect(validateProject(p).map((item) => item.field)).toEqual(expect.arrayContaining(['reflection-member-1-memberLabel', 'reflection-member-1-text']))
    p.reflections = [{ id: 'member-1', memberLabel: '7 號', text: '我學會分工。' }]
    expect(validateProject(p).some((item) => item.field.startsWith('reflection'))).toBe(false)
  })
})
