-- Drops the four reference tables that only ever held a list.
--
-- app.ref_gender, ref_age_range, ref_subdistrict and ref_occupation existed to
-- foreign-key four columns on app.users. They carry no behaviour: nothing joins
-- them, no function reads them, and no route serves them — the registration form
-- has always rendered its dropdowns from hardcoded arrays. The cost was a
-- migration every time a list changed.
--
-- The values now live in lib/registration-options.ts, shared by the form and by
-- lib/schemas/register.ts, which validates them with z.enum(). That moves the
-- check from the database to the API boundary: a crafted request gets a 400
-- instead of a 23503.
--
-- app.ref_user_type is deliberately KEPT. It carries is_tourist, which
-- app.v_leaderboard joins (0001_schema.sql:470) to decide who shows as a
-- tourist on the ranking page, and 0003_seed_catalog.sql's comment says that
-- flag exists specifically to replace string-matching 'นักท่องเที่ยว' at the
-- call sites. It is a table because it does work, not because it is a list.
--
-- The users.gender / age_range / subdistrict / occupation COLUMNS and their
-- data are untouched; only the constraints and the lookup tables go.

begin;

alter table app.users drop constraint if exists users_gender_fkey;
alter table app.users drop constraint if exists users_age_range_fkey;
alter table app.users drop constraint if exists users_subdistrict_fkey;
alter table app.users drop constraint if exists users_occupation_fkey;

-- No `cascade`: if anything still depends on these — a view or a constraint
-- added after 0001 — this migration must fail loudly rather than quietly drop
-- whatever that is. app.v_leaderboard depends on ref_user_type only, which is
-- not in this list.
drop table if exists app.ref_gender;
drop table if exists app.ref_age_range;
drop table if exists app.ref_subdistrict;
drop table if exists app.ref_occupation;

commit;
