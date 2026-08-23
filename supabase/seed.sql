-- ============================================================================
-- seed.sql — local development data. Applied automatically by `supabase db reset`.
--
-- NEVER loaded in staging or production: `db reset` is a local-only command and
-- the prod cutover loads from the GAS export instead (Phase 8).
--
-- The first user's id (Udev0000...) is just a recognisable placeholder — there is
-- no dev auth bypass to match it against; browsing as this user still requires a
-- real, verified LINE ID token.
-- ============================================================================

insert into app.users
  (line_user_id, display_user_id, full_name, nickname, phone_number, gender,
   age_range, user_type, address, subdistrict, occupation, pdpa_consent,
   registration_date_th, registered_at)
values
  ('Udev0000000000000000000000000000', 'DW1000000000', 'นักพัฒนา ทดสอบ', 'เดฟ',
   '0800000001', 'ไม่ระบุ', '26-45', 'คนในชุมชนคุ้งบางกะเจ้า', '1 หมู่ 1',
   'บางกะเจ้า', 'พนักงานบริษัทเอกชน', 'ยอมรับ', '1/1/2569', '2026-01-01T02:00:00Z'),

  ('Udev0000000000000000000000000001', 'DW1000000001', 'สมชาย ใจดี', 'ชาย',
   '0800000002', 'ชาย', '46-60', 'คนในชุมชนคุ้งบางกะเจ้า', '2 หมู่ 3',
   'บางน้ำผึ้ง', 'เกษตรกร', 'ยอมรับ', '2/1/2569', '2026-01-02T02:00:00Z'),

  ('Udev0000000000000000000000000002', 'DW1000000002', 'มานี รักษ์โลก', 'มานี',
   '0800000003', 'หญิง', 'ต่ำกว่า 25', 'นักท่องเที่ยว', null,
   null, null, 'ยอมรับ', '3/1/2569', '2026-01-03T02:00:00Z');

-- ----------------------------------------------------------------------------
-- Waste records. Rates are snapshotted from app.waste_types, the way
-- confirm_waste will do it in Phase 4.
-- ----------------------------------------------------------------------------

insert into app.waste_records
  (line_user_id, waste_type_id, waste_subtype_id, weight_kg, image_urls,
   carbon_reduction_kg, points_earned, status, notes,
   applied_carbon_factor, applied_points_per_kg, recorded_at)
values
  ('Udev0000000000000000000000000000', 'plastic', 'pet', 3.200, '{}',
   3.2992, 19, 'done', null, 1.0310, 6, '2026-06-01T03:00:00Z'),

  ('Udev0000000000000000000000000000', 'aluminum', 'can', 1.500, '{}',
   13.6905, 38, 'done', 'กระป๋องจากงานวิ่ง', 9.1270, 25, '2026-06-05T03:00:00Z'),

  -- Unweighed and still in the cart. NULL is the legacy -1 sentinel.
  ('Udev0000000000000000000000000000', 'paper', 'cardboard', null, '{}',
   0, 0, 'pending', null, null, null, '2026-06-20T03:00:00Z'),

  ('Udev0000000000000000000000000001', 'glass', 'clear', 8.000, '{}',
   2.2080, 32, 'done', null, 0.2760, 4, '2026-06-02T03:00:00Z'),

  ('Udev0000000000000000000000000002', 'plastic', 'hdpe', 0.750, '{}',
   0.7733, 5, 'done', null, 1.0310, 6, '2026-06-10T03:00:00Z');

-- ----------------------------------------------------------------------------
-- Monotonic aggregates. The spendable balance is NOT here — it is derived by
-- app.v_user_balances from the lots below.
-- ----------------------------------------------------------------------------

insert into app.points_accounts
  (line_user_id, lifetime_earned, lifetime_spent, total_weight_kg, total_co2_kg, tier)
values
  ('Udev0000000000000000000000000000', 57, 25, 4.700, 16.9897, 'นักอนุรักษ์มือใหม่'),
  ('Udev0000000000000000000000000001', 32,  0, 8.000,  2.2080, 'นักอนุรักษ์มือใหม่'),
  ('Udev0000000000000000000000000002',  5,  0, 0.750,  0.7733, 'นักอนุรักษ์มือใหม่');

-- One lot per confirmed record, which is what makes unique(source_waste_id) a
-- real double-award guard. expires_at = last day of the month, two years on.
insert into app.point_lots
  (line_user_id, period, earned_points, consumed_points, status, expires_at, earned_at, source_waste_id)
select
  w.line_user_id,
  to_char(w.recorded_at, 'YYYY-MM'),
  w.points_earned,
  case when w.points_earned = 19 then 19
       when w.points_earned = 38 then 6
       else 0 end,                                   -- dev user has spent 25
  'active',
  (date_trunc('month', w.recorded_at) + interval '2 years' + interval '1 month - 1 day')::date,
  w.recorded_at,
  w.id
from app.waste_records w
where w.status = 'done';

insert into app.point_transactions
  (tx_id, line_user_id, kind, points_delta, co2_kg, weight_kg, category, occurred_at)
values
  ('seed_tx_earn_0001', 'Udev0000000000000000000000000000', 'earn',  19, 3.2992,  3.200, null, '2026-06-01T03:00:00Z'),
  ('seed_tx_earn_0002', 'Udev0000000000000000000000000000', 'earn',  38, 13.6905, 1.500, null, '2026-06-05T03:00:00Z'),
  ('seed_tx_spend_001', 'Udev0000000000000000000000000000', 'spend', -25, 0,      0,     'reward', '2026-06-12T03:00:00Z'),
  ('seed_tx_earn_0003', 'Udev0000000000000000000000000001', 'earn',  32, 2.2080,  8.000, null, '2026-06-02T03:00:00Z'),
  ('seed_tx_earn_0004', 'Udev0000000000000000000000000002', 'earn',   5, 0.7733,  0.750, null, '2026-06-10T03:00:00Z');

insert into app.spend_details
  (tx_id, line_user_id, category, item_name, quantity, points, status, occurred_at)
values
  ('seed_tx_spend_001', 'Udev0000000000000000000000000000', 'reward',
   'น้ำยาล้างจาน ซันไลต์', 1, 25, 'รอใช้งานคูปอง', '2026-06-12T03:00:00Z');

insert into app.coupons
  (coupon_id, line_user_id, reward_id, reward_name, reward_description, reward_image,
   points_used, tx_id, status, redeemed_at, used_at, scanned_by, redeem_type)
values
  ('CPNSEED01-0001-0001', 'Udev0000000000000000000000000000', 1,
   'น้ำยาล้างจาน ซันไลต์', '', '/images/rewards/sunlight-dish-soap.jpg',
   25, 'seed_tx_spend_001', 'active', '2026-06-12T03:00:00Z', null, null, 'pickup'),

  ('CPNSEED02-0002-0002', 'Udev0000000000000000000000000001', 3,
   'ถ่านไบโอชาร์', '1 กิโลกรัม', '/images/rewards/biochar.jpg',
   50, null, 'used', '2026-05-01T03:00:00Z', '2026-05-04T07:30:00Z', 'staff', 'pickup');

insert into app.admin_keys (key, status) values
  ('DEV-ADMIN-0001', 'unused'),
  ('DEV-ADMIN-0002', 'unused');
