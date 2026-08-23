#!/usr/bin/env -S pnpm exec tsx
// scripts/migrate/load.ts
//
// The fourth stage — export → transform → verify → LOAD. Writes the
// transformed points-side records into the linked Supabase project's `app`
// schema via the service-role client, the same one lib/supabase/server.ts
// uses everywhere else.
//
// Loads BOTH halves: the registration side (app.users, waste_records, coupons,
// admin_keys, via transform-registration.ts) and the points ledger.
//
// Order is dictated by the foreign keys, not by preference:
//
//   1. users          — everything below references it
//   2. points ledger  — points_accounts/lots/transactions/spend_details
//   3. waste_records, coupons, admin_keys — coupons.tx_id references
//      point_transactions, so this cannot move above step 2
//
// Re-runnable by construction. users/coupons/admin_keys upsert on their natural
// primary keys; waste_records has none, so each row carries a deterministic
// idempotency_key ('legacy:submission:<sheet row>') and rides the partial
// unique index at 0001_schema.sql:218 as an on-conflict-do-nothing. The points
// block has no natural key to conflict on, so it is skipped outright if legacy
// lots are already present rather than inserted twice.
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
import type { QuarantinedRow } from './transform-points'
import {
  transformAdminKeys,
  transformCoupons,
  transformRegistration,
  transformSubmission,
} from './transform-registration'
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
  console.log('[load] transforming from scripts/migrate/.data ...')

  // ---- points ledger -------------------------------------------------------
  const monthlyRows = loadTab('points', 'points_monthly')
  const txRows = loadTab('points', 'points_transactions')
  const spendRows = loadTab('points', 'spend_details')
  const accountRows = loadTab('points', 'points_account')

  const { lots, quarantined: qLots } = transformPointsMonthly(monthlyRows)
  const { transactions, quarantined: qTx } = transformPointsTransactions(txRows)
  const { details, quarantined: qSpend } = transformSpendDetails(spendRows)
  const { accounts, quarantined: qAccounts } = transformPointsAccount(accountRows, lots, transactions)

  // ---- registration side ---------------------------------------------------
  const { users, quarantined: qUsers, duplicatesCollapsed } = transformRegistration(
    loadTab('registration', 'Registration'),
  )
  const { records, quarantined: qRecords } = transformSubmission(loadTab('registration', 'submission'))
  const { coupons, quarantined: qCoupons } = transformCoupons(loadTab('registration', 'coupons'))
  const { keys, quarantined: qKeys } = transformAdminKeys(loadTab('registration', 'AdminKeys'))

  console.log(
    `[load] transformed: ${users.length} users (${duplicatesCollapsed} re-submit(s) collapsed), ` +
      `${records.length} waste records, ${coupons.length} coupons, ${keys.length} admin keys, ` +
      `${accounts.length} points accounts, ${lots.length} lots, ${transactions.length} transactions, ` +
      `${details.length} spend details`,
  )

  const allQuarantined: QuarantinedRow[] = [
    ...qLots, ...qTx, ...qSpend, ...qAccounts,
    ...qUsers, ...qRecords, ...qCoupons, ...qKeys,
  ]
  const blocking = allQuarantined.filter((q) => !q.benign)
  const benign = allQuarantined.filter((q) => q.benign)

  if (benign.length > 0) {
    // Reported, never silent — but an empty spreadsheet row is not something
    // anyone can go and fix, so it must not hold the migration hostage.
    console.log(`[load] ${benign.length} blank row(s) ignored: ` +
      benign.map((q) => `${q.tab} row ${q.rowIndex}`).join(', '))
  }

  if (blocking.length > 0) {
    console.error(
      `[load] ${blocking.length} row(s) quarantined by the transform — run \`pnpm migrate:verify\` ` +
        `and resolve them before loading. Refusing to load a partial, unreconciled set.`,
    )
    process.exitCode = 1
    return
  }

  const db = createClient(url, key, { db: { schema: 'app' } })

  // ---- 1. users ------------------------------------------------------------
  console.log(`[load] upserting ${users.length} users rows...`)
  {
    const { error } = await db.from('users').upsert(
      users.map((u) => ({
        line_user_id: u.line_user_id,
        display_user_id: u.display_user_id,
        pdpa_consent: u.pdpa_consent,
        full_name: u.full_name,
        nickname: u.nickname,
        phone_number: u.phone_number,
        gender: u.gender,
        age_range: u.age_range,
        user_type: u.user_type,
        address: u.address,
        subdistrict: u.subdistrict,
        occupation: u.occupation,
        registration_date_th: u.registration_date_th,
        registered_at: u.registered_at,
        is_legacy: true,
      })),
      { onConflict: 'line_user_id' },
    )
    if (error) throw error
  }

  // Accounts whose owner never completed registration cannot be loaded —
  // points_accounts.line_user_id is an FK. Skipping them is only safe while
  // they are empty shells (get_or_create_account fires on first app open, so
  // they exist for anyone who looked at the app and left), hence the assertion
  // rather than a silent filter: a skipped account holding real points is a
  // migration that quietly loses somebody's balance.
  const registered = new Set(users.map((u) => u.line_user_id))
  const loadableAccounts = accounts.filter((a) => registered.has(a.line_user_id))
  const skippedAccounts = accounts.filter((a) => !registered.has(a.line_user_id))

  if (skippedAccounts.length > 0) {
    const nonEmpty = skippedAccounts.filter(
      (a) => a.stored_spendable !== 0 || a.lifetime_earned !== 0 || a.total_weight_kg !== 0,
    )
    if (nonEmpty.length > 0) {
      console.error(
        `[load] refusing to load — ${nonEmpty.length} account(s) hold points or weight but have no ` +
          `registration row, so they cannot be loaded and must not be dropped: ` +
          nonEmpty.map((a) => `${a.line_user_id} (${a.stored_spendable} pts)`).join(', '),
      )
      process.exitCode = 1
      return
    }
    console.log(
      `[load] skipping ${skippedAccounts.length} empty account shell(s) with no registration row ` +
        `(0 points, 0 weight, no transactions): ` +
        skippedAccounts.map((a) => a.line_user_id).join(', '),
    )
  }

  const loadableLots = lots.filter((l) => registered.has(l.line_user_id))
  const loadableTransactions = transactions.filter((t) => registered.has(t.line_user_id))
  const loadableDetails = details.filter((d) => registered.has(d.line_user_id))

  // ---- 2. points ledger ----------------------------------------------------
  // No natural key to conflict on, so re-running would duplicate every lot.
  // Detect an already-loaded ledger and skip instead.
  const { count: existingLots, error: lotCountError } = await db
    .from('point_lots')
    .select('*', { count: 'exact', head: true })
    .eq('is_legacy', true)
  if (lotCountError) throw lotCountError

  if ((existingLots ?? 0) > 0) {
    console.log(
      `[load] point_lots already holds ${existingLots} legacy row(s) — skipping the points ledger ` +
        `block (it has no natural key to upsert on). Reset those tables first if you meant to reload it.`,
    )
  } else {
    console.log(`[load] upserting ${loadableAccounts.length} points_accounts rows...`)
    {
      const { error } = await db.from('points_accounts').upsert(
        loadableAccounts.map((a) => ({
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

    console.log(`[load] inserting ${loadableLots.length} point_lots rows...`)
    {
      const { error } = await db.from('point_lots').insert(
        loadableLots.map((l) => ({
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

    console.log(`[load] inserting ${loadableTransactions.length} point_transactions rows (history only)...`)
    {
      const { error } = await db.from('point_transactions').insert(
        loadableTransactions.map((t) => ({
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

    console.log(`[load] inserting ${loadableDetails.length} spend_details rows...`)
    {
      const { error } = await db.from('spend_details').insert(
        loadableDetails.map((d) => ({
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
  }

  // ---- 3. waste_records, coupons, admin_keys -------------------------------
  // waste_records_idempotency_key_uniq is a PARTIAL index (`where
  // idempotency_key is not null`), and Postgres will only infer a partial index
  // for ON CONFLICT when the statement repeats its predicate — which PostgREST
  // has no way to express, so an upsert here fails with 42P10. Reading the keys
  // that are already present and inserting only the rest gives the same
  // re-runnable result, and says out loud how many rows it skipped.
  const existingKeys = new Set<string>()
  {
    const { data, error } = await db
      .from('waste_records')
      .select('idempotency_key')
      .in('idempotency_key', records.map((r) => r.idempotency_key))
    if (error) throw error
    for (const row of data ?? []) {
      if (row.idempotency_key) existingKeys.add(row.idempotency_key)
    }
  }

  const newRecords = records.filter((r) => !existingKeys.has(r.idempotency_key))
  if (existingKeys.size > 0) {
    console.log(`[load] ${existingKeys.size} waste_records row(s) already loaded — skipping those`)
  }

  console.log(`[load] inserting ${newRecords.length} waste_records rows...`)
  {
    const { error } = await db.from('waste_records').insert(
      newRecords.map((r) => ({
        line_user_id: r.line_user_id,
        waste_type_id: r.waste_type_id,
        waste_subtype_id: r.waste_subtype_id,
        weight_kg: r.weight_kg,
        image_urls: r.image_urls,
        carbon_reduction_kg: r.carbon_reduction_kg,
        points_earned: r.points_earned,
        status: r.status,
        notes: r.notes,
        idempotency_key: r.idempotency_key,
        recorded_at: r.recorded_at,
        is_legacy: true,
      })),
    )
    if (error) throw error
  }

  console.log(`[load] upserting ${coupons.length} coupons rows...`)
  {
    const { error } = await db.from('coupons').upsert(
      coupons.map((c) => ({
        coupon_id: c.coupon_id,
        line_user_id: c.line_user_id,
        reward_id: c.reward_id,
        reward_name: c.reward_name,
        reward_description: c.reward_description,
        reward_image: c.reward_image,
        points_used: c.points_used,
        tx_id: c.tx_id,
        status: c.status,
        redeemed_at: c.redeemed_at,
        used_at: c.used_at,
        expires_at: c.expires_at,
        scanned_by: c.scanned_by,
        redeem_type: c.redeem_type,
        is_legacy: true,
      })),
      { onConflict: 'coupon_id' },
    )
    if (error) throw error
  }

  console.log(`[load] upserting ${keys.length} admin_keys rows...`)
  {
    const { error } = await db.from('admin_keys').upsert(
      keys.map((k) => ({
        key: k.key,
        status: k.status,
        line_user_id: k.line_user_id,
        activated_at: k.activated_at,
      })),
      { onConflict: 'key' },
    )
    if (error) throw error
  }

  console.log('[load] done. Run `pnpm migrate:verify` for the reconciliation report.')
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
