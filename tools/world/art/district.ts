// Dystrykty (docs/dystrykty.md): the buildings a bud puts up in its district on a wasteland plot, in the style of the
// land around it: timber, glass and green roofs by the forest (las), white stucco, turquoise and palm thatch on the
// dunes towards Las Palmas (tropik), cream walls, red brick and terracotta on the old road to Dwór Carski (dwor),
// corrugated steel, rust and hazard orange on the scrapland towards Los Karkos (zlom). Every style has the same
// buildings: the town hall growing from a pavilion to an office block to a tower, apartment blocks, a vertical farm,
// a solar farm, a concrete plant, steel recycling, a logistics centre, and the pieces that make a district admired: a
// square with trees, a fountain, a bronze statue of a bud and the Iglica, a landmark tower seen from the whole
// wasteland. Also per style: the gate sign, the fence, the work site of a sector being cleared; shared: building
// sites with a crane, the board of a plot for sale, the survey stakes at a plot's corners. Same cel style as the rest
// (kit.ts): base + shade, soft contours, light from the top-left, a contact shadow under everything; no words.
import {
  LEAF,
  LEAF2,
  T,
  circ,
  fill,
  flat,
  frame,
  n,
  poly,
  puffs,
  rng,
  rr,
  shaded,
  shadow,
  stroke,
  windowAt,
  type Prop,
  type Tone,
} from './kit';
import { fenceKit } from './common';

const LINE = '#2f3440';
const CONCRETE: Tone = ['#d9dce1', '#b3b8c1'];
const CONCRETE_DARK: Tone = ['#a9aeb8', '#868c97'];
const GRAPHITE: Tone = ['#4a5160', '#353b47'];
const STEEL: Tone = ['#9aa6b4', '#727f8e'];
const WHITE: Tone = ['#f4f6f8', '#d6dbe1'];
const LIME: Tone = ['#a3e635', '#5d9a12'];
const GOLD: Tone = ['#ffc93c', '#d98a0b'];
const SKY: Tone = ['#8fd3f5', '#5aaee0'];
const BLUE_GLASS: Tone = ['#7cc6ec', '#4a97c8'];
const DARK_GLASS: Tone = ['#3d5a75', '#2a4058'];
const CORAL: Tone = ['#ff7a6b', '#d9564a'];
const WOOD: Tone = ['#c99a6b', '#a07448'];
const BRONZE: Tone = ['#c98a4b', '#8f5a2c'];
const WATER: Tone = ['#7fd6f2', '#45a9d6'];

type Puff = { base: string; dark: string; light: string; line: string };

/** How a style dresses the same buildings. */
type Style = {
  id: 'las' | 'tropik' | 'dwor' | 'zlom';
  /** The main facade, the second material (podiums, blocks), trims and parapets, the dark frame. */
  wall: Tone;
  wall2: Tone;
  trim: Tone;
  dark: Tone;
  /** The district's own colour (flags, beacons, bands) and its contour. */
  accent: Tone;
  accentLine: string;
  /** Coloured panels on the apartment blocks. */
  panels: Tone[];
  glass: Tone;
  glassDark: Tone;
  canopy: Tone;
  /** Planter boxes and what grows in them. */
  box: Tone;
  leaf: Puff;
  /** The ground of a square and the stone of basins and pedestals. */
  paving: Tone;
  stone: Tone;
  fence: Tone;
};

const STYLES: Style[] = [
  {
    id: 'las',
    wall: ['#dcbb8c', '#b38c5c'],
    wall2: ['#c9a272', '#9c7646'],
    trim: ['#f1eee4', '#d2cdbd'],
    dark: ['#3f4a3c', '#2b3429'],
    accent: LIME,
    accentLine: '#2d4a12',
    panels: [['#7fb85a', '#558c3c'], ['#a8774a', '#7f552f'], SKY, GOLD],
    glass: BLUE_GLASS,
    glassDark: DARK_GLASS,
    canopy: ['#5b4a36', '#3f3324'],
    box: ['#a87a4c', '#7c5732'],
    leaf: LEAF,
    paving: ['#d6d3c6', '#b3b0a2'],
    stone: ['#c9c4b6', '#a19c8e'],
    fence: WOOD,
  },
  {
    id: 'tropik',
    wall: ['#fbf7ee', '#e2dac7'],
    wall2: ['#f0dcb2', '#d2b985'],
    trim: ['#ffffff', '#e6e1d4'],
    dark: ['#24797b', '#185a5c'],
    accent: ['#36d1c4', '#16988f'],
    accentLine: '#0f5f5a',
    panels: [CORAL, ['#36d1c4', '#16988f'], ['#ffd65a', '#e0a92a'], ['#ff8fb8', '#d9628c']],
    glass: ['#8fe3ef', '#52bccf'],
    glassDark: ['#2f7f92', '#215e6e'],
    canopy: ['#dcb465', '#b38a3e'],
    box: ['#e9d3a6', '#c7ab76'],
    leaf: { base: '#4fbf5a', dark: '#2f8f45', light: '#7fdc6a', line: '#1f5a30' },
    paving: ['#efdcb6', '#d6be8e'],
    stone: ['#f2e6cc', '#d5c39d'],
    fence: ['#e2c27a', '#c4a05a'],
  },
  {
    id: 'dwor',
    wall: ['#f4e7c9', '#dac89f'],
    wall2: ['#c35b40', '#97402c'],
    trim: ['#fbf6ea', '#e0d6bf'],
    dark: ['#3d4250', '#2a2e38'],
    accent: GOLD,
    accentLine: '#8a5a06',
    panels: [['#3f7a52', '#2b5a3a'], ['#8f2f3c', '#6b1f2a'], GOLD, ['#efe2c2', '#cdbd96']],
    glass: ['#6fa6d0', '#46799f'],
    glassDark: ['#2f4a66', '#20344a'],
    canopy: ['#3f6b4a', '#2c4f36'],
    box: ['#b9634a', '#8f4733'],
    leaf: LEAF2,
    paving: ['#c9765a', '#a65a40'],
    stone: ['#e6dcc6', '#c4b89e'],
    fence: ['#3a3e48', '#24272e'],
  },
  {
    id: 'zlom',
    wall: ['#aab3bc', '#7f8994'],
    wall2: ['#c46c3c', '#944b27'],
    trim: ['#d8dde2', '#a9b0b8'],
    dark: GRAPHITE,
    accent: ['#ff8a1f', '#cc6200'],
    accentLine: '#6b3300',
    panels: [
      ['#ff8a1f', '#cc6200'],
      ['#ffd23f', '#d9a40b'],
      ['#3fb3a8', '#2a8278'],
      ['#e2483f', '#b0302a'],
    ],
    glass: ['#6aa9c9', '#467f9d'],
    glassDark: DARK_GLASS,
    canopy: ['#8a4a2a', '#663419'],
    box: ['#5f6b79', '#46505c'],
    leaf: { base: '#a7a85a', dark: '#7c7d3c', light: '#c8c77a', line: '#4c4b24' },
    paving: ['#7d828b', '#61656d'],
    stone: ['#9aa0a8', '#767c85'],
    fence: STEEL,
  },
];

// ---------- the parts every building is made of ----------

/** A glass curtain wall: a grid of panes with mullions and a soft diagonal sky reflection, clipped to the rectangle. */
let clipIds = 0;
function curtainWall(
  x: number,
  y: number,
  w: number,
  h: number,
  cols: number,
  rows: number,
  glass: Tone,
  mullion = '#e9eef3',
) {
  const id = `cw${clipIds++}`;
  let s = shaded(rr(x, y, w, h, 3), glass, LINE, -4, -3, 2.5);
  s += `<clipPath id="${id}"><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="3"/></clipPath><g clip-path="url(#${id})">`;
  // reflections: two bands across, lighter at the top
  s += fill(
    `M${n(x + w * 0.1)} ${n(y + h)}L${n(x + w * 0.55)} ${n(y)}h${n(w * 0.16)}L${n(x + w * 0.26)} ${n(y + h)}Z`,
    '#ffffff',
    0.2,
  );
  s += fill(
    `M${n(x + w * 0.5)} ${n(y + h)}L${n(x + w * 0.9)} ${n(y)}h${n(w * 0.06)}L${n(x + w * 0.56)} ${n(y + h)}Z`,
    '#ffffff',
    0.12,
  );
  // a few lit panes (the same every export)
  const r = rng(Math.round(x * 7 + y * 13 + w));
  for (let c = 0; c < cols; c++)
    for (let k = 0; k < rows; k++)
      if (r() > 0.86)
        s += fill(
          rr(x + (c * w) / cols + 2, y + (k * h) / rows + 2, w / cols - 4, h / rows - 4, 1),
          '#ffe3a1',
          0.75,
        );
  s += `</g>`;
  let mull = '';
  for (let c = 1; c < cols; c++) mull += `M${n(x + (c * w) / cols)} ${n(y + 1)}V${n(y + h - 1)}`;
  for (let k = 1; k < rows; k++) mull += `M${n(x + 1)} ${n(y + (k * h) / rows)}H${n(x + w - 1)}`;
  s += stroke(mull, mullion, 2.2, 0.85);
  return s;
}

