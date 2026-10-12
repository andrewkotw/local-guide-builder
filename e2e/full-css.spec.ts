import { expect, test } from '@playwright/test'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import JSZip from 'jszip'

test('Material Flat 完整樣式可取代、備份還原，匯出後與預覽一致', async ({ page }, testInfo) => {
  const css = await readFile('e2e/fixtures/material-flat.css', 'utf8')
  await page.goto('/')
  await page.getByRole('button', { name: '先載入練習範例看看' }).click()
  await page.locator('.custom-css-panel summary').click()
  await page.locator('input[accept=".css,text/css"]').setInputFiles({ name: 'material-flat.css', mimeType: 'text/css', buffer: Buffer.from(css) })
  await expect(page.locator('.css-file-status')).toContainText('material-flat.css')
  const preview = page.frameLocator('iframe[title="完成網站預覽"]')
  await expect(preview.locator('.hero nav')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(preview.locator('body')).toHaveCSS('font-size', '16px')
  // These declarations/pseudo-elements existed only in the old default theme.
  await expect(preview.locator('.highlights')).toHaveCSS('box-shadow', 'none')
  expect(await preview.locator('.highlights').evaluate((element) => getComputedStyle(element, '::after').content)).toBe('none')
  await expect(preview.locator('html')).toHaveCSS('--accent', '#1967d2')

  const cssDownloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: '一鍵下載 style.css' }).click()
  expect(await readFile((await (await cssDownloadEvent).path())!, 'utf8')).toBe(css)

  await page.getByRole('button', { name: /3.*照片/ }).click()
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#1967d2'; ctx.fillRect(0, 0, 640, 480)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await page.locator('input[accept*="jpg"]').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') })
  await expect(page.getByText('目前 1 / 8 張')).toBeVisible()
  await page.getByRole('button', { name: /5.*預覽與下載/ }).click()
  const backupEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: '下載可繼續編輯的作品備份' }).click()
  const backupPath = (await (await backupEvent).path())!
  page.on('dialog', (dialog) => dialog.accept())
  await page.locator('input[accept*="localguide"]').setInputFiles(backupPath)
  await expect(page.getByText('作品備份已成功開啟，可以繼續編輯')).toBeVisible()
  await expect(page.getByText('已保存在這台電腦')).toBeVisible()
  await page.reload()
  await expect(preview.locator('.highlights')).toHaveCSS('box-shadow', 'none')
  await expect(preview.locator('html')).toHaveCSS('--accent', '#1967d2')
  await page.getByRole('button', { name: '手機版', exact: true }).click()
  await expect(preview.locator('.reflection-grid')).toHaveCSS('grid-template-columns', /^(?!.* ).+px$/)
  expect(await preview.locator('html').evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
  await page.getByRole('button', { name: /5.*預覽與下載/ }).click()
  for (const checkbox of await page.locator('.privacy input').all()) await checkbox.check()
  const siteEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: '下載交給老師的網站壓縮檔' }).click()
  const zip = await JSZip.loadAsync(await readFile((await (await siteEvent).path())!))
  expect(await zip.file('style.css')!.async('string')).toBe(css)
  const project = JSON.parse(await zip.file('project.json')!.async('string'))
  expect(project.customCssMode).toBe('replace'); expect(project.customCss).toBe(css)
  const output = testInfo.outputPath('material-flat-site')
  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir) continue
    const destination = path.join(output, name)
    await mkdir(path.dirname(destination), { recursive: true })
    await writeFile(destination, await file.async('nodebuffer'))
  }
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto(pathToFileURL(path.join(output, 'index.html')).href)
  await page.getByRole('button', { name: '翻譯蒟蒻 · Read in English' }).click()
  await expect(page.locator('.note [data-visit-language="en"]')).toBeVisible()
  await expect(page.locator('.notice [data-visit-language="en"]')).toBeVisible()
  await expect(page.locator('.note [data-visit-language="zh-Hant"]')).toBeHidden()
  await page.getByRole('button', { name: '顯示中文 · Read in Chinese' }).click()
  await expect(page.locator('.highlights')).toHaveCSS('box-shadow', 'none')
  await expect(page.locator('.hero nav')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await page.screenshot({ path: testInfo.outputPath('material-desktop.png') })
  await page.getByRole('button', { name: /放大檢視/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('.highlights').scrollIntoViewIfNeeded()
  expect(await page.locator('html').evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: testInfo.outputPath('material-mobile.png') })
})
