// Chinatown: lacquered red and gold, sweeping tiled roofs, paper lanterns, bamboo and cherry trees. Signs carry shapes,
// never made-up characters: a lantern, a bowl, a teapot, a fish.
import {
  STONE,
  STONE_LINE,
  T,
  WOOD,
  WOOD_LINE,
  circ,
  fill,
  flat,
  frame,
  n,
  puffs,
  rr,
  shaded,
  shadow,
  stroke,
  type Prop,
  type Tone,
} from './kit';

const LINE = '#3a1712';
const RED: Tone = ['#d43a2c', '#a4261d'];
const RED_DARK: Tone = ['#a4261d', '#7a1913'];
const GOLD: Tone = ['#f4c430', '#c9941a'];
const ROOF: Tone = ['#2f6f6a', '#1f4f4c'];
const ROOF_RED: Tone = ['#b5382b', '#86241b'];
const PAPER: Tone = ['#f6ead0', '#dcc9a2'];
const CHERRY = { base: '#f6a8c4', dark: '#d97da3', light: '#fcd2e0', line: '#8f3f64' };

/** A sweeping tiled roof: its eaves turn up at both ends. (cx, y) is the middle of the ridge. */
function sweep(cx: number, y: number, w: number, h: number, tone: Tone = ROOF) {
  const l = cx - w / 2;
  const r = cx + w / 2;
  const inset = w * 0.16;
  let s = shaded(
    `M${n(l + inset)} ${n(y)}H${n(r - inset)}Q${n(r - inset * 0.3)} ${n(y + h * 0.7)} ${n(r + 6)} ${n(y + h * 0.72)}L${n(r)} ${n(y + h)}H${n(l)}L${n(l - 6)} ${n(y + h * 0.72)}Q${n(l + inset * 0.3)} ${n(y + h * 0.7)} ${n(l + inset)} ${n(y)}Z`,
    tone,
    LINE,
    -3,
    -4,
    3,
  );
  // rows of tiles
  for (let i = 1; i < 3; i++) {
    const ty = y + (h * i) / 3;
    s += stroke(`M${n(l + 8)} ${n(ty)}H${n(r - 8)}`, tone[1], 2.2);
  }
  for (let x = l + 14; x < r - 8; x += 14)
    s += stroke(`M${n(x)} ${n(y + h * 0.2)}V${n(y + h - 4)}`, tone[1], 1.2, 0.5);
  // gold ridge and upturned tips
  s += flat(rr(l + inset - 4, y - 5, w - 2 * inset + 8, 8, 3), GOLD[0], LINE, 2.5);
  s += fill(circ(l - 5, y + h * 0.7, 3.4), GOLD[0]) + fill(circ(r + 5, y + h * 0.7, 3.4), GOLD[0]);
  return s;
}

/** A red paper lantern hanging at (x, y). */
function lantern(x: number, y: number, r = 11, tone: Tone = RED) {
  return (
    stroke(`M${n(x)} ${n(y - r - 7)}V${n(y - r)}`, LINE, 1.8) +
    flat(rr(x - r * 0.5, y - r - 2, r, 3.4, 1), GOLD[0], LINE, 1.4) +
    shaded(
      `M${n(x - r)} ${n(y)}Q${n(x - r)} ${n(y - r)} ${n(x)} ${n(y - r)}Q${n(x + r)} ${n(y - r)} ${n(x + r)} ${n(y)}Q${n(x + r)} ${n(y + r)} ${n(x)} ${n(y + r)}Q${n(x - r)} ${n(y + r)} ${n(x - r)} ${n(y)}Z`,
      tone,
      LINE,
      -2,
      -2,
      2,
    ) +
    stroke(
      `M${n(x - r * 0.45)} ${n(y - r * 0.8)}V${n(y + r * 0.8)}M${n(x + r * 0.45)} ${n(y - r * 0.8)}V${n(y + r * 0.8)}`,
      tone[1],
      1.3,
    ) +
    fill(circ(x - r * 0.4, y - r * 0.35, r * 0.2), '#ffd9b0', 0.8) +
    flat(rr(x - r * 0.5, y + r - 1, r, 3, 1), GOLD[0], LINE, 1.4) +
    stroke(`M${n(x)} ${n(y + r + 2)}v${n(r * 0.7)}`, GOLD[1], 1.6)
  );
}

