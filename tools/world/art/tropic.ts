// Las Palmas: tropical beach town — palms, Hawaiian stilt huts, beach bar, fruit stall, umbrellas, surfboards,
// boats, tiki torches, jungle, temple ruins and exotic animals.
import { rock } from './common';
import {
  T,
  awning,
  circ,
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

const LINE = '#4a3020';
const BAMBOO: Tone = ['#e2c27a', '#c4a05a'];
const THATCH: Tone = ['#d9b25e', '#b38a3e'];
const PALM_LEAF = { base: '#4fbf5a', dark: '#2f8f45', light: '#7fdc6a', line: '#1f5a30' };

function palm(lean: number, seed: number): Prop {
  const w = 3.4 * T;
  const h = 4.1 * T;
  const ax = w / 2;
  const ay = h - 8;
  const r = rng(seed);
  const topX = ax + lean * 0.55 * T;
  const topY = ay - 3.0 * T;
  // segmented, gently curving trunk
  const segs = 9;
  let trunk = '';
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    const x0 = ax + (topX - ax) * t0 * t0;
    const x1 = ax + (topX - ax) * t1 * t1;
    const y0 = ay - (ay - topY) * t0;
    const y1 = ay - (ay - topY) * t1;
    const w0 = 13 - t0 * 4;
    const w1 = 13 - t1 * 4;
    trunk += shaded(
      poly([
        [x0 - w0, y0],
        [x0 + w0, y0],
        [x1 + w1 + 2, y1 + 3],
        [x1 - w1 - 2, y1 + 3],
      ]),
      ['#b48354', '#8f6339'],
      LINE,
      -3,
      0,
      2.5,
    );
  }
  // fronds: long leaves that arc up and droop down, with leaflets along the midrib
  let fronds = '';
  const angles = [-178, -150, -118, -88, -60, -30, -4];
  for (const a0 of angles) {
    const a = ((a0 + (r() - 0.5) * 10) * Math.PI) / 180;
    const len = 1.15 * T + r() * 0.25 * T;
    const side = 1 - Math.abs(Math.sin(a)); // 1 = sideways frond, 0 = pointing up
    const ex = topX + Math.cos(a) * len;
    const ey = topY + Math.sin(a) * len * 0.55 + len * 0.55 * side;
    const cx = topX + Math.cos(a) * len * 0.55;
    const cy = topY + Math.sin(a) * len * 0.55 - len * 0.3;
    const dx = ex - topX;
    const dy = ey - topY;
    const dl = Math.hypot(dx, dy);
    const nx = (-dy / dl) * 16;
    const ny = (dx / dl) * 16;
    const d = `M${n(topX)} ${n(topY)}Q${n(cx + nx)} ${n(cy + ny)} ${n(ex)} ${n(ey)}Q${n(cx - nx)} ${n(cy - ny)} ${n(topX)} ${n(topY)}Z`;
    fronds += shaded(d, [PALM_LEAF.base, PALM_LEAF.dark], PALM_LEAF.line, -3, -4, 2.5);
    // leaflets: short cuts along the leaf, on the quadratic midrib
    let cuts = '';
    for (const t of [0.35, 0.5, 0.65, 0.8]) {
      const mx = (1 - t) * (1 - t) * topX + 2 * (1 - t) * t * cx + t * t * ex;
      const my = (1 - t) * (1 - t) * topY + 2 * (1 - t) * t * cy + t * t * ey;
      cuts += `M${n(mx)} ${n(my)}l${n(nx * 0.7)} ${n(ny * 0.7 + 4)}M${n(mx)} ${n(my)}l${n(-nx * 0.7)} ${n(-ny * 0.7 + 4)}`;
    }
    fronds += stroke(cuts, PALM_LEAF.dark, 2);
    fronds += stroke(
      `M${n(topX)} ${n(topY)}Q${n(cx)} ${n(cy)} ${n(ex)} ${n(ey)}`,
      PALM_LEAF.line,
      2,
    );
  }
  const coconuts = [-8, 6, -1]
    .map((dx, i) => flat(circ(topX + dx, topY + 10 + (i === 2 ? 8 : 0), 7), '#7a5232', LINE, 2))
    .join('');
  return {
    w,
    h,
    ax,
    ay,
    foot: [1, 1],
    body: shadow(ax + lean * 10, ay - 2, 36, 9) + trunk + coconuts + fronds,
  };
}