/** What a style does to a plain wall: timber slats, corrugated ribs, nothing on stucco and render. */
function texture(S: Style, x: number, y: number, w: number, h: number) {
  const id = `tx${clipIds++}`;
  let d = '';
  let color = '';
  let width = 1.6;
  let opacity = 0.5;
  if (S.id === 'las') {
    for (let xx = x + 7; xx < x + w - 2; xx += 7) d += `M${n(xx)} ${n(y + 3)}V${n(y + h - 3)}`;
    color = S.wall[1];
  } else if (S.id === 'zlom') {
    for (let xx = x + 5; xx < x + w - 2; xx += 6) d += `M${n(xx)} ${n(y + 2)}V${n(y + h - 2)}`;
    color = '#5f6b79';
    width = 2;
    opacity = 0.45;
  } else return '';
  return `<clipPath id="${id}"><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="3"/></clipPath><g clip-path="url(#${id})">${stroke(d, color, width, opacity)}</g>`;
}

/** A wall of the style's main material with its texture. */
const wall = (S: Style, x: number, y: number, w: number, h: number, tone = S.wall) =>
  shaded(rr(x, y, w, h, 4), tone, LINE, -6, -4) + texture(S, x, y, w, h);

/** A plinth along the bottom: red brick by the manor road, a dark band elsewhere. */
function plinth(S: Style, l: number, r: number, ay: number, h = 14) {
  if (S.id !== 'dwor') return fill(rr(l + 2, ay - h, r - l - 4, h - 2, 2), S.dark[0], 0.35);
  let s = shaded(rr(l, ay - h, r - l, h, 2), S.wall2, LINE, -1, -1, 2);
  let d = '';
  for (let row = 0, yy = ay - h + 5; yy < ay - 2; row++, yy += 5)
    for (let xx = l + (row % 2 ? 2 : 8); xx < r - 4; xx += 12) d += `M${n(xx)} ${n(yy)}h8`;
  s += stroke(d, '#f2d2b8', 1.4, 0.55);
  return s;
}

/** A flat roof edge: a lit parapet, with a terracotta coping by the manor road and hazard stripes on the scrapland. */
function parapet(S: Style, L: number, R: number, y: number) {
  let s =
    shaded(rr(L - 4, y - 8, R - L + 8, 12, 3), S.trim, LINE, -2, -2, 2.5) +
    stroke(`M${n(L)} ${n(y - 5)}H${n(R)}`, '#ffffff', 2, 0.5);
  if (S.id === 'dwor') {
    // a row of round tiles along the top
    s += shaded(rr(L - 6, y - 14, R - L + 12, 8, 3), ['#d36e48', '#a64d2f'], LINE, -1, -1, 2);
    let tiles = '';
    for (let x = L - 2; x < R + 4; x += 10) tiles += `M${n(x)} ${n(y - 7)}q5 -7 10 0`;
    s += stroke(tiles, '#8f3f24', 1.6, 0.7);
  } else if (S.id === 'zlom') {
    const id = `hz${clipIds++}`;
    s += `<clipPath id="${id}"><rect x="${n(L - 4)}" y="${n(y - 8)}" width="${n(R - L + 8)}" height="12" rx="3"/></clipPath><g clip-path="url(#${id})">`;
    let stripes = '';
    for (let x = L - 12; x < R + 8; x += 14) stripes += `M${n(x)} ${n(y + 4)}l12 -12`;
    s += stroke(stripes, '#ffd23f', 6, 0.9) + `</g>`;
  } else if (S.id === 'las') {
    // a green sedum roof peeking over the edge
    s += fill(rr(L - 2, y - 13, R - L + 4, 7, 3), '#7fb85a', 1);
    let tufts = '';
    for (let x = L + 4; x < R - 2; x += 9) tufts += `M${n(x)} ${n(y - 12)}l2 -5l2 5`;
    s += stroke(tufts, '#4f8f3c', 1.8);
  }
  return s;
}

/** A small potted palm (tropik). */
function minipalm(x: number, y: number, size: number, leaf: Puff) {
  let s = stroke(
    `M${n(x)} ${n(y)}q${n(size * 0.15)} ${n(-size)} ${n(size * 0.05)} ${n(-size * 1.6)}`,
    '#8f6339',
    3.5,
  );
  const tx = x + size * 0.05;
  const ty = y - size * 1.6;
  for (const a of [-160, -120, -60, -20, -95]) {
    const r = (a * Math.PI) / 180;
    const ex = tx + Math.cos(r) * size * 1.25;
    const ey = ty + Math.sin(r) * size * 0.6 + size * 0.45;
    s += shaded(
      `M${n(tx)} ${n(ty)}Q${n((tx + ex) / 2)} ${n(ty - size * 0.5)} ${n(ex)} ${n(ey)}Q${n((tx + ex) / 2)} ${n(ty - size * 0.1)} ${n(tx)} ${n(ty)}Z`,
      [leaf.base, leaf.dark],
      leaf.line,
      -1,
      -2,
      1.6,
    );
  }
  return s;
}

/** What grows in a style's planters: shrubs and little conifers, palms, clipped balls on stems, dry grass. */
function plant(S: Style, x: number, y: number, size: number) {
  switch (S.id) {
    case 'tropik':
      return minipalm(x, y, size, S.leaf);
    case 'dwor':
      return (
        stroke(`M${n(x)} ${n(y)}v${n(-size * 0.9)}`, '#6b4229', 3) +
        puffs([[x, y - size * 1.5, size * 0.75]], S.leaf, '', 2)
      );
    case 'zlom': {
      let s = '';
      for (const dx of [-0.5, -0.15, 0.2, 0.5])
        s += stroke(
          `M${n(x + dx * size * 0.6)} ${n(y)}q${n(dx * size * 0.4)} ${n(-size * 0.6)} ${n(dx * size * 0.9)} ${n(-size * 1.1)}`,
          S.leaf.dark,
          2.2,
        );
      return s;
    }
    default:
      return puffs([[x, y - size * 0.9, size * 0.9]], S.leaf, '', 2);
  }
}

/** A row of planters (on a terrace, a roof or a pavement). */
function planters(S: Style, x0: number, x1: number, y: number, size = 8) {
  let s = '';
  for (let x = x0; x <= x1; x += size * 2.6) {
    s += shaded(rr(x - size, y - 6, size * 2, 8, 2), S.box, LINE, -1, -1, 1.6);
    s += plant(S, x, y - 5, size);
  }
  return s;
}

/** A canopy over a door: palm thatch with a fringe on the dunes, a plain slab elsewhere. */
function canopy(S: Style, cx: number, y: number, w: number, tone = S.canopy) {
  if (S.id !== 'tropik') return shaded(rr(cx - w / 2, y, w, 9, 3), tone, LINE, -2, -2, 2);
  let s = shaded(
    poly([
      [cx - w / 2 - 4, y + 10],
      [cx - w / 2 + 6, y - 6],
      [cx + w / 2 - 6, y - 6],
      [cx + w / 2 + 4, y + 10],
    ]),
    S.canopy,
    '#7a5a26',
    -2,
    -2,
    2,
  );
  let fringe = '';
  for (let x = cx - w / 2 - 2; x < cx + w / 2 + 2; x += 5) fringe += `M${n(x)} ${n(y + 9)}l1 6`;
  s += stroke(fringe, '#a07a34', 2);
  return s;
}

/** A glass entrance with sliding doors and a canopy. */
function entrance(S: Style, cx: number, bottom: number, w: number, h: number, tone = S.canopy) {
  let s = fill(rr(cx - w / 2 - 3, bottom - h - 3, w + 6, h + 3, 3), '#1b2030', 0.2);
  s += shaded(rr(cx - w / 2, bottom - h, w, h, 2), SKY, LINE, -2, -2, 2.5);
  s += stroke(`M${n(cx)} ${n(bottom - h + 2)}V${n(bottom - 2)}`, LINE, 2);
  s += stroke(
    `M${n(cx - 5)} ${n(bottom - h * 0.5)}h-4M${n(cx + 5)} ${n(bottom - h * 0.5)}h4`,
    '#e9eef3',
    2.5,
  );
  s += canopy(S, cx, bottom - h - 10, w + 20, tone);
  s += flat(rr(cx - w / 2 - 8, bottom - 4, w + 16, 6, 2), '#cfd4da', LINE, 1.5);
  return s;
}

/** A flag on a pole in the district's colour. */
function flag(S: Style, x: number, bottom: number, top: number) {
  return (
    stroke(`M${n(x)} ${n(bottom)}V${n(top)}`, '#4a5160', 3) +
    shaded(`M${n(x + 1)} ${n(top + 2)}q16 -6 30 2q-14 8 -30 14Z`, S.accent, S.accentLine, -2, -1, 2)
  );
}

// ---------- the town hall: three looks for five levels ----------

