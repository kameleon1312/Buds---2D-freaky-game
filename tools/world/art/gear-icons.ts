// Icons for the gear of the world (packages/shared/src/gear-items.ts): a few dozen shapes, each item picks one with
// its own colours. Same 64×64 frame and cel style as icons.ts; epic and legendary items get a glint.
import { circ, flat, poly, rr, shaded, stroke, type Tone } from './kit';
import type { Icon } from './icons';

const LINE = '#121218';
const T = (base: string, dark: string): Tone => [base, dark];

// ---------- head ----------
const beanie = (c: Tone, a: string) =>
  shaded(`M12 42Q12 14 32 14Q52 14 52 42Z`, c, LINE, -4, -3) +
  shaded(rr(10, 38, 44, 10, 4), [c[1], c[1]], LINE, 0, 0) +
  stroke('M20 22l0 14M28 18l0 18M36 18l0 18M44 22l0 14', a, 2.5, 0.6) +
  flat(circ(32, 12, 5), a, LINE, 2);
const bandana = (c: Tone, a: string) =>
  shaded(`M10 36Q12 18 32 16Q52 18 54 36Q32 30 10 36Z`, c, LINE, -3, -3) +
  shaded(`M50 34L58 46L50 44L46 50Z`, c, LINE, -1, -1) +
  [18, 28, 38, 46].map((x) => flat(circ(x, 26, 2.5), a, LINE, 1)).join('');
const cap = (c: Tone, a: string) =>
  shaded(`M16 38Q16 16 34 16Q50 16 50 38Z`, c, LINE, -4, -3) +
  shaded(`M50 36L62 40Q62 46 48 44Z`, [c[1], c[1]], LINE, 0, 0) +
  flat(rr(26, 24, 14, 8, 2), a, LINE, 1.5);
const hood = (c: Tone, a: string) =>
  shaded(`M10 54Q8 12 32 10Q56 12 54 54H44Q46 26 32 24Q18 26 20 54Z`, c, LINE, -4, -3) +
  stroke('M26 40v12M38 40v12', a, 2.5);
const beret = (c: Tone, a: string) =>
  shaded(`M8 34Q12 14 34 14Q58 16 56 30Q48 38 30 38Q12 38 8 34Z`, c, LINE, -4, -3) +
  shaded(rr(14, 34, 34, 8, 4), [c[1], c[1]], LINE, 0, 0) +
  stroke('M34 14l2 -6', a, 3);
const helmet = (c: Tone, a: string) =>
  shaded(`M10 42Q10 12 32 12Q54 12 54 42V48H10Z`, c, LINE, -4, -3) +
  shaded(`M28 26H54V40H28Z`, ['#4a6178', '#34465a'], LINE, -2, -2) +
  stroke('M32 30l8 0', '#ffffff', 2.5, 0.7) +
  stroke('M12 44h16', a, 3);
const captain = (c: Tone, a: string) =>
  shaded(`M12 32Q14 16 32 16Q50 16 52 32Z`, ['#f6f2e9', '#d8cfbf'], LINE, -3, -3) +
  shaded(rr(10, 30, 44, 10, 3), c, LINE, -2, -2) +
  shaded(`M16 40L48 40L54 46Q32 52 10 46Z`, [LINE, LINE], LINE, 0, 0) +
  flat(circ(32, 24, 5), a, LINE, 1.5);
const crown = (c: Tone, a: string) =>
  shaded(
    poly([
      [8, 48],
      [10, 18],
      [22, 32],
      [32, 12],
      [42, 32],
      [54, 18],
      [56, 48],
    ]),
    c,
    LINE,
    -3,
    -3,
  ) + [16, 32, 48].map((x) => flat(circ(x, 42, 4), a, LINE, 1.5)).join('');
const metalHelmet = (c: Tone, a: string) =>
  shaded(`M10 46Q10 12 32 12Q54 12 54 46Z`, c, LINE, -4, -3) +
  flat(rr(28, 18, 8, 30, 2), c[1], LINE, 1.5) +
  [16, 48].map((x) => flat(circ(x, 38, 2.5), a, LINE, 1)).join('') +
  stroke('M14 30q18 -10 36 0', a, 2.5, 0.6);
const headband = (c: Tone, a: string) =>
  shaded(rr(6, 24, 52, 14, 6), c, LINE, -3, -2) +
  shaded(`M52 30L62 44L54 42L50 50Z`, c, LINE, -1, -1) +
  flat(circ(32, 31, 5), a, LINE, 1.5);

