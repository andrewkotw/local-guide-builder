import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const TYPE_ORDER = ['景點', '美食', '廟宇', '歷史文化', '其他']
const REQUIRED_TEXT_FIELDS = {
  titleZh: '中文名稱',
  titleEn: '英文名稱',
  type: '類型',
  groupName: '小組名稱',
  coverImage: '封面圖片路徑',
  summary: '一句介紹',
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char])
}

function webPath(...parts) {
  return parts.flatMap((part) => part.replace(/\\/g, '/').split('/')).filter(Boolean).map(encodeURIComponent).join('/')
}

function validateRelativePath(value) {
  if (!value || value.includes('\\') || value.includes('\0')) return false
  if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('/') || value.startsWith('//')) return false
  const segments = value.split('/')
  return segments.every((segment) => segment && segment !== '.' && segment !== '..')
}

async function exists(filePath) {
  try { await access(filePath); return true } catch { return false }
}

async function inspectGroup(groupsDir, entry) {
  const groupDir = path.join(groupsDir, entry.name)
  const errors = []
  const infoPath = path.join(groupDir, 'site-info.json')
  const indexPath = path.join(groupDir, 'index.html')
  let info

  if (!(await exists(infoPath))) {
    errors.push('找不到 site-info.json。請重新解壓縮學生交來的 ZIP，並確認沒有只複製 index.html。')
  } else {
    try {
      info = JSON.parse(await readFile(infoPath, 'utf8'))
    } catch {
      errors.push('site-info.json 不是有效格式。請用學生重新匯出的 ZIP 替換這個資料夾。')
    }
  }

  if (info !== undefined) {
    if (!info || typeof info !== 'object' || Array.isArray(info)) {
      errors.push('site-info.json 的內容不是網站資料。請重新匯出學生網站。')
    } else {
      if (info.schemaVersion !== 1) errors.push('site-info.json 的 schemaVersion 必須是 1。請用最新版網站產生器重新匯出。')
      for (const [field, label] of Object.entries(REQUIRED_TEXT_FIELDS)) {
        if (typeof info[field] !== 'string' || !info[field].trim()) errors.push(`${label}（${field}）沒有填寫。請回到學生專案補填後重新匯出。`)
      }
      if (typeof info.type === 'string' && !TYPE_ORDER.includes(info.type)) errors.push(`類型「${info.type}」不在允許清單中，請改為：${TYPE_ORDER.join('、')}。`)
      if (typeof info.coverImage === 'string' && info.coverImage.trim()) {
        if (!validateRelativePath(info.coverImage)) {
          errors.push('封面圖片路徑不安全。請勿修改 site-info.json，改用學生重新匯出的 ZIP。')
        } else if (!(await exists(path.join(groupDir, ...info.coverImage.split('/'))))) {
          errors.push(`找不到封面圖片「${info.coverImage}」。請確認 images 資料夾完整，或重新解壓縮 ZIP。`)
        }
      }
    }
  }

  if (!(await exists(indexPath))) errors.push('找不到 index.html。請重新解壓縮學生交來的完整 ZIP。')
  if (errors.length) return { folder: entry.name, errors }

  return {
    folder: entry.name,
    info: {
      schemaVersion: 1,
      titleZh: info.titleZh.trim(),
      titleEn: info.titleEn.trim(),
      type: info.type,
      groupName: info.groupName.trim(),
      coverImage: info.coverImage.trim(),
      summary: info.summary.trim(),
    },
  }
}

