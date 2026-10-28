import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  CONTENT,
  DAILY_INFLUENCE_CAP,
  INFLUENCE,
  MARKET_MAX_LISTINGS,
  OWNER_MIN,
  PVP_PAID_WINS,
  RATING_START,
  TURFS,
  TURF_WIN_COINS,
  WEEK_TOP_COINS,
  dayKey,
  levelOf,
  marketPayout,
  pvpCoins,
  tributeFor,
  turfOf,
  weekKey,
  type ApiError,
  type CreateBudResponse,
  type FightResponse,
  type OpenCacheResponse,
} from '@buds/shared';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/env.js';
import { createMemoryStore } from '../src/store/memory.js';

const look = {
  gender: 'on',
  mood: 'radosny',
  skin: 2,
  hair: 'krotkie',
  hairColor: 1,
  outfit: 'bluza',
  outfitColor: 3,
  pantsColor: 0,
} as const;

// a Monday noon: the week runs on for days, so nothing settles by accident
const MONDAY = Date.UTC(2026, 9, 12, 12);

function setup() {
  let clock = MONDAY;
  const store = createMemoryStore(() => new Date(clock));
  const app = createApp(
    loadEnv({
      SUPABASE_JWT_SECRET: 'x'.repeat(32),
      CREATE_LIMIT_PER_MINUTE: '1000',
      RATE_LIMIT_PER_MINUTE: '10000',
    }),
    { store, now: () => new Date(clock) },
  );
  const call = (method: string, path: string, token?: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const post = (path: string, token?: string, body?: unknown) => call('POST', path, token, body);
  const get = (path: string, token?: string) => call('GET', path, token);
  /** A bud with XP (granted the way quests do) and coins (the way caches do). */
  const bud = async (name: string, xp = 0, coins = 0) => {
    const res = await post('/v1/buds', undefined, { name, look });
    const created = (await res.json()) as CreateBudResponse;
    if (xp) await store.completeQuest(created.bud.slug, `test-${name}`, xp);
    if (coins) await store.openCache(created.bud.slug, `test-${name}`, coins, 0);
    return { slug: created.bud.slug, token: created.token };
  };
  const later = (seconds: number) => {
    clock += seconds * 1000;
  };
  const now = () => new Date(clock);
  return { app, store, post, get, call, bud, later, now };
}

const skatepark = TURFS.find((t) => t.id === 'mz-skatepark')!;

describe('turfs and influence', () => {
  it('a cache opened in a turf earns influence there, capped per day', async () => {
    const { post, bud } = setup();
    const cache = CONTENT.caches.find(
      (k) => k.minLevel <= 1 && turfOf(k.district, k.map, k.x, k.y),
    )!;
    const turf = turfOf(cache.district, cache.map, cache.x, cache.y)!;
    const me = await bud('Szperacz');
    const res = await post(`/v1/buds/me/caches/${cache.id}/open`, me.token);
    expect(res.status).toBe(200);
    const body = (await res.json()) as OpenCacheResponse;
    expect(body.influence).toEqual({
      turf: turf.id,
      name: turf.name,
      gained: INFLUENCE.cache,
      total: INFLUENCE.cache,
      captured: false,
    });
  });

  it('shows who rules each turf of a district, and the asking bud its own standing', async () => {
    const { store, get, bud, now } = setup();
    const a = await bud('Ala');
    const b = await bud('Bartek');
    const week = weekKey(now());
    const day = dayKey(now());
    await store.addInfluence(
      a.slug,
      skatepark.id,
      week,
      day,
      40,
      DAILY_INFLUENCE_CAP,
      OWNER_MIN,
      null,
    );
    await store.addInfluence(
      b.slug,
      skatepark.id,
      week,
      day,
      20,
      DAILY_INFLUENCE_CAP,
      OWNER_MIN,
      null,
    );
    const res = await get('/v1/rivalry/district/miasto-ziomkow', b.token);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      turfs: {
        id: string;
        owner: { slug: string } | null;
        mine: number;
        rank: number | null;
        tributeReady: boolean;
      }[];
    };
    const park = body.turfs.find((t) => t.id === skatepark.id)!;
    expect(park.owner?.slug).toBe(a.slug);
    expect(park).toMatchObject({ mine: 20, rank: 2, tributeReady: false });
    // without a token it's public: the owner, no standing
    const pub = (await (await get('/v1/rivalry/district/miasto-ziomkow')).json()) as typeof body;
    expect(pub.turfs.find((t) => t.id === skatepark.id)).toMatchObject({ mine: 0, rank: null });
    expect((await get('/v1/rivalry/district/nibylandia')).status).toBe(404);
  });

  it('below OWNER_MIN nobody rules; the first there keeps a tie; passing captures', async () => {
    const { store, bud, now } = setup();
    const a = await bud('Ala');
    const b = await bud('Bartek');
    const add = (slug: string, n: number) =>
      store.addInfluence(
        slug,
        skatepark.id,
        weekKey(now()),
        dayKey(now()),
        n,
        DAILY_INFLUENCE_CAP,
        OWNER_MIN,
        null,
      );
    expect((await add(a.slug, OWNER_MIN - 1)).captured).toBe(false);
    expect((await add(a.slug, 1)).captured).toBe(true);
    expect((await add(b.slug, OWNER_MIN)).captured).toBe(false);
    expect((await add(b.slug, 1)).captured).toBe(true);
    expect((await add(b.slug, DAILY_INFLUENCE_CAP)).gained).toBe(
      DAILY_INFLUENCE_CAP - OWNER_MIN - 1,
    );
  });
});

