import { createGoogleMapsEmbedUrl, escapeHtml, normalizeFileName, parseYouTubeUrl, safeGoogleMapsUrl } from './security'

describe('安全工具', () => {
  it('解析常見 YouTube 網址為隱私加強嵌入網址', () => {
    expect(parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ?t=3')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(parseYouTubeUrl('https://youtube.com/shorts/dQw4w9WgXcQ?feature=share')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(parseYouTubeUrl('https://m.youtube.com/embed/dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(parseYouTubeUrl('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(parseYouTubeUrl('https://youtube.com/watch?v=too-short')).toBeNull()
    expect(parseYouTubeUrl('javascript:alert(1)')).toBeNull()
  })
  it('轉義會形成 HTML 的文字', () => {
    expect(escapeHtml(`<script>alert('x')&"y"</script>`)).toBe('&lt;script&gt;alert(&#39;x&#39;)&amp;&quot;y&quot;&lt;/script&gt;')
  })
  it('正規化檔名並保留安全副檔名', () => {
    expect(normalizeFileName('  My photo (1).JPG')).toBe('My-photo-1.jpg')
    expect(normalizeFileName('../../危險?.mp4')).toBe('危險.mp4')
    expect(normalizeFileName('景點 照片（最終版）#.JPEG')).toBe('景點-照片-最終版.jpeg')
    expect(normalizeFileName('***.png', 'photo')).toBe('photo.png')
  })
  it('只接受安全的 Google Maps 分享網址', () => {
    expect(safeGoogleMapsUrl('https://maps.app.goo.gl/AbCdEf123')).toBe('https://maps.app.goo.gl/AbCdEf123')
    expect(safeGoogleMapsUrl('https://www.google.com/maps/place/Taipei+101')).toBe('https://www.google.com/maps/place/Taipei+101')
    expect(safeGoogleMapsUrl('https://www.google.com.tw/maps?q=台北')).not.toBeNull()
    expect(safeGoogleMapsUrl('https://example.com/maps')).toBeNull()
    expect(safeGoogleMapsUrl('https://google.com.evil.example/maps')).toBeNull()
    expect(safeGoogleMapsUrl('javascript:alert(1)')).toBeNull()
  })
  it('用地址建立不需金鑰的地圖嵌入網址', () => {
    expect(createGoogleMapsEmbedUrl('  臺北市信義區市府路 45 號  ')).toBe('https://maps.google.com/maps?q=%E8%87%BA%E5%8C%97%E5%B8%82%E4%BF%A1%E7%BE%A9%E5%8D%80%E5%B8%82%E5%BA%9C%E8%B7%AF%2045%20%E8%99%9F&z=15&output=embed')
    expect(createGoogleMapsEmbedUrl('   ')).toBeNull()
  })
})
