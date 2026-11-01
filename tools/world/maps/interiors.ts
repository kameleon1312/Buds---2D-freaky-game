// Interiors: rooms you enter through a building's door (the [doors] section of a district map). Each room is a
// small map of its own: dark void around, a back wall row of wall tiles in the building's theme, side and front
// walls, floor decals, furniture, and a doormat in the middle of the front wall that leads back outside.
//
// Room ids are `<district>-<place>`; the district map registers the door with `m.door(anchor, id, name)`.
import { MapCanvas } from './lib';

type Theme =
  'kawiarnia' | 'komisariat' | 'garaz' | 'chatka' | 'dworek' | 'urzad' | 'silownia' | 'ruina';
type Floor = 'deski' | 'deski-stare' | 'parkiet' | 'kafle' | 'beton' | 'guma';

const FLOOR_COLOR: Record<Floor, string> = {
  deski: '#c99a62',
  'deski-stare': '#8f7556',
  parkiet: '#b07a48',
  kafle: '#d9dde3',
  beton: '#9da3ad',
  guma: '#3a3d4a',
};

type Furniture = [name: string, x: number, y: number];

function room(
  id: string,
  name: string,
  outside: string,
  w: number,
  h: number,
  theme: Theme,
  floor: Floor,
  furniture: Furniture[],
  /** Back wall tile for column x: plain, window or picture. */
  wallAt: (x: number) => 'a' | 'okno' | 'obraz' = (x) =>
    x % 4 === 3 ? 'okno' : x % 4 === 1 ? 'obraz' : 'a',
): MapCanvas {
  if (w % 2 === 0) throw new Error(`${id}: room width must be odd (the door is in the middle)`);
  const m = new MapCanvas(id, name, w, h, 'void');
  m.kind = 'interior';
  m.source = 'interiors.ts';
  m.outside = outside;
  m.base = '#121218';
  const cx = (w - 1) / 2;

  m.each((x, y) => {
    if (y === 0) m.set(x, y, { g: 'void', s: true });
    else if (x === 0 || x === w - 1 || y === h - 1) m.set(x, y, { g: 'wall', s: true });
    else if (y === 1) m.set(x, y, { g: 'wall', p: `sciana-${theme}-${wallAt(x)}`, s: true });
    else m.set(x, y, { g: 'floor' });
  });
  // the way out: a doormat in the front wall
  for (let x = cx - 1; x <= cx + 1; x++) m.set(x, h - 1, { g: 'floor' });
  m.set(cx, h - 1, { g: 'floor', p: 'wycieraczka' });
  m.exit([cx - 1, h - 1, cx + 1, h - 1], outside);
  m.spawn = [cx, h - 2];

  for (const [prop, x, y] of furniture)
    if (!m.place(prop, x, y)) throw new Error(`${id}: ${prop} at ${x},${y} doesn't fit`);
  // floor seams on every free floor cell (furniture covers its own)
  m.each((x, y, c) => {
    if (c.g === 'floor' && !c.p && !c.s) c.p = `podloga-${floor}`;
  });

  m.zone([1, 2, w - 2, h - 2], name);
  m.ground.push(
    { name: 'wall', kinds: 'wall', radius: 0.4, bands: [[0.5, '#3a3542']] },
    {
      name: 'floor',
      kinds: 'floor',
      radius: 0.4,
      bands: [[0.5, FLOOR_COLOR[floor]]],
    },
  );
  return m;
}

