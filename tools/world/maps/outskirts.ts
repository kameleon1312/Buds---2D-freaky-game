// The outskirts every district gained when the maps grew from 128×96 to 176×132: new places to the east and south,
// joined to the old town by roads, with plots (m.plot) kept clear for the quests, NPCs and attractions to come.
// The old part keeps its coordinates, so everything placed there before stays where it was.
import { MapCanvas, noise2, rng, type Rect } from './lib';
import * as places from './places';

/** A street of `width` cells (no dashes) — a thin wrapper so each district reads the same. */
const street = (m: MapCanvas, axis: 'h' | 'v', from: number, to: number, at: number, width = 2) =>
  m.road(axis, from, to, at, width, { sidewalk: true, dashes: false });

/** A ribbon of ground `g` (a path or a cobbled lane) that keeps whatever already blocks. */
function lane(m: MapCanvas, r: Rect, g: string) {
  m.rect(r, (x, y) => (m.get(x, y)?.s ? null : { g }));
}

export function miastoZiomkowOutskirts(m: MapCanvas) {
  const W = m.w;
  const H = m.h;
  const r = rng(1101);
  // a ring street around the new quarters
  street(m, 'h', 6, W - 7, 108);
  street(m, 'v', 8, H - 8, 150);

  // ---------- Nowe Osiedle (north-east): new blocks along a street ----------
  m.rect([130, 10, 172, 44], (x, y) => (m.get(x, y)?.s ? null : { g: 'grass' }));
  street(m, 'h', 128, W - 7, 40);
  for (let x = 134; x + 6 <= 170; x += 9)
    m.place(['blok-a', 'blok-b', 'blok-c'][Math.floor(r() * 3)]!, x + 3, 37, {
      ground: 'sidewalk',
    });
  m.sprinkle([130, 10, 172, 32], ['tree-a', 'tree-b', 'bush-a', 'bench'], 0.06, ['grass'], 1102, {
    spacing: 1,
  });
  m.zone([128, 8, 174, 46], 'Nowe Osiedle');
  m.sign(
    146,
    41,
    'Nowe Osiedle',
    'Świeże bloki, nowi sąsiedzi. Wkrótce: więcej zadań od mieszkańców.',
  );

  // ---------- Stadion and Lunapark: plots for attractions ----------
  places.stadion(m);
  m.zone([130, 52, 170, 80], 'Stadion');
  m.sign(149, 52, 'Stadion Ziomków', 'Boisko, trybuny i doping. Trenerka Kasia szuka zawodników.');
  places.lunapark(m);
  m.zone([132, 110, 172, 128], 'Lunapark');
  m.sign(151, 111, 'Lunapark', 'Karuzela, diabelski młyn i wata cukrowa. Bilety u Pana Leszka.');

  // ---------- Port Rzeczny (south-west): a river with a quay ----------
  m.rect([4, 120, 124, 126], { g: 'water', s: true });
  m.rect([4, 114, 124, 119], (x, y) => (m.get(x, y)?.s ? null : { g: 'sand' }));
  for (const x of [20, 36, 52, 84, 100]) m.rect([x, 120, x + 1, 124], { g: 'path' });
  m.zone([4, 110, 124, 128], 'Port Rzeczny');
  m.sign(30, 113, 'Port Rzeczny', 'Barki, wędkarze i stare magazyny. Wkrótce: rejsy po rzece.');
  // the avenue to Dwór Carski crosses on a bridge
  m.road('v', 109, H - 1, 62, 4, { sidewalk: false });

  // ---------- Bazar Miejski and a square for new quests ----------
  places.bazarMiejski(m);
  m.zone([68, 96, 120, 106], 'Bazar Miejski');
  m.sign(94, 97, 'Bazar Miejski', 'Owoce, ciuchy i graty. Pani Grażyna zna ceny wszystkiego.');
  places.placZiomkow(m);
  m.zone([8, 94, 54, 106], 'Plac Ziomków');
  m.sign(
    30,
    95,
    'Plac Ziomków',
    'Scena dla całego miasta. W piątek koncert, jeśli sprzęt dojedzie.',
  );
}

