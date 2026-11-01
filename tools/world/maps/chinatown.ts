// Chinatown (docs/districts.md): the city past Dwór Carski. The road from the wasteland comes in from the north under
// the great gate, runs down Ulica Lampionów past the shop houses to Plac Smoka, on to the pagoda in its garden with the
// koi pond and the tea house; the night market lies east of the square, the craftsmen's lanes and the dojo west of it,
// the bamboo grove and the cherry hill around them, the harbour along the south.
import { MapCanvas, noise2, rng, type Rect } from './lib';

export function chinatown(): MapCanvas {
  const W = 176;
  const H = 132;
  const m = new MapCanvas('chinatown', 'Chinatown', W, H, 'grass');
  m.base = '#84bd5e';
  const r = rng(6001);
  const nz = noise2(61, 6);
  m.each((x, y, c) => {
    if (nz(x, y) > 0.64) c.g = 'grass2';
  });

  // border: a wall of bamboo
  const edge = noise2(62, 5);
  m.each((x, y) => {
    const d = Math.min(x, y, W - 1 - x, H - 1 - y);
    if (d < 3 + edge(x, y) * 3)
      m.set(x, y, {
        g: 'forest',
        p: r() < 0.5 ? 'ct-bambus-a|ct-bambus-b' : undefined,
        s: true,
      });
  });

  const stone = (rect: Rect) =>
    m.rect(rect, (x, y) => (m.get(x, y)?.s && m.get(x, y)?.g === 'water' ? null : { g: 'cobble' }));
  const lane = (rect: Rect) => m.rect(rect, { g: 'gravel' });

  // ---------- Ulica Lampionów: from the north gate down to the square ----------
  stone([58, 0, 69, 56]);
  m.rect([62, 0, 65, 56], { g: 'asphalt' });
  m.place('ct-brama', 64, 12, { force: true });
  // the road runs under the middle bay: only the columns stand in the way
  for (let x = 58; x <= 69; x++) {
    const c = m.get(x, 12);
    if (c && x >= 61 && x <= 66) c.s = false;
  }
  m.place('ct-lew', 58, 15, { force: true });
  m.place('ct-lew', 70, 15, { force: true });
  m.sign(
    71,
    17,
    'Chinatown',
    'Brama Smoka. Za nią lampiony, makaron o każdej porze i ludzie, którzy pamiętają każdą przysługę.',
  );
  // shop houses shoulder to shoulder along both sides of the street, a second row behind them
  for (const [i, y] of [24, 32, 40, 48].entries()) {
    const left = ['ct-sklep-a', 'ct-sklep-c', 'ct-sklep-b', 'ct-sklep-a'][i]!;
    const right = ['ct-sklep-b', 'ct-sklep-a', 'ct-sklep-c', 'ct-sklep-b'][i]!;
    m.rect([50, y - 3, 57, y + 1], { g: 'cobble' });
    m.rect([70, y - 3, 77, y + 1], { g: 'cobble' });
    m.place(left, 53, y, { force: true });
    m.place(right, 74, y, { force: true });
  }
  for (const [x, kind] of [
    [43, 'ct-sklep-b'],
    [84, 'ct-sklep-c'],
  ] as const) {
    m.rect([x - 4, 21, x + 4, 25], { g: 'cobble' });
    m.place(kind, x, 24, { force: true });
  }
  for (const y of [28, 36, 44]) {
    m.place('ct-girlanda', 53, y, { force: true });
    m.place('ct-girlanda', 74, y, { force: true });
  }
  lane([40, 26, 57, 28]);
  lane([70, 26, 90, 28]);
  lane([46, 42, 57, 44]);
  lane([70, 42, 82, 44]);
  for (const y of [20, 32, 46]) {
    m.place('ct-lampion', 57, y, { force: true });
    m.place('ct-lampion', 70, y, { force: true });
  }
  m.spawn = [64, 30];

  // ---------- Plac Smoka: the square ----------
  const square: Rect = [42, 56, 86, 76];
  stone(square);
  m.place('ct-smok', 64, 68, { force: true });
  for (const [x, y] of [
    [46, 60],
    [82, 60],
    [46, 73],
    [82, 73],
  ] as const)
    m.place('ct-lampion', x, y, { force: true });
  m.place('ct-beben', 52, 62, { force: true });
  m.place('ct-beben', 76, 62, { force: true });
  m.place('ct-kadzidlo', 59, 71, { force: true });
  m.place('ct-kadzidlo', 69, 71, { force: true });
  m.place('ct-girlanda', 53, 57, { force: true });
  m.place('ct-girlanda', 75, 57, { force: true });
  m.sign(
    57,
    74,
    'Plac Smoka',
    'Podobno smok z brązu otwiera oko, gdy ktoś kłamie na tym placu. Nikt jeszcze nie sprawdził.',
  );

  // ---------- Nocny Targ: east of the square ----------
  const market: Rect = [88, 50, 130, 80];
  lane([86, 64, 88, 67]);
  m.rect(market, { g: 'cobble' });
  const stalls = ['ct-stragan-makaron', 'ct-stragan-owoce', 'ct-stragan-herbata'];
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 6; i++)
      m.place(stalls[(row + i) % 3]!, 93 + i * 7, 57 + row * 9, { force: true });
  for (const y of [52, 61, 70]) m.place('ct-girlanda', 109, y, { force: true });
  m.sign(
    89,
    52,
    'Nocny Targ',
    'Świeży makaron, herbata na wagę i towar, o który lepiej nie pytać.',
  );

  // ---------- Uliczki Rzemieślników and the dojo: west of the square ----------
  const crafts: Rect = [8, 50, 40, 86];
  m.rect(crafts, { g: 'cobble' });
  lane([40, 64, 42, 67]);
  m.place('ct-dojo', 24, 62, { force: true });
  m.place('ct-sklep-a', 14, 76, { force: true });
  m.place('ct-sklep-b', 33, 76, { force: true });
  for (const x of [17, 31]) m.place('ct-lew', x, 65, { force: true });
  for (const [x, y] of [
    [10, 66],
    [38, 66],
    [24, 82],
  ] as const)
    m.place('ct-lampion', x, y, { force: true });
  m.sign(26, 67, 'Dojo Starego Wei', 'Ciało uczy się przez powtarzanie. Głowa przez pokorę.');

  // ---------- Ogród Pagody: south of the square, with the koi pond and the tea house ----------
  const garden: Rect = [44, 78, 110, 110];
  m.rect(garden, (x, y) => (m.get(x, y)?.s ? null : { g: 'lawn' }));
  m.rect([62, 76, 65, 110], { g: 'gravel' });
  m.rect([50, 104, 104, 106], { g: 'gravel' });
  m.place('ct-pagoda', 64, 100, { force: true });
  m.blob(90, 88, 12, 7, 63, (x, y) => m.set(x, y, { g: 'water', s: true }));
  m.sprinkle([78, 81, 102, 95], ['ct-koi', 'lily'], 0.1, ['water'], 64, { spacing: 2 });
  // a little red bridge over the pond
  for (let x = 88; x <= 92; x++) for (let y = 82; y <= 95; y++) m.set(x, y, { g: 'planks' });
  m.place('ct-mostek', 90, 89, { force: true });
  for (let x = 88; x <= 92; x++) {
    const c = m.get(x, 89);
    if (c) {
      c.s = false;
      c.p = x === 90 ? 'ct-mostek' : undefined;
    }
  }
  m.rect([88, 96, 92, 106], { g: 'gravel' });
  m.rect([70, 84, 92, 85], { g: 'gravel' });
  m.place('ct-herbaciarnia', 53, 90, { force: true });
  m.rect([50, 91, 61, 92], { g: 'gravel' });
  m.sprinkle([44, 78, 110, 110], ['ct-wisnia', 'bush-a', 'ct-bambus-a'], 0.02, ['lawn'], 65, {
    spacing: 4,
  });
  m.sign(
    67,
    103,
    'Pagoda',
    'Pięć pięter, sto dwadzieścia osiem schodów. Na szczycie ktoś podobno czeka.',
  );
  m.sign(46, 92, 'Herbaciarnia', 'Herbata nie lubi pośpiechu. Goście też nie powinni.');

  // ---------- Gaj Bambusowy (north-east) and Wiśniowe Wzgórze (north-west) ----------
  const grove: Rect = [96, 8, 168, 46];
  m.sprinkle(
    grove,
    ['ct-bambus-a', 'ct-bambus-b', 'ct-bambus-a', 'rock-a'],
    0.13,
    ['grass', 'grass2'],
    66,
    {
      spacing: 1,
    },
  );
  m.rect([90, 27, 130, 28], { g: 'path' });
  m.rect([130, 14, 131, 42], { g: 'path' });
  m.sign(
    133,
    28,
    'Gaj Bambusowy',
    'Łatwo tu zgubić drogę. Jeszcze łatwiej kogoś, kto idzie za tobą.',
  );
  const hill: Rect = [8, 8, 38, 46];
  m.sprinkle(hill, ['ct-wisnia', 'ct-wisnia', 'flowers-a'], 0.05, ['grass', 'grass2'], 67, {
    spacing: 4,
  });
  m.rect([20, 27, 40, 28], { g: 'path' });
  m.sign(22, 29, 'Wiśniowe Wzgórze', 'Kwiaty opadają tu przez cały rok. Nikt nie wie dlaczego.');

  // ---------- Stare Magazyny (east) ----------
  const stores: Rect = [132, 50, 170, 104];
  m.rect(stores, { g: 'concrete' });
  m.rect([130, 64, 132, 67], { g: 'cobble' });
  for (const [x, y] of [
    [140, 62],
    [160, 62],
    [140, 82],
    [160, 82],
  ] as const)
    m.place('ct-sklep-c', x, y, { force: true });
  m.sprinkle(stores, ['beczka-ogien', 'skrzynka', 'smieci'], 0.018, ['concrete'], 68, {
    spacing: 3,
  });
  m.sign(150, 66, 'Stare Magazyny', 'Tu towar znika z ksiąg. A czasem ludzie.');

  // ---------- Port Lampionów (south) ----------
  m.rect([4, 118, W - 5, 127], { g: 'water', s: true });
  m.rect([4, 111, W - 5, 117], (x, y) => (m.get(x, y)?.s ? null : { g: 'sand' }));
  m.rect([62, 110, 65, 117], { g: 'gravel' });
  for (const x of [26, 64, 100, 140]) m.rect([x, 118, x + 2, 123], { g: 'planks' });
  m.sign(70, 112, 'Port Lampionów', 'Łodzie odpływają o każdej porze. Nikt nie pyta o bagaż.');

  // ---------- the rest of the town joined up ----------
  m.rect([40, 44, 46, 46], { g: 'gravel' });
  m.rect([20, 46, 22, 50], { g: 'gravel' });
  m.rect([20, 44, 46, 46], { g: 'gravel' });
  m.rect([110, 80, 112, 104], { g: 'gravel' });
  m.rect([110, 104, 150, 106], { g: 'gravel' });
  m.rect([149, 104, 151, 111], { g: 'gravel' });
  m.rect([24, 86, 26, 111], { g: 'gravel' });

  m.exit([62, 0, 65, 0], 'pustkowie-ryzowe');
  m.sign(
    67,
    3,
    'Do Dworu Carskiego',
    'Ryżowy Trakt na północ. Stąd już tylko pola i chwiejne kładki.',
  );

  m.zone([56, 0, 72, 20], 'Brama Smoka');
  m.zone([40, 20, 92, 55], 'Ulica Lampionów');
  m.zone(square, 'Plac Smoka');
  m.zone(market, 'Nocny Targ');
  m.zone(crafts, 'Uliczki Rzemieślników');
  m.zone(garden, 'Ogród Pagody');
  m.zone(grove, 'Gaj Bambusowy');
  m.zone(hill, 'Wiśniowe Wzgórze');
  m.zone(stores, 'Stare Magazyny');
  m.zone([4, 111, W - 5, 127], 'Port Lampionów');

  m.ground.push(
    { name: 'grass2', kinds: 'grass2', radius: 2.2, bands: [[0.3, '#74ad52']] },
    { name: 'lawn', kinds: 'lawn', radius: 1.6, bands: [[0.35, '#8fc765']] },
    {
      name: 'forest',
      kinds: 'forest',
      radius: 2,
      bands: [
        [0.45, '#5f9a4a'],
        [0.62, '#528c40'],
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
      name: 'path',
      kinds: 'path',
      radius: 1.2,
      bands: [
        [0.42, '#b2966d'],
        [0.5, '#cdb48a'],
      ],
    },
    {
      name: 'cobble',
      kinds: 'cobble',
      radius: 1,
      bands: [
        [0.42, '#7d6a5e'],
        [0.5, '#a58f80'],
      ],
    },
    {
      name: 'asphalt',
      kinds: 'asphalt',
      radius: 0.8,
      bands: [
        [0.45, '#3f3a3c'],
        [0.5, '#544d4f'],
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
      name: 'sand',
      kinds: 'sand',
      radius: 1.8,
      bands: [
        [0.4, '#d6bd8a'],
        [0.5, '#ecd9ac'],
      ],
    },
    {
      name: 'planks',
      kinds: 'planks',
      radius: 0.6,
      bands: [
        [0.42, '#8f6236'],
        [0.5, '#b48250'],
      ],
    },
    {
      name: 'shore',
      kinds: 'water',
      radius: 2.2,
      bands: [
        [0.44, '#3a8fb5'],
        [0.5, '#bfe9f5'],
        [0.56, '#58b6cf'],
        [0.88, '#46a4c2'],
      ],
    },
  );
  m.scatter.push(
    { ground: 'grass', chance: 0.05, props: 'tuft|tuft|flowers-a' },
    { ground: 'grass2', chance: 0.05, props: 'tuft|flowers-c' },
    { ground: 'lawn', chance: 0.05, props: 'flowers-a|flowers-c|tuft' },
    { ground: 'cobble', chance: 0.02, props: 'liscie-a|liscie-b' },
    { ground: 'asphalt', chance: 0.02, props: 'plama-oleju|rysa' },
    { ground: 'concrete', chance: 0.05, props: 'pekniecie|gruz' },
    { ground: 'sand', chance: 0.03, props: 'pebbles' },
  );

  // ---------- doors (rooms: tools/world/maps/interiors.ts) ----------
  m.door([53, 90], 'chinatown-herbaciarnia', 'Herbaciarnia „Cicha Woda”');
  m.door([24, 62], 'chinatown-dojo', 'Dojo Starego Wei');
  return m;
}
