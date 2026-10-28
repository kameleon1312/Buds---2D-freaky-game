import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { serve } from '@hono/node-server';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import {
  LIVE_CLOSE,
  LIVE_PATH,
  LIVE_ROOM_CAP,
  CONTENT,
  TURFS,
  WALK_GRIDS,
  cellFeet,
  cellWalkable,
  nearestWalkable,
  positionWalkable,
  type LiveFx,
  type LiveServerMessage,
} from '@buds/shared';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/env.js';
import { attachLive, type LiveServer } from '../src/live.js';
import { hashToken } from '../src/middleware/player.js';
import { createMemoryStore } from '../src/store/memory.js';

const look = {
  gender: 'on',
  mood: 'radosny',
  skin: 1,
  hair: 'krotkie',
  hairColor: 0,
  outfit: 'bluza',
  outfitColor: 1,
  pantsColor: 0,
};

const MAP = 'miasto-ziomkow';
/** A free spot near the city's spawn (world units: y up). */
const spawn = nearestWalkable(MAP, 64.5, WALK_GRIDS[MAP]!.h - 1 - 53 + 0.2)!;

type Rig = {
  url: string;
  live: LiveServer;
  server: Server;
  store: ReturnType<typeof createMemoryStore>;
  token(name: string): Promise<string>;
  post(path: string, token: string, body: unknown): Promise<Response>;
};
let rig: Rig | undefined;

async function start(): Promise<Rig> {
  const store = createMemoryStore();
  const app = createApp(
    loadEnv({ SUPABASE_JWT_SECRET: 'x'.repeat(32), RATE_LIMIT_PER_MINUTE: '1000' }),
    { store },
  );
  const server = await new Promise<Server>((resolve) => {
    const s = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }, () =>
      resolve(s as Server),
    );
  });
  const live = attachLive(server, store, {
    addressOf: (req) => req.socket.remoteAddress ?? 'test',
    fights: app.fights,
  });
  const { port } = server.address() as AddressInfo;
  const token = async (name: string) => {
    const res = await app.request('/v1/buds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, look }),
    });
    return ((await res.json()) as { token: string }).token;
  };
  const post = async (path: string, tok: string, body: unknown) =>
    app.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify(body),
    });
  rig = { url: `ws://127.0.0.1:${port}${LIVE_PATH}`, live, server, store, token, post };
  return rig;
}

afterEach(async () => {
  if (!rig) return;
  await rig.live.close();
  await new Promise<void>((resolve) => rig!.server.close(() => resolve()));
  rig = undefined;
});

/** A test client: collects every message, waits for the next one of a kind. */
async function connect(url: string) {
  const ws = new WebSocket(url);
  const inbox: LiveServerMessage[] = [];
  const waiters: { t: string; resolve: (m: LiveServerMessage) => void }[] = [];
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString()) as LiveServerMessage;
    const i = waiters.findIndex((w) => w.t === msg.t);
    if (i >= 0) waiters.splice(i, 1)[0]!.resolve(msg);
    else inbox.push(msg);
  });
  const closed = new Promise<number>((resolve) => ws.on('close', (code) => resolve(code)));
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
  return {
    ws,
    closed,
    send: (m: unknown) => ws.send(typeof m === 'string' ? m : JSON.stringify(m)),
    next<T extends LiveServerMessage['t']>(
      t: T,
      ms = 2000,
    ): Promise<Extract<LiveServerMessage, { t: T }>> {
      const i = inbox.findIndex((m) => m.t === t);
      if (i >= 0)
        return Promise.resolve(inbox.splice(i, 1)[0] as Extract<LiveServerMessage, { t: T }>);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`no ${t} within ${ms} ms`)), ms);
        waiters.push({
          t,
          resolve: (m) => {
            clearTimeout(timer);
            resolve(m as Extract<LiveServerMessage, { t: T }>);
          },
        });
      });
    },
    /** Nothing of this kind arrives within `ms`. */
    async none(t: LiveServerMessage['t'], ms = 400) {
      await new Promise((r) => setTimeout(r, ms));
      return !inbox.some((m) => m.t === t);
    },
  };
}

/** Waits (up to `ms`) for something the server does on its own time, such as finishing a close handshake. */
async function until(done: () => boolean, ms = 2000) {
  const end = Date.now() + ms;
  while (!done() && Date.now() < end) await new Promise((r) => setTimeout(r, 10));
}

