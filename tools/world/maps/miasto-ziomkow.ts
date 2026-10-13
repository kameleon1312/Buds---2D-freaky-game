// Miasto Ziomków — the start district and hub (docs/districts.md). City centre with the Rynek, streets and
// blocks; outskirts: park, skatepark, allotments, hill, railway, garages and the road east to Los Karkos.
import { miastoZiomkowOutskirts } from './outskirts';
import { MapCanvas, noise2, rng, type Rect } from './lib';

export function miastoZiomkow(): MapCanvas {
  // grown from 128×96: the old part keeps its coordinates, the outskirts fill the new east and south
  const W = 176;
  const H = 132;
  const m = new MapCanvas('miasto-ziomkow', 'Miasto Ziomków', W, H);
  m.base = '#86c95a';
  const r = rng(1001);

  // grass variation
  const nz = noise2(11, 6);
  m.each((x, y, c) => {
    if (nz(x, y) > 0.62) c.g = 'grass2';
  });

  // forest border: an organic wall of trees (gaps for the roads are cut later)
  const edge = noise2(12, 5);
  m.each((x, y) => {
    const d = Math.min(x, y, W - 1 - x, H - 1 - y);
    const depth = 3 + edge(x, y) * 4;
    if (d < depth) {
      const tree = r() < 0.5;
      m.set(x, y, { g: 'forest', p: tree ? 'tree-a|tree-b|tree-a|tree-c' : undefined, s: true });
    }
  });

  // ---------- roads ----------
  m.road('v', 0, H - 1, 62, 4, { sidewalk: false }); // north–south avenue (Las Palmas ↔ Dwór Carski)
  m.road('h', 36, W - 1, 46, 4, { sidewalk: false }); // east avenue to Los Karkos
  // city streets with sidewalks
  m.road('v', 24, 72, 40, 2);
  m.road('v', 24, 72, 86, 2);
  m.road('h', 36, 96, 28, 2);
  m.road('h', 36, 96, 66, 2);
  // sidewalks along the avenues inside the city
  for (let y = 24; y <= 72; y++)
    for (const x of [61, 66]) if (m.get(x, y)?.g !== 'asphalt') m.set(x, y, { g: 'sidewalk' });
  for (let x = 36; x <= 96; x++)
    for (const y of [45, 50]) if (m.get(x, y)?.g !== 'asphalt') m.set(x, y, { g: 'sidewalk' });
  m.road('v', 0, H - 1, 62, 4, { sidewalk: false });
  m.road('h', 36, W - 1, 46, 4, { sidewalk: false });

  // ---------- city blocks ----------
  const row = (names: string[], x0: number, x1: number, bottom: number, gap = 1) => {
    let x = x0;
    let i = 0;
    while (x <= x1) {
      const name = names[i % names.length]!;
      const fw = name.startsWith('blok') || name === 'komisariat' ? 7 : name === 'garaze' ? 3 : 5;
      if (x + fw - 1 > x1) break;
      if (m.place(name, x + (fw - 1) / 2, bottom, { ground: 'sidewalk' }))
        for (let k = x - 1; k <= x + fw; k++) {
          const c = m.get(k, bottom + 1);
          if (c && !c.s && c.g !== 'asphalt') m.set(k, bottom + 1, { g: 'sidewalk' });
        }
      x += fw + gap;
      i++;
    }
  };
  // courtyards between rows: lawns with a paved walk in front of every row (added by row())
  const yards: Rect[] = [
    [43, 31, 59, 44],
    [68, 31, 84, 44],
    [43, 51, 59, 64],
    [68, 51, 84, 64],
  ];
  for (const area of yards) m.rect(area, { g: 'grass' });
  row(['blok-a', 'kawiarnia'], 43, 59, 34);
  row(['kamienica-a', 'kamienica-b', 'sklep-kiosk'], 43, 59, 43);
  row(['blok-b', 'blok-c'], 68, 84, 35);
  row(['sklep-ciuchy', 'kamienica-c', 'kawiarnia'], 68, 84, 43);
  row(['kamienica-b', 'sklep-kiosk', 'kamienica-a'], 43, 59, 55);
  row(['blok-c', 'blok-a'], 43, 59, 64);
  m.place('komisariat', 71, 55, { ground: 'sidewalk' });
  m.place('radiowoz', 77, 54);
  m.place('radiowoz', 81, 54);
  row(['blok-b', 'kamienica-c'], 68, 84, 64);
  // north of the 28 street, facing it
  row(['kamienica-a', 'sklep-ciuchy', 'kamienica-b'], 43, 59, 26);
  row(['kamienica-c', 'kawiarnia', 'kamienica-a'], 68, 84, 26);
  // south of the 66 street: houses facing the outskirts
  row(['house-red', 'house-blue', 'house-teal'], 37, 59, 73);
  row(['house-teal', 'house-red', 'house-blue'], 68, 96, 73);
  // courtyard greenery: trees, bushes, benches, a playground-ish corner
  for (const [i, area] of yards.entries()) {
    m.sprinkle(area, ['tree-a', 'tree-b', 'tree-c'], 0.08, ['grass'], 23 + i, { spacing: 1 });
    m.sprinkle(
      area,
      ['bush-a', 'bush-b', 'bench', 'flowers-a', 'flowers-b'],
      0.06,
      ['grass'],
      27 + i,
      { spacing: 1 },
    );
  }
  // street furniture and parked cars
  m.sprinkle([36, 24, 96, 72], ['lamp'], 0.05, ['sidewalk'], 21, { spacing: 3 });
  m.sprinkle([36, 24, 96, 72], ['bin', 'hydrant', 'planter', 'tree-a'], 0.03, ['sidewalk'], 22, {
    spacing: 2,
  });
  for (const [x, y] of [
    [43, 27],
    [53, 27],
    [75, 27],
    [89, 29],
    [44, 67],
    [79, 67],
  ] as const)
    m.place('auto-a|auto-b|auto-c', x, y);
  m.place('przystanek', 57, 45);
  m.place('przystanek', 74, 50);
  // ---------- Rynek (plaza) ----------
  const plaza: Rect = [55, 39, 72, 56];
  m.rect(plaza, (x, y) => (m.get(x, y)?.s ? null : { g: 'plaza' }));
  m.place('fontanna', 64, 49, { force: true });
  m.sign(
    60,
    44,
    'Miasto Ziomków',
    'Rynek, serce miasta. Drogi: na północ do Las Palmas, na południe do Dworu Carskiego, na wschód do Los Karkos. Mieszkańcy niedługo będą mieli dla ciebie zadania.',
  );
  for (const [x, y] of [
    [56, 40],
    [71, 40],
    [56, 55],
    [71, 55],
  ] as const)
    m.place('tree-a|tree-b', x, y);
  for (const [x, y] of [
    [60, 40],
    [67, 40],
    [60, 55],
    [67, 55],
  ] as const)
    m.place('lamp', x, y);
  for (const [x, y] of [
    [59, 51],
    [69, 51],
    [62, 42],
    [66, 42],
  ] as const)
    m.place('bench', x, y);
  for (const [x, y] of [
    [57, 47],
    [70, 47],
    [64, 41],
  ] as const)
    m.place('planter', x, y);
  m.spawn = [64, 53];

  // zebra crossings at the plaza
  for (let k = 0; k < 4; k++) {
    m.set(54, 46 + k, { g: 'asphalt', p: 'zebra-v' });
    m.set(73, 46 + k, { g: 'asphalt', p: 'zebra-v' });
    m.set(62 + k, 38, { g: 'asphalt', p: 'zebra' });
    m.set(62 + k, 57, { g: 'asphalt', p: 'zebra' });
  }

  // ---------- Park Miejski (west) ----------
  const park: Rect = [12, 30, 37, 64];
  m.rect(park, (x, y) => (m.get(x, y)?.s ? null : { g: nz(x, y) > 0.6 ? 'grass2' : 'grass' }));
  m.blob(22, 50, 6, 4.5, 31, (x, y) => m.set(x, y, { g: 'water', s: true }));
  m.blob(22, 50, 8, 6.5, 31, (x, y) => {
    if (m.get(x, y)?.g !== 'water') m.set(x, y, { g: 'sand' });
  });
  // park paths: loop and a link to the avenue
  for (let x = 14; x <= 37; x++)
    for (const y of [36, 37]) if (!m.get(x, y)?.s) m.set(x, y, { g: 'path' });
  for (let y = 36; y <= 60; y++)
    for (const x of [32, 33]) if (!m.get(x, y)?.s) m.set(x, y, { g: 'path' });
  for (let x = 14; x <= 33; x++)
    for (const y of [59, 60]) if (!m.get(x, y)?.s) m.set(x, y, { g: 'path' });
  for (let y = 36; y <= 60; y++)
    for (const x of [13, 14]) if (!m.get(x, y)?.s && m.get(x, y)) m.set(x, y, { g: 'path' });
  for (let x = 33; x <= 39; x++) for (const y of [47, 48]) m.set(x, y, { g: 'path' });
  m.sprinkle(park, ['tree-a', 'tree-b', 'tree-c'], 0.1, ['grass', 'grass2'], 32, { spacing: 1 });
  m.sprinkle(
    park,
    ['bush-a', 'bush-b', 'flowers-a', 'flowers-b', 'flowers-c'],
    0.06,
    ['grass', 'grass2'],
    33,
  );
  m.sprinkle(park, ['bench', 'lamp'], 0.12, ['path'], 34, { spacing: 4 });
  m.sign(
    30,
    35,
    'Park Miejski',
    'Staw, ławki i cień. Dobre miejsce na pierwsze zadania od mieszkańców.',
  );

  // ---------- Skatepark and court (east of the 86 street) ----------
  m.rect([89, 30, 104, 44], { g: 'concrete' });
  m.rect([96, 38, 103, 44], { g: 'court' });
  m.place('skate-ramp', 91, 33);
  m.place('skate-ramp', 95, 33);
  m.place('skate-ramp', 101, 33);
  m.place('graffiti-a', 91, 41);
  m.place('graffiti-b', 92, 37);
  m.place('kosz', 99, 39);
  m.place('kosz', 99, 44);
  m.place('bench', 104, 36);
  m.sign(
    89,
    44,
    'Skatepark',
    'Tu odbywają się bitwy freestylowe. Wkrótce: wyzwij lokalnych raperów.',
  );
  row(['blok-a', 'blok-b'], 89, 105, 64);
  m.rect([89, 51, 105, 60], (x, y) => (m.get(x, y)?.s ? null : { g: 'grass' }));
  m.sprinkle([89, 51, 105, 60], ['tree-a', 'tree-b', 'bush-a'], 0.12, ['grass'], 41, {
    spacing: 1,
  });

  // ---------- North: allotments (west) and the hill (east) ----------
  for (let py = 0; py < 2; py++)
    for (let px = 0; px < 5; px++) {
      const x0 = 9 + px * 10;
      const y0 = 6 + py * 8;
      const x1 = x0 + 8;
      const y1 = y0 + 6;
      if (m.get(x0, y0)?.s && m.get(x1, y1)?.s) continue;
      m.rect([x0 - 1, y0 - 1, x1 + 1, y1 + 1], (x, y) => (m.get(x, y)?.s ? null : { g: 'path' }));
      m.rect([x0, y0, x1, y1], { g: 'grass' });
      for (let x = x0; x <= x1; x++)
        for (const y of [y0, y1])
          if (!(y === y1 && x === x0 + 4)) m.set(x, y, { g: 'grass', p: 'fence-post', s: true });
      for (let y = y0; y <= y1; y++)
        for (const x of [x0, x1]) m.set(x, y, { g: 'grass', p: 'fence-post', s: true });
      m.rect([x0 + 1, y0 + 4, x1 - 1, y1 - 1], { g: 'soil' });
      m.sprinkle(
        [x0 + 1, y0 + 4, x1 - 1, y1 - 1],
        ['flowers-a', 'flowers-b', 'flowers-c'],
        0.7,
        ['soil'],
        50 + px + py * 5,
      );
      m.place(px % 2 ? 'altanka-a' : 'altanka-b', x0 + 3, y0 + 3);
    }
  m.sign(57, 21, 'Działki', 'Ogródki działkowe. Sąsiedzi szukają pomocy przy zbiorach.');
  m.rect([70, 5, 120, 21], (x, y) =>
    m.get(x, y)?.s ? null : { g: nz(x, y) > 0.5 ? 'grass2' : 'grass' },
  );
  m.sprinkle(
    [70, 5, 120, 21],
    ['rock-a', 'rock-b', 'bush-a', 'bush-b'],
    0.05,
    ['grass', 'grass2'],
    61,
    { spacing: 1 },
  );
  m.sprinkle([70, 5, 120, 21], ['tree-a', 'tree-b', 'tree-c'], 0.06, ['grass', 'grass2'], 62, {
    spacing: 2,
  });
  m.sprinkle(
    [70, 5, 120, 21],
    ['flowers-a', 'flowers-b', 'flowers-c'],
    0.05,
    ['grass', 'grass2'],
    63,
  );
  m.sign(70, 12, 'Wzgórze', 'Stąd widać całe miasto. Mówią, że gdzieś tu ktoś zakopał skarb.');

  // ---------- South: railway, garages and graffiti walls ----------
  for (let x = 3; x <= W - 4; x++)
    for (const y of [80, 81, 82]) {
      if (m.get(x, y)?.g === 'asphalt') continue;
      m.set(x, y, { g: 'gravel', p: y === 81 ? 'rails-h' : undefined });
    }
  m.rect([12, 84, 58, 92], (x, y) => (m.get(x, y)?.s ? null : { g: 'dirt' }));
  for (const [x, y] of [
    [15, 87],
    [19, 87],
    [23, 87],
    [31, 87],
    [35, 87],
    [43, 87],
    [47, 87],
    [51, 87],
  ] as const)
    m.place('garaze', x, y);
  m.place('graffiti-a', 27, 87);
  m.place('graffiti-c', 39, 87);
  m.place('auto-b', 25, 90);
  m.place('auto-c', 45, 90);
  m.sign(
    55,
    85,
    'Garaże',
    'Podwórka i garaże. Ściany aż proszą się o graffiti, ale uważaj na patrole.',
  );
  m.rect([68, 74, 120, 92], (x, y) =>
    m.get(x, y)?.s || m.get(x, y)?.g === 'gravel' ? null : { g: 'grass2' },
  );
  for (const x of [72, 78, 84, 96, 102, 108, 114])
    for (const y of [78, 86])
      m.place(['graffiti-a', 'graffiti-b', 'graffiti-c'][Math.floor(r() * 3)]!, x, y);
  m.place('radiowoz', 90, 76);
  m.sprinkle([68, 74, 120, 92], ['bush-a', 'tree-b', 'rock-b'], 0.04, ['grass2'], 71, {
    spacing: 1,
  });
  m.sign(70, 84, 'Tory', 'Najlepsze ściany w mieście. Policja patroluje tory wieczorami.');

  // ---------- East: the road to Los Karkos ----------
  m.rect([101, 40, 124, 44], (x, y) => (m.get(x, y)?.s ? null : { g: 'grass' }));
  m.place('przystanek', 110, 45);
  m.sprinkle([100, 38, 124, 56], ['tree-a', 'tree-b'], 0.08, ['grass', 'grass2'], 81, {
    spacing: 2,
  });
  m.sign(118, 45, 'Do Los Karkos', 'Dalej robi się niebezpiecznie. Wejście od poziomu 7.');
  m.sign(64 - 3, 3, 'Do Las Palmas', 'Tropiki, plaże i ocean. Wejście od poziomu 3.');
  m.sign(66, 88, 'Do Dworu Carskiego', 'Dworek, cegła i zagadki. Wejście od poziomu 5.');

  // roads cut through the forest at the exits
  m.road('v', 0, 8, 62, 4, { sidewalk: false });
  m.road('v', H - 9, H - 1, 62, 4, { sidewalk: false });
  m.road('h', W - 12, W - 1, 46, 4, { sidewalk: false });
  m.exit([62, 0, 65, 0], 'las-palmas');
  m.exit([62, H - 1, 65, H - 1], 'dwor-carski');
  m.exit([W - 1, 46, W - 1, 49], 'los-karkos');

  // ---------- zones ----------
  m.zone([36, 22, 97, 74], 'Śródmieście');
  m.zone(plaza, 'Rynek');
  m.zone([67, 51, 84, 58], 'Komisariat');
  m.zone([89, 30, 104, 44], 'Skatepark');
  m.zone(park, 'Park Miejski');
  m.zone([6, 4, 58, 22], 'Działki');
  m.zone([68, 4, 122, 22], 'Wzgórze');
  m.zone([10, 83, 60, 93], 'Garaże');
  m.zone([66, 74, 122, 93], 'Tory');
  m.zone([100, 38, 126, 58], 'Wylotówka');

  m.ground.push(
    { name: 'grass2', kinds: 'grass2', radius: 2.2, bands: [[0.3, '#7bbf51']] },
    {
      name: 'forest',
      kinds: 'forest',
      radius: 2,
      bands: [
        [0.45, '#6aae4a'],
        [0.62, '#5a9c40'],
      ],
    },
    {
      name: 'dirt',
      kinds: 'dirt',
      radius: 1.3,
      bands: [
        [0.4, '#b39b78'],
        [0.5, '#c9b28e'],
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
        [0.36, '#d8b878'],
        [0.48, '#ecd3a0'],
      ],
    },
    {
      name: 'soil',
      kinds: 'soil',
      radius: 1,
      bands: [
        [0.45, '#7a5236'],
        [0.55, '#9c6b45'],
      ],
    },
    {
      name: 'concrete',
      kinds: 'concrete court',
      radius: 1,
      bands: [
        [0.45, '#a7adb7'],
        [0.5, '#c9cdd4'],
      ],
    },
    {
      name: 'court',
      kinds: 'court',
      radius: 0.8,
      bands: [
        [0.5, '#d9744a'],
        [0.75, '#e8865a'],
      ],
    },
    {
      name: 'plaza',
      kinds: 'plaza',
      radius: 1,
      bands: [
        [0.45, '#c9b593'],
        [0.5, '#e6d7bd'],
      ],
    },
    {
      name: 'sidewalk',
      kinds: 'sidewalk',
      radius: 1,
      bands: [
        [0.42, '#aaa498'],
        [0.5, '#d6d0c4'],
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
    {
      name: 'shore',
      kinds: 'sand water',
      radius: 2.4,
      bands: [
        [0.42, '#e2c98f'],
        [0.5, '#f1dfae'],
      ],
    },
    {
      name: 'water',
      kinds: 'water',
      radius: 2.4,
      bands: [
        [0.44, '#3f93c9'],
        [0.5, '#c4ecfc'],
        [0.56, '#5cbdeb'],
        [0.88, '#48a8de'],
      ],
    },
  );
  m.scatter.push(
    { ground: 'grass2', chance: 0.25, props: 'tuft' },
    { ground: 'grass', chance: 0.02, props: 'flowers-a|flowers-b|flowers-c|tuft' },
    { ground: 'path', chance: 0.05, props: 'pebbles' },
    { ground: 'dirt', chance: 0.04, props: 'pebbles' },
    { ground: 'asphalt', chance: 0.006, props: 'manhole' },
    { ground: 'water', chance: 0.15, props: 'lily' },
  );
  miastoZiomkowOutskirts(m);

  // ---------- doors (rooms: tools/world/maps/interiors.ts) ----------
  m.door([82, 43], 'miasto-ziomkow-kawiarnia', 'Kawiarnia „Ziomal”');
  m.door([71, 55], 'miasto-ziomkow-komisariat', 'Komisariat');
  m.door(m.find('garaze')[0]!, 'miasto-ziomkow-garaz', 'Garaż Rysia');
  return m;
}
