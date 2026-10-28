-- Real-time fights in the open world (docs/walka.md): a knocked-out bud loses a small share of the coins in its
-- pocket (packages/shared/src/brawl.ts KO_LOSS_PVE / KO_LOSS_PVP). Beaten by another bud on the street, the coins go
-- to the winner; beaten by an opponent of the districts, they are gone. One atomic step, never below zero coins,
-- both wallets locked in a fixed order so two knockouts at once can't deadlock. No new table.

create function public.knockout_coins(p_victim uuid, p_killer uuid, p_percent integer, p_max integer)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  balance integer;
  lost integer;
begin
  insert into public.bud_wallets (bud_id) values (p_victim) on conflict (bud_id) do nothing;
  if p_killer is not null and p_killer <> p_victim then
    insert into public.bud_wallets (bud_id) values (p_killer) on conflict (bud_id) do nothing;
    perform 1 from public.bud_wallets where bud_id in (p_victim, p_killer) order by bud_id for update;
  end if;
  select coins into balance from public.bud_wallets where bud_id = p_victim for update;
  lost := greatest(0, least(greatest(p_max, 0), (balance * greatest(p_percent, 0)) / 100));
  update public.bud_wallets set coins = coins - lost, updated_at = now()
  where bud_id = p_victim returning coins into balance;
  if lost > 0 and p_killer is not null and p_killer <> p_victim then
    update public.bud_wallets set coins = coins + lost, updated_at = now() where bud_id = p_killer;
  end if;
  return jsonb_build_object('lost', lost, 'coins', balance);
end;
$$;

revoke all on function public.knockout_coins(uuid, uuid, integer, integer) from public, anon, authenticated;
