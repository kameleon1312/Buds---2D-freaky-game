-- Ferries between the cities' harbours: the bud pays a small fare (packages/shared/src/travel.ts ferryFare) and the
-- game sails it to the other harbour. Paid atomically, never below zero coins. No new table.

create function public.pay_fare(p_bud uuid, p_price integer)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  balance integer;
begin
  insert into public.bud_wallets (bud_id) values (p_bud) on conflict (bud_id) do nothing;
  select coins into balance from public.bud_wallets where bud_id = p_bud for update;
  if balance < p_price then
    return jsonb_build_object('status', 'poor', 'coins', balance);
  end if;
  update public.bud_wallets set coins = coins - greatest(p_price, 0), updated_at = now()
  where bud_id = p_bud returning coins into balance;
  return jsonb_build_object('status', 'ok', 'coins', balance);
end;
$$;

revoke all on function public.pay_fare(uuid, integer) from public, anon, authenticated;
