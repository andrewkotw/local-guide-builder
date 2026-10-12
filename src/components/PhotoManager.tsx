import { useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import type { PhotoAsset } from '../types'
import { formatBytes } from '../utils/format'
import { movePhoto, processPhoto } from '../utils/photo'
import { Field, Notice } from './FormBits'

interface Props { photos: PhotoAsset[]; coverId: string; onChange: (photos: PhotoAsset[], coverId: string) => void }

function PhotoThumbnail({ blob }: { blob: Blob }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const nextUrl = URL.createObjectURL(blob)
    setUrl(nextUrl)
    return () => URL.revokeObjectURL(nextUrl)
  }, [blob])
  return <img src={url || undefined} alt="上傳的照片預覽" />
}

export function PhotoManager({ photos, coverId, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null); const [status, setStatus] = useState(''); const [error, setError] = useState(''); const [dragIndex, setDragIndex] = useState<number | null>(null); const [pendingDelete, setPendingDelete] = useState('')
  async function addFiles(files: FileList | File[]) {
    setError(''); const incoming = Array.from(files)
    if (photos.length + incoming.length > 8) { setError(`最多只能放 8 張照片。目前已有 ${photos.length} 張，請減少選取數量。`); return }
    const added: PhotoAsset[] = []
    for (let i = 0; i < incoming.length; i += 1) {
      setStatus(`正在幫你縮小照片（${i + 1}/${incoming.length}）…`)
      try { added.push(await processPhoto(incoming[i])) } catch (reason) { setError(`${incoming[i].name}：${reason instanceof Error ? reason.message : '照片處理失敗，請換一張再試一次'}`) }
    }
    if (added.length) { const next = [...photos, ...added]; onChange(next, coverId || next[0].id); setStatus(`已完成 ${added.length} 張照片`) } else setStatus('')
    if (inputRef.current) inputRef.current.value = ''
  }
  function patchPhoto(id: string, patch: Partial<PhotoAsset>) { onChange(photos.map((p) => p.id === id ? { ...p, ...patch } : p), coverId) }
  function remove(id: string) { if (pendingDelete !== id) { setPendingDelete(id); return }; const next = photos.filter((p) => p.id !== id); onChange(next, coverId === id ? (next[0]?.id ?? '') : coverId); setPendingDelete('') }
  function move(from: number, to: number) { onChange(movePhoto(photos, from, to), coverId) }
  function drop(event: DragEvent, target?: number) { event.preventDefault(); if (dragIndex !== null && target !== undefined) move(dragIndex, target); else if (event.dataTransfer.files.length) void addFiles(event.dataTransfer.files); setDragIndex(null) }
  return <div>
    <div className="photo-heading"><div><h3>照片</h3><p>目前 {photos.length} / 8 張</p></div><button type="button" className="secondary" onClick={() => inputRef.current?.click()} disabled={photos.length >= 8}>選擇照片</button></div>
    <input ref={inputRef} className="visually-hidden" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple onChange={(e) => e.target.files && void addFiles(e.target.files)} />
    <div className="drop-zone" onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(e)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}>
      <strong>點這裡選照片，或把照片拖進來</strong><span>支援 JPG、PNG、WebP；每張原始照片最多 15MB</span>
    </div>
    {status && <Notice tone="success">{status}</Notice>}{error && <Notice tone="error">{error}</Notice>}
    <div className="photo-list">{photos.map((photo, index) => {
      return <article className="photo-card" key={photo.id} draggable onDragStart={() => setDragIndex(index)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(e, index)}>
        <div className="photo-preview"><PhotoThumbnail blob={photo.blob} />{photo.id === coverId && <span>封面照片</span>}</div>
        <div className="photo-details"><p className="file-name">原始檔名：{photo.originalFileName ?? photo.fileName}</p><p className="size-line">處理前 {formatBytes(photo.originalSize)} → 處理後 {formatBytes(photo.processedSize)}</p>
          <Field label="中文說明"><input value={photo.captionZh} onChange={(e) => patchPhoto(photo.id, { captionZh: e.target.value })} /></Field>
          <Field label="英文說明"><input lang="en" value={photo.captionEn} onChange={(e) => patchPhoto(photo.id, { captionEn: e.target.value })} /></Field>
          <Field label="替代文字" hint="簡短描述照片內容，讓看不到圖片的人也能理解。"><input value={photo.alt} onChange={(e) => patchPhoto(photo.id, { alt: e.target.value })} placeholder="例如：紅磚拱廊的正面照片" /></Field>
          <div className="photo-actions"><button type="button" className="small" onClick={() => move(index, index - 1)} disabled={index === 0}>上移</button><button type="button" className="small" onClick={() => move(index, index + 1)} disabled={index === photos.length - 1}>下移</button><button type="button" className="small" onClick={() => onChange(photos, photo.id)} disabled={photo.id === coverId}>設為封面</button><button type="button" className="small danger" onClick={() => remove(photo.id)} onBlur={() => setPendingDelete('')}>{pendingDelete === photo.id ? '再按一次，確定刪除' : '刪除照片'}</button></div>
        </div>
      </article>
    })}</div>
  </div>
}