// ---------- face ----------
const lenses = (c: Tone, a: string, round = false) =>
  (round
    ? flat(circ(18, 32, 11), c[0], LINE, 3) + flat(circ(46, 32, 11), c[0], LINE, 3)
    : shaded(rr(6, 24, 24, 16, 5), c, LINE, -2, -2) +
      shaded(rr(34, 24, 24, 16, 5), c, LINE, -2, -2)) +
  stroke('M30 30Q32 27 34 30', LINE, 3) +
  stroke(round ? 'M12 28l5 0M40 28l5 0' : 'M10 28l6 0M38 28l6 0', a, 2.5, 0.8);
const cloth = (c: Tone, a: string) =>
  shaded(`M8 22Q32 30 56 22L52 46Q32 58 12 46Z`, c, LINE, -3, -3) +
  stroke('M14 34q18 6 36 0', a, 2.5);
const goggles = (c: Tone, a: string) =>
  stroke('M4 32H60', a, 5) +
  shaded(rr(8, 22, 22, 20, 8), c, LINE, -2, -2) +
  shaded(rr(34, 22, 22, 20, 8), c, LINE, -2, -2) +
  stroke('M12 28l6 0M38 28l6 0', '#ffffff', 2.5, 0.8);
const hockey = (c: Tone, a: string) =>
  shaded(`M14 10Q32 4 50 10L52 40Q32 60 12 40Z`, c, LINE, -3, -3) +
  [20, 32, 44].map((x) => flat(rr(x - 3, 20, 6, 8, 2), LINE, LINE, 0)).join('') +
  flat(rr(18, 34, 28, 4, 2), a, LINE, 1);
const venetian = (c: Tone, a: string) =>
  shaded(`M4 24Q18 14 32 26Q46 14 60 24Q56 42 40 40L32 34L24 40Q8 42 4 24Z`, c, LINE, -3, -3) +
  flat(`M14 26q6 -4 10 2q-6 4 -10 -2Z`, LINE, LINE, 0) +
  flat(`M40 28q4 -6 10 -2q-4 6 -10 2Z`, LINE, LINE, 0) +
  stroke('M8 22q-4 -10 6 -14', a, 3);
const visor = (c: Tone, a: string) =>
  shaded(rr(4, 22, 56, 20, 9), c, LINE, -3, -2) +
  flat(rr(10, 27, 44, 10, 5), a, LINE, 1.5) +
  stroke('M16 30l10 0', '#ffffff', 2.5, 0.8);
const luchador = (c: Tone, a: string) =>
  shaded(`M12 50Q6 10 32 8Q58 10 52 50Z`, c, LINE, -4, -3) +
  flat(`M16 28Q24 20 30 30Q24 36 16 28Z`, '#ffffff', LINE, 2) +
  flat(`M34 30Q40 20 48 28Q40 36 34 30Z`, '#ffffff', LINE, 2) +
  stroke('M32 10V22M20 46q12 6 24 0', a, 3);

// ---------- torso ----------
const shirt = (c: Tone, extra = '') =>
  shaded(
    `M18 18L26 14Q32 18 38 14L46 18L54 28L46 33L44 30V52H20V30L18 33L10 28Z`,
    c,
    LINE,
    -4,
    -3,
  ) + extra;
const tee = (c: Tone, a: string) => shirt(c, flat(rr(26, 26, 12, 14, 3), a, LINE, 1.5));
const kangaroo = (c: Tone, a: string) =>
  shirt(
    c,
    flat(rr(22, 38, 20, 10, 3), c[1], LINE, 2) +
      flat(`M24 16Q32 30 40 16`, c[1], LINE, 2.5) +
      stroke('M29 22v8M35 22v8', a, 2),
  );
const denim = (c: Tone, a: string) =>
  shirt(
    c,
    stroke('M32 18V52', LINE, 2.5) +
      flat(rr(21, 30, 8, 7, 1), c[1], LINE, 1.5) +
      flat(rr(35, 30, 8, 7, 1), c[1], LINE, 1.5) +
      [26, 38].map((x) => flat(circ(x, 44, 1.6), a, LINE, 0.8)).join(''),
  );
const track = (c: Tone, a: string) =>
  shirt(
    c,
    stroke('M32 18V52', LINE, 2.5) +
      stroke('M12 27L20 31M52 27L44 31', a, 3.5) +
      stroke('M22 26l8 6M42 26l-8 6', a, 3),
  );
const vest = (c: Tone, a: string) =>
  shaded(`M20 12L28 12L32 20L36 12L44 12L50 22V54H14V22Z`, c, LINE, -3, -3) +
  [18, 36].flatMap((x) => [26, 40].map((y) => flat(rr(x, y, 10, 9, 2), c[1], LINE, 1.5))).join('') +
  stroke('M32 20V54', a, 2);
