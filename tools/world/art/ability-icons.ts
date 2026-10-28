// Ability icons for the fight buttons (Unity UI/CombatPad, Resources/Abilities/<name>.png): one picture per kind of
// blow, drawn like the other icons (64×64 units at 2×, cel shading, an ink outline, no frame: the button is the
// frame). Which ability shows which picture is packages/shared brawl.ts `abilityIcon`.
import { circ, flat, poly, rr, shaded, stroke, type Tone } from './kit';
import type { Icon } from './icons';

const LINE = '#121218';
const PAPER: Tone = ['#f6f2e9', '#d8cfbf'];
const SKIN: Tone = ['#f2c39b', '#d39a72'];
const LIME: Tone = ['#a3e635', '#7cc01a'];
const GOLD: Tone = ['#ffc93c', '#d98a0b'];
const REP: Tone = ['#4cc7ff', '#1b86c9'];
const ALERT: Tone = ['#ff3d50', '#bd1c31'];
const WOOD: Tone = ['#c48a52', '#9a6537'];
const STONE: Tone = ['#bdb7ae', '#8f8a83'];

/** Speed lines behind something moving to the right. */
const speed = (y0: number, n = 3, x = 6, len = 14) =>
  Array.from({ length: n }, (_, i) => stroke(`M${x} ${y0 + i * 7}h${len - i * 3}`, LINE, 3)).join(
    '',
  );

const fist = (x: number, y: number, s = 1) =>
  shaded(
    `M${x} ${y + 4 * s}Q${x} ${y - 8 * s} ${x + 12 * s} ${y - 8 * s}H${x + 20 * s}Q${x + 28 * s} ${y - 8 * s} ${x + 28 * s} ${y + 2 * s}V${y + 8 * s}Q${x + 28 * s} ${y + 16 * s} ${x + 18 * s} ${y + 16 * s}H${x + 8 * s}Q${x} ${y + 16 * s} ${x} ${y + 8 * s}Z`,
    SKIN,
    LINE,
    -2,
    -3,
  ) +
  stroke(
    `M${x + 10 * s} ${y - 7 * s}V${y + 2 * s}M${x + 17 * s} ${y - 7 * s}V${y + 2 * s}M${x + 23 * s} ${y - 6 * s}V${y + 2 * s}`,
    LINE,
    2,
  ) +
  // the thumb folded over the fingers
  shaded(
    `M${x + 2 * s} ${y + 6 * s}Q${x + 2 * s} ${y + 1 * s} ${x + 8 * s} ${y + 1 * s}H${x + 20 * s}Q${x + 24 * s} ${y + 1 * s} ${x + 24 * s} ${y + 5 * s}Q${x + 24 * s} ${y + 9 * s} ${x + 20 * s} ${y + 9 * s}H${x + 8 * s}`,
    SKIN,
    LINE,
    -1,
    -1,
  );

const burst = (cx: number, cy: number, r: number, tone: Tone) => {
  const pts: [number, number][] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rr2 = i % 2 ? r * 0.55 : r;
    pts.push([cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2]);
  }
  return shaded(poly(pts), tone, LINE, -2, -2);
};

const bat = (angle: number) =>
  `<g transform="rotate(${angle} 32 32)">` +
  shaded('M28 8Q32 6 36 8L35 46H29Z', WOOD, LINE, -2, -2) +
  flat(rr(28.5, 44, 7, 12, 2), '#3d2c24', LINE, 2) +
  `</g>`;

const board = (angle: number, y = 34) =>
  `<g transform="rotate(${angle} 32 ${y})">` +
  shaded(rr(8, y - 5, 48, 10, 5), LIME, LINE, -2, -2) +
  flat(circ(16, y + 7, 4), '#f6f2e9', LINE, 2) +
  flat(circ(48, y + 7, 4), '#f6f2e9', LINE, 2) +
  `</g>`;

const stone = (cx: number, cy: number, r: number) =>
  shaded(circ(cx, cy, r), STONE, LINE, -1.5, -1.5);

const can = (x: number, y: number) =>
  shaded(rr(x, y, 14, 26, 4), ALERT, LINE, -2, -2) +
  flat(rr(x + 3, y - 6, 8, 6, 2), '#b7bec9', LINE, 2) +
  flat(rr(x + 2, y + 8, 10, 8, 2), '#f6f2e9', LINE, 1.5);