describe('tribute (haracz)', () => {
  it('the ruler collects once a day; others get nothing', async () => {
    const { store, post, get, bud, now, later } = setup();
    const a = await bud('Ala');
    const b = await bud('Bartek');
    await store.addInfluence(
      a.slug,
      skatepark.id,
      weekKey(now()),
      dayKey(now()),
      40,
      DAILY_INFLUENCE_CAP,
      OWNER_MIN,
      null,
    );
    const path = `/v1/rivalry/turfs/${skatepark.id}/tribute`;
    const wrong = await post(path, b.token);
    expect(wrong.status).toBe(409);
    expect(((await wrong.json()) as ApiError).error.code).toBe('not_ruler');
    const me = (await (await get('/v1/rivalry/me', a.token)).json()) as {
      ruled: { id: string; tributeReady: boolean }[];
    };
    expect(me.ruled).toEqual([expect.objectContaining({ id: skatepark.id, tributeReady: true })]);
    const ok = await post(path, a.token);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({
      turf: skatepark.id,
      coins: tributeFor(skatepark.district),
      gained: tributeFor(skatepark.district),
    });
    const again = await post(path, a.token);
    expect(((await again.json()) as ApiError).error.code).toBe('already_collected');
    later(86400);
    expect((await post(path, a.token)).status).toBe(200);
    expect((await post('/v1/rivalry/turfs/nie-ma/tribute', a.token)).status).toBe(404);
  });
});

describe('the week', () => {
  it('settles the finished week once: titles and coins for rulers and the top three', async () => {
    const { store, get, bud, now, later } = setup();
    const a = await bud('Ala');
    const b = await bud('Bartek');
    await store.addInfluence(
      a.slug,
      skatepark.id,
      weekKey(now()),
      dayKey(now()),
      50,
      DAILY_INFLUENCE_CAP,
      OWNER_MIN,
      'zwyciestwa',
    );
    await store.addInfluence(
      b.slug,
      'mz-rynek',
      weekKey(now()),
      dayKey(now()),
      10,
      DAILY_INFLUENCE_CAP,
      OWNER_MIN,
      null,
    );
    const ranking = (await (await get('/v1/rivalry/ranking')).json()) as {
      buds: { slug: string; points: number }[];
      challenges: { id: string; leaders: { slug: string }[] }[];
    };
    expect(ranking.buds.map((x) => [x.slug, x.points])).toEqual([
      [a.slug, 50],
      [b.slug, 10],
    ]);
    expect(ranking.challenges.find((c) => c.id === 'zwyciestwa')!.leaders[0]!.slug).toBe(a.slug);
    later(7 * 86400);
    await get('/v1/rivalry/ranking');
    await get('/v1/rivalry/ranking');
    const me = (await (await get('/v1/rivalry/me', a.token)).json()) as {
      titles: { title: string }[];
      points: number;
    };
    expect(me.titles.map((t) => t.title).sort()).toEqual(['top:1', `turf:${skatepark.id}`]);
    expect(me.points).toBe(0);
    expect((await store.wallet(a.slug)).coins).toBe(TURF_WIN_COINS + WEEK_TOP_COINS[0]);
    // b had too little to rule, but was second in the week
    expect((await store.wallet(b.slug)).coins).toBe(WEEK_TOP_COINS[1]);
  });
});

