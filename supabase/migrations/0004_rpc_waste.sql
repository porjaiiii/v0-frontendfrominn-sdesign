-- ============================================================================
-- 0004_rpc_waste.sql — atomic waste write paths (Phase 4)
--
-- Replaces the two-step, non-transactional GAS flow:
--
--   app/api/waste/update/route.ts:105-133 appends the waste row via GAS #1,
--   then fires `earn_points` at GAS #2 in a try/catch marked "non-fatal". A
--   failure there leaves a record permanently `done` with zero points, and a
--   retry awards the points a SECOND time. Both halves now happen inside one
--   transaction, and the award is exactly-once by construction.
--
-- Everything is `security definer` + `set search_path = ''`, so every app object
-- is schema-qualified below. Unqualified builtins (now(), round(), coalesce())
-- resolve through pg_catalog, which is always searched first.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helpers — ported from google-apps-script/points/Code.gs
-- ----------------------------------------------------------------------------

-- points/Code.gs:18-25. NB: the tier thresholds are kilograms of waste, not
-- points — syncAccount calls getTier(new_weight) (points/Code.gs:273).
create or replace function app.tier_for_weight(p_weight_kg numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_weight_kg >= 500 then 'นักอนุรักษ์ระดับผู้เชี่ยวชาญ'
    when p_weight_kg >= 300 then 'นักอนุรักษ์ระดับสูง'
    when p_weight_kg >= 150 then 'นักอนุรักษ์ระดับกลาง'
    else 'นักอนุรักษ์มือใหม่'
  end;
$$;

-- points/Code.gs:147-152. GAS read the clock in the project timezone
-- (Asia/Bangkok), so a 22:00 Bangkok submission on the 31st belongs to that
-- month, not the next one in UTC.
create or replace function app.period_of(p_at timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  select to_char(p_at at time zone 'Asia/Bangkok', 'YYYY-MM');
$$;

-- points/Code.gs:154-159 — last day of the same calendar month, EXPIRE_YEAR (2)
-- years on.
--
-- The GAS original is off by one: it builds a local-midnight Date and then
-- .toISOString(), so at UTC+7 '2026-06' stored 2028-06-29. Fixed here rather
-- than reproduced. Migrated rows keep their stored (early) value verbatim so
-- the cutover reconciliation stays exact — see PHASE-0-FINDINGS.md.
create or replace function app.period_expires_at(p_period text)
returns date
language sql
immutable
set search_path = ''
as $$
  select (to_date(p_period, 'YYYY-MM')
          + interval '2 years'
          + interval '1 month'
          - interval '1 day')::date;
$$;

-- Serialising the CSPRNG bytes ourselves rather than taking Math.random(),
-- which is what produced today's guessable coupon_id.
create or replace function app.new_tx_id()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'tx_' || replace(gen_random_uuid()::text, '-', '');
$$;

-- The JSON shape both RPCs return for a record. Kept in one place so
-- submit_waste and confirm_waste can never drift apart.
create or replace function app.waste_record_json(p_record app.waste_records)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id',               p_record.id,
    'timestamp',        p_record.recorded_at,
    'user_id',          p_record.line_user_id,
    'waste_type',       p_record.waste_type_id,
    'waste_subtype',    coalesce(p_record.waste_subtype_id, ''),
    'weight_kg',        coalesce(p_record.weight_kg, 0),
    'image_urls',       to_jsonb(p_record.image_urls),
    'carbon_reduction', p_record.carbon_reduction_kg,
    'points_earned',    p_record.points_earned,
    'status',           p_record.status,
    'notes',            coalesce(p_record.notes, '')
  );
$$;

-- ----------------------------------------------------------------------------
-- submit_waste — a new record lands in the cart
-- ----------------------------------------------------------------------------

/*
 * Hardcodes `pending`. The client sends status:'done'
 * (app/api/waste/submit/route.ts:56) and GAS has always overridden it with the
 * literal 'pending' (line-oa/Code.gs:73); the cart filters for 'pending'
 * (components/waste-cart.tsx). Honouring the client here would empty the cart.
 *
 * Idempotent on the client's Idempotency-Key: a replay returns the SAME 200
 * body as the original, never a 409.
 */
create or replace function app.submit_waste(
  p_line_user_id     text,
  p_waste_type_id    text,
  p_waste_subtype_id text,
  p_weight_kg        numeric default null,
  p_image_urls       text[]  default '{}',
  p_notes            text    default null,
  p_idempotency_key  text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type      app.waste_types%rowtype;
  v_record    app.waste_records%rowtype;
  v_carbon    numeric(12,4) := 0;
  v_points    integer := 0;
  v_duplicate boolean := false;
begin
  select * into v_type
    from app.waste_types
   where id = p_waste_type_id and is_active;

  if not found then
    raise exception 'unknown waste type %', p_waste_type_id
      using errcode = 'foreign_key_violation';
  end if;

  -- Rates come from app.waste_types, never from the request. This is what stops
  -- a client pricing its own submission.
  if p_weight_kg is not null and p_weight_kg > 0 then
    v_carbon := round(p_weight_kg * v_type.carbon_factor, 4);
    v_points := round(p_weight_kg * v_type.points_per_kg)::integer;
  end if;

  insert into app.waste_records (
    line_user_id, waste_type_id, waste_subtype_id, weight_kg, image_urls,
    carbon_reduction_kg, points_earned, status, notes,
    applied_carbon_factor, applied_points_per_kg, idempotency_key, recorded_at
  )
  values (
    p_line_user_id, p_waste_type_id, p_waste_subtype_id,
    -- 0 and the legacy -1 sentinel both mean "not yet weighed".
    nullif(greatest(coalesce(p_weight_kg, 0), 0), 0),
    coalesce(p_image_urls, '{}'),
    v_carbon, v_points, 'pending', p_notes,
    v_type.carbon_factor, v_type.points_per_kg, p_idempotency_key,
    -- Millisecond precision, deliberately. `recorded_at` is the record's
    -- identity (waste_records_user_recorded_at_uniq) and every client
    -- round-trips it through a JS Date, which truncates to milliseconds — so
    -- storing microseconds would make the value the client sends back never
    -- match. This is also what makes the index a same-millisecond dupe guard.
    date_trunc('milliseconds', clock_timestamp())
  )
  on conflict (idempotency_key) where idempotency_key is not null
  do nothing
  returning * into v_record;

  -- 0 rows inserted → this is a replay. Return the original row.
  if v_record.id is null then
    v_duplicate := true;

    select * into v_record
      from app.waste_records
     where idempotency_key = p_idempotency_key
       -- Scoped to the caller: without this, guessing a key would disclose
       -- another user's record.
       and line_user_id = p_line_user_id;

    if not found then
      raise exception 'idempotency key already used by another account'
        using errcode = 'unique_violation';
    end if;
  end if;

  return jsonb_build_object(
    'record',    app.waste_record_json(v_record),
    'duplicate', v_duplicate
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- confirm_waste — weigh a cart item, mark it done, award the points
-- ----------------------------------------------------------------------------

/*
 * One transaction covering what GAS spread across two web apps and five sheets:
 * the record update, the point lot, the transaction, the immutable ledger entry
 * and the account aggregates.
 *
 * Exactly-once by two independent guards:
 *   1. `select … for update` then a status check. Under READ COMMITTED the
 *      second concurrent caller blocks, then re-reads the committed row and
 *      sees 'done', so it awards nothing.
 *   2. `unique (source_waste_id)` on app.point_lots — structural, and it holds
 *      even when the client sends no idempotency key at all.
 *
 * Deliberate divergence: GAS rewrote column A with `new Date()` on every update
 * (line-oa/Code.gs:107), so a confirmed record's timestamp became its
 * confirmation time. `recorded_at` is the identity key here — rewriting it would
 * invalidate the /history/[id] URL the user is standing on and break replay — so
 * it is preserved, and `updated_at` carries the confirmation time instead.
 */
create or replace function app.confirm_waste(
  p_line_user_id     text,
  p_recorded_at      timestamptz,
  p_weight_kg        numeric default null,
  p_waste_type_id    text    default null,
  p_waste_subtype_id text    default null,
  p_image_urls       text[]  default null,
  p_notes            text    default null,
  p_idempotency_key  text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record app.waste_records%rowtype;
  v_type   app.waste_types%rowtype;
  v_weight numeric(10,3);
  v_carbon numeric(12,4);
  v_points integer;
  v_period text;
  v_lot_id bigint;
  v_tx_id  text;
begin
  -- Matched over a one-millisecond window rather than on equality. New records
  -- are stored millisecond-truncated so this is exact, but rows migrated from
  -- Sheets can carry sub-millisecond noise that a client's JS Date silently
  -- drops on the way back. A range still uses
  -- waste_records_user_recorded_at_uniq.
  select * into v_record
    from app.waste_records
   where line_user_id = p_line_user_id
     and recorded_at >= date_trunc('milliseconds', p_recorded_at)
     and recorded_at <  date_trunc('milliseconds', p_recorded_at) + interval '1 millisecond'
   order by recorded_at
   limit 1
   for update;

  if not found then
    raise exception 'waste record not found'
      using errcode = 'no_data_found';
  end if;

  -- Guard 1. Already awarded — same 200 body, no second award.
  if v_record.status = 'done' then
    return jsonb_build_object(
      'record',           app.waste_record_json(v_record),
      'points_awarded',   false,
      'already_confirmed', true,
      'tx_id',            null
    );
  end if;

  if v_record.status = 'cancelled' then
    raise exception 'waste record is cancelled'
      using errcode = 'check_violation';
  end if;

  select * into v_type
    from app.waste_types
   where id = coalesce(p_waste_type_id, v_record.waste_type_id);

  if not found then
    raise exception 'unknown waste type %', p_waste_type_id
      using errcode = 'foreign_key_violation';
  end if;

  v_weight := nullif(greatest(coalesce(p_weight_kg, v_record.weight_kg, 0), 0), 0);

  -- waste_records_done_needs_weight would reject this anyway; failing here says
  -- why, in a message the route can surface.
  if v_weight is null then
    raise exception 'cannot confirm a record with no weight'
      using errcode = 'check_violation';
  end if;

  v_carbon := round(v_weight * v_type.carbon_factor, 4);
  v_points := round(v_weight * v_type.points_per_kg)::integer;

  update app.waste_records
     set waste_type_id    = v_type.id,
         waste_subtype_id = coalesce(p_waste_subtype_id, waste_subtype_id),
         weight_kg        = v_weight,
         image_urls       = coalesce(p_image_urls, image_urls),
         notes            = coalesce(p_notes, notes),
         carbon_reduction_kg = v_carbon,
         points_earned       = v_points,
         -- Re-snapshotted at confirmation: this is the moment the user earns,
         -- so this is the rate that applies.
         applied_carbon_factor = v_type.carbon_factor,
         applied_points_per_kg = v_type.points_per_kg,
         status = 'done'
   where id = v_record.id
   returning * into v_record;

  -- earnPoints rejects points <= 0 (points/Code.gs:319-321). A sub-100g scrap
  -- rounds to zero points: the record is still done, there is just nothing to
  -- award, and creating an empty lot would pollute the FIFO scan.
  if v_points <= 0 then
    return jsonb_build_object(
      'record',           app.waste_record_json(v_record),
      'points_awarded',   false,
      'already_confirmed', false,
      'tx_id',            null
    );
  end if;

  v_period := app.period_of(v_record.recorded_at);

  -- Guard 2, structural.
  insert into app.point_lots (
    line_user_id, period, earned_points, consumed_points,
    status, expires_at, earned_at, source_waste_id
  )
  values (
    p_line_user_id, v_period, v_points, 0,
    'active', app.period_expires_at(v_period), v_record.recorded_at, v_record.id
  )
  on conflict (source_waste_id) where source_waste_id is not null
  do nothing
  returning id into v_lot_id;

  if v_lot_id is null then
    return jsonb_build_object(
      'record',           app.waste_record_json(v_record),
      'points_awarded',   false,
      'already_confirmed', true,
      'tx_id',            null
    );
  end if;

  v_tx_id := app.new_tx_id();

  insert into app.point_transactions (
    tx_id, line_user_id, kind, points_delta, co2_kg, weight_kg, idempotency_key
  )
  values (
    v_tx_id, p_line_user_id, 'earn', v_points, v_carbon, v_weight,
    -- Namespaced by record id: a client that reuses one key across two
    -- different records must not lose the second earn to a unique violation.
    case when p_idempotency_key is null then null
         else 'confirm:' || v_record.id::text || ':' || p_idempotency_key end
  );

  insert into app.point_ledger_entries (tx_id, lot_id, points_delta)
  values (v_tx_id, v_lot_id, v_points);

  -- syncAccount (points/Code.gs:259-275) recomputed total_points here. It no
  -- longer exists: the balance is derived by app.v_user_balances, so only the
  -- monotonic aggregates need touching.
  insert into app.points_accounts (
    line_user_id, lifetime_earned, lifetime_spent,
    total_weight_kg, total_co2_kg, tier, last_updated
  )
  values (
    p_line_user_id, v_points, 0, v_weight, v_carbon,
    app.tier_for_weight(v_weight), now()
  )
  on conflict (line_user_id) do update
     set lifetime_earned = app.points_accounts.lifetime_earned + excluded.lifetime_earned,
         total_weight_kg = app.points_accounts.total_weight_kg + excluded.total_weight_kg,
         total_co2_kg    = app.points_accounts.total_co2_kg    + excluded.total_co2_kg,
         tier = app.tier_for_weight(
                  app.points_accounts.total_weight_kg + excluded.total_weight_kg),
         last_updated = now();

  return jsonb_build_object(
    'record',           app.waste_record_json(v_record),
    'points_awarded',   true,
    'already_confirmed', false,
    'tx_id',            v_tx_id
  );
end;
$$;

-- ============================================================================
-- Append-only, but still erasable
--
-- 0001 blocked UPDATE **and** DELETE on point_ledger_entries and made
-- point_lots → entries `on delete restrict`. Together those made a user with
-- any earned points permanently unerasable — not a viable posture for an app
-- whose registration flow is a PDPA consent form. The first confirm_waste test
-- to write a ledger entry is what surfaced it.
--
-- Same guarantee, enforced where it belongs:
--   * the trigger keeps history from being REWRITTEN (update), which is the
--     part that would actually corrupt a balance;
--   * the DELETE privilege is revoked, so application code cannot drop entries
--     even by accident;
--   * cascading from the lot still works, because referential actions run as
--     the table owner and bypass privilege checks.
--
-- Erasing a user remains an ORDERED operation, not one `delete from app.users`:
-- point_lots.source_waste_id is `on delete restrict` (deliberately — a
-- confirmed record must not be deletable out from under its lot), so delete
-- point_transactions, then point_lots, then waste_records, then the user.
-- tests/routes/waste-writes.test.ts does exactly this.
-- ============================================================================

alter table app.point_ledger_entries
  drop constraint point_ledger_entries_lot_id_fkey,
  add constraint point_ledger_entries_lot_id_fkey
    foreign key (lot_id) references app.point_lots(id) on delete cascade;

drop trigger point_ledger_entries_immutable on app.point_ledger_entries;

create trigger point_ledger_entries_immutable
  before update on app.point_ledger_entries
  for each row execute function app.tg_block_mutation();

revoke delete on app.point_ledger_entries from service_role;

-- ----------------------------------------------------------------------------
-- Grants — same posture as 0002_rls.sql. Functions created after that migration
-- are not covered by its blanket revokes, so they are spelled out here.
-- ----------------------------------------------------------------------------

revoke all on function app.tier_for_weight(numeric)                     from public, anon, authenticated;
revoke all on function app.period_of(timestamptz)                       from public, anon, authenticated;
revoke all on function app.period_expires_at(text)                      from public, anon, authenticated;
revoke all on function app.new_tx_id()                                  from public, anon, authenticated;
revoke all on function app.waste_record_json(app.waste_records)         from public, anon, authenticated;
revoke all on function app.submit_waste(text, text, text, numeric, text[], text, text)
  from public, anon, authenticated;
revoke all on function app.confirm_waste(text, timestamptz, numeric, text, text, text[], text, text)
  from public, anon, authenticated;

grant execute on function app.submit_waste(text, text, text, numeric, text[], text, text)
  to service_role;
grant execute on function app.confirm_waste(text, timestamptz, numeric, text, text, text[], text, text)
  to service_role;

do $$
declare
  v_leaked text;
begin
  select string_agg(p.proname, ', ')
    into v_leaked
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app'
     and (has_function_privilege('anon', p.oid, 'execute')
       or has_function_privilege('authenticated', p.oid, 'execute'));

  if v_leaked is not null then
    raise exception 'anon/authenticated can execute app functions: %', v_leaked;
  end if;
end;
$$;
