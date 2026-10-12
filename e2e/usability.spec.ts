import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const viewports = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '390x844', width: 390, height: 844 },
]

for (const viewport of viewports) {
  test(`${viewport.name} 首頁能理解且沒有水平溢出`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: '我的在地小旅行' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '三件事就能完成網站' })).toBeVisible()
    await expect(page.getByText('填文字、放照片，最後下載可交給老師的介紹網站。')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    if (viewport.width === 390) await expect(page.getByLabel('前往其他步驟')).toBeVisible()
    else await expect(page.getByRole('button', { name: /5.*預覽與下載/ })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`home-${viewport.name}.png`), fullPage: false })
  })
}

test('電腦與手機預覽使用不同的真實寬度', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 }); await page.goto('/')
  const frame = page.locator('.preview-frame iframe')
  await expect(frame).toHaveCSS('width', '1100px')
  await page.getByRole('button', { name: '手機版' }).click()
  await expect(frame).toHaveCSS('width', '390px')
  await expect(page.getByText(/目前顯示：手機窄畫面/)).toBeVisible()
})

test('可以一鍵下載、修改、上傳並安全預覽 style.css', async ({ page }) => {
  await page.goto('/'); await page.getByText('進階：用自己的 CSS 調整外觀').click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '一鍵下載 style.css' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('style.css')
  const downloadedPath = await download.path()
  const downloadedCss = await readFile(downloadedPath!, 'utf8')
  expect(downloadedCss).toContain('完整網站樣式')
  expect(downloadedCss).toContain('.gallery')
  expect(downloadedCss).toContain('.reflection-grid')
  expect(downloadedCss).toContain('@media')

  const cssInput = page.locator('input[type=file][accept*=".css"]')
  await cssInput.setInputFiles({ name: 'style.css', mimeType: 'text/css', buffer: Buffer.from('body { font-size: 23px; }') })
  await expect(page.getByText(/已套用：.*style\.css/)).toBeVisible()
  const previewBody = page.frameLocator('iframe[title="完成網站預覽"]').locator('body')
  await expect(previewBody).toHaveCSS('font-size', '23px')

  await cssInput.setInputFiles({ name: '危險.css', mimeType: 'text/css', buffer: Buffer.from('body { background: url(https://example.com/private.png); }') })
  await expect(page.getByText('為了保護隱私，CSS 不可載入外部網址、字型、圖片或其他檔案')).toBeVisible()
  await expect(previewBody).toHaveCSS('font-size', '23px')
})

test('參觀亮點在電腦為三欄、手機為單欄且不會溢出', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 }); await page.goto('/')
  await page.getByRole('button', { name: '先載入練習範例看看' }).click()
  const preview = page.frameLocator('iframe[title="完成網站預覽"]')
  const cards = preview.locator('.highlights ol')
  await expect(preview.getByRole('heading', { name: /參觀亮點/ })).toBeVisible()
  await expect(preview.locator('.highlights li')).toHaveCount(3)
  expect((await cards.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).split(' ')).toHaveLength(3)

  await page.getByRole('button', { name: '手機版' }).click()
  await expect(page.locator('.preview-frame iframe')).toHaveCSS('width', '390px')
  expect((await cards.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).split(' ')).toHaveLength(1)
  expect(await preview.locator('html').evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
})

test('每位組員可以新增、填寫與刪除心得，預覽會即時更新', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '先載入練習範例看看' }).click()
  await page.getByRole('button', { name: /5.*預覽與下載/ }).click()
  await expect(page.getByRole('heading', { name: '小組心得', exact: true }).first()).toBeVisible()
  await expect(page.getByText('不知道怎麼開始？可以挑一、兩題回答：')).toBeVisible()
  await expect(page.locator('.reflection-editor .reflection-card')).toHaveCount(2)

  await page.getByRole('button', { name: '新增下一位組員' }).click()
  await expect(page.locator('.reflection-editor .reflection-card')).toHaveCount(3)
  const lastCard = page.locator('.reflection-editor .reflection-card').last()
  await lastCard.getByLabel('組員暱稱或座號 必填').fill('18 號')
  await lastCard.getByLabel('我的心得 必填').fill('我學會用照片說地方的故事。')
  const preview = page.frameLocator('iframe[title="完成網站預覽"]')
  await expect(preview.locator('#reflections .reflection-card')).toHaveCount(3)
  await expect(preview.locator('#reflections')).toContainText('我學會用照片說地方的故事。')

  await lastCard.getByRole('button', { name: '刪除這份心得' }).click()
  await lastCard.getByRole('button', { name: '再按一次，確定刪除' }).click()
  await expect(page.locator('.reflection-editor .reflection-card')).toHaveCount(2)
})

