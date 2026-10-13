// Las Palmas — tropical district (docs/districts.md): ocean to the west and north, beaches, the stilt-hut
// town with the beach bar, the pier, the flamingo lagoon, the jungle with temple ruins and volcanic cliffs.
import { MapCanvas, noise2, rng } from './lib';

export function lasPalmas(): MapCanvas {
  const W = 128;
  const H = 96;
  const m = new MapCanvas('las-palmas', 'Las Palmas', W, H);
  m.base = '#8ed16a';
  const r = rng(2001);
  const coast = noise2(21, 9);
  const nz = noise2(22, 6);

  // ocean (west + north), shallow band, beach
  const coastX = (y: number) => 12 + coast(0, y) * 9;
  const coastY = (x: number) => 10 + coast(x, 0) * 6;
  m.each((x, y) => {
    const d = Math.min(x - coastX(y), y - coastY(x));
    if (d < 0) m.set(x, y, { g: 'ocean', s: true });
    else if (d < 2) m.set(x, y, { g: 'shallow', s: true });
    else if (d < 9) m.set(x, y, { g: 'sand' });
    else if (nz(x, y) > 0.64) m.set(x, y, { g: 'grass2' });
  });

  // jungle border along the east and south edges
  const edge = noise2(23, 5);
  m.each((x, y, c) => {
    if (c.g === 'ocean' || c.g === 'shallow' || c.g === 'sand') return;
    const d = Math.min(W - 1 - x, H - 1 - y);
    if (d < 3 + edge(x, y) * 4)
      m.set(x, y, {
        g: 'jungle',
        p: r() < 0.5 ? 'jungle-a|jungle-b|palm-a|palm-b' : undefined,
        s: true,
      });
  });

  // ---------- Dżungla (east) ----------
  m.rect([92, 6, 124, 74], (x, y) => {
    const c = m.get(x, y);
    return c?.s ? null : { g: 'jungle' };
  });
  m.sprinkle([92, 6, 124, 74], ['jungle-a', 'jungle-b'], 0.16, ['jungle'], 31, { spacing: 1 });
  m.sprinkle([92, 6, 124, 74], ['paproc', 'paproc', 'papuga'], 0.06, ['jungle'], 32);
  // jungle trails
  for (let x = 84; x <= 120; x++) for (const y of [40, 41]) m.set(x, y, { g: 'path' });
  for (let y = 14; y <= 70; y++) for (const x of [104, 105]) m.set(x, y, { g: 'path' });
  m.rect([84, 39, 91, 42], { g: 'path' });
  m.rect([101, 28, 115, 38], { g: 'path' });
  m.place('ruiny-swiatyni', 108, 35, { force: true });
  m.place('pochodnia', 102, 37, { force: true });
  m.place('pochodnia', 114, 37, { force: true });
  m.sign(
    101,
    39,
    'Ruiny Świątyni',
    'Stare kamienie skrywają zagadkę. Mówią, że ktoś tu ukrył złotą maskę.',
  );

  // ---------- Wulkaniczne Klify (north-east) ----------
  m.rect([84, 12, 124, 24], (x, y) =>
    m.get(x, y)?.g === 'ocean' || m.get(x, y)?.g === 'shallow' ? null : { g: 'rock' },
  );
  m.sprinkle([84, 12, 124, 24], ['rock-dark', 'rock-dark-b'], 0.12, ['rock'], 41, { spacing: 1 });
  for (let y = 12; y <= 30; y++) for (const x of [104, 105]) m.set(x, y, { g: 'path' });
  m.sign(
    103,
    25,
    'Klify',
    'Wulkaniczne skały. Najtrudniejsze potyczki w Las Palmas czekają na górze.',
  );

  // ---------- Laguna Flamingów ----------
  m.blob(70, 28, 8, 5, 51, (x, y) => m.set(x, y, { g: 'water', s: true }));
  m.blob(70, 28, 10, 7, 51, (x, y) => {
    if (m.get(x, y)?.g !== 'water') m.set(x, y, { g: 'sand' });
  });
  for (const [x, y] of [
    [60, 26],
    [61, 31],
    [80, 27],
    [79, 32],
    [72, 35],
  ] as const)
    m.place('flaming', x, y, { force: true });
  m.sign(
    66,
    36,
    'Laguna Flamingów',
    'Flamingi nie lubią hałasu. Podejdź cicho, a może któryś cię polubi.',
  );

  // ---------- Miasteczko (town) ----------
  const town: [number, number, number, number] = [44, 50, 90, 86];
  m.rect(town, (x, y) => (m.get(x, y)?.s ? null : { g: 'grass' }));
  m.rect([50, 66, 84, 74], { g: 'path' }); // main sandy square
  m.rect([62, 66, 65, H - 1], (x, y) => (y > 74 || x >= 62 ? { g: 'path' } : null)); // road south to the exit
  for (let y = 75; y < H; y++) for (let x = 62; x <= 65; x++) m.set(x, y, { g: 'path' });
  // hut rows north and south of the square, each with a little path to its stairs
  for (const [x, y] of [
    [52, 64],
    [59, 64],
    [70, 64],
    [77, 64],
    [52, 80],
    [72, 80],
    [79, 80],
  ] as const) {
    m.place(['chatka-a', 'chatka-b', 'chatka-c'][(x + y) % 3]!, x, y, { force: true });
    if (y === 80) m.rect([x - 1, 75, x + 1, 77], { g: 'path' });
  }
  m.place('bar-plaza', 85, 74, { force: true });
  m.place('stragan-owoce', 57, 73, { force: true });
  m.place('stragan-owoce', 69, 73, { force: true });
  for (const [x, y] of [
    [50, 66],
    [84, 66],
    [50, 74],
    [61, 70],
    [66, 70],
  ] as const)
    m.place('pochodnia', x, y, { force: true });
  m.sprinkle(town, ['palm-a', 'palm-b', 'palm-c'], 0.08, ['grass', 'grass2'], 61, { spacing: 2 });
  m.sprinkle(town, ['paproc', 'bush-b'], 0.04, ['grass', 'grass2'], 62, { spacing: 1 });
  m.sign(
    60,
    68,
    'Las Palmas',
    'Aloha! Miasteczko na palach, bar na plaży i ocean. Mieszkańcy mają sporo do zrobienia.',
  );
  m.spawn = [64, 72];

  // ---------- Plaża Aloha (west beach) + Pomost (pier) ----------
  m.sprinkle([10, 20, 44, 94], ['parasol-a', 'parasol-b'], 0.035, ['sand'], 71, { spacing: 3 });
  m.sprinkle([10, 20, 44, 94], ['lezak-a', 'lezak-b'], 0.035, ['sand'], 72, { spacing: 2 });
  m.sprinkle(
    [10, 20, 44, 94],
    ['deski-surf', 'krab', 'zolw', 'palm-a', 'palm-b'],
    0.02,
    ['sand'],
    73,
    { spacing: 3 },
  );
  // path from town to the beach
  for (let x = 20; x <= 50; x++)
    for (const y of [69, 70])
      if (!m.get(x, y)?.s || m.get(x, y)?.g === 'sand') m.set(x, y, { g: 'path' });
  // pier over the shallow water and into the ocean
  const pierY = 60;
  let px = Math.floor(coastX(pierY)) + 6;
  for (; px >= 2; px--) for (const y of [pierY, pierY + 1]) m.set(px, y, { g: 'planks' });
  m.place('lodz', 5, pierY - 1, { force: true, ground: 'ocean' });
  m.place('lodz', 8, pierY + 3, { force: true, ground: 'ocean' });
  m.sign(
    Math.floor(coastX(pierY)) + 8,
    pierY - 1,
    'Pomost',
    'Stąd wypływają łodzie na rafę. Rybacy szukają pomocników.',
  );
  m.sign(30, 68, 'Plaża Aloha', 'Najlepsze fale na wyspie. Wkrótce: zawody surfingowe.');

  // ---------- Rafa (north beach) ----------
  m.sprinkle([10, 8, 84, 22], ['rock-a', 'rock-b'], 0.04, ['sand'], 81, { spacing: 2 });
  m.sprinkle([10, 8, 84, 22], ['krab', 'palm-a', 'palm-c'], 0.03, ['sand'], 82, { spacing: 3 });
  m.sign(44, 20, 'Rafa', 'Przy odpływie widać kolorowe ryby. Podobno leży tu zatopiony skarb.');

  // ---------- meadows between: palms, flowers ----------
  m.sprinkle(
    [20, 22, 92, 50],
    ['palm-a', 'palm-b', 'palm-c', 'bush-a', 'paproc'],
    0.05,
    ['grass', 'grass2'],
    91,
    { spacing: 2 },
  );

  // exit road south, cutting through the jungle border
  for (let y = 84; y < H; y++) for (let x = 62; x <= 65; x++) m.set(x, y, { g: 'path' });
  m.sign(67, 90, 'Do Miasta Ziomków', 'Droga powrotna do miasta.');
  m.exit([62, H - 1, 65, H - 1], 'miasto-ziomkow');

  m.zone(town, 'Miasteczko');
  m.zone([10, 24, 44, 94], 'Plaża Aloha');
  m.zone([0, pierY - 2, 22, pierY + 3], 'Pomost');
  m.zone([10, 6, 84, 22], 'Rafa');
  m.zone([58, 18, 82, 38], 'Laguna Flamingów');
  m.zone([90, 14, 124, 74], 'Dżungla');
  m.zone([100, 27, 116, 39], 'Ruiny Świątyni');
  m.zone([84, 12, 124, 24], 'Wulkaniczne Klify');

  m.ground.push(
    {
      name: 'sand',
      kinds: 'sand shallow ocean planks',
      radius: 2,
      bands: [
        [0.42, '#e8cf96'],
        [0.5, '#f6e3b0'],
      ],
    },
    { name: 'grass2', kinds: 'grass2', radius: 2.2, bands: [[0.3, '#82c75f']] },
    {
      name: 'jungle',
      kinds: 'jungle',
      radius: 2,
      bands: [
        [0.42, '#5aa84a'],
        [0.6, '#4a983e'],
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
      name: 'path',
      kinds: 'path',
      radius: 1.3,
      bands: [
        [0.36, '#d9bd85'],
        [0.48, '#efd9a6'],
      ],
    },
    {
      name: 'shallow',
      kinds: 'shallow ocean',
      radius: 2.4,
      bands: [
        [0.44, '#ffffff'],
        [0.5, '#6fd6ea'],
      ],
    },
    {
      name: 'ocean',
      kinds: 'ocean',
      radius: 2.6,
      bands: [
        [0.5, '#3aa6dc'],
        [0.85, '#2b8bc8'],
      ],
    },
    {
      name: 'lagoon-shore',
      kinds: 'water',
      radius: 2.4,
      bands: [
        [0.44, '#3f93c9'],
        [0.5, '#c4ecfc'],
        [0.56, '#5cbdeb'],
        [0.88, '#48a8de'],
      ],
    },
    {
      name: 'planks',
      kinds: 'planks',
      radius: 0.8,
      bands: [
        [0.5, '#a8774a'],
        [0.56, '#c48a52'],
      ],
    },
  );
  m.scatter.push(
    { ground: 'sand', chance: 0.03, props: 'muszle|rozgwiazda|muszle' },
    { ground: 'grass', chance: 0.03, props: 'hibiskus|tuft' },
    { ground: 'grass2', chance: 0.12, props: 'tuft|hibiskus' },
    { ground: 'jungle', chance: 0.05, props: 'hibiskus|tuft' },
    { ground: 'path', chance: 0.03, props: 'muszle' },
    { ground: 'water', chance: 0.12, props: 'lily' },
  );
  // ---------- doors (rooms: tools/world/maps/interiors.ts) ----------
  m.door([52, 64], 'las-palmas-chatka', 'Chatka rybaka');
  return m;
}
