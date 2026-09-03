-- ============================================================================
-- 0009_fix_redeem_rewards_errcode.sql — un-break redeem_rewards' error codes
--
-- 0008_catalog.sql re-created app.redeem_rewards to add the stock check and,
-- while doing it, copied the "reward not available" / cash-floor / oversell
-- branches with `errcode = 'PT003'` instead of `'DW003'`.
--
-- That is the exact mistake 0005's own comment warns against: PostgREST
-- reserves the 'PT' class and reads a PTxxx SQLSTATE as an HTTP status
-- override, so raising 'PT003' makes the API answer with status 3 — not an
-- error a client can parse, and `error.code` comes back undefined rather than
-- 'DW003'. Caught by the test suite (points-writes.test.ts's cash-floor test
-- and catalog.test.ts's oversell test both failed with the same symptom).
--
-- Redefines the function with the three PT003s corrected to DW003 — nothing
-- else changes.
-- ============================================================================

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

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_reward
      from app.rewards
     where id = (v_item->>'reward_id')::integer
     for update;

    if not found or not v_reward.is_active then
      raise exception 'reward % is not available', v_item->>'reward_id'
        using errcode = 'DW003';
    end if;

    v_qty := coalesce((v_item->>'quantity')::integer, 1);
    if v_qty < 1 or v_qty > 99 then
      raise exception 'invalid quantity % for reward %', v_qty, v_reward.id
        using errcode = 'check_violation';
    end if;

    if v_reward.stock is not null and v_reward.stock < v_qty then
      raise exception 'reward % has % left, requested %',
        v_reward.id, v_reward.stock, v_qty
        using errcode = 'DW003';
    end if;

    if v_reward.is_variable then
      v_unit := coalesce((v_item->>'points')::integer, 0);
      if v_unit < v_reward.min_points then
        raise exception 'reward % needs at least % points, got %',
          v_reward.id, v_reward.min_points, v_unit
          using errcode = 'DW003';
      end if;
    else
      v_unit := v_reward.points;
    end if;

    if v_reward.stock is not null then
      update app.rewards set stock = stock - v_qty where id = v_reward.id;
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

  v_entries := app.consume_lots(p_line_user_id, v_total);
  v_tx_id   := app.record_spend(p_line_user_id, v_total, 'reward', v_entries, p_idempotency_key);

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
