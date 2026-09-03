import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'

import { SAMPLE_RANKING, type CallerInfo, type RankingEntry } from '@/lib/ranking'
import { getLeaderboard } from '@/lib/supabase/reads'

// The leaderboard.
//
// One query against app.v_leaderboard, which already joins the balances, the
// account aggregates and the user's ตำบล / tourist flag. It replaced two
// parallel Sheets reads (points_account + Registration) cross-referenced by
// LINE user id.
//
// Ordered by carbon descending; `points` is the spendable balance and is
// displayed rather than ranked on, so redeeming never moves a user's rank.
//
// app/api/ranking (a third, unused leaderboard over the legacy `point` tab) and
// app/api/ranking/debug (an unauthenticated raw-sheet dump) are deleted; the
// RankingEntry type they exported now lives in lib/ranking.ts.

export const maxDuration = 15

type UserInfo = { name: string; avatar: string; location: string; isTourist: boolean }

// nameMap is kept on the (server-side, viewer-independent) cached result so GET
// can look up any caller's own ตำบล/tourist status without re-reading the source.
type RankingResult = { ranking: RankingEntry[]; isSample: boolean; nameMap: Record<string, UserInfo> }

const SAMPLE_RESULT: RankingResult = {
  ranking: SAMPLE_RANKING.map((e, i) => ({ ...e, rank: i + 1 })),
  isSample: true,
  nameMap: {},
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

// Shared, viewer-independent cache. 60 s keeps the leaderboard fresh (carbon
// totals change slowly) while collapsing bursts onto a single pair of reads.
const getCachedRanking = unstable_cache(buildRankingFromSupabase, ['points-leaderboard'], {
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

  // Caller's own ตำบล/tourist status, so the
  // ตำบล tab groups correctly even before the caller has any points.
  const info = callerUserId ? result.nameMap[callerUserId] : undefined
  const caller: CallerInfo | null = info
    ? { location: info.location, isTourist: info.isTourist }
    : null

  return NextResponse.json({ ranking, isSample: result.isSample, caller })
}
