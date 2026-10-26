// Dystrykty (docs/dystrykty.md): the modern buildings a bud puts up in its district on a wasteland plot, the plots'
// low fence, the sign at a district's gate and the board of a plot for sale. Clean lines, glass, concrete and steel with the Buds colours as accents (lime for
// the district's own signs, gold for lights): the town hall grows from a glass pavilion to an office block to a
// tower with a rooftop garden; apartment blocks with balconies, a vertical farm glowing pink under its lamps, a solar
// farm, a concrete plant with a silo, a steel recycling hall, a logistics centre with loading bays, and a building
// site with a tower crane while anything is being built. Same cel style as the rest (kit.ts): base + shade, soft
// contours, light from the top-left, a contact shadow under everything; no words anywhere.
import {
  LEAF,
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

/** A glass curtain wall: a grid of panes with mullions and a soft diagonal sky reflection, clipped to the rectangle. */
let clipIds = 0;
function curtainWall(
  x: number,
  y: number,
  w: number,
  h: number,
  cols: number,
  rows: number,
  glass: Tone = BLUE_GLASS,
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
  s += stroke(mull, '#e9eef3', 2.2, 0.85);
  return s;
}

/** A flat roof edge (parapet) with a lit top line. */
function parapet(L: number, R: number, y: number, tone: Tone = WHITE) {
  return (
    shaded(rr(L - 4, y - 8, R - L + 8, 12, 3), tone, LINE, -2, -2, 2.5) +
    stroke(`M${n(L)} ${n(y - 5)}H${n(R)}`, '#ffffff', 2, 0.5)
  );
}

/** A glass entrance with sliding doors and a canopy. */
function entrance(cx: number, bottom: number, w: number, h: number, canopy: Tone = GRAPHITE) {
  let s = fill(rr(cx - w / 2 - 3, bottom - h - 3, w + 6, h + 3, 3), '#1b2030', 0.2);
  s += shaded(rr(cx - w / 2, bottom - h, w, h, 2), SKY, LINE, -2, -2, 2.5);
  s += stroke(`M${n(cx)} ${n(bottom - h + 2)}V${n(bottom - 2)}`, LINE, 2);
  s += stroke(
    `M${n(cx - 5)} ${n(bottom - h * 0.5)}h-4M${n(cx + 5)} ${n(bottom - h * 0.5)}h4`,
    '#e9eef3',
    2.5,
  );
  s += shaded(rr(cx - w / 2 - 10, bottom - h - 10, w + 20, 9, 3), canopy, LINE, -2, -2, 2);
  s += flat(rr(cx - w / 2 - 8, bottom - 4, w + 16, 6, 2), '#cfd4da', LINE, 1.5);
  return s;
}

/** A row of small planters with round shrubs (on a terrace, a roof or a pavement). */
function planters(x0: number, x1: number, y: number, size = 8) {
  let s = '';
  for (let x = x0; x <= x1; x += size * 2.6) {
    s += shaded(rr(x - size, y - 6, size * 2, 8, 2), CONCRETE_DARK, LINE, -1, -1, 1.6);
    s += puffs([[x, y - 10, size * 0.9]], LEAF, '', 2);
  }
  return s;
}

// ---------- the town hall: three looks for five levels ----------

/** Level 1: a low glass pavilion with a white frame, a lime flag pole and planters. */
function hallPavilion(): Prop {
  const foot: [number, number] = [5, 4];
  const { w, h, ax, ay, L, R } = frame(foot, 3.4, 0.35);
  let s = shadow(ax, ay - 2, (R - L) / 2 + 10, 15, 0.26);
  const l = L + 14;
  const r = R - 14;
  const top = ay - 1.75 * T;
  // a white frame around a glass box
  s += shaded(rr(l, top, r - l, ay - top, 4), WHITE, LINE, -6, -4);
  s += curtainWall(l + 10, top + 14, r - l - 20, ay - top - 22, 6, 2);
  s += parapet(l, r, top + 4);
  s += entrance(ax, ay - 4, 40, 0.92 * T, GRAPHITE);
  // a flag pole with the district's lime flag
  const fx = r + 12;
  s += stroke(`M${n(fx)} ${n(ay - 4)}V${n(top - 1.1 * T)}`, '#4a5160', 3);
  s += shaded(
    `M${n(fx + 1)} ${n(top - 1.08 * T)}q16 -6 30 2q-14 8 -30 14Z`,
    LIME,
    '#2d4a12',
    -2,
    -1,
    2,
  );
  s += planters(l + 10, l + 50, ay - 2, 8);
  return { w, h, ax, ay, foot, body: s };
}

/** Levels 2–3: a three-storey office block, glass bands between white slabs, a green terrace on top. */
function hallOffice(): Prop {
  const foot: [number, number] = [5, 4];
  const { w, h, ax, ay, L, R } = frame(foot, 5, 0.35);
  let s = shadow(ax, ay - 2, (R - L) / 2 + 12, 16, 0.27);
  const l = L + 8;
  const r = R - 8;
  const floors = 3;
  const fh = 0.95 * T;
  const top = ay - floors * fh - 10;
  s += shaded(rr(l, top, r - l, ay - top, 4), WHITE, LINE, -6, -4);
  for (let f = 0; f < floors; f++) {
    const y = top + 10 + f * fh;
    s += curtainWall(l + 8, y, r - l - 16, fh - 14, 8, 1, f === 0 ? DARK_GLASS : BLUE_GLASS);
    s += fill(rr(l + 2, y + fh - 14, r - l - 4, 6, 1), '#1b2030', 0.12); // the slab's shade on the glass below
  }
  s += parapet(l, r, top + 4);
  // the rooftop terrace: shrubs and a pergola
  s += planters(l + 16, r - 16, top - 4, 9);
  s += stroke(
    `M${n(r - 70)} ${n(top - 4)}v-26M${n(r - 30)} ${n(top - 4)}v-26M${n(r - 76)} ${n(top - 30)}H${n(r - 24)}`,
    '#7f522b',
    4,
  );
  s += entrance(ax, ay - 4, 48, 0.85 * T, LIME);
  return { w, h, ax, ay, foot, body: s };
}

/** Levels 4–5: a tower: a glass shaft on a wide podium, a crown with an antenna and a lime light on top. */
function hallTower(): Prop {
  const foot: [number, number] = [5, 4];
  const { w, h, ax, ay, L, R } = frame(foot, 8.4, 0.4);
  let s = shadow(ax, ay - 2, (R - L) / 2 + 14, 17, 0.28);
  const podiumTop = ay - 1.15 * T;
  // the podium: concrete with a glass ground floor
  s += shaded(rr(L + 6, podiumTop, R - L - 12, ay - podiumTop, 4), CONCRETE, LINE, -5, -3);
  s += curtainWall(L + 14, podiumTop + 12, R - L - 28, ay - podiumTop - 18, 7, 1, DARK_GLASS);
  // the tower
  const tl = ax - 1.05 * T;
  const tr = ax + 1.05 * T;
  const tt = ay - 7.1 * T;
  s += shaded(rr(tl, tt, tr - tl, podiumTop - tt + 6, 4), GRAPHITE, LINE, -6, -4);
  s += curtainWall(tl + 8, tt + 18, tr - tl - 16, podiumTop - tt - 26, 4, 9);
  // vertical fins
  s += stroke(
    `M${n(tl + 4)} ${n(tt + 10)}V${n(podiumTop)}M${n(tr - 4)} ${n(tt + 10)}V${n(podiumTop)}`,
    '#e9eef3',
    3,
    0.7,
  );
  // the crown: a slanted top, an antenna, a lime beacon
  s += shaded(
    poly([
      [tl - 6, tt + 12],
      [tl + 10, tt - 22],
      [tr - 10, tt - 22],
      [tr + 6, tt + 12],
    ]),
    WHITE,
    LINE,
    -4,
    -3,
  );
  s += stroke(`M${n(ax)} ${n(tt - 22)}V${n(tt - 1.0 * T)}`, '#4a5160', 3);
  s += shaded(circ(ax, tt - 1.0 * T, 5), LIME, '#2d4a12', -1, -1, 2);
  s += fill(circ(ax, tt - 1.0 * T, 11), '#a3e635', 0.25);
  // podium roof garden and the entrance
  s += planters(L + 24, tl - 16, podiumTop - 2, 8);
  s += planters(tr + 16, R - 24, podiumTop - 2, 8);
  s += entrance(ax, ay - 4, 54, 0.82 * T, GOLD);
  return { w, h, ax, ay, foot, body: s };
}

// ---------- the rest ----------

/** An apartment block: four storeys, balconies with glass rails and flower boxes, coloured panels. */
function apartments(): Prop {
  const foot: [number, number] = [3, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 5.6, 0.3);
  let s = shadow(ax, ay - 2, (R - L) / 2 + 8, 13, 0.26);
  const l = L + 6;
  const r = R - 6;
  const floors = 4;
  const fh = 1.08 * T;
  const top = ay - floors * fh - 8;
  s += shaded(rr(l, top, r - l, ay - top, 4), CONCRETE, LINE, -6, -4);
  const panels: Tone[] = [CORAL, LIME, SKY, GOLD];
  const r2 = rng(11);
  for (let f = 0; f < floors; f++) {
    const y = top + 10 + f * fh;
    for (let c = 0; c < 2; c++) {
      const x = l + 10 + c * ((r - l - 20) / 2);
      const cw = (r - l - 20) / 2 - 8;
      // a coloured panel beside each window
      s += shaded(
        rr(x, y + 4, 14, fh - 24, 2),
        panels[(f + c * 2) % panels.length]!,
        LINE,
        -1,
        -1,
        1.6,
      );
      s += windowAt(x + 18, y + 6, cw - 22, fh - 30, { cross: false, lit: r2() > 0.5 });
      // the balcony: a slab, a glass rail, sometimes a flower box
      if (f < floors - 1 || c === 0) {
        s += flat(rr(x + 12, y + fh - 22, cw - 6, 6, 2), '#c3c8cf', LINE, 1.6);
        s += fill(rr(x + 14, y + fh - 34, cw - 10, 12, 2), '#bfe6f7', 0.55);
        s += stroke(`M${n(x + 14)} ${n(y + fh - 34)}h${n(cw - 10)}`, '#e9eef3', 2);
        if (r2() > 0.45)
          s += puffs(
            [
              [x + 22, y + fh - 38, 6],
              [x + 32, y + fh - 38, 5],
            ],
            LEAF,
            '',
            2,
          );
      }
    }
  }
  s += parapet(l, r, top + 4);
  s += entrance(ax, ay - 4, 30, 0.8 * T, GRAPHITE);
  // rooftop solar and a satellite dish
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
function verticalFarm(): Prop {
  const foot: [number, number] = [3, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 4.2, 0.3);
  let s = shadow(ax, ay - 2, (R - L) / 2 + 8, 13, 0.25);
  const l = L + 8;
  const r = R - 8;
  const top = ay - 3.1 * T;
  // the glow inside first, then the shelves of greens, then the glass over all
  s += fill(rr(l, top, r - l, ay - top, 6), '#c86bd8', 0.55);
  s += fill(rr(l + 6, top + 6, r - l - 12, ay - top - 12, 5), '#f0a6ff', 0.35);
  const shelves = 5;
  for (let i = 0; i < shelves; i++) {
    const y = top + 18 + i * ((ay - top - 26) / shelves);
    s += stroke(`M${n(l + 6)} ${n(y + 14)}H${n(r - 6)}`, '#e9eef3', 3, 0.9);
    for (let x = l + 14; x < r - 10; x += 13)
      s += shaded(circ(x, y + 8, 5.5), ['#86d062', '#4f9e45'], '#2b5a2c', -1, -1, 1.4);
    s += stroke(`M${n(l + 8)} ${n(y)}H${n(r - 8)}`, '#ff8fe0', 2.2, 0.9); // the grow lamp
  }
  s += fill(rr(l, top, r - l, ay - top, 6), '#ffffff', 0.12);
  s += `<path d="${rr(l, top, r - l, ay - top, 6)}" fill="none" stroke="${LINE}" stroke-width="3"/>`;
  let frames = '';
  for (let x = l + (r - l) / 3; x < r - 2; x += (r - l) / 3)
    frames += `M${n(x)} ${n(top + 2)}V${n(ay - 2)}`;
  s += stroke(frames, '#e9eef3', 3);
  // a pitched glass roof with a vent
  s += shaded(
    poly([
      [l - 6, top + 4],
      [ax, top - 0.7 * T],
      [r + 6, top + 4],
    ]),
    ['#cfeffd', '#a6dcf5'],
    LINE,
    -3,
    -3,
    2.5,
  );
  s += shaded(rr(ax - 12, top - 0.62 * T, 24, 10, 2), STEEL, LINE, -1, -1, 1.8);
  s += entrance(ax, ay - 4, 26, 0.7 * T, LIME);
  return { w, h, ax, ay, foot, body: s };
}

/** A solar farm: tilted panels in rows on steel legs, a battery cabinet and a little inverter with a lime light. */
function solarFarm(): Prop {
  const foot: [number, number] = [3, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 2.6, 0.3);
  let s = shadow(ax, ay - 2, (R - L) / 2 + 6, 12, 0.22);
  const rows = 3;
  for (let i = 0; i < rows; i++) {
    const y = ay - 1.9 * T + i * 0.6 * T;
    const inset = (rows - 1 - i) * 6;
    const l = L + 10 + inset;
    const r = R - 10 - inset;
    s += stroke(`M${n(l + 10)} ${n(y + 30)}v-10M${n(r - 10)} ${n(y + 30)}v-10`, '#727f8e', 3);
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
  // the battery cabinet
  s += shaded(rr(R - 46, ay - 34, 34, 30, 3), WHITE, LINE, -2, -2, 2);
  s += shaded(circ(R - 29, ay - 22, 4), LIME, '#2d4a12', -1, -1, 1.5);
  s += stroke(`M${n(R - 40)} ${n(ay - 12)}h22`, '#9aa6b4', 2);
  return { w, h, ax, ay, foot, body: s };
}

/** A concrete plant: a tall silo on legs, a mixing hall, a conveyor, a mixer truck in front. */
function concretePlant(): Prop {
  const foot: [number, number] = [3, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 4.6, 0.35);
  let s = shadow(ax, ay - 2, (R - L) / 2 + 8, 13, 0.26);
  // the silo
  const sx = L + 0.85 * T;
  s += stroke(
    `M${n(sx - 16)} ${n(ay - 4)}V${n(ay - 1.3 * T)}M${n(sx + 16)} ${n(ay - 4)}V${n(ay - 1.3 * T)}`,
    '#727f8e',
    4,
  );
  s += shaded(
    `M${n(sx - 22)} ${n(ay - 1.3 * T)}L${n(sx - 22)} ${n(ay - 3.6 * T)}Q${n(sx)} ${n(ay - 4.05 * T)} ${n(sx + 22)} ${n(ay - 3.6 * T)}L${n(sx + 22)} ${n(ay - 1.3 * T)}L${n(sx)} ${n(ay - 0.9 * T)}Z`,
    CONCRETE,
    LINE,
    -4,
    -3,
  );
  s += stroke(
    `M${n(sx - 22)} ${n(ay - 2.4 * T)}H${n(sx + 22)}M${n(sx - 22)} ${n(ay - 3.1 * T)}H${n(sx + 22)}`,
    '#9aa6b4',
    2,
    0.7,
  );
  s += shaded(rr(sx - 8, ay - 3.9 * T, 16, 10, 2), LIME, '#2d4a12', -1, -1, 1.6);
  // the mixing hall
  const hl = sx + 24;
  const hr = R - 8;
  const ht = ay - 1.9 * T;
  s += shaded(rr(hl, ht, hr - hl, ay - ht, 3), STEEL, LINE, -4, -3);
  let ribs = '';
  for (let x = hl + 8; x < hr - 4; x += 9) ribs += `M${n(x)} ${n(ht + 4)}V${n(ay - 4)}`;
  s += stroke(ribs, '#5f6b79', 1.8, 0.6);
  s += shaded(rr(hl + 12, ay - 0.9 * T, 34, 0.9 * T - 4, 2), GRAPHITE, LINE, -2, -2, 2);
  // the conveyor from the silo up to the hall
  s += stroke(`M${n(sx + 6)} ${n(ay - 1.0 * T)}L${n(hl + 20)} ${n(ht - 14)}`, '#4a5160', 7);
  s += stroke(`M${n(sx + 6)} ${n(ay - 1.0 * T)}L${n(hl + 20)} ${n(ht - 14)}`, '#ffc93c', 3);
  // a mixer truck's drum peeking out in front
  s += shaded(rr(hr - 46, ay - 26, 40, 24, 4), WHITE, LINE, -2, -2, 2);
  s += shaded(`M${n(hr - 42)} ${n(ay - 28)}q18 -22 34 -4l-4 6Z`, CORAL, LINE, -2, -2, 2);
  s += `<circle cx="${n(hr - 38)}" cy="${n(ay - 4)}" r="6" fill="#2e3033" stroke="#161718" stroke-width="2"/>`;
  s += `<circle cx="${n(hr - 14)}" cy="${n(ay - 4)}" r="6" fill="#2e3033" stroke="#161718" stroke-width="2"/>`;
  return { w, h, ax, ay, foot, body: s };
}

/** A steel recycling hall: a sawtooth roof with skylights, a stack, containers of scrap and a steel beam stack. */
function recycling(): Prop {
  const foot: [number, number] = [3, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 4.1, 0.35);
  let s = shadow(ax, ay - 2, (R - L) / 2 + 8, 13, 0.26);
  const l = L + 6;
  const r = R - 6;
  const wall = ay - 1.7 * T;
  // the stack behind
  s += shaded(rr(r - 30, ay - 3.4 * T, 18, 1.8 * T, 3), CONCRETE_DARK, LINE, -2, -2, 2);
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
  // the hall with a sawtooth roof
  s += shaded(rr(l, wall, r - l, ay - wall, 3), STEEL, LINE, -5, -3);
  const teeth = 3;
  const tw = (r - l) / teeth;
  for (let i = 0; i < teeth; i++) {
    const x = l + i * tw;
    s += shaded(
      poly([
        [x, wall + 2],
        [x, wall - 0.55 * T],
        [x + tw, wall + 2],
      ]),
      GRAPHITE,
      LINE,
      -2,
      -2,
      2.5,
    );
    s += fill(
      poly([
        [x + 3, wall - 2],
        [x + 3, wall - 0.5 * T + 6],
        [x + tw * 0.45, wall - 2],
      ]),
      '#bfe6f7',
      0.8,
    );
  }
  let ribs = '';
  for (let x = l + 8; x < r - 4; x += 10) ribs += `M${n(x)} ${n(wall + 6)}V${n(ay - 4)}`;
  s += stroke(ribs, '#5f6b79', 1.8, 0.5);
  // a roller door, half up, the glow of the furnace inside
  s += fill(rr(ax - 26, ay - 0.95 * T, 52, 0.95 * T - 2, 2), '#ff9a3c', 0.85);
  s += shaded(rr(ax - 26, ay - 0.95 * T, 52, 0.45 * T, 2), ['#c3c8cf', '#9aa6b4'], LINE, -2, -2, 2);
  // a container of scrap and a stack of beams
  s += shaded(rr(l - 10, ay - 26, 36, 24, 2), LIME, '#2d4a12', -2, -2, 2);
  s += stroke(
    `M${n(l - 4)} ${n(ay - 24)}v20M${n(l + 6)} ${n(ay - 24)}v20M${n(l + 16)} ${n(ay - 24)}v20`,
    '#5d9a12',
    2,
  );
  for (let i = 0; i < 3; i++)
    s += shaded(rr(r - 34, ay - 10 - i * 7, 40, 6, 1), STEEL, LINE, -1, -1, 1.5);
  return { w, h, ax, ay, foot, body: s };
}

/** A logistics centre: a long low hall, three loading bays with roller doors, a forklift and pallets. */
function logistics(): Prop {
  const foot: [number, number] = [3, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 3.2, 0.3);
  let s = shadow(ax, ay - 2, (R - L) / 2 + 8, 13, 0.25);
  const l = L + 4;
  const r = R - 4;
  const top = ay - 1.95 * T;
  s += shaded(rr(l, top, r - l, ay - top, 3), WHITE, LINE, -5, -3);
  s += fill(rr(l + 2, top + 2, r - l - 4, 12, 2), '#a3e635', 0.9); // the lime band along the top
  s += stroke(`M${n(l + 4)} ${n(top + 14)}H${n(r - 4)}`, LINE, 2);
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
    s += shaded(rr(x, ay - 8, bw, 6, 1), GRAPHITE, LINE, -1, -1, 1.5); // the dock bumper
  }
  // a pallet and the forklift
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

/** A building site: a hoarding with the district's lime stripe, a concrete frame going up and a tower crane. */
function site(foot: [number, number]): Prop {
  const big = foot[1] === 4;
  const { w, h, ax, ay, L, R } = frame(foot, big ? 5.4 : 4.4, 0.3);
  let s = shadow(ax, ay - 2, (R - L) / 2 + 6, 12, 0.2);
  const l = L + 8;
  const r = R - 8;
  // the concrete frame going up: columns and two slabs
  const top = ay - (big ? 2.3 : 1.8) * T;
  let cols = '';
  for (let i = 0; i <= (big ? 4 : 3); i++)
    cols += `M${n(l + 12 + (i * (r - l - 24)) / (big ? 4 : 3))} ${n(ay - 6)}V${n(top)}`;
  s += stroke(cols, '#868c97', 7);
  s += stroke(cols, '#c3c8cf', 4);
  for (const y of [top, (top + ay) / 2])
    s += shaded(rr(l + 6, y - 4, r - l - 12, 8, 2), CONCRETE, LINE, -1, -1, 2);
  // the tower crane: mast, jib, counterweight, hook
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
  s += shaded(rr(cx - 10, mastTop - 10, 20, 14, 2), WHITE, LINE, -1, -1, 1.6); // the cab
  const hx = l + 30;
  s += stroke(`M${n(hx)} ${n(mastTop + 6)}V${n(top - 30)}`, '#3d3a36', 1.6);
  s += shaded(rr(hx - 12, top - 30, 24, 10, 2), STEEL, LINE, -1, -1, 1.6);
  // the hoarding along the front with a lime stripe
  s += shaded(rr(l - 4, ay - 26, r - l + 8, 22, 2), WHITE, LINE, -2, -2, 2);
  s += fill(rr(l - 2, ay - 18, r - l + 4, 6, 1), '#a3e635', 0.95);
  return { w, h, ax, ay, foot, body: s };
}

/** A pylon at a district's gate: graphite, a lime band, a little white skyline (no words; the game shows the name). */
function districtSign(): Prop {
  const foot: [number, number] = [1, 1];
  const { w, h, ax, ay } = frame(foot, 2.2, 0.5);
  let s = shadow(ax, ay - 2, 18, 6, 0.24);
  const top = ay - 1.9 * T;
  s += shaded(rr(ax - 14, top, 28, ay - top - 2, 5), GRAPHITE, LINE, -2, -2, 2.5);
  s += fill(rr(ax - 10, top + 6, 20, 5, 2), '#a3e635', 1);
  for (const [dx, hh] of [
    [-7, 10],
    [-2, 18],
    [3, 13],
    [8, 7],
  ] as const)
    s += fill(rr(ax + dx - 2, top + 34 - hh, 4, hh, 1), '#f4f6f8', 0.95);
  s += fill(rr(ax - 10, top + 35, 20, 2, 1), '#a3e635', 1);
  s += shaded(rr(ax - 18, ay - 10, 36, 9, 3), CONCRETE_DARK, LINE, -1, -1, 2);
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

/** The low modern fence round a plot: graphite posts, two steel rails. */
const plotFence = fenceKit(GRAPHITE, LINE, { postW: 10, postH: 30 });

export const DISTRICT: Record<string, Prop> = {
  'dz-ratusz-1': hallPavilion(),
  'dz-ratusz-2': hallOffice(),
  'dz-ratusz-3': hallTower(),
  'dz-apartamentowiec': apartments(),
  'dz-szklarnia': verticalFarm(),
  'dz-farma-solarna': solarFarm(),
  'dz-betoniarnia': concretePlant(),
  'dz-recykling': recycling(),
  'dz-magazyn': logistics(),
  'dz-budowa': site([3, 3]),
  'dz-budowa-duza': site([5, 4]),
  'dz-tablica': districtSign(),
  'dz-na-sprzedaz': forSale(),
  'dzialka-post': plotFence.post,
  'dzialka-h': plotFence.h,
  'dzialka-v': plotFence.v,
};
