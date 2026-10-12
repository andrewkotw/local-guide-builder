import assert from 'node:assert/strict'
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve('dist')
const base = '/local-guide-builder/'
const html = await readFile(path.join(root, 'index.html'), 'utf8')
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1])
assert(refs.some((ref) => ref.endsWith('.js')), 'Missing JavaScript entry')
assert(refs.some((ref) => ref.endsWith('.css')), 'Missing stylesheet')
for (const ref of refs) {
  assert(ref.startsWith(base), `Unexpected entry resource path: ${ref}`)
  const asset = path.resolve(root, ref.slice(base.length))
  assert(asset.startsWith(root + path.sep), 'Resource path outside dist')
  assert((await stat(asset)).isFile(), `Missing resource: ${ref}`)
}
let count = 0
async function inspect(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name)
    if (item.isDirectory()) { await inspect(file); continue }
    count += 1
    assert(/\.(html|css|js)$/.test(item.name), `Unexpected production asset: ${item.name}`)
    const text = await readFile(file, 'utf8')
    // Translator/URL parsing libraries may mention localhost as plain text;
    // it must never appear as an actual URL or as a host in emitted resources.
    assert(!/(?:https?:\/\/|\/\/)(?:localhost|127\.0\.0\.1)(?=[:/"'\s])/i.test(text), `Development URL in ${item.name}`)
    assert(!/(?:file:\/\/|[A-Z]:[\\/](?:Users|home)[\\/]|\/Users\/|\/home\/runner\/)/i.test(text), `Local path in ${item.name}`)
    assert(!/^\s*(?:\/\/[#@]|\/\*[#@])\s*sourceMappingURL=/m.test(text), `Source map reference in ${item.name}`)
  }
}
await inspect(root)
console.log(`PASS: ${count} production files; all entry assets exist under ${base}; no media, backups or local URLs.`)