/** Level 1: a low glass pavilion in a frame of the style's material, a flag pole and planters. */
function hallPavilion(S: Style): Prop {
  const foot: [number, number] = [3, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 2.9, 0.4);
  let s = shadow(ax, ay - 2, (R - L) / 2 + 10, 14, 0.26);
  const l = L + 4;
  const r = R - 4;
  const top = ay - 1.7 * T;
  s += wall(S, l, top, r - l, ay - top);
  s += curtainWall(l + 10, top + 14, r - l - 20, ay - top - 22, 4, 2, S.glass);
  s += plinth(S, l, r, ay, 10);
  s += parapet(S, l, r, top + 4);
  s += entrance(S, ax, ay - 4, 34, 0.9 * T);
  s += flag(S, r + 10, ay - 4, top - 1.0 * T);
  s += planters(S, l + 6, l + 30, ay - 2, 7);
  return { w, h, ax, ay, foot, body: s };
}

/** Levels 2–3: a three-storey office block, glass bands between slabs, a terrace on top. */
function hallOffice(S: Style): Prop {
  const foot: [number, number] = [3, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 4.8, 0.4);
  let s = shadow(ax, ay - 2, (R - L) / 2 + 12, 15, 0.27);
  const l = L - 2;
  const r = R + 2;
  const floors = 3;
  const fh = 0.92 * T;
  const top = ay - floors * fh - 10;
  s += wall(S, l, top, r - l, ay - top);
  for (let f = 0; f < floors; f++) {
    const y = top + 10 + f * fh;
    s += curtainWall(l + 8, y, r - l - 16, fh - 14, 5, 1, f === 0 ? S.glassDark : S.glass);
    s += fill(rr(l + 2, y + fh - 14, r - l - 4, 6, 1), '#1b2030', 0.12);
  }
  s += plinth(S, l, r, ay, 10);
  s += parapet(S, l, r, top + 4);
  s += planters(S, l + 14, r - 14, top - 4, 8);
  s += entrance(S, ax, ay - 4, 40, 0.82 * T, S.accent);
  s += flag(S, r - 8, top - 6, top - 1.2 * T);
  return { w, h, ax, ay, foot, body: s };
}

/** Levels 4–5: a tower on a podium, a crown with an antenna and a beacon in the district's colour. */
function hallTower(S: Style): Prop {
  const foot: [number, number] = [3, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 8.2, 0.45);
  let s = shadow(ax, ay - 2, (R - L) / 2 + 14, 16, 0.28);
  const podiumTop = ay - 1.1 * T;
  s += wall(S, L - 6, podiumTop, R - L + 12, ay - podiumTop, S.id === 'dwor' ? S.wall : S.wall2);
  s += curtainWall(L + 4, podiumTop + 12, R - L - 8, ay - podiumTop - 18, 5, 1, S.glassDark);
  const tl = ax - 0.78 * T;
  const tr = ax + 0.78 * T;
  const tt = ay - 7.0 * T;
  s += shaded(rr(tl, tt, tr - tl, podiumTop - tt + 6, 4), S.dark, LINE, -6, -4);
  s += curtainWall(tl + 8, tt + 18, tr - tl - 16, podiumTop - tt - 26, 3, 9, S.glass);
  s += stroke(
    `M${n(tl + 4)} ${n(tt + 10)}V${n(podiumTop)}M${n(tr - 4)} ${n(tt + 10)}V${n(podiumTop)}`,
    S.trim[0],
    3,
    0.7,
  );
  if (S.id === 'dwor') {
    // a little gold dome
    s += shaded(
      `M${n(tl + 4)} ${n(tt + 8)}Q${n(ax)} ${n(tt - 0.9 * T)} ${n(tr - 4)} ${n(tt + 8)}Z`,
      GOLD,
      LINE,
      -3,
      -3,
    );
  } else if (S.id === 'tropik') {
    s += canopy(S, ax, tt - 4, tr - tl + 10);
  } else
    s += shaded(
      poly([
        [tl - 6, tt + 12],
        [tl + 10, tt - 20],
        [tr - 10, tt - 20],
        [tr + 6, tt + 12],
      ]),
      S.trim,
      LINE,
      -4,
      -3,
    );
  s += stroke(`M${n(ax)} ${n(tt - 20)}V${n(tt - 1.0 * T)}`, '#4a5160', 3);
  s += shaded(circ(ax, tt - 1.0 * T, 5), S.accent, S.accentLine, -1, -1, 2);
  s += fill(circ(ax, tt - 1.0 * T, 11), S.accent[0], 0.25);
  s += planters(S, L - 2, tl - 10, podiumTop - 2, 7);
  s += planters(S, tr + 12, R + 2, podiumTop - 2, 7);
  s += entrance(S, ax, ay - 4, 44, 0.8 * T, GOLD);
  return { w, h, ax, ay, foot, body: s };
}

// ---------- producers ----------

/** An apartment block: four storeys, balconies with glass rails and flower boxes, coloured panels. */
function apartments(S: Style): Prop {
  const foot: [number, number] = [3, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 5.6, 0.3);
  let s = shadow(ax, ay - 2, (R - L) / 2 + 8, 13, 0.26);
  const l = L + 6;
  const r = R - 6;
  const floors = 4;
  const fh = 1.08 * T;
  const top = ay - floors * fh - 8;
  s += wall(S, l, top, r - l, ay - top, S.id === 'tropik' || S.id === 'dwor' ? S.wall : S.wall2);
  const r2 = rng(11);
  for (let f = 0; f < floors; f++) {
    const y = top + 10 + f * fh;
    for (let c = 0; c < 2; c++) {
      const x = l + 10 + c * ((r - l - 20) / 2);
      const cw = (r - l - 20) / 2 - 8;
      s += shaded(
        rr(x, y + 4, 14, fh - 24, 2),
        S.panels[(f + c * 2) % S.panels.length]!,
        LINE,
        -1,
        -1,
        1.6,
      );
      s += windowAt(x + 18, y + 6, cw - 22, fh - 30, { cross: S.id === 'dwor', lit: r2() > 0.5 });
      if (f < floors - 1 || c === 0) {
        s += flat(rr(x + 12, y + fh - 22, cw - 6, 6, 2), '#c3c8cf', LINE, 1.6);
        if (S.id === 'dwor') {
          // wrought-iron balusters
          let bars = '';
          for (let bx = x + 16; bx < x + cw + 2; bx += 5) bars += `M${n(bx)} ${n(y + fh - 22)}v-11`;
          s +=
            stroke(bars, '#2a2e38', 1.6) +
            stroke(`M${n(x + 14)} ${n(y + fh - 33)}h${n(cw - 10)}`, '#2a2e38', 2.4);
        } else {
          s += fill(rr(x + 14, y + fh - 34, cw - 10, 12, 2), '#bfe6f7', 0.55);
          s += stroke(`M${n(x + 14)} ${n(y + fh - 34)}h${n(cw - 10)}`, '#e9eef3', 2);
        }
        if (r2() > 0.45) s += plant(S, x + 26, y + fh - 33, 5);
      }
    }
  }
  s += plinth(S, l, r, ay, 10);
  s += parapet(S, l, r, top + 4);
  s += entrance(S, ax, ay - 4, 30, 0.8 * T);
  if (S.id === 'tropik') s += canopy(S, l + 36, top - 18, 46, ['#ff8fb8', '#d9628c']);
  else
    s += shaded(
      poly([
        [l + 14, top - 2],
        [l + 22, top - 18],
        [l + 58, top - 18],
        [l + 50, top - 2],
      ]),
      DARK_GLASS,
      LINE,
      -1,
      -1,
      2,
    );
  s += shaded(circ(r - 22, top - 12, 9), WHITE, LINE, -2, -2, 2);
  return { w, h, ax, ay, foot, body: s };
}