const puffer = (c: Tone, a: string) =>
  shirt(c, stroke('M14 30h36M18 38h28M20 46h24', c[1], 3) + stroke('M32 18V52', a, 2.5));
const leather = (c: Tone, a: string) =>
  shirt(
    c,
    stroke('M28 16L36 52', LINE, 2.5) +
      stroke('M24 18L30 30M40 18L34 30', '#5d5853', 3) +
      [20, 44].map((x) => flat(circ(x, 22, 2), a, LINE, 1)).join(''),
  );
const coat = (c: Tone, a: string) =>
  shaded(`M18 14L26 10Q32 14 38 10L46 14L52 58H12Z`, c, LINE, -4, -3) +
  stroke('M32 14V58', LINE, 2.5) +
  [24, 34, 44]
    .map((y) => flat(circ(28, y, 2), a, LINE, 1) + flat(circ(36, y, 2), a, LINE, 1))
    .join('');
const tires = (c: Tone, a: string) =>
  shirt(
    [c[0], c[1]],
    [26, 36, 46]
      .map(
        (y) =>
          `<ellipse cx="32" cy="${y}" rx="16" ry="5" fill="#2a2a30" stroke="${LINE}" stroke-width="2"/>`,
      )
      .join('') + stroke('M20 20h24', a, 3),
  );

// ---------- hands ----------
const glove = (c: Tone, a: string, fingerless = false) =>
  shaded(
    `M18 54V30L14 22Q12 18 16 18L22 26V12Q22 8 26 8Q30 8 30 12V24V10Q30 6 34 6Q38 6 38 10V26V14Q38 10 42 10Q46 10 46 14V40Q46 54 34 54Z`,
    c,
    LINE,
    -3,
    -2,
  ) +
  (fingerless ? stroke('M22 16h8M30 14h8M38 18h8', '#f3c9a6', 4) : '') +
  flat(rr(18, 44, 28, 8, 3), a, LINE, 1.5);
const bracelet = (c: Tone, a: string) =>
  `<ellipse cx="32" cy="34" rx="22" ry="12" fill="${c[0]}" stroke="${LINE}" stroke-width="3"/>` +
  `<ellipse cx="32" cy="34" rx="14" ry="6" fill="#23262f" stroke="${LINE}" stroke-width="2"/>` +
  [12, 22, 32, 42, 52]
    .map((x) =>
      flat(
        poly([
          [x - 3, 28],
          [x, 18],
          [x + 3, 28],
        ]),
        a,
        LINE,
        1.5,
      ),
    )
    .join('');
const wraps = (c: Tone, a: string) =>
  shaded(rr(14, 14, 36, 38, 10), c, LINE, -3, -3) +
  stroke('M14 22l36 8M14 32l36 8M14 42l36 6', a, 2.5);
const watch = (c: Tone, a: string) =>
  shaded(rr(24, 4, 16, 56, 5), [c[1], c[1]], LINE, 0, 0) +
  shaded(circ(32, 32, 14), c, LINE, -2, -2) +
  flat(circ(32, 32, 10), '#f6f2e9', LINE, 1.5) +
  stroke('M32 32V25M32 32l5 3', LINE, 2.5) +
  flat(rr(45, 29, 4, 6, 1), a, LINE, 1);
const rings = (c: Tone, a: string) =>
  [14, 26, 38, 50]
    .map(
      (x, i) =>
        `<ellipse cx="${x}" cy="${34 + (i % 2) * 6}" rx="7" ry="9" fill="none" stroke="${LINE}" stroke-width="6"/><ellipse cx="${x}" cy="${34 + (i % 2) * 6}" rx="7" ry="9" fill="none" stroke="${c[0]}" stroke-width="3"/>` +
        flat(circ(x, 25 + (i % 2) * 6, 3), a, LINE, 1),
    )
    .join('');

// ---------- legs ----------
const pants = (c: Tone, stripe?: string, short = false) =>
  shaded(
    short ? `M16 10H48L50 40H36L32 26L28 40H14Z` : `M16 8H48L50 56H36L32 24L28 56H14Z`,
    c,
    LINE,
    -3,
    -3,
  ) +
  flat(rr(16, short ? 10 : 8, 32, 6, 2), c[1], LINE, 2) +
  (stripe
    ? stroke(short ? 'M18 16L16 38M46 16L48 38' : 'M18 16L16 54M46 16L48 54', stripe, 3)
    : '');
const shorts = (c: Tone, a: string) =>
  pants(c, undefined, true) +
  [22, 40, 30].map((x, i) => flat(circ(x, 22 + i * 6, 3), a, LINE, 1)).join('');
