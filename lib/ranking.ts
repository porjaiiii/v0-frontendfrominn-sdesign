// Leaderboard types and shared constants.
//
// These used to live in app/api/ranking/route.ts, which app/ranking/page.tsx and
// app/api/points/ranking/route.ts both imported a type from while neither ever
// fetched it. That route is deleted; this module is its only surviving part.

export type RankingEntry = {
  rank: number
  lineUserId: string
  name: string
  carbon: number
  /**
   * Spendable balance. Ranking is by `carbon`, not by this — the points column
   * is displayed only, so a redemption changes the number without moving the
   * user up or down.
   */
  points: number
  avatar: string
  location: string
  // นักท่องเที่ยว (tourist). Tourists are grouped together regardless of any
  // (possibly stale) ตำบล value on their profile.
  isTourist?: boolean
}

export const FALLBACK_AVATAR = '/placeholder.svg?height=40&width=40'

/**
 * Distinctive userType value written by the registration form. Post-migration
 * this is app.ref_user_type.is_tourist; the constant survives for the GAS path.
 */
export const TOURIST_USER_TYPE = 'นักท่องเที่ยว'

/** Shown when the backing store is empty or unreachable. */
export const SAMPLE_RANKING: Omit<RankingEntry, 'rank'>[] = [
  { lineUserId: 'Usample001', name: 'สมชาย ใจดี',      carbon: 256.5, points: 2565, avatar: FALLBACK_AVATAR, location: 'ตำบลบางกะเจ้า' },
  { lineUserId: 'Usample002', name: 'สมหญิง รักษ์โลก', carbon: 234.3, points: 2343, avatar: FALLBACK_AVATAR, location: 'ตำบลบางน้ำผึ้ง' },
  { lineUserId: 'Usample003', name: 'มนัส เกื้อกูล',   carbon: 112.4, points: 1124, avatar: FALLBACK_AVATAR, location: 'ตำบลบางกอบัว' },
  { lineUserId: 'Usample004', name: 'กมลา ตาวุดีมี',   carbon: 89.0,  points: 890,  avatar: FALLBACK_AVATAR, location: '' },
  { lineUserId: 'Usample005', name: 'ณัฐพล สิริมงคล',  carbon: 78.0,  points: 780,  avatar: FALLBACK_AVATAR, location: 'ตำบลบางกระสอบ' },
  { lineUserId: 'Usample006', name: 'วรรณา เจริญสุข',  carbon: 76.0,  points: 760,  avatar: FALLBACK_AVATAR, location: 'ตำบลบางยอ' },
  { lineUserId: 'Usample007', name: 'ประยุทธ รุ่งเรือง', carbon: 74.0, points: 740, avatar: FALLBACK_AVATAR, location: 'ตำบลทรงคะนอง' },
]

/** The caller's own grouping info, so the ตำบล tab works before they have points. */
export type CallerInfo = { location: string; isTourist: boolean }

export type RankingResponse = {
  ranking: RankingEntry[]
  isSample: boolean
  caller: CallerInfo | null
}
