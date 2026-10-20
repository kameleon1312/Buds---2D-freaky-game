import { z } from 'zod';
import { WALK_GRIDS } from './walk-grids';

/**
 * Live play: buds on the same map see each other move, ride and call out, in real time. One WebSocket per device
 * (`LIVE_PATH` on the API), signed in with the player token; a map is a room (more than `LIVE_ROOM_CAP` buds and a
 * second copy of the room opens). The server checks every position against the map's walk grid
 * (`walk-grids.ts`, generated from the map files) and the speed limit before anyone else sees it, and never moves a
 * bud on its own screen (so walking always feels right); rewards stay with the REST API as before.
 * Positions are Unity world units: x right, y up, the feet of the bud; the cell is (floor x, h − 1 − floor(y + 0.15)).
 */
export const LIVE_PATH = '/v1/live';
/** How often the game sends its bud and the server sends the room (ms). */
export const LIVE_TICK_MS = 100;
/** Buds in one room before a second copy of the map opens. */
export const LIVE_ROOM_CAP = 40;
/** The fastest a bud can go (tiles/s): running with every speed boost on the fastest ride, with room to spare. */
export const LIVE_MAX_SPEED = 16;
/** Messages a device may send per second (bursts up to twice that). */
export const LIVE_RATE = 20;
/** The longest message the server reads (bytes). */
export const LIVE_MAX_MESSAGE = 1024;
/** Seconds to say hello after connecting, and between pings before a silent connection is dropped. */
export const LIVE_HELLO_SECONDS = 8;
export const LIVE_PING_SECONDS = 15;
/** Connections from one address at once: a school or a mobile carrier puts many players behind one address. */
export const LIVE_PER_ADDRESS = 32;
/** Seconds between two call-outs of the same bud. */
export const EMOTE_COOLDOWN_SECONDS = 1.5;

/** Quick call-outs shown in a speech bubble over the bud (words, never emoji). */
export const EMOTES = [
  { id: 'siema', text: 'Siema!' },
  { id: 'gg', text: 'GG!' },
  { id: 'haha', text: 'Haha!' },
  { id: 'dzieki', text: 'Dzięki!' },
  { id: 'walka', text: 'Walczymy?' },
  { id: 'chodz', text: 'Chodź tu!' },
  { id: 'ekipa', text: 'Do ekipy?' },
  { id: 'nara', text: 'Nara!' },
] as const;
export type EmoteId = (typeof EMOTES)[number]['id'];
export const emoteIds = EMOTES.map((e) => e.id) as [EmoteId, ...EmoteId[]];

/** Facing on the wire: 0 down, 1 side (left), 2 up, 3 side facing right. */
export const facingSchema = z.number().int().min(0).max(3);
/** What the bud is busy with: 0 nothing, 1 a duel, 2 a menu, 3 typing in the chat. */
export const liveStatusSchema = z.number().int().min(0).max(3);

const mapId = z.string().regex(/^[a-z0-9-]{2,60}$/);
const coord = z.number().finite().min(-50).max(500);
const ride = z.string().regex(/^[a-z0-9-]{0,40}$/);

export const liveClientMessageSchema = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('hello'),
    token: z.string().min(10).max(100),
    map: mapId,
    x: coord,
    y: coord,
    f: facingSchema,
    r: ride.default(''),
  }),
  z.object({
    t: z.literal('move'),
    x: coord,
    y: coord,
    f: facingSchema,
    m: z.boolean(),
    r: ride.default(''),
    s: liveStatusSchema.default(0),
  }),
  z.object({ t: z.literal('join'), map: mapId, x: coord, y: coord }),
  z.object({ t: z.literal('emote'), e: z.enum(emoteIds) }),
  /** The player's own words (chat.ts cleans them; longer input is cut, not refused). */
  z.object({ t: z.literal('chat'), text: z.string().min(1).max(400) }),
  /** Name, level or look changed: the server reads the bud again and tells the room. */
  z.object({ t: z.literal('me') }),
  z.object({ t: z.literal('ping') }),
]);
export type LiveClientMessage = z.infer<typeof liveClientMessageSchema>;