describe('crews (ekipy)', () => {
  it('found, join, rank and leave; a leaving leader hands over', async () => {
    const { store, post, get, bud, now } = setup();
    const rookie = await bud('Nowy');
    expect((await post('/v1/crews', rookie.token, { name: 'Ziomki', tag: 'zr' })).status).toBe(403);
    const a = await bud('Ala', 200);
    const b = await bud('Bartek', 200);
    const made = await post('/v1/crews', a.token, { name: 'Ziomki z Rynku', tag: 'zr' });
    expect(made.status).toBe(201);
    expect(((await made.json()) as { crew: { tag: string } }).crew.tag).toBe('ZR');
    expect((await post('/v1/crews', b.token, { name: 'ziomki z rynku', tag: 'XX' })).status).toBe(
      409,
    );
    expect((await post('/v1/crews', b.token, { name: 'x', tag: 'XX' })).status).toBe(400);
    expect((await post('/v1/crews/QQ/join', b.token)).status).toBe(404);
    expect((await post('/v1/crews/zr/join', b.token)).status).toBe(200);
    await store.addInfluence(
      b.slug,
      skatepark.id,
      weekKey(now()),
      dayKey(now()),
      15,
      DAILY_INFLUENCE_CAP,
      OWNER_MIN,
      null,
    );
    const crew = (await (await get('/v1/crews/ZR')).json()) as {
      crew: { points: number; members: { slug: string; role: string }[] };
    };
    expect(crew.crew.points).toBe(15);
    expect(crew.crew.members.map((m) => [m.slug, m.role])).toEqual([
      [a.slug, 'leader'],
      [b.slug, 'member'],
    ]);
    const ranking = (await (await get('/v1/rivalry/ranking')).json()) as {
      crews: { tag: string; points: number }[];
      buds: { crewTag: string | null }[];
    };
    expect(ranking.crews).toEqual([{ tag: 'ZR', name: 'Ziomki z Rynku', points: 15, members: 2 }]);
    expect(ranking.buds[0]!.crewTag).toBe('ZR');
    expect((await post('/v1/crews/leave', a.token)).status).toBe(200);
    const mine = (await (await get('/v1/buds/me/crew', b.token)).json()) as {
      crew: { members: { role: string }[] };
    };
    expect(mine.crew.members[0]!.role).toBe('leader');
    expect((await post('/v1/crews/leave', a.token)).status).toBe(409);
  });
});

/** Fights the rival's shadow on the street to an end (what the live server does when one of them drops). */
async function playOut(
  app: ReturnType<typeof setup>['app'],
  slug: string,
  start: FightResponse,
  outcome: 'won' | 'lost' = 'won',
) {
  const end = (await app.fights.finishShadow(slug, start.fight.id, outcome, true))!;
  return { ...end, fight: { ...start.fight, status: outcome } };
}

