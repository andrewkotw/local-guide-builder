import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { createEmptyProject, createSampleProject, STEPS } from './data'
import type { ProjectData, ValidationIssue } from './types'
import { StepIndicator } from './components/StepIndicator'
import { Field, Notice } from './components/FormBits'
import { PhotoManager } from './components/PhotoManager'
import { PreviewPanel } from './components/PreviewPanel'
import { VisitNotesEditor } from './components/VisitNotesEditor'
import { clearLocalProject, loadLocalProject, saveLocalProject } from './utils/db'
import { formatBytes, formatTime } from './utils/format'
import { parseYouTubeUrl, safeGoogleMapsUrl } from './utils/security'
import { validateVideoFile } from './utils/media'
import { downloadEditableCss, MAX_CUSTOM_CSS_SIZE, validateCustomCss } from './utils/customCss'
import { getSiteCss } from './utils/siteGenerator'
import { downloadProjectBackup, downloadWebsite, readProjectBackup, websiteArchiveName } from './utils/zip'
import { validateProject } from './utils/validation'

type SaveState = 'saving' | 'saved' | 'error'

export default function App() {
  const [project, setProject] = useState<ProjectData>(() => createEmptyProject())
  const [step, setStep] = useState(0); const [saveState, setSaveState] = useState<SaveState>('saved'); const [lastSaved, setLastSaved] = useState('')
  const [ready, setReady] = useState(false); const [dirty, setDirty] = useState(false); const [message, setMessage] = useState(''); const [issues, setIssues] = useState<ValidationIssue[]>([])
  const [videoError, setVideoError] = useState(''); const [cssError, setCssError] = useState(''); const [pendingHighlightDelete, setPendingHighlightDelete] = useState(''); const [pendingReflectionDelete, setPendingReflectionDelete] = useState(''); const [pendingCssDelete, setPendingCssDelete] = useState(false); const [pendingVideoDelete, setPendingVideoDelete] = useState(false)
  const [downloadTask, setDownloadTask] = useState<'backup' | 'website' | null>(null)
  const importRef = useRef<HTMLInputElement>(null); const cssRef = useRef<HTMLInputElement>(null); const stepHeadingRef = useRef<HTMLHeadingElement>(null); const editVersion = useRef(0); const hasFocusedFirstStep = useRef(false); const downloadLock = useRef(false)
  const hasStarted = Boolean(project.titleZh || project.titleEn || project.introZh || project.photos.length || project.video)

  useEffect(() => { void loadLocalProject().then((saved) => { if (saved) { setProject(saved); setLastSaved(saved.updatedAt); setMessage('已開啟這台電腦上的自動備份') } }).catch(() => setMessage('目前無法讀取自動備份，但你仍可繼續製作')).finally(() => setReady(true)) }, [])
  useEffect(() => { if (!ready || !dirty) return; setSaveState('saving'); const version = editVersion.current; const timer = window.setTimeout(() => { const next = { ...project, updatedAt: new Date().toISOString() }; saveLocalProject(next).then(() => { if (editVersion.current === version) { setLastSaved(next.updatedAt); setSaveState('saved'); setDirty(false) } }).catch(() => setSaveState('error')) }, 700); return () => clearTimeout(timer) }, [project, ready, dirty])
  useEffect(() => {
    const saveBeforeLeaving = () => { if (dirty) void saveLocalProject({ ...project, updatedAt: new Date().toISOString() }).catch(() => undefined) }
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { saveBeforeLeaving(); event.preventDefault(); event.returnValue = '' } }
    const saveWhenHidden = () => { if (document.visibilityState === 'hidden') saveBeforeLeaving() }
    window.addEventListener('beforeunload', warn); document.addEventListener('visibilitychange', saveWhenHidden)
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('visibilitychange', saveWhenHidden) }
  }, [dirty, project])
  useEffect(() => {
    if (!ready || !stepHeadingRef.current) return
    if (!hasFocusedFirstStep.current) { hasFocusedFirstStep.current = true; return }
    stepHeadingRef.current.focus({ preventScroll: true })
    stepHeadingRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [step, ready])

  function markChanged() { editVersion.current += 1; setDirty(true) }
  function update(patch: Partial<ProjectData>) { setProject((current) => ({ ...current, ...patch })); markChanged(); setMessage('') }
  function confirmReplace(action: string): boolean {
    if (!hasStarted) return true
    if (!window.confirm(`${action}會換掉目前畫面上的作品。已自動儲存的版本仍可能被新內容蓋掉。要繼續嗎？`)) return false
    return window.confirm(`請再確認一次：建議先下載「可繼續編輯的作品備份」。確定要${action}嗎？`)
  }
  const issue = (field: string) => issues.find((item) => item.field === field)?.message
  function goToIssue(item: ValidationIssue) { setStep(item.step); window.setTimeout(() => document.getElementById(`field-${item.field}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50) }
  async function importProject(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return
    if (!confirmReplace('開啟另一份作品')) { event.target.value = ''; return }
    try { const loaded = await readProjectBackup(file); setProject(loaded); markChanged(); setStep(0); setIssues([]); setMessage('作品備份已成功開啟，可以繼續編輯') } catch (reason) { setMessage(reason instanceof Error ? reason.message : '無法開啟這份作品，請確認是否選到 .localguide 備份檔') }
    event.target.value = ''
  }
  async function saveBackup() {
    if (downloadLock.current) return
    downloadLock.current = true; setDownloadTask('backup'); setMessage('正在準備可繼續編輯的作品備份，請稍等…')
    try { await downloadProjectBackup(project); setMessage('作品備份已下載，請妥善保留到下次上課') } catch { setMessage('下載作品備份失敗，請確認瀏覽器是否允許下載，或關閉其他程式後再試一次') }
    finally { downloadLock.current = false; setDownloadTask(null) }
  }
  async function exportWebsite() {
    const found = validateProject(project); setIssues(found)
    if (found.length) { setMessage(`還有 ${found.length} 個項目需要完成，請依照下方清單修改。`); return }
    if (downloadLock.current) return
    downloadLock.current = true; setDownloadTask('website'); setMessage('正在整理照片與網站檔案，完成前請不要重複按下載…')
    try { await downloadWebsite(project); setMessage(`完成的網站已下載：${websiteArchiveName(project)}，可以交給老師了！`) } catch { setMessage('網站下載失敗，請確認電腦有足夠空間、瀏覽器允許下載後再試一次') }
    finally { downloadLock.current = false; setDownloadTask(null) }
  }
  async function restart() {
    if (!window.confirm('重新開始會清除文字、照片、影片與這台電腦上的自動備份。確定要繼續嗎？')) return
    if (!window.confirm('請再確認一次：尚未另存的內容將無法找回。真的要重新開始嗎？')) return
    await clearLocalProject().catch(() => undefined); editVersion.current += 1; setProject(createEmptyProject()); setStep(0); setIssues([]); setDirty(false); setLastSaved(''); setMessage('已清除文字、照片、影片與這台電腦上的自動備份')
  }
  async function chooseVideo(file?: File) {
    setVideoError(''); if (!file) { update({ video: null }); return }
    const fileError = validateVideoFile(file); if (fileError) { setVideoError(file.size > 50 * 1024 * 1024 ? `${fileError}（目前檔案 ${formatBytes(file.size)}）` : fileError); return }
    update({ video: { fileName: file.name, size: file.size, blob: file } }); setPendingVideoDelete(false)
  }
  async function chooseCss(file?: File) {
    setCssError('')
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.css')) { setCssError('請選擇副檔名為 .css 的檔案'); return }
    if (file.size > MAX_CUSTOM_CSS_SIZE) { setCssError(`CSS 檔案超過 200KB（目前 ${formatBytes(file.size)}），請刪除不需要的內容後再試一次`); return }
    try {
      const css = await file.text()
      const error = validateCustomCss(css)
      if (error) { setCssError(error); return }
      update({ customCss: css, customCssFileName: file.name, customCssMode: 'replace' }); setPendingCssDelete(false); setMessage('完整 CSS 已套用，右側預覽與下載網站將使用這份樣式')
    } catch { setCssError('無法讀取這份 CSS，請確認檔案沒有損壞後再試一次') }
  }
  function downloadCss() { try { downloadEditableCss(getSiteCss(project)); setMessage('完整 style.css 已下載，包含封面、導覽、照片、心得與手機版。修改後上傳即可預覽。') } catch { setMessage('無法下載 style.css，請確認瀏覽器是否允許下載') } }
  function deleteCss() { if (!pendingCssDelete) { setPendingCssDelete(true); return }; update({ customCss: '', customCssFileName: '' }); setPendingCssDelete(false); setCssError(''); setMessage('已移除自訂 CSS，恢復使用原本的視覺主題') }

  function loadSample() { if (!confirmReplace('載入練習範例')) return; setProject(createSampleProject()); markChanged(); setIssues([]); setMessage('練習範例已載入。請把範例文字換成你們小組的內容。') }
  function deleteHighlight(id: string) { if (pendingHighlightDelete !== id) { setPendingHighlightDelete(id); return }; update({ highlights: project.highlights.filter((h) => h.id !== id) }); setPendingHighlightDelete('') }
  function deleteReflection(id: string) { if (pendingReflectionDelete !== id) { setPendingReflectionDelete(id); return }; update({ reflections: project.reflections.filter((reflection) => reflection.id !== id) }); setPendingReflectionDelete('') }
  function deleteVideo() { if (!pendingVideoDelete) { setPendingVideoDelete(true); return }; update({ video: null }); setPendingVideoDelete(false) }

  if (!ready) return <div className="loading">正在開啟網站產生器…</div>
  return <div className="app-shell">
    <header className="app-header"><div><p className="kicker">不用寫程式・內容不會上傳網路</p><h1>我的在地小旅行</h1><p>填文字、放照片，最後下載可交給老師的介紹網站。</p></div><div className={`save-status ${saveState}`} aria-live="polite"><strong>{saveState === 'saving' ? '正在保存，請稍等…' : saveState === 'error' ? '沒有成功保存' : lastSaved ? '已保存在這台電腦' : '會自動保存在這台電腦'}</strong><span>{saveState === 'error' ? '請下載作品備份，避免遺失' : lastSaved ? `最後保存：${formatTime(lastSaved)}` : '開始輸入後會自動保存'}</span></div></header>
    <input ref={importRef} type="file" className="visually-hidden" accept=".localguide,.zip" onChange={(e) => void importProject(e)} />
    <StepIndicator current={step} onSelect={setStep} />
    {message && <div className="global-message" role="status">{message}</div>}
    <div className="project-tools"><details><summary>作品管理與備份</summary><div><button type="button" className="secondary" onClick={() => importRef.current?.click()}>開啟下載過的作品備份</button><button type="button" className="secondary" onClick={loadSample}>載入練習範例</button><button type="button" className="text-danger" onClick={() => void restart()}>清除全部，重新開始</button></div><p>換電腦或換瀏覽器時，請用下載過的 .localguide 作品備份繼續。</p></details></div>
    <main className="workspace"><section className="editor">{step === 0 && !hasStarted && <section className="start-here" aria-labelledby="start-title"><p className="start-badge">第一次使用？從這裡開始</p><h2 id="start-title">三件事就能完成網站</h2><ol><li><b>填介紹</b><span>每一步只要完成畫面上的內容。</span></li><li><b>放照片和影片</b><span>照片會自動縮小，不必自己處理。</span></li><li><b>檢查並下載</b><span>最後下載完成的網站交給老師。</span></li></ol><div><button type="button" className="primary" onClick={loadSample}>先載入練習範例看看</button><button type="button" className="secondary" onClick={() => importRef.current?.click()}>繼續上次下載的作品</button></div><p className="start-note">可以放心試：內容會自動保存在這台電腦。</p></section>}
      <div className="step-title"><span>步驟 {step + 1} / 5</span><h2 ref={stepHeadingRef} tabIndex={-1}>{STEPS[step]}</h2><p>{['先填名稱和基本資訊。看到「必填」才一定要填。','用自己的話介紹這個地方，中英文分開填。','加入 1 到 8 張照片，再選一張當封面。','選擇影片方式，並告訴讀者怎麼前往。','請每位組員完成心得，再檢查預覽與公開內容。'][step]}</p></div>
      {step === 0 && <div className="form-grid">
        <Field id="field-titleZh" label="景點中文名稱" required error={issue('titleZh')}><input value={project.titleZh} onChange={(e) => update({ titleZh: e.target.value })} /></Field>
        <Field id="field-titleEn" label="景點英文名稱" required error={issue('titleEn')}><input lang="en" value={project.titleEn} onChange={(e) => update({ titleEn: e.target.value })} /></Field>
        <Field label="類型" required><select value={project.type} onChange={(e) => update({ type: e.target.value as ProjectData['type'] })}>{['景點','美食','廟宇','歷史文化','其他'].map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="視覺主題"><select value={project.theme} onChange={(e) => update({ theme: e.target.value as ProjectData['theme'] })}><option value="nature">自然綠</option><option value="history">歷史暖棕</option><option value="modern">現代藍</option></select></Field>
        <details className="custom-css-panel"><summary>進階：用自己的 CSS 調整外觀</summary><div className="custom-css-content"><p>下載的是目前網站的完整 CSS，包含封面、導覽、照片、亮點、心得與手機排版。</p><ol><li>按「一鍵下載 style.css」。</li><li>用文字編輯器修改顏色、字體、間距或整套版型，儲存為 .css 檔。</li><li>上傳修改後的 CSS，會完整取代原本樣式；預覽與匯出會使用同一份。</li></ol><div className="custom-css-actions"><button type="button" className="secondary" onClick={downloadCss}>一鍵下載 style.css</button><button type="button" className="secondary" onClick={() => cssRef.current?.click()}>上傳修改後的 style.css</button>{project.customCss && <button type="button" className="small danger" onClick={deleteCss} onBlur={() => setPendingCssDelete(false)}>{pendingCssDelete ? '再按一次，恢復原本主題' : '移除自訂 CSS'}</button>}</div><input ref={cssRef} type="file" className="visually-hidden" accept=".css,text/css" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; void chooseCss(file) }} />{project.customCss && <p className="css-file-status" role="status"><strong>已套用：</strong>{project.customCssFileName || 'style.css'}（{formatBytes(new TextEncoder().encode(project.customCss).byteLength)}）</p>}{cssError && <p className="field-error" role="alert">⚠ {cssError}</p>}<p className="hint">為保護隱私，不能使用外部圖片、字型、網址或 HTML。封面可沿用 var(--cover)，不必在 CSS 寫圖片路徑。上傳失敗時保留原樣式。</p></div></details>
        <Field id="field-taglineZh" label="一句中文特色介紹" required error={issue('taglineZh')}><input value={project.taglineZh} onChange={(e) => update({ taglineZh: e.target.value })} maxLength={80} /></Field>
        <Field id="field-taglineEn" label="一句英文特色介紹" required error={issue('taglineEn')}><input lang="en" value={project.taglineEn} onChange={(e) => update({ taglineEn: e.target.value })} maxLength={140} /></Field>
        <Field id="field-address" label="地址" required error={issue('address')}><input value={project.address} onChange={(e) => update({ address: e.target.value })} /></Field>
        <Field label="開放時間"><input value={project.hours} onChange={(e) => update({ hours: e.target.value })} placeholder="不知道可以留空" /></Field>
        <Field label="費用"><input value={project.fee} onChange={(e) => update({ fee: e.target.value })} placeholder="例如：免費；不知道可以留空" /></Field>
        <Field id="field-groupName" label="小組名稱" required hint="不需要填寫組員全名。" error={issue('groupName')}><input value={project.groupName} onChange={(e) => update({ groupName: e.target.value })} /></Field>
      </div>}
      {step === 1 && <div className="form-stack">
        <Field id="field-introZh" label="中文介紹" required error={issue('introZh')}><textarea rows={6} value={project.introZh} onChange={(e) => update({ introZh: e.target.value })} /></Field>
        <Field id="field-introEn" label="英文介紹" required error={issue('introEn')}><textarea lang="en" rows={6} value={project.introEn} onChange={(e) => update({ introEn: e.target.value })} /></Field>
        <div id="field-highlights" className={issue('highlights') ? 'group-error' : ''}><div className="section-row"><div><h3>參觀亮點</h3><p>最多三項，可填中英文。</p></div><button type="button" className="secondary" disabled={project.highlights.length >= 3} onClick={() => update({ highlights: [...project.highlights, { id: crypto.randomUUID(), textZh: '', textEn: '' }] })}>新增亮點</button></div>
          {project.highlights.map((highlight, index) => <div className="highlight-row" key={highlight.id}><b>{index + 1}</b><input aria-label={`亮點 ${index + 1} 中文`} placeholder="中文亮點" value={highlight.textZh} onChange={(e) => update({ highlights: project.highlights.map((h) => h.id === highlight.id ? { ...h, textZh: e.target.value } : h) })} /><input lang="en" aria-label={`亮點 ${index + 1} 英文`} placeholder="英文亮點" value={highlight.textEn} onChange={(e) => update({ highlights: project.highlights.map((h) => h.id === highlight.id ? { ...h, textEn: e.target.value } : h) })} /><button type="button" className="small danger" onClick={() => deleteHighlight(highlight.id)} onBlur={() => setPendingHighlightDelete('')}>{pendingHighlightDelete === highlight.id ? '再按一次，確定刪除' : '刪除亮點'}</button></div>)}
          {issue('highlights') && <p className="field-error">⚠ {issue('highlights')}</p>}
        </div>
        <VisitNotesEditor notes={project} onChange={update} error={issue('recommendation')} />
      </div>}
      {step === 2 && <div id="field-photos"><PhotoManager photos={project.photos} coverId={project.coverId} onChange={(photos, coverId) => update({ photos, coverId })} />{issue('photos') && <p className="field-error">⚠ {issue('photos')}</p>}</div>}
      {step === 3 && <div className="form-stack">
        <fieldset><legend>影片方式</legend><div className="choice-row"><label><input type="radio" checked={project.videoMode === 'youtube'} onChange={() => update({ videoMode: 'youtube' })} />貼上 YouTube 網址（建議）</label><label><input type="radio" checked={project.videoMode === 'local'} onChange={() => update({ videoMode: 'local' })} />選擇本機 MP4 影片</label></div></fieldset>
        {project.videoMode === 'youtube' ? <Field id="field-youtubeUrl" label="YouTube 網址" hint="網址不會在編輯時上傳；預覽影片時需要網路。" error={issue('youtubeUrl') || (project.youtubeUrl && !parseYouTubeUrl(project.youtubeUrl) ? '這不是可用的 YouTube 影片網址。請到影片按「分享」，再複製網址。' : '')}><input type="url" value={project.youtubeUrl} onChange={(e) => update({ youtubeUrl: e.target.value })} placeholder="例如：https://youtu.be/……" /></Field> : <Field label="電腦或手機裡的 MP4 影片" hint="單一影片最多 50MB。影片較大時，建議上傳 YouTube 後貼上分享網址。" error={videoError}><input type="file" accept="video/mp4,.mp4" onChange={(e) => void chooseVideo(e.target.files?.[0])} />{project.video && <p className="file-pill">已選擇：{project.video.fileName}（{formatBytes(project.video.size)}） <button type="button" className="text-button danger" onClick={deleteVideo} onBlur={() => setPendingVideoDelete(false)}>{pendingVideoDelete ? '再按一次，確定移除' : '移除影片'}</button></p>}</Field>}
        <Field id="field-mapsUrl" label="Google Maps 分享網址" hint="選填。填寫後，網站會依照基本資料中的地址顯示小地圖。請在 Google Maps 按「分享」複製網址；預覽地圖時需要網路。" error={issue('mapsUrl') || (project.mapsUrl && !safeGoogleMapsUrl(project.mapsUrl) ? '請貼上 Google Maps 的 https:// 分享網址，例如 maps.app.goo.gl 開頭的網址。' : '')}><input type="url" value={project.mapsUrl} onChange={(e) => update({ mapsUrl: e.target.value })} placeholder="例如：https://maps.app.goo.gl/……" /></Field>
        <Field label="如何前往（中文）"><textarea rows={3} value={project.transportZh} onChange={(e) => update({ transportZh: e.target.value })} /></Field>
        <Field label="How to get there（英文）"><textarea lang="en" rows={3} value={project.transportEn} onChange={(e) => update({ transportEn: e.target.value })} /></Field>
      </div>}
      {step === 4 && <div className="finish-panel">
        <section id="field-reflections" className={`reflection-editor ${issue('reflections') ? 'group-error' : ''}`} aria-labelledby="reflection-title">
          <div className="section-row"><div><h3 id="reflection-title">小組心得</h3><p>每位組員都要新增一張並寫下自己的心得，不限字數。</p></div><button type="button" className="secondary" onClick={() => update({ reflections: [...project.reflections, { id: crypto.randomUUID(), memberLabel: '', text: '' }] })}>新增下一位組員</button></div>
          <div className="reflection-guide"><strong>不知道怎麼開始？可以挑一、兩題回答：</strong><ul><li>你在製作過程中負責什麼？學到了什麼？</li><li>哪一件事最困難？你們怎麼解決？</li><li>實際探訪後，你對這個地方有什麼新的看法？</li><li>如果再做一次，你想改進什麼？</li></ul></div>
          <p className="reflection-privacy">公開網站不需要真實姓名，請使用「組員 1」、暱稱或座號。</p>
          <div className="reflection-list">
            {project.reflections.map((reflection, index) => <article className="reflection-card" key={reflection.id}><div className="reflection-card-heading"><span>組員心得 {index + 1}</span><button type="button" className="small danger" onClick={() => deleteReflection(reflection.id)} onBlur={() => setPendingReflectionDelete('')}>{pendingReflectionDelete === reflection.id ? '再按一次，確定刪除' : '刪除這份心得'}</button></div><div id={`field-reflection-${reflection.id}-memberLabel`} className={`field ${issue(`reflection-${reflection.id}-memberLabel`) ? 'has-error' : ''}`}><label htmlFor={`reflection-label-${reflection.id}`}>組員暱稱或座號 <span className="required">必填</span></label><input id={`reflection-label-${reflection.id}`} value={reflection.memberLabel} onChange={(e) => update({ reflections: project.reflections.map((item) => item.id === reflection.id ? { ...item, memberLabel: e.target.value } : item) })} placeholder={`例如：組員 ${index + 1}、小安或 12 號`} />{issue(`reflection-${reflection.id}-memberLabel`) && <p className="field-error">⚠ {issue(`reflection-${reflection.id}-memberLabel`)}</p>}</div><div id={`field-reflection-${reflection.id}-text`} className={`field ${issue(`reflection-${reflection.id}-text`) ? 'has-error' : ''}`}><label htmlFor={`reflection-text-${reflection.id}`}>我的心得 <span className="required">必填</span></label><textarea id={`reflection-text-${reflection.id}`} rows={5} value={reflection.text} onChange={(e) => update({ reflections: project.reflections.map((item) => item.id === reflection.id ? { ...item, text: e.target.value } : item) })} placeholder="用自己的話寫就可以，例如：我負責拍攝照片，原本以為……，實際探訪後我發現……" />{issue(`reflection-${reflection.id}-text`) && <p className="field-error">⚠ {issue(`reflection-${reflection.id}-text`)}</p>}</div></article>)}
          </div>
          {issue('reflections') && <p className="field-error">⚠ {issue('reflections')}</p>}
        </section>
        <Notice>下載前，請仔細檢查預覽與下列隱私事項。未完成的內容仍會自動儲存，但不能下載正式網站。</Notice>
        <fieldset className="privacy"><legend>公開前確認</legend>{[
          ['noPrivateData','我沒有填寫組員的電話、住址或私人帳號'], ['mediaPermission','我確認照片與影片可以用於課堂網站'], ['understandsPublic','我知道網站發布後，取得網址的人可能看到內容'], ['checkedBackground','我已檢查是否拍到不適合公開的個人資料']
        ].map(([key, label]) => <div key={key} id={`field-privacy.${key}`}><label><input type="checkbox" checked={project.privacy[key as keyof ProjectData['privacy']]} onChange={(e) => update({ privacy: { ...project.privacy, [key]: e.target.checked } })} />{label}</label>{issue(`privacy.${key}`) && <p className="field-error">⚠ {issue(`privacy.${key}`)}</p>}</div>)}</fieldset>
        {issues.length > 0 && <div className="checklist" role="alert"><h3>下載網站前，還要完成：</h3><ul>{issues.map((item, index) => <li key={`${item.field}-${index}`}><button type="button" onClick={() => goToIssue(item)}>{item.message} →</button></li>)}</ul></div>}
        <div className="download-help"><h3>兩種下載有什麼不同？</h3><p><b>還要繼續修改：</b>選左邊的作品備份。<b>已經完成、要交給老師：</b>選右邊的網站壓縮檔。</p></div>
        <div className="download-cards"><div><span className="download-number">1</span><h3>備份作品，下次繼續編輯</h3><p>會下載一個作品備份檔（.localguide）。下次上課按「開啟下載過的作品備份」即可繼續。</p><button type="button" className="secondary" onClick={() => void saveBackup()} disabled={downloadTask !== null}>{downloadTask === 'backup' ? '正在準備作品備份…' : '下載可繼續編輯的作品備份'}</button></div><div className="primary-card"><span className="download-number">2</span><h3>繳交完成的網站</h3><p>會下載網站壓縮檔（ZIP），交給老師發布。這個檔案<b>不能拿回來繼續編輯</b>。</p><p className="expected-filename">老師會收到：<code>{websiteArchiveName(project)}</code></p><button type="button" className="primary" onClick={() => void exportWebsite()} disabled={downloadTask !== null}>{downloadTask === 'website' ? '正在整理網站檔案…' : '下載交給老師的網站壓縮檔'}</button></div></div>
      </div>}
      <div className="step-actions"><button type="button" className="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>上一頁</button>{step < 4 ? <button type="button" className="primary" onClick={() => setStep((s) => Math.min(4, s + 1))}>下一頁</button> : <button type="button" className="secondary" onClick={() => setStep(0)}>回到第一步</button>}</div>
    </section><PreviewPanel project={project} /></main>
    <footer className="app-footer"><p><b>安心製作：</b>重新整理或下次用同一台電腦、同一個瀏覽器開啟時，作品會自動回來。換電腦時請使用作品備份。</p><p>作品內容只儲存在這台電腦；預覽 YouTube、Google Maps 或首次下載翻譯語言套件時需要網路。翻譯不會上傳文章，本工具不使用分析或追蹤服務。</p></footer>
  </div>
}
