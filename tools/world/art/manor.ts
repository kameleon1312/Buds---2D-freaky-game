// Dwór Carski: aristocratic quarter — the manor house, brick tenements, the office and the bank, gas lamps,
// topiaries, a grand fountain, a statue, a carriage, a stable and brick walls.
import { fountain } from './city';
import { bench, fenceKit, lamp } from './common';
import {
  GLASS,
  STONE,
  T,
  bricks,
  circ,
  door,
  fill,
  flat,
  frame,
  n,
  poly,
  puffs,
  rr,
  shaded,
  shadow,
  stroke,
  windowAt,
  type Prop,
  type Tone,
} from './kit';

const LINE = '#3a2620';
const BRICK: Tone = ['#c8644a', '#a34c36'];
const BRICK_DARK: Tone = ['#a8503c', '#86402f'];
const CREAM = '#f6efe2';
const SLATE: Tone = ['#4f5a72', '#3c465b'];
const MARBLE: Tone = ['#ece6da', '#cdc5b5'];
const GOLD = '#ffc93c';

/** Tall window with white frame, a small cornice and a sill. */
const tallWindow = (x: number, y: number, w: number, h: number) =>
  shaded(rr(x - 5, y - 5, w + 10, h + 10, 3), [CREAM, '#d9d0bf'], LINE, -1, -1, 2) +
  windowAt(x, y, w, h, { line: LINE, r: 3, cross: true }) +
  shaded(rr(x - 9, y - 14, w + 18, 9, 3), [CREAM, '#d9d0bf'], LINE, -1, -1, 2);

function brickHouse(wall: Tone, doorTone: Tone): Prop {
  const foot: [number, number] = [5, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 5.1);
  const roofTop = ay - 4.75 * T;
  const facadeTop = ay - 3.6 * T;
  let s = shadow(ax, ay - 2, 2.7 * T, 12, 0.24);
  s += shaded(
    poly([
      [L - 6, facadeTop + 4],
      [L + 24, roofTop],
      [R - 24, roofTop],
      [R + 6, facadeTop + 4],
    ]),
    SLATE,
    LINE,
    -6,
    -6,
  );
  s += shaded(rr(R - 0.9 * T, roofTop - 30, 26, 44, 4), wall, LINE, -2, -2);
  s += shaded(rr(L, facadeTop, R - L, ay - facadeTop, 3), wall, LINE, -9, -4);
  s += bricks(L + 3, facadeTop + 3, R - L - 6, ay - facadeTop - 6, wall[1]);
  s += shaded(rr(L - 8, facadeTop - 4, R - L + 16, 14, 4), [CREAM, '#d9d0bf'], LINE, -2, -2);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 2; r++)
      s += tallWindow(L + 22 + c * 0.98 * T, facadeTop + 30 + r * 0.95 * T, 30, 44);
  s += shaded(rr(L - 4, ay - 1.05 * T, R - L + 8, 8, 3), [CREAM, '#d9d0bf'], LINE, -1, -1, 2);
  s += door(ax, ay - 2, 42, 0.9 * T, doorTone, LINE, true);
  s += tallWindow(L + 26, ay - 0.85 * T, 34, 0.6 * T);
  s += tallWindow(R - 60, ay - 0.85 * T, 34, 0.6 * T);
  return { w, h, ax, ay, foot, body: s };
}