describe('PvP', () => {
  it('offers buds within reach, plays a duel and moves the ratings once', async () => {
    const { app, store, post, get, bud } = setup();
    const a = await bud('Ala', 900);
    const b = await bud('Bartek', 900);
    await bud('Daleki', 100 * 20 ** 2); // level 21: out of reach
    const list = (await (await get('/v1/pvp/opponents', a.token)).json()) as {
      rating: number;
      opponents: { slug: string; wait: number }[];
    };
    expect(list.rating).toBe(RATING_START);
    expect(list.opponents.map((o) => o.slug)).toEqual([b.slug]);

    const start = await post('/v1/pvp/fights', a.token, { opponent: b.slug });
    expect(start.status).toBe(201);
    const first = (await start.json()) as FightResponse;
    expect(first.fight.enemyId).toBe(`pvp-${b.slug}`);
    expect(first.fight.enemy.name).toBe('Bartek');
    const end = await playOut(app, a.slug, first);
    expect(end.fight.status === 'won' || end.fight.status === 'lost').toBe(true);
    const ratings = await store.ratings([a.slug, b.slug]);
    const delta = end.pvp!.delta;
    expect(ratings.get(a.slug)!.rating).toBe(RATING_START + delta);
    expect(ratings.get(b.slug)!.rating).toBe(RATING_START - delta);
    if (end.fight.status === 'won') {
      expect(end.reward).toMatchObject({
        xpGained: 0,
        coinsGained: pvpCoins(RATING_START + delta),
      });
      expect(end.pvp!.paidLeft).toBe(PVP_PAID_WINS - 1);
    } else {
      expect(delta).toBeLessThan(0);
      expect(end.reward).toBeNull();
    }
    // a second end changes nothing
    expect(await app.fights.finishShadow(a.slug, end.fight.id, 'won', true)).toBeNull();
    expect((await store.ratings([a.slug])).get(a.slug)!.rating).toBe(RATING_START + delta);
    // the same opponent rests for a while
    const again = await post('/v1/pvp/fights', a.token, { opponent: b.slug });
    expect(((await again.json()) as ApiError).error.code).toBe('resting');
  });

  it('running away after the first exchange, or starting another duel, counts as a loss', async () => {
    const { app, store, post, bud } = setup();
    const a = await bud('Ala', 900);
    const b = await bud('Bartek', 900);
    const c = await bud('Celina', 900);
    const start = (await (
      await post('/v1/pvp/fights', a.token, { opponent: b.slug })
    ).json()) as FightResponse;
    const fled = (await app.fights.finishShadow(a.slug, start.fight.id, 'fled', true))!;
    expect(fled.pvp!.delta).toBeLessThan(0);
    const before = (await store.ratings([a.slug])).get(a.slug)?.rating ?? RATING_START;
    const second = (await (
      await post('/v1/pvp/fights', a.token, { opponent: c.slug })
    ).json()) as FightResponse;
    // the first blows on the street, then walking off to another rival
    await app.fights.exchanged(a.slug, second.fight.id);
    expect((await post('/v1/pvp/fights', a.token, { opponent: b.slug })).status).toBe(409); // b rests
    const d = await bud('Darek', 900);
    expect((await post('/v1/pvp/fights', a.token, { opponent: d.slug })).status).toBe(201);
    expect((await store.ratings([a.slug])).get(a.slug)!.rating).toBeLessThan(before);
    expect((await store.ratings([c.slug])).get(c.slug)!.rating).toBeGreaterThan(RATING_START);
    // fled before any blow: nothing happens to the rating
    const e = await bud('Edek', 900);
    const quiet = (await (
      await post('/v1/pvp/fights', a.token, { opponent: e.slug })
    ).json()) as FightResponse;
    const mid = (await store.ratings([a.slug])).get(a.slug)!.rating;
    expect((await app.fights.finishShadow(a.slug, quiet.fight.id, 'fled', false))!.pvp).toBeNull();
    expect((await store.ratings([a.slug])).get(a.slug)!.rating).toBe(mid);
  });

  it('refuses yourself, unknown buds, the tutorial and buds out of reach', async () => {
    const { post, bud } = setup();
    const rookie = await bud('Nowy');
    const a = await bud('Ala', 900);
    const far = await bud('Daleki', 100 * 20 ** 2);
    expect((await post('/v1/pvp/fights', rookie.token, { opponent: a.slug })).status).toBe(403);
    expect((await post('/v1/pvp/fights', a.token, { opponent: a.slug })).status).toBe(404);
    expect((await post('/v1/pvp/fights', a.token, { opponent: 'nie-ma-takiego' })).status).toBe(
      404,
    );
    expect((await post('/v1/pvp/fights', a.token, { opponent: rookie.slug })).status).toBe(409);
    expect((await post('/v1/pvp/fights', a.token, { opponent: far.slug })).status).toBe(409);
  });
});