/** A vertical farm: a tall greenhouse, racks of greens on every shelf, pink-violet grow lights glowing. */
function verticalFarm(S: Style): Prop {
  const foot: [number, number] = [3, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 4.2, 0.3);
  let s = shadow(ax, ay - 2, (R - L) / 2 + 8, 13, 0.25);
  const l = L + 8;
  const r = R - 8;
  const top = ay - 3.1 * T;
  s += fill(rr(l, top, r - l, ay - top, 6), '#c86bd8', 0.55);
  s += fill(rr(l + 6, top + 6, r - l - 12, ay - top - 12, 5), '#f0a6ff', 0.35);
  const shelves = 5;
  for (let i = 0; i < shelves; i++) {
    const y = top + 18 + i * ((ay - top - 26) / shelves);
    s += stroke(`M${n(l + 6)} ${n(y + 14)}H${n(r - 6)}`, '#e9eef3', 3, 0.9);
    for (let x = l + 14; x < r - 10; x += 13)
      s += shaded(circ(x, y + 8, 5.5), ['#86d062', '#4f9e45'], '#2b5a2c', -1, -1, 1.4);
    s += stroke(`M${n(l + 8)} ${n(y)}H${n(r - 8)}`, '#ff8fe0', 2.2, 0.9);
  }
  s += fill(rr(l, top, r - l, ay - top, 6), '#ffffff', 0.12);
  s += `<path d="${rr(l, top, r - l, ay - top, 6)}" fill="none" stroke="${LINE}" stroke-width="3"/>`;
  let frames = '';
  for (let x = l + (r - l) / 3; x < r - 2; x += (r - l) / 3)
    frames += `M${n(x)} ${n(top + 2)}V${n(ay - 2)}`;
  const mullion =
    S.id === 'las'
      ? '#a87a4c'
      : S.id === 'dwor'
        ? '#2a2e38'
        : S.id === 'zlom'
          ? '#5f6b79'
          : '#ffffff';
  s += stroke(frames, mullion, 3);
  s += plinth(S, l, r, ay, 12);
  s += shaded(
    poly([
      [l - 6, top + 4],
      [ax, top - 0.7 * T],
      [r + 6, top + 4],
    ]),
    S.id === 'tropik' ? S.canopy : ['#cfeffd', '#a6dcf5'],
    LINE,
    -3,
    -3,
    2.5,
  );
  s += shaded(
    rr(ax - 12, top - 0.62 * T, 24, 10, 2),
    S.id === 'zlom' ? S.wall2 : STEEL,
    LINE,
    -1,
    -1,
    1.8,
  );
  s += entrance(S, ax, ay - 4, 26, 0.7 * T, S.accent);
  return { w, h, ax, ay, foot, body: s };
}

/** A solar farm: tilted panels in rows on legs, a battery cabinet with a light in the district's colour. */
function solarFarm(S: Style): Prop {
  const foot: [number, number] = [3, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 2.6, 0.3);
  let s = shadow(ax, ay - 2, (R - L) / 2 + 6, 12, 0.22);
  const rows = 3;
  for (let i = 0; i < rows; i++) {
    const y = ay - 1.9 * T + i * 0.6 * T;
    const inset = (rows - 1 - i) * 6;
    const l = L + 10 + inset;
    const r = R - 10 - inset;
    s += stroke(
      `M${n(l + 10)} ${n(y + 30)}v-10M${n(r - 10)} ${n(y + 30)}v-10`,
      S.id === 'las' ? '#7c5732' : '#727f8e',
      3,
    );
    s += shaded(
      poly([
        [l, y + 22],
        [l + 8, y],
        [r - 8, y],
        [r, y + 22],
      ]),
      DARK_GLASS,
      LINE,
      -2,
      -2,
      2.5,
    );
    let cells = '';
    for (let x = l + 16; x < r - 8; x += 16) cells += `M${n(x)} ${n(y + 1)}l-4 21`;
    cells += `M${n(l + 4)} ${n(y + 11)}H${n(r - 4)}`;
    s += stroke(cells, '#7cc6ec', 1.6, 0.8);
    s += stroke(`M${n(l + 10)} ${n(y + 3)}l40 0`, '#ffffff', 2.5, 0.45);
  }
  s += shaded(rr(R - 46, ay - 34, 34, 30, 3), S.trim, LINE, -2, -2, 2);
  s += shaded(circ(R - 29, ay - 22, 4), S.accent, S.accentLine, -1, -1, 1.5);
  s += stroke(`M${n(R - 40)} ${n(ay - 12)}h22`, '#9aa6b4', 2);
  if (S.id === 'tropik') s += minipalm(L + 4, ay - 4, 12, S.leaf);
  else if (S.id === 'las') s += puffs([[L + 2, ay - 16, 13]], S.leaf, '', 2);
  return { w, h, ax, ay, foot, body: s };
}

/** A concrete plant: a tall silo on legs, a mixing hall, a conveyor, a mixer truck in front. */
function concretePlant(S: Style): Prop {
  const foot: [number, number] = [3, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 4.6, 0.35);
  let s = shadow(ax, ay - 2, (R - L) / 2 + 8, 13, 0.26);
  const sx = L + 0.85 * T;
  s += stroke(
    `M${n(sx - 16)} ${n(ay - 4)}V${n(ay - 1.3 * T)}M${n(sx + 16)} ${n(ay - 4)}V${n(ay - 1.3 * T)}`,
    '#727f8e',
    4,
  );
  s += shaded(
    `M${n(sx - 22)} ${n(ay - 1.3 * T)}L${n(sx - 22)} ${n(ay - 3.6 * T)}Q${n(sx)} ${n(ay - 4.05 * T)} ${n(sx + 22)} ${n(ay - 3.6 * T)}L${n(sx + 22)} ${n(ay - 1.3 * T)}L${n(sx)} ${n(ay - 0.9 * T)}Z`,
    S.id === 'tropik' ? S.wall : S.id === 'zlom' ? S.wall : CONCRETE,
    LINE,
    -4,
    -3,
  );
  s += stroke(
    `M${n(sx - 22)} ${n(ay - 2.4 * T)}H${n(sx + 22)}M${n(sx - 22)} ${n(ay - 3.1 * T)}H${n(sx + 22)}`,
    S.accent[1],
    2.4,
    0.8,
  );
  s += shaded(rr(sx - 8, ay - 3.9 * T, 16, 10, 2), S.accent, S.accentLine, -1, -1, 1.6);
  const hl = sx + 24;
  const hr = R - 8;
  const ht = ay - 1.9 * T;
  s += wall(
    S,
    hl,
    ht,
    hr - hl,
    ay - ht,
    S.id === 'las' ? S.wall : S.id === 'dwor' ? S.wall2 : STEEL,
  );
  s += shaded(rr(hl + 12, ay - 0.9 * T, 34, 0.9 * T - 4, 2), S.dark, LINE, -2, -2, 2);
  s += stroke(`M${n(sx + 6)} ${n(ay - 1.0 * T)}L${n(hl + 20)} ${n(ht - 14)}`, '#4a5160', 7);
  s += stroke(`M${n(sx + 6)} ${n(ay - 1.0 * T)}L${n(hl + 20)} ${n(ht - 14)}`, '#ffc93c', 3);
  s += shaded(rr(hr - 46, ay - 26, 40, 24, 4), WHITE, LINE, -2, -2, 2);
  s += shaded(`M${n(hr - 42)} ${n(ay - 28)}q18 -22 34 -4l-4 6Z`, S.panels[0]!, LINE, -2, -2, 2);
  s += `<circle cx="${n(hr - 38)}" cy="${n(ay - 4)}" r="6" fill="#2e3033" stroke="#161718" stroke-width="2"/>`;
  s += `<circle cx="${n(hr - 14)}" cy="${n(ay - 4)}" r="6" fill="#2e3033" stroke="#161718" stroke-width="2"/>`;
  return { w, h, ax, ay, foot, body: s };
}

/** A steel recycling hall: a sawtooth roof with skylights, a stack, a container of scrap and a stack of beams. */
function recycling(S: Style): Prop {
  const foot: [number, number] = [3, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 4.1, 0.35);
  let s = shadow(ax, ay - 2, (R - L) / 2 + 8, 13, 0.26);
  const l = L + 6;
  const r = R - 6;
  const wallTop = ay - 1.7 * T;
  s += shaded(
    rr(r - 30, ay - 3.4 * T, 18, 1.8 * T, 3),
    S.id === 'dwor' ? S.wall2 : CONCRETE_DARK,
    LINE,
    -2,
    -2,
    2,
  );
  s += stroke(`M${n(r - 30)} ${n(ay - 3.15 * T)}h18`, '#ff5a4a', 4);
  s += puffs(
    [
      [r - 21, ay - 3.6 * T, 8],
      [r - 14, ay - 3.85 * T, 6],
    ],
    { base: '#eef1f4', dark: '#cdd3da', light: '#ffffff', line: '#a3abb6' },
    '',
    2,
  );
  s += wall(
    S,
    l,
    wallTop,
    r - l,
    ay - wallTop,
    S.id === 'zlom' || S.id === 'las' ? S.wall : S.id === 'dwor' ? S.wall2 : STEEL,
  );
  const teeth = 3;
  const tw = (r - l) / teeth;
  for (let i = 0; i < teeth; i++) {
    const x = l + i * tw;
    s += shaded(
      poly([
        [x, wallTop + 2],
        [x, wallTop - 0.55 * T],
        [x + tw, wallTop + 2],
      ]),
      S.id === 'tropik' ? S.canopy : S.dark,
      LINE,
      -2,
      -2,
      2.5,
    );
    s += fill(
      poly([
        [x + 3, wallTop - 2],
        [x + 3, wallTop - 0.5 * T + 6],
        [x + tw * 0.45, wallTop - 2],
      ]),
      '#bfe6f7',
      0.8,
    );
  }
  s += fill(rr(ax - 26, ay - 0.95 * T, 52, 0.95 * T - 2, 2), '#ff9a3c', 0.85);
  s += shaded(rr(ax - 26, ay - 0.95 * T, 52, 0.45 * T, 2), ['#c3c8cf', '#9aa6b4'], LINE, -2, -2, 2);
  s += shaded(rr(l - 10, ay - 26, 36, 24, 2), S.accent, S.accentLine, -2, -2, 2);
  s += stroke(
    `M${n(l - 4)} ${n(ay - 24)}v20M${n(l + 6)} ${n(ay - 24)}v20M${n(l + 16)} ${n(ay - 24)}v20`,
    S.accent[1],
    2,
  );
  for (let i = 0; i < 3; i++)
    s += shaded(rr(r - 34, ay - 10 - i * 7, 40, 6, 1), STEEL, LINE, -1, -1, 1.5);
  return { w, h, ax, ay, foot, body: s };
}

