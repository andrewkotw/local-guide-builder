import { parse, CssSyntaxError } from 'postcss'
import type { ChildNode } from 'postcss'

export const MAX_CUSTOM_CSS_SIZE = 200 * 1024
const RESOURCE_ERROR = '為了保護隱私，CSS 不可載入外部網址、字型、圖片或其他檔案'

// Decode escaped identifiers before checking resource-loading constructs.
function decoded(value: string): string {
  return value.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\\([0-9a-f]{1,6})\s?|\\([^\r\n])/gi, (_match, hex: string | undefined, char: string) => {
    if (!hex) return char
    const code = parseInt(hex, 16)
    return String.fromCodePoint(code === 0 || code > 0x10ffff ? 0xfffd : code)
  }).toLowerCase()
}

export function validateCustomCss(css: string): string | null {
  if (!css.trim()) return '這份 CSS 沒有內容，請確認是否選到正確檔案'
  if (new TextEncoder().encode(css).byteLength > MAX_CUSTOM_CSS_SIZE) return 'CSS 檔案超過 200KB，請刪除不需要的內容後再試一次'
  if (/<\/?(?:style|script|iframe|html|body)\b/i.test(css)) return '請只上傳 CSS 樣式，不要加入 HTML 標籤或 JavaScript'
  try {
    const root = parse(css, { from: undefined, map: false })
    let resourceError = false
    root.walk((node) => {
      if (node.type === 'comment') return
      if (node.type === 'atrule' && ['import', 'font-face', 'namespace'].includes(decoded(node.name))) resourceError = true
      if (node.type === 'decl' && /^(?:behavior|-moz-binding|src)$/.test(decoded(node.prop))) resourceError = true
      const value = node.type === 'decl' ? node.value : node.type === 'atrule' ? node.params : ''
      if (/(?:url|(?:-webkit-)?image-set|image|src|expression)\s*\(/i.test(decoded(value))) resourceError = true
    })
    return resourceError ? RESOURCE_ERROR : null
  } catch (error) {
    if (error instanceof CssSyntaxError) return 'CSS 第 ' + (error.line ?? 1) + ' 行附近的語法不完整，請檢查大括號、引號及分號是否成對或遺漏'
    return '無法讀取這份 CSS，請確認檔案是純文字的 CSS 樣式'
  }
}

export function safeCustomCss(css: string | undefined): string {
  return css && !validateCustomCss(css) ? css : ''
}

/** Format the real site stylesheet for editing without changing declaration order. */
export function formatEditableCss(css: string): string {
  const print = (node: ChildNode, depth: number): string => {
    const indent = '  '.repeat(depth)
    if (node.type === 'comment') return indent + '/* ' + node.text + ' */'
    if (node.type === 'decl') return indent + node.prop + ': ' + node.value + (node.important ? ' !important' : '') + ';'
    const head = node.type === 'rule' ? node.selector : '@' + node.name + (node.params ? ' ' + node.params : '')
    if (!node.nodes) return indent + head + ';'
    return indent + head + ' {\n' + node.nodes.map((child) => print(child, depth + 1)).join('\n') + '\n' + indent + '}'
  }
  return parse(css, { from: undefined, map: false }).nodes.map((node) => print(node, 0)).join('\n\n') + '\n'
}

export function downloadEditableCss(css: string): void {
  const blob = new Blob([css], { type: 'text/css;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'style.css'
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
