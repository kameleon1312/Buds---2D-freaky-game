// Places that grew out of the reserved plots and the new wild forest (Dzika Puszcza): the stadium, the funfair,
// a square with a stage, a waterfall, the old mill, the orangery, the mine, the power plant ruins, a tiki village
// and a camp in the woods. Same cel style as the rest (kit.ts): base + shade, soft contours, light from top-left.
import {
  BARK,
  BARK_LINE,
  GLASS,
  LEAF,
  LEAF2,
  LEAF3,
  METAL,
  STONE,
  STONE_LINE,
  T,
  WOOD,
  WOOD_LINE,
  circ,
  fill,
  frame,
  n,
  poly,
  puffs,
  rng,
  rr,
  shaded,
  shadow,
  stroke,
  type Prop,
  type Tone,
} from './kit';

const LINE = '#3d2c24';
const CONCRETE: Tone = ['#c9c4bb', '#a29c92'];
const RED: Tone = ['#ff5a4a', '#c8322a'];
const BLUE: Tone = ['#4cc7ff', '#1b86c9'];
const LIME: Tone = ['#a3e635', '#5d9a12'];
const GOLD: Tone = ['#ffc93c', '#d98a0b'];
const PINK: Tone = ['#ff8fc8', '#d9609c'];
const WHITE: Tone = ['#f6f2e9', '#d8cfbf'];
const ROCK: Tone = ['#9a958c', '#6f6a63'];
const DARK_ROCK: Tone = ['#6f6a63', '#4c4843'];
const WATER = '#5cbdeb';
const FOAM = '#e4f6fd';

// ---------- Stadion Ziomków ----------

/** Concrete stand: three tiers of seats in club colours with a railing on top. */
function stand(): Prop {
  const foot: [number, number] = [9, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 2.8, 0.15);
  let s = shadow(ax, ay - 2, (R - L) / 2 + 10, 14, 0.25);
  const top = ay - 2.5 * T;
  s += shaded(
    poly([
      [L, ay],
      [L, top + 18],
      [R, top + 18],
      [R, ay],
    ]),
    CONCRETE,
    STONE_LINE,
    -6,
    -4,
  );
  // three tiers of seats, the lower ones nearer (and wider)
  const tiers = 3;
  for (let i = 0; i < tiers; i++) {
    const y0 = top + 22 + i * 0.72 * T;
    s += fill(rr(L + 6, y0 + 26, R - L - 12, 8, 2), '#8f8a83', 0.6);
    for (let x = L + 12; x + 18 <= R - 8; x += 24) {
      const tone = (x / 24 + i) % 3 < 1 ? BLUE : LIME;
      s += shaded(rr(x, y0, 18, 22, 5), tone, '#22303a', -2, -2, 2);
    }
  }
  // railing along the top
  s += stroke(`M${L + 4} ${top + 14}H${R - 4}`, '#5d5853', 5);
  for (let x = L + 8; x <= R - 8; x += 22) s += stroke(`M${x} ${top + 14}v-18`, '#5d5853', 4);
  s += stroke(`M${L + 4} ${top - 4}H${R - 4}`, '#8a929e', 4);
  // a club banner
  s += shaded(rr(ax - 60, top + 2.05 * T, 120, 26, 4), GOLD, LINE, -2, -2, 2);
  s += `<text x="${ax}" y="${n(top + 2.05 * T + 19)}" font-family="Rubik Black" font-weight="900" font-size="18" text-anchor="middle" fill="#3d2c24">ZIOMKI</text>`;
  return { w, h, ax, ay, foot, body: s };
}

/** A football goal: white posts and a net (solid, you can't walk through the posts). */
function goal(): Prop {
  const foot: [number, number] = [5, 1];
  const { w, h, ax, ay, L, R } = frame(foot, 1.9, 0.15);
  let s = shadow(ax, ay - 2, (R - L) / 2, 10, 0.2);
  const top = ay - 1.55 * T;
  // net: a light grid behind the posts
  s += fill(rr(L + 8, top + 6, R - L - 16, ay - top - 12, 4), '#ffffff', 0.25);
  let net = '';
  for (let x = L + 16; x < R - 10; x += 14) net += `M${x} ${top + 6}V${ay - 6}`;
  for (let y = top + 16; y < ay - 6; y += 14) net += `M${L + 8} ${y}H${R - 8}`;
  s += stroke(net, '#ffffff', 1.6, 0.7);
  s += shaded(rr(L + 2, top, 10, ay - top, 4), WHITE, '#8f8a83', -2, -1, 2.5);
  s += shaded(rr(R - 12, top, 10, ay - top, 4), WHITE, '#8f8a83', -2, -1, 2.5);
  s += shaded(rr(L + 2, top, R - L - 4, 10, 4), WHITE, '#8f8a83', -1, -2, 2.5);
  return { w, h, ax, ay, foot, body: s };
}

/** The scoreboard on two legs. */
function scoreboard(): Prop {
  const foot: [number, number] = [3, 1];
  const { w, h, ax, ay } = frame(foot, 3.4, 0.2);
  let s = shadow(ax, ay - 2, 70, 10, 0.2);
  s += shaded(rr(ax - 62, ay - 1.6 * T, 12, 1.6 * T, 4), METAL, '#5d5853', -2, 0, 2.5);
  s += shaded(rr(ax + 50, ay - 1.6 * T, 12, 1.6 * T, 4), METAL, '#5d5853', -2, 0, 2.5);
  const y = ay - 3.1 * T;
  s += shaded(rr(ax - 84, y, 168, 1.6 * T, 10), ['#2f3340', '#1f222b'], '#121218', -4, -4);
  s += `<text x="${ax - 40}" y="${n(y + 62)}" font-family="Rubik Black" font-weight="900" font-size="44" text-anchor="middle" fill="#ffc93c">2</text>`;
  s += `<text x="${ax}" y="${n(y + 58)}" font-family="Rubik Black" font-weight="900" font-size="30" text-anchor="middle" fill="#a9afbd">:</text>`;
  s += `<text x="${ax + 40}" y="${n(y + 62)}" font-family="Rubik Black" font-weight="900" font-size="44" text-anchor="middle" fill="#a3e635">1</text>`;
  s += fill(rr(ax - 70, y + 12, 140, 6, 3), '#4cc7ff', 0.8);
  return { w, h, ax, ay, foot, body: s };
}