/** Hawaiian stilt hut, 5×3: bamboo walls, deep thatched roof with a fringe, porch stairs, tiki mask. */
function hut(shutter: Tone): Prop {
  const foot: [number, number] = [5, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 4.3, 0.5);
  const deck = ay - 0.55 * T;
  const wallTop = ay - 1.75 * T;
  const top = ay - 3.95 * T;
  let s = shadow(ax, ay - 2, 2.7 * T, 12, 0.22);
  for (const x of [L + 10, L + 1.6 * T, R - 1.6 * T - 12, R - 22])
    s += shaded(rr(x, deck, 12, ay - deck, 3), ['#8f6339', '#6b4229'], LINE, -2, 0, 2.5);
  s += shaded(rr(L - 6, deck - 10, R - L + 12, 16, 4), ['#a8774a', '#8a5c34'], LINE, -2, -2);
  s += shaded(rr(L + 8, wallTop, R - L - 16, deck - wallTop - 6, 4), BAMBOO, LINE, -8, -3);
  for (let x = L + 18; x < R - 10; x += 12)
    s += stroke(`M${x} ${wallTop + 4}V${deck - 10}`, BAMBOO[1], 2.5, 0.8);
  // window with open shutters
  for (const cx of [L + 1.1 * T, R - 1.1 * T]) {
    s += windowAt(cx - 18, wallTop + 22, 36, 32, {
      r: 4,
      line: LINE,
      glass: ['#3a2a20', '#2a1d16'],
      lit: false,
    });
    s += shaded(rr(cx - 34, wallTop + 20, 14, 36, 3), shutter, LINE, -1, -1, 2);
    s += shaded(rr(cx + 20, wallTop + 20, 14, 36, 3), shutter, LINE, -1, -1, 2);
  }
  s += shaded(
    rr(ax - 20, wallTop + 18, 40, deck - wallTop - 24, 4),
    ['#6b4229', '#4f2f1c'],
    LINE,
    -2,
    -2,
  );
  // stairs down from the porch
  for (let i = 0; i < 3; i++)
    s += shaded(
      rr(ax - 24 + i * 2, deck + 6 + i * 9, 48 - i * 4, 8, 2),
      ['#a8774a', '#8a5c34'],
      LINE,
      -1,
      -1,
      2,
    );
  // tiki mask by the door
  s += shaded(rr(ax + 26, wallTop + 24, 18, 30, 5), ['#c86b4e', '#a3523a'], LINE, -1, -1, 2);
  s += stroke(
    `M${ax + 30} ${wallTop + 34}h4M${ax + 37} ${wallTop + 34}h4M${ax + 31} ${wallTop + 45}h10`,
    LINE,
    2.5,
  );
  // thatched roof with layered fringe
  const roof = `M${L - 22} ${wallTop + 14}L${ax - 0.6 * T} ${top}H${ax + 0.6 * T}L${R + 22} ${wallTop + 14}Z`;
  s += shaded(roof, THATCH, LINE, -6, -6);
  for (const t of [0.35, 0.65, 1]) {
    const y = top + (wallTop + 14 - top) * t;
    const half = 0.6 * T + (R - L) * 0.5 * t + 22 * t;
    let d = `M${n(ax - half)} ${n(y)}`;
    const steps = Math.round((half * 2) / 14);
    for (let i = 0; i < steps; i++) d += `l7 ${t === 1 ? 10 : 7}l7 ${t === 1 ? -10 : -7}`;
    s += stroke(d, THATCH[1], 3);
  }
  s += stroke(`M${ax - 0.55 * T} ${top + 6}H${ax + 0.55 * T}`, '#f2d184', 5, 0.8);
  // flower garland
  for (let i = 0; i < 7; i++) {
    const x = L + 20 + i * ((R - L - 40) / 6);
    s += `<circle cx="${n(x)}" cy="${n(wallTop + 10 + Math.sin(i) * 3)}" r="5" fill="${['#ff7aa8', '#ffd23f', '#ff3d50'][i % 3]}" stroke="${LINE}" stroke-width="1.5"/>`;
  }
  return { w, h, ax, ay, foot, body: s };
}