const jeans = (c: Tone, a: string) =>
  pants(c) +
  flat(rr(18, 36, 8, 5, 2), '#c4dbf0', LINE, 1) +
  flat(rr(38, 44, 8, 5, 2), '#c4dbf0', LINE, 1) +
  stroke('M32 14V22', a, 2);
const kneepads = (c: Tone, a: string) =>
  pants(['#3a3d4a', '#262833']) +
  shaded(rr(14, 30, 16, 14, 5), c, LINE, -2, -2) +
  shaded(rr(34, 30, 16, 14, 5), c, LINE, -2, -2) +
  stroke('M18 37h8M38 37h8', a, 2.5);

// ---------- feet ----------
const shoe = (c: Tone, sole: string) =>
  shaded(`M8 30Q10 22 20 22L30 20Q36 30 46 32L54 34Q60 36 58 44V48H8Z`, c, LINE, -3, -3) +
  flat(rr(6, 44, 54, 8, 3), sole, LINE, 2) +
  stroke('M22 24l4 6M28 22l4 6', LINE, 2);
const sandal = (c: Tone, a: string) =>
  shaded(rr(6, 40, 52, 10, 5), c, LINE, -2, -2) +
  stroke('M20 42Q28 26 40 42', a, 5) +
  stroke('M20 42Q28 26 40 42', LINE, 1.5, 0.5);
const boot = (c: Tone, a: string) =>
  shaded(`M18 10H34V38L52 42Q56 44 56 50V54H14V16Q14 10 18 10Z`, c, LINE, -3, -3) +
  flat(rr(12, 50, 46, 6, 2), a, LINE, 2) +
  stroke('M20 18h10M20 24h10M20 30h10', '#b7bec9', 2);
const cowboy = (c: Tone, a: string) =>
  shaded(`M16 8H36L34 38L52 42Q58 44 58 52H18L14 44Z`, c, LINE, -3, -3) +
  stroke('M20 16q6 8 12 0M20 26q6 8 12 0', a, 2.5) +
  flat(circ(14, 50, 4), '#b7bec9', LINE, 1.5);
const rocket = (c: Tone, a: string) =>
  shoe(c, a) +
  flat(
    poly([
      [2, 40],
      [10, 34],
      [10, 46],
    ]),
    '#ff9a1f',
    LINE,
    1.5,
  ) +
  flat(
    poly([
      [0, 41],
      [6, 38],
      [6, 44],
    ]),
    '#ffe27a',
    LINE,
    1,
  );

// ---------- accessory ----------
const chain = (c: Tone, a: string) =>
  stroke('M10 12Q32 54 54 12', LINE, 7) +
  stroke('M10 12Q32 54 54 12', c[0], 4) +
  flat(circ(32, 40, 7), a, LINE, 2);
const pouch = (c: Tone, a: string) =>
  stroke('M4 26H60', LINE, 6) +
  stroke('M4 26H60', c[1], 3) +
  shaded(rr(16, 22, 32, 22, 8), c, LINE, -3, -3) +
  stroke('M20 30h24', a, 2.5);
const backpack = (c: Tone, a: string) =>
  shaded(rr(14, 14, 36, 42, 10), c, LINE, -3, -3) +
  stroke('M24 14Q24 6 32 6Q40 6 40 14', LINE, 3) +
  shaded(rr(20, 34, 24, 16, 4), [c[1], c[1]], LINE, -2, -2) +
  stroke('M26 40h12', a, 2.5);
const phones = (c: Tone, a: string) =>
  stroke('M14 40Q14 12 32 12Q50 12 50 40', LINE, 7) +
  stroke('M14 40Q14 12 32 12Q50 12 50 40', a, 3) +
  shaded(rr(8, 32, 12, 20, 5), c, LINE, -2, -2) +
  shaded(rr(44, 32, 12, 20, 5), c, LINE, -2, -2);
const medal = (c: Tone, a: string) =>
  flat(
    poly([
      [22, 4],
      [30, 4],
      [34, 28],
      [26, 28],
    ]),
    a,
    LINE,
    1.5,
  ) +
  flat(
    poly([
      [42, 4],
      [34, 4],
      [30, 28],
      [38, 28],
    ]),
    a,
    LINE,
    1.5,
  ) +
  shaded(circ(32, 40, 15), c, LINE, -3, -3) +
  flat(
    poly([
      [32, 31],
      [35, 38],
      [42, 38],
      [36, 43],
      [38, 50],
      [32, 46],
      [26, 50],
      [28, 43],
      [22, 38],
      [29, 38],
    ]),
    '#ffffff',
    LINE,
    1,
  );