const hello = (token: string, at = spawn, map = MAP) => ({
  t: 'hello',
  token,
  map,
  x: at.x,
  y: at.y,
  f: 0,
  r: '',
});

describe('walk grids', () => {
  it('cover every map, and the cities have walls and open streets', () => {
    for (const id of [
      'miasto-ziomkow',
      'dzika-puszcza',
      'las-palmas',
      'dwor-carski',
      'los-karkos',
      'wyspa-startowa',
      'pustkowie-wydmy',
    ])
      expect(WALK_GRIDS[id], id).toBeDefined();
    const g = WALK_GRIDS[MAP]!;
    let open = 0;
    let closed = 0;
    for (let y = 0; y < g.h; y++)
      for (let x = 0; x < g.w; x++) {
        if (cellWalkable(MAP, x, y)) open++;
        else closed++;
      }
    expect(open).toBeGreaterThan(1000);
    expect(closed).toBeGreaterThan(1000);
    expect(cellWalkable(MAP, -1, 5)).toBe(false);
    expect(positionWalkable(MAP, spawn.x, spawn.y)).toBe(true);
    expect(positionWalkable('nowhere', 1, 1)).toBe(false);
  });
});

describe('sheets for a busy map', () => {
  it('draws a look once, and a new look is never served the old picture', async () => {
    const store = createMemoryStore();
    const app = createApp(
      loadEnv({ SUPABASE_JWT_SECRET: 'x'.repeat(32), RATE_LIMIT_PER_MINUTE: '1000' }),
      { store },
    );
    const res = await app.request('/v1/buds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Arkusz', look }),
    });
    const { token, bud } = (await res.json()) as { token: string; bud: { slug: string } };
    const sheet = async () =>
      Buffer.from(
        await (await app.request(`/v1/buds/${bud.slug}/sheet.png?scale=6`)).arrayBuffer(),
      );
    const first = await sheet();
    expect(first.subarray(1, 4).toString()).toBe('PNG');
    expect((await sheet()).equals(first)).toBe(true);
    const changed = await app.request('/v1/buds/me/look', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ look: { ...look, skin: 3, outfitColor: 4 } }),
    });
    expect(changed.status).toBe(200);
    expect((await sheet()).equals(first)).toBe(false);
  });
});

