// The wastelands between the cities (packages/shared/src/travel.ts ROUTES): a long strip of land, four cells of road
// winding through it from one city's road out to the next city's, the land between them (a forest edge, dunes, a
// country road through orchards, a scrapland), thick margins along the long sides, and hiding places off the road
// where the people of content/routes.ts lie in wait. Each hiding place is a ring of bushes (or rocks, or junk) with
// one way in, carved around the spot the content names, so a bud that leaves the road finds trouble there.
import { ROUTES_CONTENT } from '../../../packages/shared/src/content/routes';
import {
  ROUTE_LENGTH as LEN,
  ROUTE_ROAD,
  ROUTE_WIDTH as WID,
  ROUTES,
  type Route,
} from '../../../packages/shared/src/travel';
import { districtById } from '../../../packages/shared/src/districts';
import { MapCanvas, noise2, rng } from './lib';

type Theme = {
  base: string;
  /** The ground most of the land is, a second one in patches, and the road. */
  land: string;
  patch: string;
  road: string;
  /** Props along the margins (solid walls of them), dotted over the land, and the hiding places' rings. */
  margin: string[];
  dotted: string[];
  ring: string[];
  /** How much of the land is dotted (0..1). */
  density: number;
  ground: MapCanvas['ground'];
  scatter: MapCanvas['scatter'];
  zones: [string, string, string];
};

const THEMES: Record<string, Theme> = {
  'pustkowie-ostepy': {
    base: '#86c95a',
    land: 'grass',
    patch: 'grass2',
    road: 'path',
    margin: ['tree-a', 'tree-b', 'sosna', 'swierk', 'bush-a'],
    dotted: ['tree-a', 'tree-b', 'bush-a', 'bush-b', 'krzak-jagody', 'rock-a', 'pien', 'sosna'],
    ring: ['bush-a', 'bush-b', 'krzak-jagody', 'bush-a'],
    density: 0.06,
    ground: [
      { name: 'grass2', kinds: 'grass2', radius: 2.2, bands: [[0.3, '#74b94f']] },
      {
        name: 'path',
        kinds: 'path',
        radius: 1.3,
        bands: [
          [0.36, '#d1b07a'],
          [0.48, '#e3c896'],
        ],
      },
    ],
    scatter: [
      { ground: 'grass', chance: 0.06, props: 'flowers-a|flowers-b|tuft|tuft|liscie-a' },
      { ground: 'grass2', chance: 0.2, props: 'tuft|grzyby|tuft' },
      { ground: 'path', chance: 0.05, props: 'pebbles|liscie-b' },
    ],
    zones: ['Skraj Puszczy', 'Leśne Ostępy', 'Pola za Parkiem'],
  },
  'pustkowie-wydmy': {
    base: '#d8c48a',
    land: 'sand',
    patch: 'grass2',
    road: 'path',
    margin: ['palm-b', 'rock-a', 'rock-b', 'drzewo-suche', 'palm-c'],
    dotted: ['palm-a', 'palm-b', 'rock-a', 'rock-b', 'drzewo-suche', 'bush-b'],
    ring: ['rock-a', 'rock-b', 'bush-b', 'rock-a'],
    density: 0.035,
    ground: [
      {
        name: 'sand',
        kinds: 'sand',
        radius: 2.2,
        bands: [
          [0.4, '#e6cf98'],
          [0.55, '#f3e2b4'],
        ],
      },
      {
        name: 'grass2',
        kinds: 'grass2',
        radius: 2,
        bands: [
          [0.32, '#b9bf6a'],
          [0.5, '#a9b25c'],
        ],
      },
      {
        name: 'path',
        kinds: 'path',
        radius: 1.3,
        bands: [
          [0.36, '#cfae76'],
          [0.48, '#dcc08e'],
        ],
      },
    ],
    scatter: [
      { ground: 'sand', chance: 0.05, props: 'muszle|tuft|pebbles' },
      { ground: 'grass2', chance: 0.25, props: 'tuft|tuft|hibiskus' },
      { ground: 'path', chance: 0.04, props: 'pebbles' },
    ],
    zones: ['Plaże Las Palmas', 'Wydmy', 'Suche Łąki'],
  },
  'pustkowie-gosciniec': {
    base: '#8cc85c',
    land: 'grass',
    patch: 'soil',
    road: 'gravel',
    margin: ['tree-c', 'tree-a', 'bush-a', 'tree-b'],
    dotted: ['tree-c', 'tree-c', 'bush-a', 'siano', 'rock-a', 'pien'],
    ring: ['bush-a', 'bush-a', 'bush-b', 'siano'],
    density: 0.045,
    ground: [
      {
        name: 'soil',
        kinds: 'soil',
        radius: 1.2,
        bands: [
          [0.45, '#7a5236'],
          [0.55, '#9c6b45'],
        ],
      },
      {
        name: 'gravel',
        kinds: 'gravel',
        radius: 1,
        bands: [
          [0.45, '#9f9483'],
          [0.5, '#b7ac9b'],
        ],
      },
    ],
    scatter: [
      { ground: 'grass', chance: 0.05, props: 'flowers-a|flowers-c|tuft|tuft' },
      { ground: 'soil', chance: 0.3, props: 'tuft|tuft|pebbles' },
      { ground: 'gravel', chance: 0.05, props: 'pebbles|liscie-a' },
    ],
    zones: ['Rogatki Miasta', 'Stary Gościniec', 'Sady Dworskie'],
  },
  'pustkowie-nieuzytki': {
    base: '#9c9779',
    land: 'dirt',
    patch: 'rubble',
    road: 'asphalt',
    margin: ['drzewo-suche', 'opony', 'smieci', 'rock-dark', 'siatka-post'],
    dotted: [
      'drzewo-suche',
      'opony',
      'smieci',
      'beczka-ogien',
      'rock-dark',
      'rock-dark-b',
      'zlom',
      'wrak-a',
      'wrak-b',
    ],
    ring: ['opony', 'smieci', 'rock-dark', 'opony'],
    density: 0.04,
    ground: [
      {
        name: 'dirt',
        kinds: 'dirt',
        radius: 1.8,
        bands: [
          [0.4, '#8f7a5a'],
          [0.52, '#a68d68'],
        ],
      },
      {
        name: 'rubble',
        kinds: 'rubble',
        radius: 1.8,
        bands: [
          [0.4, '#857e74'],
          [0.55, '#9a9286'],
        ],
      },
      {
        name: 'asphalt',
        kinds: 'asphalt',
        radius: 0.8,
        bands: [
          [0.45, '#3a3e48'],
          [0.5, '#4c5160'],
        ],
      },
    ],
    scatter: [
      { ground: 'dirt', chance: 0.05, props: 'gruz|tuft|pebbles|chwast' },
      { ground: 'rubble', chance: 0.1, props: 'gruz|gruz|pekniecie' },
      { ground: 'asphalt', chance: 0.06, props: 'pekniecie|kaluza|plama-oleju' },
    ],
    zones: ['Przedmieścia', 'Nieużytki', 'Rogatki Karkos'],
  },
};