/** A logistics centre: a long low hall, three loading bays with roller doors, a forklift and pallets. */
function logistics(S: Style): Prop {
  const foot: [number, number] = [3, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 3.2, 0.3);
  let s = shadow(ax, ay - 2, (R - L) / 2 + 8, 13, 0.25);
  const l = L + 4;
  const r = R - 4;
  const top = ay - 1.95 * T;
  s += wall(
    S,
    l,
    top,
    r - l,
    ay - top,
    S.id === 'dwor' ? S.wall : S.id === 'zlom' ? S.wall : S.trim,
  );
  s += fill(rr(l + 2, top + 2, r - l - 4, 12, 2), S.accent[0], 0.9);
  s += stroke(`M${n(l + 4)} ${n(top + 14)}H${n(r - 4)}`, LINE, 2);
  if (S.id === 'dwor') s += parapet(S, l, r, top + 2);
  const bays = 3;
  const bw = (r - l - 24) / bays;
  for (let i = 0; i < bays; i++) {
    const x = l + 12 + i * bw;
    s += shaded(
      rr(x + 3, ay - 0.95 * T, bw - 6, 0.95 * T - 8, 2),
      ['#c3c8cf', '#9aa6b4'],
      LINE,
      -2,
      -2,
      2,
    );
    let slats = '';
    for (let y = ay - 0.95 * T + 5; y < ay - 10; y += 5)
      slats += `M${n(x + 5)} ${n(y)}h${n(bw - 10)}`;
    s += stroke(slats, '#7f8a97', 1.3, 0.7);
    s += shaded(rr(x, ay - 8, bw, 6, 1), S.dark, LINE, -1, -1, 1.5);
  }
  s += shaded(rr(l - 12, ay - 14, 26, 12, 2), WOOD, '#5a3a22', -1, -1, 1.6);
  s += shaded(rr(l - 10, ay - 30, 22, 16, 2), ['#e8d6a8', '#c4ae7c'], '#7a6640', -1, -1, 1.6);
  const fx = r - 22;
  s += shaded(rr(fx - 14, ay - 26, 28, 20, 4), GOLD, LINE, -2, -2, 2);
  s += stroke(
    `M${n(fx - 18)} ${n(ay - 40)}V${n(ay - 4)}M${n(fx - 18)} ${n(ay - 4)}h-10`,
    '#3d3a36',
    3,
  );
  s += `<circle cx="${n(fx - 6)}" cy="${n(ay - 4)}" r="5" fill="#2e3033"/><circle cx="${n(fx + 8)}" cy="${n(ay - 4)}" r="5" fill="#2e3033"/>`;
  return { w, h, ax, ay, foot, body: s };
}

// ---------- prestige: what makes a district admired ----------

/** A tree of the style for squares: a round crown, a palm, a clipped cone, a bare dead tree with a lamp. */
function styleTree(S: Style, x: number, y: number, size: number) {
  switch (S.id) {
    case 'tropik':
      return shadow(x, y, size * 0.9, size * 0.25, 0.2) + minipalm(x, y, size * 1.4, S.leaf);
    case 'dwor':
      return (
        shadow(x, y, size * 0.8, size * 0.22, 0.2) +
        stroke(`M${n(x)} ${n(y)}v${n(-size * 0.8)}`, '#6b4229', 4) +
        shaded(
          `M${n(x)} ${n(y - size * 2.6)}Q${n(x + size)} ${n(y - size * 1.2)} ${n(x + size * 0.7)} ${n(y - size * 0.7)}H${n(x - size * 0.7)}Q${n(x - size)} ${n(y - size * 1.2)} ${n(x)} ${n(y - size * 2.6)}Z`,
          [S.leaf.base, S.leaf.dark],
          S.leaf.line,
          -3,
          -4,
          2.2,
        )
      );
    case 'zlom':
      return (
        shadow(x, y, size * 0.6, size * 0.2, 0.2) +
        stroke(
          `M${n(x)} ${n(y)}V${n(y - size * 1.6)}M${n(x)} ${n(y - size * 1.1)}l${n(size * 0.5)} ${n(-size * 0.5)}M${n(x)} ${n(y - size * 1.3)}l${n(-size * 0.45)} ${n(-size * 0.4)}`,
          '#5a4a3a',
          3.5,
        ) +
        puffs([[x, y - size * 1.75, size * 0.55]], S.leaf, '', 2)
      );
    default:
      return (
        shadow(x, y, size * 0.8, size * 0.22, 0.2) +
        stroke(`M${n(x)} ${n(y)}v${n(-size * 0.9)}`, '#6b4229', 4.5) +
        puffs(
          [
            [x - size * 0.35, y - size * 1.25, size * 0.6],
            [x + size * 0.35, y - size * 1.3, size * 0.6],
            [x, y - size * 1.7, size * 0.65],
          ],
          S.leaf,
          '',
          2.5,
        )
      );
  }
}

/** A street lamp with a warm light. */
function lamp(S: Style, x: number, y: number, height: number) {
  const pole = S.id === 'dwor' ? '#24272e' : S.id === 'las' ? '#5b4a36' : '#4a5160';
  return (
    stroke(`M${n(x)} ${n(y)}V${n(y - height)}`, pole, 3) +
    shaded(
      rr(x - 6, y - height - 10, 12, 10, 3),
      S.id === 'dwor' ? ['#3a3e48', '#24272e'] : S.trim,
      LINE,
      -1,
      -1,
      1.5,
    ) +
    fill(circ(x, y - height - 4, 9), '#ffe3a1', 0.35) +
    fill(circ(x, y - height - 4, 3.5), '#fff2c8', 1)
  );
}

/** A bench on the square. */
const bench = (x: number, y: number) =>
  shaded(rr(x - 14, y - 12, 28, 6, 2), WOOD, '#5a3a22', -1, -1, 1.4) +
  shaded(rr(x - 14, y - 20, 28, 5, 2), WOOD, '#5a3a22', -1, -1, 1.4) +
  stroke(`M${n(x - 11)} ${n(y - 6)}v6M${n(x + 11)} ${n(y - 6)}v6`, '#3d3a36', 2.4);

/** Skwer: a little paved square with the style's trees, benches and a lamp. */
function square(S: Style): Prop {
  const foot: [number, number] = [3, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 3.0, 0.35);
  let s = '';
  const top = ay - 2.4 * T;
  // the paving lies flat in a tilted view: a wide low lozenge of slabs with a kerb
  s += shaded(
    rr(L - 6, top + 0.9 * T, R - L + 12, ay - top - 0.9 * T, 10),
    S.paving,
    LINE,
    -2,
    -3,
    2.5,
  );
  let joints = '';
  for (let x = L + 10; x < R; x += 22) joints += `M${n(x)} ${n(top + 0.9 * T + 4)}V${n(ay - 4)}`;
  for (let y = top + 0.9 * T + 18; y < ay - 4; y += 16) joints += `M${n(L)} ${n(y)}H${n(R)}`;
  s += stroke(joints, S.paving[1], 1.4, 0.6);
  // a round bed in the middle with flowers
  s += shaded(
    `M${n(ax - 34)} ${n(ay - 0.85 * T)}a34 13 0 1 0 68 0a34 13 0 1 0 -68 0Z`,
    ['#7cbf55', '#58993d'],
    '#2b5a2c',
    -2,
    -2,
    2,
  );
  for (const [dx, c] of [
    [-18, '#ff7aa8'],
    [-4, '#ffd65a'],
    [12, '#ffffff'],
    [24, '#ff7a6b'],
  ] as const)
    s += fill(circ(ax + dx, ay - 0.85 * T - 2 + (dx % 3), 3.5), c, 1);
  s += styleTree(S, L + 18, ay - 1.15 * T, 0.5 * T);
  s += styleTree(S, R - 18, ay - 1.25 * T, 0.55 * T);
  s += bench(ax - 30, ay - 8);
  s += bench(ax + 30, ay - 8);
  s += lamp(S, ax, ay - 1.25 * T, 1.3 * T);
  return { w, h, ax, ay, foot, body: shadow(ax, ay - 4, (R - L) / 2 + 8, 10, 0.12) + s };
}