function beachBar(): Prop {
  const foot: [number, number] = [5, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 3.6, 0.4);
  const top = ay - 3.2 * T;
  const counterTop = ay - 0.95 * T;
  let s = shadow(ax, ay - 2, 2.7 * T, 12, 0.22);
  for (const x of [L + 6, R - 18])
    s += shaded(rr(x, top + 40, 12, ay - top - 40, 3), BAMBOO, LINE, -2, 0, 2.5);
  // shelves with bottles
  s += shaded(rr(L + 24, top + 70, R - L - 48, 0.95 * T, 4), ['#8f6339', '#6b4229'], LINE, -3, -2);
  for (let i = 0; i < 8; i++) {
    const x = L + 36 + i * ((R - L - 72) / 7);
    s += shaded(
      rr(x - 5, top + 80, 10, 26, 4),
      [['#4cc7ff', '#5cc84a', '#ff9a1f', '#ff3d50'][i % 4]!, '#2a2a33'],
      LINE,
      -1,
      -1,
      2,
    );
  }
  s += shaded(rr(L + 14, counterTop, R - L - 28, ay - counterTop - 4, 6), BAMBOO, LINE, -6, -3);
  for (let x = L + 26; x < R - 20; x += 12)
    s += stroke(`M${x} ${counterTop + 12}V${ay - 8}`, BAMBOO[1], 2.5, 0.8);
  s += shaded(rr(L + 6, counterTop - 8, R - L - 12, 14, 5), ['#a8774a', '#8a5c34'], LINE, -2, -2);
  // coconut drinks on the counter
  for (const x of [ax - 50, ax + 20, ax + 60]) {
    s +=
      flat(circ(x, counterTop - 16, 10), '#7a5232', LINE, 2) +
      stroke(`M${x + 3} ${counterTop - 24}l6 -14`, '#ff7aa8', 3);
  }
  // thatched canopy
  s += shaded(
    `M${L - 18} ${top + 52}L${L + 30} ${top}H${R - 30}L${R + 18} ${top + 52}Z`,
    THATCH,
    LINE,
    -6,
    -6,
  );
  let d = `M${L - 18} ${top + 52}`;
  for (let x = L - 18; x < R + 18; x += 14) d += `l7 10l7 -10`;
  s += stroke(d, THATCH[1], 3);
  return { w, h, ax, ay, foot, body: s };
}

function fruitStall(): Prop {
  const foot: [number, number] = [3, 1];
  const { w, h, ax, ay, L, R } = frame(foot, 2.2, 0.15);
  const top = ay - 1.95 * T;
  let s = shadow(ax, ay - 2, 1.6 * T, 8, 0.22);
  s += stroke(`M${L + 6} ${top + 20}V${ay}M${R - 6} ${top + 20}V${ay}`, '#8f6339', 6);
  s += shaded(
    rr(L + 2, ay - 0.75 * T, R - L - 4, 0.75 * T - 2, 4),
    ['#a8774a', '#8a5c34'],
    LINE,
    -4,
    -2,
  );
  const r = rng(77);
  for (let i = 0; i < 9; i++) {
    const x = L + 18 + (i % 5) * ((R - L - 36) / 4) + (i > 4 ? 14 : 0);
    const y = ay - 0.78 * T + (i > 4 ? 10 : 0);
    const c = ['#ffc93c', '#ff7a3c', '#a3e635', '#ff3d50'][Math.floor(r() * 4)]!;
    s += flat(circ(x, y, 9), c, LINE, 2);
  }
  s += awning(L - 4, R + 4, top, 24, '#ff7aa8', '#ffffff', LINE);
  return { w, h, ax, ay, foot, body: s };
}