/** White pitch markings, flat on the grass. */
const pitchLine = (vertical: boolean): Prop => ({
  w: T,
  h: T,
  ax: T / 2,
  ay: T / 2 + 16,
  flat: true,
  body: fill(vertical ? rr(T / 2 - 4, 0, 8, T, 2) : rr(0, T / 2 - 4, T, 8, 2), '#f6f2e9', 0.9),
});

const centreCircle = (): Prop => ({
  w: 5 * T,
  h: 3.4 * T,
  ax: 2.5 * T,
  ay: 1.7 * T + 16,
  flat: true,
  foot: [5, 3],
  body:
    `<ellipse cx="${2.5 * T}" cy="${1.7 * T}" rx="${2.2 * T}" ry="${1.45 * T}" fill="none" stroke="#f6f2e9" stroke-width="8" opacity="0.9"/>` +
    fill(circ(2.5 * T, 1.7 * T, 9), '#f6f2e9', 0.9),
});

// ---------- Lunapark ----------

/** A carousel: round platform, striped tent roof, horses on poles. */
function carousel(): Prop {
  const foot: [number, number] = [5, 4];
  const { w, h, ax, ay } = frame(foot, 4.3, 0.2);
  let s = shadow(ax, ay - 8, 2.5 * T, 22, 0.25);
  const base = ay - 0.55 * T;
  s += `<ellipse cx="${ax}" cy="${n(base)}" rx="${2.3 * T}" ry="${0.55 * T}" fill="#9a6537" stroke="${WOOD_LINE}" stroke-width="3"/>`;
  s += `<ellipse cx="${ax}" cy="${n(base - 8)}" rx="${2.2 * T}" ry="${0.5 * T}" fill="#c48a52" stroke="${WOOD_LINE}" stroke-width="3"/>`;
  const roof = ay - 3.4 * T;
  // poles and horses
  const horses: [number, Tone][] = [
    [-1.5, PINK],
    [-0.5, BLUE],
    [0.5, GOLD],
    [1.5, LIME],
  ];
  for (const [k, tone] of horses) {
    const x = ax + k * T;
    s += stroke(`M${x} ${roof + 30}V${base - 4}`, '#ffc93c', 5);
    const hy = base - 0.9 * T + ((k * 13) % 18);
    s += shaded(
      `M${x - 22} ${hy}q4 -16 22 -16q14 0 18 -12l8 4q-4 14 -12 18q6 10 0 22h-36q-6 -6 0 -16Z`,
      tone,
      LINE,
      -3,
      -2,
      2.5,
    );
  }
  // striped cone roof
  const stripes = 8;
  for (let i = 0; i < stripes; i++) {
    const x0 = ax - 2.4 * T + (i * 4.8 * T) / stripes;
    const x1 = x0 + (4.8 * T) / stripes;
    s += shaded(
      poly([
        [ax, roof - 0.9 * T],
        [x0, roof + 0.25 * T],
        [x1, roof + 0.25 * T],
      ]),
      i % 2 ? WHITE : RED,
      '#8a2a24',
      -2,
      -2,
      2,
    );
  }
  s += `<ellipse cx="${ax}" cy="${n(roof + 0.25 * T)}" rx="${2.4 * T}" ry="14" fill="#ff5a4a" stroke="#8a2a24" stroke-width="3"/>`;
  for (let i = 0; i < 9; i++)
    s += fill(circ(ax - 2.2 * T + i * 0.55 * T, roof + 0.25 * T + 4, 5), '#ffc93c');
  s += shaded(circ(ax, roof - 0.95 * T, 10), GOLD, LINE, -2, -2, 2.5);
  return { w, h, ax, ay, foot, body: s };
}

/** A small ferris wheel on an A-frame. */
function ferrisWheel(): Prop {
  const foot: [number, number] = [5, 2];
  const { w, h, ax, ay } = frame(foot, 5.6, 0.3);
  let s = shadow(ax, ay - 4, 2.2 * T, 16, 0.24);
  const cy = ay - 3.1 * T;
  const r = 2.25 * T;
  // A-frame legs
  s += stroke(`M${ax - 1.6 * T} ${ay - 6}L${ax} ${cy}L${ax + 1.6 * T} ${ay - 6}`, '#5d5853', 12);
  s += stroke(`M${ax - 1.6 * T} ${ay - 6}L${ax} ${cy}L${ax + 1.6 * T} ${ay - 6}`, '#8a929e', 7);
  s += `<circle cx="${ax}" cy="${n(cy)}" r="${n(r)}" fill="none" stroke="#5d5853" stroke-width="10"/>`;
  s += `<circle cx="${ax}" cy="${n(cy)}" r="${n(r)}" fill="none" stroke="#e6ebf2" stroke-width="5"/>`;
  const cabins: Tone[] = [RED, BLUE, GOLD, LIME, PINK, BLUE, RED, GOLD];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = ax + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    s += stroke(`M${ax} ${cy}L${n(x)} ${n(y)}`, '#b7bec9', 3);
    s += shaded(rr(x - 15, y + 2, 30, 24, 7), cabins[i]!, LINE, -2, -2, 2.5);
    s += fill(rr(x - 10, y + 7, 20, 8, 3), '#e4f6fd', 0.85);
  }
  s += shaded(circ(ax, cy, 14), GOLD, LINE, -2, -2, 3);
  return { w, h, ax, ay, foot, body: s };
}