export function route(r: Route): MapCanvas {
  const t = THEMES[r.id];
  if (!t) throw new Error(`no theme for route ${r.id}`);
  const horizontal = r.axis === 'h';
  const W = horizontal ? LEN : WID;
  const H = horizontal ? WID : LEN;
  const m = new MapCanvas(r.id, r.name, W, H, t.land);
  m.base = t.base;
  m.source = 'routes.ts';
  const rnd = rng(9000 + r.id.length * 31 + r.levels[1]);
  const patches = noise2(9100 + r.levels[0], 6);

  /** (along, across) → map cell: `along` runs from the a-end (west or north) to the b-end. */
  const cell = (along: number, across: number): [number, number] =>
    horizontal ? [along, across] : [across, along];
  const at = (along: number, across: number) => m.get(...cell(along, across));
  const put = (along: number, across: number, c: Parameters<MapCanvas['set']>[2]) =>
    m.set(...cell(along, across), c);

  // ---------- the land, patches, the margins ----------
  for (let a = 0; a < LEN; a++)
    for (let c = 0; c < WID; c++) {
      if (patches(...cell(a, c)) > 0.62) put(a, c, { g: t.patch });
      const edge = Math.min(c, WID - 1 - c);
      if (edge < 3 + patches(...cell(c * 3, a)) * 3) {
        const p = t.margin[Math.floor(rnd() * t.margin.length)]!;
        put(a, c, { g: t.land, p: rnd() < 0.7 ? p : undefined, s: true });
      }
    }

  // ---------- the road: four cells, winding, straight where it meets the cities ----------
  const mid = (ROUTE_ROAD[0] + ROUTE_ROAD[1]) / 2;
  const centre = (a: number) => {
    const ends = Math.min(1, Math.min(a, LEN - 1 - a) / 16);
    return mid + ends * (6 * Math.sin(a / 17) + 2.5 * Math.sin(a / 7 + 1));
  };
  const onRoad = new Set<string>();
  for (let a = 0; a < LEN; a++) {
    const c0 = Math.round(centre(a) - 1.5);
    for (let c = c0 - 1; c <= c0 + 4; c++) {
      const road = c >= c0 && c <= c0 + 3;
      put(a, c, {
        g: road ? t.road : at(a, c)?.g === t.road ? t.road : t.patch === 'rubble' ? 'dirt' : t.land,
      });
      if (road) onRoad.add(cell(a, c).join());
    }
  }

  // ---------- the hiding places, carved around the content's spots ----------
  const lurkers = ROUTES_CONTENT.enemies.filter((e) => e.district === r.id);
  const hidden = new Set<string>();
  for (const e of lurkers) {
    const { x, y } = e.spots[0]!;
    const [ea, ec] = horizontal ? [x, y] : [y, x];
    const towardsRoad = ec < centre(ea) ? 1 : -1;
    for (let da = -3; da <= 3; da++)
      for (let dc = -3; dc <= 3; dc++) {
        const d = Math.max(Math.abs(da), Math.abs(dc));
        const [cx, cy] = cell(ea + da, ec + dc);
        hidden.add(`${cx},${cy}`);
        if (d <= 1) put(ea + da, ec + dc, { g: t.patch === 'soil' ? 'grass' : t.patch });
        else if (d === 2) {
          // the way in faces the road; the rest of the ring closes the nook
          const door = dc === 2 * towardsRoad && Math.abs(da) <= 0;
          put(
            ea + da,
            ec + dc,
            door ? { g: t.land } : { g: t.land, p: t.ring[(da + dc + 8) % t.ring.length], s: true },
          );
        } else put(ea + da, ec + dc, { g: t.land });
      }
    // a clear way from the nook's mouth to the road
    for (
      let c = ec + 3 * towardsRoad;
      towardsRoad > 0 ? c < centre(ea) : c > centre(ea);
      c += towardsRoad
    ) {
      const k = cell(ea, c);
      if (!onRoad.has(k.join())) put(ea, c, { g: at(ea, c)?.g === t.road ? t.road : t.land });
    }
  }

  // ---------- dotted over the land: groves, rocks, junk (never on the road or in the nooks' clearings) ----------
  const free = (a: number, c: number) => {
    const k = cell(a, c).join();
    if (onRoad.has(k) || hidden.has(k)) return false;
    const v = at(a, c);
    return !!v && !v.p && !v.s;
  };
  for (let a = 2; a < LEN - 2; a++)
    for (let c = 4; c < WID - 4; c++) {
      // a ring of space along both road edges, so the road reads as a road
      if (Math.abs(c - centre(a)) < 4.5 || !free(a, c)) continue;
      if (rnd() >= t.density) continue;
      const name = t.dotted[Math.floor(rnd() * t.dotted.length)]!;
      m.place(name, ...cell(a, c), { grounds: [t.land, t.patch] });
    }

  // ---------- the ends: exits to the two cities, signs, zones ----------
  const exitAt = (along: number) => {
    const [x0, y0] = cell(along, ROUTE_ROAD[0]);
    const [x1, y1] = cell(along, ROUTE_ROAD[1]);
    return [x0, y0, x1, y1] as [number, number, number, number];
  };
  m.exit(exitAt(0), r.a);
  m.exit(exitAt(LEN - 1), r.b);
  const nameOf = (id: string) => districtById(id)?.name ?? id;
  const sign = (along: number, side: number, to: string) => {
    for (const c of [
      ROUTE_ROAD[side ? 1 : 0] + (side ? 2 : -2),
      ROUTE_ROAD[side ? 1 : 0] + (side ? 3 : -3),
    ]) {
      const [x, y] = cell(along, c);
      if (m.get(x, y) && !m.get(x, y)!.p) {
        m.sign(
          x,
          y,
          `Do: ${nameOf(to)}`,
          `${r.name}. ${r.blurb} Trzymaj się drogi, a nic ci nie grozi.`,
        );
        return;
      }
    }
  };
  sign(6, 0, r.a);
  sign(LEN - 7, 1, r.b);
  const third = Math.floor(LEN / 3);
  m.zone(
    [...cell(0, 0), ...cell(third - 1, WID - 1)] as [number, number, number, number],
    t.zones[0],
  );
  m.zone(
    [...cell(third, 0), ...cell(2 * third - 1, WID - 1)] as [number, number, number, number],
    t.zones[1],
  );
  m.zone(
    [...cell(2 * third, 0), ...cell(LEN - 1, WID - 1)] as [number, number, number, number],
    t.zones[2],
  );
  m.spawn = cell(Math.floor(LEN / 2), Math.round(centre(Math.floor(LEN / 2))));
  m.ground.push(...t.ground);
  m.scatter.push(...t.scatter);
  return m;
}

export const routes = () => ROUTES.map((r) => route(r));
