-- Dystrykty, second plan (docs/dystrykty.md): the wastelands now have four plots each in new places, and a district
-- starts as a small clearing and grows by clearing its plot sector by sector instead of in four stages. The stored
-- documents of the first plan (plot ids and stages) don't fit it, so every district founded under it is closed and its
-- plot price (land.ts plotPrice: 200 + 50 × the wasteland's first level) is given back to its bud's wallet; the bud
-- can buy one of the new plots right away.

with refunds as (
  select
    bud_id,
    case route
      when 'pustkowie-ostepy' then 300
      when 'pustkowie-wydmy' then 350
      when 'pustkowie-gosciniec' then 400
      when 'pustkowie-nieuzytki' then 500
      else 300
    end as price
  from public.bud_lands
)
insert into public.bud_wallets (bud_id, coins)
select bud_id, price from refunds
on conflict (bud_id) do update
  set coins = public.bud_wallets.coins + excluded.coins, updated_at = now();

delete from public.bud_lands;