function createHtml(groups) {
  const sections = TYPE_ORDER.map((type) => {
    const members = groups.filter((group) => group.info.type === type)
    if (!members.length) return ''
    const cards = members.map(({ folder, info }) => {
      const href = webPath('groups', folder, 'index.html')
      const image = webPath('groups', folder, info.coverImage)
      return `<article class="site-card">
        <a href="${escapeHtml(href)}" aria-label="前往${escapeHtml(info.titleZh)}網站">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(info.titleZh)}的封面照片" loading="lazy" decoding="async">
          <div class="card-body">
            <span class="type-badge">${escapeHtml(info.type)}</span>
            <h3>${escapeHtml(info.titleZh)}</h3>
            <p class="english-name" lang="en">${escapeHtml(info.titleEn)}</p>
            <p>${escapeHtml(info.summary)}</p>
            <p class="group-name">製作小組：${escapeHtml(info.groupName)}</p>
            <span class="visit">查看網站 <span aria-hidden="true">→</span></span>
          </div>
        </a>
      </article>`
    }).join('\n')
    return `<section class="category" aria-labelledby="category-${TYPE_ORDER.indexOf(type)}">
      <div class="section-title"><h2 id="category-${TYPE_ORDER.indexOf(type)}">${escapeHtml(type)}</h2><span>${members.length} 組</span></div>
      <div class="card-grid">${cards}</div>
    </section>`
  }).filter(Boolean).join('\n')

  const content = sections || '<section class="empty"><h2>還沒有可顯示的網站</h2><p>請把各組解壓縮後的資料夾放進 <code>groups</code>，再重新執行產生指令。</p></section>'
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="班級在地景點網站作品集">
  <title>班級在地小旅行作品集</title>
  <link rel="stylesheet" href="class-style.css">
</head>
<body>
  <a class="skip-link" href="#works">跳到作品列表</a>
  <header class="hero"><div class="hero-inner"><p class="eyebrow">我們的在地觀察</p><h1>班級在地小旅行作品集</h1><p>一起看看同學介紹的景點、美食、廟宇與地方故事。</p><span class="count">共 ${groups.length} 組作品</span></div></header>
  <main id="works">${content}</main>
  <footer><p>本頁由班級網站首頁產生器建立。各組作品內容由學生小組製作。</p></footer>
</body>
</html>`
}

const CLASS_CSS = `:root{font-family:system-ui,-apple-system,"Segoe UI","Microsoft JhengHei",sans-serif;color:#17231c;background:#f4f7f3;line-height:1.65;font-size:16px}*{box-sizing:border-box}body{margin:0}.skip-link{position:absolute;left:1rem;top:-5rem;background:#fff;color:#123f2c;padding:.75rem 1rem;border:3px solid #123f2c;border-radius:.5rem;z-index:10}.skip-link:focus{top:1rem}.hero{background:linear-gradient(135deg,#123f2c,#25724f);color:#fff;padding:4rem 1.25rem 3.25rem}.hero-inner,main{width:min(1160px,100%);margin:auto}.eyebrow{font-weight:800;letter-spacing:.15em;margin:0 0 .35rem}.hero h1{font-size:clamp(2rem,5vw,3.5rem);line-height:1.15;margin:.15rem 0 .8rem}.hero p{max-width:48rem;font-size:1.1rem}.count{display:inline-block;background:#fff;color:#123f2c;border-radius:999px;padding:.35rem .9rem;font-weight:800}main{padding:2.5rem 1.25rem 4rem}.category{margin-bottom:3rem}.section-title{display:flex;align-items:baseline;gap:.75rem;border-bottom:3px solid #bfd7c8;margin-bottom:1.25rem}.section-title h2{font-size:1.8rem;margin:0}.section-title span{color:#4d6256;font-weight:700}.card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.25rem}.site-card{background:#fff;border:1px solid #cfd9d2;border-radius:1rem;overflow:hidden;box-shadow:0 5px 18px #1d3f2920}.site-card a{color:inherit;text-decoration:none;display:block;height:100%}.site-card a:hover{transform:translateY(-2px)}.site-card a:focus-visible{outline:4px solid #f1a43c;outline-offset:4px}.site-card img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;background:#dfe8e1}.card-body{padding:1.15rem}.type-badge{display:inline-block;padding:.18rem .65rem;border-radius:999px;background:#dcece1;color:#174a33;font-weight:800}.site-card h3{font-size:1.45rem;line-height:1.25;margin:.7rem 0 .1rem}.english-name{color:#526159;margin:.1rem 0 .65rem;font-weight:650}.group-name{color:#44544a;font-size:.95rem}.visit{color:#0b5d39;font-weight:850}.empty{background:#fff;border:2px dashed #9caea1;border-radius:1rem;padding:2rem;text-align:center}code{background:#e5ece7;padding:.1rem .35rem;border-radius:.25rem}footer{background:#17231c;color:#fff;padding:1.5rem;text-align:center}@media(max-width:520px){.hero{padding:3rem 1rem 2.5rem}main{padding:2rem 1rem}.card-grid{grid-template-columns:1fr}.site-card h3{font-size:1.35rem}}@media(prefers-reduced-motion:no-preference){.site-card a{transition:transform .16s ease}}`

export async function buildClassIndex(classRoot = path.resolve('class-sites')) {
  const root = path.resolve(classRoot)
  const groupsDir = path.join(root, 'groups')
  await mkdir(groupsDir, { recursive: true })
  const entries = (await readdir(groupsDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))

  const inspected = []
  for (const entry of entries) inspected.push(await inspectGroup(groupsDir, entry))
  const validGroups = inspected.filter((item) => item.info)
  const skippedGroups = inspected.filter((item) => item.errors).map(({ folder, errors }) => ({ folder, errors }))
  validGroups.sort((a, b) => TYPE_ORDER.indexOf(a.info.type) - TYPE_ORDER.indexOf(b.info.type) || a.info.titleZh.localeCompare(b.info.titleZh, 'zh-Hant'))

  await writeFile(path.join(root, 'index.html'), createHtml(validGroups), 'utf8')
  await writeFile(path.join(root, 'class-style.css'), CLASS_CSS, 'utf8')
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    validGroupCount: validGroups.length,
    skippedGroupCount: skippedGroups.length,
    validGroups: validGroups.map(({ folder, info }) => ({ folder, ...info })),
    skippedGroups,
  }
  await writeFile(path.join(root, 'class-index-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  return { root, groups: validGroups, skippedGroups, report }
}

async function runCli() {
  const target = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve('class-sites')
  const result = await buildClassIndex(target)
  console.log(`\n班級首頁已產生：${path.join(result.root, 'index.html')}`)
  console.log(`成功加入 ${result.groups.length} 組；跳過 ${result.skippedGroups.length} 組。`)
  for (const skipped of result.skippedGroups) {
    console.warn(`\n[需要修正] ${skipped.folder}`)
    for (const error of skipped.errors) console.warn(`  - ${error}`)
  }
  console.log(`\n檢查紀錄：${path.join(result.root, 'class-index-report.json')}`)
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  runCli().catch((error) => {
    console.error(`無法產生班級首頁：${error instanceof Error ? error.message : '未知錯誤'}`)
    process.exitCode = 1
  })
}