/** A candy-floss booth with a striped awning. */
function candyBooth(): Prop {
  const foot: [number, number] = [3, 2];
  const { w, h, ax, ay, L, R } = frame(foot, 2.6, 0.2);
  let s = shadow(ax, ay - 2, (R - L) / 2 + 6, 10, 0.22);
  const top = ay - 1.4 * T;
  s += shaded(rr(L + 6, top, R - L - 12, ay - top - 2, 6), WHITE, LINE, -4, -3);
  s += fill(rr(L + 14, top + 14, R - L - 28, 0.5 * T, 4), '#3a3d4a', 0.85);
  // pink clouds of candy floss on sticks
  for (const dx of [-26, 0, 26]) {
    s += stroke(`M${ax + dx} ${top + 30}v26`, '#f6f2e9', 3);
    s += puffs(
      [
        [ax + dx - 6, top + 22, 9],
        [ax + dx + 6, top + 22, 9],
        [ax + dx, top + 14, 10],
      ],
      { base: '#ffb3dc', dark: '#ff8fc8', light: '#ffe0f0', line: '#c9568e' },
      '',
      4,
    );
  }
  // awning
  const aw = top - 0.55 * T;
  for (let i = 0; i < 6; i++) {
    const x0 = L + (i * (R - L)) / 6;
    s += shaded(rr(x0, aw, (R - L) / 6, 0.55 * T, 3), i % 2 ? WHITE : PINK, '#8a3f63', -1, -2, 2);
  }
  s += `<text x="${ax}" y="${n(ay - 10)}" font-family="Rubik Black" font-weight="900" font-size="15" text-anchor="middle" fill="#d9609c">WATA</text>`;
  return { w, h, ax, ay, foot, body: s };
}

/** A bunch of balloons tied to a weight. */
function balloons(): Prop {
  const w = 1.4 * T;
  const h = 2.6 * T;
  const ax = w / 2;
  const ay = h - 8;
  let s = shadow(ax, ay - 2, 16, 6, 0.2);
  s += shaded(rr(ax - 9, ay - 14, 18, 14, 4), METAL, '#5d5853', -1, -1, 2);
  const tones: Tone[] = [RED, BLUE, GOLD, LIME, PINK];
  const spots: [number, number][] = [
    [-22, -2.05],
    [0, -2.25],
    [22, -2.0],
    [-12, -1.65],
    [12, -1.7],
  ];
  spots.forEach(([dx, k], i) => {
    const x = ax + dx;
    const y = ay + k * T;
    s += stroke(
      `M${ax} ${ay - 14}Q${ax + dx * 0.3} ${n(ay - 0.8 * T)} ${x} ${n(y + 20)}`,
      '#f6f2e9',
      1.8,
    );
    s += shaded(
      `M${x} ${n(y - 18)}q16 0 16 18q0 14 -16 20q-16 -6 -16 -20q0 -18 16 -18Z`,
      tones[i]!,
      LINE,
      -3,
      -3,
      2.5,
    );
  });
  return { w, h, ax, ay, body: s };
}

// ---------- Plac Ziomków ----------

/** An open-air stage: boards, a truss with lights and two speakers. */
function stage(): Prop {
  const foot: [number, number] = [7, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 3.6, 0.2);
  let s = shadow(ax, ay - 2, (R - L) / 2 + 8, 14, 0.25);
  const deck = ay - 0.7 * T;
  s += shaded(rr(L, deck, R - L, ay - deck, 6), WOOD, WOOD_LINE, -5, -4);
  for (let x = L + 30; x < R; x += 34)
    s += stroke(`M${x} ${deck + 8}V${ay - 4}`, '#9a6537', 2, 0.7);
  s += fill(rr(L + 4, deck - 0.12 * T, R - L - 8, 0.2 * T, 4), '#c48a52');
  // truss
  const top = ay - 3.3 * T;
  for (const x of [L + 14, R - 14]) {
    s += stroke(`M${x} ${deck}V${top}`, '#5d5853', 10);
    s += stroke(`M${x} ${deck}V${top}`, '#b7bec9', 5);
  }
  s += stroke(`M${L + 10} ${top}H${R - 10}`, '#5d5853', 12);
  s += stroke(`M${L + 10} ${top}H${R - 10}`, '#b7bec9', 6);
  let zig = `M${L + 16} ${top}`;
  for (let x = L + 16; x < R - 16; x += 22) zig += `L${x + 11} ${top + 9}L${x + 22} ${top}`;
  s += stroke(zig, '#8a929e', 2.5);
  for (const [dx, c] of [
    [-1.8, '#ffc93c'],
    [-0.6, '#ff5a4a'],
    [0.6, '#4cc7ff'],
    [1.8, '#a3e635'],
  ] as const) {
    s += shaded(
      rr(ax + dx * T - 10, top + 8, 20, 18, 5),
      ['#3a3d4a', '#262833'],
      '#121218',
      -1,
      -1,
      2,
    );
    s += fill(circ(ax + dx * T, top + 20, 6), c);
  }
  // speakers
  for (const x of [L + 26, R - 26]) {
    s += shaded(
      rr(x - 22, deck - 1.1 * T, 44, 1.1 * T, 6),
      ['#3a3d4a', '#262833'],
      '#121218',
      -3,
      -3,
    );
    s += fill(circ(x, deck - 0.75 * T, 12), '#121218');
    s += fill(circ(x, deck - 0.3 * T, 8), '#121218');
  }
  return { w, h, ax, ay, foot, body: s };
}

// ---------- wild nature ----------