export function interiors(): MapCanvas[] {
  return [
    room(
      'miasto-ziomkow-kawiarnia',
      'Kawiarnia „Ziomal”',
      'miasto-ziomkow',
      15,
      11,
      'kawiarnia',
      'parkiet',
      [
        ['lada', 4, 3],
        ['regal-sloiki', 2, 2],
        ['regal-sloiki', 7, 2],
        ['roslina', 13, 2],
        ['stolik', 9, 5],
        ['krzeslo', 8, 5],
        ['krzeslo', 10, 5],
        ['stolik', 12, 5],
        ['krzeslo', 13, 5],
        ['stolik', 9, 8],
        ['krzeslo', 8, 8],
        ['krzeslo', 10, 8],
        ['stolik', 12, 8],
        ['krzeslo', 13, 8],
        ['dywan-zielony', 3, 8],
        ['lampa-stojaca', 1, 9],
      ],
    ),
    room(
      'miasto-ziomkow-komisariat',
      'Komisariat',
      'miasto-ziomkow',
      17,
      11,
      'komisariat',
      'kafle',
      [
        ['biurko', 4, 4],
        ['krzeslo-metal', 4, 3],
        ['biurko', 10, 4],
        ['krzeslo-metal', 10, 3],
        ['szafka', 1, 2],
        ['szafka', 2, 2],
        ['dystrybutor', 7, 2],
        ['regal-ksiazki', 13, 2],
        ['roslina', 15, 2],
        ['krata', 11, 7],
        ['krata', 12, 7],
        ['krata', 14, 7],
        ['krata', 15, 7],
        ['krata', 11, 8],
        ['krata', 11, 9],
        ['lozko-a', 15, 9],
        ['krzeslo-metal', 1, 6],
        ['krzeslo-metal', 1, 7],
      ],
    ),
    room('miasto-ziomkow-garaz', 'Garaż Rysia', 'miasto-ziomkow', 11, 9, 'garaz', 'beton', [
      ['warsztat', 2, 2],
      ['regal-narzedzia', 8, 2],
      ['regal-narzedzia', 9, 2],
      ['auto-c', 5, 5],
      ['opony', 1, 7],
      ['skrzynka', 9, 7],
    ]),
    room(
      'las-palmas-chatka',
      'Chatka rybaka',
      'las-palmas',
      11,
      9,
      'chatka',
      'deski',
      [
        ['lozko-b', 2, 3],
        ['deski-surf', 7, 2],
        ['skrzynka', 9, 3],
        ['dywan-plecionka', 5, 6],
        ['stolik-kwadrat', 8, 6],
        ['krzeslo', 9, 6],
        ['roslina', 1, 7],
      ],
      (x) => (x % 3 === 2 ? 'okno' : x === 5 ? 'obraz' : 'a'),
    ),
    room(
      'dzika-puszcza-chata',
      'Chata Leśniczego',
      'dzika-puszcza',
      13,
      9,
      'chatka',
      'deski-stare',
      [
        ['kominek', 6, 2],
        ['lozko-a', 2, 3],
        ['regal-narzedzia', 10, 2],
        ['dywan-zielony', 6, 5],
        ['stolik-kwadrat', 9, 6],
        ['krzeslo', 10, 6],
        ['skrzynka', 11, 7],
        ['roslina', 1, 7],
      ],
      (x) => (x % 4 === 1 ? 'okno' : x === 6 ? 'obraz' : 'a'),
    ),
    room('dwor-carski-dworek', 'Salon dworku', 'dwor-carski', 19, 13, 'dworek', 'parkiet', [
      ['kominek', 9, 2],
      ['fotel', 7, 4],
      ['fotel', 11, 4],
      ['dywan-czerwony', 9, 6],
      ['stol-dlugi', 9, 9],
      ['krzeslo', 6, 9],
      ['krzeslo', 12, 9],
      ['zegar', 2, 2],
      ['regal-ksiazki', 4, 2],
      ['regal-ksiazki', 5, 2],
      ['regal-ksiazki', 13, 2],
      ['regal-ksiazki', 14, 2],
      ['roslina', 17, 2],
      ['roslina', 1, 11],
      ['lampa-stojaca', 17, 11],
    ]),
    room('dwor-carski-urzad', 'Urząd Skarbowy', 'dwor-carski', 15, 11, 'urzad', 'kafle', [
      ['biurko', 3, 5],
      ['krzeslo-metal', 3, 4],
      ['biurko', 7, 5],
      ['krzeslo-metal', 7, 4],
      ['biurko', 11, 5],
      ['krzeslo-metal', 11, 4],
      ['szafka-zielona', 1, 2],
      ['szafka-zielona', 2, 2],
      ['sejf', 7, 2],
      ['szafka-zielona', 12, 2],
      ['szafka-zielona', 13, 2],
      ['dystrybutor', 1, 9],
      ['roslina', 13, 9],
    ]),
    room(
      'chinatown-herbaciarnia',
      'Herbaciarnia „Cicha Woda”',
      'chinatown',
      15,
      11,
      'chatka',
      'parkiet',
      [
        ['stolik', 3, 4],
        ['krzeslo', 3, 5],
        ['stolik', 11, 4],
        ['krzeslo', 11, 5],
        ['stolik', 3, 8],
        ['stolik', 11, 8],
        ['roslina', 1, 2],
        ['roslina', 13, 2],
        ['skrzynka', 7, 2],
      ],
    ),
    room('chinatown-dojo', 'Dojo Starego Wei', 'chinatown', 17, 11, 'silownia', 'deski', [
      ['worek-bokserski', 3, 4],
      ['worek-bokserski', 13, 4],
      ['hantle', 2, 8],
      ['szafka', 14, 2],
      ['szafka', 15, 2],
      ['roslina', 1, 2],
    ]),
    room('los-karkos-silownia', 'Siłownia „Żelazo”', 'los-karkos', 17, 11, 'silownia', 'guma', [
      ['lawka-sztanga', 3, 4],
      ['lawka-sztanga', 3, 8],
      ['hantle', 12, 2],
      ['worek-bokserski', 8, 4],
      ['worek-bokserski', 10, 4],
      ['szafka', 14, 2],
      ['szafka', 15, 2],
      ['dystrybutor', 1, 2],
      ['opony', 15, 8],
    ]),
    room(
      'los-karkos-ruina',
      'Opuszczone mieszkanie',
      'los-karkos',
      13,
      9,
      'ruina',
      'deski-stare',
      [
        ['kanapa-stara', 6, 3],
        ['telewizor', 6, 6],
        ['skrzynka', 2, 2],
        ['lozko-a', 11, 7],
        ['gruz', 1, 6],
        ['gruz', 10, 3],
        ['smieci', 9, 7],
        ['kaluza', 3, 6],
      ],
      (x) => (x % 4 === 2 ? 'okno' : 'a'),
    ),
  ];
}
