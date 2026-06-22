import { NextResponse } from 'next/server'
import { POINTS_SCRIPT_URL } from '@/lib/points-config'
import type { RankingEntry } from '@/app/api/ranking/route'

// Leaderboard backed by the NEW points spreadsheet (points_account tab),
// served through the Apps Script `get_leaderboard` action.
//
// Carbon/points come from points_account; display names + locations are
// cross-referenced from the REGISTRATION sheet (the same Apps Script the
// profile page uses), keyed by LINE user id (== points_account.user_id).

// Allow time for the per-user fallback (getUser lookups) on cold starts.
export const maxDuration = 60

// Registration Apps Script — same web app as /api/register and /api/profile/[id].
const REGISTRATION_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxXbPMRk1PXSbw5vLEvbCQPfFkPZithJXStciUM2oZ__y9ct1OPVUlM-YfvF7ZpDVKG/exec'

const SAMPLE_RANKING: Omit<RankingEntry, 'rank'>[] = [
  { lineUserId: 'Usample001', name: 'สมชาย ใจดี', carbon: 256.5, points: 2565, avatar: '/placeholder.svg?height=40&width=40', location: 'ตำบลบางกะเจ้า' },
  { lineUserId: 'Usample002', name: 'สมหญิง รักษ์โลก', carbon: 234.3, points: 2343, avatar: '/placeholder.svg?height=40&width=40', location: 'ตำบลบางน้ำผึ้ง' },
  { lineUserId: 'Usample003', name: 'มนัส เกื้อกูล', carbon: 112.4, points: 1124, avatar: '/placeholder.svg?height=40&width=40', location: 'ตำบลบางกอบัว' },
  { lineUserId: 'Usample004', name: 'กมลา ตาวุดีมี', carbon: 89.0, points: 890, avatar: '/placeholder.svg?height=40&width=40', location: '' },
  { lineUserId: 'Usample005', name: 'ณัฐพล สิริมงคล', carbon: 78.0, points: 780, avatar: '/placeholder.svg?height=40&width=40', location: 'ตำบลบางกระสอบ' },
  { lineUserId: 'Usample006', name: 'วรรณา เจริญสุข', carbon: 76.0, points: 760, avatar: '/placeholder.svg?height=40&width=40', location: 'ตำบลบางยอ' },
  { lineUserId: 'Usample007', name: 'ประยุทธ รุ่งเรือง', carbon: 74.0, points: 740, avatar: '/placeholder.svg?height=40&width=40', location: 'ตำบลทรงคะนอง' },
]

function sample() {
  return NextResponse.json({
    ranking: SAMPLE_RANKING.map((e, i) => ({ ...e, rank: i + 1 })),
    isSample: true,
  })
}

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''))
  return Number.isFinite(n) ? n : 0
}

const FALLBACK_AVATAR = '/placeholder.svg?height=40&width=40'
type UserInfo = { name: string; avatar: string; location: string }

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

// Map a raw registration user object (tolerant of field-name variants) → UserInfo.
function toUserInfo(u: any): UserInfo {
  return {
    name:     str(u?.fullName ?? u?.name ?? u?.displayName),
    avatar:   str(u?.avatar ?? u?.pictureUrl ?? u?.picture) || FALLBACK_AVATAR,
    location: str(u?.subdistrict ?? u?.location),
  }
}

function userIdOf(u: any): string {
  return str(u?.lineUserId ?? u?.line_user_id ?? u?.userId ?? u?.user_id)
}

// Bulk path: one `getAllUsers` call to the registration script (fast). Returns
// an empty map if the action isn't implemented / yields nothing.
async function fetchAllUsers(): Promise<Record<string, UserInfo>> {
  const map: Record<string, UserInfo> = {}
  try {
    const res = await fetch(REGISTRATION_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getAllUsers' }),
      cache: 'no-store',
    })
    if (!res.ok) return map
    const data = await res.json().catch(() => null)
    const users: any[] = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.users)
      ? data.users
      : Array.isArray(data)
      ? data
      : []
    users.forEach(u => {
      const lid = userIdOf(u)
      if (lid) map[lid] = toUserInfo(u)
    })
  } catch {
    // ignore — caller falls back to per-user lookups
  }
  return map
}

// Fallback path: look up one user via the registration script's `getUser`
// (already supported by the deployed script the profile page uses).
async function fetchOneUser(lineUserId: string): Promise<UserInfo | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12_000)
    const res = await fetch(REGISTRATION_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getUser', lineUserId }),
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    if (data?.status === 'success' && data?.data) return toUserInfo(data.data)
    return null
  } catch {
    return null
  }
}

// Run async tasks with a small concurrency cap (keep GAS happy).
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  })
  await Promise.all(workers)
  return results
}

// Pull display names / avatars / locations from the REGISTRATION sheet, keyed by
// LINE user id. Tries the bulk `getAllUsers` action first; if that isn't
// available it falls back to per-user `getUser` lookups for the leaderboard ids.
async function buildNameMap(userIds: string[]): Promise<Record<string, UserInfo>> {
  const bulk = await fetchAllUsers()
  if (Object.keys(bulk).length > 0) return bulk

  // Fallback — resolve each leaderboard user individually.
  const map: Record<string, UserInfo> = {}
  const infos = await mapWithConcurrency(userIds, 8, fetchOneUser)
  userIds.forEach((id, i) => {
    const info = infos[i]
    if (info) map[id] = info
  })
  return map
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const callerUserId = searchParams.get('userId')?.trim() || ''
  const callerName   = searchParams.get('name')?.trim() || ''

  try {
    // The Apps Script guard requires a user_id; pass a sentinel for the leaderboard call.
    const url = `${POINTS_SCRIPT_URL}?action=get_leaderboard&user_id=leaderboard`
    const res = await fetch(url, { cache: 'no-store' })

    if (!res.ok) {
      console.error('[points-ranking] script error:', res.status, await res.text())
      return sample()
    }

    const data = await res.json()
    const accounts: any[] = Array.isArray(data?.accounts) ? data.accounts : []

    const entries = accounts
      .map(a => ({
        lineUserId: String(a.user_id ?? '').trim(),
        carbon:     toNumber(a.total_co2),
        points:     toNumber(a.total_points),
      }))
      .filter(e => e.lineUserId)

    if (entries.length === 0) return sample()

    const nameMap = await buildNameMap(entries.map(e => e.lineUserId))

    const ranking: RankingEntry[] = entries
      .sort((a, b) => b.carbon - a.carbon)
      .map((entry, i) => {
        const info = nameMap[entry.lineUserId]
        const isCaller = callerUserId && entry.lineUserId === callerUserId
        return {
          rank:       i + 1,
          lineUserId: entry.lineUserId,
          name:       isCaller && callerName ? callerName : info?.name || `ผู้ใช้ ${i + 1}`,
          carbon:     entry.carbon,
          points:     entry.points,
          avatar:     info?.avatar || FALLBACK_AVATAR,
          location:   info?.location || '',
        }
      })

    return NextResponse.json({ ranking, isSample: false })
  } catch (error) {
    console.error('[points-ranking] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch ranking' }, { status: 500 })
  }
}
