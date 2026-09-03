# GAS → Supabase migration — status

**Last updated: 2026-09-03.** This file is the source of truth for where the
migration stands. An earlier copy was written 2026-08-24 but never committed and
was lost — if you rewrite it, **commit it**.

---

## Where it stands

All nine phases are written and **merged to `main`** via PR #262 (`262e314`),
which brought in branch `v0/porjaiiii-02a870b5`. Every API route is
Supabase-only; there is no per-route backend flag any more (`lib/backend-flags.ts`
is gone, replaced by `lib/maintenance.ts`, which keeps only `isMaintenance()`).

Verified on `main` at that commit:

| Check | Result |
| --- | --- |
| `pnpm typecheck` | clean |
| `pnpm test` (unit) | 91/91 |
| `pnpm test:routes` (against Dev_env) | 85/85 |

**Merged is not deployed.** Whether Vercel production actually serves this commit,
and whether its env vars are correct, is not answerable from the repo — see
*Known problems* below, where it is currently the top item.

## Environments

| Project | Ref | Region | State |
| --- | --- | --- | --- |
| `Dev_env` | `grsdoojlcxhtzdiybgnw` | ap-southeast-1 | Linked, all 9 migrations pushed, `config push` done, data loaded, verified |
| `Production_env` | `qiscxfpnuifkexzfjclj` | ap-southeast-1 | **Created but empty** — no link, no `db push`, no `config push` |
| (old) | `orycgnhafcovvcxcirnp` | ap-northeast-2 | Orphaned; does not appear in `supabase projects list` |

`supabase db push` alone is **not** enough to stand up a project. It applies
migrations (DDL) only. PostgREST's exposed-schema list is separate project
config that `supabase config push` syncs from `supabase/config.toml`'s
`schemas = ["app"]`. Skip it and every REST call fails with
*"permission denied for schema app"* even though the tables exist.

## Data loaded into Dev_env

39 users, 30 waste_records, 13 coupons, 12 admin_keys.
`app.v_user_balances` reconciles against the sheet for all 39 accounts exactly.

Decisions baked into `scripts/migrate/transform-registration.ts`, all driven by
the real data:

- Duplicate registrations collapse **last-row-wins, whole-row**. 3 of 12 differ;
  a later row corrected อาชีพ while shortening ที่อยู่, so a per-field merge would
  invent a profile nobody entered.
- Blank reference cells become `NULL`, never `''` — they are FKs to `app.ref_*`.
- `'19/8/2569'` is kept verbatim in `registration_date_th`, and converted
  พ.ศ. − 543 to Bangkok midnight for `registered_at`.
- The one free-text `waste_subtype` `'ขวดน้ำพลาสติกใส'` maps to `pet`, original
  preserved in `notes`.
- AdminKeys' `'inactive'` is renamed to the schema's `'unused'`.
- Five `points_accounts` have no Registration row. All five are empty shells
  (0 points, 0 weight, 0 transactions) left by `get_or_create_account` when
  someone opens the app without registering. They are skipped — but `load.ts`
  and `verify.ts` both hard-FAIL if such an account ever holds points.

`load.ts` is re-runnable and **non-destructive**: it never deletes or overwrites
a row already in Supabase. Every table reads its existing keys and inserts only
what is missing (`diffNewByKey` in `transform-points.ts`). `points_accounts` is
the one table re-derived each run, and each field loads as
`MAX(existing, computed)` so a re-run can only push numbers up.

> `onConflict: 'idempotency_key'` on `waste_records` fails with **42P10**.
> `waste_records_idempotency_key_uniq` is a *partial* index
> (`where idempotency_key is not null`), and Postgres only infers a partial index
> when the statement repeats its predicate — which PostgREST cannot express.
> Hence the read-then-diff approach rather than an upsert.

## Idempotency

Implemented at the **database** layer, not in a route wrapper.

- Partial unique indexes: `waste_records_idempotency_key_uniq`,
  `point_transactions_idem_uniq` (`line_user_id, idempotency_key`),
  `coupons_idem_uniq`.
