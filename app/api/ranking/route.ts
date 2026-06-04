import { NextResponse } from 'next/server'

export type RankingEntry = {
  rank: number
  lineUserId: string
  name: string
  carbon: number
  points: number
  avatar: string
  location: string
}

// Sample data used as fallback when the Google Sheet 'point' tab is empty.
// To use real data, populate the sheet with rows matching these columns:
//   LINE User ID | total points | total kgCO2e
const SAMPLE_RANKING: Omit<RankingEntry, 'rank'>[] = [
  { lineUserId: 'Usample001', name: 'สมชาย ใจดี', carbon: 256.5, points: 2565, avatar: '/placeholder.svg?height=40&width=40', location: 'ตำบลบางกะเจ้า' },
  { lineUserId: 'Usample002', name: 'สมหญิง รักษ์โลก', carbon: 234.3, points: 2343, avatar: '/placeholder.svg?height=40&width=40', location: 'ตำบลบางน้ำผึ้ง' },
  { lineUserId: 'Usample003', name: 'มนัส เกื้อกูล', carbon: 112.4, points: 1124, avatar: '/placeholder.svg?height=40&width=40', location: 'ตำบลบางกอบัว' },
  { lineUserId: 'Usample004', name: 'กมลา ตาวุดีมี', carbon: 89.0, points: 890, avatar: '/placeholder.svg?height=40&width=40', location: '' },
  { lineUserId: 'Usample005', name: 'ณัฐพล สิริมงคล', carbon: 78.0, points: 780, avatar: '/placeholder.svg?height=40&width=40', location: 'ตำบลบางกระสอบ' },
  { lineUserId: 'Usample006', name: 'วรรณา เจริญสุข', carbon: 76.0, points: 760, avatar: '/placeholder.svg?height=40&width=40', location: 'ตำบลบางยอ' },
  { lineUserId: 'Usample007', name: 'ประยุทธ รุ่งเรือง', carbon: 74.0, points: 740, avatar: '/placeholder.svg?height=40&width=40', location: 'ตำบลทรงคะนอง' },
]

function parseCSV(text: string): string[][] {
  return text.split('\n').map(line =>
    line.split(',').map(cell => cell.trim().replace(/^"(.*)"$/, '$1'))
  )
}

function findColumnIndex(headers: string[], possibleNames: string[]): number {
  return headers.findIndex(h =>
    possibleNames.some(name => h?.toLowerCase().trim().includes(name))
  )
}

export type RankingResponse =
  | { ranking: RankingEntry[]; isSample: boolean }
  | { error: string }

export async function GET() {
  const sheetId = process.env.GOOGLE_SHEETS_ID

  if (!sheetId) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 })
  }

  try {
    const pointsUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&sheet=point`
    const pointsRes = await fetch(pointsUrl, { cache: 'no-store' })

    if (!pointsRes.ok) {
      return NextResponse.json({
        ranking: SAMPLE_RANKING.map((e, i) => ({ ...e, rank: i + 1 })),
        isSample: true,
      })
    }

    const pointsCsv = await pointsRes.text()
    const rows = parseCSV(pointsCsv)
    const dataRows = rows.slice(1).filter(r => r.some(cell => cell.trim()))

    if (rows.length <= 1 || dataRows.length === 0) {
      return NextResponse.json({
        ranking: SAMPLE_RANKING.map((e, i) => ({ ...e, rank: i + 1 })),
        isSample: true,
      })
    }

    const headers = rows[0]
    const lineIdIdx = findColumnIndex(headers, ['line user id', 'lineuserid', 'line_user_id'])
    const co2Idx = findColumnIndex(headers, ['kgco2e', 'kgco2', 'co2', 'carbon'])
    const pointsIdx = findColumnIndex(headers, ['total points', 'totalpoints', 'points'])

    const entries = dataRows
      .map(row => ({
        lineUserId: lineIdIdx >= 0 ? row[lineIdIdx]?.trim() || '' : '',
        carbon: co2Idx >= 0 ? parseFloat(row[co2Idx]) || 0 : 0,
        points: pointsIdx >= 0 ? parseFloat(row[pointsIdx]) || 0 : 0,
      }))
      .filter(e => e.lineUserId)

    if (entries.length === 0) {
      return NextResponse.json({
        ranking: SAMPLE_RANKING.map((e, i) => ({ ...e, rank: i + 1 })),
        isSample: true,
      })
    }

    // Cross-reference the default profile sheet to get names and locations
    const nameMap: Record<string, { name: string; avatar: string; location: string }> = {}
    try {
      const profileUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`
      const profileRes = await fetch(profileUrl, { cache: 'no-store' })
      if (profileRes.ok) {
        const profileCsv = await profileRes.text()
        const profileRows = parseCSV(profileCsv)
        if (profileRows.length > 1) {
          const ph = profileRows[0]
          const pLineIdx = findColumnIndex(ph, ['line', 'lineuserid'])
          const pNameIdx = findColumnIndex(ph, ['ชื่อ', 'name'])
          const pAvatarIdx = findColumnIndex(ph, ['ภาพ', 'picture', 'avatar'])
          const pLocIdx = findColumnIndex(ph, ['ตำบล', 'subdistrict'])
          profileRows.slice(1).forEach(row => {
            const lid = pLineIdx >= 0 ? row[pLineIdx]?.trim() : ''
            if (lid) {
              nameMap[lid] = {
                name: pNameIdx >= 0 ? row[pNameIdx]?.trim() || '' : '',
                avatar: pAvatarIdx >= 0 && row[pAvatarIdx]?.trim()
                  ? row[pAvatarIdx].trim()
                  : '/placeholder.svg?height=40&width=40',
                location: pLocIdx >= 0 ? row[pLocIdx]?.trim() || '' : '',
              }
            }
          })
        }
      }
    } catch {
      // Profile fetch failed — continue without names
    }

    const ranking: RankingEntry[] = entries
      .sort((a, b) => b.carbon - a.carbon)
      .map((entry, i) => ({
        rank: i + 1,
        lineUserId: entry.lineUserId,
        name: nameMap[entry.lineUserId]?.name || `ผู้ใช้ ${i + 1}`,
        carbon: entry.carbon,
        points: entry.points,
        avatar: nameMap[entry.lineUserId]?.avatar || '/placeholder.svg?height=40&width=40',
        location: nameMap[entry.lineUserId]?.location || '',
      }))

    return NextResponse.json({ ranking, isSample: false })
  } catch (error) {
    console.error('[ranking] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch ranking' }, { status: 500 })
  }
}
