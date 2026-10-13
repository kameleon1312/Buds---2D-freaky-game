// Wyspa Startowa — where every new bud wakes up: a small tropical island with the tutorial. A beach to start on,
// the fishing village, the lighthouse hill, a fenced training ring and the pier whose boat goes to Miasto Ziomków
// once the last tutorial quest is done (the game opens that exit; the island has no road back).
import { MapCanvas, noise2, rng } from './lib';

export function wyspaStartowa(): MapCanvas {
  const W = 84;
  const H = 60;
  const m = new MapCanvas('wyspa-startowa', 'Wyspa Startowa', W, H, 'ocean');
  m.base = '#3aa6dc';
  const r = rng(5001);
  const coast = noise2(5002, 6);
  const nz = noise2(5003, 5);

  // the island: an organic blob, beach around, grass inside
  m.each((x, y) => {
    const d = Math.hypot((x + 0.5 - 38) / 31, (y + 0.5 - 30) / 23) - coast(x, y) * 0.18;
    if (d > 1.02) m.set(x, y, { g: 'ocean', s: true });
    else if (d > 0.94) m.set(x, y, { g: 'shallow', s: true });
    else if (d > 0.72) m.set(x, y, { g: 'sand' });
    else m.set(x, y, { g: nz(x, y) > 0.6 ? 'grass2' : 'grass' });
  });

  // ---------- paths between the places ----------
  const path = (x0: number, y0: number, x1: number, y1: number) =>
    m.rect([x0, y0, x1, y1], (x, y) => (m.get(x, y)?.s ? null : { g: 'path' }));
  path(14, 40, 40, 41); // beach to the village
  path(39, 22, 40, 41); // village street
  path(20, 18, 40, 19); // to the lighthouse hill
  path(40, 32, 62, 33); // to the training ring and the pier

  // ---------- Plaża Powitalna (south-west) ----------
  m.spawn = [18, 44];
  m.sign(
    15,
    42,
    'Witaj na wyspie!',
    'Chodzisz klawiszami WASD albo przeciągając palcem po ekranie. Shift albo mocne wychylenie palca to bieg. Kapitan Bosman czeka w wiosce.',
  );
  m.sprinkle([8, 36, 30, 54], ['palm-a', 'palm-b'], 0.05, ['sand'], 5004, { spacing: 2 });

  // ---------- Wioska Rybacka ----------
  m.place('chatka-a', 32, 28, { force: true });
  m.place('chatka-c', 46, 28, { force: true });
  m.place('stragan-owoce', 34, 37, { force: true });
  m.sign(
    42,
    37,
    'Wioska Rybacka',
    'Z ludźmi rozmawiasz klawiszem E albo dotykając ekranu. Klawisz I otwiera panel Buda, klawisz M mapę.',
  );
  for (const [x, y] of [
    [26, 34],
    [52, 24],
    [28, 22],
    [54, 36],
  ] as const)
    m.place('palm-a|palm-b|palm-c', x, y);

  // ---------- Wzgórze Latarni (north-west) ----------
  m.rect([12, 10, 24, 20], (x, y) => (m.get(x, y)?.s ? null : { g: 'rock' }));
  for (const [x, y] of [
    [13, 12],
    [22, 11],
    [12, 18],
  ] as const)
    m.place('rock-dark|rock-dark-b', x, y);
  m.sign(
    24,
    17,
    'Wzgórze Latarni',
    'Stąd widać całą wyspę. Skrytki są niewidoczne, dopóki nie podejdziesz blisko: rozglądaj się!',
  );

  // ---------- Ring Treningowy (east): a fenced square with a gap ----------
  const [rx0, ry0, rx1, ry1] = [48, 38, 58, 46];
  for (let x = rx0; x <= rx1; x++)
    for (const y of [ry0, ry1])
      if (!(y === ry0 && (x === 53 || x === 52 || x === 54)))
        m.set(x, y, { g: 'sand', p: 'fence-post', s: true });
  for (let y = ry0; y <= ry1; y++)
    for (const x of [rx0, rx1]) m.set(x, y, { g: 'sand', p: 'fence-post', s: true });
  m.rect([rx0 + 1, ry0 + 1, rx1 - 1, ry1 - 1], { g: 'sand' });
  path(52, 33, 54, 37);
  m.sign(
    60,
    40,
    'Ring Treningowy',
    'Pojedynek: ruchy wybierasz klawiszami 1–4, Esc to ucieczka. Broń w ręku daje inne ciosy.',
  );

  // ---------- Pomost (east): planks over the water to the boat ----------
  for (let x = 60; x < W; x++)
    for (const y of [31, 32, 33])
      m.set(x, y, {
        g: 'planks',
        p: y === 32 && x === W - 6 ? 'lodz' : undefined,
        s: y === 32 && x === W - 6 ? true : undefined,
      });
  m.rect([60, 31, W - 1, 33], (x, y) => (m.get(x, y)?.p ? null : { g: 'planks' }));
  m.exit([W - 1, 31, W - 1, 33], 'miasto-ziomkow');
  m.sign(
    61,
    30,
    'Rejs do miasta',
    'Łódź do Miasta Ziomków odpływa, gdy Kapitan Bosman uzna, że jesteś gotów.',
  );

  // a few more trees and flowers on the grass
  m.sprinkle([20, 20, 60, 44], ['tree-b', 'bush-a', 'paproc'], 0.03, ['grass', 'grass2'], 5005, {
    spacing: 2,
  });
  void r;

  // ---------- zones ----------
  m.zone([6, 36, 30, 56], 'Plaża Powitalna');
  m.zone([26, 20, 56, 40], 'Wioska Rybacka');
  m.zone([8, 6, 26, 22], 'Wzgórze Latarni');
  m.zone([46, 36, 60, 48], 'Ring Treningowy');
  m.zone([60, 28, W - 1, 36], 'Pomost');

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
    { name: 'grass', kinds: 'grass grass2 path rock', radius: 2.2, bands: [[0.5, '#8ed16a']] },
    { name: 'grass2', kinds: 'grass2', radius: 2.2, bands: [[0.3, '#82c75f']] },
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
    { ground: 'sand', chance: 0.04, props: 'muszle|rozgwiazda|muszle' },
    { ground: 'grass', chance: 0.04, props: 'hibiskus|tuft' },
    { ground: 'grass2', chance: 0.12, props: 'tuft|hibiskus' },
  );
  return m;
}
