// Dzika Puszcza — the wild forest west of Miasto Ziomków (docs/districts.md): no streets, only trails. A river runs
// north to south with two bridges; along the trails lie the scouts' camp, the forester's hut, a deep lake, the
// mushroom meadow, the bog, the wolves' hill and the ruined watchtower where the bandits hide. The trail in comes
// from the city park through Leśna Brama on the east edge.
import { MapCanvas, noise2, rng, type Rect } from './lib';

export function dzikaPuszcza(): MapCanvas {
  const W = 176;
  const H = 132;
  const m = new MapCanvas('dzika-puszcza', 'Dzika Puszcza', W, H);
  m.base = '#7cbf55';
  const r = rng(6001);
  const nz = noise2(6002, 7);
  const grass2 = noise2(6003, 5);

  // ---------- the forest: dense stands of pines and spruces, lighter glades between ----------
  m.each((x, y) => {
    if (grass2(x, y) > 0.6) m.set(x, y, { g: 'grass2' });
    if (nz(x, y) > 0.52) {
      const tree = r() < 0.55;
      m.set(x, y, {
        g: 'forest',
        p: tree ? 'sosna|swierk|tree-a|sosna|swierk' : undefined,
        s: true,
      });
    }
  });
  // the edge of the map is a wall of trees (a gap is cut for the trail to the city)
  const edge = noise2(6004, 5);
  m.each((x, y) => {
    const d = Math.min(x, y, W - 1 - x, H - 1 - y);
    if (d < 3 + edge(x, y) * 4)
      m.set(x, y, { g: 'forest', p: r() < 0.5 ? 'sosna|swierk|tree-b' : undefined, s: true });
  });

  /** A clearing: open grass in an organic blob. */
  const clearing = (cx: number, cy: number, rx: number, ry: number, seed: number, g = 'grass') =>
    m.blob(cx, cy, rx, ry, seed, (x, y) => m.set(x, y, { g }));
  /** A trail: path ground through anything (trees make way). */
  const trail = (rect: Rect) => m.rect(rect, { g: 'path' });

  // ---------- glades for the places (before the trails, so the trails cross them) ----------
  clearing(164, 59, 10, 9, 6101); // Leśna Brama
  clearing(130, 62, 12, 10, 6102); // Obozowisko
  clearing(110, 27, 10, 7, 6103); // Chata Leśniczego
  clearing(60, 32, 19, 12, 6104); // around the lake
  clearing(56, 96, 14, 9, 6105, 'grass2'); // Polana Grzybiarzy
  clearing(24, 62, 17, 14, 6106, 'bog'); // Bagna
  clearing(30, 20, 13, 9, 6107, 'rock'); // Wzgórze Wilków
  clearing(140, 106, 13, 10, 6108, 'gravel'); // Ruiny Strażnicy

  // ---------- water: the river (north to south) and the lake ----------
  m.rect([88, 0, 91, H - 1], { g: 'water', s: true });
  m.rect([86, 0, 87, H - 1], (x, y) =>
    m.get(x, y)?.s && m.get(x, y)?.g !== 'forest' ? null : { g: 'sand' },
  );
  m.rect([92, 0, 93, H - 1], (x, y) =>
    m.get(x, y)?.s && m.get(x, y)?.g !== 'forest' ? null : { g: 'sand' },
  );
  m.blob(60, 31, 14, 8, 6201, (x, y) => m.set(x, y, { g: 'water', s: true }));
  m.blob(60, 31, 16.5, 10, 6201, (x, y) => {
    if (m.get(x, y)?.g !== 'water') m.set(x, y, { g: 'sand' });
  });
  // bog pools
  for (const [cx, cy, rx, ry] of [
    [18, 56, 4, 2.5],
    [30, 68, 3.5, 2],
    [14, 70, 3, 2],
  ] as const)
    m.blob(cx, cy, rx, ry, 6202 + cx, (x, y) => m.set(x, y, { g: 'water', s: true }));

  // ---------- trails ----------
  trail([8, 59, W - 1, 60]); // the main trail, east to west
  trail([158, 58, W - 1, 61]); // wider at the gate
  trail([120, 31, 121, 59]); // camp → forester's hut
  trail([104, 30, 121, 31]);
  trail([100, 61, 101, 96]); // south to the meadow
  trail([50, 95, 101, 96]);
  trail([34, 21, 35, 58]); // north to the wolves' hill
  trail([62, 42, 63, 58]); // to the lake shore
  trail([140, 61, 141, 98]); // south-east to the ruins
  // bridges over the river (the trail is drawn over the water)
  trail([86, 59, 93, 60]);
  trail([86, 95, 93, 96]);

  // ---------- Leśna Brama (east): the gate from the city ----------
  m.spawn = [166, 60];
  m.exit([W - 1, 58, W - 1, 61], 'miasto-ziomkow');
  m.sign(168, 56, 'Leśna Brama', 'Tu kończy się miasto, a zaczyna puszcza. Trzymaj się szlaku.');
  m.sign(158, 63, 'Do Miasta Ziomków', 'Szlakiem na wschód, przez park.');
  for (const [x, y] of [
    [160, 55],
    [170, 64],
    [156, 56],
  ] as const)
    m.place('pien', x, y);
  m.place('kloda', 164, 66);

  // ---------- Obozowisko (centre-east): the scouts' camp ----------
  m.place('namiot-a', 124, 57, { force: true });
  m.place('namiot-b', 136, 57, { force: true });
  m.place('namiot-a', 136, 68, { force: true });
  m.place('ognisko', 130, 64, { force: true });
  m.place('kloda', 130, 67, { force: true });
  for (const [x, y] of [
    [126, 63],
    [134, 63],
  ] as const)
    m.place('pien', x, y);
  m.place('skrzynka', 123, 67);
  m.sign(
    127,
    55,
    'Obozowisko',
    'Harcerski obóz. Kto pomoże przy ognisku, ten dostanie miejsce przy nim.',
  );

  // ---------- Chata Leśniczego (north) ----------
  m.place('chatka-a', 110, 26, { force: true });
  m.place('kloda', 104, 27, { force: true });
  m.place('kloda', 104, 25, { force: true });
  m.place('pien', 116, 25);
  m.place('pien', 117, 28);
  m.door([110, 26], 'dzika-puszcza-chata', 'Chata Leśniczego');
  m.sign(113, 29, 'Chata Leśniczego', 'Leśniczy Bartek zna każde drzewo. I każdego kłusownika.');

  // ---------- Jezioro Głębokie (north-west) ----------
  m.rect([60, 38, 61, 42], { g: 'path' }); // a little jetty to the water's edge
  m.place('lodz', 54, 40, { force: true });
  for (const [x, y] of [
    [46, 30],
    [74, 26],
    [50, 22],
    [72, 38],
  ] as const)
    m.place('rock-a|rock-b', x, y);
  m.sign(64, 44, 'Jezioro Głębokie', 'Dna nikt nie widział. Ryby za to widziały wszystko.');

  // ---------- Polana Grzybiarzy (south-west) ----------
  m.sprinkle([44, 88, 68, 104], ['krzak-jagody', 'pien'], 0.05, ['grass2'], 6301, { spacing: 2 });
  m.sign(56, 92, 'Polana Grzybiarzy', 'Grzyby rosną tu same. Zbierać wolno, deptać nie wolno.');

  // ---------- Bagna (west) ----------
  m.sign(38, 57, 'Bagna', 'Grząsko. Kładka prowadzi przez środek, nie zbaczaj.');

  // ---------- Wzgórze Wilków (north-west) ----------
  for (const [x, y] of [
    [22, 14],
    [38, 14],
    [24, 24],
    [40, 24],
    [28, 12],
  ] as const)
    m.place('rock-dark|rock-dark-b', x, y);
  m.sign(36, 27, 'Wzgórze Wilków', 'Wilków dawno tu nie ma. Są za to rozbójnicy. Uważaj.');

  // ---------- Ruiny Strażnicy (south-east) ----------
  m.place('ruina-a', 140, 104, { force: true });
  m.place('ruina-b', 150, 112, { force: true });
  m.sprinkle([128, 98, 152, 116], ['gruz', 'rock-b'], 0.04, ['gravel'], 6401, { spacing: 2 });
  m.sign(137, 98, 'Ruiny Strażnicy', 'Stara wieża straży leśnej. Teraz meldują się tu rozbójnicy.');

  // the woods around: undergrowth on the open grass
  m.sprinkle(
    [8, 8, W - 9, H - 9],
    ['bush-a', 'krzak-jagody', 'pien', 'kloda', 'tree-b'],
    0.015,
    ['grass', 'grass2'],
    6501,
    {
      spacing: 2,
    },
  );

  // ---------- zones ----------
  m.zone([152, 48, W - 1, 72], 'Leśna Brama');
  m.zone([116, 50, 144, 74], 'Obozowisko');
  m.zone([98, 18, 124, 36], 'Chata Leśniczego');
  m.zone([40, 18, 80, 46], 'Jezioro Głębokie');
  m.zone([84, 0, 95, H - 1], 'Rzeka');
  m.zone([40, 86, 72, 106], 'Polana Grzybiarzy');
  m.zone([6, 46, 42, 78], 'Bagna');
  m.zone([16, 10, 44, 30], 'Wzgórze Wilków');
  m.zone([126, 96, 154, 118], 'Ruiny Strażnicy');

  m.ground.push(
    { name: 'grass2', kinds: 'grass2', radius: 2.2, bands: [[0.3, '#70b34c']] },
    {
      name: 'forest',
      kinds: 'forest',
      radius: 2,
      bands: [
        [0.45, '#4f9a44'],
        [0.62, '#3f8a3a'],
      ],
    },
    {
      name: 'bog',
      kinds: 'bog',
      radius: 2,
      bands: [
        [0.42, '#5f7a3a'],
        [0.55, '#6f8a44'],
      ],
    },
    {
      name: 'rock',
      kinds: 'rock',
      radius: 1.6,
      bands: [
        [0.42, '#6b6560'],
        [0.55, '#857e77'],
      ],
    },
    {
      name: 'gravel',
      kinds: 'gravel',
      radius: 1,
      bands: [
        [0.45, '#8f8576'],
        [0.5, '#a89d8d'],
      ],
    },
    {
      name: 'path',
      kinds: 'path',
      radius: 1.3,
      bands: [
        [0.36, '#c9a46a'],
        [0.48, '#dcbd86'],
      ],
    },
    {
      name: 'shore',
      kinds: 'sand water',
      radius: 2.4,
      bands: [
        [0.42, '#d9c38c'],
        [0.5, '#e8d5a6'],
      ],
    },
    {
      name: 'water',
      kinds: 'water',
      radius: 2.4,
      bands: [
        [0.44, '#2f7fb0'],
        [0.5, '#a9dcf5'],
        [0.56, '#4aa8d6'],
        [0.88, '#3a94c8'],
      ],
    },
  );
  m.scatter.push(
    { ground: 'grass', chance: 0.05, props: 'tuft|tuft|flowers-a|flowers-c' },
    { ground: 'grass2', chance: 0.06, props: 'grzyby|tuft|tuft|flowers-b' },
    { ground: 'forest', chance: 0.05, props: 'grzyby|tuft' },
    { ground: 'bog', chance: 0.08, props: 'kaluza|tuft' },
    { ground: 'path', chance: 0.05, props: 'pebbles' },
    { ground: 'rock', chance: 0.04, props: 'pebbles' },
    { ground: 'water', chance: 0.12, props: 'lily' },
  );
  return m;
}