describe('the live server', () => {
  it('lets two buds on one map see each other arrive, move, call out and leave', async () => {
    const { url, token } = await start();
    const [ta, tb] = [await token('Ala'), await token('Bartek')];
    const a = await connect(url);
    a.send(hello(ta));
    const wa = await a.next('welcome');
    expect(wa.players).toEqual([]);
    const b = await connect(url);
    b.send(hello(tb));
    const wb = await b.next('welcome');
    expect(wb.players.map((p) => p.name)).toEqual(['Ala']);
    const joined = await a.next('join');
    expect(joined.p).toMatchObject({ name: 'Bartek', level: 1 });

    // a step to the side: the other one sees it in the next tick
    const step = nearestWalkable(MAP, spawn.x + 1, spawn.y)!;
    await new Promise((r) => setTimeout(r, 120));
    b.send({ t: 'move', x: step.x, y: step.y, f: 3, m: true, r: 'deskorolka', s: 0 });
    const state = await a.next('state');
    expect(state.ps[0]).toMatchObject({
      id: joined.p.id,
      x: step.x,
      f: 3,
      m: true,
      r: 'deskorolka',
    });

    b.send({ t: 'emote', e: 'siema' });
    expect((await a.next('emote')).e).toBe('siema');
    b.ws.close();
    expect((await a.next('leave')).id).toBe(joined.p.id);
    a.ws.close();
  });

  it('never shows a bud in a wall or going faster than anything can', async () => {
    const { url, token } = await start();
    const [ta, tb] = [await token('Ala'), await token('Cheater')];
    const a = await connect(url);
    a.send(hello(ta));
    await a.next('welcome');
    const b = await connect(url);
    b.send(hello(tb));
    await b.next('welcome');
    await a.next('join');
    // a wall: find a solid cell next to the spawn area
    const g = WALK_GRIDS[MAP]!;
    let wall: { x: number; y: number } | undefined;
    for (let cy = 0; cy < g.h && !wall; cy++)
      for (let cx = 0; cx < g.w && !wall; cx++)
        if (!positionWalkable(MAP, cx + 0.5, g.h - 1 - cy + 0.2))
          wall = { x: cx + 0.5, y: g.h - 1 - cy + 0.2 };
    await new Promise((r) => setTimeout(r, 150));
    b.send({ t: 'move', x: wall!.x, y: wall!.y, f: 0, m: true });
    // across the map in a tenth of a second
    b.send({ t: 'move', x: spawn.x + 60, y: spawn.y, f: 0, m: true });
    expect(await a.none('state')).toBe(true);
    a.ws.close();
    b.ws.close();
  });

  it('turns away unknown tokens, made-up maps, garbage and floods', async () => {
    const { url, token } = await start();
    const bad = await connect(url);
    bad.send(hello('not-a-real-token-at-all'));
    expect(await bad.closed).toBe(LIVE_CLOSE.unauthorized);

    const lost = await connect(url);
    lost.send(hello(await token('Zgubiony'), spawn, 'atlantyda'));
    expect(await lost.closed).toBe(LIVE_CLOSE.unknownMap);

    const noisy = await connect(url);
    for (let i = 0; i < 6; i++) noisy.send('{not json');
    expect(await noisy.closed).toBe(LIVE_CLOSE.badMessages);

    const early = await connect(url);
    early.send({ t: 'move', x: 1, y: 1, f: 0, m: false });
    for (let i = 0; i < 6; i++) early.send({ t: 'emote', e: 'gg' });
    expect(await early.closed).toBe(LIVE_CLOSE.badMessages);

    const flood = await connect(url);
    flood.send(hello(await token('Spamer')));
    await flood.next('welcome');
    for (let i = 0; i < 200; i++) flood.send({ t: 'ping' });
    expect(await flood.closed).toBe(LIVE_CLOSE.flooding);
  });

  it('passes the players own words on cleaned, to the sender too, and slows down spam', async () => {
    const { url, token } = await start();
    const a = await connect(url);
    a.send(hello(await token('Ala')));
    await a.next('welcome');
    const b = await connect(url);
    b.send(hello(await token('Bartek')));
    await b.next('welcome');
    await a.next('join');

    b.send({ t: 'chat', text: '  siema   kurwa, wbijaj na www.zla.example  ' });
    const heard = await a.next('chat');
    expect(heard).toMatchObject({ name: 'Bartek', text: 'siema *****, wbijaj na ***' });
    expect((await b.next('chat')).text).toBe(heard.text); // the sender sees what the room saw
    // nothing left after cleaning: nothing is sent
    b.send({ t: 'chat', text: 'kurwa' });
    expect(await a.none('chat')).toBe(true);
    // the same again at once: too fast, and only the sender hears about it
    b.send({ t: 'chat', text: 'siema kurwa, wbijaj na www.zla.example' });
    await b.next('slow');
    expect(await a.none('chat')).toBe(true);
    // far too long, or not text at all
    b.send({ t: 'chat', text: 'x'.repeat(401) });
    b.send({ t: 'chat', text: 5 });
    expect(await a.none('chat')).toBe(true);
    a.ws.close();
    b.ws.close();
  });

  it('keeps one connection per bud: the newest device wins', async () => {
    const { url, token, live } = await start();
    const t = await token('Dwa Telefony');
    const first = await connect(url);
    first.send(hello(t));
    await first.next('welcome');
    const second = await connect(url);
    second.send(hello(t));
    await second.next('welcome');
    expect(await first.closed).toBe(LIVE_CLOSE.replaced);
    // the client sees the close frame before the server has finished closing its side: wait for that
    await until(() => live.stats().peers === 1);
    expect(live.stats().peers).toBe(1);
    second.ws.close();
  });

  it('never tells the room a bud left when only its old device did', async () => {
    const { url, token } = await start();
    const watcher = await connect(url);
    watcher.send(hello(await token('Obserwator')));
    await watcher.next('welcome');
    const t = await token('Przesiadka');
    const phone = await connect(url);
    phone.send(hello(t));
    await phone.next('welcome');
    const id = (await watcher.next('join')).p.id;
    const tablet = await connect(url);
    tablet.send(hello(t));
    await tablet.next('welcome');
    // the old device goes first, then the new one comes in: the last word is a join
    expect((await watcher.next('leave')).id).toBe(id);
    expect((await watcher.next('join')).p.id).toBe(id);
    await phone.closed;
    expect(await watcher.none('leave')).toBe(true);
    // and the new device is really there: its steps reach the watcher
    const step = nearestWalkable(MAP, spawn.x + 1, spawn.y)!;
    await new Promise((r) => setTimeout(r, 120));
    tablet.send({ t: 'move', x: step.x, y: step.y, f: 3, m: true, r: '', s: 0 });
    expect((await watcher.next('state')).ps[0]!.id).toBe(id);
    watcher.ws.close();
    tablet.ws.close();
  });

  it('answers a second hello with a strike and lets a bud re-read itself only now and then', async () => {
    const { url, token } = await start();
    const watcher = await connect(url);
    watcher.send(hello(await token('Obserwator')));
    await watcher.next('welcome');
    const t = await token('Awansik');
    const bud = await connect(url);
    bud.send(hello(t));
    bud.send(hello(t));
    await bud.next('welcome');
    expect(await bud.none('welcome')).toBe(true);
    await watcher.next('join');
    bud.send({ t: 'me' });
    expect((await watcher.next('join')).p.name).toBe('Awansik');
    bud.send({ t: 'me' });
    expect(await watcher.none('join')).toBe(true);
    watcher.ws.close();
    bud.ws.close();
  });

  it('moves a bud between rooms when it changes map, and opens a second copy of a full room', async () => {
    const { url, token, live } = await start();
    const a = await connect(url);
    a.send(hello(await token('Ala')));
    await a.next('welcome');
    const b = await connect(url);
    b.send(hello(await token('Bartek')));
    await b.next('welcome');
    await a.next('join');
    const there = nearestWalkable('pustkowie-wydmy', 24, 3)!;
    b.send({ t: 'join', map: 'pustkowie-wydmy', x: there.x, y: there.y });
    expect((await b.next('welcome')).room).toBe('pustkowie-wydmy');
    await a.next('leave');
    expect(live.stats().rooms).toEqual({ [MAP]: 1, 'pustkowie-wydmy': 1 });
    a.ws.close();
    b.ws.close();
    expect(LIVE_ROOM_CAP).toBeGreaterThanOrEqual(20);
  });
});

