import { MAX_CUSTOM_CSS_SIZE, safeCustomCss, validateCustomCss } from './customCss'
import { createSampleProject } from '../data'
import { getSiteCss } from './siteGenerator'
import { parse } from 'postcss'

describe('自訂 CSS', () => {
  it('完整下載包含所有網站區塊，重新上傳不改變內容', () => {
    const p = createSampleProject()
    const css = getSiteCss(p)
    const selectors: string[] = []
    parse(css).walkRules((rule) => { selectors.push(rule.selector) })
    expect(selectors).toEqual(expect.arrayContaining(['.hero', '.gallery', '.highlights', '.reflection-grid', '.lightbox', '.map-embed']))
    expect(css.split('\n').length).toBeGreaterThan(300)
    expect(validateCustomCss(css)).toBeNull()
    p.customCss = css
    p.customCssMode = 'replace'
    expect(getSiteCss(p)).toBe(css)
  })

  it('接受一般 CSS 並拒絕外部資源或 HTML 注入', () => {
    expect(validateCustomCss('body { font-size: 18px; }')).toBeNull()
    expect(validateCustomCss('@import "evil.css";')).toContain('不可載入外部網址')
    expect(validateCustomCss('body { background: url(https://example.com/a.png); }')).toContain('不可載入外部網址')
    expect(validateCustomCss('</style><script>alert(1)</script>')).toContain('不要加入 HTML')
    expect(safeCustomCss('</style><script>alert(1)</script>')).toBe('')
  })

  it('拒絕過大檔案與不完整的大括號', () => {
    expect(validateCustomCss(`/*${'a'.repeat(MAX_CUSTOM_CSS_SIZE)}*/`)).toContain('超過 200KB')
    expect(validateCustomCss('body { color: red;')).toContain('第 1 行')
  })

  it('接受完整版型的選擇器、註解與字串，不誤判大括號和網址註解', () => {
    expect(validateCustomCss('/* https://example.com */ .bilingual > div { content: "} /*"; --color: red; } @media (width < 700px) { .hero { color: var(--color); } }')).toBeNull()
  })

  it.each([
    String.raw`@\69mport "other.css";`,
    String.raw`body { background: u\72l("https://example.com"); }`,
    'body { background: image-set("external.png" 1x); }',
    '@font-face { font-family: custom; src: local(Arial); }',
  ])('拒絕載入資源，即使識別字使用跳脫字元：%s', (css) => {
    expect(validateCustomCss(css)).not.toBeNull()
  })
})