/** The manor in the centre of the district: 13×6, portico with columns, pediment, mansard roof. */
function manor(): Prop {
  const foot: [number, number] = [13, 6];
  const { w, h, ax, ay, L, R } = frame(foot, 7.2, 0.3);
  const facadeTop = ay - 3.1 * T;
  const roofTop = ay - 5.3 * T;
  let s = shadow(ax, ay - 2, 6.8 * T, 18, 0.26);
  // chimneys behind the roof
  for (const x of [L + 1.5 * T, R - 1.5 * T - 30, ax - 3.4 * T, ax + 3.4 * T - 30])
    s +=
      shaded(rr(x, roofTop - 34, 30, 60, 4), BRICK, LINE, -2, -2) +
      shaded(rr(x - 4, roofTop - 38, 38, 10, 3), STONE, LINE, -1, -1, 2);
  // mansard roof with dormers
  s += shaded(
    poly([
      [L - 10, facadeTop + 6],
      [L + 30, roofTop],
      [R - 30, roofTop],
      [R + 10, facadeTop + 6],
    ]),
    SLATE,
    LINE,
    -8,
    -8,
  );
  s += stroke(`M${L + 36} ${roofTop + 8}H${R - 36}`, '#7a86a0', 6, 0.8);
  for (let i = 0; i < 6; i++) {
    const cx = L + 1.2 * T + i * ((R - L - 2.4 * T) / 5);
    if (Math.abs(cx - ax) < 2.2 * T) continue;
    s += shaded(
      poly([
        [cx - 22, roofTop + 70],
        [cx - 22, roofTop + 38],
        [cx, roofTop + 22],
        [cx + 22, roofTop + 38],
        [cx + 22, roofTop + 70],
      ]),
      MARBLE,
      LINE,
      -2,
      -2,
    );
    s += windowAt(cx - 12, roofTop + 42, 24, 24, { line: LINE, r: 10, cross: true });
  }
  // main facade
  s += shaded(rr(L, facadeTop, R - L, ay - facadeTop, 4), ['#f2e3c4', '#d8c59f'], LINE, -12, -5);
  s += shaded(rr(L - 10, facadeTop - 6, R - L + 20, 16, 4), [CREAM, '#d9d0bf'], LINE, -2, -2);
  s += shaded(rr(L - 6, ay - 1.55 * T, R - L + 12, 10, 3), [CREAM, '#d9d0bf'], LINE, -1, -1, 2);
  for (let c = 0; c < 12; c++) {
    const x = L + 0.35 * T + c * ((R - L - 0.7 * T) / 11);
    if (Math.abs(x + 17 - ax) < 2.6 * T) continue;
    s += tallWindow(x, facadeTop + 30, 34, 0.85 * T);
    s += tallWindow(x, ay - 1.25 * T, 34, 0.9 * T);
  }
  // central portico: projecting block, columns, pediment with a crown
  const pL = ax - 2.5 * T;
  const pR = ax + 2.5 * T;
  s += shaded(
    rr(pL, facadeTop - 10, pR - pL, ay - facadeTop + 8, 4),
    ['#f7ebd2', '#ddcba8'],
    LINE,
    -8,
    -4,
  );
  s += shaded(
    poly([
      [pL - 12, facadeTop - 8],
      [ax, facadeTop - 1.05 * T],
      [pR + 12, facadeTop - 8],
    ]),
    MARBLE,
    LINE,
    -4,
    -4,
  );
  s += flat(
    poly([
      [pL + 14, facadeTop - 14],
      [ax, facadeTop - 0.85 * T],
      [pR - 14, facadeTop - 14],
    ]),
    '#e2dacb',
    LINE,
    2,
  );
  s += flat(`M${ax - 16} ${facadeTop - 26}l6 -14l10 10l10 -10l6 14Z`, GOLD, LINE, 2.5);
  for (let i = 0; i < 5; i++) {
    const x = pL + 18 + i * ((pR - pL - 36) / 4);
    s += shaded(rr(x - 10, facadeTop + 4, 20, ay - facadeTop - 34, 3), MARBLE, LINE, -3, 0);
    s += stroke(
      `M${x - 3} ${facadeTop + 10}V${ay - 36}M${x + 4} ${facadeTop + 10}V${ay - 36}`,
      '#cdc5b5',
      2,
    );
    s += shaded(rr(x - 14, facadeTop, 28, 9, 2), MARBLE, LINE, -1, -1, 2);
  }
  s += tallWindow(ax - 1.3 * T, facadeTop + 30, 30, 0.8 * T);
  s += tallWindow(ax + 1.3 * T - 30, facadeTop + 30, 30, 0.8 * T);
  s += door(ax, ay - 30, 64, 1.35 * T, ['#5a3a6e', '#45294f'], LINE, true);
  // steps
  for (let i = 0; i < 3; i++)
    s += shaded(
      rr(ax - 1.4 * T - i * 10, ay - 30 + i * 10, 2.8 * T + i * 20, 11, 3),
      STONE,
      LINE,
      -1,
      -1,
      2,
    );
  // flag
  s += stroke(`M${ax} ${roofTop}V${roofTop - 70}`, '#3a3d4a', 4);
  s += flat(`M${ax + 2} ${roofTop - 70}h40l-8 12l8 12h-40Z`, '#b45cff', LINE, 2.5);
  return { w, h, ax, ay, foot, body: s };
}