function umbrella(a: string, b: string): Prop {
  const w = 1.7 * T;
  const h = 2.1 * T;
  const ax = w / 2;
  const ay = h - 6;
  const top = ay - 1.75 * T;
  let canopy = '';
  const segs = 6;
  for (let i = 0; i < segs; i++) {
    const x0 = ax - 0.8 * T + (i * 1.6 * T) / segs;
    const x1 = ax - 0.8 * T + ((i + 1) * 1.6 * T) / segs;
    canopy += `<path d="M${n(ax)} ${n(top)}L${n(x0)} ${n(top + 30)}Q${n((x0 + x1) / 2)} ${n(top + 38)} ${n(x1)} ${n(top + 30)}Z" fill="${i % 2 ? b : a}"/>`;
  }
  return {
    w,
    h,
    ax,
    ay,
    foot: [1, 1],
    body:
      `<ellipse cx="${ax + 8}" cy="${ay - 2}" rx="${0.8 * T}" ry="14" fill="#1d2a14" opacity="0.15"/>` +
      stroke(`M${ax} ${top}V${ay}`, '#f6f2e9', 5) +
      canopy +
      flat(
        `M${n(ax - 0.8 * T)} ${top + 30}L${ax} ${top}L${n(ax + 0.8 * T)} ${top + 30}`,
        'none',
        LINE,
        2.5,
      ),
  };
}

function deckchair(color: string): Prop {
  const w = 1.2 * T;
  const h = 1 * T;
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
      stroke(
        `M${ax - 28} ${ay}L${ax + 18} ${ay - 46}M${ax + 26} ${ay}L${ax - 4} ${ay - 22}`,
        '#a8774a',
        5,
      ) +
      flat(
        `M${ax - 24} ${ay - 6}L${ax + 16} ${ay - 46}L${ax + 26} ${ay - 40}L${ax - 10} ${ay - 2}Z`,
        color,
        LINE,
        2.5,
      ) +
      stroke(`M${ax - 16} ${ay - 12}L${ax + 20} ${ay - 42}`, '#ffffff', 4, 0.8),
  };
}

function surfRack(): Prop {
  const w = 1.6 * T;
  const h = 2 * T;
  const ax = w / 2;
  const ay = h - 6;
  const boards: Tone[] = [
    ['#ff9a1f', '#d97a0b'],
    ['#4cc7ff', '#1b86c9'],
    ['#ff7aa8', '#d95a88'],
  ];
  let s = shadow(ax, ay, 40, 7);
  boards.forEach((c, i) => {
    const x = ax - 30 + i * 30;
    s += shaded(
      `M${x} ${ay - 4}Q${x - 14} ${ay - 0.9 * T} ${x} ${ay - 1.75 * T}Q${x + 14} ${ay - 0.9 * T} ${x} ${ay - 4}Z`,
      c,
      LINE,
      -3,
      -3,
      2.5,
    );
    s += stroke(`M${x} ${ay - 12}V${ay - 1.6 * T}`, '#ffffff', 2.5, 0.8);
  });
  s += shaded(rr(ax - 46, ay - 0.7 * T, 92, 10, 3), ['#a8774a', '#8a5c34'], LINE, -2, -2);
  return { w, h, ax, ay, foot: [1, 1], body: s };
}

