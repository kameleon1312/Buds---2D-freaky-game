// The places built on the plots the outskirts kept clear (m.plot): stadium, funfair, market and square in Miasto
// Ziomków; waterfall, tiki village and marina in Las Palmas; racecourse, old mill and orangery in Dwór Carski; the
// mine, the motocross track and the power plant ruins in Los Karkos. Each builder stays inside its old plot, keeps
// a way through on foot and leaves open ground where the place's people and quest items stand
// (packages/shared/src/content/<district>.ts refers to these cells).
import { type MapCanvas, type Rect } from './lib';

/** Ground everywhere in the rectangle (keeps nothing that was there). */
const paint = (m: MapCanvas, r: Rect, g: string) => m.rect(r, { g });
/** Ground only where nothing blocks. */
const lay = (m: MapCanvas, r: Rect, g: string) =>
  m.rect(r, (x, y) => (m.get(x, y)?.s ? null : { g }));
/** Props in a row every `step` cells, skipping cells that are taken. */
function row(
  m: MapCanvas,
  names: string[],
  x0: number,
  x1: number,
  y: number,
  step: number,
  seed = 0,
) {
  let i = seed;
  for (let x = x0; x <= x1; x += step) m.place(names[i++ % names.length]!, x, y);
}

// ---------- Miasto Ziomków ----------

/** Stadion Ziomków [132,54,168,78]: a pitch with lines and goals, two stands and the scoreboard. */
export function stadion(m: MapCanvas) {
  paint(m, [132, 54, 168, 78], 'plaza');
  // the pitch, goals at the north and south ends
  paint(m, [141, 59, 159, 76], 'grass');
  for (let x = 141; x <= 159; x++) {
    m.place('linia-boiska-h', x, 60, { force: true });
    m.place('linia-boiska-h', x, 75, { force: true });
  }
  for (let y = 61; y <= 74; y++) {
    m.place('linia-boiska-v', 141, y, { force: true });
    m.place('linia-boiska-v', 159, y, { force: true });
  }
  for (let x = 142; x <= 158; x++)
    if (x < 148 || x > 152) m.place('linia-boiska-h', x, 67, { force: true });
  m.place('kolo-srodkowe', 150, 69, { force: true });
  m.place('bramka', 150, 59, { force: true });
  m.place('bramka', 150, 76, { force: true });
  // stands and the scoreboard behind the north goal
  m.place('trybuna', 144, 57, { force: true });
  m.place('trybuna', 156, 57, { force: true });
  m.place('tablica-wynikow', 150, 57, { force: true });
  // lamps at the corners, benches for the subs
  for (const [x, y] of [
    [136, 58],
    [164, 58],
    [136, 77],
    [164, 77],
  ] as const)
    m.place('lamp', x, y);
  for (const y of [63, 66, 70, 73]) m.place('bench', 138, y);
  m.place('bin', 138, 76);
  m.place('hydrant', 164, 70);
}

/** Lunapark [134,112,170,126]: a carousel, the ferris wheel, candy floss, balloons and benches. */
export function lunapark(m: MapCanvas) {
  paint(m, [134, 112, 170, 126], 'concrete');
  m.place('karuzela', 142, 121, { force: true });
  m.place('diabelski-mlyn', 163, 121, { force: true });
  m.place('budka-wata', 152, 117, { force: true });
  for (const [x, y] of [
    [148, 124],
    [157, 124],
    [138, 115],
    [168, 115],
  ] as const)
    m.place('balony', x, y);
  for (const x of [146, 150, 154, 158]) m.place('bench', x, 113);
  for (const [x, y] of [
    [136, 113],
    [168, 125],
    [136, 125],
  ] as const)
    m.place('lamp', x, y);
  m.place('bin', 160, 113);
}

/** Bazar Miejski [70,98,118,104]: two rows of stalls with an aisle between them. */
export function bazarMiejski(m: MapCanvas) {
  paint(m, [70, 98, 118, 104], 'plaza');
  row(m, ['bazar-a', 'stragan-owoce', 'bazar-b'], 73, 115, 99, 5);
  row(m, ['bazar-b', 'bazar-a', 'stragan-owoce'], 75, 113, 104, 5, 1);
  for (const x of [71, 117]) m.place('lamp', x, 101);
  m.place('skrzynka', 96, 101);
}