/** A lacquered column. */
const column = (x: number, top: number, bottom: number, w = 12, tone: Tone = RED) =>
  shaded(rr(x - w / 2, top, w, bottom - top, 2), tone, LINE, -2, 0, 2.5) +
  flat(rr(x - w / 2 - 2, bottom - 5, w + 4, 6, 1.5), STONE[0], STONE_LINE, 1.6) +
  flat(rr(x - w / 2 - 1, top - 2, w + 2, 5, 1.5), GOLD[0], LINE, 1.4);

/** Lattice shutters over a window or a door. */
function lattice(x: number, y: number, w: number, h: number, tone: Tone = PAPER) {
  let s = flat(rr(x, y, w, h, 2), tone[0], LINE, 2.2);
  for (let i = 1; i < 3; i++)
    s += stroke(`M${n(x + (w * i) / 3)} ${n(y)}V${n(y + h)}`, RED_DARK[0], 1.6);
  for (let i = 1; i < 4; i++)
    s += stroke(`M${n(x)} ${n(y + (h * i) / 4)}H${n(x + w)}`, RED_DARK[0], 1.6);
  return s;
}

/** A hanging round sign with a picture on it. */
const roundSign = (x: number, y: number, picture: string) =>
  flat(circ(x, y, 15), GOLD[0], LINE, 2.4) +
  flat(circ(x, y, 11.5), RED_DARK[0], LINE, 1.4) +
  picture;

const SIGN = {
  miska: (x: number, y: number) =>
    flat(
      `M${x - 8} ${y - 1}H${x + 8}Q${x + 7} ${y + 8} ${x} ${y + 8}Q${x - 7} ${y + 8} ${x - 8} ${y - 1}Z`,
      '#fff4d8',
      LINE,
      1.2,
    ) +
    stroke(
      `M${x + 1} ${y - 2}L${x + 8} ${y - 9}M${x + 4} ${y - 2}L${x + 10} ${y - 7}`,
      '#fff4d8',
      1.4,
    ),
  czajnik: (x: number, y: number) =>
    flat(circ(x, y + 1, 6.5), '#fff4d8', LINE, 1.2) +
    stroke(`M${x + 6} ${y}q5 -1 5 -5M${x - 6} ${y - 2}q-5 1 -4 5`, '#fff4d8', 1.6),
  ryba: (x: number, y: number) =>
    flat(
      `M${x - 8} ${y}Q${x - 1} ${y - 7} ${x + 5} ${y}Q${x - 1} ${y + 7} ${x - 8} ${y}ZM${x + 5} ${y}L${x + 10} ${y - 4}V${y + 4}Z`,
      '#fff4d8',
      LINE,
      1.1,
    ),
  lampion: (x: number, y: number) =>
    flat(circ(x, y, 7), '#fff4d8', LINE, 1.2) + stroke(`M${x} ${y - 7}V${y + 7}`, RED[1], 1.3),
};

// ---------- the gate ----------

/** The great gate over the road: three bays, the middle one high, stacked roofs, lanterns. */
function gate(): Prop {
  const f = frame([9, 1], 6.2, 0.7);
  const { w, h, ax, ay } = f;
  const span = 4.1 * T;
  const top = ay - 3.1 * T;
  let s = shadow(ax, ay, span + 24, 9);
  for (const x of [ax - span, ax + span])
    s += flat(rr(x - 15, ay - 12, 30, 15, 3), STONE[0], STONE_LINE, 2);
  for (const x of [ax - span, ax - 1.3 * T, ax + 1.3 * T, ax + span]) {
    s += column(x, x === ax - span || x === ax + span ? top + 32 : top, ay - 2, 17);
  }
  // beams: the middle span is higher than the sides
  s += shaded(rr(ax - span - 6, top + 44, span * 2 + 12, 16, 2), RED, LINE, 0, -2, 2.5);
  s += shaded(rr(ax - 1.45 * T, top + 8, 2.9 * T, 26, 2), RED_DARK, LINE, 0, -2, 2.5);
  for (let x = ax - 1.2 * T; x < ax + 1.2 * T; x += 24)
    s += fill(circ(x + 12, top + 21, 5), GOLD[0]);
  s += sweep(ax - span * 0.65, top + 6, 2.4 * T, 40, ROOF);
  s += sweep(ax + span * 0.65, top + 6, 2.4 * T, 40, ROOF);
  s += sweep(ax, top - 42, 3.8 * T, 52, ROOF);
  // a medallion with a dragon's coil in the middle
  s +=
    flat(circ(ax, top + 21, 19), GOLD[0], LINE, 2.8) +
    stroke(`M${ax - 10} ${top + 26}q5 -14 10 -5t10 -6`, RED_DARK[1], 3.4);
  for (const x of [ax - 2.7 * T, ax - 0.65 * T, ax + 0.65 * T, ax + 2.7 * T])
    s += lantern(x, top + 88, 12);
  return { w, h, ax, ay, body: s, foot: [9, 1] };
}

