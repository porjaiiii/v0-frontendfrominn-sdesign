# Phase 0 — Recovered source of truth

Answers to the open questions in `migrate-from-gas-and-hazy-locket.md`, derived from the
committed Apps Script sources. Every claim below cites a file and line in this directory.

**Status: partially unblocked.** The ledger questions are all answered. Three items still
require console/Sheets access and are listed under [Still blocked](#still-blocked).

---

## Project inventory

| # | Project | Env var | Source | Bound spreadsheet tabs |
|---|---|---|---|---|
| 1 | line-oa | `NEXT_PUBLIC_GAS_URL1` | `line-oa/Code.gs` | `submission`, `coupons`, `Registration`, `AdminKeys` |
| 2 | points | `NEXT_PUBLIC_GAS_URL2` | `points/Code.gs` | `points_account`, `points_monthly`, `co2_collection`, `points_transactions`, `spend_details` |
| 3 | "LINE OA GAS" (registration webhook) | `NEXT_PUBLIC_GAS_URL3` | **not exported** — live, and confirmed distinct from 1 and 2 | unknown; likely none |

Project 1 reaches all four of its tabs through `SpreadsheetApp.getActiveSpreadsheet()`
(`line-oa/Code.gs:26,219,385,686`), so they are one spreadsheet, not four.

`line-oa/_stale-registration-snapshot.js` was `google-apps-script.js` at the repo root. It is a
**stale** copy of project 1's registration half — it predates `ชื่อเล่น`, `ที่อยู่`, `updateUser`,
and the phone-number apostrophe fix. Kept for diffing only; it is not deployed anywhere.

### Action surface (22 total, 2 were checked in)

| Project | Entry | Actions |
|---|---|---|
| line-oa | `doPost` | `uploadImage`, `getRecords`, `submitWaste`, `updateWaste`, `registerUser`, `getUser`, `updateUser`, `redeem`, `use` |
| line-oa | `doGet` | `verifyAdminKey`, `getByUserId`, `getByCouponId`, + bare `user_id` / `coupon_id` fallback |
| points | `doGet`/`doPost` | `get_or_create_account`, `get_balance`, `earn_points`, `spend_points`, `resync_balance`, `get_transactions`, `get_leaderboard`, `get_spend_details`, `get_co2_collection`, `mark_spend_used` |
| points | trigger only | `expirePoints` — **not in the `ACTIONS` map**, unreachable over HTTP |

---

## Tab schemas (positional — the code never reads headers)

Both projects index columns by position. `getAllRows` (`points/Code.gs:34`) drops row 0 without
inspecting it, so the **header text is not recoverable from source** for the points tabs.

### `submission` (line-oa) — `line-oa/Code.gs:64-75`
`A` timestamp · `B` user_id · `C` waste_type · `D` waste_subtype · `E` weight_kg ·
`F` image (JSON array string, CSV, or bare URL) · `G` carbon_reduction · `H` points_earned ·
`I` status · `J` notes

### `coupons` (line-oa) — `line-oa/Code.gs:222-236`
`A` coupon_id · `B` user_id · `C` reward_id · `D` reward_name · `E` reward_description ·
`F` reward_image · `G` points_used · `H` tx_id · `I` status · `J` redeemed_at · `K` used_at ·
`L` expires_at · `M` scanned_by

### `Registration` (line-oa) — header-driven, `line-oa/Code.gs:409-449`
`LINE User ID`, `User ID`, `PDPA Consent`, `ชื่อ-นามสกุล`, `ชื่อเล่น`, `เบอร์ติดต่อ`, `เพศ`,
`ช่วงอายุ`, `ประเภทผู้ใช้งาน`, `ที่อยู่`, `ตำบล`, `อาชีพ`, `วันที่สมัคร`

This is the one tab whose headers *are* known, because writes switch on the header string.
Column order is whatever the sheet says; the code adapts. `เบอร์ติดต่อ` is written as
`"'" + phoneNumber` (`:426`) — a text-forcing apostrophe, so the leading `0` survives.

### `AdminKeys` (line-oa) — `line-oa/Code.gs:696-715`
`A` key · `B` status · `C` line_user_id · `D` activated_at

### `points_account` (points) — `points/Code.gs:53-62`
`A` user_id · `B` total_points · `C` total_weight · `D` total_co2 · `E` tier · `F` last_updated

### `points_monthly` (points) — `points/Code.gs:339-347`
`A` user_id · `B` month · `C` earned · `D` spent · `E` balance · `F` expires_at · `G` status

### `points_transactions` (points) — `points/Code.gs:64-74`
`A` tx_id · `B` user_id · `C` type · `D` points · `E` co2 · `F` weight · `G` timestamp

### `spend_details` (points) — `points/Code.gs:76-87`
`A` tx_id · `B` user_id · `C` category · `D` item_name · `E` quantity · `F` points ·
`G` status · `H` timestamp

### `co2_collection` (points) — `points/Code.gs:515`
`A` user_id · `B` waste_type · `C` weight · `D` co2 · `E` last_updated

---

## Ledger answers

### `points_monthly` period column — name and format
Column **B**. `earnPoints` writes `` `'${month}` `` (`points/Code.gs:341`) — a leading apostrophe
forcing Sheets to store `'YYYY-MM'` as text.

But `rowMonthToString` (`points/Code.gs:162`) exists specifically to coerce a `Date` back to
`'YYYY-MM'`, which is evidence that **some rows hold real dates**, not text.

> **Transform trap.** The plan exports with `UNFORMATTED_VALUE` + `SERIAL_NUMBER`. Under those
> options a date-typed cell returns a **numeric serial** (e.g. `45809`), not a `Date` — so
> `rowMonthToString` does not save you. The transform must handle three encodings for this one
> column: `'YYYY-MM'` string, `Date`, and Sheets serial number.

### Does `earn_points` append per earn, or increment in place?
**In place**, per `(user_id, current month)` — `points/Code.gs:327-336` finds the bucket and does
`setValue(earned + points)` / `setValue(balance + points)`. It appends only when no bucket exists
for that month (`:338-348`).

So **a lot ≈ a monthly bucket, not a transaction.**

Original accrual is nonetheless recoverable: `logTransaction` appends one `points_transactions`
row per earn and per spend (`points/Code.gs:418-428`).

> **This is better than the plan assumed, and simplifies the migration.** The plan's fallback was
> "one lot per `(user, period)` whose `earned_points` equals that period's *remaining* balance,
> being honest that pre-cutover attribution isn't recoverable." It is recoverable. The bucket
> stores `earned` (C), `spent` (D) and `balance` (E) as three separate columns, so a bucket maps
> **1:1 onto a lot with all three fields intact**:
>
> ```
> point_lots.earned_points   := points_monthly.C
> point_lots.consumed_points := points_monthly.D
> point_lots.remaining       := points_monthly.E   (generated; assert == C - D)
> point_lots.expires_at      := points_monthly.F
> point_lots.status          := points_monthly.G
> ```
>
> `C - D == E` is a free per-row integrity check the export can be graded against, and the
> derived balance `Σ remaining where active and unexpired` is *by construction* the number
> `syncAccount` computes and `get_account_fast` displays. **The zero-tolerance reconciliation
> gate is achievable exactly, not approximately.**
>
> Two consequences for `load.ts`:
> 1. Legacy `points_transactions` rows load as **history only** (`is_legacy=true`). They must
>    **not** feed lot construction — lots come from buckets. Deriving lots from both double-counts
>    every earn.
> 2. Legacy lots get `source_waste_id = NULL`. `points_monthly` has no per-earn granularity, so
>    the `unique (source_waste_id)` double-award guard cannot be backfilled — the partial index
>    tolerates this, and the guard applies to post-cutover records only.

### Is expiry implemented at all, and what is the rule?
Implemented as `expirePoints()` (`points/Code.gs:529`), but **unreachable over HTTP** — it is not
in the `ACTIONS` map (`points/Code.gs:174-185`). Only a time-driven trigger can run it, and
whether that trigger is installed is not knowable from source.

Rule: `getExpiresAt` (`points/Code.gs:154`) returns the **last day of the same calendar month,
`EXPIRE_YEAR` (= 2) years later**. `expirePoints` flips `status` to `expired` where
`expires_at < now`, then re-syncs each affected account.

**It has almost certainly never fired on real data.** The horizon is 2 years and the dataset is
younger than that, so no row can have reached its `expires_at` yet.

> **Off-by-one bug.** `getExpiresAt` builds a local-midnight `Date` and then calls
> `.toISOString().split('T')[0]`. With the project timezone at `Asia/Bangkok` (UTC+7), local
> midnight is the previous day in UTC — so `'2026-06'` stores `2028-06-29`, not `2028-06-30`.
> Every stored `expires_at` is one day early.
>
> Impact on the migration is **nil** (nothing is near expiry), so preserve the values verbatim to
> keep the reconciliation gate exact. Fix the rule in the new `expires_at` generation, not in the
> backfill.

This all corroborates the plan's decision to ship `expire_points` behind a flag, default off.

### FIFO tie-break
`getActiveMonthlyRows(...).sort((a, b) => a.month.localeCompare(b.month))`
(`points/Code.gs:374-375`) — a plain string compare on `'YYYY-MM'`, with **no secondary key**.

Ties are only possible between duplicate `(user, month)` buckets, and resolve to sheet row order
(V8's sort is stable). Post-migration there is one lot per `(user, month)`, so legacy rows can
never tie and the plan's `expires_at nulls last, earned_at, id` ordering is safe to adopt.

### Can `spend_points` partially spend?
**No.** It sums the active buckets and rejects wholesale when `totalBalance < points`
(`points/Code.gs:377-385`) before deducting anything. All-or-nothing.

It runs inside `withLock` — `LockService.getUserLock()` with a 10 s wait (`points/Code.gs:40-48`).
The deduction loop and the precheck are therefore mutually exclusive per lock holder.

> **Only the points project locks.** `line-oa/Code.gs` uses `LockService` nowhere:
> `submitWaste`, `handleRedeem` and `updateWaste` all race, and `handleUseCoupon`
> (`line-oa/Code.gs:243-264`) is a textbook read-then-write TOCTOU — two scans of the same QR can
> both observe `status === 'active'` and both mark it used. Confirms the plan's CAS design for
> coupon use.

### `points_transactions` columns and `tx_id` format
Columns as listed above. `tx_id` is `Utilities.getUuid()` — lowercase RFC-4122 v4.

`logTransaction` accepts a `tx_id` override, and **only `spendPoints` passes one**
(`points/Code.gs:400-402`), so a spend shares its id with the `spend_details` rows it created.
Earn rows always get a fresh uuid that appears nowhere else.

`type` domain: `'earn'` | `'spend'`.

> **Timestamp format split.** `logTransaction`, `logSpendDetails` and `updateCo2Collection` stamp
> with `now_()` = `Utilities.formatDate(..., 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss')`
> (`points/Code.gs:143-145`) — a **naive local string with no offset**. Everything else in both
> projects uses `new Date().toISOString()` (UTC, `Z`-suffixed). The transform must attach
> `Asia/Bangkok` to the first group and must not to the second, or three tables land 7 hours off.

### `spend_details.status` domain
Three values (`points/Code.gs:447,484`):

| Value | Written when |
|---|---|
| `บริจาคสำเร็จ` | at creation, `category === 'donate'` |
| `รอใช้งานคูปอง` | at creation, any other category |
| `ใช้คูปองแล้ว` | by `mark_spend_used` |

`category` defaults to `'reward'` (`points/Code.gs:402`); only `'donate'` is special-cased, so any
other client-supplied string passes through.

### What does `resync_balance` write back?
`syncAccount(user_id)` with `weight = 0, co2 = 0` (`points/Code.gs:259-275`) — it rewrites
`points_account` columns 2–6:

- `total_points` := `Σ balance` over active, unexpired buckets — **recomputed**
- `total_weight` := `row[2] + 0` — unchanged
- `total_co2` := `row[3] + 0` — unchanged
- `tier` := `getTier(total_weight)` — recomputed
- `last_updated` := `new Date().toISOString()`

> **Tier is a function of weight in kilograms, not points.** The `TIERS` thresholds
> 500 / 300 / 150 (`points/Code.gs:18-23`) are compared against `total_weight`. Easy to port
> wrong, because every other tiering system in this class of app is points-based.

---

## Remaining answers

### Why does `submitWaste` send `status:'done'` while the cart filters `'pending'`?
**GAS overrides it.** `submitWaste` hardcodes the literal `'pending'` into column I
(`line-oa/Code.gs:73`) and never reads `data.status`. The `status: 'done'` in
`app/api/waste/submit/route.ts:56` is dead payload. `updateWaste` is the only writer that honours
a client status (`data.status || 'done'`, `line-oa/Code.gs:120`).

**Rule for the new schema: a new record lands as `pending`, i.e. in the cart.** `submit_waste`
must hardcode `pending` and ignore any client-supplied status, or the cart is empty on day one.

### `stats` shape from `getRecords`
`{ total: records.length, pending: records.filter(r => r[8] === 'pending').length }`
(`line-oa/Code.gs:49-53`).

Computed over **every row in the sheet, not the requesting user** — `getRecords` takes no user
filter and returns the whole tab. Any consumer treating `stats` as per-user is already wrong.

### Did `uploadImage` store a `webViewLink` or a `uc?id=` URL?
**Neither.** `https://drive.google.com/thumbnail?id=<fileId>&sz=w1000` (`line-oa/Code.gs:353`).

Root folder `1r-4RqxmTFL8JQQb3b_16jrxPz77Zgq10`, per-user subfolder `user_<userId>`
(`line-oa/Code.gs:327,340`). The blob mime is hardcoded `image/jpeg` (`:337`) regardless of the
real type. The Phase 9 backfill matches on `drive.google.com/thumbnail?id=` and takes the `id`
query param as the Drive file id.

### Any trigger doing work no route calls?
`expirePoints()` — points project, trigger-only, covered above. **No `onEdit` anywhere.**
`testAuthorization()` (`line-oa/Code.gs:604`) is a manual one-off consent primer.

> **The dev test harness writes to the live sheets.** `points/Code.gs:554-623` mints points for
> `u_001` and `u_002`, and `testExpirePoints` appends a hand-built expired row. `TEST_USER` is
> `'Ubc186a6ab54e978df373bc00298fee32'` — shaped exactly like a real LINE id.
> **Add these to the quarantine list**, or synthetic balances migrate as real ones.

### What does GAS #3 do with the registration payload?
**Still unknown — not exported.** The caller is `app/register/page.tsx:446-477`: `POST` to
`${NEXT_PUBLIC_GAS_URL3}?route=register`, `Content-Type: text/plain` to dodge CORS preflight,
with `secret: 'dwa-secret-2024'` in the body and the full registration payload alongside it.
Fire-and-forget — the `try/catch` only logs, and nothing reads the response.

Probed the live deployment (`GET …/exec?route=register`, no secret) on 2026-08-23:

```
HTTP 200  content-type: text/plain
LINE OA GAS is running.
```

Three things that establishes:

1. **It is genuinely a third project.** That banner string appears in neither checked-in source,
   and neither `doGet` could produce it — `line-oa/Code.gs:178-210` returns JSON and would have
   answered `{"status":"error","message":"Missing parameters or invalid action"}`;
   `points/Code.gs:187` routes through `handleRequest` and also returns JSON.
2. **`doGet` is an inert health check.** It ignored `route=register` completely, so the `?route=`
   multiplexing exists only in `doPost`. Worth knowing given `line-oa`'s `verifyAdminKey` is an
   unauthenticated GET that *mutates* — this one is not that.
3. **It self-identifies as the LINE OA script**, which points at the Messaging API side rather
   than at Sheets: most plausibly the OA webhook receiver, with `route=register` as a push helper
   that sends the new user a welcome message. GAS #1's `registerUser` has already written the
   Registration row by the time this fires, so storing again would be redundant.

Not yet confirmed from source: whether it validates `secret`, whether it also writes anywhere,
and what the other `?route=` values are.

The secret is in the client bundle, so the endpoint is effectively open. Phase 4 replaces this
call with a server-side LINE push regardless of what the script turns out to do — but the export
is still needed to confirm nothing else depends on it.

> `app/register/page.tsx:447` also `console.log`s `NEXT_PUBLIC_GAS_URL3` to the browser console
> (added in `66081c5`). And because the variable is unset in `.env.local`, the URL currently
> evaluates to the bare relative string `?route=register` — so in local dev this POSTs to the
> app's own `/register` page. This path has never run locally.

---

## Still blocked

Needs Apps Script console / Sheets access; none of it gates Phases 1–7 on dev, all of it gates
Phase 8:

1. **GAS #3 source.** Confirmed live and distinct (see above), still not exported. The `/exec`
   URL carries a *deployment* id (`AKfycb…`), not a script id, so `clasp clone` needs the script
   id from the editor's ⚙️ Project Settings.
2. **Per-tab snapshot** — real header text, row counts, 5 sample rows. Header text is
   unrecoverable from source for every tab except `Registration`.
3. **Is the `expirePoints` trigger installed?** Determines whether any `points_monthly` row can
   legitimately carry `status = 'expired'`.
4. **Spreadsheet `timeZone` setting** — the plan requires capturing it; the code only proves the
   *author's* intent was `Asia/Bangkok`.
5. **How many `points_monthly.month` cells are date-typed** rather than text.

---

## Corrections this export forces on the plan

1. **Ledger reconstruction is exact, not lossy.** Drop the "`earned_points` := remaining balance"
   fallback; map buckets 1:1 onto lots with `earned` / `spent` / `balance` preserved.
2. **Legacy transactions are history only.** They must not feed lot construction — double count.
3. **Three month encodings** in `points_monthly.B`, one of them a bare Sheets serial.
4. **Two timestamp formats** — naive `Asia/Bangkok` in the three `now_()` tables, UTC ISO
   everywhere else.
5. **Quarantine the test users** `u_001`, `u_002`, `Ubc186a6ab54e978df373bc00298fee32`.
6. **`submit_waste` hardcodes `pending`.**
7. **Tier is weight-based (kg), not points-based.**
8. **`verifyAdminKey` is a `GET` that mutates and has no auth** (`line-oa/Code.gs:679`) — it
   activates an unclaimed key for whoever presents it. Anyone who guesses an unused key owns it.
   Phase 3 must make it an authenticated `POST`.
9. **`getUser` re-reads one row per `getRange` call inside its scan loop**
   (`line-oa/Code.gs:518-525`) — O(n) Sheets round trips per lookup. This, not GAS cold start, is
   the bulk of the 2.2–2.6 s profile read.