/** A waterfall pouring off a mossy cliff into a foaming pool. */
function waterfall(): Prop {
  const foot: [number, number] = [7, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 4.6, 0.25);
  let s = '';
  const top = ay - 4.2 * T;
  // cliff
  s += shaded(
    poly([
      [L - 8, ay - 0.6 * T],
      [L + 0.4 * T, top + 0.6 * T],
      [ax - 1.1 * T, top],
      [ax + 1.3 * T, top + 0.2 * T],
      [R - 0.3 * T, top + 0.7 * T],
      [R + 8, ay - 0.6 * T],
    ]),
    ROCK,
    STONE_LINE,
    -8,
    -6,
  );
  // cracks and ledges
  s += stroke(
    `M${L + 40} ${top + 1.6 * T}l30 18M${R - 60} ${top + 1.2 * T}l-24 26M${L + 70} ${top + 2.6 * T}l40 -10`,
    '#6f6a63',
    3,
    0.8,
  );
  // moss and bushes on top
  s += puffs(
    [
      [ax - 1.6 * T, top + 14, 26],
      [ax - 0.9 * T, top + 2, 30],
      [ax + 1.2 * T, top + 10, 28],
      [ax + 2 * T, top + 26, 24],
    ],
    LEAF2,
  );
  // the falling water
  s += fill(rr(ax - 0.75 * T, top + 10, 1.5 * T, ay - top - 0.5 * T, 18), WATER);
  let streaks = '';
  for (let x = ax - 0.6 * T; x < ax + 0.65 * T; x += 13)
    streaks += `M${n(x)} ${top + 20}V${n(ay - 0.7 * T)}`;
  s += stroke(streaks, FOAM, 3, 0.75);
  // pool and foam
  s += `<ellipse cx="${ax}" cy="${n(ay - 0.45 * T)}" rx="${2.9 * T}" ry="${0.48 * T}" fill="${WATER}" stroke="#3a8fbf" stroke-width="3"/>`;
  s += puffs(
    [
      [ax - 0.6 * T, ay - 0.62 * T, 16],
      [ax, ay - 0.7 * T, 18],
      [ax + 0.6 * T, ay - 0.62 * T, 16],
    ],
    { base: '#ffffff', dark: '#e4f6fd', light: '#ffffff', line: '#a9dcf5' },
    '',
    3,
  );
  s += `<ellipse cx="${ax - 1.6 * T}" cy="${n(ay - 0.42 * T)}" rx="${0.5 * T}" ry="7" fill="#c4ecfc" opacity="0.7"/>`;
  return { w, h, ax, ay, foot, body: s };
}

/** A fallen log with rings at the end and a mushroom. */
function log(): Prop {
  const foot: [number, number] = [3, 1];
  const { w, h, ax, ay } = frame(foot, 1.2, 0.15);
  let s = shadow(ax, ay - 4, 1.5 * T, 10, 0.22);
  s += shaded(rr(ax - 1.4 * T, ay - 0.7 * T, 2.6 * T, 0.62 * T, 20), BARK, BARK_LINE, -3, -3);
  s += stroke(
    `M${ax - 1.1 * T} ${ay - 0.45 * T}h${0.8 * T}M${ax - 0.1 * T} ${ay - 0.3 * T}h${0.9 * T}`,
    '#6b4229',
    3,
    0.8,
  );
  s += `<ellipse cx="${n(ax + 1.2 * T)}" cy="${n(ay - 0.39 * T)}" rx="16" ry="20" fill="#d9a46a" stroke="${BARK_LINE}" stroke-width="3"/>`;
  s += `<ellipse cx="${n(ax + 1.2 * T)}" cy="${n(ay - 0.39 * T)}" rx="8" ry="11" fill="none" stroke="#a9733f" stroke-width="2.5"/>`;
  s += shaded(`M${ax - 0.4 * T} ${ay - 0.7 * T}q14 -20 28 0Z`, RED, LINE, -2, -1, 2);
  s += fill(circ(ax - 0.4 * T + 9, ay - 0.7 * T - 6, 3), '#ffffff');
  return { w, h, ax, ay, foot, body: s };
}

/** A tree stump. */
function stump(): Prop {
  const w = 1.2 * T;
  const h = 1.2 * T;
  const ax = w / 2;
  const ay = h - 8;
  let s = shadow(ax, ay - 2, 28, 8, 0.2);
  s += shaded(
    `M${ax - 24} ${ay - 4}V${ay - 34}h48V${ay - 4}q-24 8 -48 0Z`,
    BARK,
    BARK_LINE,
    -3,
    -2,
  );
  s += `<ellipse cx="${ax}" cy="${ay - 34}" rx="24" ry="9" fill="#d9a46a" stroke="${BARK_LINE}" stroke-width="3"/>`;
  s += `<ellipse cx="${ax}" cy="${ay - 34}" rx="12" ry="4.5" fill="none" stroke="#a9733f" stroke-width="2"/>`;
  return { w, h, ax, ay, body: s };
}

/** Mushrooms in the grass (flat). */
const mushrooms = (): Prop => {
  const w = T;
  const h = T;
  let s = '';
  for (const [x, y, r] of [
    [22, 40, 9],
    [38, 46, 7],
    [44, 34, 6],
  ] as const) {
    s += fill(rr(x - 2.5, y - 2, 5, 10, 2), '#f6f2e9');
    s += shaded(`M${x - r} ${y}q${r} ${-r * 1.6} ${r * 2} 0Z`, RED, LINE, -1, -1, 1.5);
    s += fill(circ(x - r * 0.3, y - r * 0.55, 1.8), '#ffffff');
  }
  return { w, h, ax: w / 2, ay: h / 2 + 16, flat: true, body: s };
};