// ---------- buildings ----------

/** A shop house: stone below, lattice above, an awning, a round sign. */
function shop(tone: Tone, roof: Tone, sign: keyof typeof SIGN, wide = false): Prop {
  const foot: [number, number] = wide ? [7, 3] : [5, 3];
  const f = frame(foot, 4.6);
  const { w, h, ax, ay, L, R } = f;
  const top = ay - 2.9 * T;
  let s = shadow(ax, ay, (R - L) / 2 + 8, 9);
  s += shaded(rr(L + 6, top, R - L - 12, ay - top, 3), tone, LINE, -4, -3, 3);
  s += flat(rr(L + 6, ay - 12, R - L - 12, 12, 2), STONE[0], STONE_LINE, 2);
  const floors = top + 16;
  const count = wide ? 4 : 3;
  const gap = (R - L - 40) / count;
  for (let i = 0; i < count; i++) s += lattice(L + 22 + i * gap, floors, gap - 12, 42);
  // a beam with lanterns, and the shopfront
  s += shaded(rr(L + 2, top + 72, R - L - 4, 11, 2), RED_DARK, LINE, 0, -1, 2);
  s += flat(rr(ax - 21, ay - 64, 42, 64, 3), WOOD[1], LINE, 2.5);
  s += lattice(ax - 18, ay - 60, 17, 44) + lattice(ax + 1, ay - 60, 17, 44);
  s += lattice(L + 14, ay - 58, ax - L - 44, 40, ['#ffe7a8', '#e8c978']);
  s += lattice(ax + 30, ay - 58, R - ax - 44, 40, ['#ffe7a8', '#e8c978']);
  s += sweep(ax, top - 42, R - L + 18, 50, roof);
  s += lantern(L + 22, top + 104, 10) + lantern(R - 22, top + 104, 10);
  s += roundSign(ax, top + 46, SIGN[sign](ax, top + 46));
  return { w, h, ax, ay, body: s, foot };
}

/** The tea house: raised on a stone plinth, two roofs, paper walls. */
function teaHouse(): Prop {
  const foot: [number, number] = [7, 4];
  const { w, h, ax, ay, L, R } = frame(foot, 5.2);
  const top = ay - 2.6 * T;
  let s = shadow(ax, ay, (R - L) / 2 + 10, 10);
  s += shaded(rr(L + 2, ay - 18, R - L - 4, 18, 3), STONE, STONE_LINE, -3, -2, 2.5);
  s += shaded(rr(L + 16, top, R - L - 32, ay - top - 16, 2), PAPER, LINE, -3, -2, 3);
  for (const x of [L + 22, ax - 40, ax + 40, R - 22]) s += column(x, top + 4, ay - 16, 11);
  s += lattice(L + 34, top + 16, ax - L - 82, 62) + lattice(ax + 48, top + 16, R - ax - 82, 62);
  s +=
    flat(rr(ax - 25, ay - 84, 50, 68, 3), WOOD[1], LINE, 2.5) + lattice(ax - 21, ay - 80, 42, 58);
  s += flat(rr(ax - 30, ay - 16, 60, 8, 2), STONE[1], STONE_LINE, 1.6);
  s += sweep(ax, top - 28, R - L + 34, 40, ROOF);
  s += flat(rr(ax - 52, top - 60, 104, 34, 2), RED[0], LINE, 2.5);
  s += sweep(ax, top - 96, 200, 42, ROOF);
  s += roundSign(ax, top - 43, SIGN.czajnik(ax, top - 43));
  s += lantern(L + 26, top + 20, 11) + lantern(R - 26, top + 20, 11);
  return { w, h, ax, ay, body: s, foot };
}

