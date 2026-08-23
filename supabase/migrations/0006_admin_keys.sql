-- ============================================================================
-- 0006_admin_keys.sql — activating an admin key (Phase 3, finishing)
--
-- GAS's verifyAdminKey is a GET that MUTATES (line-oa/Code.gs:188): it finds the
-- key, checks whether it is taken, and binds it to a user — three sheet
-- operations, unauthenticated, over a verb that browsers and crawlers are free
-- to retry and prefetch.
--
-- Here it is one compare-and-swap, and the caller's identity comes from a
-- verified LINE ID token rather than a query parameter.
--
--   DW004  key does not exist
--   DW005  key already bound to a different account
-- ============================================================================

/*
 * Binds an unused key to a user, or re-affirms one the same user already holds.
 *
 * `where status = 'unused'` in the UPDATE is the whole race story: two people
 * submitting the same key at the same moment, exactly one wins, and the loser
 * gets DW005 rather than silently sharing the key.
 */
create or replace function app.activate_admin_key(
  p_key          text,
  p_line_user_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key app.admin_keys%rowtype;
begin
  update app.admin_keys
     set status       = 'active',
         line_user_id = p_line_user_id,
         activated_at = now()
   where key = p_key
     and status = 'unused'
   returning * into v_key;

  if found then
    return jsonb_build_object('activated', true, 'key', v_key.key);
  end if;

  select * into v_key from app.admin_keys where key = p_key;

  if not found then
    raise exception 'admin key not found'
      using errcode = 'DW004';
  end if;

  -- Already active for this same person: logging in again on a new device is
  -- not an error.
  if v_key.status = 'active' and v_key.line_user_id = p_line_user_id then
    return jsonb_build_object('activated', false, 'key', v_key.key);
  end if;

  raise exception 'admin key is already in use'
    using errcode = 'DW005';
end;
$$;

revoke all on function app.activate_admin_key(text, text) from public, anon, authenticated;
grant execute on function app.activate_admin_key(text, text) to service_role;

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
