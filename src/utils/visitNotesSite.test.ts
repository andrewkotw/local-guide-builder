import { createEmptyProject, createSampleProject } from '../data'
import { visitNotesHtml } from './visitNotesSite'
import { buildSiteFiles } from './siteGenerator'

it('兩段各有中文標題與下一行英文標題，英文內容安全轉義', () => {
  const project = createSampleProject()
  project.recommendationEn = '<script>alert(1)</script>\nNice place'
  project.noticeEn = '<img src=x onerror=alert(1)>'
  const html = visitNotesHtml(project)
  const doc = new DOMParser().parseFromString(html, 'text/html')
  expect(html).toContain('我們推薦的原因<br><small lang="en">Why We Recommend It</small>')
  expect(html).toContain('參觀提醒<br><small lang="en">Visitor Tips</small>')
  expect(doc.querySelectorAll('[data-visit-language="en"]')).toHaveLength(2)
  expect(doc.querySelectorAll('script,img')).toHaveLength(0)
  expect(doc.querySelector('.note [lang="en"][data-visit-language]')?.textContent).toContain('<script>alert(1)</script>')
  expect(doc.querySelector('button')?.getAttribute('aria-controls')).toBe('visit-notes-content')
})

it('未寫英文的舊作品仍有雙語標題，不提供會切換成空白的按鈕', () => {
  const project = createSampleProject(); project.recommendationEn = ''; project.noticeEn = ''
  const html = visitNotesHtml(project)
  expect(html).toContain('Why We Recommend It'); expect(html).toContain('Visitor Tips')
  expect(html).not.toContain('<button')
  expect(html).toContain(project.recommendation)
})

it('沒有選填參觀提醒時，仍可切換推薦原因，不產生空白提醒', () => {
  const project = createSampleProject(); project.notice = ''; project.noticeEn = ''
  const html = visitNotesHtml(project)
  expect(html).not.toContain('Visitor Tips')
  expect(html).toContain('data-visit-toggle')
  expect(visitNotesHtml(createEmptyProject())).toBe('')
})

it('不依賴執行翻譯的腳本，英文預先存在匯出 HTML；關閉腳本也可閱讀雙語', () => {
  const html = buildSiteFiles(createSampleProject()).html
  const doc = new DOMParser().parseFromString(html, 'text/html')
  expect(doc.querySelectorAll('script')).toHaveLength(1)
  expect(doc.querySelector('script')?.textContent).not.toMatch(/fetch\(|Translator\./)
  for (const body of doc.querySelectorAll('[data-visit-language]')) expect(body.hasAttribute('hidden')).toBe(false)
})
