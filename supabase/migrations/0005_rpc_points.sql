-- ============================================================================
-- 0005_rpc_points.sql — spending, redemption and coupon use (Phase 5)
--
-- This is the phase that fixes the three findings the migration plan calls out
-- as more severe than the duplicate-submit bug:
--
--   1. Reward prices came from the CLIENT. app/api/coupons/redeem checked
--      `points_used` only for truthiness, so the 17,000-point reward could be
--      redeemed for 1. Prices now come from app.rewards, and the request has no
--      way to state a price at all — except for rewards explicitly marked
--      variable, which carry a server-enforced floor.
--
--   2. Checkout spent points and minted NO coupon. app/checkout/page.tsx called
--      spendPoints() then clearCart(), with no addCoupon anywhere: the user paid
--      and got nothing. Spending and minting are now one RPC — there is no
--      interleaving in which one happens without the other.
--
--   3. coupon_id came from Math.random() and IS the QR payload. Now CSPRNG, in
--      the same CPNxxxxxxxx-xxxx-xxxx shape so outstanding codes and the
--      scanner keep working.
--
-- Custom SQLSTATEs, so routes can map failures without matching on Thai text:
--   DW001  not enough points
--   DW002  coupon already used / not active
--   DW003  reward not purchasable as requested (inactive, or bad variable price)
--
-- The 'DW' class is deliberate. PostgREST reserves the 'PT' class: a SQLSTATE of
-- PTxxx is read as an HTTP status override, so raising 'PT001' makes it answer
-- with HTTP status 1 — which no client can parse, and which presents as a hang
-- rather than an error. Do not use PT for application error codes here.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Variable-price rewards
--
-- app/rewards/page.tsx:16-23 defines a CASH_REWARD (id 99, 1 point = 1 baht,
-- minimum 20) entirely in the client, and the amount the user types becomes
-- points_used verbatim. Moving it into the catalog is what lets the floor be
-- enforced somewhere the user cannot edit.
-- ----------------------------------------------------------------------------

alter table app.rewards
  add column is_variable boolean not null default false,
  add column min_points  integer;

alter table app.rewards
  add constraint rewards_variable_needs_floor
    check (not is_variable or (min_points is not null and min_points > 0));

insert into app.rewards (id, name, description, points, image_path, sort_order, is_variable, min_points)
values (99, 'แลกแต้มเป็นเงินคืน', 'คูปองแลกเงินสด', 20, '/images/rewards/THB-cash.jpg', 99, true, 20)
on conflict (id) do update
   set is_variable = excluded.is_variable,
       min_points  = excluded.min_points;

-- ----------------------------------------------------------------------------
-- FIFO lot consumption — the one place points leave a balance
-- ----------------------------------------------------------------------------

/*
 * Consumes p_points across the caller's active, unexpired lots oldest-first and
 * returns the per-lot split, so the caller can write ledger entries against it.
 *
 * All-or-nothing, matching GAS (points/Code.gs:377-385): the balance is checked
 * in full before anything is deducted, and a short balance deducts nothing.
 *
 * The advisory lock is what GAS got from LockService.getUserLock(). Without it
 * two concurrent spends that each fit the balance — but not together — would
 * both pass their check and overdraw. `point_lots_not_overconsumed` would catch
 * the overdraft per lot, but only by chance, and only sometimes.
 */
create or replace function app.consume_lots(
  p_line_user_id text,
  p_points       integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_remaining integer := p_points;
  v_available integer;
  v_take      integer;
  v_lot       record;
  v_entries   jsonb := '[]'::jsonb;
begin
  if p_points is null or p_points <= 0 then
    raise exception 'invalid points value: %', p_points
      using errcode = 'check_violation';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_line_user_id, 0));

  select coalesce(sum(remaining_points), 0)
    into v_available
    from app.point_lots
   where line_user_id = p_line_user_id
     and status = 'active'
     and (expires_at is null or expires_at > current_date);

  if v_available < p_points then
    raise exception 'not enough points: have %, need %', v_available, p_points
      using errcode = 'DW001';
  end if;

  -- Plan's ordering. Legacy rows can never tie (one lot per user/month), and new
  -- rows tie-break on id.
  for v_lot in
    select id, remaining_points
      from app.point_lots
     where line_user_id = p_line_user_id
       and status = 'active'
       and (expires_at is null or expires_at > current_date)
       and remaining_points > 0
     order by expires_at nulls last, earned_at, id
     for update
  loop
    exit when v_remaining <= 0;

    v_take := least(v_lot.remaining_points, v_remaining);

    update app.point_lots
       set consumed_points = consumed_points + v_take
     where id = v_lot.id;

    v_entries := v_entries || jsonb_build_object('lot_id', v_lot.id, 'points', v_take);
    v_remaining := v_remaining - v_take;
  end loop;

  -- Unreachable: the balance was checked above under the same lock. Loud rather
  -- than silently under-spending if that ever stops being true.
  if v_remaining > 0 then
    raise exception 'lot consumption left % points unallocated', v_remaining
      using errcode = 'internal_error';
  end if;

  return v_entries;
