import { useEffect, useRef, useState } from 'react'
import type { ProjectData } from '../types'
import { buildSiteFiles } from '../utils/siteGenerator'

export function PreviewPanel({ project }: { project: ProjectData }) {
  const [mobile, setMobile] = useState(false); const [fullscreen, setFullscreen] = useState(false); const [version, setVersion] = useState(0); const [snapshot, setSnapshot] = useState(project); const [scale, setScale] = useState(1); const [srcDoc, setSrcDoc] = useState(''); const hostRef = useRef<HTMLDivElement>(null)
  useEffect(() => { const timer = window.setTimeout(() => setSnapshot(project), 500); return () => clearTimeout(timer) }, [project])
  useEffect(() => {
    const host = hostRef.current; if (!host) return
    const targetWidth = mobile ? 390 : 1100
    const updateScale = () => setScale(Math.min(1, Math.max(.2, (host.clientWidth - 20) / targetWidth)))
    updateScale(); const observer = new ResizeObserver(updateScale); observer.observe(host); return () => observer.disconnect()
  }, [mobile])
  useEffect(() => {
    const urls: string[] = []
    const result = buildSiteFiles(snapshot, (blob) => { const url = URL.createObjectURL(blob); urls.push(url); return url })
    // A stylesheet URL avoids interpreting uploaded CSS as srcdoc HTML.
    const cssUrl = URL.createObjectURL(new Blob([result.css], { type: 'text/css' }))
    urls.push(cssUrl)
    setSrcDoc(result.html.replace('href="style.css"', `href="${cssUrl}"`).replace('</head>', `<meta name="preview-version" content="${version}"></head>`))
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [snapshot, version])
  useEffect(() => {
    if (!fullscreen) return
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setFullscreen(false) }
    document.body.style.overflow = 'hidden'; window.addEventListener('keydown', closeOnEscape)
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', closeOnEscape) }
  }, [fullscreen])
  const targetWidth = mobile ? 390 : 1100
  const fullBrowserWidth = fullscreen && !mobile
  return <aside className={`preview-panel${fullscreen ? ' fullscreen-preview' : ''}`} aria-label="網站預覽" role={fullscreen ? 'dialog' : undefined} aria-modal={fullscreen || undefined}>
    <div className="preview-toolbar">
      <div><strong>完成後的網站預覽</strong><span className="preview-size">目前顯示：{mobile ? '手機窄畫面' : '電腦寬畫面'}（{fullBrowserWidth ? '使用完整瀏覽器寬度' : '已縮小成完整畫面'}）</span></div>
      <div>
        <button type="button" className={!mobile ? 'selected small' : 'small'} onClick={() => setMobile(false)} aria-pressed={!mobile}>電腦版</button>
        <button type="button" className={mobile ? 'selected small' : 'small'} onClick={() => setMobile(true)} aria-pressed={mobile}>手機版</button>
        <button type="button" className="small" onClick={() => { setSnapshot(project); setVersion((v) => v + 1) }}>立即更新</button>
        <button type="button" className="small fullscreen-button" onClick={() => setFullscreen((value) => !value)} aria-pressed={fullscreen}>{fullscreen ? '關閉全螢幕預覽' : '全螢幕預覽'}</button>
      </div>
    </div>
    <div ref={hostRef} className={`preview-frame ${mobile ? 'mobile' : 'desktop'}`}>
      <div className="preview-scaler" style={{ width: fullBrowserWidth ? '100%' : targetWidth * scale }}>
        <iframe style={{ width: fullBrowserWidth ? '100%' : targetWidth, height: fullBrowserWidth ? '100%' : `${100 / scale}%`, transform: fullBrowserWidth ? 'none' : `scale(${scale})` }} title="完成網站預覽" sandbox="allow-scripts allow-same-origin allow-popups" srcDoc={srcDoc} />
      </div>
    </div>
  </aside>
}