/** A pine tree: layered dark-green tiers on a trunk. */
function pine(
  tones: { base: string; dark: string; light: string; line: string },
  tall: number,
): Prop {
  const w = 1.6 * T;
  const h = (tall + 0.2) * T;
  const ax = w / 2;
  const ay = h - 8;
  let s = shadow(ax, ay - 2, 34, 10, 0.24);
  s += shaded(rr(ax - 8, ay - 0.7 * T, 16, 0.7 * T, 4), BARK, BARK_LINE, -2, 0, 2.5);
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const k = i / (tiers - 1);
    const y = ay - 0.6 * T - i * ((tall - 1) / tiers) * T;
    const half = (0.75 - k * 0.42) * T;
    s += shaded(
      poly([
        [ax - half, y],
        [ax, y - 0.95 * T],
        [ax + half, y],
      ]),
      [tones.base, tones.dark],
      tones.line,
      -5,
      -4,
      3,
    );
  }
  return { w, h, ax, ay, body: s };
}

/** A berry bush. */
function berryBush(): Prop {
  const w = 1.4 * T;
  const h = 1.3 * T;
  const ax = w / 2;
  const ay = h - 8;
  const r = rng(77);
  let berries = '';
  for (let i = 0; i < 9; i++)
    berries += fill(circ(ax - 22 + r() * 44, ay - 42 + r() * 28, 4), i % 3 ? '#5b4bd1' : '#e8524a');
  return {
    w,
    h,
    ax,
    ay,
    body:
      shadow(ax, ay - 2, 30, 8, 0.2) +
      puffs(
        [
          [ax - 14, ay - 26, 18],
          [ax + 14, ay - 26, 18],
          [ax, ay - 40, 20],
        ],
        LEAF3,
        berries,
      ),
  };
}

/** A two-person tent with the flap open. */
function tent(tone: Tone): Prop {
  const foot: [number, number] = [3, 2];
  const { w, h, ax, ay, L, R } = frame(foot, 2.2, 0.2);
  let s = shadow(ax, ay - 4, (R - L) / 2 + 6, 12, 0.24);
  const top = ay - 1.75 * T;
  s += shaded(
    poly([
      [L + 4, ay - 4],
      [ax, top],
      [R - 4, ay - 4],
    ]),
    tone,
    LINE,
    -6,
    -4,
  );
  s += fill(
    poly([
      [ax - 0.45 * T, ay - 4],
      [ax, top + 0.5 * T],
      [ax + 0.45 * T, ay - 4],
    ]),
    '#2f3340',
  );
  s += stroke(`M${ax} ${top}V${ay - 4}`, LINE, 2.5, 0.6);
  s += stroke(
    `M${L + 4} ${ay - 4}L${L - 8} ${ay + 4}M${R - 4} ${ay - 4}L${R + 8} ${ay + 4}`,
    '#8f8a83',
    2,
  );
  return { w, h, ax, ay, foot, body: s };
}

/** A campfire in a ring of stones (low, solid). */
function campfire(): Prop {
  const w = 1.2 * T;
  const h = 1.3 * T;
  const ax = w / 2;
  const ay = h - 10;
  let s = shadow(ax, ay - 2, 30, 9, 0.24);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    s += shaded(
      circ(ax + Math.cos(a) * 24, ay - 8 + Math.sin(a) * 9, 7),
      STONE,
      STONE_LINE,
      -1,
      -1,
      2,
    );
  }
  s += stroke(
    `M${ax - 16} ${ay - 6}L${ax + 14} ${ay - 16}M${ax + 16} ${ay - 6}L${ax - 14} ${ay - 16}`,
    '#6b4229',
    6,
  );
  s += shaded(
    `M${ax} ${ay - 52}q18 20 12 34q-4 8 -12 8q-8 0 -12 -8q-6 -14 12 -34Z`,
    ['#ffc93c', '#ff8a1f'],
    '#c8322a',
    -2,
    -2,
    2.5,
  );
  s += fill(`M${ax} ${ay - 36}q8 10 5 17q-2 4 -5 4q-3 0 -5 -4q-3 -7 5 -17Z`, '#fff1a8');
  return { w, h, ax, ay, body: s };
}

// ---------- Dwór Carski: the old mill and the orangery ----------

/** A brick watermill with a wooden wheel. */
/**
 * The old water mill, 5×4: a fieldstone ground floor, a half-timbered upper floor (dark beams over cream plaster), a
 * steep shingle roof with a hoist beam and a sack on its rope, a wooden water wheel on the right turning in its race,
 * sacks of flour by the door.
 */