const bag = (c: Tone, a: string) =>
  stroke('M8 8L44 40', LINE, 5) +
  stroke('M8 8L44 40', c[1], 2.5) +
  shaded(rr(22, 28, 36, 26, 5), c, LINE, -3, -3) +
  shaded(rr(22, 28, 36, 10, 4), [c[1], c[1]], LINE, 0, 0) +
  flat(rr(36, 34, 8, 6, 1), a, LINE, 1);
const cape = (c: Tone, a: string) =>
  shaded(`M20 8H44L56 56Q32 50 8 56Z`, c, LINE, -4, -3) +
  stroke('M20 10H44', a, 4) +
  flat(circ(32, 10, 3.5), a, LINE, 1.5);
const belt = (c: Tone, a: string) =>
  shaded(rr(2, 24, 60, 16, 4), c, LINE, -2, -2) +
  shaded(rr(20, 18, 24, 28, 6), [a, a], LINE, -2, -2) +
  flat(circ(32, 32, 6), '#ffffff', LINE, 1.5);
const star = (c: Tone, a: string) =>
  stroke('M32 4V20', a, 6) +
  shaded(
    poly([
      [32, 18],
      [38, 30],
      [52, 31],
      [41, 40],
      [45, 54],
      [32, 46],
      [19, 54],
      [23, 40],
      [12, 31],
      [26, 30],
    ]),
    c,
    LINE,
    -3,
    -3,
  ) +
  flat(circ(32, 36, 4), a, LINE, 1.5);
const shield = (c: Tone, a: string) =>
  shaded(circ(32, 32, 24), c, LINE, -4, -3) +
  `<circle cx="32" cy="32" r="16" fill="none" stroke="${c[1]}" stroke-width="3"/>` +
  flat(circ(32, 32, 6), a, LINE, 2);
const amulet = (c: Tone, a: string) =>
  stroke('M14 6Q32 30 50 6', LINE, 5) +
  stroke('M14 6Q32 30 50 6', '#b7bec9', 2.5) +
  shaded(`M32 22L46 38L32 58L18 38Z`, c, LINE, -3, -3) +
  flat(`M32 30L38 38L32 48L26 38Z`, a, LINE, 1.5);

// ---------- held (weapons) ----------
const stick = (c: Tone, a: string, fat = 4) =>
  `<path d="M12 56L48 10" stroke="${LINE}" stroke-width="${fat * 2 + 5}" stroke-linecap="round"/><path d="M12 56L48 10" stroke="${c[0]}" stroke-width="${fat * 2}" stroke-linecap="round"/>` +
  stroke('M14 54L22 44', a, fat * 2 - 1);
const bat = (c: Tone, a: string) =>
  `<path d="M14 54L46 12" stroke="${LINE}" stroke-width="9" stroke-linecap="round"/><path d="M14 54L46 12" stroke="${c[0]}" stroke-width="5" stroke-linecap="round"/>` +
  `<path d="M30 33L48 10" stroke="${LINE}" stroke-width="17" stroke-linecap="round"/><path d="M30 33L48 10" stroke="${c[0]}" stroke-width="13" stroke-linecap="round"/>` +
  stroke('M34 24L44 12', c[1], 3) +
  stroke('M12 56L18 48', a, 5);
const slingshot = (c: Tone, a: string) =>
  stroke('M32 58V34L16 12M32 34L48 12', LINE, 9) +
  stroke('M32 58V34L16 12M32 34L48 12', c[0], 5) +
  stroke('M16 14Q32 30 48 14', a, 2.5) +
  flat(circ(32, 24, 4), '#8a929e', LINE, 1.5);
const can = (c: Tone, a: string) =>
  shaded(rr(22, 18, 20, 38, 6), c, LINE, -3, -2) +
  shaded(rr(26, 10, 12, 9, 3), ['#e6ebf2', '#b7bec9'], LINE, -1, -1, 2) +
  flat(rr(22, 30, 20, 10, 1), a, LINE, 2) +
  `<circle cx="46" cy="12" r="3" fill="${a}"/><circle cx="52" cy="8" r="2" fill="${a}" opacity="0.7"/>`;
const megaphone = (c: Tone, a: string) =>
  shaded(`M8 26H20L50 10V54L20 38H8Z`, c, LINE, -3, -3) +
  shaded(rr(18, 38, 8, 16, 3), [c[1], c[1]], LINE, 0, 0) +
  stroke('M54 22q6 10 0 20', a, 3);
const surfboard = (c: Tone, a: string) =>
  shaded(`M32 2Q50 20 44 62Q32 66 20 62Q14 20 32 2Z`, c, LINE, -4, -3) + stroke('M32 8V58', a, 3);
