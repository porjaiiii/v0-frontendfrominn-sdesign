#!/usr/bin/env -S pnpm exec tsx
// scripts/migrate/verify.ts
//
// Runs transform-points.ts against whatever export.ts last wrote to
// scripts/migrate/.data/, and checks the plan's cutover gates. Read-only:
// this only reads local JSON files already on disk — no network call, no
// Supabase, no Sheets API. Safe to run as many times as useful.
//
// The gate that actually matters: for every user, the spendable balance
// DERIVED from the point_lots this migration would create must equal the
// balance the legacy sheet currently shows, exactly. Points are integers —
// any delta is a bug, per the plan's own "zero tolerance" framing.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  transformPointsAccount,
  transformPointsMonthly,
  transformPointsTransactions,
  transformSpendDetails,
  type QuarantinedRow,
} from './transform-points'
import type { CellValue } from './sheets-client'

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '.data')

function loadTab(source: string, tab: string): CellValue[][] {
  const path = join(DATA_DIR, source, `${tab}.json`)
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    throw new Error(`missing ${path} — run \`pnpm migrate:export\` first`)
  }
  const parsed = JSON.parse(raw) as { unformatted: CellValue[][] }
  return parsed.unformatted
}

interface Finding {
  level: 'FAIL' | 'WARN'
  message: string
}

function main() {
  const findings: Finding[] = []
  const allQuarantined: QuarantinedRow[] = []

  console.log('[verify] points ledger — export → transform → reconcile\n')

  const monthlyRows = loadTab('points', 'points_monthly')
  const txRows = loadTab('points', 'points_transactions')
  const spendRows = loadTab('points', 'spend_details')
  const accountRows = loadTab('points', 'points_account')

  const { lots, quarantined: qLots } = transformPointsMonthly(monthlyRows)
  const { transactions, quarantined: qTx } = transformPointsTransactions(txRows)
  const { details, quarantined: qSpend } = transformSpendDetails(spendRows)
  const { accounts, quarantined: qAccounts } = transformPointsAccount(
    accountRows,
    lots,
    transactions,
  )
  allQuarantined.push(...qLots, ...qTx, ...qSpend, ...qAccounts)

  console.log(
    `  transformed: ${lots.length} lots, ${transactions.length} transactions, ` +
      `${details.length} spend details, ${accounts.length} accounts`,
  )

  // ---- Gate 1: row-count accounting — every input row is transformed,
  // quarantined, or explicitly skipped (blank trailing row), nothing vanishes.
  const dataRowCount = (rows: CellValue[][]) =>
    rows.slice(1).filter((r) => String(r[0] ?? '').trim() !== '').length

  const checks: [string, number, number, number][] = [
    ['points_monthly', dataRowCount(monthlyRows), lots.length, qLots.length],
    ['points_transactions', dataRowCount(txRows), transactions.length, qTx.length],
    ['spend_details', dataRowCount(spendRows), details.length, qSpend.length],
    ['points_account', dataRowCount(accountRows), accounts.length, qAccounts.length],
  ]
  for (const [tab, source, loaded, quarantined] of checks) {
    if (source !== loaded + quarantined) {
      findings.push({
        level: 'FAIL',
        message: `${tab}: ${source} data rows in, but ${loaded} loaded + ${quarantined} quarantined = ${loaded + quarantined}`,
      })
    }
  }

  // ---- Gate 2: per-user balance reconciliation, zero tolerance.
  const derivedBalance = new Map<string, number>()
  for (const lot of lots) {
    if (lot.status !== 'active') continue
    // expires_at is a point-in-time snapshot from the export, not "now" —
    // this mirrors app.v_user_balances' own `expires_at > current_date`.
    if (lot.expires_at && lot.expires_at <= new Date().toISOString().slice(0, 10)) continue
    derivedBalance.set(lot.line_user_id, (derivedBalance.get(lot.line_user_id) ?? 0) + lot.remaining_points)
  }

  let balanceMismatches = 0
  for (const account of accounts) {
    const derived = derivedBalance.get(account.line_user_id) ?? 0
    if (derived !== account.stored_spendable) {
      balanceMismatches++
      findings.push({
        level: 'FAIL',
        message:
          `balance mismatch for ${account.line_user_id}: derived from lots = ${derived}, ` +
          `sheet's points_account.total_points = ${account.stored_spendable}`,
      })
    }
  }
  console.log(
    balanceMismatches === 0
      ? `  ✓ balance reconciliation: all ${accounts.length} accounts match exactly`
      : `  ✗ balance reconciliation: ${balanceMismatches}/${accounts.length} accounts mismatch`,
  )

  // ---- Gate 3: every account referenced by a lot/transaction/spend actually
  // has a points_account row (nothing orphaned).
  const knownAccounts = new Set(accounts.map((a) => a.line_user_id))
  const orphanCheck = (label: string, userIds: Iterable<string>) => {
    const orphans = new Set([...userIds].filter((id) => !knownAccounts.has(id)))
    if (orphans.size > 0) {
      findings.push({
        level: 'WARN',
        message: `${orphans.size} distinct user(s) appear in ${label} but have no points_account row: ${[...orphans].slice(0, 5).join(', ')}${orphans.size > 5 ? '…' : ''}`,
      })
    }
  }
  orphanCheck('point_lots', lots.map((l) => l.line_user_id))
  orphanCheck('point_transactions', transactions.map((t) => t.line_user_id))

  // ---- Gate 4: tier — informational only. tier_for_weight is recomputed at
  // load time, not trusted from the sheet; a mismatch here just means the
  // sheet's stored tier had gone stale (syncAccount only recomputes it on the
  // next earn), which the migration is expected to correct, not preserve.
  let tierDrift = 0
  for (const account of accounts) {
    const recomputed = tierForWeight(account.total_weight_kg)
    if (recomputed !== account.stored_tier) tierDrift++
  }
  if (tierDrift > 0) {
    findings.push({
      level: 'WARN',
      message: `${tierDrift}/${accounts.length} accounts have a stale stored tier vs. weight-based tier_for_weight() — expected to be corrected by the migration, not preserved`,
    })
  }

  // ---- Quarantine report.
  if (allQuarantined.length > 0) {
    console.log(`\n  quarantined rows (${allQuarantined.length}):`)
    for (const q of allQuarantined) {
      // Never print raw row contents to the console — quarantine reasons are
      // safe (column names, counts), but the row itself carries PII.
      console.log(`    ${q.tab} row ${q.rowIndex}: ${q.reason}`)
    }
  }

  console.log('\n[verify] findings:')
  if (findings.length === 0) {
    console.log('  none — every gate this script checks passes.')
  } else {
    for (const f of findings) {
      console.log(`  [${f.level}] ${f.message}`)
    }
  }

  const hardFailures = findings.filter((f) => f.level === 'FAIL').length
  console.log(
    `\n[verify] ${hardFailures === 0 ? 'PASS' : 'FAIL'} — ${hardFailures} blocking finding(s), ` +
      `${findings.length - hardFailures} warning(s), ${allQuarantined.length} row(s) quarantined`,
  )
  process.exitCode = hardFailures === 0 ? 0 : 1
}

function tierForWeight(weightKg: number): string {
  if (weightKg >= 500) return 'นักอนุรักษ์ระดับผู้เชี่ยวชาญ'
  if (weightKg >= 300) return 'นักอนุรักษ์ระดับสูง'
  if (weightKg >= 150) return 'นักอนุรักษ์ระดับกลาง'
  return 'นักอนุรักษ์มือใหม่'
}

main()
