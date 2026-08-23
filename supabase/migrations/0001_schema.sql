-- ============================================================================
-- 0001_schema.sql — core schema for the GAS→Supabase migration (Phase 1)
--
-- Everything lives in schema `app`, never `public`: PostgREST only serves the
-- schemas listed in config.toml, so a leaked anon key reaches nothing. RLS and
-- the grant revocations are in 0002_rls.sql.
-- ============================================================================

create schema if not exists app;

-- ============================================================================
-- Shared triggers
-- ============================================================================

create or replace function app.tg_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Append-only guard for the ledger. The sum of the entries is the truth, so an
-- UPDATE or DELETE against them is always a bug, never a correction.
create or replace function app.tg_block_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '%.% is append-only', tg_table_schema, tg_table_name
    using errcode = 'restrict_violation';
end;
$$;

-- ============================================================================
-- Reference tables — Thai demographics, keyed by the Thai string itself
--
-- Seeded in 0003 from the current UI lists. Phase 8 MUST additionally seed
-- `select distinct` from the prod export (with is_active = false for values the
-- UI no longer offers) BEFORE loading app.users, or drifted real rows are
-- rejected by the FKs below.
-- ============================================================================

create table app.ref_gender (
  value      text primary key,
  sort_order integer not null default 0,
  is_active  boolean not null default true
);

create table app.ref_age_range (
  value      text primary key,
  sort_order integer not null default 0,
  is_active  boolean not null default true
);

create table app.ref_user_type (
  value      text primary key,
  -- Replaces string-matching 'นักท่องเที่ยว' at every call site.
  is_tourist boolean not null default false,
  sort_order integer not null default 0,
  is_active  boolean not null default true
);

create table app.ref_subdistrict (
  value      text primary key,
  sort_order integer not null default 0,
  is_active  boolean not null default true
);

create table app.ref_occupation (
  value      text primary key,
  sort_order integer not null default 0,
  is_active  boolean not null default true
);

-- ============================================================================
-- Waste catalog — lookup tables that also carry the rates
--
-- This is what collapses the 5-way duplication of CARBON_FACTORS/POINTS_PER_KG
-- across app/api/waste/submit, app/api/waste/update, app/home/page.tsx,
-- components/waste-detail-modal.tsx and lib/app-context.tsx.
-- ============================================================================

