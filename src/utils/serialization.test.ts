import { createSampleProject } from '../data'
import { assertValidProjectJson, projectToJson, restoreProject } from './serialization'

it('project.json 序列化不包含圖片資料，且可正確還原', () => {
  const p = createSampleProject(); const blob = new Blob(['image'], { type: 'image/jpeg' }); p.photos = [{ id: 'p1', fileName: 'a.jpg', blob, originalSize: 8, processedSize: 5, captionZh: '說明', captionEn: '', alt: '替代文字' }]; p.coverId = 'p1'
  const json = projectToJson(p); expect(JSON.stringify(json)).not.toContain('image'); expect(json.photos[0]).not.toHaveProperty('blob')
  const restored = restoreProject(json, new Map([['p1', blob]])); expect(restored.photos[0].blob).toBe(blob); expect(restored.titleZh).toBe(p.titleZh); expect(restored.reflections).toEqual(p.reflections)
})

it('舊版作品沒有小組心得欄位時仍可安全還原', () => {
  const json = projectToJson(createSampleProject())
  delete (json as Partial<typeof json>).reflections
  delete (json as Partial<typeof json>).customCss
  delete (json as Partial<typeof json>).customCssFileName
  delete (json as Partial<typeof json>).recommendationEn
  delete (json as Partial<typeof json>).noticeEn
  expect(() => assertValidProjectJson(json)).not.toThrow()
  const restored = restoreProject(json, new Map())
  expect(restored.reflections).toEqual([])
  expect(restored.customCss).toBe('')
  expect(restored.customCssFileName).toBe('')
  expect(restored.recommendationEn).toBe('')
  expect(restored.noticeEn).toBe('')
})

it('英文推薦原因與參觀提醒可還原，錯誤型別的備份安全拒絕', () => {
  const json = projectToJson(createSampleProject())
  const restored = restoreProject(json, new Map())
  expect(restored.recommendationEn).toBe(json.recommendationEn)
  expect(restored.noticeEn).toBe(json.noticeEn)
  expect(() => assertValidProjectJson({ ...json, noticeEn: { html: '<script>' } })).toThrow('英文推薦原因或參觀提醒格式不正確')
})
