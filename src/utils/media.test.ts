import { MAX_VIDEO_SIZE, validateVideoFile } from './media'

describe('本機影片檢查', () => {
  it('接受中英文與特殊字元檔名的 MP4', () => {
    expect(validateVideoFile({ name: '台灣 景點（完成版）#1.MP4', type: 'video/mp4', size: 1024 })).toBeNull()
  })
  it('拒絕不支援格式並告訴學生怎麼修正', () => {
    expect(validateVideoFile({ name: 'movie.webm', type: 'video/webm', size: 1024 })).toContain('MP4')
  })
  it('拒絕超過 50MB 的影片', () => {
    expect(validateVideoFile({ name: 'movie.mp4', type: 'video/mp4', size: MAX_VIDEO_SIZE + 1 })).toContain('超過 50MB')
  })
})