describe('fights in the main view (walka.md)', () => {
  /** A bud of a level, with its slug (XP granted the way quests do). */
  async function fighter(r: Rig, name: string, level = 1) {
    const token = await r.token(name);
    const bud = (await r.store.getByTokenHash(hashToken(token)))!;
    if (level > 1) await r.store.completeQuest(bud.slug, `test-${name}`, 100 * (level - 1) ** 2);
    return { token, slug: bud.slug };
  }
  const park = () => {
    const t = TURFS.find((x) => x.id === 'mz-park-miejski')!;
    return nearestWalkable(
      MAP,
      cellFeet(MAP, (t.x0 + t.x1) >> 1, 0).x,
      cellFeet(MAP, 0, (t.y0 + t.y1) >> 1).y,
    )!;
  };

  it('shows the map’s opponents and the bud’s own buttons', async () => {
    const r = await start();
    const a = await connect(r.url);
    a.send(hello((await fighter(r, 'Ala')).token));
    await a.next('welcome');
    const ents = await a.next('ents');
    const spots = CONTENT.enemies
      .filter((e) => e.district === MAP)
      .reduce((n, e) => n + e.spots.length, 0);
    expect(ents.es).toHaveLength(spots);
    expect(ents.es.every((e) => e.kind === 'mob' && e.h === e.mh && e.mh > 0)).toBe(true);
    const you = await a.next('you');
    expect(you.kit!.map((k) => k?.id ?? null)).toEqual([
      'prosty',
      'sierpowy',
      'kopniak',
      'garda',
      null,
    ]);
    expect(you.hp).toBe(you.mhp);
    expect(you.open).toBe(false);
  });

  it('a blow at an opponent lands on the server and everyone sees it', async () => {
    const r = await start();
    const enemy = CONTENT.enemies.find((e) => e.district === MAP && !e.ambush && !e.boss)!;
    const at = cellFeet(MAP, enemy.spots[0]!.x, enemy.spots[0]!.y);
    const near = nearestWalkable(MAP, at.x + 1, at.y)!;
    const a = await connect(r.url);
    a.send(hello((await fighter(r, 'Ala', 3)).token, near));
    await a.next('welcome');
    const mob = (await a.next('ents')).es.find(
      (e) => e.enemy === enemy.id && Math.hypot(e.x - at.x, e.y - at.y) < 0.1,
    )!;
    await a.next('you');
    a.send({ t: 'act', a: 0, x: mob.x, y: mob.y, tid: mob.id });
    let hit: LiveFx | undefined;
    for (let i = 0; i < 10 && !hit; i++)
      hit = (await a.next('fx')).ev.find((e) => e.k === 'hit' && e.v === mob.id);
    expect(hit!.u).toBeDefined();
    expect(hit!.h).toBeLessThanOrEqual(hit!.mh!);
    // the opponent fights back now
    expect(r.live.brawlOf(MAP)!.units.get(mob.id)!.target).not.toBeNull();
  });

  it('buds fight each other from level 6 outside the safe zones, never in them', async () => {
    const r = await start();
    const spot = park();
    const a = await connect(r.url);
    const b = await connect(r.url);
    const ala = await fighter(r, 'Ala', 6);
    const bartek = await fighter(r, 'Bartek', 6);
    a.send(hello(ala.token, spot));
    await a.next('welcome');
    await a.next('you');
    const beside = nearestWalkable(MAP, spot.x + 0.8, spot.y)!;
    b.send(hello(bartek.token, beside));
    await b.next('welcome');
    expect((await b.next('you')).open).toBe(true);
    await until(() => r.live.brawlOf(MAP)!.units.has(bartek.slug));
    a.send({ t: 'act', a: 0, x: beside.x, y: beside.y, tid: bartek.slug });
    let hit: LiveFx | undefined;
    for (let i = 0; i < 10 && !hit; i++)
      hit = (await b.next('fx')).ev.find((e) => e.k === 'hit' && e.v === bartek.slug);
    expect(hit!.u).toBe(ala.slug);

    // in the market nobody can be hurt
    const brawl = r.live.brawlOf(MAP)!;
    const t = TURFS.find((x) => x.id === 'mz-rynek')!;
    const safe = nearestWalkable(
      MAP,
      cellFeet(MAP, (t.x0 + t.x1) >> 1, 0).x,
      cellFeet(MAP, 0, (t.y0 + t.y1) >> 1).y,
    )!;
    const ua = brawl.units.get(ala.slug)!;
    const ub = brawl.units.get(bartek.slug)!;
    ua.x = safe.x;
    ua.y = safe.y;
    ub.x = safe.x + 0.5;
    ub.y = safe.y;
    expect(brawl.hostile(ua, ub)).toBe(false);
  });

  it('calls a rival out to the street as a shadow only its challenger fights', async () => {
    const r = await start();
    const ala = await fighter(r, 'Ala', 4);
    const bartek = await fighter(r, 'Bartek', 4);
    const started = await r.post('/v1/pvp/fights', ala.token, { opponent: bartek.slug });
    expect(started.status).toBe(201);
    const { fight } = (await started.json()) as { fight: { id: string } };
    const a = await connect(r.url);
    a.send(hello(ala.token, park()));
    await a.next('welcome');
    await a.next('ents');
    await a.next('you');
    a.send({ t: 'summon', fight: fight.id });
    const shadow = (await a.next('ents')).es[0]!;
    expect(shadow).toMatchObject({
      kind: 'shadow',
      slug: bartek.slug,
      only: ala.slug,
      name: 'Bartek',
    });
    // a second call for the same fight brings nobody else
    a.send({ t: 'summon', fight: fight.id });
    expect(await a.none('ents')).toBe(true);
    // walking away from it: the rival gives up, and after no blow at all it is just fled
    const far = nearestWalkable(MAP, shadow.x + 40, shadow.y)!;
    a.send({ t: 'join', map: MAP, x: far.x, y: far.y });
    await until(() => !r.live.brawlOf(MAP)!.units.has(shadow.id));
    expect(r.live.brawlOf(MAP)!.units.has(shadow.id)).toBe(false);
  });
});