const hockeyStick = (c: Tone, a: string) =>
  stroke('M44 4L28 52Q26 58 14 58', LINE, 9) +
  stroke('M44 4L28 52Q26 58 14 58', c[0], 5) +
  stroke('M18 56H30', a, 5);
const bow = (c: Tone, a: string) =>
  stroke('M16 4Q50 32 16 60', LINE, 8) +
  stroke('M16 4Q50 32 16 60', c[0], 4) +
  stroke('M16 4V60', '#f6f2e9', 1.5) +
  stroke('M10 32H52', LINE, 4) +
  flat(circ(54, 32, 5), a, LINE, 1.5);
const extinguisher = (c: Tone, a: string) =>
  shaded(rr(20, 18, 24, 42, 8), c, LINE, -3, -2) +
  shaded(rr(26, 10, 12, 9, 2), ['#3a3d4a', '#262833'], LINE, 0, 0) +
  stroke('M38 14Q52 12 52 26', LINE, 3.5) +
  flat(rr(20, 32, 24, 10, 1), a, LINE, 1.5);
const cane = (c: Tone, a: string) =>
  stroke('M22 60L42 14', LINE, 8) +
  stroke('M22 60L42 14', c[0], 4) +
  shaded(circ(44, 10, 7), [a, a], LINE, -1, -1);
const oar = (c: Tone, a: string) =>
  stroke('M10 56L40 18', LINE, 7) +
  stroke('M10 56L40 18', c[0], 3.5) +
  shaded(`M36 22L48 4Q60 6 56 18L44 30Z`, c, LINE, -2, -2) +
  stroke('M12 54L18 46', a, 5);
const boombox = (c: Tone, a: string) =>
  shaded(rr(4, 20, 56, 34, 6), c, LINE, -3, -3) +
  stroke('M18 20V12H46V20', LINE, 3) +
  flat(circ(18, 38, 9), '#262833', LINE, 2) +
  flat(circ(46, 38, 9), '#262833', LINE, 2) +
  flat(circ(18, 38, 3), a, LINE, 1) +
  flat(circ(46, 38, 3), a, LINE, 1) +
  flat(rr(27, 26, 10, 6, 1), a, LINE, 1);
const crossbow = (c: Tone, a: string) =>
  stroke('M8 20Q32 4 56 20', LINE, 7) +
  stroke('M8 20Q32 4 56 20', c[0], 3.5) +
  stroke('M8 20L56 20', '#f6f2e9', 1.5) +
  shaded(rr(28, 14, 8, 44, 3), [c[1], c[1]], LINE, 0, 0) +
  stroke('M32 4V20', a, 3);

const glint =
  `<path d="M54 6Q55 10 59 11Q55 12 54 16Q53 12 49 11Q53 10 54 6Z" fill="#ffe27a" stroke="#d98a0b" stroke-width="1.5"/>` +
  `<circle cx="10" cy="54" r="2.5" fill="#ffffff"/>`;

type Spec = [draw: string, rare?: boolean];
const s = (draw: string, rare = false): Spec => [draw, rare];

