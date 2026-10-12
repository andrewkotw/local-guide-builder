import { expect, test } from '@playwright/test'
import JSZip from 'jszip'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { MAX_IMAGE_SIZE } from '../src/utils/photo'

async function pngBuffer(page: import('@playwright/test').Page, width: number, height: number, transparent = false): Promise<Buffer> {
  const base64 = await page.evaluate(({ width, height, transparent }) => {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
    const context = canvas.getContext('2d')!
    if (!transparent) { context.fillStyle = '#276f49'; context.fillRect(0, 0, width, height); context.fillStyle = '#f5c451'; context.fillRect(0, 0, Math.max(1, width / 3), height) }
    return canvas.toDataURL('image/png').split(',')[1]
  }, { width, height, transparent })
  return Buffer.from(base64, 'base64')
}

async function goToPhotos(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /3.*照片/ }).click()
}

test('大尺寸、直式、透明與同名照片都能處理，刪除後可重新上傳', async ({ page }) => {
  await page.goto('/'); await goToPhotos(page)
  const large = await pngBuffer(page, 3000, 2000)
  const portrait = await pngBuffer(page, 800, 2200)
  const transparent = await pngBuffer(page, 120, 80, true)
  const files = [
    { name: '中文 大照片（完成版）#1.png', mimeType: 'image/png', buffer: large },
    { name: 'English photo (final) & copy.png', mimeType: 'image/png', buffer: portrait },
    { name: '同名 照片 (1) #.png', mimeType: 'image/png', buffer: transparent },
    { name: '同名 照片 (1) #.png', mimeType: 'image/png', buffer: transparent },
  ]
  const input = page.locator('input[type=file][accept*="jpg"]')
  await input.setInputFiles(files); await expect(page.getByText('目前 4 / 8 張')).toBeVisible()
  for (const name of files.map((file) => file.name)) await expect(page.getByText(`原始檔名：${name}`, { exact: true }).first()).toBeVisible()
  const sizes = await page.locator('.photo-card img').evaluateAll((images) => images.map((image) => ({ width: (image as HTMLImageElement).naturalWidth, height: (image as HTMLImageElement).naturalHeight })))
  expect(sizes[0]).toEqual({ width: 1600, height: 1067 }); expect(sizes[1]).toEqual({ width: 582, height: 1600 })
  const transparentPixel = await page.locator('.photo-card img').nth(2).evaluate((image) => {
    const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1; const context = canvas.getContext('2d')!; context.drawImage(image as HTMLImageElement, 0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data]
  })
  expect(transparentPixel.slice(0, 3).every((channel) => channel > 245)).toBe(true)
  await page.locator('.photo-card').first().getByRole('button', { name: '刪除照片' }).click()
  await page.locator('.photo-card').first().getByRole('button', { name: '再按一次，確定刪除' }).click()
  await expect(page.getByText('目前 3 / 8 張')).toBeVisible()
  await input.setInputFiles(files[0]); await expect(page.getByText('目前 4 / 8 張')).toBeVisible(); await expect(page.getByText(`原始檔名：${files[0].name}`, { exact: true })).toBeVisible()
})