- `app.submit_waste` does a single
  `insert … on conflict (idempotency_key) where idempotency_key is not null
  do nothing returning *`. Zero rows back means replay: it re-selects the
  original row **scoped to `line_user_id`**, so guessing a key cannot disclose
  another account's record.
- Independently of any key, `point_lots_source_waste_uniq` enforces one lot per
  waste record. This is the structural double-award guard and it holds even when
  the client sends no key at all.
- Covered by real two-connection race tests in
  `tests/routes/waste-writes.test.ts` (`submitWaste` ×2 and `confirm` ×2 via
  `Promise.all`).

**Gap:** the `Idempotency-Key` header is optional. `readIdempotencyKey`
(`lib/schemas/common.ts:28`) returns `null` when the header is absent *and* when
it is present but fails validation — so a malformed key silently downgrades to
no idempotency instead of erroring. With a `NULL` key the partial index does not
apply and every retry inserts a new `waste_records` row. Points are still safe
(`point_lots_source_waste_uniq`); the duplicate is the waste row itself.

## Known problems / what's next

1. **Production cutover has not started.** `Production_env` is empty. No
   `link`/`db push`/`config push` has been run against it.
2. **LINE channel mismatch in production.** A live 401 from
   `v0-frontendfrominn-sdesign.vercel.app/api/waste/submit` (2026-09-03) carried a
   valid, unexpired token whose `aud` was **2010479645** — the LIFF app the
   deployed page actually loaded (cookie `LIFF_STORE:…:2010479645-bsNQmZfO`) —
   while `LINE_CHANNEL_ID` is set to **2011114029**. `jwtVerify` rejects on
   audience, so *every* authenticated route 401s. Set `LINE_CHANNEL_ID` to the
   channel whose LIFF app that deployment serves. Note a LIFF id is always
   `{channelId}-{liffAppId}`; only the part before the dash goes in
   `LINE_CHANNEL_ID`.
3. **Two LINE channels means two `line_user_id`s for the same person.** LINE
   `sub` is issued per provider, so the same human logging in through
   2010479645 and through 2011114029 becomes two distinct users. This is the
   real mechanism behind the "Oak Sur" duplicate. Decide on **one** channel
   before cutover.
4. **`GAS_REGISTRATION_SECRET` was leaked** — it shipped in the public JS bundle
   from `app/register/page.tsx` on the old `main`. It is no longer client-side,
   but it has **not** been rotated on the Apps Script side.
5. **Legacy Drive URLs are not backfilled.** `isLegacyUrl()`
   (`lib/supabase/storage.ts:99`) passes them through untouched. No backfill
   script exists.
6. **`app.expire_points` is defined but never scheduled** — no `pg_cron`
   anywhere. Points do not actually expire.
7. **Orphaned "Oak Sur" row.** `U863492dcb23572ef6aa7f60a2cc4643b`
   (`DW2104959179`) is absent from the live Registration sheet but holds real
   legacy waste/points/coupons. A scan of all 109 Dev_env users found it is the
   only such case. No cleanup script written; needs a merge-or-keep decision.
8. **GAS #3 still runs in the request path** (`lib/notify-registration.ts`), and
   its source has never been exported, so whether it writes to a sheet is
   unknown.
9. **Stale root docs**: `GOOGLE_SHEETS_SETUP.md` and `REGISTRATION_SETUP.md`
   still describe the Sheets era.
10. **`.next/` staleness breaks `pnpm typecheck`** after routes are deleted — it
    reports missing modules for routes removed in `615ff44`. `rm -rf .next`
    clears it; the source is fine.

## Conventions for new work

New write paths follow `register`'s shape: identity from `getLineIdentity()`,
schema in `lib/schemas/`, function in `lib/supabase/writes.ts`, maintenance guard
from `lib/maintenance.ts`. There is no backend to choose.

Load-test tooling lives in `loadtest/` — **gitignored**, so it will not appear in
`git status` and is lost on a fresh clone. `loadtest/README.md` is its manual.
