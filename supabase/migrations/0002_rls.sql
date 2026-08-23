-- ============================================================================
-- 0002_rls.sql — deny-all lockdown (Phase 1)
--
-- Belt and braces. Three independent layers, any one of which would be enough:
--   1. schema `app` is the only schema PostgREST serves, and nothing grants
--      anon/authenticated USAGE on it;
--   2. every table has RLS enabled with ZERO policies, so a non-BYPASSRLS role
--      sees no rows even if it somehow reached the table;
--   3. all privileges are explicitly revoked from anon, authenticated, public.
--
-- Routes use the service-role key, which has BYPASSRLS. There is deliberately
-- no `auth.uid()` path: identity comes from a server-verified LINE ID token.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RLS on, no policies
-- ----------------------------------------------------------------------------

-- FORCE additionally subjects the table OWNER to RLS. Roles holding BYPASSRLS
-- (service_role, postgres) are unaffected, which is exactly what we want.
alter table app.ref_gender            enable row level security;
alter table app.ref_gender            force  row level security;
alter table app.ref_age_range         enable row level security;
alter table app.ref_age_range         force  row level security;
alter table app.ref_user_type         enable row level security;
alter table app.ref_user_type         force  row level security;
alter table app.ref_subdistrict       enable row level security;
alter table app.ref_subdistrict       force  row level security;
alter table app.ref_occupation        enable row level security;
alter table app.ref_occupation        force  row level security;

alter table app.waste_types           enable row level security;
alter table app.waste_types           force  row level security;
alter table app.waste_subtypes        enable row level security;
alter table app.waste_subtypes        force  row level security;

alter table app.users                 enable row level security;
alter table app.users                 force  row level security;
alter table app.waste_records         enable row level security;
alter table app.waste_records         force  row level security;

alter table app.points_accounts       enable row level security;
alter table app.points_accounts       force  row level security;
alter table app.point_lots            enable row level security;
alter table app.point_lots            force  row level security;
alter table app.point_transactions    enable row level security;
alter table app.point_transactions    force  row level security;
alter table app.point_ledger_entries  enable row level security;
alter table app.point_ledger_entries  force  row level security;
alter table app.spend_details         enable row level security;
alter table app.spend_details         force  row level security;

alter table app.rewards               enable row level security;
alter table app.rewards               force  row level security;
alter table app.coupons               enable row level security;
alter table app.coupons               force  row level security;
alter table app.admin_keys            enable row level security;
alter table app.admin_keys            force  row level security;

-- ----------------------------------------------------------------------------
-- 2. Views run as the caller, so they inherit the tables' RLS rather than
--    laundering it through the view owner's privileges.
-- ----------------------------------------------------------------------------

alter view app.v_user_balances  set (security_invoker = true);
alter view app.v_leaderboard    set (security_invoker = true);
alter view app.v_co2_collection set (security_invoker = true);

-- ----------------------------------------------------------------------------
-- 3. Revoke everything from the public-facing roles
-- ----------------------------------------------------------------------------

revoke all on all tables    in schema app from anon, authenticated, public;
revoke all on all sequences in schema app from anon, authenticated, public;
revoke all on all routines  in schema app from anon, authenticated, public;
revoke usage on schema app            from anon, authenticated, public;

-- ...including on anything created later.
alter default privileges in schema app revoke all on tables    from anon, authenticated;
alter default privileges in schema app revoke all on sequences from anon, authenticated;
alter default privileges in schema app revoke all on routines  from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Grant the service role what the routes actually need
-- ----------------------------------------------------------------------------

grant usage on schema app to service_role;
grant all on all tables    in schema app to service_role;
grant all on all sequences in schema app to service_role;
grant all on all routines  in schema app to service_role;

alter default privileges in schema app grant all on tables    to service_role;
alter default privileges in schema app grant all on sequences to service_role;
alter default privileges in schema app grant all on routines  to service_role;

-- ----------------------------------------------------------------------------
-- 5. Assertions — fail the migration rather than ship a hole
-- ----------------------------------------------------------------------------

do $$
declare
  unprotected text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into unprotected
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'app'
    and c.relkind = 'r'
    and not (c.relrowsecurity and c.relforcerowsecurity);

  if unprotected is not null then
    raise exception 'tables in schema app without FORCE RLS: %', unprotected;
  end if;
end;
$$;

do $$
declare
  leaked text;
begin
  select string_agg(format('%s:%s', c.relname, p.privilege_type), ', ')
    into leaked
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) p
  join pg_roles r on r.oid = p.grantee
  where n.nspname = 'app'
    and c.relkind in ('r', 'v')
    and r.rolname in ('anon', 'authenticated');

  if leaked is not null then
    raise exception 'anon/authenticated still hold privileges in schema app: %', leaked;
  end if;
end;
$$;
