import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import type { RankingEntry } from '@/app/api/ranking/route'

// Leaderboard built by reading Google Sheets DIRECTLY (Sheets API v4) — no Apps
// Script hop at all, mirroring the fast balance read on the rewards page:
//
//   carbon / points  ← points_account tab of the POINTS spreadsheet (POINTS_SHEETS_ID)
//   nickname / ตำบล   ← Registration tab of the REGISTRATION spreadsheet, keyed by
//                       LINE user id (the same sheet the registration Apps Script
//                       writes to — so names/nicknames match the profile page).
//
// Both are single Sheets reads run in parallel, so the whole build is well under
// a second (the previous GAS getUser fallback took ~30 s on cold starts).

export const maxDuration = 30

const POINTS_SHEETS_ID = process.env.POINTS_SHEETS_ID
const SHEETS_API_KEY   = process.env.GOOGLE_SHEETS_API_KEY

// Registration spreadsheet (bound to the registration Apps Script). Hardcoded to
// match the existing pattern for the script URLs; override via env if it moves.
const REG_SHEETS_ID = process.env.REGISTRATION_SHEETS_ID || '1PGowioVb4R961vkWB0nN2EhmTv6bEMJ9eQNtMQD7t8Y'
const REG_TAB = 'Registration'

const FALLBACK_AVATAR = '/placeholder.svg?height=40&width=40'

const SAMPLE_RANKING: Omit<RankingEntry, 'rank'>[] = [
  { lineUserId: 'Usample001', name: 'สมชาย ใจดี', carbon: 256.5, points: 2565, avatar: FALLBACK_AVATAR, location: 'ตำบลบางกะเจ้า' },
  { lineUserId: 'Usample002', name: 'สมหญิง รักษ์โลก', carbon: 234.3, points: 2343, avatar: FALLBACK_AVATAR, location: 'ตำบลบางน้ำผึ้ง' },
  { lineUserId: 'Usample003', name: 'มนัส เกื้อกูล', carbon: 112.4, points: 1124, avatar: FALLBACK_AVATAR, location: 'ตำบลบางกอบัว' },
  { lineUserId: 'Usample004', name: 'กมลา ตาวุดีมี', carbon: 89.0, points: 890, avatar: FALLBACK_AVATAR, location: '' },
  { lineUserId: 'Usample005', name: 'ณัฐพล สิริมงคล', carbon: 78.0, points: 780, avatar: FALLBACK_AVATAR, location: 'ตำบลบางกระสอบ' },
  { lineUserId: 'Usample006', name: 'วรรณา เจริญสุข', carbon: 76.0, points: 760, avatar: FALLBACK_AVATAR, location: 'ตำบลบางยอ' },
  { lineUserId: 'Usample007', name: 'ประยุทธ รุ่งเรือง', carbon: 74.0, points: 740, avatar: FALLBACK_AVATAR, location: 'ตำบลทรงคะนอง' },
]

type UserInfo = { name: string; avatar: string; location: string; isTourist: boolean }

// Distinctive userType value written by the registration form. Matching on the
// value (rather than a column position) is immune to header-name drift and to
// tourists who mistakenly also have a ตำบล filled in.
const TOURIST_USER_TYPE = 'นักท่องเที่ยว'
type RankingResult = { ranking: RankingEntry[]; isSample: boolean }

const SAMPLE_RESULT: RankingResult = {
  ranking: SAMPLE_RANKING.map((e, i) => ({ ...e, rank: i + 1 })),
  isSample: true,
}

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''))
  return Number.isFinite(n) ? n : 0
}

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

// Exact (trim + case-insensitive) header match — for the stable points_account tab.
function colIndex(headers: string[], name: string): number {
  const target = name.trim().toLowerCase()
  return headers.findIndex((h) => String(h ?? '').trim().toLowerCase() === target)
}

// Tolerant (substring) header match — the registration sheet's Thai headers vary.
function findCol(headers: string[], candidates: string[]): number {
  const norm = (s: unknown) => String(s ?? '').trim().toLowerCase()
  return headers.findIndex((h) => candidates.some((c) => norm(h).includes(norm(c))))
}

