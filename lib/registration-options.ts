/**
 * The values the registration form offers, and the only ones the API accepts.
 *
 * These used to live in two places at once: `app.ref_gender` and friends in
 * Postgres (enforced as foreign keys on app.users) and hardcoded arrays in
 * app/register/page.tsx. The tables are gone as of
 * supabase/migrations/0011_drop_ref_tables.sql — they held no behaviour, only a
 * list, and every change to a list cost a migration.
 *
 * `ref_user_type` was NOT dropped and is deliberately absent from this file: it
 * carries `is_tourist`, which app.v_leaderboard joins to decide who appears as
 * a tourist. That one is a table because it does work, not because it is a list.
 *
 * Values are verbatim from supabase/migrations/0003_seed_catalog.sql and must
 * stay that way — rows already in production are stored under these exact
 * strings. Note `'อื่นๆ'` (occupation) and `'อื่น ๆ'` (subdistrict) differ by a
 * space; that is faithful to the seed, not a typo to tidy up.
 */

export const GENDERS = ['ชาย', 'หญิง', 'LGBTQ+', 'ไม่ระบุ'] as const

export const AGE_RANGES = ['ต่ำกว่า 25', '26-45', '46-60', '61 ปีขึ้นไป'] as const

export const USER_TYPES = ['คนในชุมชนคุ้งบางกะเจ้า', 'นักท่องเที่ยว'] as const

export const SUBDISTRICTS = [
  'ทรงคนอง',
  'บางกระสอบ',
  'บางน้ำผึ้ง',
  'บางยอ',
  'บางกอบัว',
  'บางกะเจ้า',
  'อื่น ๆ',
] as const

export const OCCUPATIONS = [
  'ผู้ประกอบการ (ร้านค้า/โฮมสเตย์)',
  'เกษตรกร',
  'ข้าราชการ/พนักงานของรัฐ',
  'พนักงานบริษัทเอกชน',
  'รับจ้างทั่วไป',
  'นักเรียน/นักศึกษา',
  'ผู้เกษียณอายุ/ว่างงาน',
  'อื่นๆ',
] as const

export type Gender = (typeof GENDERS)[number]
export type AgeRange = (typeof AGE_RANGES)[number]
export type UserType = (typeof USER_TYPES)[number]
export type Subdistrict = (typeof SUBDISTRICTS)[number]
export type Occupation = (typeof OCCUPATIONS)[number]