test('全螢幕預覽會放大預覽區，並可用按鈕或 Escape 關閉', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 }); await page.goto('/')
  const panel = page.getByLabel('網站預覽')
  await page.getByRole('button', { name: '全螢幕預覽' }).click()
  await expect(panel).toHaveClass(/fullscreen-preview/)
  const box = await panel.boundingBox(); expect(box?.width).toBeGreaterThanOrEqual(1365); expect(box?.height).toBeGreaterThanOrEqual(767)
  const frameBox = await panel.locator('iframe').boundingBox(); expect(frameBox?.width).toBeGreaterThanOrEqual(1365)
  await expect(page.getByText(/使用完整瀏覽器寬度/)).toBeVisible()
  await expect(page.getByRole('button', { name: '關閉全螢幕預覽' })).toBeVisible()
  await page.keyboard.press('Escape'); await expect(panel).not.toHaveClass(/fullscreen-preview/)
  await page.getByRole('button', { name: '全螢幕預覽' }).click(); await page.getByRole('button', { name: '關閉全螢幕預覽' }).click()
  await expect(panel).not.toHaveClass(/fullscreen-preview/)
})

test('390x844 可以看見並前往全部五個步驟', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/')
  const selector = page.getByLabel('前往其他步驟')
  for (const [value, heading] of [['0','基本資料'],['1','中英文介紹'],['2','照片'],['3','影片與交通資訊'],['4','預覽與下載']]) {
    await selector.selectOption(value); await expect(page.locator('.step-title h2')).toHaveText(heading); await expect(page.locator('.step-title h2')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
  }
})

test('主要文字與按鈕達到 WCAG AA 對比', async ({ page }) => {
  await page.goto('/')
  // IndexedDB restores asynchronously; wait for the form, not just document load.
  await expect(page.locator('.app-header h1')).toBeVisible()
  const pairs = await page.evaluate(() => ['.app-header h1', '.primary', '.steps .active button'].map((selector) => {
    const element = document.querySelector(selector)!; const style = getComputedStyle(element); return [style.color, style.backgroundColor]
  }))
  const channel = (value: number) => { const normalized = value / 255; return normalized <= .03928 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4 }
  const luminance = (color: string) => { const values = color.match(/[\d.]+/g)!.slice(0, 3).map(Number); return .2126 * channel(values[0]) + .7152 * channel(values[1]) + .0722 * channel(values[2]) }
  for (const [foreground, background] of pairs) { const light = Math.max(luminance(foreground), luminance(background)); const dark = Math.min(luminance(foreground), luminance(background)); expect((light + .05) / (dark + .05)).toBeGreaterThanOrEqual(4.5) }
})

test('自動保存後，重新整理與離開再返回都能找回作品', async ({ page }) => {
  await page.goto('/')
  await page.locator('#field-titleZh input').fill('我的測試景點')
  await expect(page.getByText('正在保存，請稍等…')).toBeVisible()
  await expect(page.getByText('已保存在這台電腦')).toBeVisible()
  await page.reload(); await expect(page.locator('#field-titleZh input')).toHaveValue('我的測試景點')
  await page.goto('about:blank'); await page.goBack(); await expect(page.locator('#field-titleZh input')).toHaveValue('我的測試景點')
})

test('損壞的照片只顯示可操作的中文說明', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: /3.*照片/ }).click()
  await page.locator('input[type=file][accept*="jpg"]').setInputFiles({ name: '壞掉的照片.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not-an-image') })
  await expect(page.getByText(/壞掉的照片.*這張照片讀不到/)).toBeVisible()
  await expect(page.getByText('The source image could not be decoded.')).toHaveCount(0)
})

test('會覆蓋目前作品的範例需要確認兩次', async ({ page }) => {
  await page.goto('/'); await page.locator('#field-titleZh input').fill('不能直接被蓋掉')
  await page.getByText('作品管理與備份').click()
  let confirmations = 0
  page.on('dialog', async (dialog) => { confirmations += 1; await dialog.accept() })
  await page.getByRole('button', { name: '載入練習範例' }).click()
  await expect(page.locator('#field-titleZh input')).toHaveValue('清風老街')
  expect(confirmations).toBe(2)
})

test('鍵盤焦點有清楚外框，切換步驟後焦點到新標題', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: /2.*中英文介紹/ }).focus(); await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: '中英文介紹' })).toBeFocused()
  const outline = await page.getByRole('heading', { name: '中英文介紹' }).evaluate((element) => getComputedStyle(element).outlineStyle)
  expect(outline).not.toBe('none')
})

test('主要操作不會留下 console error 或未處理的頁面例外', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/'); await page.getByRole('button', { name: '先載入練習範例看看' }).click()
  for (const name of [/2.*中英文介紹/, /3.*照片/, /4.*影片與交通資訊/, /5.*預覽與下載/]) await page.getByRole('button', { name }).click()
  await page.getByRole('button', { name: '手機版' }).click(); await page.getByRole('button', { name: '立即更新' }).click()
  expect(errors).toEqual([])
})

test('IndexedDB 無法使用時會提供中文替代提示', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { configurable: true, value: undefined }) })
  await page.goto('/')
  await expect(page.getByText('目前無法讀取自動備份，但你仍可繼續製作')).toBeVisible()
  await page.locator('#field-titleZh input').fill('仍可編輯')
  await expect(page.getByText('沒有成功保存')).toBeVisible()
  await expect(page.getByText('請下載作品備份，避免遺失')).toBeVisible()
})