async function readTab(sheetId: string, tab: string): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
    tab
  )}?key=${SHEETS_API_KEY}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Sheets ${tab} read failed: ${res.status}`)
  const json = await res.json()
  return (json.values ?? []) as string[][]
}

// Names + locations from the Registration sheet, keyed by LINE user id. Prefers
// the nickname (ชื่อเล่น) — matching the profile page — and falls back to the
// full Thai name. The sheet has no avatar column, so everyone gets the
// placeholder; the logged-in viewer's real photo is patched client-side (LIFF).
async function buildNameMap(): Promise<Record<string, UserInfo>> {
  const map: Record<string, UserInfo> = {}
  if (!REG_SHEETS_ID || !SHEETS_API_KEY) return map
  try {
    const rows = await readTab(REG_SHEETS_ID, REG_TAB)
    if (rows.length <= 1) return map

    const h = rows[0]
    const idIdx   = findCol(h, ['line user id', 'lineuserid', 'line_user_id'])
    const nickIdx = findCol(h, ['ชื่อเล่น', 'nickname'])
    const fullIdx = findCol(h, ['ชื่อ-นามสกุล', 'fullname', 'full name'])
    const locIdx  = findCol(h, ['ตำบล', 'subdistrict'])
    const typeIdx = findCol(h, ['ประเภทผู้ใช้งาน', 'ประเภทผู้ใช้', 'usertype', 'user type', 'user_type'])
    if (idIdx < 0) return map

    for (const r of rows.slice(1)) {
      const lid = str(r[idIdx])
      if (!lid) continue
      const nick = nickIdx >= 0 ? str(r[nickIdx]) : ''
      const full = fullIdx >= 0 ? str(r[fullIdx]) : ''
      // Prefer the userType column; fall back to scanning the row for the
      // distinctive tourist value if the column header isn't recognised.
      const isTourist = typeIdx >= 0
        ? str(r[typeIdx]) === TOURIST_USER_TYPE
        : r.some((c) => str(c) === TOURIST_USER_TYPE)
      map[lid] = {
        name:     nick || full,
        avatar:   FALLBACK_AVATAR,
        location: locIdx >= 0 ? str(r[locIdx]) : '',
        isTourist,
      }
    }
  } catch (error) {
    console.error('[points-ranking] registration read error:', error)
  }
  return map
}

// carbon / points straight from points_account.
type AccountEntry = { lineUserId: string; carbon: number; points: number }

async function readAccounts(): Promise<AccountEntry[]> {
  if (!POINTS_SHEETS_ID || !SHEETS_API_KEY) return []
  const rows = await readTab(POINTS_SHEETS_ID, 'points_account')
  if (rows.length <= 1) return []

  const h = rows[0]
  const idIdx  = colIndex(h, 'user_id')
  const co2Idx = colIndex(h, 'total_co2')
  const ptsIdx = colIndex(h, 'total_points')
  if (idIdx < 0) return []

  return rows
    .slice(1)
    .map((r) => ({
      lineUserId: str(r[idIdx]),
      // carbon shows to 2 decimals; points are whole numbers.
      carbon: Math.round(toNumber(r[co2Idx]) * 100) / 100,
      points: Math.round(toNumber(r[ptsIdx])),
    }))
    .filter((e) => e.lineUserId)
}

async function buildRanking(): Promise<RankingResult> {
  try {
    // Both reads are independent — run them in parallel.
    const [entries, nameMap] = await Promise.all([readAccounts(), buildNameMap()])
    if (entries.length === 0) return SAMPLE_RESULT

    const ranking: RankingEntry[] = entries
      .sort((a, b) => b.carbon - a.carbon)
      .map((entry, i) => {
        const info = nameMap[entry.lineUserId]
        return {
          rank:       i + 1,
          lineUserId: entry.lineUserId,
          name:       info?.name || `ผู้ใช้ ${i + 1}`,
          carbon:     entry.carbon,
          points:     entry.points,
          avatar:     info?.avatar || FALLBACK_AVATAR,
          location:   info?.location || '',
          isTourist:  info?.isTourist ?? false,
        }
      })

    return { ranking, isSample: false }
  } catch (error) {
    console.error('[points-ranking] Error:', error)
    return SAMPLE_RESULT
  }
}

// Shared, viewer-independent cache. 60 s keeps the leaderboard fresh (carbon
// totals change slowly) while collapsing bursts onto a single pair of reads.
const getCachedRanking = unstable_cache(buildRanking, ['points-leaderboard'], {
  revalidate: 60,
  tags: ['points-leaderboard'],
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const callerUserId = searchParams.get('userId')?.trim() || ''
  const callerName   = searchParams.get('name')?.trim() || ''

  const result = await getCachedRanking()

  // Patch the caller's display name post-cache so the shared cached payload
  // stays viewer-independent (the page also patches this client-side from LIFF).
  const ranking = callerUserId && callerName
    ? result.ranking.map(e =>
        e.lineUserId === callerUserId ? { ...e, name: callerName } : e
      )
    : result.ranking

  return NextResponse.json({ ranking, isSample: result.isSample })
}
