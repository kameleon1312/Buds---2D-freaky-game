-- Skill ranks. Points come from the bud's level (level - 1); the API spends them through upgrade_skill(), which
-- checks the free points and the maximum rank and raises the rank in one statement (no double spending).
create table public.bud_skills (
  bud_id uuid not null references public.buds (id) on delete cascade,
  skill_id text not null check (skill_id ~ '^[a-z0-9-]{2,40}$'),
  rank integer not null default 0 check (rank between 0 and 10),
  primary key (bud_id, skill_id)
);

alter table public.bud_skills enable row level security;

-- Returns the new rank, or null when there is no free point or the skill is maxed.
create function public.upgrade_skill(p_bud uuid, p_skill text, p_points integer, p_max integer)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  spent integer;
  current_rank integer;
begin
  -- serialise upgrades of one bud so two parallel requests can't spend the same point
  perform 1 from public.buds where id = p_bud for update;
  select coalesce(sum(rank), 0) into spent from public.bud_skills where bud_id = p_bud;
  select coalesce((select rank from public.bud_skills where bud_id = p_bud and skill_id = p_skill), 0) into current_rank;
  if spent >= p_points or current_rank >= p_max then
    return null;
  end if;
  insert into public.bud_skills (bud_id, skill_id, rank) values (p_bud, p_skill, 1)
  on conflict (bud_id, skill_id) do update set rank = public.bud_skills.rank + 1;
  return current_rank + 1;
end;
$$;

revoke all on function public.upgrade_skill(uuid, text, integer, integer) from public, anon, authenticated;
