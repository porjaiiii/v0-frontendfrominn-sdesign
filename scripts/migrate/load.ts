#!/usr/bin/env -S pnpm exec tsx
// scripts/migrate/load.ts
//
// The fourth stage — export → transform → verify → LOAD. Writes the
// transformed points-side records into the linked Supabase project's `app`
// schema via the service-role client, the same one lib/supabase/server.ts
// uses everywhere else.
//
// THIS CANNOT ACTUALLY RUN YET, and not because of the safety brake below —
// point_lots.line_user_id, point_transactions.line_user_id and
// spend_details.line_user_id are all FOREIGN KEYS against app.users
// (supabase/migrations/0001_schema.sql). app.users is populated from GAS #1
// (registration), which is still inaccessible — a bound script with no
// spreadsheet id in source, and REGISTRATION_SHEETS_ID is unset. Every one of
// the 44 real accounts verify.ts just reconciled would fail on
// waste_records_... — sorry, on the users FK the instant this tries to insert
// a lot for them, because none of those line_user_ids exist in app.users on
// this project yet.
//
// So: users (from GAS #1) load FIRST, always, or this whole file 23503s on
// its first row. Nothing here works around that, and nothing should.
//
// SAFETY BRAKE, independent of the above: refuses to run unless
// --confirm-target=<project-ref> is passed and matches the linked project's
// own ref (read from SUPABASE_URL, not from a value the caller could fat-
// finger past this check). This is the same class of mistake `force: true` on
// the Artifact tool guards against — a flag that must name the specific
// target, not just assert "yes I mean it".

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import {
  transformPointsAccount,
  transformPointsMonthly,
  transformPointsTransactions,
  transformSpendDetails,
} from './transform-points'
import type { CellValue } from './sheets-client'

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '.data')

function loadDotEnvLocal(): void {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
      if (!match) continue
      const [, key, value] = match
      if (!process.env[key]) process.env[key] = value.trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    // No .env.local — required vars are checked explicitly below.
  }
}

function loadTab(source: string, tab: string): CellValue[][] {
  const path = join(DATA_DIR, source, `${tab}.json`)
  const raw = readFileSync(path, 'utf8')
  return (JSON.parse(raw) as { unformatted: CellValue[][] }).unformatted
}

function projectRefFromUrl(url: string): string | null {
  return /^https:\/\/([a-z0-9]+)\.supabase\.co/.exec(url)?.[1] ?? null
}

async function main() {
  loadDotEnvLocal()

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('[load] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set')
    process.exitCode = 1
    return
  }

  const linkedRef = projectRefFromUrl(url)
  const confirmArg = process.argv.find((a) => a.startsWith('--confirm-target='))
  const confirmedRef = confirmArg?.split('=')[1]

  if (!linkedRef || confirmedRef !== linkedRef) {
    console.error(
      `[load] refusing to run. This would write into: ${url}\n` +
        `  Re-run with --confirm-target=${linkedRef ?? '<ref>'} to proceed — the flag must name ` +
        `THIS project, not just be present, so a copy-pasted command against the wrong env can't slip through.`,
    )
    process.exitCode = 1
    return
  }

  console.log(`[load] target confirmed: ${linkedRef}`)
  console.log('[load] transforming from scripts/migrate/.data/points ...')

  const monthlyRows = loadTab('points', 'points_monthly')
  const txRows = loadTab('points', 'points_transactions')
  const spendRows = loadTab('points', 'spend_details')
  const accountRows = loadTab('points', 'points_account')

  const { lots, quarantined: qLots } = transformPointsMonthly(monthlyRows)
  const { transactions, quarantined: qTx } = transformPointsTransactions(txRows)
  const { details, quarantined: qSpend } = transformSpendDetails(spendRows)
  const { accounts, quarantined: qAccounts } = transformPointsAccount(accountRows, lots, transactions)

  const totalQuarantined = qLots.length + qTx.length + qSpend.length + qAccounts.length
  if (totalQuarantined > 0) {
    console.error(
      `[load] ${totalQuarantined} row(s) quarantined by the transform — run \`pnpm migrate:verify\` ` +
        `and resolve them before loading. Refusing to load a partial, unreconciled set.`,
    )
    process.exitCode = 1
    return
  }

  const db = createClient(url, key, { db: { schema: 'app' } })

  // FK preflight — fail with a clear message instead of a 23503 on row 1.
  const userIds = [...new Set(accounts.map((a) => a.line_user_id))]
  const { data: knownUsers, error: userCheckError } = await db
    .from('users')
    .select('line_user_id')
    .in('line_user_id', userIds)
  if (userCheckError) throw userCheckError

  const known = new Set((knownUsers ?? []).map((u) => u.line_user_id))
  const missing = userIds.filter((id) => !known.has(id))
  if (missing.length > 0) {
    console.error(
      `[load] refusing to load — ${missing.length}/${userIds.length} of these accounts have no ` +
        `app.users row yet (point_lots.line_user_id is a foreign key). Load GAS #1's registration ` +
        `data first. First few missing: ${missing.slice(0, 5).join(', ')}`,
    )
    process.exitCode = 1
    return
  }

  console.log(`[load] all ${userIds.length} accounts have a users row — proceeding`)

  // Order matters: points_accounts (parent-ish, referenced nowhere itself)
  // can go in any order relative to the rest; point_lots before
  // point_transactions/spend_details is NOT required (no FK between them),
  // but keeping it in this order mirrors how a real earn happens.

  console.log(`[load] upserting ${accounts.length} points_accounts rows...`)
  {
    const { error } = await db.from('points_accounts').upsert(
      accounts.map((a) => ({
        line_user_id: a.line_user_id,
        lifetime_earned: a.lifetime_earned,
        lifetime_spent: a.lifetime_spent,
        total_weight_kg: a.total_weight_kg,
        total_co2_kg: a.total_co2_kg,
        // tier is NOT taken from the sheet — recomputed by the DB default /
        // application logic from total_weight_kg, same as every live write.
      })),
      { onConflict: 'line_user_id' },
    )
    if (error) throw error
  }

  console.log(`[load] inserting ${lots.length} point_lots rows...`)
  {
    const { error } = await db.from('point_lots').insert(
      lots.map((l) => ({
        line_user_id: l.line_user_id,
        period: l.period,
        earned_points: l.earned_points,
        consumed_points: l.consumed_points,
        status: l.status,
        expires_at: l.expires_at,
        earned_at: l.earned_at,
        source_waste_id: null,
        is_legacy: true,
      })),
    )
    if (error) throw error
  }

  console.log(`[load] inserting ${transactions.length} point_transactions rows (history only)...`)
  {
    const { error } = await db.from('point_transactions').insert(
      transactions.map((t) => ({
        tx_id: t.tx_id,
        line_user_id: t.line_user_id,
        kind: t.kind,
        points_delta: t.points_delta,
        co2_kg: t.co2_kg,
        weight_kg: t.weight_kg,
        is_legacy: true,
        occurred_at: t.occurred_at,
      })),
    )
    if (error) throw error
  }

  console.log(`[load] inserting ${details.length} spend_details rows...`)
  {
    const { error } = await db.from('spend_details').insert(
      details.map((d) => ({
        tx_id: d.tx_id,
        line_user_id: d.line_user_id,
        category: d.category,
        item_name: d.item_name,
        quantity: d.quantity,
        points: d.points,
        status: d.status,
        occurred_at: d.occurred_at,
      })),
    )
    if (error) throw error
  }

  console.log('[load] done. Run the balance-reconciliation query against v_user_balances next, by hand.')
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
