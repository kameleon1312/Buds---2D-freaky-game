-- The map's fog of war per bud (packages/shared/src/explored.ts): what it has seen of each map, on every device of its
-- account. One bit per cell in base64. Only the API touches this table (RLS on, no policies).

create table public.bud_explored (
  bud_id uuid not null references public.buds (id) on delete cascade,
  map_id text not null check (map_id ~ '^[a-z0-9-]{2,60}$'),
  seen text not null check (length(seen) <= 8000),
  updated_at timestamptz not null default now(),
  primary key (bud_id, map_id)
);

alter table public.bud_explored enable row level security;

-- Adds cells to what the bud has seen of a map, in one transaction, so two devices saving at once both count; never
-- takes any away. A stored field of another size (a map that was redrawn) is replaced. Returns all of it.
create function public.merge_explored(p_bud uuid, p_map text, p_seen text)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  merged bytea := decode(p_seen, 'base64');
  had bytea;
  result text;
begin
  insert into public.bud_explored (bud_id, map_id, seen) values (p_bud, p_map, p_seen)
  on conflict (bud_id, map_id) do nothing;
  select decode(seen, 'base64') into had from public.bud_explored
  where bud_id = p_bud and map_id = p_map for update;
  if length(had) = length(merged) then
    for i in 0 .. length(merged) - 1 loop
      merged := set_byte(merged, i, get_byte(merged, i) | get_byte(had, i));
    end loop;
  end if;
  -- encode() breaks long lines; the game reads one line
  result := replace(encode(merged, 'base64'), E'\n', '');
  update public.bud_explored set seen = result, updated_at = now()
  where bud_id = p_bud and map_id = p_map;
  return result;
end;
$$;

revoke all on function public.merge_explored(uuid, text, text) from public, anon, authenticated;
