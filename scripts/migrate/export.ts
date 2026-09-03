#!/usr/bin/env -S pnpm exec tsx
// scripts/migrate/export.ts
//
// Read-only snapshot of every configured Sheets data source, written to
// scripts/migrate/.data/ (gitignored — real PII). This is step 1 of
// export → transform → load → verify. Nothing here writes to a Sheet, revokes
// anything, or touches Supabase — it only calls the Sheets API's `values.get`
// endpoint, the same read the app's own /api/points already does today.
//
// Run: pnpm migrate:export
//
// Produces one manifest.json (per-tab row counts, headers, spreadsheet
// timeZone) plus one <tab>.json per tab, each holding BOTH the
// UNFORMATTED_VALUE and FORMATTED_VALUE rows — the plan's explicit
// instruction to capture both and let transform.ts diff them, since that's
// "the single place a 'lossless' migration silently isn't."

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { getAllTabValues, getSpreadsheetMetadata, type CellValue } from './sheets-client'
import { DATA_SOURCES, resolveSpreadsheetId } from './sources'

// tsx runs this standalone — Next.js's automatic .env.local loading does not
// apply. Same manual load tests/routes/setup.ts uses.
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
    // No .env.local — each source is reported missing individually below.
  }
}
loadDotEnvLocal()

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '.data')

interface TabManifestEntry {
  title: string
  rowCount: number // including header
  header: CellValue[]
  headerTrimmed: string[]
}

interface SourceManifest {
  key: string
  label: string
  spreadsheetId: string
  spreadsheetTitle: string
  timeZone: string
  fetchedAt: string
  tabs: TabManifestEntry[]
}

async function exportSource(source: (typeof DATA_SOURCES)[number]): Promise<SourceManifest | null> {
  const spreadsheetId = resolveSpreadsheetId(source)
  if (!spreadsheetId) {
    console.warn(`[export] skipping ${source.label} — ${source.envVar} is not set`)
    return null
  }

  console.log(`[export] ${source.label} (${spreadsheetId})`)
  const meta = await getSpreadsheetMetadata(spreadsheetId)
  console.log(`  "${meta.title}", timeZone=${meta.timeZone}`)

  const knownTabs = new Set(meta.tabs.map((t) => t.title))
  const missing = source.tabs.filter((t) => !knownTabs.has(t))
  if (missing.length > 0) {
    throw new Error(
      `[export] ${source.label}: configured tabs not found in the spreadsheet: ${missing.join(', ')}. ` +
        `Found: ${[...knownTabs].join(', ')}`,
    )
  }

  const { unformatted, formatted } = await getAllTabValues(spreadsheetId, source.tabs)

  const sourceDir = join(OUT_DIR, source.key)
  mkdirSync(sourceDir, { recursive: true })

  const tabEntries: TabManifestEntry[] = []

  for (let i = 0; i < source.tabs.length; i++) {
    const title = source.tabs[i]
    const u = unformatted[i]
    const f = formatted[i]

    const header = u.rows[0] ?? []
    const headerTrimmed = header.map((h) => String(h ?? '').trim())

    writeFileSync(
      join(sourceDir, `${title}.json`),
      JSON.stringify({ title, unformatted: u.rows, formatted: f.rows }, null, 2),
    )

    console.log(`  ${title}: ${u.rows.length} rows (incl. header)`)
    tabEntries.push({ title, rowCount: u.rows.length, header, headerTrimmed })
  }

  return {
    key: source.key,
    label: source.label,
    spreadsheetId,
    spreadsheetTitle: meta.title,
    timeZone: meta.timeZone,
    fetchedAt: new Date().toISOString(),
    tabs: tabEntries,
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  const manifests: SourceManifest[] = []
  for (const source of DATA_SOURCES) {
    const manifest = await exportSource(source)
    if (manifest) manifests.push(manifest)
  }

  if (manifests.length === 0) {
    console.error('[export] no data sources configured — nothing to do')
    process.exitCode = 1
    return
  }

  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifests, null, 2))
  console.log(`\n[export] wrote ${manifests.length} source(s) to ${OUT_DIR}`)
  console.log('[export] this directory is gitignored — it holds real user data.')
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
