import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { buildClassIndex } from './index.mjs'

async function addGroup(root, folder, overrides = {}) {
  const groupDir = path.join(root, 'groups', folder)
  await mkdir(path.join(groupDir, 'images'), { recursive: true })
  const info = {
    schemaVersion: 1,
    titleZh: '海風步道',
    titleEn: 'Sea Breeze Trail',
    type: '景點',
    groupName: '海風組',
    coverImage: 'images/cover.svg',
    summary: '沿著海邊散步，觀察潮間帶生物。',
    ...overrides,
  }
  await writeFile(path.join(groupDir, 'site-info.json'), JSON.stringify(info), 'utf8')
  await writeFile(path.join(groupDir, 'index.html'), '<!doctype html><title>group</title><h1>group</h1>', 'utf8')
  await writeFile(path.join(groupDir, 'images', 'cover.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>', 'utf8')
}

test('整合三組網站、按類型分組，並讓單一錯誤組不影響產生結果', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'class-index-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await addGroup(root, '01-sea-trail')
  await addGroup(root, '02-night-market', { titleZh: '幸福夜市', titleEn: 'Happy Night Market', type: '美食', groupName: '美食偵探', summary: '認識市場裡的在地小吃。' })
  await addGroup(root, '03-old-temple', { titleZh: '晨光廟', titleEn: 'Morning Temple', type: '廟宇', groupName: '古蹟觀察隊', summary: '從建築裝飾認識地方信仰。' })
  await addGroup(root, '04-broken', { coverImage: 'images/missing.jpg' })

  const result = await buildClassIndex(root)
  assert.equal(result.groups.length, 3)
  assert.equal(result.skippedGroups.length, 1)
  assert.equal(result.skippedGroups[0].folder, '04-broken')
  assert.match(result.skippedGroups[0].errors.join(' '), /找不到封面圖片/)

  const html = await readFile(path.join(root, 'index.html'), 'utf8')
  assert.match(html, />景點</)
  assert.match(html, />美食</)
  assert.match(html, />廟宇</)
  assert.equal((html.match(/<article class="site-card">/g) ?? []).length, 3)
  assert.match(html, /groups\/01-sea-trail\/index\.html/)
  assert.doesNotMatch(html, /04-broken/)

  const report = JSON.parse(await readFile(path.join(root, 'class-index-report.json'), 'utf8'))
  assert.equal(report.schemaVersion, 1)
  assert.equal(report.validGroupCount, 3)
  assert.equal(report.skippedGroupCount, 1)
})

test('學生文字會被安全轉義，資料夾與圖片路徑會安全編碼', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'class-index-safe-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await addGroup(root, '第一組 網站', { titleZh: '<script>alert(1)</script>', summary: '<img src=x onerror=alert(1)>' })

  await buildClassIndex(root)
  const html = await readFile(path.join(root, 'index.html'), 'utf8')
  assert.doesNotMatch(html, /<script>alert/)
  assert.doesNotMatch(html, /<img src=x/)
  assert.match(html, /&lt;script&gt;/)
  assert.match(html, /groups\/%E7%AC%AC%E4%B8%80%E7%B5%84%20%E7%B6%B2%E7%AB%99\/index\.html/)
})

test('格式錯誤會指出欄位與修正方法，但仍會產生空白首頁', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'class-index-invalid-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const groupDir = path.join(root, 'groups', 'bad-json')
  await mkdir(groupDir, { recursive: true })
  await writeFile(path.join(groupDir, 'site-info.json'), '{not json}', 'utf8')

  const result = await buildClassIndex(root)
  assert.equal(result.groups.length, 0)
  assert.equal(result.skippedGroups.length, 1)
  assert.match(result.skippedGroups[0].errors.join(' '), /重新匯出|重新解壓縮/)
  assert.equal(await readFile(path.join(root, 'index.html'), 'utf8').then((html) => html.includes('還沒有可顯示的網站')), true)
})