const mic = (x: number, y: number) =>
  shaded(circ(x + 8, y + 8, 9), ['#b7bec9', '#8a929e'], LINE, -2, -2) +
  stroke(`M${x + 2} ${y + 5}h12M${x + 1} ${y + 10}h14`, LINE, 1.5, 0.6) +
  shaded(
    `M${x + 4} ${y + 16}L${x + 12} ${y + 16}L${x + 10} ${y + 38}H${x + 6}Z`,
    ['#3d3f4a', '#23262f'],
    LINE,
    -1,
    -1,
  );

const rings = (cx: number, cy: number, n: number, tone: string) =>
  Array.from({ length: n }, (_, i) =>
    stroke(
      `M${cx + 6 + i * 7} ${cy - 10 - i * 4}Q${cx + 14 + i * 9} ${cy} ${cx + 6 + i * 7} ${cy + 10 + i * 4}`,
      tone,
      4,
    ),
  ).join('');

const arcSweep = (tone: string) =>
  stroke('M12 46Q10 18 36 10Q52 8 56 20', tone, 6) +
  stroke('M12 46Q10 18 36 10Q52 8 56 20', LINE, 1.5, 0.5);

export const ABILITY_ICONS: Record<string, Icon> = {
  // basic blows
  'ab-fist': { body: speed(22) + fist(22, 30, 1.15) },
  'ab-bat': { body: bat(40) + stroke('M10 48Q14 30 26 20', '#f6f2e9', 4, 0.9) },
  'ab-board': { body: board(-20) + speed(14, 2, 4, 12) },
  'ab-stone': { body: speed(26, 3, 4, 16) + stone(40, 32, 10) },
  'ab-spray': {
    body:
      can(8, 26) +
      shaded(
        poly([
          [24, 30],
          [58, 14],
          [58, 50],
        ]),
        ['#ff7aa8', '#d95a88'],
        LINE,
        -2,
        -2,
      ) +
      [
        [44, 26],
        [50, 36],
        [40, 38],
      ]
        .map(([x, y]) => flat(circ(x!, y!, 2.4), '#f6f2e9', LINE, 1))
        .join(''),
  },
  'ab-mic': { body: mic(8, 12) + rings(24, 22, 3, '#4cc7ff') },
  // abilities
  'ab-dash': { body: speed(18, 4, 4, 20) + fist(26, 30, 1) + burst(54, 34, 8, GOLD) },
  'ab-kick': {
    body:
      arcSweep('#ffc93c') +
      shaded(
        'M24 30L44 30Q52 30 52 38V42H22Q18 42 18 36Q18 30 24 30Z',
        ['#23262f', '#16181f'],
        LINE,
        -1,
        -1,
      ) +
      flat(rr(18, 40, 34, 5, 2), '#f6f2e9', LINE, 2),
  },
  'ab-arc': { body: arcSweep('#4cc7ff') + bat(-30) },
  'ab-spin': {
    body:
      stroke('M32 10A22 22 0 1 1 10 32', '#a3e635', 6) +
      flat(
        poly([
          [4, 30],
          [16, 30],
          [10, 40],
        ]),
        '#a3e635',
        LINE,
        2,
      ) +
      stroke('M32 10A22 22 0 1 1 10 32', LINE, 1.5, 0.5) +
      bat(45),
  },
  'ab-fan': { body: stone(46, 14, 7) + stone(50, 32, 7) + stone(46, 50, 7) + speed(18, 3, 6, 18) },
  'ab-aim': {
    body:
      stroke('M32 6V20M32 44V58M6 32H20M44 32H58', LINE, 4) +
      flat(circ(32, 32, 16), 'none', LINE, 4) +
      shaded(circ(32, 32, 6), ALERT, LINE, -1, -1),
  },
  'ab-snipe': {
    body:
      stroke('M4 32H60', '#ffc93c', 7) +
      stroke('M4 32H60', LINE, 2) +
      flat(circ(46, 32, 12), 'none', LINE, 3.5) +
      shaded(circ(46, 32, 4), ALERT, LINE, -1, -1),
  },
  'ab-cloud': {
    body:
      shaded(
        'M14 44Q4 44 6 34Q8 26 16 28Q16 16 28 16Q38 16 40 24Q50 20 54 30Q60 40 50 44Z',
        ['#ff7aa8', '#d95a88'],
        LINE,
        -2,
        -3,
      ) +
      [
        [20, 50],
        [32, 54],
        [44, 50],
      ]
        .map(([x, y]) => flat(circ(x!, y!, 3), '#ff7aa8', LINE, 1.5))
        .join(''),
  },
  'ab-wave': {
    body:
      stroke('M4 32Q12 18 20 32T36 32T52 32T60 28', '#4cc7ff', 7) +
      stroke('M4 32Q12 18 20 32T36 32T52 32T60 28', LINE, 2),
  },
  'ab-drop': {
    body:
      flat(circ(32, 34, 26), 'none', '#4cc7ff', 4) +
      flat(circ(32, 34, 17), 'none', '#4cc7ff', 4) +
      shaded(
        poly([
          [26, 8],
          [38, 8],
          [38, 26],
          [46, 26],
          [32, 42],
          [18, 26],
          [26, 26],
        ]),
        GOLD,
        LINE,
        -2,
        -2,
      ),
  },
  'ab-flip': {
    body:
      board(30, 38) +
      stroke('M14 22Q32 0 50 22', '#f6f2e9', 4) +
      flat(
        poly([
          [46, 16],
          [56, 22],
          [46, 28],
        ]),
        '#f6f2e9',
        LINE,
        2,
      ),
  },
  'ab-dodge': {
    body:
      stroke('M8 46Q28 46 36 30Q44 14 58 14', '#a3e635', 8) +
      stroke('M8 46Q28 46 36 30Q44 14 58 14', LINE, 2) +
      speed(48, 2, 2, 10),
  },
  'ab-shield': {
    body:
      shaded('M32 6L54 14V30Q54 48 32 58Q10 48 10 30V14Z', REP, LINE, -3, -3) +
      stroke('M20 26L32 36L44 26M20 38L32 48L44 38', '#a9e6ff', 4),
  },
  'ab-counter': {
    body:
      shaded('M30 8L50 15V30Q50 46 30 55Q10 46 10 30V15Z', REP, LINE, -3, -3) +
      burst(46, 40, 13, GOLD),
  },
  'ab-tag': {
    body:
      can(6, 30) +
      stroke('M26 22Q36 10 44 22T60 22', '#a3e635', 6) +
      stroke('M26 38Q36 28 44 38T60 38', '#ffc93c', 6) +
      stroke('M26 22Q36 10 44 22T60 22M26 38Q36 28 44 38T60 38', LINE, 1.5, 0.5),
  },
  'ab-rain': {
    body:
      stone(16, 14, 6) +
      stone(34, 10, 6) +
      stone(50, 18, 6) +
      flat(circ(32, 44, 14), 'none', ALERT[0], 4) +
      stone(32, 40, 6),
  },
  'ab-star': { body: burst(32, 32, 26, LIME) + burst(32, 32, 12, GOLD) },
  'ab-homerun': { body: bat(-55) + stone(50, 16, 7) + speed(40, 2, 36, 12) },
  'ab-ramp': {
    body:
      shaded(
        poly([
          [6, 52],
          [58, 52],
          [58, 22],
        ]),
        PAPER,
        LINE,
        -2,
        -2,
      ) + board(-30, 20),
  },
  // a low sweep at the legs: a shoe skimming the ground under an arc
  'ab-sweep': {
    body:
      stroke('M8 50Q32 60 56 50', '#ffc93c', 6) +
      stroke('M8 50Q32 60 56 50', LINE, 1.5, 0.5) +
      shaded(
        'M18 30L40 30Q48 30 48 38V42H16Q12 42 12 36Q12 30 18 30Z',
        ['#23262f', '#16181f'],
        LINE,
        -1,
        -1,
      ) +
      flat(rr(12, 40, 36, 5, 2), '#f6f2e9', LINE, 2) +
      speed(20, 2, 46, 12),
  },
  // a sprint: a running shoe with speed lines and a lime streak
  'ab-sprint': {
    body:
      speed(22, 4, 4, 22) +
      stroke('M10 50H44', '#a3e635', 6) +
      shaded(
        'M26 26L46 26Q56 26 56 36V40H24Q20 40 20 34Q20 26 26 26Z',
        ['#a3e635', '#7cc01a'],
        LINE,
        -1,
        -1,
      ) +
      flat(rr(20, 38, 38, 6, 2), '#f6f2e9', LINE, 2),
  },
};