/** The tall pagoda: five floors, each narrower, a spire. */
function pagoda(): Prop {
  const foot: [number, number] = [7, 5];
  const { w, h, ax, ay, L, R } = frame(foot, 10.4, 1);
  let s = shadow(ax, ay, (R - L) / 2 + 12, 11);
  s += shaded(rr(L, ay - 16, R - L, 16, 3), STONE, STONE_LINE, -3, -2, 2.5);
  let y = ay - 16;
  let width = R - L - 48;
  const storey = 88;
  for (let i = 0; i < 5; i++) {
    const wall = width;
    s += shaded(rr(ax - wall / 2, y - storey + 12, wall, storey - 12, 2), RED, LINE, -3, -1, 2.5);
    const cols = Math.max(2, 4 - i);
    for (let c = 0; c < cols; c++) {
      const gap = wall / cols;
      s += lattice(ax - wall / 2 + c * gap + 7, y - storey + 26, gap - 14, 40, [
        '#ffe7a8',
        '#e8c978',
      ]);
    }
    if (i === 0)
      s +=
        flat(rr(ax - 18, y - 64, 36, 64, 3), WOOD[1], LINE, 2.5) + lattice(ax - 15, y - 61, 30, 52);
    s += sweep(ax, y - storey - 18, wall + 56, 34, ROOF);
    s +=
      lantern(ax - wall / 2 - 16, y - storey + 34, 7) +
      lantern(ax + wall / 2 + 16, y - storey + 34, 7);
    y -= storey + 2;
    width -= 28;
  }
  s += shaded(rr(ax - 4, y - 54, 8, 40, 2), GOLD, LINE, -1, 0, 2);
  for (const r of [12, 9, 6]) s += flat(circ(ax, y - 34 - (12 - r) * 3, r), GOLD[0], LINE, 2);
  return { w, h, ax, ay, body: s, foot };
}

/** The training hall: a wide roof, open front, a sand-coloured wall. */
function dojo(): Prop {
  const foot: [number, number] = [7, 4];
  const { w, h, ax, ay, L, R } = frame(foot, 4.8);
  const top = ay - 2.4 * T;
  let s = shadow(ax, ay, (R - L) / 2 + 10, 10);
  s += shaded(rr(L + 8, top, R - L - 16, ay - top, 2), ['#e7cf9a', '#c6ac74'], LINE, -3, -2, 3);
  s += flat(rr(L + 8, ay - 14, R - L - 16, 14, 2), STONE[1], STONE_LINE, 2);
  for (const x of [L + 16, ax - 36, ax + 36, R - 16]) s += column(x, top + 2, ay - 6, 12, RED_DARK);
  s += flat(rr(ax - 28, ay - 86, 56, 86, 2), '#3a2a22', LINE, 2.5);
  s += stroke(`M${ax} ${ay - 84}V${ay - 2}`, '#6d5243', 2);
  s += lattice(L + 30, top + 18, ax - L - 74, 56) + lattice(ax + 44, top + 18, R - ax - 74, 56);
  s += sweep(ax, top - 42, R - L + 30, 50, ROOF_RED);
  s += roundSign(
    ax,
    top + 2,
    flat(circ(ax, top + 2, 7), '#fff4d8', LINE, 1.2) +
      stroke(`M${ax - 6} ${top + 5}q6 -9 12 0`, RED[1], 2),
  );
  return { w, h, ax, ay, body: s, foot };
}

// ---------- street things ----------

function stall(roof: Tone, goods: string): Prop {
  const { w, h, ax, ay, L, R } = frame([3, 2], 2.9);
  let s = shadow(ax, ay, (R - L) / 2 + 2, 7);
  s += shaded(rr(L + 6, ay - 44, R - L - 12, 44, 3), WOOD, WOOD_LINE, -3, -2, 2.4);
  s += flat(rr(L + 2, ay - 52, R - L - 4, 12, 3), '#e3c183', WOOD_LINE, 2);
  s += goods;
  for (const x of [L + 8, R - 8]) s += stroke(`M${x} ${ay - 50}V${ay - 118}`, WOOD_LINE, 4.5);
  // a striped roof with a scalloped edge
  s += shaded(
    `M${L - 6} ${ay - 104}L${L + 16} ${ay - 148}H${R - 16}L${R + 6} ${ay - 104}Z`,
    roof,
    LINE,
    -2,
    -3,
    2.5,
  );
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    s += stroke(
      `M${n(L - 6 + (R - L + 12) * t)} ${ay - 104}L${n(L + 16 + (R - L - 32) * t)} ${ay - 148}`,
      roof[1],
      3,
    );
  }
  s += lantern(ax, ay - 78, 8);
  return { w, h, ax, ay, body: s, foot: [3, 2] };
}