function office(dome: boolean): Prop {
  const foot: [number, number] = [7, 4];
  const { w, h, ax, ay, L, R } = frame(foot, dome ? 6.3 : 5.2);
  const facadeTop = ay - 3.2 * T;
  const roofTop = ay - 4.4 * T;
  let s = shadow(ax, ay - 2, 3.7 * T, 14, 0.24);
  if (dome) {
    const dy = roofTop - 0.2 * T;
    s += shaded(rr(ax - 0.9 * T, dy, 1.8 * T, 0.6 * T, 4), MARBLE, LINE, -3, -3);
    s += shaded(
      `M${ax - 0.95 * T} ${dy + 2}Q${ax - 0.9 * T} ${dy - 1.2 * T} ${ax} ${dy - 1.25 * T}Q${ax + 0.9 * T} ${dy - 1.2 * T} ${ax + 0.95 * T} ${dy + 2}Z`,
      ['#6fc2a6', '#4f9f84'],
      LINE,
      -6,
      -6,
    );
    s += stroke(
      `M${ax - 0.45 * T} ${dy - 0.2 * T}Q${ax - 0.4 * T} ${dy - 0.9 * T} ${ax} ${dy - 1.05 * T}M${ax + 0.45 * T} ${dy - 0.2 * T}Q${ax + 0.4 * T} ${dy - 0.9 * T} ${ax} ${dy - 1.05 * T}`,
      '#4f9f84',
      3,
    );
    s += flat(circ(ax, dy - 1.3 * T, 9), GOLD, LINE, 2.5);
  }
  s += shaded(
    poly([
      [L - 8, facadeTop + 4],
      [L + 26, roofTop],
      [R - 26, roofTop],
      [R + 8, facadeTop + 4],
    ]),
    SLATE,
    LINE,
    -6,
    -6,
  );
  s += shaded(
    rr(L, facadeTop, R - L, ay - facadeTop, 4),
    dome ? MARBLE : ['#d9cdb8', '#bdb09a'],
    LINE,
    -10,
    -5,
  );
  if (!dome) s += bricks(L + 3, ay - 1.3 * T, R - L - 6, 1.3 * T - 6, '#a39782', 0.35);
  s += shaded(rr(L - 10, facadeTop - 6, R - L + 20, 16, 4), [CREAM, '#d9d0bf'], LINE, -2, -2);
  for (let c = 0; c < 6; c++) {
    const x = L + 0.4 * T + c * ((R - L - 0.8 * T - 30) / 5);
    if (Math.abs(x + 15 - ax) < 1.4 * T) continue;
    s += tallWindow(x, facadeTop + 28, 30, 0.75 * T);
    s += tallWindow(x, ay - 1.15 * T, 30, 0.8 * T);
  }
  // pediment with clock (office) or gold coin (bank)
  s += shaded(
    poly([
      [ax - 1.6 * T, facadeTop - 4],
      [ax, facadeTop - 0.85 * T],
      [ax + 1.6 * T, facadeTop - 4],
    ]),
    MARBLE,
    LINE,
    -3,
    -3,
  );
  if (dome)
    s +=
      flat(circ(ax, facadeTop - 0.35 * T, 14), GOLD, LINE, 2.5) +
      stroke(`M${ax - 5} ${facadeTop - 0.35 * T}h10`, '#b38a3e', 3);
  else
    s +=
      flat(circ(ax, facadeTop - 0.35 * T, 15), '#ffffff', LINE, 2.5) +
      stroke(`M${ax} ${facadeTop - 0.35 * T}v-9M${ax} ${facadeTop - 0.35 * T}l7 4`, LINE, 2.5);
  for (let i = 0; i < 4; i++) {
    const x = ax - 1.2 * T + i * 0.8 * T;
    s += shaded(rr(x - 9, facadeTop + 6, 18, ay - facadeTop - 26, 3), MARBLE, LINE, -3, 0);
  }
  s += door(ax, ay - 20, 56, 1.25 * T, ['#4a3a2a', '#352a1e'], LINE, true);
  for (let i = 0; i < 2; i++)
    s += shaded(
      rr(ax - 1.5 * T - i * 8, ay - 20 + i * 10, 3 * T + i * 16, 11, 3),
      STONE,
      LINE,
      -1,
      -1,
      2,
    );
  return { w, h, ax, ay, foot, body: s };
}

