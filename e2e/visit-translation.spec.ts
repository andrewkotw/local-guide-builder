import { expect, test } from '@playwright/test'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import JSZip from 'jszip'

// Deterministic native-API double: verifies integration, NOT model quality or
// whether a school's browser/device has the language pack available.
test('翻譯、校對、自動恢復、備份匯入與解壓網站的離線語言切換', async ({ page, context }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    Object.defineProperty(window, 'Translator', { configurable: true, value: {
      create: async () => ({ translate: async (text: string) => text.includes('路面') ? 'Please walk carefully.' : 'Enjoy the local stories.', destroy() {} }),
    } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: '先載入練習範例看看' }).click()
  await page.getByRole('button', { name: /2.*中英文介紹/ }).click()
  // Existing English must not be replaced without confirmation.
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: '翻譯蒟蒻：產生兩段英文' }).click()
  await expect(page.getByLabel('推薦原因（英文）')).toHaveValue(/soft evening light/)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '翻譯蒟蒻：產生兩段英文' }).click()
  await expect(page.getByLabel('推薦原因（英文）')).toHaveValue('Enjoy the local stories.')
  await expect(page.getByLabel('參觀提醒（英文／選填）')).toHaveValue('Please walk carefully.')
  await expect(page.getByText(/英文已填入！/)).toBeVisible()
  const english = 'Enjoy the local stories. <script>window.__translationXss=1</script>'
  await page.getByLabel('推薦原因（英文）').fill(english)
  const preview = page.frameLocator('iframe[title="完成網站預覽"]')
  await expect(preview.locator('.note h3')).toContainText('Why We Recommend It')
  await expect(preview.locator('.notice h3')).toContainText('Visitor Tips')
  // Wait for debounced regeneration before testing the iframe's transient state.
  await expect(preview.locator('.note [data-visit-language="en"]')).toHaveText(english)
  await preview.getByRole('button', { name: '翻譯蒟蒻 · Read in English' }).click()
  await expect(preview.locator('.note [data-visit-language="en"]')).toBeVisible()
  await expect(preview.locator('.notice [data-visit-language="en"]')).toBeVisible()
  await expect(preview.locator('.note [data-visit-language="zh-Hant"]')).toBeHidden()
  await expect(page.getByText('已保存在這台電腦')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: /2.*中英文介紹/ }).click()
  await expect(page.getByLabel('推薦原因（英文）')).toHaveValue(english)

  await page.getByRole('button', { name: /3.*照片/ }).click()
  const png = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 16; return canvas.toDataURL().split(',')[1] })
  await page.locator('input[accept*="jpg"]').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  await expect(page.getByText('目前 1 / 8 張')).toBeVisible()
  await page.getByRole('button', { name: /5.*預覽與下載/ }).click()
  const backupEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: '下載可繼續編輯的作品備份' }).click()
  const backupPath = (await (await backupEvent).path())!
  page.on('dialog', (dialog) => dialog.accept())
  await page.locator('input[accept*="localguide"]').setInputFiles(backupPath)
  await expect(page.getByText('作品備份已成功開啟，可以繼續編輯')).toBeVisible()
  await page.getByRole('button', { name: /2.*中英文介紹/ }).click()
  await expect(page.getByLabel('推薦原因（英文）')).toHaveValue(english)
  await expect(page.getByLabel('參觀提醒（英文／選填）')).toHaveValue('Please walk carefully.')
  await page.getByRole('button', { name: /5.*預覽與下載/ }).click()
  for (const checkbox of await page.locator('.privacy input').all()) await checkbox.check()
  const siteEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: '下載交給老師的網站壓縮檔' }).click()
  const zip = await JSZip.loadAsync(await readFile((await (await siteEvent).path())!))
  const saved = JSON.parse(await zip.file('project.json')!.async('string'))
  expect(saved.recommendationEn).toBe(english); expect(saved.noticeEn).toBe('Please walk carefully.')
  const output = testInfo.outputPath('bilingual-site')
  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir) continue
    const destination = path.join(output, name)
    await mkdir(path.dirname(destination), { recursive: true })
    await writeFile(destination, await file.async('nodebuffer'))
  }
  await context.setOffline(true)
  await page.goto(pathToFileURL(path.join(output, 'index.html')).href)
  for (const size of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size)
    const toggle = page.getByRole('button', { name: '翻譯蒟蒻 · Read in English' })
    await toggle.focus(); await page.keyboard.press('Enter')
    await expect(page.locator('.note [data-visit-language="en"]')).toHaveText(english)
    await expect(page.locator('.notice [data-visit-language="en"]')).toBeVisible()
    await expect(page.locator('.note [data-visit-language="zh-Hant"]')).toBeHidden()
    expect(await page.evaluate(() => '__translationXss' in window)).toBe(false)
    expect(await page.locator('html').evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
    await page.locator('#visit-notes').scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath(`bilingual-${size.width}.png`) })
    await page.getByRole('button', { name: '顯示中文 · Read in Chinese' }).click()
    await expect(page.locator('.note [data-visit-language="zh-Hant"]')).toBeVisible()
  }
  expect(errors).toEqual([])
})