/** Fontanna: a round stone basin, a tiered bowl, jets of water and their sparkle. */
function fountain(S: Style): Prop {
  const foot: [number, number] = [3, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 3.2, 0.35);
  let s = shadow(ax, ay - 6, (R - L) / 2 + 6, 12, 0.18);
  const by = ay - 0.6 * T;
  const rx = (R - L) / 2 + 4;
  s += shaded(
    `M${n(ax - rx)} ${n(by)}a${n(rx)} 26 0 1 0 ${n(rx * 2)} 0v-16a${n(rx)} 26 0 1 0 ${n(-rx * 2)} 0Z`,
    S.stone,
    LINE,
    -3,
    -3,
    2.5,
  );
  s += shaded(
    `M${n(ax - rx + 10)} ${n(by - 16)}a${n(rx - 10)} 18 0 1 0 ${n((rx - 10) * 2)} 0a${n(rx - 10)} 18 0 1 0 ${n(-(rx - 10) * 2)} 0Z`,
    WATER,
    '#2f7fae',
    -3,
    -2,
    2,
  );
  s += stroke(
    `M${n(ax - rx + 26)} ${n(by - 18)}q20 -6 40 0M${n(ax + 10)} ${n(by - 10)}q16 -4 30 2`,
    '#ffffff',
    2,
    0.6,
  );
  // the column and the upper bowl
  s += shaded(rr(ax - 8, by - 1.4 * T, 16, 1.4 * T - 14, 4), S.stone, LINE, -2, -2, 2);
  s += shaded(`M${n(ax - 34)} ${n(by - 1.4 * T)}q34 22 68 0Z`, S.stone, LINE, -2, -2, 2.2);
  if (S.id === 'dwor' || S.id === 'tropik')
    s += shaded(
      circ(ax, by - 1.4 * T - 8, 6),
      S.id === 'dwor' ? GOLD : S.accent,
      LINE,
      -1,
      -1,
      1.6,
    );
  // jets: arcs of water falling into the basin
  const jets = `M${n(ax)} ${n(by - 1.5 * T)}q-10 -26 -30 4M${n(ax)} ${n(by - 1.5 * T)}q10 -26 30 4M${n(ax)} ${n(by - 1.5 * T)}v-30M${n(ax - 34)} ${n(by - 1.38 * T)}q-12 10 -16 36M${n(ax + 34)} ${n(by - 1.38 * T)}q12 10 16 36`;
  s += stroke(jets, '#bfeaff', 4.5, 0.9) + stroke(jets, '#ffffff', 1.8, 0.9);
  for (const [dx, dy] of [
    [-26, -12],
    [22, -20],
    [-8, -34],
    [30, -6],
  ] as const)
    s += fill(circ(ax + dx, by - 1.4 * T + dy, 2.2), '#ffffff', 0.9);
  return { w, h, ax, ay, foot, body: s };
}

/** Pomnik: a bronze bud in its cap on a pedestal of the style's stone, flowers at its feet. */
function statue(S: Style): Prop {
  const foot: [number, number] = [3, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 4.6, 0.35);
  let s = shadow(ax, ay - 4, (R - L) / 2, 11, 0.22);
  // steps and the pedestal
  s += shaded(rr(L + 2, ay - 22, R - L - 4, 20, 3), S.stone, LINE, -2, -2, 2.5);
  s += shaded(rr(L + 16, ay - 38, R - L - 32, 18, 3), S.stone, LINE, -2, -2, 2.5);
  const pt = ay - 1.75 * T;
  s += shaded(
    rr(ax - 34, pt, 68, ay - 38 - pt, 4),
    S.id === 'dwor' ? S.wall : S.stone,
    LINE,
    -3,
    -3,
    2.5,
  );
  s += shaded(rr(ax - 40, pt - 10, 80, 12, 3), S.trim, LINE, -1, -1, 2);
  s += shaded(rr(ax - 16, pt + 22, 32, 18, 2), GOLD, LINE, -1, -1, 1.8); // the plaque (no words)
  // the bud: sturdy chibi body, a big round head, a cap, one arm raised
  const fy = pt - 10;
  const B = BRONZE;
  s += shaded(rr(ax - 18, fy - 22, 14, 22, 5), B, '#5a3516', -2, -2, 2);
  s += shaded(rr(ax + 4, fy - 22, 14, 22, 5), B, '#5a3516', -2, -2, 2);
  s += shaded(rr(ax - 24, fy - 66, 48, 48, 14), B, '#5a3516', -3, -3, 2.4);
  s += stroke(`M${n(ax + 18)} ${n(fy - 56)}q18 -12 20 -42`, '#5a3516', 13);
  s += stroke(`M${n(ax + 18)} ${n(fy - 56)}q18 -12 20 -42`, B[0], 9);
  s += shaded(circ(ax + 38, fy - 100, 8), B, '#5a3516', -1, -1, 2);
  s += stroke(`M${n(ax - 22)} ${n(fy - 50)}q-12 14 -6 30`, '#5a3516', 13);
  s += stroke(`M${n(ax - 22)} ${n(fy - 50)}q-12 14 -6 30`, B[0], 9);
  s += shaded(circ(ax, fy - 96, 32), B, '#5a3516', -4, -5, 2.4);
  s += shaded(
    `M${n(ax - 32)} ${n(fy - 102)}q4 -34 32 -34q30 0 34 32q-34 -10 -66 2Z`,
    B,
    '#5a3516',
    -3,
    -3,
    2.2,
  );
  s += shaded(rr(ax - 4, fy - 108, 46, 9, 4), B, '#5a3516', -1, -1, 2); // the cap's peak
  s +=
    fill(circ(ax - 10, fy - 92, 3.4), '#5a3516', 0.9) +
    fill(circ(ax + 10, fy - 92, 3.4), '#5a3516', 0.9);
  s += stroke(`M${n(ax - 8)} ${n(fy - 80)}q8 7 16 0`, '#5a3516', 2.6);
  // the patina's highlights
  s += stroke(`M${n(ax - 22)} ${n(fy - 108)}q8 -18 24 -20`, '#f2c48a', 3, 0.6);
  // flowers at the foot
  for (const [dx, c] of [
    [-44, '#ff7aa8'],
    [-30, '#ffd65a'],
    [30, '#ff7a6b'],
    [44, '#ffffff'],
  ] as const) {
    s += puffs([[ax + dx, ay - 12, 7]], S.leaf, '', 2);
    s += fill(circ(ax + dx, ay - 15, 3.2), c, 1);
  }
  return { w, h, ax, ay, foot, body: s };
}