test('不支援、過大與損壞圖片會顯示可修正的中文錯誤', async ({ page }) => {
  await page.goto('/'); await goToPhotos(page); const input = page.locator('input[type=file][accept*="jpg"]')
  await input.setInputFiles({ name: '向量圖片.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') }); await expect(page.getByText(/向量圖片\.svg：請選擇 JPG、PNG 或 WebP/)).toBeVisible()
  await input.setInputFiles({ name: '太大的照片.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(MAX_IMAGE_SIZE + 1) }); await expect(page.getByText(/太大的照片\.jpg：這張照片超過 15MB/)).toBeVisible()
  await input.setInputFiles({ name: '損壞照片.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('broken') }); await expect(page.getByText(/損壞照片\.jpg：這張照片讀不到/)).toBeVisible()
})

test('含照片的作品可下載、清除後匯入，並在重新整理後從 IndexedDB 恢復', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '先載入練習範例看看' }).click(); await goToPhotos(page)
  const png = await pngBuffer(page, 640, 480); await page.locator('input[type=file][accept*="jpg"]').setInputFiles({ name: '備份 測試（中文）#.png', mimeType: 'image/png', buffer: png }); await expect(page.getByText('目前 1 / 8 張')).toBeVisible()
  await page.getByRole('button', { name: /5.*預覽與下載/ }).click()
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: '下載可繼續編輯的作品備份' }).click(); const download = await downloadPromise; const backupPath = await download.path(); expect(backupPath).toBeTruthy()
  await page.evaluate(() => new Promise<void>((resolve, reject) => { const request = indexedDB.deleteDatabase('local-guide-builder'); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error) }))
  await page.reload(); await expect(page.locator('#field-titleZh input')).toHaveValue('')
  await page.locator('input[type=file][accept*="localguide"]').setInputFiles(backupPath!); await expect(page.locator('#field-titleZh input')).toHaveValue('清風老街'); await goToPhotos(page); await expect(page.getByText('原始檔名：備份 測試（中文）#.png')).toBeVisible()
  await expect(page.getByText('已保存在這台電腦')).toBeVisible(); await page.reload(); await goToPhotos(page); await expect(page.getByText('原始檔名：備份 測試（中文）#.png')).toBeVisible()
})

test('網站 ZIP 解壓後可直接開啟，CSS、圖片、本機影片與安全文字皆正確', async ({ page }, testInfo) => {
  await page.goto('/'); await page.getByRole('button', { name: '先載入練習範例看看' }).click()
  await page.getByRole('button', { name: /1.*基本資料/ }).click(); const malicious = `<script>window.__studentScriptRan=true</script>`; await page.locator('#field-titleZh input').fill(malicious)
  await goToPhotos(page); const png = await pngBuffer(page, 900, 600); await page.locator('input[type=file][accept*="jpg"]').setInputFiles([
    { name: '同名 photo (1) #.png', mimeType: 'image/png', buffer: png }, { name: '同名 photo (1) #.png', mimeType: 'image/png', buffer: png },
  ]); await expect(page.getByText('目前 2 / 8 張')).toBeVisible()
  await page.getByRole('button', { name: /4.*影片與交通資訊/ }).click(); await page.getByLabel('選擇本機 MP4 影片').check(); await page.locator('input[type=file][accept*="mp4"]').setInputFiles({ name: '介紹 影片（最終）#1.mp4', mimeType: 'video/mp4', buffer: Buffer.from('test-mp4') }); await page.locator('#field-mapsUrl input').fill('https://maps.app.goo.gl/AbCdEf123')
  await page.getByRole('button', { name: /5.*預覽與下載/ }).click()
  for (const label of ['我沒有填寫組員的電話、住址或私人帳號','我確認照片與影片可以用於課堂網站','我知道網站發布後，取得網址的人可能看到內容','我已檢查是否拍到不適合公開的個人資料']) await page.getByLabel(label).check()
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: '下載交給老師的網站壓縮檔' }).click(); const zipDownload = await downloadPromise; const zipPath = await zipDownload.path(); const zip = await JSZip.loadAsync(await (await import('node:fs/promises')).readFile(zipPath!))
  const output = testInfo.outputPath('opened-site'); await mkdir(output, { recursive: true })
  for (const [name, entry] of Object.entries(zip.files)) { if (entry.dir) continue; const destination = path.resolve(output, name); expect(destination.startsWith(path.resolve(output))).toBe(true); await mkdir(path.dirname(destination), { recursive: true }); await writeFile(destination, await entry.async('nodebuffer')) }
  const pageErrors: Error[] = []; page.on('pageerror', (error) => pageErrors.push(error)); await page.setViewportSize({ width: 390, height: 844 }); await page.goto(pathToFileURL(path.join(output, 'index.html')).href)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(malicious); expect(await page.evaluate(() => (window as Window & { __studentScriptRan?: boolean }).__studentScriptRan)).toBeUndefined()
  expect(await page.evaluate(() => document.styleSheets.length)).toBeGreaterThan(0); expect(await page.locator('body').evaluate((body) => getComputedStyle(body).fontSize)).toBe('17px')
  await expect(page.locator('.gallery img')).toHaveCount(2); for (const image of await page.locator('.gallery img').all()) { await expect(image).toHaveJSProperty('complete', true); expect(await image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0) }
  await page.getByRole('button', { name: /放大檢視/ }).first().click(); const lightbox = page.getByRole('dialog', { name: '照片放大檢視' }); await expect(lightbox).toBeVisible(); await expect(lightbox.locator('img')).toHaveAttribute('src', 'images/photo-01.jpg'); await page.keyboard.press('Escape'); await expect(lightbox).not.toBeVisible()
  await expect(page.locator('video')).toHaveAttribute('src', 'media/video.mp4'); expect(pageErrors).toEqual([])
  await expect(page.locator('.map-embed iframe')).toHaveAttribute('src', /https:\/\/maps\.google\.com\/maps\?q=.*output=embed/)
  await expect(page.getByRole('link', { name: '在 Google Maps 開啟（另開視窗）' })).toHaveAttribute('href', 'https://maps.app.goo.gl/AbCdEf123')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
})