function mill(): Prop {
  const foot: [number, number] = [5, 4];
  const { w, h, ax, ay, L, R } = frame(foot, 5.2, 0.4);
  const beam: Tone = ['#5a3a22', '#3f2816'];
  const plaster: Tone = ['#f2e8d2', '#d6c8a8'];
  let s = shadow(ax, ay - 2, (R - L) / 2 + 14, 16, 0.26);
  const l = L + 6;
  const r = R - 0.6 * T;
  const stoneTop = ay - 1.2 * T;
  const wallTop = ay - 2.7 * T;
  // the stone ground floor: rounded fieldstones
  s += shaded(rr(l, stoneTop, r - l, ay - stoneTop, 4), ['#b9b2a6', '#958e82'], LINE, -5, -3);
  const rr2 = rng(611);
  for (let y = stoneTop + 8; y < ay - 4; y += 12)
    for (let x = l + 6 + (Math.round(y) % 2) * 8; x < r - 8; x += 16 + rr2() * 6)
      s += `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(6 + rr2() * 2)}" ry="4.5" fill="${rr2() > 0.5 ? '#c9c2b6' : '#a8a194'}" stroke="#7a736a" stroke-width="1.2"/>`;
  // the half-timbered floor
  s += shaded(rr(l + 4, wallTop, r - l - 8, stoneTop - wallTop, 2), plaster, LINE, -5, -3);
  let beams = `M${n(l + 4)} ${n(wallTop + 3)}H${n(r - 4)}M${n(l + 4)} ${n(stoneTop - 3)}H${n(r - 4)}`;
  for (let x = l + 6; x <= r - 6; x += (r - l - 12) / 4)
    beams += `M${n(x)} ${n(wallTop)}V${n(stoneTop)}`;
  const third = (r - l - 12) / 4;
  beams += `M${n(l + 6)} ${n(stoneTop)}L${n(l + 6 + third)} ${n(wallTop)}M${n(r - 6)} ${n(stoneTop)}L${n(r - 6 - third)} ${n(wallTop)}`;
  s += stroke(beams, beam[1], 6) + stroke(beams, beam[0], 3.5);
  s += shaded(rr(l + 6 + third + 10, wallTop + 14, third - 20, 26, 3), GLASS, LINE, -2, -2, 2);
  s += shaded(rr(l + 6 + 2 * third + 10, wallTop + 14, third - 20, 26, 3), GLASS, LINE, -2, -2, 2);
  // the roof: steep shingles, a hoist beam with a sack
  const peak = wallTop - 1.7 * T;
  s += shaded(
    poly([
      [l - 10, wallTop + 6],
      [(l + r) / 2, peak],
      [r + 10, wallTop + 6],
    ]),
    ['#7a5a3e', '#5a3f2a'],
    LINE,
    -6,
    -5,
  );
  let shingles = '';
  for (let k = 1; k < 6; k++) {
    const y = peak + (k * (wallTop + 6 - peak)) / 6;
    const half = ((r - l + 20) / 2) * (k / 6);
    for (let x = (l + r) / 2 - half; x < (l + r) / 2 + half - 6; x += 10)
      shingles += `M${n(x)} ${n(y)}v6`;
    shingles += `M${n((l + r) / 2 - half)} ${n(y)}H${n((l + r) / 2 + half)}`;
  }
  s += stroke(shingles, '#4c3424', 1.4, 0.6);
  s += shaded(rr((l + r) / 2 - 18, wallTop - 0.7 * T, 36, 30, 3), beam, LINE, -2, -2, 2);
  s += stroke(`M${n((l + r) / 2)} ${n(wallTop - 0.7 * T + 4)}h${n(0.55 * T)}`, beam[1], 6);
  s += stroke(`M${n((l + r) / 2 + 0.5 * T)} ${n(wallTop - 0.7 * T + 6)}v26`, '#6b5a3a', 1.6);
  s += shaded(
    rr((l + r) / 2 + 0.5 * T - 9, wallTop - 0.7 * T + 30, 18, 20, 5),
    ['#efe6cf', '#cfc2a0'],
    '#7a6a48',
    -1,
    -1,
    1.4,
  );
  // the door, flour sacks
  s += shaded(rr(ax - 0.9 * T, ay - 0.95 * T, 0.75 * T, 0.95 * T - 4, 4), WOOD, WOOD_LINE, -3, -2);
  for (const [dx, dy] of [
    [-0.05, 0],
    [0.18, 0],
    [0.07, -0.22],
  ] as const)
    s += shaded(
      rr(ax + dx * T, ay - 0.42 * T + dy * T, 0.26 * T, 0.38 * T, 6),
      ['#efe6cf', '#cfc2a0'],
      '#7a6a48',
      -1,
      -1,
      1.4,
    );
  // the water wheel in its race
  const wx = R - 0.62 * T;
  const wy = ay - 1.15 * T;
  const rad = 1.05 * T;
  s += fill(rr(wx - rad - 6, ay - 12, rad * 2 + 12, 12, 3), WATER, 0.9);
  s += `<circle cx="${n(wx)}" cy="${n(wy)}" r="${n(rad)}" fill="none" stroke="${WOOD_LINE}" stroke-width="13"/>`;
  s += `<circle cx="${n(wx)}" cy="${n(wy)}" r="${n(rad)}" fill="none" stroke="#c48a52" stroke-width="8"/>`;
  s += `<circle cx="${n(wx)}" cy="${n(wy)}" r="${n(rad * 0.62)}" fill="none" stroke="#9a6537" stroke-width="4"/>`;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    s += stroke(
      `M${n(wx)} ${n(wy)}L${n(wx + Math.cos(a) * rad)} ${n(wy + Math.sin(a) * rad)}`,
      '#9a6537',
      4,
    );
    // the paddles round the rim
    const px = wx + Math.cos(a) * (rad + 4);
    const py = wy + Math.sin(a) * (rad + 4);
    s += stroke(
      `M${n(px - Math.sin(a) * 6)} ${n(py + Math.cos(a) * 6)}L${n(px + Math.sin(a) * 6)} ${n(py - Math.cos(a) * 6)}`,
      WOOD_LINE,
      5,
    );
  }
  s += shaded(circ(wx, wy, 11), WOOD, WOOD_LINE, -2, -2, 2.5);
  // water spilling from the paddles
  s += stroke(
    `M${n(wx - rad * 0.7)} ${n(wy + rad * 0.6)}q-4 10 -2 18M${n(wx - rad * 0.4)} ${n(wy + rad * 0.85)}q-2 6 0 10`,
    '#bfeaff',
    3,
    0.9,
  );
  return { w, h, ax, ay, foot, body: s };
}

