import type { ProjectData } from './types'

export const STEPS = ['基本資料', '中英文介紹', '照片', '影片與交通資訊', '預覽與下載']

export function createEmptyProject(): ProjectData {
  return {
    version: 1, updatedAt: new Date().toISOString(), titleZh: '', titleEn: '', type: '景點',
    taglineZh: '', taglineEn: '', address: '', hours: '', fee: '', groupName: '',
    introZh: '', introEn: '',
    highlights: [{ id: crypto.randomUUID(), textZh: '', textEn: '' }],
    reflections: [{ id: crypto.randomUUID(), memberLabel: '', text: '' }],
    recommendation: '', recommendationEn: '', notice: '', noticeEn: '', mapsUrl: '', transportZh: '', transportEn: '',
    videoMode: 'youtube', youtubeUrl: '', video: null, photos: [], coverId: '', theme: 'nature', customCss: '', customCssFileName: '',
    privacy: { noPrivateData: false, mediaPermission: false, understandsPublic: false, checkedBackground: false },
  }
}

export function createSampleProject(): ProjectData {
  return {
    ...createEmptyProject(),
    titleZh: '清風老街', titleEn: 'Breeze Old Street', type: '歷史文化',
    taglineZh: '沿著紅磚街屋，發現小鎮的百年故事。',
    taglineEn: 'Walk along the red-brick houses and discover a century of stories.',
    address: '臺灣幸福縣清風鎮文化路 1 號', hours: '每日 09:00–18:00', fee: '免費參觀', groupName: '清風探索隊',
    introZh: '清風老街是一條虛構的臺灣街道。街上保留傳統紅磚建築，也有販售在地點心的小店，適合慢慢散步與觀察建築細節。',
    introEn: 'Breeze Old Street is a fictional place in Taiwan. Its red-brick buildings and local snack shops make it a relaxing place to walk and learn about old architecture.',
    highlights: [
      { id: crypto.randomUUID(), textZh: '紅磚拱廊', textEn: 'Red-brick arcades' },
      { id: crypto.randomUUID(), textZh: '傳統點心', textEn: 'Traditional snacks' },
      { id: crypto.randomUUID(), textZh: '老屋故事', textEn: 'Stories of old houses' },
    ],
    reflections: [
      { id: crypto.randomUUID(), memberLabel: '組員 1', text: '我負責整理老街的歷史資料。原本只注意到好吃的點心，實際查資料後才發現紅磚街屋也保存了居民生活的故事。製作英文介紹時最困難的是選擇簡單又正確的詞，我和組員一起修改後，覺得合作比自己完成更有效率。' },
      { id: crypto.randomUUID(), memberLabel: '組員 2', text: '我負責拍照和剪輯影片。拍攝時要一直注意畫面裡有沒有路人或私人資料，也學會從不同角度呈現地方特色。如果再做一次，我會先列好拍攝清單，讓現場工作更順利。' },
    ],
    recommendation: '傍晚光線柔和，很適合拍攝街屋，也可以和店家有禮貌地聊聊地方故事。',
    recommendationEn: 'The soft evening light is perfect for taking photos of the old houses. You can also politely ask shop owners about local stories.',
    notice: '部分路面不平，下雨時請放慢腳步。',
    noticeEn: 'Some paths are uneven. Please walk carefully when it rains.',
    transportZh: '從清風車站步行約 10 分鐘。', transportEn: 'It is about a 10-minute walk from Breeze Station.',
    theme: 'history', updatedAt: new Date().toISOString(),
  }
}
