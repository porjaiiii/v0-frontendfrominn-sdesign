-- ============================================================================
-- 0003_seed_catalog.sql — catalog + reference seed (Phase 1)
--
-- Values are copied verbatim from today's constants so the migration is a pure
-- move, not a redesign:
--   app/register/page.tsx:13-36          demographics
--   lib/waste-data.ts:3-45               waste types, subtypes, rewards
--   app/api/waste/submit/route.ts:5-19   carbon factors, points per kg
--
-- WARNING for Phase 8: the ref_* tables below carry only the values the CURRENT
-- UI offers. Before loading prod users you MUST also insert `select distinct`
-- of each column from the export with is_active = false, or drifted real rows
-- are rejected by the FKs on app.users.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Demographics
-- ----------------------------------------------------------------------------

insert into app.ref_gender (value, sort_order) values
  ('ชาย', 1), ('หญิง', 2), ('LGBTQ+', 3), ('ไม่ระบุ', 4);

insert into app.ref_age_range (value, sort_order) values
  ('ต่ำกว่า 25', 1), ('26-45', 2), ('46-60', 3), ('61 ปีขึ้นไป', 4);

-- is_tourist replaces string-matching 'นักท่องเที่ยว' at the call sites.
insert into app.ref_user_type (value, is_tourist, sort_order) values
  ('คนในชุมชนคุ้งบางกะเจ้า', false, 1),
  ('นักท่องเที่ยว',          true,  2);

insert into app.ref_subdistrict (value, sort_order) values
  ('ทรงคนอง', 1), ('บางกระสอบ', 2), ('บางน้ำผึ้ง', 3), ('บางยอ', 4),
  ('บางกอบัว', 5), ('บางกะเจ้า', 6), ('อื่น ๆ', 7);

insert into app.ref_occupation (value, sort_order) values
  ('ผู้ประกอบการ (ร้านค้า/โฮมสเตย์)', 1),
  ('เกษตรกร',                          2),
  ('ข้าราชการ/พนักงานของรัฐ',          3),
  ('พนักงานบริษัทเอกชน',               4),
  ('รับจ้างทั่วไป',                    5),
  ('นักเรียน/นักศึกษา',                6),
  ('ผู้เกษียณอายุ/ว่างงาน',            7),
  ('อื่นๆ',                            8);

-- ----------------------------------------------------------------------------
-- Waste types — name/icon from WASTE_TYPES, rates from CARBON_FACTORS and
-- POINTS_PER_KG (identical in all five places they are currently duplicated).
--
-- `oil` has rates and subtypes but is absent from WASTE_TYPES, so it is a
-- deliberately hidden type: seeded for historical records, is_active = false.
-- ----------------------------------------------------------------------------

insert into app.waste_types (id, name_th, icon_path, carbon_factor, points_per_kg, sort_order, is_active) values
  ('plastic',  'พลาสติก',   '/images/waste/plastic.svg',  1.0310,  6, 1, true),
  ('paper',    'กระดาษ',    '/images/waste/paper.svg',    3.5460,  4, 2, true),
  ('glass',    'แก้ว',      '/images/waste/glass.svg',    0.2760,  4, 3, true),
  ('aluminum', 'อลูมิเนียม', '/images/waste/aluminum.svg', 9.1270, 25, 4, true),
  ('oil',      'น้ำมัน',    null,                          3.0000,  3, 5, false);

insert into app.waste_subtypes (waste_type_id, id, name_th, description_th, image_path, sort_order) values
  ('plastic',  'pet',       'ขวดน้ำพลาสติกใส',  '(PET)',  '/images/waste/plastic-pet.svg',        1),
  ('plastic',  'hdpe',      'ขวดน้ำพลาสติกขุ่น', '(HDPE)', '/images/waste/plastic-hdpe.svg',       2),
  ('plastic',  'ldpe',      'ฝาขวดน้ำพลาสติก',  '(HDPE)', '/images/waste/plastic-ldpe.svg',       3),

  ('paper',    'cardboard', 'กระดาษลัง',        null,     '/images/waste/paper-cardboard.svg',    1),
  ('paper',    'a4',        'กระดาษสีขาว/(A4)', null,     '/images/waste/paper-mixed-paper.svg',  2),
  ('paper',    'mixed',     e'กระดาษนิตยสาร\nหนังสือพิมพ์', null, '/images/waste/paper-newspaper.svg', 3),

  ('glass',    'clear',     e'ขวดแก้วชนิดเดียวกัน/\nครบลัง', null, '/images/waste/glass-clear.svg', 1),
  ('glass',    'colored',   'ขวดแก้วรวม',       null,     '/images/waste/glass-colored.svg',      2),

  ('aluminum', 'can',       'กระป๋องอลูมิเนียม', null,     '/images/waste/aluminum-can.svg',       1),
  ('aluminum', 'plate',     'ฝาอลูมิเนียม',     null,     '/images/waste/aluminum-plate.svg',     2),
  ('aluminum', 'scrap',     'เศษอลูมิเนียม',    null,     '/images/waste/aluminum-scrap.svg',     3),

  ('oil',      'cooking',   'น้ำมันพืชใช้แล้ว',  null,     '/images/waste/oil-cooking.svg',        1),
  ('oil',      'motor',     'น้ำมันเครื่องใช้แล้ว', null,  '/images/waste/oil-motor.svg',          2);

-- ----------------------------------------------------------------------------
-- Rewards — ids preserved from lib/waste-data.ts REWARDS so existing coupons
-- keep resolving. `points` here becomes the server-side price: Phase 5's
-- redeem_reward RPC reads it from this table and ignores the request body.
-- ----------------------------------------------------------------------------

insert into app.rewards (id, name, description, points, image_path, sort_order) values
  (1, 'น้ำยาล้างจาน ซันไลต์',        '',                                        25,    '/images/rewards/sunlight-dish-soap.jpg',   1),
  (2, 'น้ำส้มควันไม้ สูตรเข้มข้น',   '1 ลิตร',                                  50,    '/images/rewards/wood-vinegar.jpg',         2),
  (3, 'ถ่านไบโอชาร์',                '1 กิโลกรัม',                              50,    '/images/rewards/biochar.jpg',              3),
  (4, 'ข้าวหอมมะลิ',                 '1 กิโลกรัม',                              55,    '/images/rewards/one-kg-jasmine-rice.jpg',  4),
  (5, 'น้ำมันพืช',                   '1 ลิตร 1 ขวด',                            70,    '/images/rewards/vegetable-oil.jpg',        5),
  (6, 'ข้าวหอมมะลิ',                 '5 กิโลกรัม',                              150,   '/images/rewards/five-kg-jasmine-rice.jpg', 6),
  (7, 'ทองคำแท้หนึ่งสลึง',           'ทองคำแผ่นหรือทองรูปพรรณ (ราคาปัจจุบัน)',  17000, '/images/rewards/gold-one-salung.png',      7);
