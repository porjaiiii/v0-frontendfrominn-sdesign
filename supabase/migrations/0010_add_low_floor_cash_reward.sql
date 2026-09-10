-- ============================================================================
-- 0010_add_low_floor_cash_reward.sql — new cash-back reward, floor 1 (was 20)
--
-- Insert-only: app.rewards id 99 (the original cash-back coupon, seeded by
-- 0005_rpc_points.sql with min_points = 20) is left untouched — no UPDATE or
-- DELETE against an existing row. This adds a new row, id 100, identical
-- except min_points = 1. id 100 is also exactly the id app.create_reward's
-- "max(id)+1" logic (lib/supabase/writes.ts) would hand the next
-- admin-created reward, so nothing downstream collides with it.
--
-- id 99 stays active and will keep appearing in GET /api/catalog/rewards
-- alongside the new row until it's retired through the reward management
-- page (not built yet) — a deliberate follow-up, not an oversight here.
--
-- lib/rewards-catalog.ts's CASH_REWARD_ID moves to 100 in the same change,
-- so the app quotes/redeems against the new floor.
-- ============================================================================

insert into app.rewards (id, name, description, points, image_path, sort_order, is_variable, min_points)
values (100, 'แลกแต้มเป็นเงินคืน', 'คูปองแลกเงินสด', 1, '/images/rewards/THB-cash.jpg', 100, true, 1)
on conflict (id) do nothing;