/** A bud as the room sees it. `look` changes when the look does (a new sheet to download). */
export type LivePlayer = {
  id: string;
  name: string;
  level: number;
  look: string;
  x: number;
  y: number;
  f: number;
  m: boolean;
  r: string;
  s: number;
};

export type LiveServerMessage =
  | { t: 'welcome'; you: string; room: string; players: LivePlayer[] }
  | { t: 'join'; p: LivePlayer }
  | { t: 'leave'; id: string }
  | { t: 'state'; ps: Pick<LivePlayer, 'id' | 'x' | 'y' | 'f' | 'm' | 'r' | 's'>[] }
  | { t: 'emote'; id: string; e: EmoteId }
  /** A chat line as everyone sees it (cleaned), the sender included, so it sees what the others see. */
  | { t: 'chat'; id: string; name: string; text: string }
  /** Too many messages too fast (or the same again): this one was not sent. */
  | { t: 'slow' }
  | { t: 'pong' }
  | { t: 'bye'; reason: string };

/** Close codes the game understands: auth problems are not retried, the rest are. */
export const LIVE_CLOSE = {
  noHello: 4001,
  badMessages: 4002,
  unauthorized: 4003,
  replaced: 4004,
  unknownMap: 4005,
  tooMany: 4006,
  shutdown: 4007,
  flooding: 4008,
} as const;

/** The feet cell of a world position on a map of height `h` (the same rounding as the game's BudController). */
export const liveCell = (x: number, y: number, h: number): [number, number] => [
  Math.floor(x),
  h - 1 - Math.floor(y + 0.15),
];

/** A short fingerprint of a look: changes whenever the look does, so the game knows to fetch a new sheet. */
export function lookVersion(look: unknown): string {
  const text = JSON.stringify(look ?? {});
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

// ---------- the walk grids (generated from the maps) ----------

const decoded = new Map<string, { w: number; h: number; cells: Uint8Array }>();

/** A map's walk grid, decoded once; undefined for a map that doesn't exist. */
export function walkGrid(map: string): { w: number; h: number; cells: Uint8Array } | undefined {
  const cached = decoded.get(map);
  if (cached) return cached;
  const g = WALK_GRIDS[map];
  if (!g) return undefined;
  const bin = atob(g.bits);
  const cells = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) cells[i] = bin.charCodeAt(i);
  const grid = { w: g.w, h: g.h, cells };
  decoded.set(map, grid);
  return grid;
}

/** Can a bud stand on this cell (map coordinates, y down)? Outside the map: no. */
export function cellWalkable(map: string, cx: number, cy: number): boolean {
  const g = walkGrid(map);
  if (!g || cx < 0 || cy < 0 || cx >= g.w || cy >= g.h) return false;
  const i = cy * g.w + cx;
  return ((g.cells[i >> 3]! >> (i & 7)) & 1) === 1;
}

/**
 * Is a world position somewhere a bud can be? Its feet cell, or one beside it (feet straddle cell edges against
 * walls, and the game's own rounding should never get a bud hidden from the room).
 */
export function positionWalkable(map: string, x: number, y: number): boolean {
  const g = walkGrid(map);
  if (!g) return false;
  const [cx, cy] = liveCell(x, y, g.h);
  if (cellWalkable(map, cx, cy)) return true;
  return (
    cellWalkable(map, cx + 1, cy) ||
    cellWalkable(map, cx - 1, cy) ||
    cellWalkable(map, cx, cy + 1) ||
    cellWalkable(map, cx, cy - 1)
  );
}

/** The nearest walkable spot to a position (world units, a cell centre), or null when there is none close. */
export function nearestWalkable(
  map: string,
  x: number,
  y: number,
): { x: number; y: number } | null {
  const g = walkGrid(map);
  if (!g) return null;
  const [cx, cy] = liveCell(x, y, g.h);
  for (let r = 0; r <= 12; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !cellWalkable(map, cx + dx, cy + dy))
          continue;
        return { x: cx + dx + 0.5, y: g.h - 1 - (cy + dy) + 0.2 };
      }
  return null;
}
