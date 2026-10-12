import { useEffect, useRef, useState } from 'react'
import type { ProjectData } from '../types'
import { Field, Notice } from './FormBits'
import { browserTranslator, translateVisitNotes, TRANSLATION_UNAVAILABLE } from '../utils/translation'
import './VisitNotesEditor.css'

type Notes = Pick<ProjectData, 'recommendation' | 'recommendationEn' | 'notice' | 'noticeEn'>

export function VisitNotesEditor({ notes, onChange, error }: {
  notes: Notes; onChange: (patch: Partial<Notes>) => void; error?: string
}) {
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [failed, setFailed] = useState(false)
  const active = useRef<AbortController | null>(null)
  const supported = Boolean(browserTranslator())
  // Also tolerate an older in-memory project during a development hot update.
  const { recommendation, recommendationEn = '', notice, noticeEn = '' } = notes

  useEffect(() => () => { active.current?.abort() }, [recommendation, recommendationEn, notice, noticeEn])

  async function translate() {
    if (active.current) return
    if ((recommendation.trim() && recommendationEn.trim() || notice.trim() && noticeEn.trim()) && !window.confirm('重新翻譯會取代已有的英文內容，包含你手動修改的部分。中文會保留。確定要繼續嗎？')) return
    const controller = new AbortController()
    active.current = controller; setBusy(true); setFailed(false)
    try {
      const result = await translateVisitNotes(notes, controller.signal, setFeedback)
      if (controller.signal.aborted || active.current !== controller) return
      // Empty Chinese fields never erase independently written English.
      onChange({ ...(recommendation.trim() ? { recommendationEn: result.recommendationEn } : {}), ...(notice.trim() ? { noticeEn: result.noticeEn } : {}) })
      setFeedback('英文已填入！請檢查地名、開放規定和語意，再到預覽按「Read in English」試讀。')
    } catch (reason) {
      if (controller.signal.aborted || active.current !== controller) return
      setFailed(true); setFeedback(reason instanceof Error ? reason.message : '翻譯沒有完成，原本的文字沒有改變，請稍後再試。')
    } finally {
      if (active.current === controller) { active.current = null; setBusy(false) }
    }
  }
  function cancel() {
    active.current?.abort(); active.current = null; setBusy(false); setFailed(false)
    setFeedback('已取消翻譯，原本的文字沒有改變。')
  }

  return <div className="form-stack visit-notes-editor">
    <Field id="field-recommendation" label="推薦原因（中文）" required error={error}><textarea rows={4} disabled={busy} value={recommendation} onChange={(e) => onChange({ recommendation: e.target.value })} /></Field>
    <Field id="field-notice" label="參觀提醒（中文／選填）"><textarea rows={3} disabled={busy} value={notice} onChange={(e) => onChange({ notice: e.target.value })} placeholder="例如：需先預約、請勿拍照。沒有特別提醒可以留空。" /></Field>
    <aside className="translation-help" aria-labelledby="translation-title">
      <h3 id="translation-title">翻譯蒟蒻：讓外國朋友也看得懂</h3>
      <p>先填上面的中文，按一下產生這兩段的英文。中文會保留，下方英文可以再修改。</p>
      <button type="button" className="secondary" disabled={busy || !supported || !(recommendation.trim() || notice.trim())} onClick={() => void translate()}>{busy ? '翻譯中，請稍等…' : '翻譯蒟蒻：產生兩段英文'}</button>
      {busy && <button type="button" className="secondary" onClick={cancel}>取消翻譯</button>}
      <p className="hint">翻譯在這台電腦完成，不會上傳文章。首次使用需連網下載語言套件；切換步驟會取消尚未完成的翻譯。</p>
      {!supported && <Notice>{TRANSLATION_UNAVAILABLE}</Notice>}
      {feedback && <Notice tone={failed ? 'error' : 'info'}>{feedback}</Notice>}
    </aside>
    <Field id="field-recommendationEn" label="推薦原因（英文）" hint="可自行填寫或使用上面的翻譯蒟蒻。中文修改後，請記得同步校對英文。"><textarea lang="en" rows={4} disabled={busy} value={recommendationEn} onChange={(e) => onChange({ recommendationEn: e.target.value })} /></Field>
    <Field id="field-noticeEn" label="參觀提醒（英文／選填）"><textarea lang="en" rows={3} disabled={busy} value={noticeEn} onChange={(e) => onChange({ noticeEn: e.target.value })} /></Field>
    <p className="hint">這兩段的英文都準備好後，預覽和完成網站會出現「翻譯蒟蒻 · Read in English」切換按鈕；沒有參觀提醒時，只需填寫推薦原因的英文。</p>
  </div>
}