test('翻譯失敗或取消保留所有原文，切換步驟不會填入遲到的結果', async ({ page }) => {
  await page.addInitScript(() => {
    let count = 0
    Object.defineProperty(window, 'Translator', { configurable: true, value: {
      create: async () => {
        count += 1
        const slow = count > 1
        return { translate: async () => { if (!slow) throw new Error('ENGLISH_INTERNAL_ERROR'); await new Promise((resolve) => setTimeout(resolve, 1200)); return 'Unexpected late result' }, destroy() {} }
      },
    } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: '先載入練習範例看看' }).click()
  await page.getByRole('button', { name: /2.*中英文介紹/ }).click()
  const original = await page.getByLabel('推薦原因（英文）').inputValue()
  page.on('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '翻譯蒟蒻：產生兩段英文' }).click()
  await expect(page.getByRole('alert')).toContainText('這次沒有完成翻譯')
  await expect(page.locator('body')).not.toContainText('ENGLISH_INTERNAL_ERROR')
  await expect(page.getByLabel('推薦原因（英文）')).toHaveValue(original)
  await page.getByRole('button', { name: '翻譯蒟蒻：產生兩段英文' }).click()
  await expect(page.getByRole('button', { name: '翻譯中，請稍等…' })).toBeDisabled()
  await page.getByRole('button', { name: '取消翻譯' }).click()
  await expect(page.getByText('已取消翻譯，原本的文字沒有改變。')).toBeVisible()
  await page.getByRole('button', { name: '翻譯蒟蒻：產生兩段英文' }).click()
  await page.getByRole('button', { name: /3.*照片/ }).click()
  await page.getByRole('button', { name: /中英文介紹/ }).click()
  // Allow the uncancellable API double to settle; its result must be ignored.
  await page.waitForTimeout(1500)
  await expect(page.getByLabel('推薦原因（英文）')).toHaveValue(original)
})

test('不支援本機翻譯時可手填英文，舊的自動備份仍正常恢復', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'Translator', { configurable: true, value: undefined }) })
  await page.goto('/')
  await page.getByRole('button', { name: '先載入練習範例看看' }).click()
  await expect(page.getByText('已保存在這台電腦')).toBeVisible()
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('local-guide-builder', 1)
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const db = open.result; const tx = db.transaction('projects', 'readwrite'); const store = tx.objectStore('projects'); const get = store.get('current')
        get.onsuccess = () => { const value = get.result; delete value.recommendationEn; delete value.noticeEn; store.put(value, 'current') }
        tx.oncomplete = () => { db.close(); resolve() }; tx.onerror = () => { db.close(); reject(tx.error) }
      }
    })
  })
  await page.reload()
  await page.getByRole('button', { name: /2.*中英文介紹/ }).click()
  await expect(page.getByText(/這個瀏覽器目前沒有本機翻譯功能/)).toBeVisible()
  await expect(page.getByRole('button', { name: '翻譯蒟蒻：產生兩段英文' })).toBeDisabled()
  await expect(page.getByLabel('推薦原因（英文）')).toHaveValue('')
  await expect(page.getByLabel('推薦原因（中文）')).not.toHaveValue('')
  await page.getByLabel('推薦原因（英文）').fill('A nice place to visit.')
  await page.getByLabel('參觀提醒（英文／選填）').fill('Please be careful.')
  await expect(page.frameLocator('iframe[title="完成網站預覽"]').getByRole('button', { name: '翻譯蒟蒻 · Read in English' })).toBeVisible()
})