/** Iglica: the landmark tower of a great district, in the style of its land, seen from the whole wasteland. */
function spire(S: Style): Prop {
  const foot: [number, number] = [5, 4];
  const { w, h, ax, ay, L, R } = frame(foot, 12.5, 0.4);
  let s = shadow(ax, ay - 2, (R - L) / 2 + 16, 18, 0.3);
  const podiumTop = ay - 1.3 * T;
  s += wall(S, L + 4, podiumTop, R - L - 8, ay - podiumTop, S.id === 'dwor' ? S.wall : S.wall2);
  s += curtainWall(L + 14, podiumTop + 12, R - L - 28, ay - podiumTop - 20, 8, 1, S.glassDark);
  s += plinth(S, L + 4, R - 4, ay, 12);
  s += parapet(S, L + 4, R - 4, podiumTop + 4);
  const top = ay - 11.2 * T;
  if (S.id === 'tropik') {
    // a white sail: one straight back, one curved front, turquoise glass between, a helipad on top
    const back = ax - 1.25 * T;
    s += shaded(
      `M${n(back)} ${n(podiumTop + 4)}V${n(top)}Q${n(ax + 2.2 * T)} ${n(top + 2.5 * T)} ${n(ax + 1.5 * T)} ${n(podiumTop + 4)}Z`,
      S.wall,
      LINE,
      -6,
      -4,
    );
    s += curtainWall(
      back + 14,
      top + 1.0 * T,
      1.55 * T,
      podiumTop - top - 1.3 * T,
      3,
      12,
      S.glass,
      '#ffffff',
    );
    let ribs = '';
    for (let y = top + 0.8 * T; y < podiumTop; y += 0.55 * T)
      ribs += `M${n(back + 4)} ${n(y)}h${n(1.9 * T)}`;
    s += stroke(ribs, '#ffffff', 2, 0.5);
    s += shaded(
      `M${n(back - 18)} ${n(top + 6)}a40 10 0 1 0 80 0a40 10 0 1 0 -80 0Z`,
      S.accent,
      S.accentLine,
      -2,
      -2,
      2,
    );
    s += stroke(
      `M${n(back + 12)} ${n(top + 2)}v8M${n(back + 32)} ${n(top + 2)}v8M${n(back + 12)} ${n(top + 6)}h20`,
      '#ffffff',
      2.4,
    );
  } else if (S.id === 'dwor') {
    // a neo-classical tower: tiers with cornices, columns, a gold dome and a spire
    const tiers = 4;
    let y = podiumTop;
    let half = 1.35 * T;
    for (let i = 0; i < tiers; i++) {
      const th = (podiumTop - top - 1.6 * T) / tiers;
      s += shaded(rr(ax - half, y - th, half * 2, th, 3), S.wall, LINE, -5, -3);
      let cols = '';
      for (let x = ax - half + 12; x < ax + half - 6; x += 18)
        cols += `M${n(x)} ${n(y - th + 12)}V${n(y - 6)}`;
      s += stroke(cols, S.wall[1], 5, 0.7);
      for (let x = ax - half + 20; x < ax + half - 10; x += 18)
        s += windowAt(x - 4, y - th + 18, 9, th - 32, { cross: false, lit: (x + i) % 3 === 0 });
      s += shaded(rr(ax - half - 6, y - th - 8, half * 2 + 12, 10, 3), S.trim, LINE, -1, -1, 2);
      y -= th + 8;
      half *= 0.82;
    }
    s += shaded(
      `M${n(ax - half - 4)} ${n(y + 4)}Q${n(ax)} ${n(y - 1.6 * T)} ${n(ax + half + 4)} ${n(y + 4)}Z`,
      GOLD,
      LINE,
      -4,
      -4,
    );
    s += stroke(
      `M${n(ax - half * 0.4)} ${n(y - 6)}q${n(half * 0.4)} -${n(0.9 * T)} ${n(half * 0.6)} -${n(1.1 * T)}`,
      '#fff2c8',
      3,
      0.6,
    );
    s += stroke(`M${n(ax)} ${n(y - 1.25 * T)}V${n(y - 2.2 * T)}`, '#d98a0b', 4);
    s += shaded(circ(ax, y - 2.25 * T, 6), GOLD, LINE, -1, -1, 2);
  } else if (S.id === 'zlom') {
    // a steel exoskeleton round a glass shaft, orange neon bands, a beacon
    const tl = ax - 1.2 * T;
    const tr = ax + 1.2 * T;
    s += shaded(rr(tl, top, tr - tl, podiumTop - top + 6, 4), S.dark, LINE, -6, -4);
    s += curtainWall(tl + 10, top + 16, tr - tl - 20, podiumTop - top - 24, 4, 14, S.glass);
    let truss = '';
    for (let y = podiumTop; y > top + 20; y -= 0.9 * T)
      truss += `M${n(tl - 6)} ${n(y)}L${n(tr + 6)} ${n(y - 0.9 * T)}M${n(tr + 6)} ${n(y)}L${n(tl - 6)} ${n(y - 0.9 * T)}`;
    s += stroke(truss, '#5f6b79', 5) + stroke(truss, '#9aa6b4', 2.5);
    s += stroke(
      `M${n(tl - 6)} ${n(podiumTop)}V${n(top + 10)}M${n(tr + 6)} ${n(podiumTop)}V${n(top + 10)}`,
      '#5f6b79',
      7,
    );
    for (const f of [0.25, 0.5, 0.75]) {
      const y = podiumTop - (podiumTop - top) * f;
      s += fill(rr(tl - 8, y - 4, tr - tl + 16, 8, 3), S.accent[0], 0.95);
      s += fill(rr(tl - 14, y - 9, tr - tl + 28, 18, 6), S.accent[0], 0.22);
    }
    s += stroke(`M${n(ax)} ${n(top)}V${n(top - 1.4 * T)}`, '#4a5160', 4);
    s += shaded(circ(ax, top - 1.4 * T, 7), S.accent, S.accentLine, -1, -1, 2);
    s += fill(circ(ax, top - 1.4 * T, 16), S.accent[0], 0.3);
  } else {
    // a timber-and-glass tower with a forest on every floor: terraces with trees spilling over
    const tl = ax - 1.25 * T;
    const tr = ax + 1.25 * T;
    s += shaded(rr(tl, top, tr - tl, podiumTop - top + 6, 4), S.wall, LINE, -6, -4);
    s += texture(S, tl, top, tr - tl, podiumTop - top);
    const floors = 9;
    const fh = (podiumTop - top - 10) / floors;
    const r = rng(77);
    for (let f = 0; f < floors; f++) {
      const y = top + 10 + f * fh;
      s += curtainWall(tl + 10, y + 4, tr - tl - 20, fh - 16, 4, 1, S.glass);
      s += shaded(rr(tl - 10, y + fh - 12, tr - tl + 20, 8, 2), S.trim, LINE, -1, -1, 1.6);
      for (const side of [-1, 1]) {
        const x = side < 0 ? tl - 4 + r() * 8 : tr + 4 - r() * 8;
        s += puffs([[x, y + fh - 18, 9 + r() * 4]], r() > 0.5 ? LEAF : LEAF2, '', 2);
      }
      if (f % 3 === 1) s += puffs([[ax + (r() - 0.5) * 40, y + fh - 18, 8]], LEAF, '', 2);
    }
    s += planters(S, tl - 4, tr + 4, top - 2, 9);
    s += stroke(`M${n(ax)} ${n(top - 10)}V${n(top - 1.2 * T)}`, '#4a5160', 3);
    s += shaded(circ(ax, top - 1.2 * T, 6), S.accent, S.accentLine, -1, -1, 2);
    s += fill(circ(ax, top - 1.2 * T, 14), S.accent[0], 0.28);
  }
  s += entrance(S, ax, ay - 4, 60, 0.9 * T, GOLD);
  s += planters(S, L + 12, ax - 46, ay - 2, 8);
  s += planters(S, ax + 46, R - 12, ay - 2, 8);
  return { w, h, ax, ay, foot, body: s };
}

// ---------- the plot: the sign, the fence, a sector being cleared ----------

/** A pylon at a district's gate in the style's colours, a little white skyline on it (no words; the game says the name). */
function districtSign(S: Style): Prop {
  const foot: [number, number] = [1, 1];
  const { w, h, ax, ay } = frame(foot, 2.2, 0.5);
  let s = shadow(ax, ay - 2, 18, 6, 0.24);
  const top = ay - 1.9 * T;
  s += shaded(
    rr(ax - 14, top, 28, ay - top - 2, 5),
    S.id === 'tropik' ? S.wall : S.dark,
    LINE,
    -2,
    -2,
    2.5,
  );
  if (S.id === 'las') s += texture(S, ax - 14, top, 28, ay - top - 2);
  s += fill(rr(ax - 10, top + 6, 20, 5, 2), S.accent[0], 1);
  const ink = S.id === 'tropik' ? S.dark[0] : '#f4f6f8';
  for (const [dx, hh] of [
    [-7, 10],
    [-2, 18],
    [3, 13],
    [8, 7],
  ] as const)
    s += fill(rr(ax + dx - 2, top + 34 - hh, 4, hh, 1), ink, 0.95);
  s += fill(rr(ax - 10, top + 35, 20, 2, 1), S.accent[0], 1);
  if (S.id === 'tropik') s += minipalm(ax + 18, ay - 4, 14, S.leaf);
  if (S.id === 'dwor') s += shaded(circ(ax, top - 4, 7), GOLD, LINE, -1, -1, 2);
  s += shaded(
    rr(ax - 18, ay - 10, 36, 9, 3),
    S.id === 'dwor' ? S.wall2 : CONCRETE_DARK,
    LINE,
    -1,
    -1,
    2,
  );
  return { w, h, ax, ay, foot, body: s };
}

/**
 * The work at a sector being cleared (it stands at the sector's front; the game scatters stumps behind it): a pile
 * of what was cut in the style's land (logs, palm trunks, branches with hay, sorted scrap), a little orange digger,
 * warning tape on two posts.
 */