function topiary(ball: boolean): Prop {
  const w = 1.1 * T;
  const h = (ball ? 1.5 : 1.9) * T;
  const ax = w / 2;
  const ay = h - 6;
  const leaf = { base: '#3f9a4a', dark: '#2b7339', light: '#5fbd5a', line: '#16422a' };
  const pot = shaded(
    `M${ax - 18} ${ay - 22}H${ax + 18}L${ax + 14} ${ay}H${ax - 14}Z`,
    MARBLE,
    LINE,
    -2,
    -2,
    2.5,
  );
  const crown = ball
    ? puffs([[ax, ay - 52, 26]], leaf, '', 5)
    : shaded(
        `M${ax} ${ay - 1.75 * T}Q${ax + 26} ${ay - 0.8 * T} ${ax + 24} ${ay - 26}H${ax - 24}Q${ax - 26} ${ay - 0.8 * T} ${ax} ${ay - 1.75 * T}Z`,
        [leaf.base, leaf.dark],
        leaf.line,
        -5,
        -4,
      );
  return { w, h, ax, ay, foot: [1, 1], body: shadow(ax, ay, 22, 5) + crown + pot };
}

function statue(): Prop {
  const w = 1.2 * T;
  const h = 2.4 * T;
  const ax = w / 2;
  const ay = h - 6;
  const bronze: Tone = ['#6f9c8a', '#517a6a'];
  const line = '#2a3a33';
  return {
    w,
    h,
    ax,
    ay,
    foot: [1, 1],
    body:
      shadow(ax, ay, 30, 6) +
      shaded(rr(ax - 26, ay - 0.95 * T, 52, 0.95 * T, 4), MARBLE, LINE, -3, -2) +
      shaded(rr(ax - 30, ay - 0.95 * T - 8, 60, 10, 3), MARBLE, LINE, -1, -1, 2) +
      shaded(
        `M${ax - 18} ${ay - 0.95 * T - 8}Q${ax - 20} ${ay - 1.55 * T} ${ax} ${ay - 1.6 * T}Q${ax + 20} ${ay - 1.55 * T} ${ax + 18} ${ay - 0.95 * T - 8}Z`,
        bronze,
        line,
        -3,
        -3,
      ) +
      shaded(circ(ax, ay - 1.75 * T, 12), bronze, line, -2, -2) +
      shaded(rr(ax - 11, ay - 2.18 * T, 22, 20, 3), ['#3a3d4a', '#262833'], line, -1, -1, 2) +
      shaded(rr(ax - 17, ay - 1.92 * T, 34, 6, 3), ['#3a3d4a', '#262833'], line, -1, -1, 2),
  };
}

function carriage(): Prop {
  const foot: [number, number] = [3, 1];
  const { w, h, ax, ay } = frame(foot, 2, 0.1);
  const body: Tone = ['#5a2a3a', '#421f2b'];
  const x0 = ax - 1.1 * T;
  const x1 = ax + 1.1 * T;
  let s = shadow(ax, ay - 2, 1.3 * T, 9, 0.24);
  s += shaded(
    `M${x0 + 10} ${ay - 26}Q${x0} ${ay - 1.05 * T} ${x0 + 20} ${ay - 1.5 * T}H${x1 - 20}Q${x1} ${ay - 1.05 * T} ${x1 - 10} ${ay - 26}Z`,
    body,
    LINE,
    -6,
    -4,
  );
  s += stroke(`M${x0 + 16} ${ay - 34}H${x1 - 16}M${x0 + 22} ${ay - 1.42 * T}H${x1 - 22}`, GOLD, 3);
  s += windowAt(ax - 22, ay - 1.3 * T, 44, 30, { line: LINE, r: 6, glass: GLASS });
  s += shaded(
    rr(x0 + 14, ay - 1.62 * T, x1 - x0 - 28, 10, 4),
    ['#2b2e38', '#1d1f26'],
    LINE,
    -1,
    -1,
    2,
  );
  s += flat(rr(x1 - 14, ay - 1.2 * T, 10, 16, 3), '#ffe27a', LINE, 2);
  for (const [wx, r] of [
    [x0 + 22, 20],
    [x1 - 22, 17],
  ] as const) {
    s +=
      flat(circ(wx, ay - r + 2, r), '#3a2a20', LINE, 2.5) +
      flat(circ(wx, ay - r + 2, r - 6), 'none', GOLD, 2.5);
    s += stroke(
      `M${wx - r + 6} ${ay - r + 2}h${2 * r - 12}M${wx} ${ay - 2 * r + 8}v${2 * r - 12}`,
      GOLD,
      2,
    );
  }
  return { w, h, ax, ay, foot, body: s };
}

/**
 * The manor's stables, 5×3: white plastered walls on a red brick plinth, a red tile roof with a little cupola and a
 * gilded weather vane, three stalls with split doors (the top halves open, a horse looking out of two), a hay-loft
 * door under the gable, iron lanterns between the stalls and a water trough in front.
 */
