import { vi } from 'vitest'
import { translateVisitNotes, TRANSLATION_UNAVAILABLE } from './translation'
import type { LocalTranslator, TranslatorFactory } from './translation'

function engine(translate = vi.fn(async (text: string) => `English: ${text}`)) {
  const instance: LocalTranslator = { translate, destroy: vi.fn() }
  const factory: TranslatorFactory = { create: vi.fn(async () => instance) }
  return { instance, factory }
}

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

it('在本機逐段翻譯並釋放資源，不翻譯空白參觀提醒', async () => {
  const { instance, factory } = engine()
  const result = await translateVisitNotes({ recommendation: '值得參觀', notice: '  ' }, new AbortController().signal, vi.fn(), factory)
  expect(result).toEqual({ recommendationEn: 'English: 值得參觀', noticeEn: '' })
  expect(instance.translate).toHaveBeenCalledTimes(1)
  expect(instance.destroy).toHaveBeenCalledTimes(1)
  expect(factory.create).toHaveBeenCalledWith(expect.objectContaining({ sourceLanguage: 'zh-Hant', targetLanguage: 'en' }))
})

it('下載語言套件期間提供百分比，兩段翻譯完成才回傳', async () => {
  const { instance, factory } = engine()
  factory.create = async (options) => { options.monitor({ addEventListener: (_type, callback) => callback({ loaded: .5 }) }); return instance }
  const progress = vi.fn()
  const result = await translateVisitNotes({ recommendation: '推薦', notice: '請預約' }, new AbortController().signal, progress, factory)
  expect(result.noticeEn).toBe('English: 請預約')
  expect(progress).toHaveBeenCalledWith(expect.stringContaining('50%'))
})

it('不支援翻譯時提供中文替代操作，不偷偷連接外部服務', async () => {
  vi.stubGlobal('Translator', undefined)
  const network = vi.fn(); vi.stubGlobal('fetch', network)
  await expect(translateVisitNotes({ recommendation: '推薦', notice: '' }, new AbortController().signal, vi.fn())).rejects.toThrow(TRANSLATION_UNAVAILABLE)
  expect(network).not.toHaveBeenCalled()
})

it('第二段失敗不回傳半套翻譯，不顯示瀏覽器的英文例外', async () => {
  const translate = vi.fn().mockResolvedValueOnce('Recommended').mockRejectedValueOnce(new Error('QuotaExceededError secret details'))
  const { instance, factory } = engine(translate)
  await expect(translateVisitNotes({ recommendation: '推薦', notice: '提醒' }, new AbortController().signal, vi.fn(), factory)).rejects.toThrow('這次沒有完成翻譯')
  expect(instance.destroy).toHaveBeenCalledOnce()
})

it('空白翻譯結果也視為失敗', async () => {
  const { factory } = engine(vi.fn(async () => ' '))
  await expect(translateVisitNotes({ recommendation: '推薦', notice: '' }, new AbortController().signal, vi.fn(), factory)).rejects.toThrow('原本的文字沒有改變')
})

it('取消下載立即結束等待，遲到的引擎仍會釋放', async () => {
  let resolve!: (value: LocalTranslator) => void
  const { instance } = engine()
  const factory: TranslatorFactory = { create: () => new Promise((done) => { resolve = done }) }
  const controller = new AbortController()
  const task = translateVisitNotes({ recommendation: '推薦', notice: '' }, controller.signal, vi.fn(), factory)
  controller.abort()
  await expect(task).rejects.toThrow('已取消翻譯')
  resolve(instance)
  await Promise.resolve()
  expect(instance.destroy).toHaveBeenCalledOnce()
  expect(instance.translate).not.toHaveBeenCalled()
})

it('等待太久停止且釋放引擎', async () => {
  vi.useFakeTimers()
  const { instance, factory } = engine(vi.fn(() => new Promise<string>(() => undefined)))
  const task = translateVisitNotes({ recommendation: '推薦', notice: '' }, new AbortController().signal, vi.fn(), factory)
  const assertion = expect(task).rejects.toThrow('翻譯等待太久')
  await vi.advanceTimersByTimeAsync(180_000)
  await assertion
  expect(instance.destroy).toHaveBeenCalledOnce()
})
