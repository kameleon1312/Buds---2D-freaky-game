import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import {
  EMOTE_COOLDOWN_SECONDS,
  CHAT_WINDOW_SECONDS,
  chatAllowed,
  cleanChat,
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
  walkGrid,
  type BudRecord,
  type LivePlayer,
  type LiveServerMessage,
} from '@buds/shared';
import { hashToken } from './middleware/player.js';
import type { BudStore } from './store/types.js';

/**
 * The live server (packages/shared live.ts): one WebSocket per device on LIVE_PATH, signed in with the player token,
 * one room per map (more copies when one fills up). Every position is checked against the map's walk grid and the
 * speed limit before the room sees it; a bad position is simply not passed on (the bud's own screen is never
 * corrected, so walking always feels right). Nothing here grants anything: rewards stay with the REST API.
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
};

type Room = { key: string; map: string; peers: Set<Peer> };

export type LiveOptions = {
  /** The caller's address (the same rule as the REST rate limits: a trusted proxy header or the socket). */
  addressOf: (req: IncomingMessage) => string;
  now?: () => number;
};

export type LiveServer = {
  /** How many buds are connected, and per room (for tests and logs). */
  stats(): { peers: number; rooms: Record<string, number> };
  close(): Promise<void>;
};

/** A client that stopped reading (a frozen phone) is let go before its backlog eats the server's memory. */
const MAX_BACKLOG = 512 * 1024;

const send = (peer: Peer, msg: LiveServerMessage) => {
  if (peer.ws.readyState !== WebSocket.OPEN) return;
  if (peer.ws.bufferedAmount > MAX_BACKLOG) {
    peer.ws.terminate();
    return;
  }
  peer.ws.send(JSON.stringify(msg));
};

/** How often a bud may ask the room to re-read its name, level and look. */
const ME_COOLDOWN_MS = 2000;

const round = (v: number) => Math.round(v * 100) / 100;

export function attachLive(server: Server, store: BudStore, opts: LiveOptions): LiveServer {
  const now = opts.now ?? (() => Date.now());
  const wss = new WebSocketServer({ noServer: true, maxPayload: LIVE_MAX_MESSAGE });
  const peers = new Set<Peer>();
  const bySlug = new Map<string, Peer>();
  const rooms = new Map<string, Room>();
  const perAddress = new Map<string, number>();

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

  /** The first copy of the map's room with space, or a new copy. */
  const roomFor = (map: string): Room => {
    for (let n = 1; ; n++) {
      const key = n === 1 ? map : `${map}#${n}`;
      const room = rooms.get(key);
      if (!room) {
        const fresh = { key, map, peers: new Set<Peer>() };
        rooms.set(key, fresh);
        return fresh;
      }
      if (room.peers.size < LIVE_ROOM_CAP) return room;
    }
  };

  const leaveRoom = (peer: Peer) => {
    const room = peer.room;
    if (!room) return;
    room.peers.delete(peer);
    peer.room = undefined;
    for (const other of room.peers) send(other, { t: 'leave', id: peer.player!.id });
    if (room.peers.size === 0) rooms.delete(room.key);
  };

  const enterRoom = (peer: Peer, map: string) => {
    leaveRoom(peer);
    const room = roomFor(map);
    room.peers.add(peer);
    peer.room = room;
    peer.player!.s = 0;
    send(peer, {
      t: 'welcome',
      you: peer.player!.id,
      room: room.key,
      players: [...room.peers].filter((p) => p !== peer).map((p) => p.player!),
    });
    for (const other of room.peers) if (other !== peer) send(other, { t: 'join', p: peer.player! });
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

    switch (msg.t) {
      case 'move': {
        const t = now();
        const seconds = Math.max(0.05, (t - peer.movedAt) / 1000);
        const far = Math.hypot(msg.x - p.x, msg.y - p.y);
        // too far for the time it had, or a spot nobody can stand on: the room keeps seeing the last good one
        if (far > LIVE_MAX_SPEED * seconds + 0.75) return;
        if (!positionWalkable(peer.room.map, msg.x, msg.y)) return;
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
        if (msg.map === peer.room.map) peer.dirty = true;
        else enterRoom(peer, msg.map);
        return;
      }
      case 'emote': {
        const t = now();
        if (t - peer.emoteAt < EMOTE_COOLDOWN_SECONDS * 1000) return;
        peer.emoteAt = t;
        for (const other of peer.room.peers)
          if (other !== peer) send(other, { t: 'emote', id: p.id, e: msg.e });
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
        for (const other of peer.room.peers)
          send(other, { t: 'chat', id: p.id, name: p.name, text });
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
        for (const other of peer.room.peers) if (other !== peer) send(other, { t: 'join', p });
        return;
      }
      case 'ping':
        send(peer, { t: 'pong' });
        return;
    }
  };

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
    async close() {
      clearInterval(tick);
      clearInterval(heartbeat);
      server.off('upgrade', onUpgrade);
      for (const peer of peers) drop(peer, LIVE_CLOSE.shutdown, 'Serwer się restartuje.');
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    },
  };
}
