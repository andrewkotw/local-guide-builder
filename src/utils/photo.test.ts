import { movePhoto, processPhoto } from './photo'

it('照片排序不會改動原陣列', () => {
  const original = ['a', 'b', 'c']; expect(movePhoto(original, 2, 0)).toEqual(['c', 'a', 'b']); expect(original).toEqual(['a', 'b', 'c'])
})

it('像素異常大的圖片會被拒絕並立即釋放解碼記憶體', async () => {
  const close = vi.fn()
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 10_000, height: 6_000, close }))
  try {
    await expect(processPhoto(new File(['jpeg'], '巨大照片.jpg', { type: 'image/jpeg' }))).rejects.toThrow('這張照片的長寬尺寸太大')
    expect(close).toHaveBeenCalledOnce()
  } finally { vi.unstubAllGlobals() }
})