function boat(): Prop {
  const foot: [number, number] = [3, 1];
  const { w, h, ax, ay } = frame(foot, 1.3, 0.1);
  const x0 = ax - 1.3 * T;
  const x1 = ax + 1.3 * T;
  return {
    w,
    h,
    ax,
    ay,
    foot,
    body:
      shadow(ax, ay - 2, 1.35 * T, 8, 0.2) +
      shaded(
        `M${x0} ${ay - 46}H${x1}Q${x1 - 10} ${ay - 6} ${x1 - 40} ${ay - 6}H${x0 + 30}Q${x0 + 6} ${ay - 10} ${x0} ${ay - 46}Z`,
        ['#4c8fd6', '#36689f'],
        LINE,
        -6,
        -3,
      ) +
      shaded(rr(x0 + 6, ay - 52, x1 - x0 - 12, 10, 4), ['#f6f2e9', '#d8cfbf'], LINE, -2, -2) +
      stroke(`M${x0 + 20} ${ay - 26}H${x1 - 30}`, '#ffffff', 4, 0.7) +
      stroke(`M${ax - 20} ${ay - 46}l40 -22`, '#a8774a', 5),
  };
}

function torch(): Prop {
  const w = 0.7 * T;
  const h = 2 * T;
  const ax = w / 2;
  const ay = h - 6;
  return {
    w,
    h,
    ax,
    ay,
    foot: [1, 1],
    body:
      shadow(ax, ay, 12, 4) +
      shaded(rr(ax - 5, ay - 1.45 * T, 10, 1.45 * T, 4), BAMBOO, LINE, -2, 0, 2.5) +
      stroke(`M${ax - 5} ${ay - 0.6 * T}h10M${ax - 5} ${ay - 1.05 * T}h10`, BAMBOO[1], 2.5) +
      shaded(
        `M${ax - 10} ${ay - 1.45 * T}H${ax + 10}L${ax + 7} ${ay - 1.6 * T}H${ax - 7}Z`,
        ['#6b4229', '#4f2f1c'],
        LINE,
        -1,
        -1,
        2,
      ) +
      `<path d="M${ax} ${ay - 1.95 * T}Q${ax + 14} ${ay - 1.75 * T} ${ax + 8} ${ay - 1.6 * T}H${ax - 8}Q${ax - 14} ${ay - 1.75 * T} ${ax} ${ay - 1.95 * T}Z" fill="#ff9a1f" stroke="#bd1c31" stroke-width="2"/>` +
      `<path d="M${ax} ${ay - 1.85 * T}Q${ax + 6} ${ay - 1.72 * T} ${ax + 3} ${ay - 1.63 * T}H${ax - 3}Q${ax - 6} ${ay - 1.72 * T} ${ax} ${ay - 1.85 * T}Z" fill="#ffe27a"/>`,
  };
}

function jungleTree(seed: number): Prop {
  const w = 2.8 * T;
  const h = 3.3 * T;
  const ax = w / 2;
  const ay = h - 8;
  const r = rng(seed);
  const leaf = { base: '#3f9a4a', dark: '#256f38', light: '#5fbd5a', line: '#16422a' };
  const crown: [number, number, number][] = [
    [ax, 70, 50],
    [ax - 46, 98, 34],
    [ax + 46, 96, 36],
    [ax - 24, 48, 30],
    [ax + 28, 52, 30],
    [ax, 118, 36],
  ];
  let big = '';
  for (let i = 0; i < 6; i++) {
    const cx = ax - 60 + r() * 120;
    const cy = 50 + r() * 70;
    const a = r() * 360;
    big += `<path d="M${n(cx)} ${n(cy)}q14 -18 30 0q-14 18 -30 0Z" fill="${leaf.light}" stroke="${leaf.line}" stroke-width="2" transform="rotate(${n(a)} ${n(cx)} ${n(cy)})"/>`;
  }
  const trunk = `M${ax - 16} ${ay}Q${ax - 10} ${ay - 30} ${ax - 12} ${ay - 70}H${ax + 12}Q${ax + 10} ${ay - 30} ${ax + 16} ${ay}Z`;
  return {
    w,
    h,
    ax,
    ay,
    foot: [1, 1],
    body:
      shadow(ax, ay - 2, 50, 12) +
      shaded(trunk, ['#7a5232', '#5a3a22'], LINE, -4, 0) +
      stroke(`M${ax - 8} ${ay - 10}q10 -20 -2 -40q-8 -14 6 -30`, '#3f9a4a', 3) +
      puffs(crown, leaf, big),
  };
}

