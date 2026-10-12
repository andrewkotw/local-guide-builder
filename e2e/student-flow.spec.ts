import { expect, test } from '@playwright/test'

test('學生可以載入範例、上傳圖片、切換預覽並下載', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 }); await page.goto('/'); await page.getByRole('button', { name: '先載入練習範例看看' }).click()
  await expect(page.locator('input[value="清風老街"]')).toBeVisible()
  await page.getByRole('button', { name: /照片$/ }).click()
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
  await page.locator('input[type=file][accept*="jpg"]').setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByText('目前 1 / 8 張')).toBeVisible()
  await page.getByRole('button', { name: '手機版' }).click(); await page.getByRole('button', { name: '立即更新' }).click()
  await page.getByRole('button', { name: /5.*預覽與下載/ }).click()
  const backup = page.waitForEvent('download'); await page.getByRole('button', { name: '下載可繼續編輯的作品備份' }).click(); expect((await backup).suggestedFilename()).toMatch(/\.localguide$/)
  for (const label of ['我沒有填寫組員的電話、住址或私人帳號','我確認照片與影片可以用於課堂網站','我知道網站發布後，取得網址的人可能看到內容','我已檢查是否拍到不適合公開的個人資料']) await page.getByLabel(label).check()
  const downloads: import('@playwright/test').Download[] = []; page.on('download', (download) => downloads.push(download))
  const website = page.waitForEvent('download'); const websiteButton = page.getByRole('button', { name: '下載交給老師的網站壓縮檔' })
  await websiteButton.evaluate((button) => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  expect((await website).suggestedFilename()).toBe('歷史文化-Breeze-Old-Street-清風探索隊.zip')
  await expect.poll(() => downloads.length).toBe(1)
})