create table app.waste_types (
  id            text primary key,
  name_th       text not null,
  icon_path     text,
  carbon_factor numeric(10,4) not null check (carbon_factor >= 0),  -- kg CO2e per kg
  points_per_kg numeric(10,4) not null check (points_per_kg >= 0),
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger waste_types_touch
  before update on app.waste_types
  for each row execute function app.tg_touch_updated_at();

create table app.waste_subtypes (
  waste_type_id  text not null references app.waste_types(id) on delete cascade,
  id             text not null,
  name_th        text not null,
  description_th text,
  image_path     text,
  sort_order     integer not null default 0,
  is_active      boolean not null default true,
  primary key (waste_type_id, id)
);

-- ============================================================================
-- Users — line_user_id is the natural key, FK'd by every child table.
--
-- No regex check on the key: prod contains `demo_user` and `Usample*`.
-- ============================================================================

create table app.users (
  line_user_id text primary key,

  -- The DW########## id from lib/user-id-generator.ts. Deliberately NOT unique:
  -- substring(0,10).padEnd(10,'0') maps `123` and `1230` onto the same value.
  display_user_id text,

  pdpa_consent text,
  full_name    text,
  nickname     text,
  phone_number text,

  gender      text references app.ref_gender(value),
  age_range   text references app.ref_age_range(value),
  user_type   text references app.ref_user_type(value),
  address     text,
  subdistrict text references app.ref_subdistrict(value),
  occupation  text references app.ref_occupation(value),

  -- The raw th-TH string GAS wrote ('วันที่สมัคร'), preserved verbatim so the
  -- migration is lossless; registered_at is the machine-readable form.
  registration_date_th text,
  registered_at timestamptz not null default now(),

  is_legacy  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger users_touch
  before update on app.users
  for each row execute function app.tg_touch_updated_at();

create index users_display_user_id_idx on app.users (display_user_id);

-- ============================================================================
-- Waste records — the `submission` tab
-- ============================================================================

create table app.waste_records (
  id bigint generated always as identity primary key,

  line_user_id     text not null references app.users(line_user_id) on delete cascade,
  waste_type_id    text not null references app.waste_types(id),
  waste_subtype_id text,

  -- NULL means "not yet weighed" — this is the legacy `-1` sentinel. Verified
  -- near-transparent: mapWasteRecords coerces null→0, `hasWeight = > 0` stays
  -- false, and waste-cart's filter-then-sum yields an identical total.
  weight_kg numeric(10,3),

  image_urls          text[] not null default '{}',
  carbon_reduction_kg numeric(12,4) not null default 0,
  points_earned       integer not null default 0,

  status text not null default 'pending',
  notes  text,

  -- Snapshotted so a later rate change is never retroactive.
  applied_carbon_factor numeric(10,4),
  applied_points_per_kg numeric(10,4),

  idempotency_key text,

  recorded_at timestamptz not null,
  is_legacy   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint waste_records_status_check
    check (status in ('pending', 'done', 'cancelled')),

  -- Weighing state is orthogonal to pending|done, so it is a nullable column
  -- plus this check rather than a third status value.
  constraint waste_records_done_needs_weight
    check (status <> 'done' or weight_kg is not null),

  constraint waste_records_weight_positive
    check (weight_kg is null or weight_kg > 0),

  -- components/waste-detail-modal.tsx currently persists URL.createObjectURL()
  -- when an upload fails. A CHECK cannot contain a subquery, so this folds the
  -- array to a delimited scalar and matches against that.
  constraint waste_records_no_local_urls
    check (coalesce(array_to_string(image_urls, e'\n'), '') !~ '(^|\n)\s*(blob|data):'),

  constraint waste_records_subtype_fk
    foreign key (waste_type_id, waste_subtype_id)
    references app.waste_subtypes (waste_type_id, id)
);

create trigger waste_records_touch
  before update on app.waste_records
  for each row execute function app.tg_touch_updated_at();

-- `on conflict do nothing returning *`; 0 rows → select the existing row and
-- return the SAME 200 body. Never a 409.
create unique index waste_records_idempotency_key_uniq
  on app.waste_records (idempotency_key)
  where idempotency_key is not null;

-- Today's de-facto identity. Keeps /history/[id] and /api/waste/update working
-- unchanged on day one; afterwards it degrades into a same-millisecond dupe
-- guard once those URLs migrate to `id`.
create unique index waste_records_user_recorded_at_uniq
  on app.waste_records (line_user_id, recorded_at);

create index waste_records_user_status_idx
  on app.waste_records (line_user_id, status);

-- ============================================================================
-- Points ledger — lots + immutable entries
--
-- Balance is DERIVED, never stored (see app.v_user_balances). This is what makes
-- resync_balance structurally impossible to need.
-- ============================================================================

create table app.points_accounts (
  line_user_id text primary key references app.users(line_user_id) on delete cascade,

  -- Monotonic aggregates only. The spendable balance is NOT here.
  lifetime_earned integer not null default 0 check (lifetime_earned >= 0),
  lifetime_spent  integer not null default 0 check (lifetime_spent  >= 0),
  total_weight_kg numeric(12,3) not null default 0,
  total_co2_kg    numeric(12,4) not null default 0,

  -- NB: tier is a function of total_weight_kg (kilograms), not of points.
  tier text not null default 'นักอนุรักษ์มือใหม่',

  last_updated timestamptz not null default now()
);

create table app.point_lots (
  id bigint generated always as identity primary key,

  line_user_id text not null references app.users(line_user_id) on delete cascade,
  period       text not null,  -- 'YYYY-MM', the legacy monthly bucket

  earned_points    integer not null default 0 check (earned_points   >= 0),
  consumed_points  integer not null default 0 check (consumed_points >= 0),
  remaining_points integer generated always as (earned_points - consumed_points) stored,

  status     text not null default 'active',
  expires_at date,
  earned_at  timestamptz not null default now(),

  -- One lot per confirmed waste record. This is the STRUCTURAL double-award
  -- guard — it works even when the client sends no idempotency key at all.
  -- NULL for legacy lots: points_monthly has no per-earn granularity.
  source_waste_id bigint references app.waste_records(id) on delete restrict,

  is_legacy  boolean not null default false,
  created_at timestamptz not null default now(),

  constraint point_lots_status_check    check (status in ('active', 'expired')),
  constraint point_lots_period_format   check (period ~ '^\d{4}-\d{2}$'),
  constraint point_lots_not_overconsumed check (consumed_points <= earned_points)
);

create unique index point_lots_source_waste_uniq
  on app.point_lots (source_waste_id)
  where source_waste_id is not null;

-- Drives the FIFO scan in spend_points.
create index point_lots_fifo_idx
  on app.point_lots (line_user_id, expires_at nulls last, earned_at, id)
  where status = 'active';

create table app.point_transactions (
  tx_id text primary key,  -- CSPRNG, not Math.random()

  line_user_id text not null references app.users(line_user_id) on delete cascade,
  kind         text not null,
  points_delta integer not null,

  co2_kg    numeric(12,4) not null default 0,
  weight_kg numeric(12,3) not null default 0,
  category  text,

  idempotency_key text,

  -- Legacy rows load verbatim as history. They must NOT feed lot construction:
  -- lots come from the points_monthly buckets, and deriving from both would
  -- double-count every earn.
  is_legacy   boolean not null default false,
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),

  constraint point_transactions_kind_check
    check (kind in ('earn', 'spend', 'expire', 'adjust'))
);

-- Where the duplicate-points bug dies.
create unique index point_transactions_idem_uniq
  on app.point_transactions (line_user_id, idempotency_key)
  where idempotency_key is not null;

create index point_transactions_user_time_idx
  on app.point_transactions (line_user_id, occurred_at desc);

create table app.point_ledger_entries (
  id bigint generated always as identity primary key,
  tx_id  text   not null references app.point_transactions(tx_id) on delete cascade,
  lot_id bigint not null references app.point_lots(id) on delete restrict,
  points_delta integer not null,
  created_at   timestamptz not null default now()
);

create trigger point_ledger_entries_immutable
  before update or delete on app.point_ledger_entries
  for each row execute function app.tg_block_mutation();

create index point_ledger_entries_lot_idx on app.point_ledger_entries (lot_id);

create table app.spend_details (
  id bigint generated always as identity primary key,

  tx_id        text not null references app.point_transactions(tx_id) on delete cascade,
  line_user_id text not null references app.users(line_user_id) on delete cascade,

  category  text not null default 'reward',
  item_name text not null default '',
  quantity  integer not null default 1 check (quantity > 0),
  points    integer not null default 0 check (points >= 0),
  status    text not null,

  occurred_at timestamptz not null default now(),

  -- Exactly the three values GAS could write.
  constraint spend_details_status_check
    check (status in ('บริจาคสำเร็จ', 'รอใช้งานคูปอง', 'ใช้คูปองแล้ว'))
);

create index spend_details_user_time_idx on app.spend_details (line_user_id, occurred_at desc);

-- ============================================================================
-- Rewards catalog + coupons
-- ============================================================================

create table app.rewards (
  id integer primary key,  -- legacy numeric ids from lib/waste-data.ts REWARDS
  name        text not null,
  description text not null default '',
  points      integer not null check (points > 0),
  image_path  text not null default '',
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger rewards_touch
  before update on app.rewards
  for each row execute function app.tg_touch_updated_at();

create table app.coupons (
  -- Preserved verbatim on migration: outstanding QR codes in users' phones must
  -- keep resolving.
  coupon_id text primary key,

  line_user_id text not null references app.users(line_user_id) on delete cascade,
  reward_id    integer references app.rewards(id),

  -- Denormalised at redemption so a later catalog edit never rewrites history.
  reward_name        text not null,
  reward_description text not null default '',
  reward_image       text not null default '',

  points_used integer not null check (points_used >= 0),
  tx_id       text references app.point_transactions(tx_id),

  status      text not null default 'active',
  redeemed_at timestamptz not null default now(),
  used_at     timestamptz,
  expires_at  timestamptz,
  scanned_by  text,

  -- Present in CouponRecord and accepted by /api/coupons/redeem today, but GAS
  -- silently dropped it: handleRedeem's rowData has no such column. Phase 5
  -- starts persisting it.
  redeem_type text,

  idempotency_key text,
  is_legacy       boolean not null default false,
  created_at      timestamptz not null default now(),

  constraint coupons_status_check
    check (status in ('active', 'used', 'expired', 'cancelled')),
  constraint coupons_redeem_type_check
    check (redeem_type is null or redeem_type in ('pickup', 'delivery')),
  constraint coupons_used_needs_timestamp
    check (status <> 'used' or used_at is not null)
);

create unique index coupons_idem_uniq
  on app.coupons (idempotency_key)
  where idempotency_key is not null;

create index coupons_user_idx on app.coupons (line_user_id, redeemed_at desc);

-- ============================================================================
-- Admin keys
-- ============================================================================

create table app.admin_keys (
  key          text primary key,
  status       text not null default 'unused',
  line_user_id text references app.users(line_user_id),
  activated_at timestamptz,

  constraint admin_keys_status_check
    check (status in ('unused', 'active', 'revoked')),
  -- An active key must be bound to somebody.
  constraint admin_keys_active_needs_user
    check (status <> 'active' or line_user_id is not null)
);

-- ============================================================================
-- Derived views
-- ============================================================================

-- The single definition of "spendable". Replaces resync_balance entirely, and
-- collapses loadAccount's three sequential GAS round trips into one query.
create view app.v_user_balances as
select
  u.line_user_id,
  coalesce(
    sum(l.remaining_points) filter (
      where l.status = 'active'
        and (l.expires_at is null or l.expires_at > current_date)
    ),
    0
  )::integer as spendable_points
from app.users u
left join app.point_lots l on l.line_user_id = u.line_user_id
group by u.line_user_id;

-- Leaderboard ranks on SPENDABLE balance, preserving today's behaviour
-- (rank drops when a user redeems). Decided against the plan's lifetime_earned
-- recommendation. Because balance is derived rather than stored, this is a view
-- over the lots, not a sort on a column.
-- Everything /api/points/ranking needs in ONE query, replacing the two parallel
-- Sheets reads (points_account + Registration) it cross-references today.
create view app.v_leaderboard as
select
  u.line_user_id,
  -- Prefers the nickname, matching the profile page and today's buildNameMap.
  coalesce(nullif(u.nickname, ''), nullif(u.full_name, '')) as display_name,
  coalesce(u.subdistrict, '')      as subdistrict,
  coalesce(t.is_tourist, false)    as is_tourist,
  b.spendable_points               as total_points,
  coalesce(a.total_weight_kg, 0)   as total_weight,
  coalesce(a.total_co2_kg, 0)      as total_co2,
  coalesce(a.tier, 'นักอนุรักษ์มือใหม่') as tier
from app.users u
join app.v_user_balances b     on b.line_user_id = u.line_user_id
left join app.points_accounts a on a.line_user_id = u.line_user_id
left join app.ref_user_type t   on t.value = u.user_type;

-- Replaces the legacy co2_collection tab. Kept as a view so any dashboard still
-- reading that shape keeps working; drop once confirmed unused (Phase 9).
create view app.v_co2_collection as
select
  w.line_user_id,
  w.waste_type_id as waste_type,
  sum(w.weight_kg)           as weight,
  sum(w.carbon_reduction_kg) as co2,
  max(w.updated_at)          as last_updated
from app.waste_records w
where w.status = 'done'
group by w.line_user_id, w.waste_type_id;