/** Plac Ziomków [10,96,52,104]: a stage, benches facing it and a fountain. */
export function placZiomkow(m: MapCanvas) {
  paint(m, [10, 96, 52, 104], 'plaza');
  m.place('scena', 31, 98, { force: true });
  for (const x of [25, 28, 34, 37]) m.place('bench', x, 102);
  m.place('fontanna', 46, 101, { force: true });
  for (const [x, y] of [
    [12, 97],
    [50, 97],
    [12, 104],
    [24, 97],
    [38, 97],
  ] as const)
    m.place('lamp', x, y);
  m.place('planter', 16, 100);
  m.place('planter', 20, 100);
}

// ---------- Las Palmas ----------

/** Wodospad [134,18,166,34]: the waterfall over a lagoon, ferns and rocks around it. */
export function wodospad(m: MapCanvas) {
  lay(m, [134, 18, 166, 34], 'grass2');
  m.place('wodospad', 150, 23, { force: true });
  for (const [x, y] of [
    [142, 21],
    [158, 21],
    [140, 26],
    [161, 27],
    [145, 31],
    [156, 31],
  ] as const)
    m.place(['rock-a', 'rock-b', 'paproc'][(x + y) % 3]!, x, y);
  m.sprinkle([134, 18, 166, 34], ['paproc', 'jungle-a', 'hibiskus'], 0.05, ['grass2'], 4101, {
    spacing: 2,
  });
}

/** Wioska Tiki [132,56,168,78]: huts around a fire, totems and torches. */
export function wioskaTiki(m: MapCanvas) {
  lay(m, [132, 56, 168, 78], 'sand');
  m.place('chatka-a', 140, 62, { force: true });
  m.place('chatka-b', 160, 62, { force: true });
  m.place('chatka-c', 140, 75, { force: true });
  m.place('chatka-a', 160, 75, { force: true });
  m.place('ognisko', 150, 68, { force: true });
  for (const [x, y] of [
    [146, 64],
    [154, 64],
    [146, 72],
    [154, 72],
  ] as const)
    m.place('totem', x, y);
  for (const [x, y] of [
    [135, 58],
    [165, 58],
    [135, 77],
    [165, 77],
  ] as const)
    m.place('pochodnia', x, y);
  m.place('palm-a', 134, 67);
  m.place('palm-b', 166, 67);
}

/** Przystań Jachtowa [84,110,120,124]: a pier into the bay, boats and a marina hut. */
export function przystan(m: MapCanvas) {
  lay(m, [84, 110, 120, 118], 'sand');
  m.rect([84, 119, 120, 124], { g: 'ocean', s: true });
  // the pier
  m.rect([100, 114, 103, 124], { g: 'planks' });
  for (const [x, y] of [
    [94, 121],
    [110, 122],
    [88, 123],
  ] as const)
    m.place('lodz', x, y, { force: true });
  m.place('chatka-b', 92, 115, { force: true });
  m.place('deski-surf', 110, 114);
  m.place('parasol-a', 114, 112);
  m.place('lezak-a', 116, 113);
  m.place('lezak-b', 117, 115);
}

// ---------- Dwór Carski ----------

/** Tor Wyścigów [132,58,168,90]: an oval dirt track inside a fence, a lawn in the middle with hay and carriages. */
export function torWyscigow(m: MapCanvas) {
  lay(m, [132, 58, 168, 90], 'dirt');
  // the infield: lawn behind a low fence, gaps on the west and east so riders can cross
  paint(m, [140, 66, 160, 82], 'lawn');
  for (let x = 140; x <= 160; x++) {
    if (x !== 150) {
      m.place('fence-post', x, 66);
      m.place('fence-post', x, 82);
    }
  }
  for (let y = 67; y <= 81; y++) {
    if (y < 73 || y > 75) {
      m.place('fence-post', 140, y);
      m.place('fence-post', 160, y);
    }
  }
  m.place('stajnia', 150, 71, { force: true });
  for (const [x, y] of [
    [144, 78],
    [146, 78],
    [155, 78],
  ] as const)
    m.place('siano', x, y);
  m.place('powoz', 150, 79, { force: true });
  for (const [x, y] of [
    [134, 60],
    [166, 60],
    [134, 88],
    [166, 88],
  ] as const)
    m.place('latarnia-gaz', x, y);
}

