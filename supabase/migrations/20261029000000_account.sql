-- Managing the account and the buds (docs/konto.md): a bud can be renamed once in RENAME_DAYS (packages/shared
-- account.ts), so the time of the last rename is kept; deleting a bud or an account goes through the API (every
-- bud_* table already cascades from buds). No new table.

alter table public.buds add column name_changed_at timestamptz;

-- The two trigger functions of the first migration are only ever run by their triggers: nobody calls them directly
-- (handle_new_user is security definer, so it must not be callable by the anon or authenticated roles).
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
-- the auth service fires the sign-up trigger: it keeps its right explicitly
grant execute on function public.handle_new_user() to supabase_auth_admin;
