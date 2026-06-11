import { NextResponse } from 'next/server'
import { POINTS_SCRIPT_URL } from '@/lib/points-config'
import type { RankingEntry } from '@/app/api/ranking/route'

// Leaderboard backed by the NEW points spreadsheet (points_account tab),
// served through the Apps Script `get_leaderboard` action.
//
// Carbon/points come from points_account; display names + locations are
// cross-referenced from the registration/profile sheet (keyed by LINE user id,
// which equals points_account.user_id).

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

function parseCSV(text: string): string[][] {
  return text.split('\n').map(line =>
    line.split(',').map(cell => cell.trim().replace(/^"(.*)"$/, '$1'))
  )
}

function normalizeHeader(h: string): string {
  return (h ?? '').toLowerCase().trim().replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x2050)
  )
}

function findColumnIndex(headers: string[], possibleNames: string[]): number {
  return headers.findIndex(h =>
    possibleNames.some(name => normalizeHeader(h).includes(name))
  )
}

// Pull display names / avatars / locations from the registration profile sheet.
async function buildNameMap(): Promise<Record<string, { name: string; avatar: string; location: string }>> {
  const nameMap: Record<string, { name: string; avatar: string; location: string }> = {}
  const sheetId = process.env.GOOGLE_SHEETS_ID
  if (!sheetId) return nameMap

  try {
    const profileUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`
    const profileRes = await fetch(profileUrl, { cache: 'no-store' })
    if (!profileRes.ok) return nameMap

    const profileRows = parseCSV(await profileRes.text())
    if (profileRows.length <= 1) return nameMap

    const ph = profileRows[0]
    const pLineIdx    = findColumnIndex(ph, ['line user id', 'lineuserid', 'line_user_id'])
    const pNameIdx    = findColumnIndex(ph, ['ชื่อ-นามสกุล', 'fullname', 'full name'])
    const pAltNameIdx = findColumnIndex(ph, ['ชื่อ', 'name', 'ชื่อไลน์', 'ชื่อที่แสดง', 'displayname', 'display name', 'ชื่อเล่น'])
    const pAvatarIdx  = findColumnIndex(ph, ['ภาพ', 'picture', 'avatar'])
    const pLocIdx     = findColumnIndex(ph, ['ตำบล', 'subdistrict'])

    profileRows.slice(1).forEach(row => {
      const lid = pLineIdx >= 0 ? row[pLineIdx]?.trim() : ''
      if (lid) {
        const primaryName = pNameIdx    >= 0 ? row[pNameIdx]?.trim()    || '' : ''
        const altName     = pAltNameIdx >= 0 ? row[pAltNameIdx]?.trim() || '' : ''
        nameMap[lid] = {
          name:     primaryName || altName,
          avatar:   pAvatarIdx >= 0 && row[pAvatarIdx]?.trim()
                      ? row[pAvatarIdx].trim()
                      : '/placeholder.svg?height=40&width=40',
          location: pLocIdx    >= 0 ? row[pLocIdx]?.trim()    || '' : '',
        }
      }
    })
  } catch {
    // Profile fetch failed — continue without names.
  }
  return nameMap
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

    const nameMap = await buildNameMap()

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
          avatar:     info?.avatar || '/placeholder.svg?height=40&width=40',
          location:   info?.location || '',
        }
      })

    return NextResponse.json({ ranking, isSample: false })
  } catch (error) {
    console.error('[points-ranking] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch ranking' }, { status: 500 })
  }
}