/** Stary Młyn [88,102,122,124]: the mill by a stream, sacks of flour and a footbridge. */
export function staryMlyn(m: MapCanvas) {
  lay(m, [88, 102, 122, 124], 'gravel');
  // the mill stream runs north–south; a bridge crosses it
  m.rect([114, 102, 115, 124], { g: 'water', s: true });
  m.rect([114, 117, 115, 118], { g: 'cobble' });
  m.place('mlyn', 108, 110, { force: true });
  for (const [x, y] of [
    [100, 112],
    [101, 113],
    [99, 113],
  ] as const)
    m.place('siano', x, y);
  m.place('powoz', 98, 118, { force: true });
  for (const [x, y] of [
    [92, 104],
    [92, 122],
    [120, 104],
    [120, 122],
  ] as const)
    m.place('latarnia-gaz', x, y);
  m.sprinkle([88, 102, 112, 124], ['bush-a', 'tree-b'], 0.03, ['gravel'], 4201, { spacing: 2 });
}

/** Oranżeria [140,102,164,122]: the glasshouse in a formal garden. */
export function oranzeria(m: MapCanvas) {
  lay(m, [140, 102, 164, 122], 'gravel');
  paint(m, [143, 112, 161, 120], 'lawn');
  m.place('szklarnia', 152, 110, { force: true });
  for (const x of [144, 148, 156, 160]) m.place('topiary-kula', x, 114);
  for (const x of [145, 151, 153, 159]) m.place('roze', x, 118);
  m.place('posag', 152, 117);
  for (const [x, y] of [
    [141, 103],
    [163, 103],
    [141, 121],
    [163, 121],
  ] as const)
    m.place('latarnia-gaz', x, y);
}

// ---------- Los Karkos ----------

/** Stara Kopalnia [132,10,168,40]: the shaft in a rock face, rails out of it, carts and spoil heaps. */
export function staraKopalnia(m: MapCanvas) {
  lay(m, [132, 10, 168, 40], 'dirt');
  m.place('wejscie-kopalni', 150, 17, { force: true });
  for (let y = 18; y <= 34; y++) m.place('rails-v', 150, y, { force: true });
  for (const [x, y] of [
    [150, 26],
    [150, 31],
  ] as const)
    m.place('wagonik', x, y, { force: true });
  for (const [x, y] of [
    [138, 14],
    [162, 14],
    [136, 22],
    [164, 22],
    [140, 33],
    [160, 35],
  ] as const)
    m.place(['rock-dark', 'rock-dark-b', 'gruz'][(x + y) % 3]!, x, y);
  m.place('zlom', 141, 27, { force: true });
  m.place('beczka-ogien', 158, 28);
}

/** Tor Motocrossowy [132,54,168,84]: dirt jumps on a loop, tyres and wrecks along it. */
export function torMotocross(m: MapCanvas) {
  lay(m, [132, 54, 168, 84], 'dirt');
  for (const [x, y] of [
    [142, 60],
    [158, 60],
    [164, 70],
    [158, 80],
    [142, 80],
    [136, 70],
  ] as const)
    m.place('skocznia-cross', x, y, { force: true });
  for (let x = 146; x <= 154; x += 2) {
    m.place('opony', x, 66);
    m.place('opony', x, 74);
  }
  m.place('wrak-a', 150, 70, { force: true });
  m.place('beczka-ogien', 134, 56);
}

/** Ruiny Elektrowni [102,102,150,124]: two chimneys, a transformer, broken walls and rubble. */
export function ruinyElektrowni(m: MapCanvas) {
  lay(m, [102, 102, 150, 124], 'concrete');
  m.place('komin', 112, 110, { force: true });
  m.place('komin', 140, 110, { force: true });
  m.place('transformator', 126, 108, { force: true });
  m.place('ruina-a', 112, 122, { force: true });
  m.place('ruina-b', 140, 122, { force: true });
  m.sprinkle([102, 102, 150, 124], ['gruz', 'zlom', 'opony'], 0.02, ['concrete'], 4301, {
    spacing: 2,
  });
}