const GOODS = {
  makaron: (ax: number, ay: number) =>
    [-28, 0, 28]
      .map(
        (d) =>
          flat(
            `M${ax + d - 12} ${ay - 58}H${ax + d + 12}Q${ax + d + 10} ${ay - 46} ${ax + d} ${ay - 46}Q${ax + d - 10} ${ay - 46} ${ax + d - 12} ${ay - 58}Z`,
            '#fff4d8',
            LINE,
            1.5,
          ) + stroke(`M${ax + d - 8} ${ay - 60}q8 -6 16 0`, '#e8c978', 2.6),
      )
      .join(''),
  owoce: (ax: number, ay: number) =>
    [-30, -14, 2, 18, 32]
      .map((d, i) => flat(circ(ax + d, ay - 60, 7), i % 2 ? '#ff9a2e' : '#e23f3f', LINE, 1.5))
      .join(''),
  herbata: (ax: number, ay: number) =>
    [-26, 0, 26]
      .map(
        (d, i) =>
          flat(
            rr(ax + d - 9, ay - 72, 18, 20, 2),
            ['#2f6f6a', '#b5382b', '#c9941a'][i]!,
            LINE,
            1.6,
          ) + fill(rr(ax + d - 5, ay - 66, 10, 7, 1), '#fff4d8'),
      )
      .join(''),
};

function standLantern(): Prop {
  const { w, h, ax, ay } = frame([1, 1], 2.5, 0.2);
  let s = shadow(ax, ay, 15, 5);
  s += flat(rr(ax - 11, ay - 9, 22, 10, 3), STONE[0], STONE_LINE, 2);
  s += shaded(rr(ax - 3.5, ay - 94, 7, 88, 2), RED_DARK, LINE, -1, 0, 2);
  s += stroke(`M${ax} ${ay - 94}Q${ax + 26} ${ay - 108} ${ax + 24} ${ay - 82}`, LINE, 3);
  s += lantern(ax + 24, ay - 66, 11);
  return { w, h, ax, ay, body: s, foot: [1, 1] };
}

function stringLights(): Prop {
  const { w, h, ax, ay, L, R } = frame([5, 1], 3.6, 0.2);
  let s = shadow(ax, ay, (R - L) / 2 + 4, 4);
  for (const x of [L + 8, R - 8]) s += column(x, ay - 3.1 * T, ay, 9, RED_DARK);
  const y = ay - 3.1 * T + 8;
  s += stroke(`M${L + 8} ${y}Q${ax} ${y + 46} ${R - 8} ${y}`, LINE, 2.4);
  for (const t of [0.17, 0.39, 0.61, 0.83]) {
    const x = L + 8 + (R - L - 16) * t;
    const sag = 4 * t * (1 - t) * 23;
    s += lantern(x, y + sag + 20, 10, t < 0.5 ? RED : ['#f4a12a', '#c97a14']);
  }
  return { w, h, ax, ay, body: s, foot: [1, 1] };
}

