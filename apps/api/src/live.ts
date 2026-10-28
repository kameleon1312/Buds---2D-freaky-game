import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import {
  BRAWL_TICK_MS,
  Brawl,
  CONTENT,
  EMOTE_COOLDOWN_SECONDS,
  CHAT_WINDOW_SECONDS,
  KIT_SLOTS,
  KO_PAIR_MS,
  PVP_MIN_LEVEL,
  chatAllowed,
  cleanChat,
  kitEntry,
  rankCooldown,
  LIVE_CLOSE,
  LIVE_HELLO_SECONDS,
  LIVE_MAX_MESSAGE,
  LIVE_MAX_SPEED,
  LIVE_PATH,
  LIVE_PER_ADDRESS,
  LIVE_PING_SECONDS,
  LIVE_RATE,
  LIVE_ROOM_CAP,
  LIVE_TICK_MS,
  levelFromXp,
  liveClientMessageSchema,
  lookVersion,
  nearestWalkable,
  positionWalkable,
  safeAt,
  walkGrid,
  type BudRecord,
  type DistrictContent,
  type LiveEntity,
  type LivePlayer,
  type LiveServerMessage,
  type LiveUnitState,
  type LiveYou,
  type Unit,
} from '@buds/shared';
import type { FightWin, Fights } from './fights.js';
import { hashToken } from './middleware/player.js';
import type { BudStore } from './store/types.js';

/**
 * The live server (packages/shared live.ts): one WebSocket per device on LIVE_PATH, signed in with the player token,
 * one room per map (more copies when one fills up). Every position is checked against the map's walk grid and the
 * speed limit before the room sees it; a bad position is simply not passed on (the bud's own screen is never
 * corrected, so walking always feels right).
 *
 * Every room also runs its fight (docs/walka.md, brawl.ts): the opponents of the map stand at their spots, buds press
 * buttons (`act`), the simulation resolves blows twenty times a second and the room sees them (`fx`, `es`, `you`).
 * Only the ends of fights grant anything, through fights.ts and the store, once.
 */

type Peer = {
  ws: WebSocket;
  address: string;
  bud?: BudRecord;
  player?: LivePlayer;
  room?: Room;
  /** When the last accepted position was taken (ms) and the token bucket for messages. */
  movedAt: number;
  tokens: number;
  refillAt: number;
  strikes: number;
  emoteAt: number;
  meAt: number;
  /** When the last chat lines went out (seconds) and the last words, against spam. */
  chatAt: number[];
  lastChat?: { text: string; at: number };
  /** A hello is being checked (the token lookup is async): a second one is a strike. */
  greeting: boolean;
  alive: boolean;
  dirty: boolean;
  /** The bud's fighter is being (re)loaded; the last `you` it was sent (to send only changes). */
  arming: boolean;
  lastYou: string;
  /** A rival is being called out (one at a time). */
  summoning: boolean;
};

/** A shadow on the street: whose fight it is, whose look it wears. */
type Shadow = {
  owner: string;
  fightId: string;
  look: string;
  kind: 'pvp' | 'raid';
  done: boolean;
  /** The first blow was written down (walking away after it is a loss). */
  marked: boolean;
};

type Room = {
  key: string;
  map: string;
  peers: Set<Peer>;
  brawl: Brawl;
  shadows: Map<string, Shadow>;
  ticks: number;
};

export type LiveOptions = {
  /** The caller's address (the same rule as the REST rate limits: a trusted proxy header or the socket). */
  addressOf: (req: IncomingMessage) => string;
  now?: () => number;
  /** The ends of fights (fights.ts); without them nobody can fight (rewards could not be written). */
  fights?: Fights;
  /** The opponents of the districts; production uses the shared content. */
  content?: DistrictContent;
};

export type LiveServer = {
  /** How many buds are connected, and per room (for tests and logs). */
  stats(): { peers: number; rooms: Record<string, number> };
  /** A room's fight (tests look inside). */
  brawlOf(roomKey: string): Brawl | undefined;
  close(): Promise<void>;
};