function clearing(S: Style): Prop {
  const foot: [number, number] = [3, 1];
  const { w, h, ax, ay, L, R } = frame(foot, 2.1, 0.7);
  let s = shadow(ax, ay - 2, (R - L) / 2 + 30, 10, 0.18);
  const px = L + 0.2 * T;
  const py = ay - 10;
  if (S.id === 'zlom') {
    s += shaded(
      `M${n(px - 50)} ${n(py)}q20 -60 50 -62q34 4 50 62Z`,
      ['#7d7468', '#5a5249'],
      LINE,
      -3,
      -3,
    );
    s += shaded(rr(px - 30, py - 40, 26, 14, 2), ['#e2483f', '#b0302a'], LINE, -1, -1, 1.6);
    s += shaded(circ(px + 18, py - 30, 11), ['#3a3a3a', '#222222'], LINE, -1, -1, 1.6);
    s += shaded(rr(px - 6, py - 58, 30, 10, 2), STEEL, LINE, -1, -1, 1.6);
  } else {
    const bark: Tone =
      S.id === 'tropik'
        ? ['#b48354', '#8f6339']
        : S.id === 'dwor'
          ? ['#9a7a4a', '#76592f']
          : ['#8f5e3b', '#6b4229'];
    for (let i = 0; i < 3; i++)
      for (let k = 0; k < 3 - i; k++) {
        const x = px - 26 + k * 26 + i * 13;
        const y = py - i * 18;
        s += shaded(circ(x, y - 9, 10), bark, '#45291a', -1, -1, 1.8);
        s += fill(circ(x, y - 9, 6), S.id === 'dwor' ? '#e8d28a' : '#e6c48e', 1);
        s += stroke(`M${n(x - 3)} ${n(y - 10)}a3 3 0 1 0 6 0`, bark[1], 1.2, 0.8);
      }
  }
  if (S.id === 'dwor')
    s += shaded(
      `M${n(px + 40)} ${n(py)}q14 -34 40 -30q16 14 6 30Z`,
      ['#e8cf7a', '#c9ad52'],
      '#8a7230',
      -2,
      -2,
      2,
    );
  if (S.id === 'tropik')
    s += shaded(
      `M${n(px + 36)} ${n(py)}q20 -30 46 -20q12 10 4 20Z`,
      ['#ead7a8', '#cdb27a'],
      '#9c8150',
      -2,
      -2,
      2,
    );
  // the digger
  const dx = R - 0.4 * T;
  const dy = ay - 6;
  s += shaded(rr(dx - 44, dy - 12, 88, 16, 6), GRAPHITE, LINE, -2, -2, 2);
  s += stroke(`M${n(dx - 36)} ${n(dy - 4)}h72`, '#7f8a97', 2, 0.8);
  s += shaded(rr(dx - 30, dy - 52, 52, 42, 6), ['#ff9a1f', '#d97a0b'], LINE, -3, -3);
  s += shaded(rr(dx - 24, dy - 46, 24, 22, 3), SKY, LINE, -1, -1, 2);
  s += stroke(
    `M${n(dx + 20)} ${n(dy - 40)}L${n(dx + 50)} ${n(dy - 78)}L${n(dx + 72)} ${n(dy - 30)}`,
    '#d97a0b',
    9,
  );
  s += stroke(
    `M${n(dx + 20)} ${n(dy - 40)}L${n(dx + 50)} ${n(dy - 78)}L${n(dx + 72)} ${n(dy - 30)}`,
    '#ffb24a',
    4,
  );
  s += shaded(`M${n(dx + 60)} ${n(dy - 32)}h26l-6 22h-20Z`, GRAPHITE, LINE, -1, -1, 2);
  // warning tape on two posts in front
  const t0 = L - 0.4 * T;
  const t1 = R + 0.4 * T;
  s += stroke(`M${n(t0)} ${n(ay - 2)}v-30M${n(t1)} ${n(ay - 2)}v-30`, '#4a5160', 3);
  const tape = `M${n(t0)} ${n(ay - 28)}Q${n(ax)} ${n(ay - 16)} ${n(t1)} ${n(ay - 28)}`;
  s +=
    stroke(tape, '#ffd23f', 6) +
    `<path d="${tape}" fill="none" stroke="#2f3440" stroke-width="6" stroke-dasharray="7 7"/>`;
  return { w, h, ax, ay, foot, body: s };
}

// ---------- shared ----------

/** A building site: a hoarding with a lime stripe, a concrete frame going up and a tower crane. */
function site(foot: [number, number]): Prop {
  const big = foot[0] === 5;
  const { w, h, ax, ay, L, R } = frame(foot, big ? 5.4 : 4.4, 0.3);
  let s = shadow(ax, ay - 2, (R - L) / 2 + 6, 12, 0.2);
  const l = L + 8;
  const r = R - 8;
  const top = ay - (big ? 2.3 : 1.8) * T;
  let cols = '';
  for (let i = 0; i <= (big ? 4 : 3); i++)
    cols += `M${n(l + 12 + (i * (r - l - 24)) / (big ? 4 : 3))} ${n(ay - 6)}V${n(top)}`;
  s += stroke(cols, '#868c97', 7);
  s += stroke(cols, '#c3c8cf', 4);
  for (const y of [top, (top + ay) / 2])
    s += shaded(rr(l + 6, y - 4, r - l - 12, 8, 2), CONCRETE, LINE, -1, -1, 2);
  const cx = r - 10;
  const mastTop = ay - (big ? 4.9 : 3.9) * T;
  s += stroke(
    `M${n(cx - 6)} ${n(ay - 4)}V${n(mastTop)}M${n(cx + 6)} ${n(ay - 4)}V${n(mastTop)}`,
    '#d98a0b',
    4,
  );
  let lattice = '';
  for (let y = ay - 10; y > mastTop + 6; y -= 14)
    lattice += `M${n(cx - 6)} ${n(y)}L${n(cx + 6)} ${n(y - 14)}`;
  s += stroke(lattice, '#ffc93c', 2.4);
  const jibL = l - 0.2 * T;
  s += stroke(`M${n(jibL)} ${n(mastTop + 4)}H${n(cx + 0.7 * T)}`, '#d98a0b', 6);
  s += stroke(`M${n(jibL)} ${n(mastTop + 4)}H${n(cx + 0.7 * T)}`, '#ffc93c', 3);
  s += shaded(rr(cx + 0.45 * T, mastTop + 6, 22, 14, 2), CONCRETE_DARK, LINE, -1, -1, 1.6);
  s += shaded(rr(cx - 10, mastTop - 10, 20, 14, 2), WHITE, LINE, -1, -1, 1.6);
  const hx = l + 30;
  s += stroke(`M${n(hx)} ${n(mastTop + 6)}V${n(top - 30)}`, '#3d3a36', 1.6);
  s += shaded(rr(hx - 12, top - 30, 24, 10, 2), STEEL, LINE, -1, -1, 1.6);
  s += shaded(rr(l - 4, ay - 26, r - l + 8, 22, 2), WHITE, LINE, -2, -2, 2);
  s += fill(rr(l - 2, ay - 18, r - l + 4, 6, 1), '#a3e635', 0.95);
  return { w, h, ax, ay, foot, body: s };
}

/** A plot for sale: a white board on two posts with a plot outline and a gold coin (no words). */
function forSale(): Prop {
  const foot: [number, number] = [1, 1];
  const { w, h, ax, ay } = frame(foot, 1.9, 0.6);
  let s = shadow(ax, ay - 2, 22, 6, 0.22);
  const top = ay - 1.55 * T;
  s += stroke(
    `M${n(ax - 16)} ${n(ay - 2)}V${n(top + 20)}M${n(ax + 16)} ${n(ay - 2)}V${n(top + 20)}`,
    '#4a5160',
    4,
  );
  s += shaded(rr(ax - 26, top, 52, 40, 4), WHITE, LINE, -2, -2, 2.5);
  s += `<path d="${rr(ax - 20, top + 7, 26, 26, 2)}" fill="none" stroke="#5d9a12" stroke-width="3" stroke-dasharray="5 3"/>`;
  s += shaded(circ(ax + 12, top + 26, 9), GOLD, LINE, -1, -1, 2);
  s += stroke(`M${n(ax + 12)} ${n(top + 21)}v10`, '#d98a0b', 2.5);
  return { w, h, ax, ay, foot, body: s };
}

/** A survey stake at a plot's corner: a white post with a lime ribbon. */
function stake(): Prop {
  const foot: [number, number] = [1, 1];
  const { w, h, ax, ay } = frame(foot, 1.0, 0.2);
  let s = shadow(ax, ay - 2, 9, 3, 0.2);
  s += shaded(rr(ax - 4, ay - 0.8 * T, 8, 0.8 * T - 2, 2), WHITE, LINE, -1, -1, 2);
  s += fill(rr(ax - 4, ay - 0.8 * T, 8, 8, 2), '#ff5a4a', 1);
  s += shaded(
    `M${n(ax + 3)} ${n(ay - 0.62 * T)}q14 2 18 10q-10 -2 -18 2Z`,
    LIME,
    '#2d4a12',
    -1,
    -1,
    1.4,
  );
  return { w, h, ax, ay, foot, body: s };
}

export const DISTRICT_STYLES = STYLES.map((s) => s.id);

const styled: Record<string, Prop> = {};
for (const S of STYLES) {
  const p = `dz-${S.id}-`;
  styled[`${p}ratusz-1`] = hallPavilion(S);
  styled[`${p}ratusz-2`] = hallOffice(S);
  styled[`${p}ratusz-3`] = hallTower(S);
  styled[`${p}apartamentowiec`] = apartments(S);
  styled[`${p}szklarnia`] = verticalFarm(S);
  styled[`${p}farma-solarna`] = solarFarm(S);
  styled[`${p}betoniarnia`] = concretePlant(S);
  styled[`${p}recykling`] = recycling(S);
  styled[`${p}magazyn`] = logistics(S);
  styled[`${p}skwer`] = square(S);
  styled[`${p}fontanna`] = fountain(S);
  styled[`${p}pomnik`] = statue(S);
  styled[`${p}iglica`] = spire(S);
  styled[`${p}tablica`] = districtSign(S);
  styled[`${p}wycinka`] = clearing(S);
  const fence = fenceKit(S.fence, LINE, { postW: 10, postH: 30, mesh: S.id === 'zlom' });
  styled[`${p}plot-post`] = fence.post;
  styled[`${p}plot-h`] = fence.h;
  styled[`${p}plot-v`] = fence.v;
}

export const DISTRICT: Record<string, Prop> = {
  ...styled,
  'dz-budowa': site([3, 3]),
  'dz-budowa-duza': site([5, 4]),
  'dz-na-sprzedaz': forSale(),
  'dz-palik': stake(),
};
