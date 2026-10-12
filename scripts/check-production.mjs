import assert from 'node:assert/strict'
import { readFile, mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import JSZip from 'jszip'

const target = new URL(process.argv[2] || 'http://127.0.0.1:4175/local-guide-builder/')
assert.equal(target.pathname, '/local-guide-builder/', 'Use the actual Pages subdirectory URL')
const browser = await chromium.launch()
const failures = []
const requests = []
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
  page.setDefaultTimeout(20_000)
  page.setDefaultNavigationTimeout(30_000)
  page.on('pageerror', (error) => failures.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') failures.push(message.text()) })
  page.on('response', (response) => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`) })
  page.on('request', (request) => { if (/^https?:/.test(request.url())) requests.push({ url: request.url(), method: request.method() }) })
  const response = await page.goto(target.href)
  assert.equal(response.status(), 200)
  await page.getByRole('heading', { name: '我的在地小旅行', exact: true }).waitFor()
  assert(await page.locator('body').evaluate((body) => getComputedStyle(body).margin === '0px'), 'CSS not loaded')
  await page.getByRole('button', { name: '先載入練習範例看看' }).click()
  await page.getByRole('button', { name: /3.*照片/ }).click()
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1800; canvas.height = 1200
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#28744d'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await page.locator('input[accept*="jpg"]').setInputFiles({ name: '部署測試 (1).png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') })
  await page.getByText('目前 1 / 8 張').waitFor()
  await page.getByText('已保存在這台電腦', { exact: true }).waitFor()
  await page.reload()
  await page.getByRole('button', { name: /3.*照片/ }).click()
  await page.getByText('目前 1 / 8 張').waitFor()
  await page.getByRole('button', { name: /5.*預覽與下載/ }).click()
  const backupEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: '下載可繼續編輯的作品備份' }).click()
  const backup = await backupEvent
  const backupPath = await backup.path()
  assert(backup.suggestedFilename().endsWith('.localguide'))
  const backupZip = await JSZip.loadAsync(await readFile(backupPath))
  assert.equal(JSON.parse(await backupZip.file('project.json').async('string')).photos.length, 1)
  // Import in the same isolated test browser, never in a student's browser.
  page.on('dialog', (dialog) => dialog.accept())
  await page.locator('input[accept*="localguide"]').setInputFiles(backupPath)
  await page.getByText('作品備份已成功開啟，可以繼續編輯').waitFor()
  await page.getByRole('button', { name: /5.*預覽與下載/ }).click()
  for (const checkbox of await page.locator('.privacy input').all()) await checkbox.check()
  const websiteEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: '下載交給老師的網站壓縮檔' }).click()
  const website = await websiteEvent
  const zip = await JSZip.loadAsync(await readFile(await website.path()))
  for (const file of ['index.html', 'style.css', 'project.json', 'site-info.json', 'README.txt', 'images/photo-01.jpg']) assert(zip.file(file), `Missing ${file}`)
  const html = await zip.file('index.html').async('string')
  assert(html.includes('href="style.css"')); assert(html.includes('images/photo-01.jpg'))
  assert(!html.includes('/local-guide-builder/'), 'Exported websites must remain independent of the builder path')
  for (const size of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size)
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal overflow')
  }
  await mkdir('test-results', { recursive: true })
  await page.screenshot({ path: `test-results/production-${target.hostname}.png`, fullPage: true })
  assert.deepEqual(failures, [], 'Browser/network errors')
  assert(requests.every((request) => request.method === 'GET' && new URL(request.url).origin === target.origin), 'Unexpected upload or third-party request')
  console.log(JSON.stringify({ url: target.href, passed: ['HTML/CSS/JS', 'sample', 'image upload and processing', 'IndexedDB reload', 'backup download/import', 'website ZIP', 'three viewport sizes', 'no browser errors', 'no data uploads'], requests: requests.length }, null, 2))
} finally { await browser.close() }
