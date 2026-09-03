-- ============================================================================
-- 0007_storage.sql — private bucket for waste evidence photos (Phase 6)
--
-- Replaces Google Drive, which was failing in two ways at once:
--
--   1. Rate limits. uploadImageToDrive (line-oa/Code.gs:352) stored
--      `https://drive.google.com/thumbnail?id=…&sz=w1000`, and with
--      `images.unoptimized` every viewer's browser fetched that directly on
--      every page view. Google throttles that endpoint per IP — the history
--      page renders one thumbnail per record, so a user with a dozen records
--      gets a burst of 429s and blank images.
--
--   2. The photos are public. That GAS function never calls setSharing, so the
--      thumbnails only resolve because the parent Drive folder is shared with
--      anyone-with-the-link — meaning every evidence photo of every registered
--      user is readable by anyone who has the URL, and the URLs sit in a
--      spreadsheet. For an app whose registration flow is a PDPA consent form,
--      that is the more serious of the two.
--
-- The bucket is private. Uploads go to a signed URL the SERVER issues, so the
-- object path is derived from a verified LINE ID token and a client cannot
-- write into another user's prefix. Reads are short-lived signed URLs.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'waste-photos',
  'waste-photos',
  false,
  -- 8 MB. lib/compress-image targets ~2 MB; the headroom is for a phone that
  -- produces something unusual, not an invitation to upload originals.
  8 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
   set public             = excluded.public,
       file_size_limit    = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- No policies, deliberately.
--
-- storage.objects has RLS enabled by Supabase. Granting nothing to anon or
-- authenticated means neither can list, read, write or delete — the only access
-- is service_role (which bypasses RLS) issuing signed URLs, and those URLs
-- carry their own short-lived token.
--
-- This block asserts that rather than assuming it: a future migration that adds
-- a permissive storage policy will fail here instead of silently making every
-- evidence photo public again.
-- ----------------------------------------------------------------------------

do $$
declare
  v_policies text;
begin
  select string_agg(policyname, ', ')
    into v_policies
    from pg_policies
   where schemaname = 'storage'
     and tablename  = 'objects'
     and (roles::text[] && array['anon', 'authenticated', 'public']);

  if v_policies is not null then
    raise exception
      'storage.objects has policies granting anon/authenticated: % — waste-photos must stay private',
      v_policies;
  end if;
end;
$$;

do $$
begin
  if exists (select 1 from storage.buckets where id = 'waste-photos' and public) then
    raise exception 'waste-photos bucket is public';
  end if;
end;
$$;