function stable(): Prop {
  const foot: [number, number] = [5, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 4.3, 0.35);
  const plaster: Tone = ['#f4ecdc', '#d9ceb8'];
  const tile: Tone = ['#c35b40', '#97402c'];
  const green: Tone = ['#3f6b4a', '#2c4f36'];
  const wallTop = ay - 1.95 * T;
  const top = ay - 3.45 * T;
  let s = shadow(ax, ay - 2, 2.7 * T, 12, 0.24);
  // walls: plaster over a brick plinth
  s += shaded(rr(L + 4, wallTop, R - L - 8, ay - wallTop, 3), plaster, LINE, -8, -3);
  s += shaded(rr(L + 4, ay - 18, R - L - 8, 16, 2), BRICK, LINE, -1, -1, 2);
  s += bricks(L + 6, ay - 17, R - L - 12, 14, '#7a3424', 0.5);
  // the roof: tiles in rows, the ridge, a cupola with a weather vane
  s += shaded(
    poly([
      [L - 14, wallTop + 6],
      [ax - 0.9 * T, top],
      [ax + 0.9 * T, top],
      [R + 14, wallTop + 6],
    ]),
    tile,
    LINE,
    -6,
    -6,
  );
  let rows = '';
  for (let k = 1; k < 5; k++) {
    const y = top + (k * (wallTop + 6 - top)) / 5;
    const half = 0.9 * T + ((R + 14 - (ax + 0.9 * T)) * k) / 5;
    for (let x = ax - half; x < ax + half - 8; x += 12) rows += `M${n(x)} ${n(y)}q6 5 12 0`;
  }
  s += stroke(rows, '#7d3322', 1.6, 0.7);
  s += shaded(rr(ax - 0.95 * T, top - 6, 1.9 * T, 9, 3), ['#a34c36', '#86402f'], LINE, -1, -1, 2);
  s += shaded(rr(ax - 16, top - 40, 32, 34, 3), plaster, LINE, -2, -2, 2);
  s += fill(rr(ax - 9, top - 32, 18, 16, 6), '#3a2a20', 0.85);
  s += shaded(
    poly([
      [ax - 22, top - 38],
      [ax, top - 58],
      [ax + 22, top - 38],
    ]),
    green,
    LINE,
    -2,
    -2,
    2,
  );
  s += stroke(`M${n(ax)} ${n(top - 58)}V${n(top - 80)}`, '#6b5a2a', 2.4);
  s += shaded(`M${n(ax)} ${n(top - 78)}l16 4l-16 4Z`, ['#ffc93c', '#d98a0b'], LINE, -1, -1, 1.4);
  // the hay-loft door under the gable, hay peeking out
  s += shaded(
    rr(ax - 20, wallTop - 0.55 * T, 40, 0.5 * T, 3),
    ['#a07448', '#7f552f'],
    LINE,
    -2,
    -2,
    2,
  );
  s += shaded(
    `M${n(ax - 16)} ${n(wallTop - 0.08 * T)}q16 -12 32 0Z`,
    ['#e8cf7a', '#c9ad52'],
    '#8a7230',
    -1,
    -1,
    1.4,
  );
  // three stalls: split doors in the manor's green, the top halves open
  const stallW = (R - L - 40) / 3;
  for (let i = 0; i < 3; i++) {
    const x = L + 20 + i * stallW + 6;
    const dw = stallW - 12;
    const dTop = ay - 1.35 * T;
    s += fill(rr(x - 3, dTop - 3, dw + 6, ay - dTop, 3), '#2a1d16', 0.35);
    s += fill(rr(x, dTop, dw, 0.6 * T, 2), '#241814', 1); // the dark inside above
    if (i !== 1) {
      // a horse looking out: its head, a white blaze, an ear, the mane
      const hx = x + dw / 2;
      const hy = dTop + 0.42 * T;
      const coat: Tone = i === 0 ? ['#8a5a3a', '#6b4229'] : ['#3a2a22', '#261a14'];
      s += shaded(
        `M${n(hx - 9)} ${n(hy + 6)}Q${n(hx - 12)} ${n(hy - 16)} ${n(hx)} ${n(hy - 20)}Q${n(hx + 12)} ${n(hy - 14)} ${n(hx + 8)} ${n(hy + 8)}Z`,
        coat,
        '#1f140e',
        -1,
        -2,
        1.6,
      );
      s += fill(`M${n(hx - 2)} ${n(hy - 16)}l3 0l1 18l-5 0Z`, '#f4ecdc', 0.9);
      s += shaded(
        poly([
          [hx - 7, hy - 16],
          [hx - 4, hy - 26],
          [hx - 1, hy - 18],
        ]),
        coat,
        '#1f140e',
        0,
        0,
        1.2,
      );
      s += fill(circ(hx - 5, hy - 8, 1.5), '#111111') + fill(circ(hx + 5, hy - 8, 1.5), '#111111');
    }
    s += shaded(rr(x, dTop + 0.6 * T, dw, ay - dTop - 0.6 * T - 4, 2), green, LINE, -2, -2, 2);
    s += stroke(
      `M${n(x + 2)} ${n(dTop + 0.6 * T + 2)}L${n(x + dw - 2)} ${n(ay - 6)}M${n(x + dw - 2)} ${n(dTop + 0.6 * T + 2)}L${n(x + 2)} ${n(ay - 6)}`,
      CREAM,
      2.4,
      0.9,
    );
    s += shaded(rr(x - 4, dTop - 7, dw + 8, 7, 2), ['#e0d6c2', '#bfb39a'], LINE, -1, -1, 1.6); // the lintel
  }
  // lanterns between the stalls
  for (const lx of [L + 20 + stallW, L + 20 + 2 * stallW]) {
    s += stroke(`M${n(lx)} ${n(ay - 1.55 * T)}h6`, '#2a2d36', 2);
    s += shaded(rr(lx + 2, ay - 1.55 * T, 10, 14, 2), ['#3a3e48', '#24272e'], LINE, -1, -1, 1.2);
    s += fill(rr(lx + 4, ay - 1.55 * T + 3, 6, 8, 1), '#ffe3a1', 0.95);
  }
  // a stone water trough in front
  s += shaded(rr(R - 0.95 * T, ay - 16, 0.7 * T, 14, 3), STONE, LINE, -1, -1, 1.8);
  s += fill(rr(R - 0.95 * T + 4, ay - 14, 0.7 * T - 8, 4, 2), '#7fd6f2', 0.9);
  return { w, h, ax, ay, foot, body: s };
}