function fern(): Prop {
  const w = 1.4 * T;
  const h = 1.1 * T;
  const ax = w / 2;
  const ay = h - 6;
  let s = shadow(ax, ay, 32, 7);
  for (const a0 of [-170, -140, -110, -70, -40, -10]) {
    const a = (a0 * Math.PI) / 180;
    const ex = ax + Math.cos(a) * 40;
    const ey = ay - 6 + Math.sin(a) * 36;
    s += `<path d="M${ax} ${ay - 6}Q${n((ax + ex) / 2 - Math.sin(a) * 10)} ${n((ay - 6 + ey) / 2 + Math.cos(a) * 10)} ${n(ex)} ${n(ey)}Q${n((ax + ex) / 2 + Math.sin(a) * 10)} ${n((ay - 6 + ey) / 2 - Math.cos(a) * 10)} ${ax} ${ay - 6}Z" fill="#4fae55" stroke="#1f5a30" stroke-width="2"/>`;
    s += stroke(`M${ax} ${ay - 6}L${n(ex)} ${n(ey)}`, '#2f8f45', 1.8);
  }
  return { w, h, ax, ay, foot: [1, 1], body: s };
}

const hibiscus = (): Prop => ({
  w: 52,
  h: 40,
  ax: 26,
  ay: 34,
  flat: true,
  body:
    `<ellipse cx="18" cy="26" rx="10" ry="5" fill="#2f8f45" transform="rotate(-20 18 26)"/>` +
    [0, 72, 144, 216, 288]
      .map((a) => {
        const rad = (a * Math.PI) / 180;
        return `<circle cx="${n(28 + Math.cos(rad) * 7)}" cy="${n(18 + Math.sin(rad) * 7)}" r="7" fill="#ff3d50" stroke="#8a1c2a" stroke-width="1.2"/>`;
      })
      .join('') +
    `<circle cx="28" cy="18" r="3.5" fill="#ffd23f"/>`,
});

const shells = (): Prop => ({
  w: 44,
  h: 24,
  ax: 22,
  ay: 18,
  flat: true,
  body:
    `<path d="M8 16q6 -14 14 0Z" fill="#ffd9c7" stroke="#c98d72" stroke-width="1.5"/>` +
    stroke('M15 16v-10M11 16l2 -8M19 16l-2 -8', '#c98d72', 1.2) +
    `<ellipse cx="32" cy="15" rx="6" ry="4" fill="#fff2d6" stroke="#c9a872" stroke-width="1.5"/>`,
});

const starfish = (): Prop => ({
  w: 36,
  h: 32,
  ax: 18,
  ay: 26,
  flat: true,
  body: flat(
    poly(
      Array.from({ length: 10 }, (_, i) => {
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const rad = i % 2 ? 5 : 13;
        return [18 + Math.cos(a) * rad, 16 + Math.sin(a) * rad] as [number, number];
      }),
    ),
    '#ff9a1f',
    '#b85a0b',
    1.8,
  ),
});

function crab(): Prop {
  const w = 0.9 * T;
  const h = 0.6 * T;
  const ax = w / 2;
  const ay = h - 4;
  const red: Tone = ['#ff6a4a', '#d24a2e'];
  const line = '#6e1f12';
  return {
    w,
    h,
    ax,
    ay,
    body:
      shadow(ax, ay, 20, 4) +
      stroke(
        `M${ax - 14} ${ay - 8}l-8 6M${ax - 12} ${ay - 5}l-6 7M${ax + 14} ${ay - 8}l8 6M${ax + 12} ${ay - 5}l6 7`,
        line,
        2.5,
      ) +
      shaded(
        `M${ax - 16} ${ay - 8}Q${ax} ${ay - 30} ${ax + 16} ${ay - 8}Z`,
        red,
        line,
        -2,
        -2,
        2.5,
      ) +
      flat(circ(ax - 22, ay - 22, 7), red[0], line, 2) +
      flat(circ(ax + 22, ay - 22, 7), red[0], line, 2) +
      flat(circ(ax - 5, ay - 22, 3), '#ffffff', line, 1.5) +
      flat(circ(ax + 5, ay - 22, 3), '#ffffff', line, 1.5),
  };
}

