-- Completed quests. The API validates the quest (packages/shared quests) and grants its XP through
-- complete_quest(), which records the completion and adds the XP in one transaction, exactly once.
create table public.bud_quests (
  bud_id uuid not null references public.buds (id) on delete cascade,
  quest_id text not null check (quest_id ~ '^[a-z0-9-]{2,40}$'),
  xp integer not null check (xp >= 0),
  completed_at timestamptz not null default now(),
  primary key (bud_id, quest_id)
);

alter table public.bud_quests enable row level security;

-- Returns the bud's new XP, or null if the quest was already completed (nothing changes then).
create function public.complete_quest(p_bud uuid, p_quest text, p_xp integer)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_xp integer;
begin
  insert into public.bud_quests (bud_id, quest_id, xp) values (p_bud, p_quest, p_xp)
  on conflict (bud_id, quest_id) do nothing;
  if not found then
    return null;
  end if;
  update public.buds set xp = xp + p_xp where id = p_bud returning xp into new_xp;
  return new_xp;
end;
$$;

-- only the API (service role) may call it
revoke all on function public.complete_quest(uuid, text, integer) from public, anon, authenticated;
