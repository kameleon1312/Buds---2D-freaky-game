// Los Karkos — the dangerous district (docs/districts.md): abandoned blocks covered in graffiti, the bazaar,
// the ring and gym with the weapon shop, the fenced junkyard, the sludge canal and the old factory.
import { losKarkosOutskirts } from './outskirts';
import { MapCanvas, noise2, rng, type Rect } from './lib';

export function losKarkos(): MapCanvas {
  // grown from 128×96: the old part keeps its coordinates, the outskirts fill the new east and south
  const W = 176;
  const H = 132;
  const m = new MapCanvas('los-karkos', 'Los Karkos', W, H, 'weeds');
  m.base = '#a9a172';
  const r = rng(4001);
  const nz = noise2(41, 5);
  m.each((x, y, c) => {
    const v = nz(x, y);
    if (v > 0.66) c.g = 'dirt';
    else if (v < 0.22) c.g = 'rubble';
  });

  // border: chain-link fence with dead trees and rubble behind it
  const edge = noise2(42, 5);
  m.each((x, y) => {
    const d = Math.min(x, y, W - 1 - x, H - 1 - y);
    if (d < 2 + edge(x, y) * 3)
      m.set(x, y, {
        g: 'rubble',
        p: r() < 0.25 ? 'drzewo-suche|opony|smieci' : undefined,
        s: true,
      });
  });
  const fenceLine = (x0: number, y0: number, x1: number, y1: number, gaps: number[] = []) => {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const k = y0 === y1 ? x : y;
        if (gaps.includes(k)) continue;
        m.set(x, y, { g: m.get(x, y)?.g ?? 'dirt', p: 'siatka-post', s: true });
      }
  };

  // ---------- main road from the west entrance, cracked asphalt ----------
  m.road('h', 0, 100, 46, 4, { sidewalk: false });
  m.road('v', 8, 86, 60, 3, { sidewalk: false, dashes: false });

  // ---------- Opuszczone Bloki (centre) ----------
  const blocks: Rect = [22, 18, 96, 70];
  m.rect(blocks, (x, y) => (m.get(x, y)?.g === 'asphalt' ? null : { g: 'concrete' }));
  for (const [x, y] of [
    [29, 27],
    [41, 27],
    [77, 27],
    [89, 27],
    [29, 42],
    [41, 42],
    [77, 42],
    [89, 42],
    [29, 62],
    [41, 62],
    [77, 62],
    [89, 62],
  ] as const)
    m.place(r() < 0.5 ? 'ruina-a' : 'ruina-b', x, y, { force: true });
  for (const [x, y] of [
    [52, 30],
    [70, 30],
    [52, 58],
    [70, 58],
    [35, 52],
    [83, 52],
  ] as const)
    m.place(['graffiti-d', 'graffiti-e', 'graffiti-a'][(x + y) % 3]!, x, y, { force: true });
  m.sprinkle(
    blocks,
    ['beczka-ogien', 'smieci', 'opony', 'wrak-a', 'wrak-b', 'drzewo-suche'],
    0.05,
    ['concrete'],
    21,
    { spacing: 2 },
  );
  m.sprinkle(
    [3, 3, 124, 92],
    ['smieci', 'opony', 'drzewo-suche', 'wrak-a'],
    0.012,
    ['weeds', 'dirt', 'rubble'],
    22,
    { spacing: 3 },
  );
  m.place('sklep-bron', 66, 44, { force: true });
  m.place('beczka-ogien', 62, 52, { force: true });
  m.sign(
    57,
    44,
    'Los Karkos',
    'Tu nikt nie pyta, skąd jesteś. Uważaj na typów spod bloków — zaczepiają bez ostrzeżenia.',
  );
  m.sign(
    70,
    44,
    'Sklep z bronią',
    'Kije, procarki i ochraniacze. Bez dobrego sprzętu nie wchodź do fabryki.',
  );
  m.spawn = [12, 48];

  // ---------- Bazar (south of the blocks) ----------
  const bazaar: Rect = [24, 74, 58, 85];
  m.rect(bazaar, { g: 'dirt' });
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 6; i++)
      m.place(i % 2 ? 'bazar-a' : 'bazar-b', 27 + i * 5, 76 + row * 4, { force: true });
  m.sign(23, 80, 'Bazar', 'Tu kupisz wszystko. Pytanie tylko, czy to nie jest kradzione.');

  // ---------- Ring i Siłownia (east of the blocks) ----------
  const gym: Rect = [100, 48, 122, 70];
  m.rect(gym, (x, y) => (m.get(x, y)?.s ? null : { g: 'concrete' }));
  m.place('ring', 108, 62, { force: true });
  m.place('silownia', 117, 56, { force: true });
  m.place('beczka-ogien', 103, 52, { force: true });
  m.place('beczka-ogien', 103, 66, { force: true });
  m.sign(104, 57, 'Ring', 'Trenuj tu walkę i instynkt przetrwania. Zwycięzcy zgarniają szacun.');
  for (let x = 96; x <= 104; x++) for (const y of [48, 49]) m.set(x, y, { g: 'asphalt' });

  // ---------- Złomowisko (north-east, fenced) ----------
  const yard: Rect = [92, 4, 124, 30];
  m.rect(yard, (x, y) => (m.get(x, y)?.s ? null : { g: 'dirt' }));
  fenceLine(92, 4, 92, 30, [16, 17]);
  fenceLine(92, 30, 124, 30, [108, 109]);
  m.sprinkle(
    [94, 6, 122, 28],
    ['zlom', 'zlom', 'wrak-a', 'wrak-b', 'opony'],
    0.05,
    ['dirt', 'rubble', 'weeds'],
    31,
    { spacing: 2 },
  );
  for (let y = 31; y <= 46; y++)
    for (const x of [108, 109]) if (!m.get(x, y)?.s) m.set(x, y, { g: 'dirt' });
  m.sign(110, 33, 'Złomowisko', 'Części do craftu leżą wszędzie. Pies stróża śpi... chyba.');

  // ---------- Kanał (south) with two bridges ----------
  for (let x = 3; x <= 96; x++)
    for (const y of [88, 89, 90]) {
      const bridge = (x >= 59 && x <= 63) || (x >= 20 && x <= 22);
      m.set(x, y, bridge ? { g: 'concrete' } : { g: 'sludge', s: true });
    }
  m.sprinkle(
    [3, 84, 96, 93],
    ['smieci', 'drzewo-suche', 'opony'],
    0.03,
    ['weeds', 'dirt', 'rubble'],
    41,
    { spacing: 2 },
  );
  m.sign(57, 86, 'Kanał', 'Nie pij tej wody. Nawet nie patrz na nią za długo.');

  // ---------- Stara Fabryka (south-east, fenced) ----------
  const fab: Rect = [98, 72, 124, 92];
  m.rect(fab, (x, y) => (m.get(x, y)?.s ? null : { g: 'concrete' }));
  m.place('fabryka', 111, 86, { force: true });
  fenceLine(98, 72, 124, 72, [110, 111, 112]);
  fenceLine(98, 72, 98, 92);
  m.sprinkle([100, 74, 122, 91], ['beczka-ogien', 'smieci', 'opony'], 0.03, ['concrete'], 51, {
    spacing: 2,
  });
  for (let y = 50; y <= 73; y++)
    for (const x of [110, 111]) if (!m.get(x, y)?.s) m.set(x, y, { g: 'concrete' });
  m.sign(
    113,
    74,
    'Stara Fabryka',
    'Kryjówka gangu. Wejdź tylko, gdy będziesz gotów na prawdziwą walkę.',
  );

  // west entrance: road through the border, sign
  m.sign(4, 44, 'Do Miasta Ziomków', 'Droga powrotna do miasta.');
  m.exit([0, 46, 0, 49], 'miasto-ziomkow');

  m.zone(blocks, 'Opuszczone Bloki');
  m.zone(bazaar, 'Bazar');
  m.zone(gym, 'Ring i Siłownia');
  m.zone(yard, 'Złomowisko');
  m.zone([3, 86, 96, 92], 'Kanał');
  m.zone(fab, 'Stara Fabryka');
  m.zone([0, 40, 21, 56], 'Rogatki');

  m.ground.push(
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
      name: 'concrete',
      kinds: 'concrete',
      radius: 1,
      bands: [
        [0.45, '#7d7870'],
        [0.5, '#9e988f'],
      ],
    },
    {
      name: 'asphalt',
      kinds: 'asphalt',
      radius: 0.8,
      bands: [
        [0.45, '#36353a'],
        [0.5, '#48474d'],
      ],
    },
    {
      name: 'sludge',
      kinds: 'sludge',
      radius: 1.6,
      bands: [
        [0.44, '#3f4a30'],
        [0.5, '#6b7d4f'],
        [0.75, '#5a6b42'],
      ],
    },
  );
  m.scatter.push(
    { ground: 'concrete', chance: 0.06, props: 'gruz|kaluza|pekniecie|gruz' },
    { ground: 'asphalt', chance: 0.06, props: 'pekniecie|kaluza' },
    { ground: 'dirt', chance: 0.04, props: 'gruz|tuft' },
    { ground: 'weeds', chance: 0.06, props: 'tuft' },
    { ground: 'rubble', chance: 0.06, props: 'gruz' },
  );
  losKarkosOutskirts(m);

  // ---------- doors (rooms: tools/world/maps/interiors.ts) ----------
  m.door([117, 56], 'los-karkos-silownia', 'Siłownia „Żelazo”');
  m.door([29, 42], 'los-karkos-ruina', 'Opuszczone mieszkanie');
  return m;
}
