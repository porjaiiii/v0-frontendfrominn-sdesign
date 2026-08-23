import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'

import { backendFor } from '@/lib/backend-flags'
import {
  FALLBACK_AVATAR,
  SAMPLE_RANKING,
  TOURIST_USER_TYPE,
  type CallerInfo,
  type RankingEntry,
} from '@/lib/ranking'
import { getLeaderboard } from '@/lib/supabase/reads'

// The leaderboard.
//
// supabase path: one query against app.v_leaderboard, which already joins the
//   balances, the account aggregates and the user's ตำบล / tourist flag.
// gas path:      two parallel Sheets reads (points_account + Registration)
//   cross-referenced by LINE user id.
//
// Both order by carbon descending; `points` is the spendable balance and is
// displayed rather than ranked on, so redeeming never moves a user's rank.
//
// app/api/ranking (a third, unused leaderboard over the legacy `point` tab) and
// app/api/ranking/debug (an unauthenticated raw-sheet dump) are deleted; the
// RankingEntry type they exported now lives in lib/ranking.ts.

export const maxDuration = 30

const POINTS_SPREADSHEET_ID = process.env.POINTS_SPREADSHEET_ID
const SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY

// Registration spreadsheet (bound to the registration Apps Script). Hardcoded to
// match the existing pattern for the script URLs; override via env if it moves.
const REG_SHEETS_ID = process.env.REGISTRATION_SHEETS_ID || '1vvBe_ZySfSq4oP8tfwHDUg-Jo3gBr9QanQWqLATAkNE'
const REG_TAB = 'Registration'

type UserInfo = { name: string; avatar: string; location: string; isTourist: boolean }

// nameMap is kept on the (server-side, viewer-independent) cached result so GET
// can look up any caller's own ตำบล/tourist status without re-reading the sheet.
type RankingResult = { ranking: RankingEntry[]; isSample: boolean; nameMap: Record<string, UserInfo> }

const SAMPLE_RESULT: RankingResult = {
  ranking: SAMPLE_RANKING.map((e, i) => ({ ...e, rank: i + 1 })),
  isSample: true,
  nameMap: {},
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
  if (!POINTS_SPREADSHEET_ID || !SHEETS_API_KEY) return []
  const rows = await readTab(POINTS_SPREADSHEET_ID, 'points_account')
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

async function buildRankingFromSheets(): Promise<RankingResult> {
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

    return { ranking, isSample: false, nameMap }
  } catch (error) {
    console.error('[points-ranking] Error:', error)
    return SAMPLE_RESULT
  }
}

async function buildRankingFromSupabase(): Promise<RankingResult> {
  try {
    const { ranking, byUser } = await getLeaderboard()
    if (ranking.length === 0) return SAMPLE_RESULT

    const nameMap: Record<string, UserInfo> = {}
    for (const entry of ranking) {
      nameMap[entry.lineUserId] = {
        name: entry.name,
        avatar: entry.avatar,
        location: byUser[entry.lineUserId]?.location ?? '',
        isTourist: byUser[entry.lineUserId]?.isTourist ?? false,
      }
    }

    return { ranking, isSample: false, nameMap }
  } catch (error) {
    console.error('[points-ranking] supabase error:', error)
    return SAMPLE_RESULT
  }
}

async function buildRanking(): Promise<RankingResult> {
  return backendFor('points') === 'supabase'
    ? buildRankingFromSupabase()
    : buildRankingFromSheets()
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

  // Caller's own ตำบล/tourist status (from the registration name map), so the
  // ตำบล tab groups correctly even before the caller has any points.
  const info = callerUserId ? result.nameMap[callerUserId] : undefined
  const caller: CallerInfo | null = info
    ? { location: info.location, isTourist: info.isTourist }
    : null

  return NextResponse.json({ ranking, isSample: result.isSample, caller })
}