end;
$$;

/*
 * Writes the transaction, the ledger entries and the account aggregate for a
 * spend whose lots have already been consumed. Shared by every spend path so
 * they cannot drift.
 */
create or replace function app.record_spend(
  p_line_user_id    text,
  p_points          integer,
  p_category        text,
  p_entries         jsonb,
  p_idempotency_key text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx_id text := app.new_tx_id();
  v_entry jsonb;
begin
  insert into app.point_transactions (
    tx_id, line_user_id, kind, points_delta, category, idempotency_key
  )
  values (
    v_tx_id, p_line_user_id, 'spend',
    -- Stored negative. GAS stored a positive magnitude with type='spend';
    -- lib/supabase/reads.ts already takes abs() so the API shape is unchanged.
    -p_points, p_category, p_idempotency_key
  );

  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    insert into app.point_ledger_entries (tx_id, lot_id, points_delta)
    values (v_tx_id, (v_entry->>'lot_id')::bigint, -(v_entry->>'points')::integer);
  end loop;

  insert into app.points_accounts (line_user_id, lifetime_spent, last_updated)
  values (p_line_user_id, p_points, now())
  on conflict (line_user_id) do update
     set lifetime_spent = app.points_accounts.lifetime_spent + excluded.lifetime_spent,
         last_updated   = now();

  return v_tx_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- spend_points — variable-amount spends with no coupon (donations)
-- ----------------------------------------------------------------------------

/*
 * A donation's amount is genuinely the user's choice, so unlike a reward this
 * one legitimately takes `p_points` from the request. Nothing is minted.
 *
 * Phase 7 moves donation campaigns into the catalog; until then the item name
 * is descriptive text, exactly as GAS stored it.
 */
create or replace function app.spend_points(
  p_line_user_id    text,
  p_points          integer,
  p_category        text    default 'donate',
  p_items           jsonb   default '[]'::jsonb,
  p_idempotency_key text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entries jsonb;
  v_tx_id   text;
  v_item    jsonb;
  v_status  text;
begin
  if p_category not in ('reward', 'donate') then
    raise exception 'unknown spend category: %', p_category
      using errcode = 'check_violation';
  end if;

  v_entries := app.consume_lots(p_line_user_id, p_points);
  v_tx_id   := app.record_spend(p_line_user_id, p_points, p_category, v_entries, p_idempotency_key);

  -- logSpendDetails (points/Code.gs:442-461).
  v_status := case when p_category = 'donate' then 'บริจาคสำเร็จ' else 'รอใช้งานคูปอง' end;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    insert into app.spend_details (
      tx_id, line_user_id, category, item_name, quantity, points, status
    )
    values (
      v_tx_id, p_line_user_id, p_category,
      coalesce(v_item->>'name', ''),
      coalesce((v_item->>'quantity')::integer, 1),
      coalesce((v_item->>'points')::integer, 0),
      v_status
    );
  end loop;

  return jsonb_build_object(
    'tx_id',        v_tx_id,
    'points_spent', p_points,
    'remaining_balance', (
      select spendable_points from app.v_user_balances where line_user_id = p_line_user_id
    )
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- redeem_rewards — price, spend and mint, atomically
-- ----------------------------------------------------------------------------

/*
 * Replaces spend-then-create. The rewards page did those as two independent
 * calls and had an apology branch for when the second failed
 * ("แลกคะแนนสำเร็จ แต่ไม่สามารถสร้างคูปองได้") — that state is now unreachable,
 * and checkout's silent version of the same bug goes with it.
 *
 * p_items: [{reward_id, quantity, points?}]
 *   `points` is accepted ONLY for is_variable rewards (the cash-back coupon) and
 *   is floored at min_points. For every other reward it is ignored outright —
 *   the price is app.rewards.points.
 *
 * One coupon per UNIT, not per line: a coupon is what staff scan to hand over
 * one item, and CouponRecord has no quantity field to mean anything else.
 */
create or replace function app.redeem_rewards(
  p_line_user_id    text,
  p_items           jsonb,
  p_redeem_type     text default 'pickup',
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item      jsonb;
  v_reward    app.rewards%rowtype;
  v_qty       integer;
  v_unit      integer;
  v_total     integer := 0;
  v_priced    jsonb := '[]'::jsonb;
  v_entries   jsonb;
  v_tx_id     text;
  v_coupons   jsonb := '[]'::jsonb;
  v_coupon_id text;
  v_existing  jsonb;
  i           integer;
begin
  if p_redeem_type is not null and p_redeem_type not in ('pickup', 'delivery') then
    raise exception 'unknown redeem type: %', p_redeem_type
      using errcode = 'check_violation';
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'no items to redeem'
      using errcode = 'check_violation';
  end if;

  -- Replay of a completed redemption: return the coupons that were minted then,
  -- rather than minting a second set. Checked before any pricing so a retry is
  -- cheap and cannot partially re-run.
  if p_idempotency_key is not null then
    select jsonb_agg(app.coupon_json(c) order by c.coupon_id)
      into v_existing
      from app.coupons c
     where c.line_user_id = p_line_user_id
       and c.idempotency_key like p_idempotency_key || ':%';

    if v_existing is not null then
      return jsonb_build_object(
        'tx_id',      (select tx_id from app.coupons
                        where line_user_id = p_line_user_id
                          and idempotency_key like p_idempotency_key || ':%'
                        limit 1),
        'points_used', 0,
        'coupons',     v_existing,
        'duplicate',   true
      );
    end if;
  end if;

  -- Pass 1: price everything from the catalog before spending anything.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_reward
      from app.rewards
     where id = (v_item->>'reward_id')::integer;

    if not found or not v_reward.is_active then
      raise exception 'reward % is not available', v_item->>'reward_id'
        using errcode = 'DW003';
    end if;

    v_qty := coalesce((v_item->>'quantity')::integer, 1);
    if v_qty < 1 or v_qty > 99 then
      raise exception 'invalid quantity % for reward %', v_qty, v_reward.id
        using errcode = 'check_violation';
    end if;

    if v_reward.is_variable then
      v_unit := coalesce((v_item->>'points')::integer, 0);
      if v_unit < v_reward.min_points then
        raise exception 'reward % needs at least % points, got %',
          v_reward.id, v_reward.min_points, v_unit
          using errcode = 'DW003';
      end if;
    else
      -- The client's `points` is not consulted. This line is the fix for the
      -- 17,000-point reward being redeemable for 1.
      v_unit := v_reward.points;
    end if;

    v_total := v_total + (v_unit * v_qty);
    v_priced := v_priced || jsonb_build_object(
      'reward_id', v_reward.id,
      'name',      v_reward.name,
      'description', case
                       when v_reward.is_variable
                         then v_reward.description || ' ' || v_unit::text || ' บาท'
                       else v_reward.description
                     end,
      'image',     v_reward.image_path,
      'quantity',  v_qty,
      'unit',      v_unit
    );
  end loop;

  -- Pass 2: one spend for the whole basket.
  v_entries := app.consume_lots(p_line_user_id, v_total);
  v_tx_id   := app.record_spend(p_line_user_id, v_total, 'reward', v_entries, p_idempotency_key);

  -- Pass 3: the ledger rows and the coupons.
  for v_item in select * from jsonb_array_elements(v_priced)
  loop
    v_qty := (v_item->>'quantity')::integer;

    insert into app.spend_details (
      tx_id, line_user_id, category, item_name, quantity, points, status
    )
    values (
      v_tx_id, p_line_user_id, 'reward',
      v_item->>'name', v_qty,
      (v_item->>'unit')::integer * v_qty,
      'รอใช้งานคูปอง'
    );

    for i in 1..v_qty loop
      v_coupon_id := app.new_coupon_id();

      insert into app.coupons (
        coupon_id, line_user_id, reward_id, reward_name, reward_description,
        reward_image, points_used, tx_id, status, redeem_type, idempotency_key
      )
      values (
        v_coupon_id, p_line_user_id, (v_item->>'reward_id')::integer,
        v_item->>'name', coalesce(v_item->>'description', ''),
        coalesce(v_item->>'image', ''), (v_item->>'unit')::integer,
        v_tx_id, 'active', coalesce(p_redeem_type, 'pickup'),
        -- Suffixed: coupons_idem_uniq is a single-column index, and one
        -- redemption legitimately mints several coupons.
        case when p_idempotency_key is null then null
             else p_idempotency_key || ':' || v_coupon_id end
      );

      v_coupons := v_coupons || app.coupon_json(
        (select c from app.coupons c where c.coupon_id = v_coupon_id)
      );
    end loop;
  end loop;

  return jsonb_build_object(
    'tx_id',       v_tx_id,
    'points_used', v_total,
    'coupons',     v_coupons,
    'duplicate',   false
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- use_coupon — compare-and-swap, with mark_spend_used folded in
-- ----------------------------------------------------------------------------

/*
 * `update … where status = 'active' returning *` is the whole concurrency
 * story: two staff scanning the same QR at once, exactly one succeeds. Zero rows
 * back means either "no such coupon" or "already used", and the re-select tells
 * them apart — GAS distinguished these by scanning the sheet twice, which is
 * where its TOCTOU window lived (line-oa/Code.gs:243-264).
 *
 * The spend_details flip used to be a separate best-effort call from
 * app/coupon-confirm/[id]/page.tsx, made after the coupon was already consumed
 * and explicitly allowed to fail. Same transaction now.
 */
create or replace function app.use_coupon(
  p_coupon_id  text,
  p_scanned_by text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coupon app.coupons%rowtype;
  v_status text;
begin
  update app.coupons
     set status     = 'used',
         used_at    = now(),
         scanned_by = coalesce(nullif(p_scanned_by, ''), 'staff')
   where coupon_id = p_coupon_id
     and status = 'active'
     and (expires_at is null or expires_at > now())
   returning * into v_coupon;

  if not found then
    select status into v_status from app.coupons where coupon_id = p_coupon_id;

    if v_status is null then
      raise exception 'coupon not found: %', p_coupon_id
        using errcode = 'no_data_found';
    end if;

    raise exception 'coupon is not active (status: %)', v_status
      using errcode = 'DW002';
  end if;

  if v_coupon.tx_id is not null then
    update app.spend_details
       set status = 'ใช้คูปองแล้ว'
     where tx_id = v_coupon.tx_id
       and line_user_id = v_coupon.line_user_id;
  end if;

  return app.coupon_json(v_coupon);
end;
$$;

-- ----------------------------------------------------------------------------
-- expire_points — present, and deliberately not scheduled
-- ----------------------------------------------------------------------------

/*
 * GAS has expirePoints() but it is NOT in its ACTIONS map, so it was only ever
 * reachable from a time-driven trigger — and whether that trigger is installed
 * is not knowable from source. The 2-year horizon is longer than the dataset is
 * old, so it has almost certainly never fired on real data.
 *
 * Nothing calls this and nothing schedules it. Enabling expiry that has never
 * run would silently delete real balances the first time it fires; that has to
 * be a deliberate decision made against the export, not a default.
 */
create or replace function app.expire_points()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expired integer;
begin
  with expired as (
    update app.point_lots
       set status = 'expired'
     where status = 'active'
       and expires_at is not null
       and expires_at <= current_date
     returning 1
  )
  select count(*) into v_expired from expired;

  return v_expired;
end;
$$;

-- ----------------------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------------------

/*
 * Same CPNxxxxxxxx-xxxx-xxxx shape the scanner and existing QR codes expect,
 * but CSPRNG-backed. The old generator was three Math.random() calls
 * (app/api/coupons/redeem/route.ts:29-31) producing the QR payload itself, so
 * coupon ids were guessable and /api/coupons/use had no auth.
 */
create or replace function app.new_coupon_id()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'CPN' || upper(substr(h, 1, 8)) || '-' || upper(substr(h, 9, 4)) || '-' || upper(substr(h, 13, 4))
    from (select replace(gen_random_uuid()::text, '-', '') as h) s;
$$;

create or replace function app.coupon_json(p_coupon app.coupons)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'coupon_id',          p_coupon.coupon_id,
    'user_id',            p_coupon.line_user_id,
    'reward_id',          coalesce(p_coupon.reward_id, 0),
    'reward_name',        p_coupon.reward_name,
    'reward_description', p_coupon.reward_description,
    'reward_image',       p_coupon.reward_image,
    'points_used',        p_coupon.points_used,
    'tx_id',              p_coupon.tx_id,
    'status',             p_coupon.status,
    'redeemed_at',        p_coupon.redeemed_at,
    'used_at',            p_coupon.used_at,
    'expires_at',         p_coupon.expires_at,
    'scanned_by',         p_coupon.scanned_by,
    'redeem_type',        p_coupon.redeem_type
  );
$$;

-- ----------------------------------------------------------------------------
-- Grants
-- ----------------------------------------------------------------------------

revoke all on function app.consume_lots(text, integer)                       from public, anon, authenticated;
revoke all on function app.record_spend(text, integer, text, jsonb, text)    from public, anon, authenticated;
revoke all on function app.spend_points(text, integer, text, jsonb, text)    from public, anon, authenticated;
revoke all on function app.redeem_rewards(text, jsonb, text, text)           from public, anon, authenticated;
revoke all on function app.use_coupon(text, text)                            from public, anon, authenticated;
revoke all on function app.expire_points()                                   from public, anon, authenticated;
revoke all on function app.new_coupon_id()                                   from public, anon, authenticated;
revoke all on function app.coupon_json(app.coupons)                          from public, anon, authenticated;

grant execute on function app.spend_points(text, integer, text, jsonb, text) to service_role;
grant execute on function app.redeem_rewards(text, jsonb, text, text)        to service_role;
grant execute on function app.use_coupon(text, text)                         to service_role;

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