const roses = (): Prop => ({
  w: 52,
  h: 40,
  ax: 26,
  ay: 34,
  flat: true,
  body:
    `<ellipse cx="26" cy="28" rx="20" ry="7" fill="#2b7339"/>` +
    [
      [14, 22],
      [26, 18],
      [38, 22],
      [20, 28],
      [32, 28],
    ]
      .map(
        ([x, y]) =>
          `<circle cx="${x}" cy="${y}" r="5.5" fill="#e83a4a" stroke="#7a1c2a" stroke-width="1.5"/><circle cx="${x! - 1}" cy="${y! - 1}" r="2" fill="#ff8f9a"/>`,
      )
      .join(''),
});

const hay = (): Prop => {
  const w = 1.1 * T;
  const h = 0.9 * T;
  const ax = w / 2;
  const ay = h - 6;
  return {
    w,
    h,
    ax,
    ay,
    foot: [1, 1],
    body:
      shadow(ax, ay, 30, 6) +
      shaded(rr(ax - 30, ay - 40, 60, 40, 12), ['#e8c86a', '#c9a64a'], '#7a5a22', -4, -3) +
      stroke(`M${ax - 24} ${ay - 28}h48M${ax - 26} ${ay - 16}h52`, '#c9a64a', 2.5) +
      stroke(`M${ax - 10} ${ay - 40}v40M${ax + 12} ${ay - 40}v40`, '#a3502e', 3),
  };
};

const wall = fenceKit(BRICK, LINE, { postW: 20, postH: 46 });

export const MANOR: Record<string, Prop> = {
  dworek: manor(),
  'kamienica-cegla-a': brickHouse(BRICK, ['#3a6e5a', '#2c5545']),
  'kamienica-cegla-b': brickHouse(BRICK_DARK, ['#5a3a6e', '#45294f']),
  urzad: office(false),
  bank: office(true),
  'latarnia-gaz': lamp(true),
  'topiary-stozek': topiary(false),
  'topiary-kula': topiary(true),
  'fontanna-duza': fountain(MARBLE, true),
  posag: statue(),
  powoz: carriage(),
  'lawka-park': bench(['#3a3d4a', '#262833'], ['#262833', '#1a1c22'], true),
  roze: roses(),
  stajnia: stable(),
  siano: hay(),
  'mur-post': wall.post,
  'mur-h': wall.h,
  'mur-v': wall.v,
};
