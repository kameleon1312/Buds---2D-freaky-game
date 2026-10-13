// Dwór Carski — aristocratic district (docs/districts.md): tree-lined avenue to the manor and its fountain
// courtyard, the rose garden, a real hedge maze, brick tenements, the officials' quarter and the stables.
import { MapCanvas, noise2, rng, type Rect } from './lib';

export function dworCarski(): MapCanvas {
  const W = 128;
  const H = 96;
  const m = new MapCanvas('dwor-carski', 'Dwór Carski', W, H, 'lawn');
  m.base = '#7fbf5a';
  const r = rng(3001);
  const nz = noise2(31, 6);
  m.each((x, y, c) => {
    if (nz(x, y) > 0.66) c.g = 'lawn2';
  });

  // park border of trees
  const edge = noise2(32, 5);
  m.each((x, y) => {
    const d = Math.min(x, y, W - 1 - x, H - 1 - y);
    if (d < 3 + edge(x, y) * 3)
      m.set(x, y, {
        g: 'forest',
        p: r() < 0.55 ? 'tree-a|tree-b|topiary-stozek' : undefined,
        s: true,
      });
  });

  const cobble = (rect: Rect) => m.rect(rect, { g: 'cobble' });

  // ---------- the avenue and the manor ----------
  cobble([60, 0, 67, 37]);
  for (let y = 4; y <= 34; y += 4) {
    m.place('latarnia-gaz', 59, y, { force: true });
    m.place('latarnia-gaz', 68, y, { force: true });
    m.place('topiary-stozek', 59, y + 2, { force: true });
    m.place('topiary-stozek', 68, y + 2, { force: true });
  }
  cobble([46, 36, 81, 46]);
  m.place('fontanna-duza', 64, 42, { force: true });
  for (const x of [48, 54, 74, 80]) m.place('topiary-kula', x, 38, { force: true });
  for (const x of [49, 79]) m.place('latarnia-gaz', x, 45, { force: true });
  m.place('dworek', 64, 52, { force: true });
  m.place('powoz', 54, 45, { force: true });
  m.sign(
    57,
    46,
    'Dwór Carski',
    'Dworek należy do rodu, który od lat trzyma tu władzę. Za fasadą kryje się sporo tajemnic.',
  );
  m.spawn = [64, 30];

  // ---------- Ogród Różany behind and around the manor ----------
  const garden: Rect = [44, 54, 84, 72];
  m.rect(garden, { g: 'lawn' });
  m.rect([44, 53, 84, 53], { g: 'gravel' });
  m.rect([62, 53, 65, 72], { g: 'gravel' });
  m.rect([44, 62, 84, 63], { g: 'gravel' });
  for (let x = 46; x <= 82; x += 2) {
    for (const y of [56, 60, 66, 70])
      if (m.get(x, y)?.g === 'lawn') m.set(x, y, { g: 'lawn', p: 'roze' });
  }
  for (const [x, y] of [
    [50, 58],
    [76, 58],
    [50, 68],
    [76, 68],
  ] as const)
    m.place('posag', x, y, { force: true });
  m.sprinkle(garden, ['topiary-kula', 'lawka-park'], 0.06, ['gravel'], 41, { spacing: 3 });
  m.sign(
    66,
    64,
    'Ogród Różany',
    'Ogrodnik zgubił klucz do szklarni. Może ktoś widział, gdzie go zostawił?',
  );

  // ---------- Labirynt (west): a real maze carved with a depth-first search ----------
  const mz: Rect = [6, 50, 40, 90];
  const cols = Math.floor((mz[2] - mz[0]) / 2);
  const rows = Math.floor((mz[3] - mz[1]) / 2);
  m.rect(mz, (x, y) =>
    m.get(x, y)?.s && m.get(x, y)?.g === 'forest' ? null : { g: 'hedge', s: true },
  );
  const seen = new Set<number>();
  const stack: [number, number][] = [[0, 0]];
  seen.add(0);
  const cell = (cx: number, cy: number) => [mz[0] + 1 + cx * 2, mz[1] + 1 + cy * 2] as const;
  const carve = (x: number, y: number) => m.set(x, y, { g: 'gravel' });
  carve(...cell(0, 0));
  const mr = rng(3101);
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1]!;
    const options = (
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const
    ).filter(([dx, dy]) => {
      const nx = cx + dx;
      const ny = cy + dy;
      return nx >= 0 && ny >= 0 && nx < cols && ny < rows && !seen.has(ny * cols + nx);
    });
    if (!options.length) {
      stack.pop();
      continue;
    }
    const [dx, dy] = options[Math.floor(mr() * options.length)]!;
    const [x0, y0] = cell(cx, cy);
    carve(x0 + dx, y0 + dy);
    carve(...cell(cx + dx, cy + dy));
    seen.add((cy + dy) * cols + cx + dx);
    stack.push([cx + dx, cy + dy]);
  }
  // entrance from the east (garden side) and a prize in the middle
  const [ex, ey] = cell(cols - 1, Math.floor(rows / 2));
  for (let x = ex; x <= 44; x++) carve(x, ey);
  const [mx, my] = cell(Math.floor(cols / 2), Math.floor(rows / 2));
  m.place('posag', mx, my, { force: true });
  m.rect([mx - 1, my + 1, mx + 1, my + 1], { g: 'gravel' });
  m.sign(
    43,
    ey - 1,
    'Labirynt',
    'Kto dojdzie do posągu w środku, pozna szyfr do sejfu urzędników.',
  );
  for (let x = 41; x <= 61; x++)
    for (const y of [ey, ey + 1]) if (!m.get(x, y)?.s) m.set(x, y, { g: 'gravel' });

  // ---------- Kamienice (north-west): brick tenements along cobbled streets ----------
  cobble([8, 20, 59, 22]);
  cobble([8, 34, 59, 36]);
  cobble([20, 8, 22, 46]);
  cobble([40, 8, 42, 46]);
  const tenements = ['kamienica-cegla-a', 'kamienica-cegla-b'];
  for (const y of [19, 33, 45])
    for (let x = 11, i = 0; x <= 56; x += 6, i++) {
      if (x >= 18 && x <= 24) continue;
      if (x >= 38 && x <= 44) continue;
      m.place(tenements[i % 2]!, x, y, { ground: 'cobble' });
    }
  m.sprinkle([8, 8, 59, 47], ['latarnia-gaz'], 0.08, ['cobble'], 51, { spacing: 4 });
  m.sprinkle([8, 8, 59, 47], ['lawka-park', 'topiary-kula'], 0.03, ['cobble'], 52, { spacing: 3 });
  m.sign(
    31,
    23,
    'Kamienice',
    'Mieszkańcy kamienic wiedzą wszystko o wszystkich. Wystarczy dobrze zapytać.',
  );

  // ---------- Dzielnica Urzędnicza (north-east): office, bank, square ----------
  cobble([70, 8, 122, 46]);
  m.place('urzad', 82, 20, { force: true });
  m.place('bank', 104, 20, { force: true });
  m.place('kamienica-cegla-b', 118, 20, { force: true });
  for (const x of [76, 88, 98, 110]) m.place('kamienica-cegla-a', x, 36, { force: true });
  m.place('posag', 93, 28, { force: true });
  m.place('powoz', 95, 42, { force: true });
  m.place('powoz', 112, 28, { force: true });
  m.sprinkle([70, 8, 122, 46], ['latarnia-gaz'], 0.05, ['cobble'], 61, { spacing: 4 });
  m.sign(
    90,
    28,
    'Dzielnica Urzędnicza',
    'Panowie w cylindrach liczą tu cudze pieniądze. Uczciwi to oni nie są.',
  );

  // ---------- Stajnie (south-east) ----------
  const stables: Rect = [86, 56, 122, 90];
  m.rect(stables, (x, y) => (m.get(x, y)?.s ? null : { g: 'dirt' }));
  m.place('stajnia', 96, 64, { force: true });
  m.place('stajnia', 112, 64, { force: true });
  for (let x = 88; x <= 120; x++)
    for (const y of [72, 88]) m.set(x, y, { g: 'dirt', p: 'fence-post', s: true });
  for (let y = 72; y <= 88; y++)
    for (const x of [88, 120]) m.set(x, y, { g: 'dirt', p: 'fence-post', s: true });
  for (const x of [103, 104, 105]) m.set(x, 72, { g: 'dirt' });
  m.sprinkle([89, 73, 119, 87], ['siano'], 0.03, ['dirt'], 71, { spacing: 2 });
  m.place('powoz', 104, 68, { force: true });
  m.sign(101, 70, 'Stajnie', 'Stajenny potrzebuje kogoś, kto złapie zbiegłego kucyka.');
  // gravel road from the courtyard to the stables
  for (let x = 82; x <= 104; x++)
    for (const y of [48, 49]) if (!m.get(x, y)?.s) m.set(x, y, { g: 'gravel' });
  for (let y = 48; y <= 72; y++)
    for (const x of [103, 104]) if (!m.get(x, y)?.s) m.set(x, y, { g: 'gravel' });

  // ---------- south park ----------
  m.blob(64, 82, 7, 4, 81, (x, y) => m.set(x, y, { g: 'water', s: true }));
  m.blob(64, 82, 9, 6, 81, (x, y) => {
    if (m.get(x, y)?.g !== 'water') m.set(x, y, { g: 'gravel' });
  });
  m.sprinkle([44, 74, 84, 92], ['tree-a', 'tree-b', 'topiary-kula'], 0.07, ['lawn', 'lawn2'], 82, {
    spacing: 2,
  });
  m.sprinkle([44, 74, 84, 92], ['lawka-park', 'latarnia-gaz'], 0.08, ['gravel'], 83, {
    spacing: 3,
  });
  m.rect([62, 72, 65, 75], { g: 'gravel' });

  // exit north
  m.sign(70, 3, 'Do Miasta Ziomków', 'Droga powrotna do miasta.');
  m.exit([62, 0, 65, 0], 'miasto-ziomkow');

  m.zone([44, 0, 84, 52], 'Aleja Carska');
  m.zone([46, 36, 81, 52], 'Dworek');
  m.zone(garden, 'Ogród Różany');
  m.zone(mz, 'Labirynt');
  m.zone([6, 6, 60, 48], 'Kamienice');
  m.zone([70, 6, 124, 47], 'Dzielnica Urzędnicza');
  m.zone(stables, 'Stajnie');
  m.zone([44, 73, 84, 93], 'Park Dworski');

  m.ground.push(
    { name: 'lawn2', kinds: 'lawn2', radius: 2.2, bands: [[0.3, '#74b552']] },
    {
      name: 'forest',
      kinds: 'forest',
      radius: 2,
      bands: [
        [0.45, '#64a64a'],
        [0.62, '#57983f'],
      ],
    },
    {
      name: 'dirt',
      kinds: 'dirt',
      radius: 1.3,
      bands: [
        [0.4, '#a98c66'],
        [0.5, '#c2a77f'],
      ],
    },
    {
      name: 'gravel',
      kinds: 'gravel',
      radius: 1.2,
      bands: [
        [0.38, '#c9bca2'],
        [0.48, '#e2d8c1'],
      ],
    },
    {
      name: 'hedge',
      kinds: 'hedge',
      radius: 0.9,
      bands: [
        [0.42, '#24572b'],
        [0.52, '#357c3a'],
        [0.75, '#45924a'],
      ],
    },
    {
      name: 'cobble',
      kinds: 'cobble',
      radius: 1,
      bands: [
        [0.42, '#8f857a'],
        [0.5, '#b3a899'],
      ],
    },
    {
      name: 'shore',
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
    { ground: 'lawn', chance: 0.015, props: 'roze|tuft' },
    { ground: 'lawn2', chance: 0.12, props: 'tuft' },
    { ground: 'gravel', chance: 0.03, props: 'pebbles' },
    { ground: 'dirt', chance: 0.05, props: 'pebbles|tuft' },
    { ground: 'water', chance: 0.12, props: 'lily' },
  );
  return m;
}