/** A glass orangery with white frames and plants inside. */
function orangery(): Prop {
  const foot: [number, number] = [7, 4];
  const { w, h, ax, ay, L, R } = frame(foot, 3.6, 0.2);
  let s = shadow(ax, ay - 2, (R - L) / 2 + 8, 14, 0.24);
  const wall = ay - 1.9 * T;
  s += shaded(rr(L, ay - 0.35 * T, R - L, 0.35 * T, 4), STONE, STONE_LINE, -3, -2);
  // plants inside first, glass over them
  s += puffs(
    [
      [L + 70, wall + 40, 26],
      [ax, wall + 34, 30],
      [R - 70, wall + 40, 26],
    ],
    LEAF,
  );
  for (const x of [L + 70, R - 70]) s += fill(circ(x + 8, wall + 30, 6), '#ff9a1f');
  s += fill(rr(L + 6, wall, R - L - 12, ay - 0.35 * T - wall, 4), '#a9dcf5', 0.45);
  s += fill(`M${L + 6} ${wall}Q${ax} ${wall - 1.4 * T} ${R - 6} ${wall}Z`, '#c4ecfc', 0.55);
  // white frames
  let frames = `M${L + 6} ${wall}H${R - 6}`;
  for (let x = L + 6; x <= R - 6; x += (R - L - 12) / 7)
    frames += `M${n(x)} ${wall}V${n(ay - 0.35 * T)}`;
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    const x = L + 6 + t * (R - L - 12);
    const y = wall - Math.sin(t * Math.PI) * 1.05 * T;
    frames += `M${ax} ${n(wall - 1.05 * T)}L${n(x)} ${wall}`;
    void y;
  }
  s += stroke(frames, '#f6f2e9', 4);
  s += stroke(`M${L + 6} ${wall}Q${ax} ${wall - 1.4 * T} ${R - 6} ${wall}`, '#f6f2e9', 5);
  s += shaded(circ(ax, wall - 1.05 * T - 6, 9), GOLD, LINE, -2, -2, 2.5);
  return { w, h, ax, ay, foot, body: s };
}

// ---------- Los Karkos: the old mine and the power plant ----------

/** A mine entrance: timber frame in a rock face, a dark shaft and a lamp. */
function mineEntrance(): Prop {
  const foot: [number, number] = [5, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 3.4, 0.3);
  let s = '';
  const top = ay - 3 * T;
  s += shaded(
    poly([
      [L - 10, ay],
      [L + 10, top + 0.8 * T],
      [ax - 0.6 * T, top],
      [ax + 0.9 * T, top + 0.3 * T],
      [R - 6, top + T],
      [R + 10, ay],
    ]),
    DARK_ROCK,
    '#3a3631',
    -7,
    -5,
  );
  s += fill(rr(ax - 0.95 * T, ay - 1.9 * T, 1.9 * T, 1.9 * T, 10), '#121218');
  s += shaded(rr(ax - 1.05 * T, ay - 2.05 * T, 18, 2.05 * T, 3), WOOD, WOOD_LINE, -2, 0, 2.5);
  s += shaded(rr(ax + 1.05 * T - 18, ay - 2.05 * T, 18, 2.05 * T, 3), WOOD, WOOD_LINE, -2, 0, 2.5);
  s += shaded(rr(ax - 1.2 * T, ay - 2.25 * T, 2.4 * T, 20, 3), WOOD, WOOD_LINE, -1, -2, 2.5);
  s += shaded(
    rr(ax - 0.75 * T, ay - 2.2 * T - 30, 1.5 * T, 26, 4),
    ['#e8c46a', '#b8933f'],
    WOOD_LINE,
    -1,
    -1,
    2,
  );
  s += `<text x="${ax}" y="${n(ay - 2.2 * T - 11)}" font-family="Rubik Black" font-weight="900" font-size="15" text-anchor="middle" fill="#3d2c24">KOPALNIA</text>`;
  s += stroke(`M${ax + 0.6 * T} ${ay - 1.7 * T}v16`, '#3a3d4a', 2);
  s += shaded(circ(ax + 0.6 * T, ay - 1.7 * T + 22, 7), GOLD, LINE, -1, -1, 2);
  return { w, h, ax, ay, foot, body: s };
}

/** A rusty mine cart full of ore. */
function mineCart(): Prop {
  const w = 1.4 * T;
  const h = 1.3 * T;
  const ax = w / 2;
  const ay = h - 8;
  let s = shadow(ax, ay - 2, 34, 8, 0.24);
  s += shaded(
    poly([
      [ax - 34, ay - 44],
      [ax + 34, ay - 44],
      [ax + 26, ay - 12],
      [ax - 26, ay - 12],
    ]),
    ['#a86a42', '#7d4a2c'],
    '#4a2a18',
    -3,
    -3,
  );
  s += stroke(`M${ax - 30} ${ay - 30}h60`, '#7d4a2c', 3);
  s += puffs(
    [
      [ax - 14, ay - 46, 10],
      [ax + 4, ay - 50, 11],
      [ax + 18, ay - 45, 9],
    ],
    { base: '#6f6a63', dark: '#4c4843', light: '#9a958c', line: '#2f2c29' },
    fill(circ(ax + 2, ay - 52, 3), '#ffc93c'),
    3,
  );
  for (const dx of [-18, 18])
    s += shaded(circ(ax + dx, ay - 10, 8), ['#5d5853', '#3a3631'], '#121218', -1, -1, 2);
  return { w, h, ax, ay, body: s };
}

/** A tall brick chimney of the old power plant, cracked at the top. */
function chimney(): Prop {
  const foot: [number, number] = [3, 3];
  const { w, h, ax, ay } = frame(foot, 6.4, 0.3);
  let s = shadow(ax, ay - 4, 1.4 * T, 14, 0.25);
  const top = ay - 6 * T;
  s += shaded(
    poly([
      [ax - 1.1 * T, ay],
      [ax - 0.55 * T, top],
      [ax + 0.55 * T, top],
      [ax + 1.1 * T, ay],
    ]),
    ['#b0614a', '#8a4636'],
    LINE,
    -6,
    -4,
  );
  let rings = '';
  for (let y = top + 30; y < ay - 10; y += 46)
    rings += `M${n(ax - 1.1 * T + ((ay - y) / (ay - top)) * 0.55 * T)} ${y}H${n(ax + 1.1 * T - ((ay - y) / (ay - top)) * 0.55 * T)}`;
  s += stroke(rings, '#7a3e2f', 3, 0.7);
  for (const y of [top + 0.8 * T, top + 3 * T])
    s += fill(
      rr(
        ax - 0.9 * T + ((ay - y) / (ay - top)) * 0.3 * T,
        y,
        1.8 * T - ((ay - y) / (ay - top)) * 0.6 * T,
        12,
        3,
      ),
      '#f6f2e9',
      0.85,
    );
  s += stroke(`M${ax - 0.2 * T} ${top}l10 30l-14 24l8 22`, '#4a2a20', 3);
  s += puffs(
    [
      [ax - 10, top - 18, 14],
      [ax + 12, top - 34, 18],
      [ax - 4, top - 56, 15],
    ],
    { base: '#d8d4cc', dark: '#b7b2a8', light: '#f0ede7', line: '#8f8a83' },
    '',
    3,
  );
  return { w, h, ax, ay, foot, body: s };
}