export function lasPalmasOutskirts(m: MapCanvas) {
  const W = m.w;
  const H = m.h;
  const nz = noise2(2101, 6);
  // the jungle grows east; trails lead to the new places
  m.rect([126, 6, W - 6, 96], (x, y) =>
    m.get(x, y)?.s ? null : { g: nz(x, y) > 0.55 ? 'jungle' : 'grass2' },
  );
  m.sprinkle(
    [126, 6, W - 6, 96],
    ['jungle-a', 'jungle-b', 'palm-a', 'palm-b'],
    0.08,
    ['jungle', 'grass2'],
    2102,
    { spacing: 1 },
  );
  lane(m, [120, 40, W - 8, 41], 'path');
  lane(m, [150, 20, 151, H - 10], 'path');
  lane(m, [20, 104, W - 8, 105], 'path');

  places.wodospad(m);
  m.zone([132, 16, 168, 36], 'Wodospad');
  m.sign(150, 37, 'Wodospad', 'Huk wody słychać z daleka. Kąpiel na własną odpowiedzialność.');
  places.wioskaTiki(m);
  m.zone([130, 54, 170, 80], 'Wioska Tiki');
  m.sign(149, 55, 'Wioska Tiki', 'Chaty wokół ogniska. Wódz Makoa wita każdego gościa.');

  // ---------- Zatoka Żółwi (south): a long beach and a small bay ----------
  m.rect([14, 98, 124, H - 6], (x, y) => (m.get(x, y)?.s ? null : { g: 'sand' }));
  m.blob(36, 118, 12, 6, 2103, (x, y) => m.set(x, y, { g: 'water', s: true }));
  m.zone([12, 96, 126, H - 4], 'Zatoka Żółwi');
  m.sign(60, 103, 'Zatoka Żółwi', 'Tu żółwie składają jaja. Wkrótce: wyprawy z przewodnikiem.');
  places.przystan(m);
  m.zone([82, 108, 122, 126], 'Przystań Jachtowa');
  m.sign(
    102,
    109,
    'Przystań Jachtowa',
    'Łodzie, sieci i zapach ryb. Żeglarka Marina zna każdą falę.',
  );
  // the road back to Miasto Ziomków crosses the beach
  lane(m, [62, 96, 65, H - 1], 'path');
}

export function dworCarskiOutskirts(m: MapCanvas) {
  const W = m.w;
  const H = m.h;
  // cobbled lanes into the new estates
  lane(m, [8, 96, W - 8, 97], 'cobble');
  lane(m, [126, 8, 127, H - 8], 'cobble');

  // ---------- Winnice (east): rows of vines ----------
  m.rect([132, 10, 170, 48], (x, y) => (m.get(x, y)?.s ? null : { g: 'lawn2' }));
  for (let y = 14; y <= 44; y += 4)
    for (let x = 134; x <= 168; x++)
      if (x % 9 !== 0) m.place('bush-a|bush-b', x, y, { grounds: ['lawn2'] });
  m.zone([130, 8, 172, 50], 'Winnice');
  m.sign(129, 30, 'Winnice', 'Winogrona dworu. Wkrótce: zbiory i degustacje.');

  places.torWyscigow(m);
  m.zone([130, 56, 170, 92], 'Tor Wyścigów');
  m.sign(
    129,
    74,
    'Tor Wyścigów Konnych',
    'Owalny tor wokół stajni. Dżokejka Róża mierzy czas okrążeń.',
  );

  // ---------- Jezioro Dworskie (south) and the old mill ----------
  m.blob(44, 114, 16, 8, 3101, (x, y) => m.set(x, y, { g: 'water', s: true }));
  m.zone([18, 100, 72, 126], 'Jezioro Dworskie');
  m.sign(44, 101, 'Jezioro Dworskie', 'Łabędzie i łódki hrabiego. Wkrótce: rejsy po jeziorze.');
  places.staryMlyn(m);
  m.zone([86, 100, 124, 126], 'Stary Młyn');
  m.sign(105, 101, 'Stary Młyn', 'Młynarz zniknął bez śladu. Jego córka Hania szuka pomocy.');
  places.oranzeria(m);
  m.zone([138, 100, 166, 124], 'Oranżeria');
  m.sign(
    152,
    101,
    'Oranżeria',
    'Szklany pawilon z roślinami z całego świata. Zielarka Bogna zna każdą z nich.',
  );
}

export function losKarkosOutskirts(m: MapCanvas) {
  const W = m.w;
  const H = m.h;
  m.road('h', 20, W - 8, 98, 3, { sidewalk: false, dashes: false });
  m.road('v', 8, H - 8, 126, 3, { sidewalk: false, dashes: false });

  places.staraKopalnia(m);
  m.zone([130, 8, 170, 42], 'Stara Kopalnia');
  m.sign(
    130,
    25,
    'Stara Kopalnia',
    'Szyby zamknięte od lat, ale ktoś tu ciągle kopie. Górnik Stefan pilnuje wejścia.',
  );
  places.torMotocross(m);
  m.zone([130, 52, 170, 86], 'Tor Motocrossowy');
  m.sign(130, 69, 'Tor Motocrossowy', 'Błoto i skocznie. Iga mierzy czas, Brudas łamie zasady.');

  // ---------- Port Przemytników (south): a sludge dock ----------
  m.rect([4, 116, 96, 126], { g: 'sludge', s: true });
  for (const x of [16, 40, 64, 88]) m.rect([x, 116, x + 2, 122], { g: 'concrete' });
  m.zone([4, 102, 96, 128], 'Port Przemytników');
  m.sign(
    50,
    104,
    'Port Przemytników',
    'Nocą przypływają łodzie bez świateł. Wkrótce: misje przemytnicze.',
  );
  places.ruinyElektrowni(m);
  m.zone([100, 100, 152, 126], 'Ruiny Elektrowni');
  m.sign(126, 101, 'Ruiny Elektrowni', 'Coś tu wciąż buczy. Inżynierka Wera chce wiedzieć co.');
}