function turtle(): Prop {
  const w = 1.1 * T;
  const h = 0.75 * T;
  const ax = w / 2;
  const ay = h - 4;
  const line = '#1f4a2a';
  return {
    w,
    h,
    ax,
    ay,
    body:
      shadow(ax, ay, 28, 5) +
      flat(`M${ax + 22} ${ay - 14}q16 -4 14 8q-4 6 -14 0Z`, '#8fcf6a', line, 2) +
      flat(
        `M${ax - 22} ${ay - 6}l-8 6M${ax + 14} ${ay - 4}l6 6M${ax - 12} ${ay - 4}l-6 6`,
        'none',
        line,
        4,
      ) +
      shaded(
        `M${ax - 26} ${ay - 8}Q${ax - 4} ${ay - 40} ${ax + 22} ${ay - 8}Z`,
        ['#5fa843', '#3f7f2e'],
        line,
        -3,
        -3,
      ) +
      stroke(`M${ax - 12} ${ay - 12}l8 -10l10 10M${ax - 4} ${ay - 22}v12`, '#8fcf6a', 2) +
      flat(circ(ax + 30, ay - 12, 1.8), '#1a1a1f', '#1a1a1f', 0),
  };
}

function parrot(): Prop {
  const w = 0.9 * T;
  const h = 2 * T;
  const ax = w / 2;
  const ay = h - 6;
  const line = '#2a1a14';
  return {
    w,
    h,
    ax,
    ay,
    foot: [1, 1],
    body:
      shadow(ax, ay, 14, 4) +
      stroke(`M${ax} ${ay}V${ay - 1.2 * T}M${ax - 18} ${ay - 1.2 * T}H${ax + 18}`, '#8f6339', 5) +
      shaded(
        `M${ax - 6} ${ay - 1.25 * T}Q${ax - 16} ${ay - 1.6 * T} ${ax} ${ay - 1.8 * T}Q${ax + 14} ${ay - 1.6 * T} ${ax + 6} ${ay - 1.25 * T}Z`,
        ['#ff3d50', '#bd1c31'],
        line,
        -2,
        -2,
        2,
      ) +
      flat(
        `M${ax - 4} ${ay - 1.3 * T}Q${ax - 12} ${ay - 1.1 * T} ${ax - 6} ${ay - 0.95 * T}`,
        '#4cc7ff',
        line,
        2,
      ) +
      flat(`M${ax + 2} ${ay - 1.55 * T}q8 -2 6 6q-2 4 -6 1Z`, '#ffc93c', line, 1.8) +
      flat(circ(ax - 2, ay - 1.62 * T, 2.5), '#ffffff', line, 1.2) +
      stroke(`M${ax - 8} ${ay - 1.4 * T}q-4 6 0 12`, '#ffc93c', 3),
  };
}

