// Neutral placeholder shown while real data is loading (or when LIFF/DB data
// isn't available). Kept intentionally generic so a user never sees someone
// else's name/stats and thinks the app is broken.
export const MOCK_USER = {
  lineUserId:    'mock-current-user',
  name:          'กำลังโหลดข้อมูล...',
  displayName:   'กำลังโหลดข้อมูล...',
  avatar:        '/placeholder-user.jpg',

  gender:        '-',
  age:           '-',
  type:          '-',
  subdistrict:   '-',
  location:      '',
  occupation:    '-',

  carbon:        0,
  points:        0,
  treesPlanted:  0,
  totalRecycled: 0,
} as const
