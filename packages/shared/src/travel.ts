import { z } from 'zod';
import { canEnterDistrict, districtById, missingGateQuest } from './districts';

/**
 * Travel between the cities. On foot: every road out of Miasto Ziomków runs through a wasteland (pustkowie) to the
 * next city, its land in between the two (forest edge, dunes, country road, scrapland). Off the road, in nooks and
 * bushes, people lie in wait and pick a fight on their own (`ambush` opponents in content/routes.ts), weak or strong
 * by the route. By water: a ferryman in every city's harbour takes the bud to another harbour for a small fare,
 * paid on the server (`POST /v1/buds/me/ferry`, atomic `pay_fare`). Mirrored in Unity `Districts.cs`.
 */
export type Route = {
  id: string;
  name: string;
  /** Map orientation: `h` runs west–east, `v` north–south. */
  axis: 'h' | 'v';
  /** The city at the west (h) or north (v) end, and at the east or south end. */
  a: string;
  b: string;
  /** Levels of the people lying in wait along it. */
  levels: readonly [number, number];
  blurb: string;
};

export const ROUTES = [
  {
    id: 'pustkowie-ostepy',
    name: 'Leśne Ostępy',
    axis: 'h',
    a: 'dzika-puszcza',
    b: 'miasto-ziomkow',
    levels: [2, 5],
    blurb: 'Łąki i zagajniki między miastem a puszczą. W krzakach czają się rabusie.',
  },
  {
    id: 'pustkowie-wydmy',
    name: 'Wydmy',
    axis: 'v',
    a: 'las-palmas',
    b: 'miasto-ziomkow',
    levels: [3, 7],
    blurb: 'Suche trawy i piasek aż po morze. Za wydmami ktoś zawsze czeka.',
  },
  {
    id: 'pustkowie-gosciniec',
    name: 'Stary Gościniec',
    axis: 'v',
    a: 'miasto-ziomkow',
    b: 'dwor-carski',
    levels: [4, 8],
    blurb: 'Polna droga przez sady i żywopłoty do dworu. Rozbójnicy znają każdy krzak.',
  },
  {
    id: 'pustkowie-nieuzytki',
    name: 'Nieużytki',
    axis: 'h',
    a: 'miasto-ziomkow',
    b: 'los-karkos',
    levels: [6, 12],
    blurb: 'Gruz, złom i martwe drzewa. Najgroźniejsza droga w okolicy.',
  },
  {
    id: 'pustkowie-ryzowe',
    name: 'Ryżowy Trakt',
    axis: 'v',
    a: 'dwor-carski',
    b: 'chinatown',
    levels: [8, 12],
    blurb: 'Tarasy pól ryżowych i bambus za Dworem Carskim. W zaroślach czekają przemytnicy.',
  },
] as const satisfies readonly Route[];

export type RouteId = (typeof ROUTES)[number]['id'];

export const routeById = (id: string): Route | undefined => ROUTES.find((r) => r.id === id);

/** The route between two cities, if there is one. */
export const routeBetween = (x: string, y: string): Route | undefined =>
  ROUTES.find((r) => (r.a === x && r.b === y) || (r.a === y && r.b === x));

/** Map size of a route: long along its axis. */
export const ROUTE_LENGTH = 150;
export const ROUTE_WIDTH = 96;
/** The road through it is four cells wide, like the cities' roads out, and meets them at these rows/columns. */
export const ROUTE_ROAD = [46, 49] as const;

/**
 * Walking onto a route from a city needs the level of the city at its far end (the road leads there); walking back
 * home is always allowed.
 */
export function canEnterRoute(routeId: string, from: string, level: number): boolean {
  const r = routeById(routeId);
  if (!r) return false;
  const far = r.a === from ? r.b : r.b === from ? r.a : null;
  return far === null ? false : canEnterDistrict(far, level);
}

// ---------- ferries ----------

export type Port = {
  id: string;
  district: string;
  name: string;
  /** The ferryman's cell (map coordinates). */
  x: number;
  y: number;
};

/** One harbour per city, a free shore cell in its harbour zone (found on the maps, checked by export-quests). */
export const PORTS = [
  { id: 'port-miasto', district: 'miasto-ziomkow', name: 'Port Rzeczny', x: 65, y: 119 },
  { id: 'port-puszcza', district: 'dzika-puszcza', name: 'Przystań nad Jeziorem', x: 60, y: 39 },
  { id: 'port-palmas', district: 'las-palmas', name: 'Przystań Jachtowa', x: 103, y: 118 },
  { id: 'port-dwor', district: 'dwor-carski', name: 'Przystań Dworska', x: 48, y: 105 },
  { id: 'port-karkos', district: 'los-karkos', name: 'Port Przemytników', x: 50, y: 115 },
  { id: 'port-chinatown', district: 'chinatown', name: 'Port Lampionów', x: 58, y: 116 },
] as const satisfies readonly Port[];

export type PortId = (typeof PORTS)[number]['id'];

export const portById = (id: string): Port | undefined => PORTS.find((p) => p.id === id);

/** The fare to a harbour: a small sum, a bit more for the cities further on. */
export const ferryFare = (to: Port): number =>
  10 + 3 * (districtById(to.district)?.unlockLevel ?? 1);

/** Why a bud can't sail from one harbour to another, or null when it can (the coins are checked atomically). */
export function ferryBlocker(
  fromId: string,
  toId: string,
  level: number,
  completed: ReadonlySet<string> = new Set(),
): 'unknown_port' | 'same_port' | 'level_too_low' | 'quest_needed' | null {
  const from = portById(fromId);
  const to = portById(toId);
  if (!from || !to) return 'unknown_port';
  if (from.id === to.id || from.district === to.district) return 'same_port';
  if (!canEnterDistrict(to.district, level)) return 'level_too_low';
  if (missingGateQuest(to.district, completed)) return 'quest_needed';
  return null;
}

export const ferryRequestSchema = z.object({
  from: z.string().min(2).max(40),
  to: z.string().min(2).max(40),
});
export type FerryRequest = z.infer<typeof ferryRequestSchema>;

export const ferryResponseSchema = z.object({
  /** Coins left after the fare. */
  coins: z.number().int().nonnegative(),
  fare: z.number().int().nonnegative(),
  to: z.string(),
  district: z.string(),
});
export type FerryResponse = z.infer<typeof ferryResponseSchema>;