const SPECS: Record<string, Spec> = {
  // head
  'czapka-mrozik': s(beanie(T('#4cc7ff', '#1b86c9'), '#f6f2e9')),
  'bandana-ziomal': s(bandana(T('#ff3d50', '#bd1c31'), '#f6f2e9')),
  'daszek-pro-street': s(cap(T('#3a3d4a', '#262833'), '#a3e635')),
  'kaptur-cien': s(hood(T('#4a505c', '#363a47'), '#a9afbd')),
  'beret-artysty': s(beret(T('#b45cff', '#8a3fd1'), '#3a3d4a')),
  'kask-rumak': s(helmet(T('#ff3d50', '#bd1c31'), '#f6f2e9')),
  'czapka-kapitana': s(captain(T('#36689f', '#26507a'), '#ffc93c')),
  'korona-osiedla': s(crown(T('#ffc93c', '#d98a0b'), '#ff3d50'), true),
  'helm-karkos': s(metalHelmet(T('#8a929e', '#6f7783'), '#ff9a1f'), true),
  'opaska-mistrza': s(headband(T('#ff3d50', '#bd1c31'), '#ffc93c'), true),
  // face
  'okulary-sloneczko': s(lenses(T('#3a3d4a', '#262833'), '#ffffff')),
  'chusta-na-twarz': s(cloth(T('#3d7bd9', '#2d5c9c'), '#f6f2e9')),
  'gogle-rafa': s(goggles(T('#a9dcf5', '#7cc0e6'), '#3fb39b')),
  'okulary-kujon': s(lenses(T('#f6f2e9', '#d8cfbf'), '#8a929e', true)),
  'maska-bramkarz': s(hockey(T('#f6f2e9', '#d8cfbf'), '#ff3d50')),
  'gogle-szusz': s(goggles(T('#ff9a1f', '#d97a0b'), '#b45cff')),
  'maska-wenecja': s(venetian(T('#ffc93c', '#d98a0b'), '#b45cff'), true),
  'wizjer-sowa': s(visor(T('#3a3d4a', '#262833'), '#a3e635'), true),
  'maska-luchadora': s(luchador(T('#4cc7ff', '#1b86c9'), '#ffc93c'), true),
  'okulary-diament': s(lenses(T('#c4ecfc', '#7cc0e6'), '#ffffff'), true),
  // torso
  'koszulka-ligowa': s(tee(T('#ff3d50', '#bd1c31'), '#f6f2e9')),
  'bluza-kangurka': s(kangaroo(T('#ff9a1f', '#d97a0b'), '#3a3d4a')),
  'katana-jeans': s(denim(T('#3d7bd9', '#2d5c9c'), '#ffc93c')),
  'ortalion-retro': s(track(T('#b45cff', '#8a3fd1'), '#4cc7ff')),
  'kamizelka-wedkarza': s(vest(T('#8a8a5a', '#6b6b44'), '#3a3d4a')),
  'puchowka-balwan': s(puffer(T('#e6ebf2', '#b7bec9'), '#4cc7ff')),
  ramoneska: s(leather(T('#3a3d4a', '#262833'), '#b7bec9')),
  'plaszcz-hrabiego': s(coat(T('#8a2f3c', '#6e2430'), '#ffc93c'), true),
  'zbroja-z-opon': s(tires(T('#5d5853', '#45413d'), '#ff9a1f'), true),
  // hands
  'rekawiczki-pedal': s(glove(T('#a3e635', '#7cc01a'), '#3a3d4a', true)),
  'rekawice-budowlanca': s(glove(T('#c9b593', '#a8946f'), '#ff9a1f')),
  'bransoleta-z-kolcami': s(bracelet(T('#3a3d4a', '#262833'), '#b7bec9')),
  'bandaze-piesciarza': s(wraps(T('#f6f2e9', '#d8cfbf'), '#ff3d50')),
  'rekawiczki-neopren': s(glove(T('#3a3d4a', '#262833'), '#3fb39b')),
  'rekawice-klatka': s(glove(T('#ff3d50', '#bd1c31'), '#3a3d4a', true)),
  'zegarek-szpan': s(watch(T('#ffc93c', '#d98a0b'), '#ff3d50')),
  'pierscienie-szacunu': s(rings(T('#ffc93c', '#d98a0b'), '#4cc7ff'), true),
  'rekawice-bramkarza': s(glove(T('#4cc7ff', '#1b86c9'), '#ffc93c'), true),
  'rekawica-mistrza-ringu': s(glove(T('#ffc93c', '#d98a0b'), '#ff3d50'), true),
  // legs
  'szorty-aloha': s(shorts(T('#3fb39b', '#2c8574'), '#ff7aa8')),
  'jeansy-przecierki': s(jeans(T('#3d7bd9', '#2d5c9c'), '#ffc93c')),
  'dres-zlota-era': s(pants(T('#b45cff', '#8a3fd1'), '#ffc93c')),
  'spodnie-skejta': s(pants(T('#8a8a5a', '#6b6b44'), '#3a3d4a')),
  'nakolanniki-asfalt': s(kneepads(T('#ff9a1f', '#d97a0b'), '#3a3d4a')),
  'spodnie-rumak': s(pants(T('#3a3d4a', '#262833'), '#ff3d50')),
  'legginsy-sprint': s(pants(T('#4cc7ff', '#1b86c9'), '#a3e635')),
  'spodnie-galowe': s(pants(T('#26282f', '#16181f'), '#ffc93c'), true),
  'spodnie-cien': s(pants(T('#3a3d4a', '#262833'), '#b45cff'), true),
  'spodnie-krola-ringu': s(pants(T('#ff3d50', '#bd1c31'), '#ffc93c'), true),
  // feet
  'klapki-basen': s(sandal(T('#4cc7ff', '#1b86c9'), '#f6f2e9')),
  'tenisowki-kort': s(shoe(T('#f6f2e9', '#d8cfbf'), '#3fb39b')),
  'buty-skejta': s(shoe(T('#3a3d4a', '#262833'), '#f6f2e9')),
  'kalosze-bajoro': s(boot(T('#ffc93c', '#d98a0b'), '#3a3d4a')),
  'traperki-szlak': s(boot(T('#8f5e3b', '#6b4229'), '#ff3d50')),
  'kolce-biezni': s(shoe(T('#ff3d50', '#bd1c31'), '#f6f2e9')),
  kowbojki: s(cowboy(T('#8f5e3b', '#6b4229'), '#ffc93c')),
  'oficerki-dworskie': s(boot(T('#26282f', '#16181f'), '#ffc93c'), true),
  'rakiety-turbo': s(rocket(T('#b45cff', '#8a3fd1'), '#ffc93c'), true),
  // accessory
  'lancuszek-ziomka': s(chain(T('#b7bec9', '#8a929e'), '#b7bec9')),
  saszetka: s(pouch(T('#3a3d4a', '#262833'), '#a3e635')),
  'plecak-szkolny': s(backpack(T('#ff3d50', '#bd1c31'), '#ffc93c')),
  'sluchawki-bas': s(phones(T('#a3e635', '#7cc01a'), '#3a3d4a')),
  'medalik-szczescia': s(medal(T('#ffc93c', '#d98a0b'), '#4cc7ff')),
  'torba-kuriera': s(bag(T('#ffc93c', '#d98a0b'), '#3a3d4a')),
  'peleryna-nocy': s(cape(T('#3a3d4a', '#262833'), '#b45cff')),
  'pas-mistrzowski': s(belt(T('#3a3d4a', '#262833'), '#ffc93c')),
  'order-carski': s(star(T('#ffc93c', '#d98a0b'), '#ff3d50'), true),
  'tarcza-na-plecy': s(shield(T('#8a929e', '#6f7783'), '#ff3d50'), true),
  'amulet-wulkanu': s(amulet(T('#ff9a1f', '#d97a0b'), '#ffe27a'), true),
  // held
  'kij-od-szczotki': s(stick(T('#c48a52', '#9a6537'), '#ff3d50', 3)),
  'proca-z-galezi': s(slingshot(T('#8f5e3b', '#6b4229'), '#c9b593')),
  'spray-zwykly': s(can(T('#3a3d4a', '#262833'), '#f6f2e9')),
  'kij-hejnal': s(bat(T('#c48a52', '#9a6537'), '#3a3d4a')),
  'proca-sportowa': s(slingshot(T('#ff3d50', '#bd1c31'), '#3a3d4a')),
  megafon: s(megaphone(T('#ff9a1f', '#d97a0b'), '#ffffff')),
  'palka-teleskopowa': s(stick(T('#3a3d4a', '#262833'), '#8a929e', 4)),
  'deska-fala': s(surfboard(T('#4cc7ff', '#1b86c9'), '#ffc93c')),
  'kij-hokejowy': s(hockeyStick(T('#c48a52', '#9a6537'), '#3a3d4a')),
  'luk-przyssawki': s(bow(T('#a3e635', '#7cc01a'), '#ff3d50')),
  gasnica: s(extinguisher(T('#ff3d50', '#bd1c31'), '#f6f2e9')),
  'laska-hrabiego': s(cane(T('#3a3d4a', '#262833'), '#b7bec9'), true),
  'wioslo-pirata': s(oar(T('#8f5e3b', '#6b4229'), '#ff3d50'), true),
  boombox: s(boombox(T('#b45cff', '#8a3fd1'), '#a3e635'), true),
  'kusza-mysliwego': s(crossbow(T('#6b4229', '#4f2f1c'), '#b7bec9'), true),
  'zloty-kij-szefa': s(bat(T('#ffc93c', '#d98a0b'), '#3a3d4a'), true),
  // premium weapons (packages/shared premium.ts): unique colours, same shapes as their twins
  'premium-deska-plomien': s(surfboard(T('#ff9a1f', '#d97a0b'), '#ff3d50'), true),
  'premium-kij-neon': s(stick(T('#a3e635', '#5d9a12'), '#ff3d7a', 4), true),
  'premium-proca-laser': s(bow(T('#3a3d4a', '#262833'), '#ff3d50'), true),
  'premium-spray-tecza': s(can(T('#b45cff', '#8a3fd1'), '#4cc7ff'), true),
  'premium-mikrofon-zloty': s(megaphone(T('#ffc93c', '#d98a0b'), '#ff3d7a'), true),
  'premium-kij-smoka': s(bat(T('#2c8574', '#1d5c50'), '#ffc93c'), true),
};

export const GEAR_ICONS: Record<string, Icon> = Object.fromEntries(
  Object.entries(SPECS).map(([id, [draw, rare]]) => [id, { body: draw + (rare ? glint : '') }]),
);