function flamingo(): Prop {
  const w = 0.9 * T;
  const h = 1.9 * T;
  const ax = w / 2;
  const ay = h - 6;
  const pink: Tone = ['#ff8fb4', '#e06a92'];
  const line = '#7a2a48';
  return {
    w,
    h,
    ax,
    ay,
    body:
      shadow(ax, ay, 14, 4) +
      stroke(`M${ax} ${ay}V${ay - 0.75 * T}M${ax} ${ay - 0.5 * T}l10 -6l-6 -8`, '#e06a92', 3) +
      shaded(
        `M${ax - 18} ${ay - 0.85 * T}Q${ax - 14} ${ay - 1.15 * T} ${ax + 8} ${ay - 1.05 * T}Q${ax + 16} ${ay - 0.8 * T} ${ax - 2} ${ay - 0.72 * T}Z`,
        pink,
        line,
        -2,
        -2,
        2,
      ) +
      stroke(
        `M${ax + 4} ${ay - 1.02 * T}Q${ax + 18} ${ay - 1.4 * T} ${ax + 6} ${ay - 1.55 * T}`,
        pink[0],
        5,
      ) +
      stroke(
        `M${ax + 4} ${ay - 1.02 * T}Q${ax + 18} ${ay - 1.4 * T} ${ax + 6} ${ay - 1.55 * T}`,
        line,
        1,
        0.6,
      ) +
      flat(circ(ax + 4, ay - 1.58 * T, 6), pink[0], line, 2) +
      flat(`M${ax - 1} ${ay - 1.58 * T}l-9 6l4 2Z`, '#2a2a33', line, 1.5),
  };
}

function templeRuin(): Prop {
  const foot: [number, number] = [5, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 3.4, 0.3);
  const stone: Tone = ['#b9b29a', '#968f78'];
  const line = '#4a4535';
  let s = shadow(ax, ay - 2, 2.7 * T, 12, 0.22);
  for (let i = 0; i < 3; i++) {
    const inset = i * 0.6 * T;
    const y = ay - (i + 1) * 0.85 * T;
    s += shaded(rr(L + inset, y, R - L - inset * 2, 0.85 * T + 2, 4), stone, line, -6, -4);
    for (let x = L + inset + 20; x < R - inset - 10; x += 34)
      s += stroke(`M${x} ${y + 4}v${0.85 * T - 8}`, stone[1], 2.5, 0.7);
  }
  // carved tiki face at the top
  const fy = ay - 3 * T;
  s += shaded(rr(ax - 30, fy, 60, 0.6 * T, 6), ['#a39c84', '#857e66'], line, -3, -3);
  s += stroke(
    `M${ax - 18} ${fy + 12}h10M${ax + 8} ${fy + 12}h10M${ax - 14} ${fy + 28}h28`,
    line,
    4,
  );
  // moss and vines
  s += stroke(
    `M${L + 10} ${ay - 0.8 * T}q20 10 40 -2q20 -12 46 4M${R - 30} ${ay - 1.6 * T}q-6 16 4 30`,
    '#4fae55',
    6,
    0.9,
  );
  return { w, h, ax, ay, foot, body: s };
}

export const TROPIC: Record<string, Prop> = {
  'palm-a': palm(-1, 41),
  'palm-b': palm(1, 42),
  'palm-c': palm(-0.4, 43),
  'chatka-a': hut(['#3fb39b', '#2c8574']),
  'chatka-b': hut(['#ff7aa8', '#d95a88']),
  'chatka-c': hut(['#4c8fd6', '#36689f']),
  'bar-plaza': beachBar(),
  'stragan-owoce': fruitStall(),
  'parasol-a': umbrella('#ff3d50', '#ffffff'),
  'parasol-b': umbrella('#4cc7ff', '#ffc93c'),
  'lezak-a': deckchair('#4cc7ff'),
  'lezak-b': deckchair('#ff9a1f'),
  'deski-surf': surfRack(),
  lodz: boat(),
  pochodnia: torch(),
  'jungle-a': jungleTree(61),
  'jungle-b': jungleTree(62),
  paproc: fern(),
  hibiskus: hibiscus(),
  muszle: shells(),
  rozgwiazda: starfish(),
  krab: crab(),
  zolw: turtle(),
  papuga: parrot(),
  flaming: flamingo(),
  'ruiny-swiatyni': templeRuin(),
  'rock-dark': rock(true, ['#5d5853', '#45413d'], '#2a2725', '#8a847c'),
  'rock-dark-b': rock(false, ['#5d5853', '#45413d'], '#2a2725', '#8a847c'),
};
