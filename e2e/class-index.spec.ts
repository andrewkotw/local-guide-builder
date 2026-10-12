import { expect, test } from '@playwright/test'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

test('三組範例會出現在班級首頁，且卡片可進入各組網站', async ({ page }) => {
  const indexUrl = pathToFileURL(path.resolve('examples/class-sites/index.html')).href
  await page.goto(indexUrl)

  await expect(page.getByRole('heading', { name: '班級在地小旅行作品集' })).toBeVisible()
  await expect(page.locator('.site-card')).toHaveCount(3)
  await expect(page.getByRole('heading', { name: '景點', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '美食', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '廟宇', exact: true })).toBeVisible()

  const imagesLoaded = await page.locator('.site-card img').evaluateAll((images) => images.every((image) => (image as HTMLImageElement).naturalWidth > 0))
  expect(imagesLoaded).toBe(true)

  await page.getByRole('link', { name: '前往海風步道網站' }).click()
  await expect(page.getByRole('heading', { name: '海風步道' })).toBeVisible()
})