test('匯入格式錯誤的作品不會蓋掉目前內容或顯示英文例外', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '先載入練習範例看看' }).click()
  const malformed = new JSZip(); malformed.file('project.json', JSON.stringify({ version: 1, photos: [] }))
  const buffer = await malformed.generateAsync({ type: 'nodebuffer' })
  page.on('dialog', (dialog) => dialog.accept())
  await page.locator('input[type=file][accept*="localguide"]').setInputFiles({ name: '錯誤作品.localguide', mimeType: 'application/zip', buffer })
  await expect(page.locator('#field-titleZh input')).toHaveValue('清風老街')
  await expect(page.getByText('這份作品備份缺少必要的文字欄位，請重新下載備份')).toBeVisible()
})

test('YouTube 網站在本機檔案模式不顯示 Error 153，發布後才建立播放器', async ({ page }, testInfo) => {
  await page.goto('/'); await page.getByRole('button', { name: '先載入練習範例看看' }).click(); await goToPhotos(page)
  const png = await pngBuffer(page, 640, 480); await page.locator('input[type=file][accept*="jpg"]').setInputFiles({ name: '影片網站封面.png', mimeType: 'image/png', buffer: png })
  await page.getByRole('button', { name: /4.*影片與交通資訊/ }).click(); await page.locator('#field-youtubeUrl input').fill('https://youtu.be/dQw4w9WgXcQ')
  await page.getByRole('button', { name: /5.*預覽與下載/ }).click()
  for (const label of ['我沒有填寫組員的電話、住址或私人帳號','我確認照片與影片可以用於課堂網站','我知道網站發布後，取得網址的人可能看到內容','我已檢查是否拍到不適合公開的個人資料']) await page.getByLabel(label).check()
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: '下載交給老師的網站壓縮檔' }).click(); const zipPath = await (await downloadPromise).path(); const zip = await JSZip.loadAsync(await (await import('node:fs/promises')).readFile(zipPath!))
  const output = testInfo.outputPath('youtube-site'); await mkdir(output, { recursive: true })
  for (const [name, entry] of Object.entries(zip.files)) { if (entry.dir) continue; const destination = path.resolve(output, name); await mkdir(path.dirname(destination), { recursive: true }); await writeFile(destination, await entry.async('nodebuffer')) }

  await page.goto(pathToFileURL(path.join(output, 'index.html')).href)
  await expect(page.locator('iframe')).toHaveCount(0)
  await expect(page.getByText('直接從電腦開啟時，YouTube 不允許嵌入播放。')).toBeVisible()
  await expect(page.getByRole('link', { name: '在 YouTube 開啟影片（另開視窗）' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')

  const relativeUrl = path.relative(process.cwd(), path.join(output, 'index.html')).split(path.sep).map(encodeURIComponent).join('/')
  await page.goto(`/${relativeUrl}`)
  await expect(page.locator('iframe')).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?origin=/)
})
