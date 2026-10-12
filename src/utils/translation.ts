/** Browser-provided, on-device translation only. Never send student text to a server. */
export interface LocalTranslator {
  translate(text: string): Promise<string>
  destroy(): void
}
export interface TranslatorFactory {
  create(options: {
    sourceLanguage: string
    targetLanguage: string
    signal: AbortSignal
    monitor: (monitor: { addEventListener(type: 'downloadprogress', listener: (event: { loaded: number }) => void): void }) => void
  }): Promise<LocalTranslator>
}

export function browserTranslator(): TranslatorFactory | undefined {
  return (globalThis as typeof globalThis & { Translator?: TranslatorFactory }).Translator
}

export const TRANSLATION_UNAVAILABLE = '這個瀏覽器目前沒有本機翻譯功能。請改用支援內建翻譯的電腦版 Chrome，或直接填寫下方英文；原本的文字都還在。'

/** Call directly from a click handler: model creation requires user activation. */
export async function translateVisitNotes(
  source: { recommendation: string; notice: string },
  signal: AbortSignal,
  status: (message: string) => void,
  factory = browserTranslator(),
): Promise<{ recommendationEn: string; noticeEn: string }> {
  if (!factory) throw new Error(TRANSLATION_UNAVAILABLE)
  if (signal.aborted) throw new Error('已取消翻譯，原本的文字沒有改變。')
  let translator: LocalTranslator | undefined
  let destroyed = false
  const release = () => { if (translator && !destroyed) { destroyed = true; try { translator.destroy() } catch { /* Already released by browser. */ } } }
  const controller = new AbortController()
  const cancel = () => { controller.abort(); release() }
  signal.addEventListener('abort', cancel, { once: true })
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; cancel() }, 180_000)
  let rejectCancelled: () => void = () => undefined
  const cancelled = new Promise<never>((_, reject) => { rejectCancelled = () => reject(new Error('cancelled')) })
  controller.signal.addEventListener('abort', rejectCancelled, { once: true })
  const wait = <T>(task: Promise<T>) => Promise.race([task, cancelled])
  try {
    status('正在準備本機翻譯；第一次使用可能需要下載語言套件…')
    const creation = factory.create({
      sourceLanguage: 'zh-Hant', targetLanguage: 'en', signal: controller.signal,
      monitor(monitor) {
        monitor.addEventListener('downloadprogress', (event) => {
          if (!controller.signal.aborted) status(`正在下載翻譯語言套件：${Math.round(Math.min(1, Math.max(0, event.loaded)) * 100)}%（不會上傳文章）`)
        })
      },
    }).then((created) => { translator = created; if (controller.signal.aborted) release(); return created })
    const engine = await wait(creation)
    const result = { recommendationEn: '', noticeEn: '' }
    for (const field of ['recommendation', 'notice'] as const) {
      if (controller.signal.aborted) throw new Error('cancelled')
      if (!source[field].trim()) continue
      status(field === 'recommendation' ? '正在翻譯「推薦原因」…' : '正在翻譯「參觀提醒」…')
      const translated = (await wait(engine.translate(source[field]))).trim()
      if (!translated) throw new Error('empty result')
      result[field === 'recommendation' ? 'recommendationEn' : 'noticeEn'] = translated
    }
    return result
  } catch {
    if (signal.aborted) throw new Error('已取消翻譯，原本的文字沒有改變。')
    if (timedOut) throw new Error('翻譯等待太久，已停止。請確認下載語言套件時有網路，再試一次；也可以直接填寫英文。原本的文字沒有改變。')
    throw new Error('這次沒有完成翻譯。請確認瀏覽器支援本機翻譯，並連上網路下載語言套件後重試；也可以直接填寫英文。原本的文字沒有改變。')
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', cancel)
    controller.signal.removeEventListener('abort', rejectCancelled)
    release()
  }
}