/** An old transformer box behind a fence, with a warning sign. */
function transformer(): Prop {
  const foot: [number, number] = [3, 2];
  const { w, h, ax, ay, L, R } = frame(foot, 2.4, 0.2);
  let s = shadow(ax, ay - 2, (R - L) / 2 + 6, 10, 0.22);
  s += shaded(
    rr(L + 8, ay - 1.6 * T, R - L - 16, 1.6 * T - 4, 6),
    ['#7a8a7a', '#5a6a5a'],
    '#2f3a2f',
    -4,
    -3,
  );
  for (let x = L + 20; x < R - 20; x += 14)
    s += stroke(`M${x} ${ay - 1.4 * T}v${0.9 * T}`, '#4a5a4a', 3);
  s += shaded(
    poly([
      [ax, ay - 1.25 * T],
      [ax + 18, ay - 0.85 * T],
      [ax - 18, ay - 0.85 * T],
    ]),
    GOLD,
    LINE,
    -1,
    -1,
    2,
  );
  s += `<text x="${ax}" y="${n(ay - 0.9 * T - 4)}" font-family="Rubik Black" font-weight="900" font-size="14" text-anchor="middle" fill="#3d2c24">!</text>`;
  s += stroke(
    `M${L + 4} ${ay - 1.95 * T}Q${ax} ${ay - 2.3 * T} ${R - 4} ${ay - 1.95 * T}`,
    '#3a3d4a',
    3,
  );
  return { w, h, ax, ay, foot, body: s };
}

/** A dirt jump for the motocross track. */
function dirtJump(): Prop {
  const foot: [number, number] = [3, 2];
  const { w, h, ax, ay, L, R } = frame(foot, 1.6, 0.2);
  let s = shadow(ax, ay - 2, (R - L) / 2 + 10, 10, 0.22);
  s += shaded(
    `M${L - 4} ${ay - 4}Q${ax - 20} ${ay - 1.3 * T} ${ax + 30} ${ay - 1.2 * T}L${R + 4} ${ay - 4}Z`,
    ['#b8834f', '#8f6236'],
    '#5a3a22',
    -5,
    -4,
  );
  s += stroke(`M${L + 20} ${ay - 22}q30 -26 70 -30`, '#8f6236', 3, 0.7);
  for (const [dx, c] of [
    [-40, '#ff5a4a'],
    [40, '#f6f2e9'],
  ] as const)
    s += fill(rr(ax + dx - 6, ay - 22, 12, 18, 3), c);
  return { w, h, ax, ay, foot, body: s };
}

// ---------- Las Palmas: Wioska Tiki ----------

/** A carved tiki totem with a grumpy face. */
function totem(): Prop {
  const w = 1.2 * T;
  const h = 2.8 * T;
  const ax = w / 2;
  const ay = h - 8;
  let s = shadow(ax, ay - 2, 26, 8, 0.22);
  s += shaded(rr(ax - 22, ay - 2.5 * T, 44, 2.5 * T, 10), BARK, BARK_LINE, -3, -2);
  for (const y of [ay - 2.1 * T, ay - 1.05 * T]) {
    s += fill(rr(ax - 15, y, 10, 8, 3), '#2f2a24');
    s += fill(rr(ax + 5, y, 10, 8, 3), '#2f2a24');
    s += fill(rr(ax - 12, y + 18, 24, 10, 4), '#ff9a1f');
    s += stroke(`M${ax - 22} ${y - 8}h44`, '#6b4229', 3);
  }
  s += puffs(
    [
      [ax - 18, ay - 2.5 * T, 12],
      [ax + 18, ay - 2.5 * T, 12],
      [ax, ay - 2.6 * T - 8, 14],
    ],
    LEAF3,
    '',
    4,
  );
  return { w, h, ax, ay, body: s };
}

export const PLACES: Record<string, Prop> = {
  trybuna: stand(),
  bramka: goal(),
  'tablica-wynikow': scoreboard(),
  'linia-boiska-h': pitchLine(false),
  'linia-boiska-v': pitchLine(true),
  'kolo-srodkowe': centreCircle(),
  karuzela: carousel(),
  'diabelski-mlyn': ferrisWheel(),
  'budka-wata': candyBooth(),
  balony: balloons(),
  scena: stage(),
  wodospad: waterfall(),
  kloda: log(),
  pien: stump(),
  grzyby: mushrooms(),
  sosna: pine({ base: '#3f8f5a', dark: '#2a6b42', light: '#5aa86e', line: '#1d4a2e' }, 3.2),
  swierk: pine({ base: '#2f7a5a', dark: '#1f5a42', light: '#4a9a72', line: '#143a2a' }, 3.6),
  'krzak-jagody': berryBush(),
  'namiot-a': tent(['#ff9a1f', '#c86b14']),
  'namiot-b': tent(['#4cc7ff', '#1b86c9']),
  ognisko: campfire(),
  mlyn: mill(),
  szklarnia: orangery(),
  'wejscie-kopalni': mineEntrance(),
  wagonik: mineCart(),
  komin: chimney(),
  transformator: transformer(),
  'skocznia-cross': dirtJump(),
  totem: totem(),
};