/** A client that stopped reading (a frozen phone) is let go before its backlog eats the server's memory. */
const MAX_BACKLOG = 512 * 1024;

const sendRaw = (peer: Peer, text: string) => {
  if (peer.ws.readyState !== WebSocket.OPEN) return;
  if (peer.ws.bufferedAmount > MAX_BACKLOG) {
    peer.ws.terminate();
    return;
  }
  peer.ws.send(text);
};

const send = (peer: Peer, msg: LiveServerMessage) => sendRaw(peer, JSON.stringify(msg));

/** How often a bud may ask the room to re-read its name, level and look. */
const ME_COOLDOWN_MS = 2000;

const round = (v: number) => Math.round(v * 100) / 100;

export function attachLive(server: Server, store: BudStore, opts: LiveOptions): LiveServer {
  const now = opts.now ?? (() => Date.now());
  const fights = opts.fights;
  const content = opts.content ?? CONTENT;
  const wss = new WebSocketServer({ noServer: true, maxPayload: LIVE_MAX_MESSAGE });
  const peers = new Set<Peer>();
  const bySlug = new Map<string, Peer>();
  const rooms = new Map<string, Room>();
  const perAddress = new Map<string, number>();
  /** When two buds last paid each other for a knockout ("a|b" sorted → ms). */
  const paidPairs = new Map<string, number>();

  const onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const path = (req.url ?? '').split('?')[0];
    if (path !== LIVE_PATH) {
      // nothing else upgrades: an unknown upgrade would otherwise hang until the client gives up
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    const address = opts.addressOf(req);
    if ((perAddress.get(address) ?? 0) >= LIVE_PER_ADDRESS) {
      socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => welcome(ws, address));
  };
  server.on('upgrade', onUpgrade);

  // ---------- rooms ----------

  const toRoom = (room: Room, msg: LiveServerMessage, except?: Peer) => {
    const text = JSON.stringify(msg);
    for (const p of room.peers) if (p !== except) sendRaw(p, text);
  };

  /** The first copy of the map's room with space, or a new copy (with the map's opponents at their spots). */
  const roomFor = (map: string): Room => {
    for (let n = 1; ; n++) {
      const key = n === 1 ? map : `${map}#${n}`;
      const room = rooms.get(key);
      if (!room) {
        const brawl = new Brawl(map, (Math.random() * 2 ** 31) | 0, now());
        if (fights) brawl.addMobs(content.enemies);
        const fresh: Room = {
          key,
          map,
          peers: new Set<Peer>(),
          brawl,
          shadows: new Map(),
          ticks: 0,
        };
        rooms.set(key, fresh);
        return fresh;
      }
      if (room.peers.size < LIVE_ROOM_CAP) return room;
    }
  };

  const entityOf = (room: Room, u: Unit): LiveEntity => {
    const shadow = room.shadows.get(u.id);
    return {
      id: u.id,
      kind: u.kind === 'shadow' ? 'shadow' : 'mob',
      enemy: u.enemyId ?? '',
      slug: shadow?.look ?? '',
      name: u.name,
      level: u.level,
      x: round(u.x),
      y: round(u.y),
      f: u.f,
      h: u.hp,
      mh: u.maxHp,
      boss: !!u.boss,
      lurk: u.lurking,
      down: u.downUntil > 0,
      only: u.only ?? '',
    };
  };

  const entities = (room: Room) =>
    [...room.brawl.units.values()].filter((u) => u.kind !== 'bud').map((u) => entityOf(room, u));

  const leaveRoom = (peer: Peer) => {
    const room = peer.room;
    if (!room) return;
    room.peers.delete(peer);
    peer.room = undefined;
    // a shadow that leaves with its challenger is written down by the next tick (now, when the room closes)
    room.brawl.remove(peer.player!.id);
    toRoom(room, { t: 'leave', id: peer.player!.id });
    if (room.peers.size === 0) {
      settleGone(room, room.brawl.step(now()));
      rooms.delete(room.key);
    }
  };

  const enterRoom = (peer: Peer, map: string) => {
    leaveRoom(peer);
    const room = roomFor(map);
    room.peers.add(peer);
    peer.room = room;
    peer.player!.s = 0;
    peer.lastYou = '';
    send(peer, {
      t: 'welcome',
      you: peer.player!.id,
      room: room.key,
      players: [...room.peers].filter((p) => p !== peer).map((p) => p.player!),
    });
    send(peer, { t: 'ents', es: entities(room) });
    toRoom(room, { t: 'join', p: peer.player! }, peer);
    void arm(peer);
  };

  /** The bud's fighter (gear, skills, perks, drinks) into its room's fight; again after anything changed it. */
  const arm = async (peer: Peer) => {
    if (!fights || !peer.bud || peer.arming) return;
    peer.arming = true;
    try {
      const [fighter, team] = await Promise.all([
        fights.fighterOf(peer.bud, true),
        fights.teamOf(peer.bud.slug),
      ]);
      const room = peer.room;
      if (!room || !peer.player || peer.ws.readyState !== WebSocket.OPEN) return;
      const u = room.brawl.addBud(
        peer.player.id,
        team || peer.player.id,
        fighter,
        peer.player.x,
        peer.player.y,
      );
      peer.player.team = team;
      peer.player.hp = u.hp;
      peer.player.mhp = u.maxHp;
      peer.lastYou = '';
      sendYou(peer);
    } finally {
      peer.arming = false;
    }
  };

  /** A position on a map, made legal: kept when a bud can stand there, else the nearest spot that is. */
  const place = (map: string, x: number, y: number) =>
    positionWalkable(map, x, y) ? { x: round(x), y: round(y) } : nearestWalkable(map, x, y);

  const playerOf = (
    bud: BudRecord,
    at: { x: number; y: number },
    f: number,
    r: string,
  ): LivePlayer => ({
    id: bud.slug,
    name: bud.name,
    level: levelFromXp(bud.xp).level,
    look: lookVersion(bud.look),
    x: at.x,
    y: at.y,
    f,
    m: false,
    r,
    s: 0,
    hp: 0,
    mhp: 0,
    team: '',
  });

  // ---------- connections ----------

  const drop = (peer: Peer, code: number, reason: string) => {
    send(peer, { t: 'bye', reason });
    peer.ws.close(code, reason);
  };

  const welcome = (ws: WebSocket, address: string) => {
    const peer: Peer = {
      ws,
      address,
      movedAt: now(),
      tokens: LIVE_RATE * 2,
      refillAt: now(),
      strikes: 0,
      emoteAt: 0,
      meAt: 0,
      chatAt: [],
      greeting: false,
      alive: true,
      dirty: false,
      arming: false,
      lastYou: '',
      summoning: false,
    };
    peers.add(peer);
    perAddress.set(address, (perAddress.get(address) ?? 0) + 1);
    const helloTimer = setTimeout(() => {
      if (!peer.bud) drop(peer, LIVE_CLOSE.noHello, 'Najpierw się przywitaj.');
    }, LIVE_HELLO_SECONDS * 1000);
    ws.on('pong', () => (peer.alive = true));
    ws.on('message', (data, isBinary) => {
      void onMessage(peer, isBinary ? '' : data.toString()).catch(() => {
        // a store hiccup must never take the server down
        drop(peer, LIVE_CLOSE.badMessages, 'Coś poszło nie tak.');
      });
    });
    ws.on('close', () => {
      clearTimeout(helloTimer);
      peers.delete(peer);
      const left = (perAddress.get(address) ?? 1) - 1;
      if (left <= 0) perAddress.delete(address);
      else perAddress.set(address, left);
      leaveRoom(peer);
      if (peer.bud && bySlug.get(peer.bud.slug) === peer) bySlug.delete(peer.bud.slug);
    });
    ws.on('error', () => ws.terminate());
  };

  /** A token bucket: LIVE_RATE messages a second, bursts up to twice that. */
  const allowed = (peer: Peer) => {
    const t = now();
    peer.tokens = Math.min(LIVE_RATE * 2, peer.tokens + ((t - peer.refillAt) / 1000) * LIVE_RATE);
    peer.refillAt = t;
    if (peer.tokens < 1) return false;
    peer.tokens -= 1;
    return true;
  };

  const strike = (peer: Peer) => {
    if (++peer.strikes >= 5) drop(peer, LIVE_CLOSE.badMessages, 'Za dużo błędnych wiadomości.');
  };

  const onMessage = async (peer: Peer, raw: string) => {
    if (!allowed(peer)) {
      // a flood: the first ones are dropped, a long one ends the connection
      if (peer.tokens < -LIVE_RATE) drop(peer, LIVE_CLOSE.flooding, 'Za szybko.');
      peer.tokens -= 0.5;
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return strike(peer);
    }
    const res = liveClientMessageSchema.safeParse(parsed);
    if (!res.success) return strike(peer);
    const msg = res.data;

    if (msg.t === 'hello') {
      if (peer.bud || peer.greeting) return strike(peer);
      if (!walkGrid(msg.map)) return drop(peer, LIVE_CLOSE.unknownMap, 'Nie ma takiej mapy.');
      peer.greeting = true;
      let bud: BudRecord | null;
      try {
        bud = await store.getByTokenHash(hashToken(msg.token));
      } finally {
        peer.greeting = false;
      }
      if (!bud) return drop(peer, LIVE_CLOSE.unauthorized, 'Nieznany token gracza.');
      if (peer.ws.readyState !== WebSocket.OPEN) return;
      // the same bud on another device (or a reconnect before the old socket noticed): the newest one wins.
      // The old one leaves its room now, so its close (later) can't tell the room that the new one left
      const old = bySlug.get(bud.slug);
      if (old && old !== peer) {
        leaveRoom(old);
        drop(old, LIVE_CLOSE.replaced, 'Ten Bud gra teraz na innym urządzeniu.');
      }
      bySlug.set(bud.slug, peer);
      peer.bud = bud;
      const at = place(msg.map, msg.x, msg.y) ?? { x: round(msg.x), y: round(msg.y) };
      peer.player = playerOf(bud, at, msg.f, msg.r);
      peer.movedAt = now();
      enterRoom(peer, msg.map);
      return;
    }
    if (!peer.bud || !peer.player || !peer.room) return strike(peer);
    const p = peer.player;
    const room = peer.room;

    switch (msg.t) {
      case 'move': {
        const t = now();
        const seconds = Math.max(0.05, (t - peer.movedAt) / 1000);
        const far = Math.hypot(msg.x - p.x, msg.y - p.y);
        // too far for the time it had, or a spot nobody can stand on: the room keeps seeing the last good one
        if (far > LIVE_MAX_SPEED * seconds + 0.75) return;
        if (!positionWalkable(room.map, msg.x, msg.y)) return;
        // in a fight the simulation has the last word: knocked out, held, or a report from before a dash
        const unit = room.brawl.units.get(p.id);
        if (unit && !room.brawl.moveBud(p.id, round(msg.x), round(msg.y), msg.f, msg.m, msg.q)) {
          p.s = msg.s;
          return;
        }
        p.x = round(msg.x);
        p.y = round(msg.y);
        p.f = msg.f;
        p.m = msg.m;
        p.r = msg.r;
        p.s = msg.s;
        peer.movedAt = t;
        peer.dirty = true;
        return;
      }
      case 'join': {
        if (!walkGrid(msg.map)) return strike(peer);
        const at = place(msg.map, msg.x, msg.y);
        if (!at) return strike(peer);
        p.x = at.x;
        p.y = at.y;
        p.m = false;
        peer.movedAt = now();
        // a jump on the same map (stepping out of a wall, a harbour): just a new spot, no leaving and coming back
        if (msg.map === room.map) {
          const u = room.brawl.units.get(p.id);
          if (u && !u.downUntil) {
            u.x = at.x;
            u.y = at.y;
          }
          peer.dirty = true;
        } else enterRoom(peer, msg.map);
        return;
      }
      case 'act': {
        room.brawl.act(p.id, msg.a, msg.x, msg.y, msg.tid);
        return;
      }
      case 'summon': {
        if (!fights || peer.summoning) return;
        if ([...room.shadows.values()].some((s) => s.owner === p.id && !s.done)) return;
        peer.summoning = true;
        try {
          const found = await fights.shadowFight(p.id, msg.fight);
          if (!found || peer.room !== room) return;
          const id = `s-${msg.fight.slice(0, 8)}`;
          if (room.brawl.units.has(id)) return;
          const u = room.brawl.addShadow(id, p.id, msg.fight, found.state.enemy);
          if (!u) return;
          room.shadows.set(id, {
            owner: p.id,
            fightId: msg.fight,
            look: found.look,
            kind: found.kind,
            done: false,
            marked: false,
          });
          toRoom(room, { t: 'ents', es: [entityOf(room, u)] });
        } finally {
          peer.summoning = false;
        }
        return;
      }
      case 'emote': {
        const t = now();
        if (t - peer.emoteAt < EMOTE_COOLDOWN_SECONDS * 1000) return;
        peer.emoteAt = t;
        toRoom(room, { t: 'emote', id: p.id, e: msg.e }, peer);
        return;
      }
      case 'chat': {
        const text = cleanChat(msg.text);
        if (!text) return;
        const t = now() / 1000;
        if (!chatAllowed(peer.chatAt, t, text, peer.lastChat)) {
          send(peer, { t: 'slow' });
          return;
        }
        peer.chatAt = [...peer.chatAt.filter((at) => t - at < CHAT_WINDOW_SECONDS), t];
        peer.lastChat = { text, at: t };
        // everyone in the room, the sender too: it sees its words as the others do (cleaned)
        toRoom(room, { t: 'chat', id: p.id, name: p.name, text });
        return;
      }
      case 'me': {
        const t = now();
        if (t - peer.meAt < ME_COOLDOWN_MS) return;
        peer.meAt = t;
        const bud = await store.getBySlug(peer.bud.slug);
        if (!bud || !peer.room) return;
        peer.bud = bud;
        p.name = bud.name;
        p.level = levelFromXp(bud.xp).level;
        p.look = lookVersion(bud.look);
        toRoom(peer.room, { t: 'join', p }, peer);
        // gear, drinks or the level changed the fighter too
        void arm(peer);
        return;
      }
      case 'ping':
        send(peer, { t: 'pong' });
        return;
    }
  };

  // ---------- the fight ----------

  /** What only the bud sees of itself; sent when something in it changed. */
  const sendYou = (peer: Peer) => {
    const room = peer.room;
    const u = room?.brawl.units.get(peer.player?.id ?? '');
    if (!room || !u) return;
    const t = now();
    const left = (until: number) => Math.max(0, Math.round(until - t));
    const pvp = u.level >= PVP_MIN_LEVEL && !safeAt(room.map, u.x, u.y);
    const key = [
      u.hp,
      u.maxHp,
      u.shield,
      u.downUntil,
      u.guardUntil > t,
      u.stunUntil > t,
      pvp,
      u.kit.map((a) => `${a}:${(a && u.fighter.ranks?.[a]) || 0}`).join(','),
      u.ready.join(','),
    ].join('|');
    if (key === peer.lastYou) return;
    const kitChanged = !peer.lastYou || peer.lastYou.split('|')[7] !== key.split('|')[7];
    peer.lastYou = key;
    const you: LiveYou = {
      t: 'you',
      hp: u.hp,
      mhp: u.maxHp,
      sh: u.shield,
      ko: u.downUntil ? left(u.downUntil) : 0,
      guard: left(u.guardUntil),
      stun: left(u.stunUntil),
      kit: kitChanged
        ? u.kit.map((a) => {
            if (!a) return null;
            const rank = u.fighter.ranks?.[a] ?? 0;
            const e = kitEntry(a);
            return { ...e, rank, cd: Math.round(e.cd * rankCooldown(rank)) };
          })
        : null,
      cd: Array.from({ length: KIT_SLOTS }, (_, i) => left(u.ready[i] ?? 0)),
      open: pvp,
      team: peer.player?.team ?? '',
    };
    send(peer, you);
  };

  const unitState = (u: Unit): LiveUnitState => ({
    id: u.id,
    x: round(u.x),
    y: round(u.y),
    f: u.f,
    m: u.m,
    h: u.hp,
    mh: u.maxHp,
    d: u.downUntil > 0,
  });

  /** Coins and rating for a street knockout only once in a while for the same two buds. */
  const pairPays = (a: string, b: string) => {
    const key = [a, b].sort().join('|');
    const t = now();
    const last = paidPairs.get(key);
    if (last !== undefined && t - last < KO_PAIR_MS) return false;
    paidPairs.set(key, t);
    if (paidPairs.size > 5000)
      for (const [k, at] of paidPairs) if (t - at >= KO_PAIR_MS) paidPairs.delete(k);
    return true;
  };

  const rewardTo = (
    slug: string,
    kind: 'mob' | 'pvp' | 'raid' | 'street',
    enemy: string,
    name: string,
    win: FightWin,
  ) => {
    const peer = bySlug.get(slug);
    if (!peer) return;
    send(peer, { t: 'reward', kind, enemy, name, ...win });
    // a new level (more health, the ultimate…) or a new item: the fighter again
    if (win.reward?.levelUp && peer.player) peer.player.level = win.reward.level;
    if (win.reward?.levelUp || win.reward?.item) {
      void store.getBySlug(slug).then((bud) => {
        if (bud && peer.bud) {
          peer.bud = bud;
          void arm(peer);
          if (peer.room) toRoom(peer.room, { t: 'join', p: peer.player! }, peer);
        }
      });
    }
  };

  const lostTo = (
    slug: string,
    kind: 'mob' | 'pvp' | 'raid' | 'street',
    name: string,
    coins: number,
    left: number,
  ) => {
    const peer = bySlug.get(slug);
    if (peer) send(peer, { t: 'lost', kind, name, coins, left });
  };

  /** Writes down what a tick ended: won fights, knockouts, shadows that left. Never blocks the tick. */
  const settle = (room: Room, r: ReturnType<Brawl['step']>) => {
    if (!fights) return;
    for (const kill of r.kills) {
      const u = kill.unit;
      if (u.kind === 'shadow') {
        const shadow = room.shadows.get(u.id);
        if (!shadow || shadow.done) continue;
        shadow.done = true;
        room.shadows.delete(u.id);
        void fights
          .finishShadow(shadow.owner, shadow.fightId, 'won', true)
          .then((win) => win && rewardTo(shadow.owner, shadow.kind, u.enemyId ?? '', u.name, win))
          .catch(() => {});
        continue;
      }
      for (const slug of kill.by) {
        const me = room.brawl.units.get(slug)?.fighter;
        if (!me) continue;
        void fights
          .winMob(slug, u.enemyId!, u.spot ?? 0, me)
          .then((win) => win && rewardTo(slug, 'mob', u.enemyId!, u.name, win))
          .catch(() => {});
      }
    }
    for (const down of r.downs) {
      const v = down.unit;
      const by = down.by;
      if (!by) continue;
      if (by.kind === 'mob') {
        void fights
          .loseMob(v.id, by.enemyId!, v.fighter)
          .then((ko) => lostTo(v.id, 'mob', by.name, ko.lost, ko.coins))
          .catch(() => {});
      } else if (by.kind === 'shadow') {
        const shadow = room.shadows.get(by.id);
        if (!shadow || shadow.done) continue;
        shadow.done = true;
        room.shadows.delete(by.id);
        room.brawl.remove(by.id);
        toRoom(room, { t: 'fx', ev: [{ k: 'gone', v: by.id }] });
        void fights
          .finishShadow(v.id, shadow.fightId, 'lost', true)
          .then((win) => {
            if (win && (win.pvp || win.raid)) rewardTo(v.id, shadow.kind, '', by.name, win);
            lostTo(v.id, shadow.kind, by.name, 0, -1);
          })
          .catch(() => {});
      } else {
        const pay = pairPays(by.id, v.id);
        void fights
          .street(by.id, v.id, pay)
          .then((out) => {
            if (out.win) rewardTo(by.id, 'street', v.id, v.name, out.win);
            lostTo(v.id, 'street', by.name, out.lost, out.left);
          })
          .catch(() => {});
      }
    }
    settleGone(room, r);
  };

  const settleGone = (room: Room, r: Pick<ReturnType<Brawl['step']>, 'gone'>) => {
    for (const g of r.gone) {
      const shadow = room.shadows.get(g.unit.id);
      if (!shadow || shadow.done) continue;
      shadow.done = true;
      room.shadows.delete(g.unit.id);
      if (!fights) continue;
      void fights
        .finishShadow(shadow.owner, shadow.fightId, 'fled', g.exchanged)
        .then((win) => {
          if (win?.pvp || win?.raid) rewardTo(shadow.owner, shadow.kind, '', g.unit.name, win);
        })
        .catch(() => {});
    }
  };

  const fightTick = setInterval(() => {
    const t = now();
    for (const room of rooms.values()) {
      room.ticks++;
      const r = room.brawl.step(t);
      if (r.events.length) toRoom(room, { t: 'fx', ev: r.events });
      // forced moves of buds (dashes, knockbacks, getting up): the room sees them where the fight put them
      for (const e of r.events) {
        if (e.k !== 'dash' && e.k !== 'knock' && e.k !== 'rsp') continue;
        const id = e.k === 'dash' ? e.u : e.v;
        const peer = id ? bySlug.get(id) : undefined;
        const u = id ? room.brawl.units.get(id) : undefined;
        if (!peer?.player || peer.room !== room || !u) continue;
        peer.player.x = u.x;
        peer.player.y = u.y;
        peer.movedAt = t;
        peer.dirty = true;
      }
      settle(room, r);
      for (const [id, shadow] of room.shadows) {
        const u = room.brawl.units.get(id);
        const owner = room.brawl.units.get(shadow.owner);
        const blows = !!u && (u.dmgBy.size > 0 || u.hp < u.maxHp || !!owner?.dmgBy.has(id));
        if (shadow.marked || !blows || !fights) continue;
        shadow.marked = true;
        void fights.exchanged(shadow.owner, shadow.fightId).catch(() => {});
      }
      // positions and health ten times a second
      if (room.ticks % 2 === 0) {
        const changed = room.brawl.takeDirty();
        if (changed.length) {
          for (const u of changed) {
            if (u.kind !== 'bud') continue;
            const peer = bySlug.get(u.id);
            if (peer?.player) {
              peer.player.hp = u.hp;
              peer.player.mhp = u.maxHp;
            }
          }
          toRoom(room, { t: 'es', es: changed.map(unitState) });
        }
      }
      for (const peer of room.peers) sendYou(peer);
    }
  }, BRAWL_TICK_MS);

  // ---------- the room tick and the heartbeat ----------

  const tick = setInterval(() => {
    for (const room of rooms.values()) {
      const changed = [...room.peers].filter((p) => p.dirty).map((p) => p.player!);
      if (changed.length === 0) continue;
      for (const p of room.peers) p.dirty = false;
      for (const peer of room.peers) {
        const ps = changed
          .filter((c) => c.id !== peer.player!.id)
          .map(({ id, x, y, f, m, r, s }) => ({ id, x, y, f, m, r, s }));
        if (ps.length) send(peer, { t: 'state', ps });
      }
    }
  }, LIVE_TICK_MS);

  const heartbeat = setInterval(() => {
    for (const peer of peers) {
      if (!peer.alive) {
        peer.ws.terminate();
        continue;
      }
      peer.alive = false;
      peer.ws.ping();
    }
  }, LIVE_PING_SECONDS * 1000);

  return {
    stats() {
      const counts: Record<string, number> = {};
      for (const [key, room] of rooms) counts[key] = room.peers.size;
      return { peers: peers.size, rooms: counts };
    },
    brawlOf(roomKey) {
      return rooms.get(roomKey)?.brawl;
    },
    async close() {
      clearInterval(tick);
      clearInterval(fightTick);
      clearInterval(heartbeat);
      server.off('upgrade', onUpgrade);
      for (const peer of peers) drop(peer, LIVE_CLOSE.shutdown, 'Serwer się restartuje.');
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    },
  };
}