function lion(): Prop {
  const { w, h, ax, ay } = frame([1, 1], 2, 0.3);
  const body: Tone = ['#c9c0b0', '#9d9485'];
  let s = shadow(ax, ay, 22, 6);
  s += shaded(rr(ax - 22, ay - 16, 44, 17, 3), STONE, STONE_LINE, -2, -2, 2.2);
  // the back and the front legs of a sitting guardian
  s += shaded(rr(ax - 16, ay - 46, 32, 32, 8), body, STONE_LINE, -2, -3, 2.4);
  for (const d of [-9, 9])
    s += shaded(rr(ax + d - 5, ay - 36, 10, 22, 4), body, STONE_LINE, -1, -1, 2);
  s +=
    flat(circ(ax + 13, ay - 21, 8), GOLD[0], LINE, 1.8) +
    stroke(`M${ax + 8} ${ay - 22}q5 -5 10 0`, GOLD[1], 1.6);
  // a mane of curls round a broad face
  for (let i = 0; i < 9; i++) {
    const a2 = (i / 9) * Math.PI * 2;
    s += flat(
      circ(ax + Math.cos(a2) * 19, ay - 66 + Math.sin(a2) * 19, 8),
      '#b3aa9a',
      STONE_LINE,
      1.8,
    );
  }
  s += shaded(circ(ax, ay - 66, 17), ['#d8d0c1', '#a79e8e'], STONE_LINE, -3, -3, 2.4);
  for (const d of [-7, 7]) {
    s += stroke(`M${ax + d - 4} ${ay - 74}q4 -4 8 0`, '#5d5853', 2.2);
    s += fill(circ(ax + d, ay - 69, 2.6), '#3a2a22');
  }
  s += flat(rr(ax - 4, ay - 66, 8, 5, 2), '#8f8678', STONE_LINE, 1.4);
  s += flat(
    `M${ax - 9} ${ay - 59}Q${ax} ${ay - 52} ${ax + 9} ${ay - 59}Q${ax} ${ay - 56} ${ax - 9} ${ay - 59}Z`,
    '#a4261d',
    STONE_LINE,
    1.4,
  );
  return { w, h, ax, ay, body: s, foot: [1, 1] };
}

function dragon(): Prop {
  const { w, h, ax, ay, L, R } = frame([5, 3], 5.2, 0.5);
  let s = shadow(ax, ay, (R - L) / 2, 9);
  s += shaded(rr(L + 6, ay - 26, R - L - 12, 26, 4), STONE, STONE_LINE, -3, -3, 2.5);
  s += stroke(`M${L + 12} ${ay - 13}H${R - 12}`, STONE[1], 2);
  // a coiled body in lacquered green and gold scales
  const path = `M${ax - 96} ${ay - 34}C${ax - 86} ${ay - 150} ${ax - 12} ${ay - 150} ${ax - 16} ${ay - 76}S${ax + 70} ${ay - 18} ${ax + 74} ${ay - 94}S${ax + 26} ${ay - 190} ${ax - 6} ${ay - 178}`;
  s += stroke(path, LINE, 31) + stroke(path, '#2f8f6a', 25) + stroke(path, '#58c28e', 11);
  s += `<path d="${path}" fill="none" stroke="${GOLD[0]}" stroke-width="5" stroke-dasharray="3 13" stroke-linecap="round"/>`;
  // the head
  const hx = ax - 18;
  const hy = ay - 186;
  s += shaded(
    `M${hx + 26} ${hy - 20}Q${hx - 8} ${hy - 34} ${hx - 34} ${hy - 12}L${hx - 62} ${hy - 6}Q${hx - 66} ${hy + 8} ${hx - 50} ${hy + 12}L${hx - 22} ${hy + 20}Q${hx + 22} ${hy + 26} ${hx + 26} ${hy - 20}Z`,
    ['#2f8f6a', '#1f6a4e'],
    LINE,
    -3,
    -3,
    3,
  );
  s += flat(circ(hx - 22, hy - 8, 6.5), '#fff4d8', LINE, 2) + fill(circ(hx - 24, hy - 8, 3), LINE);
  s += stroke(
    `M${hx + 4} ${hy - 28}q18 -24 34 -16M${hx - 8} ${hy - 30}q6 -26 26 -30`,
    GOLD[1],
    4.4,
  );
  s += stroke(`M${hx - 56} ${hy + 8}q-12 12 -26 6M${hx - 52} ${hy - 6}q-14 -8 -26 -2`, GOLD[0], 3);
  s += flat(circ(hx - 58, hy + 22, 9), '#ff7a33', LINE, 2);
  return { w, h, ax, ay, body: s, foot: [5, 3] };
}

