-- ============================================================================
-- 0008_catalog.sql — donation campaigns, reward stock, catalog images (Phase 7)
--
-- Closes the last piece the plan called out: "/api/catalog/{rewards,waste-types,
-- donations}; wire up the two admin forms that currently post nowhere."
--
-- app.waste_types and app.rewards already exist (0001/0003) — this migration
-- adds what's missing: a table for donation campaigns (today a hardcoded array
-- in app/donate/page.tsx), a stock column on rewards (the admin "new reward"
-- form already collects it, with nowhere to put it), and a public bucket for
-- the images both admin forms compress client-side and then had nowhere to
-- send — unlike waste-photos, catalog images are shown to every visitor, so
-- this bucket is public-read by design, not signed-read.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Donation campaigns
-- ----------------------------------------------------------------------------

create table app.donation_campaigns (
  id bigint generated always as identity primary key,

  name        text not null,
  description text not null default '',
  image_path  text not null default '',

  opened_at  date not null default current_date,
  closes_at  date,

  -- Running total donated so far. Unlike a real ledger this is a plain counter,
  -- not derived — app/donate/page.tsx already displayed a static number per
  -- campaign, so this preserves that behaviour rather than building live
  -- attribution from spend_details, which nothing today keys by campaign.
  current_amount numeric(12,2) not null default 0 check (current_amount >= 0),

  sort_order integer not null default 0,
  is_active  boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint donation_campaigns_dates
    check (closes_at is null or closes_at >= opened_at)
);

create trigger donation_campaigns_touch
  before update on app.donation_campaigns
  for each row execute function app.tg_touch_updated_at();

create index donation_campaigns_active_idx
  on app.donation_campaigns (sort_order)
  where is_active;

-- Preserves today's four hardcoded campaigns exactly — same name, description,
-- image and running total — so switching app/donate/page.tsx from the static
-- array to a live fetch changes nothing a user sees.
insert into app.donation_campaigns (name, description, image_path, current_amount, sort_order) values
  ('ทำบุญค่าบูรณะวัดจากแดง',
   'ร่วมเป็นส่วนหนึ่งในการสืบสานพระพุทธศาสนา และอนุรักษ์ศาสนสถานอันทรงคุณค่าของชุมชน กับการทำบุญเพื่อบูรณะวัดจากแดง',
   '/images/temple/วัด2.jpg', 2560, 1),
  ('ทำบุญค่าน้ำค่าไฟวัดบางกะเจ้ากลาง',
   'ร่วมสมทบทุนค่าน้ำค่าไฟ เพื่อดูแลศาสนสถานให้พร้อมสำหรับการประกอบศาสนกิจของชุมชน',
   'https://images.unsplash.com/photo-1464207687429-7505649dae38?w=400&h=400&fit=crop', 1820, 2),
  ('ทำบุญค่าบูรณะวัดห้วยสายน้ำใจ',
   'ร่วมบูรณะและซ่อมแซมศาสนสถานที่ทรงคุณค่า เพื่อเป็นศูนย์รวมจิตใจของชาวบ้านสืบไป',
   '/images/temple/วัดพระสิงห์.jpg', 4230, 3),
  ('ทำบุญค่าบูรณะสำนักสงฆ์เขาแก้ว',
   'ร่วมพัฒนาและดูแลพื้นที่ปฏิบัติธรรม ให้เป็นสถานที่อันสงบงามสำหรับชุมชนและคนรุ่นต่อไป',
   '/images/temple/วัดภูเขา.jpg', 5680, 4);

-- ----------------------------------------------------------------------------
-- Reward stock
--
-- app/admin/rewards/new/page.tsx already has a "จำนวนในสต๊อก" field with
-- nowhere to send it. NULL means unlimited (every reward seeded in 0003 stays
-- unlimited — nothing changes for them). Enforcement lives in redeem_rewards,
-- not here: a CHECK can't see how many are being bought in this basket.
-- ----------------------------------------------------------------------------

alter table app.rewards
  add column stock integer,
  add constraint rewards_stock_nonnegative check (stock is null or stock >= 0);

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
  -- rather than minting a second set (and rather than re-checking stock a
  -- second time for a purchase that already happened).
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

  -- Pass 1: price everything from the catalog before spending anything, and
  -- lock each reward row so a concurrent redemption can't oversell the same
  -- limited stock — the same reasoning as consume_lots locking point_lots.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_reward
      from app.rewards
     where id = (v_item->>'reward_id')::integer
     for update;

    if not found or not v_reward.is_active then
      raise exception 'reward % is not available', v_item->>'reward_id'
        using errcode = 'PT003';
    end if;

    v_qty := coalesce((v_item->>'quantity')::integer, 1);
    if v_qty < 1 or v_qty > 99 then
      raise exception 'invalid quantity % for reward %', v_qty, v_reward.id
        using errcode = 'check_violation';
    end if;

    if v_reward.stock is not null and v_reward.stock < v_qty then
      raise exception 'reward % has % left, requested %',
        v_reward.id, v_reward.stock, v_qty
        using errcode = 'PT003';
    end if;

    if v_reward.is_variable then
      v_unit := coalesce((v_item->>'points')::integer, 0);
      if v_unit < v_reward.min_points then
        raise exception 'reward % needs at least % points, got %',
          v_reward.id, v_reward.min_points, v_unit
          using errcode = 'PT003';
      end if;
    else
      -- The client's `points` is not consulted. This line is the fix for the
      -- 17,000-point reward being redeemable for 1.
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
-- RLS on the new table — same posture as every other table (0002_rls.sql):
-- enable + force, zero policies, nothing granted to anon/authenticated.
-- ----------------------------------------------------------------------------

alter table app.donation_campaigns enable row level security;
alter table app.donation_campaigns force  row level security;

revoke all on app.donation_campaigns from anon, authenticated, public;
grant all  on app.donation_campaigns to service_role;

-- ----------------------------------------------------------------------------
-- Catalog images — public bucket, unlike waste-photos.
--
-- Reward and donation images are shown to every visitor, so there is nothing
-- to sign on read; only the UPLOAD is gated, server-side, to admins.
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalog-images',
  'catalog-images',
  true,
  4 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
   set public             = excluded.public,
       file_size_limit    = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- Assertions — the same dynamic checks 0002/0004/0005/0006 end with, re-run
-- here so a table or function added by THIS migration is held to the same
-- bar rather than being exempt because it arrived later.
-- ----------------------------------------------------------------------------

do $$
declare
  v_unprotected text;
begin
  select string_agg(c.relname, ', ')
    into v_unprotected
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'app'
     and c.relkind = 'r'
     and not (c.relrowsecurity and c.relforcerowsecurity);

  if v_unprotected is not null then
    raise exception 'tables without RLS enabled AND forced: %', v_unprotected;
  end if;
end;
$$;

do $$
declare
  v_leaked text;
begin
  select string_agg(c.relname, ', ')
    into v_leaked
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'app'
     and c.relkind = 'r'
     and (has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
       or has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE'));

  if v_leaked is not null then
    raise exception 'anon/authenticated hold table privileges on: %', v_leaked;
  end if;
end;
$$;

do $$
begin
  if exists (select 1 from storage.buckets where id = 'waste-photos' and public) then
    raise exception 'waste-photos bucket is public — it must stay private';
  end if;
  if not exists (select 1 from storage.buckets where id = 'catalog-images' and public) then
    raise exception 'catalog-images bucket is not public — reward/donation images would 400 for every visitor';
  end if;
end;
$$;