describe('the market (Bazar)', () => {
  const item = CATALOG.find(
    (i) =>
      i.shop &&
      !i.premium &&
      i.kind !== 'consumable' &&
      i.price.currency === 'coins' &&
      levelOf(i) <= 2,
  )!;
  const premium = CATALOG.find((i) => i.premium)!;

  it('sells loot to another bud for coins, minus the fee', async () => {
    const { store, post, get, call, bud } = setup();
    const seller = await bud('Ala', 200);
    const buyer = await bud('Bartek', 200, 10);
    await store.grantItem(seller.slug, item.id, 'reward');
    expect((await post('/v1/market', seller.token, { itemId: item.id, price: 2 })).status).toBe(
      400,
    );
    const listed = await post('/v1/market', seller.token, { itemId: item.id, price: 50 });
    expect(listed.status).toBe(201);
    const market = (await listed.json()) as { listings: { id: string; mine: boolean }[] };
    const id = market.listings[0]!.id;
    expect(market.listings[0]!.mine).toBe(true);
    expect((await store.items(seller.slug)).some((i) => i.itemId === item.id)).toBe(false);
    expect((await post(`/v1/market/${id}/buy`, seller.token)).status).toBe(409);
    const poor = await post(`/v1/market/${id}/buy`, buyer.token);
    expect(((await poor.json()) as ApiError).error.code).toBe('not_enough_coins');
    await store.openCache(buyer.slug, 'test-more', 100, 0);
    const bought = await post(`/v1/market/${id}/buy`, buyer.token);
    expect(bought.status).toBe(200);
    expect(((await bought.json()) as { coins: number }).coins).toBe(110 - 50);
    expect((await store.wallet(seller.slug)).coins).toBe(marketPayout(50));
    expect((await store.items(buyer.slug)).find((i) => i.itemId === item.id)?.source).toBe('trade');
    expect((await post(`/v1/market/${id}/buy`, buyer.token)).status).toBe(404);
    expect(
      (await (await get('/v1/market', buyer.token)).json()) as { listings: unknown[] },
    ).toMatchObject({ listings: [] });
    // the buyer can sell it on, and take it back
    const relisted = (await (
      await post('/v1/market', buyer.token, { itemId: item.id, price: 80 })
    ).json()) as { listings: { id: string }[] };
    expect(
      (await call('DELETE', `/v1/market/${relisted.listings[0]!.id}`, seller.token)).status,
    ).toBe(404);
    expect(
      (await call('DELETE', `/v1/market/${relisted.listings[0]!.id}`, buyer.token)).status,
    ).toBe(200);
    expect((await store.items(buyer.slug)).find((i) => i.itemId === item.id)?.source).toBe('trade');
  });

  it('never sells premium, worn, unowned or bought-with-money items; caps listings', async () => {
    const { store, post, call, bud } = setup();
    const seller = await bud('Ala', 200);
    await store.grantItem(seller.slug, premium.id, 'purchase');
    expect((await post('/v1/market', seller.token, { itemId: premium.id, price: 50 })).status).toBe(
      409,
    );
    expect((await post('/v1/market', seller.token, { itemId: item.id, price: 50 })).status).toBe(
      409,
    );
    await store.grantItem(seller.slug, item.id, 'reward');
    await call('PUT', `/v1/buds/me/equipment/${item.slot}`, seller.token, { itemId: item.id });
    const worn = await post('/v1/market', seller.token, { itemId: item.id, price: 50 });
    expect(((await worn.json()) as ApiError).error.code).toBe('worn');
    const others = CATALOG.filter(
      (i) =>
        i.shop &&
        !i.premium &&
        i.kind !== 'consumable' &&
        i.price.currency === 'coins' &&
        i.id !== item.id,
    ).slice(0, MARKET_MAX_LISTINGS + 1);
    for (const o of others) await store.grantItem(seller.slug, o.id, 'shop');
    for (const o of others.slice(0, MARKET_MAX_LISTINGS))
      expect((await post('/v1/market', seller.token, { itemId: o.id, price: 20 })).status).toBe(
        201,
      );
    const capped = await post('/v1/market', seller.token, { itemId: others.at(-1)!.id, price: 20 });
    expect(((await capped.json()) as ApiError).error.code).toBe('too_many');
  });
});

describe('rivalry auth', () => {
  it('every write needs a player token', async () => {
    const { post, call, get } = setup();
    for (const path of [
      `/v1/rivalry/turfs/${skatepark.id}/tribute`,
      '/v1/crews',
      '/v1/crews/ZR/join',
      '/v1/crews/leave',
      '/v1/pvp/fights',
      '/v1/market',
      '/v1/market/00000000-0000-0000-0000-000000000000/buy',
    ])
      expect((await post(path, undefined, {})).status).toBe(401);
    expect((await call('DELETE', '/v1/market/x')).status).toBe(401);
    for (const path of ['/v1/rivalry/me', '/v1/pvp/opponents', '/v1/market', '/v1/buds/me/crew'])
      expect((await get(path)).status).toBe(401);
    expect((await get('/v1/rivalry/district/miasto-ziomkow', 'zly-token')).status).toBe(200);
  });
});