function bamboo(tall: number, seed: number): Prop {
  const { w, h, ax, ay } = frame([1, 1], tall + 0.4, 0.7);
  let s = shadow(ax, ay, 22, 6);
  const stems = [-14, 0, 13];
  stems.forEach((d, i) => {
    const top = ay - T * tall + ((i * 17 + seed * 5) % 34);
    s +=
      stroke(`M${ax + d} ${ay}V${top}`, '#3f7a35', 8.5) +
      stroke(`M${ax + d - 1} ${ay}V${top}`, '#79b84f', 5.5);
    for (let y = ay - 20; y > top + 8; y -= 26) s += stroke(`M${ax + d - 4} ${y}h8`, '#2d5a26', 2);
    for (let y = top + 8; y < ay - 42; y += 26) {
      const side = (y + i) % 2 ? 1 : -1;
      s += fill(
        `M${ax + d} ${y}q${side * 14} -9 ${side * 28} -1q${side * -14} 6 ${side * -28} 1Z`,
        '#4f9e45',
      );
      s += fill(
        `M${ax + d} ${y + 7}q${side * -12} -6 ${side * -22} 1q${side * 11} 5 ${side * 22} -1Z`,
        '#6dbb5a',
      );
    }
  });
  return { w, h, ax, ay, body: s, foot: [1, 1] };
}

function cherry(): Prop {
  const { w, h, ax, ay } = frame([1, 1], 4.2, 1.2);
  let s = shadow(ax, ay, 34, 9);
  s += stroke(
    `M${ax} ${ay}Q${ax - 8} ${ay - 60} ${ax + 3} ${ay - 104}M${ax - 3} ${ay - 66}Q${ax - 34} ${ay - 90} ${ax - 44} ${ay - 112}M${ax + 2} ${ay - 78}Q${ax + 30} ${ay - 98} ${ax + 40} ${ay - 122}`,
    '#5a3026',
    15,
  );
  s += stroke(
    `M${ax} ${ay}Q${ax - 8} ${ay - 60} ${ax + 3} ${ay - 104}M${ax - 3} ${ay - 66}Q${ax - 34} ${ay - 90} ${ax - 44} ${ay - 112}M${ax + 2} ${ay - 78}Q${ax + 30} ${ay - 98} ${ax + 40} ${ay - 122}`,
    '#7a4635',
    10,
  );
  s += puffs(
    [
      [ax - 44, ay - 134, 34],
      [ax + 44, ay - 138, 36],
      [ax, ay - 168, 44],
      [ax - 16, ay - 122, 28],
      [ax + 18, ay - 120, 28],
    ],
    CHERRY,
    '',
    5,
  );
  return { w, h, ax, ay, body: s, foot: [1, 1] };
}

function redBridge(): Prop {
  const { w, h, ax, ay, L, R } = frame([5, 1], 2.4, 0.3);
  let s = '';
  const arch = `M${L} ${ay - 6}Q${ax} ${ay - 74} ${R} ${ay - 6}L${R - 8} ${ay + 2}Q${ax} ${ay - 54} ${L + 8} ${ay + 2}Z`;
  s += shaded(arch, RED, LINE, -2, -3, 3);
  for (const t of [0.14, 0.32, 0.5, 0.68, 0.86]) {
    const x = L + (R - L) * t;
    const y = ay - 6 - 4 * t * (1 - t) * 34;
    s += stroke(`M${n(x)} ${n(y)}v-24`, RED_DARK[1], 4.4) + fill(circ(x, y - 25, 4.4), GOLD[0]);
  }
  s += stroke(`M${L + 10} ${ay - 34}Q${ax} ${ay - 98} ${R - 10} ${ay - 34}`, RED_DARK[0], 4);
  return { w, h, ax, ay, body: s, foot: [5, 1] };
}

function incense(): Prop {
  const { w, h, ax, ay } = frame([1, 1], 1.5, 0.2);
  let s = shadow(ax, ay, 16, 5);
  for (const d of [-9, 9]) s += stroke(`M${ax + d} ${ay}v-10`, '#5c4a32', 4.4);
  s += shaded(
    `M${ax - 18} ${ay - 34}H${ax + 18}L${ax + 12} ${ay - 8}H${ax - 12}Z`,
    ['#b78f34', '#8a6a22'],
    LINE,
    -2,
    -2,
    2.4,
  );
  for (const d of [-6, 0, 6])
    s +=
      stroke(`M${ax + d} ${ay - 34}v-24`, '#8a3f2a', 2.2) +
      fill(circ(ax + d, ay - 59, 2), '#ff7a33');
  s += stroke(`M${ax} ${ay - 62}q-7 -8 0 -16t0 -16`, '#ffffff', 2.2, 0.5);
  return { w, h, ax, ay, body: s, foot: [1, 1] };
}

function drumRack(): Prop {
  const { w, h, ax, ay } = frame([3, 1], 2.5, 0.2);
  let s = shadow(ax, ay, 44, 6);
  s += stroke(
    `M${ax - 34} ${ay}L${ax - 22} ${ay - 76}M${ax + 34} ${ay}L${ax + 22} ${ay - 76}`,
    WOOD_LINE,
    6,
  );
  s += shaded(rr(ax - 36, ay - 94, 72, 54, 18), RED, LINE, -3, -2, 2.8);
  s += flat(
    `M${ax - 21} ${ay - 94}Q${ax} ${ay - 104} ${ax + 21} ${ay - 94}Q${ax} ${ay - 84} ${ax - 21} ${ay - 94}Z`,
    PAPER[0],
    LINE,
    2,
  );
  for (let x = ax - 30; x <= ax + 30; x += 12) s += fill(circ(x, ay - 43, 2), GOLD[0]);
  return { w, h, ax, ay, body: s, foot: [3, 1] };
}

function koiStone(): Prop {
  const { w, h, ax, ay } = frame([1, 1], 1, 0.1);
  const s =
    fill(
      `M${ax - 16} ${ay - 18}Q${ax - 4} ${ay - 30} ${ax + 9} ${ay - 18}Q${ax - 4} ${ay - 8} ${ax - 16} ${ay - 18}ZM${ax + 9} ${ay - 18}l9 -7v14Z`,
      '#ff8a3c',
    ) +
    fill(circ(ax - 4, ay - 19, 4), '#fff4d8') +
    fill(
      `M${ax - 18} ${ay - 2}Q${ax - 6} ${ay - 12} ${ax + 6} ${ay - 2}Q${ax - 6} ${ay + 6} ${ax - 18} ${ay - 2}ZM${ax + 6} ${ay - 2}l8 -6v12Z`,
      '#fff4d8',
      0.95,
    );
  return { w, h, ax, ay, body: s, flat: true };
}

const stallAt = (roof: Tone, g: keyof typeof GOODS) => {
  const f = frame([3, 2], 2.9);
  return stall(roof, GOODS[g](f.ax, f.ay));
};

/** Things lying about for a quest: small, flat on the ground, like the rest of the quest items. */
const lyingLantern = (): Prop => ({
  w: 48,
  h: 48,
  ax: 24,
  ay: 40,
  flat: true,
  body: lantern(24, 24, 13),
});
const scroll = (): Prop => ({
  w: 48,
  h: 48,
  ax: 24,
  ay: 40,
  flat: true,
  body:
    flat(rr(8, 16, 32, 18, 3), PAPER[0], LINE, 2.4) +
    stroke('M14 22h20M14 28h14', '#8a6a4a', 2) +
    flat(rr(4, 14, 7, 22, 3), RED[0], LINE, 2) +
    flat(rr(37, 14, 7, 22, 3), RED[0], LINE, 2),
});

export const CHINATOWN: Record<string, Prop> = {
  'item-lampion': lyingLantern(),
  'item-zwoj': scroll(),
  'ct-brama': gate(),
  'ct-sklep-a': shop(['#e9c88d', '#c7a568'], ROOF, 'miska'),
  'ct-sklep-b': shop(['#d9775a', '#b05a42'], ROOF, 'ryba'),
  'ct-sklep-c': shop(['#efe0be', '#cdb98f'], ROOF_RED, 'lampion', true),
  'ct-herbaciarnia': teaHouse(),
  'ct-pagoda': pagoda(),
  'ct-dojo': dojo(),
  'ct-stragan-makaron': stallAt(ROOF_RED, 'makaron'),
  'ct-stragan-owoce': stallAt(['#f4a12a', '#c97a14'], 'owoce'),
  'ct-stragan-herbata': stallAt(ROOF, 'herbata'),
  'ct-lampion': standLantern(),
  'ct-girlanda': stringLights(),
  'ct-lew': lion(),
  'ct-smok': dragon(),
  'ct-bambus-a': bamboo(4.2, 1),
  'ct-bambus-b': bamboo(5, 4),
  'ct-wisnia': cherry(),
  'ct-mostek': redBridge(),
  'ct-kadzidlo': incense(),
  'ct-beben': drumRack(),
  'ct-koi': koiStone(),
};
