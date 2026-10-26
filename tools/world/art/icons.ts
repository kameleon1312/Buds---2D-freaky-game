// Icons for the Bud panel: one per catalog item a player can own or wear, and one per skill.
// 64×64 units, centred, rendered at 2× (128 px). No outline around the icon frame — the UI slot draws it.
import { GEAR_ICONS } from './gear-icons';
import { RIDE_ICONS } from './rides';
import { circ, flat, poly, rr, shaded, stroke, type Tone } from './kit';

const LINE = '#121218';

export type Icon = { body: string };

const shirt = (tone: Tone, collar = '') =>
  shaded(
    `M18 18L26 14Q32 18 38 14L46 18L54 28L46 33L44 30V52H20V30L18 33L10 28Z`,
    tone,
    LINE,
    -4,
    -3,
  ) + collar;

const ICONS_ITEMS: Record<string, Icon> = {
  'outfit-bluza': {
    body:
      shirt(['#a3e635', '#7cc01a']) +
      flat(`M24 16Q32 30 40 16`, '#7cc01a', LINE, 2.5) +
      flat(rr(24, 38, 16, 9, 3), '#7cc01a', LINE, 2) +
      stroke('M29 22v8M35 22v8', LINE, 2),
  },
  'outfit-koszula': {
    body:
      shirt(['#f6f2e9', '#d8cfbf']) +
      flat(
        poly([
          [24, 16],
          [32, 26],
          [28, 30],
          [21, 20],
        ]),
        '#ffffff',
        LINE,
        2,
      ) +
      flat(
        poly([
          [40, 16],
          [32, 26],
          [36, 30],
          [43, 20],
        ]),
        '#ffffff',
        LINE,
        2,
      ) +
      stroke('M32 26V52', LINE, 2) +
      [32, 38, 44].map((y) => flat(circ(34, y, 1.6), '#4cc7ff', LINE, 1)).join(''),
  },
  'outfit-sweter': {
    body:
      shirt(['#ff7aa8', '#d95a88']) +
      stroke('M24 32l4 4l4 -4l4 4l4 -4M24 40l4 4l4 -4l4 4l4 -4', '#ffffff', 2, 0.7) +
      flat(rr(20, 47, 24, 5, 2), '#d95a88', LINE, 1.5),
  },
  'outfit-polo': {
    body:
      shirt(['#3fb39b', '#2c8574']) +
      flat(
        poly([
          [25, 16],
          [32, 23],
          [29, 27],
          [22, 19],
        ]),
        '#2c8574',
        LINE,
        1.5,
      ) +
      flat(
        poly([
          [39, 16],
          [32, 23],
          [35, 27],
          [42, 19],
        ]),
        '#2c8574',
        LINE,
        1.5,
      ) +
      stroke('M32 23V32', LINE, 1.5),
  },
  'outfit-kamizelka': {
    body:
      shirt(['#f6f2e9', '#d8cfbf']) +
      flat(
        poly([
          [20, 20],
          [30, 18],
          [31, 52],
          [20, 52],
        ]),
        '#8a8a5a',
        LINE,
        2,
      ) +
      flat(
        poly([
          [44, 20],
          [34, 18],
          [33, 52],
          [44, 52],
        ]),
        '#8a8a5a',
        LINE,
        2,
      ) +
      flat(rr(22, 40, 7, 5, 1), '#6b6b44', LINE, 1) +
      flat(rr(35, 40, 7, 5, 1), '#6b6b44', LINE, 1),
  },
  'outfit-flanela': {
    body:
      shirt(['#ff3d50', '#bd1c31']) +
      stroke('M24 18V52M32 16V52M40 18V52M14 28H50M18 38H46M20 46H44', '#7a1622', 2, 0.7) +
      stroke('M32 22V52', LINE, 2),
  },
  'outfit-sukienka': {
    body:
      shaded(
        `M24 12L28 12Q32 16 36 12L40 12L44 30L54 56H10L20 30Z`,
        ['#b45cff', '#8a3fd1'],
        LINE,
        -4,
        -3,
      ) +
      flat(rr(19, 28, 26, 4, 2), '#8a3fd1', LINE, 1.5) +
      stroke('M24 36L20 54M32 34V56M40 36L44 54', '#8a3fd1', 1.5),
  },
  'outfit-tshirt': { body: shirt(['#4cc7ff', '#1b86c9']) + stroke('M26 16q6 6 12 0', LINE, 2.5) },
  'outfit-kurtka': {
    body:
      shirt(['#b45cff', '#8a3fd1']) +
      stroke('M32 18V52', LINE, 2.5) +
      flat(rr(20, 48, 24, 5, 2), '#8a3fd1', LINE, 2),
  },
  'outfit-ogrodniczki': {
    body:
      shirt(['#f6f2e9', '#d8cfbf']) +
      shaded(rr(22, 30, 20, 22, 3), ['#3d7bd9', '#2d5c9c'], LINE, -2, -2) +
      stroke('M24 31L22 18M40 31L42 18', '#2d5c9c', 3) +
      flat(circ(25, 33, 2), '#ffc93c', LINE, 1.5) +
      flat(circ(39, 33, 2), '#ffc93c', LINE, 1.5),
  },
  'headwear-czapka': {
    body:
      shaded(`M14 40Q14 14 32 14Q50 14 50 40Z`, ['#ff3d50', '#bd1c31'], LINE, -4, -3) +
      shaded(rr(12, 38, 40, 10, 4), ['#bd1c31', '#bd1c31'], LINE, 0, 0) +
      flat(circ(32, 12, 5), '#f6f2e9', LINE, 2),
  },
  'headwear-daszek': {
    body:
      shaded(`M16 38Q16 16 34 16Q50 16 50 38Z`, ['#4cc7ff', '#1b86c9'], LINE, -4, -3) +
      shaded(`M16 36L4 40Q4 46 18 44Z`, ['#1b86c9', '#1b86c9'], LINE, 0, 0) +
      flat(circ(34, 15, 3), '#1b86c9', LINE, 1.5),
  },
  'headwear-sluchawki': {
    body:
      stroke('M14 40Q14 12 32 12Q50 12 50 40', LINE, 7) +
      stroke('M14 40Q14 12 32 12Q50 12 50 40', '#3a3d4a', 3) +
      shaded(rr(8, 32, 12, 20, 5), ['#ff9a1f', '#d97a0b'], LINE, -2, -2) +
      shaded(rr(44, 32, 12, 20, 5), ['#ff9a1f', '#d97a0b'], LINE, -2, -2),
  },
  deskorolka: {
    body:
      shaded(rr(6, 24, 52, 12, 6), ['#ff7aa8', '#d95a88'], LINE, -3, -2) +
      stroke('M14 30h36', '#ffffff', 3, 0.7) +
      flat(circ(16, 42, 5), '#ffc93c', LINE, 2) +
      flat(circ(48, 42, 5), '#ffc93c', LINE, 2),
  },
  'spray-zloty': {
    body:
      shaded(rr(22, 18, 20, 36, 6), ['#ffc93c', '#d98a0b'], LINE, -3, -2) +
      shaded(rr(26, 10, 12, 9, 3), ['#e6ebf2', '#b7bec9'], LINE, -1, -1, 2) +
      flat(rr(22, 30, 20, 10, 1), '#ffffff', LINE, 2) +
      `<circle cx="46" cy="12" r="3" fill="#ffc93c"/><circle cx="52" cy="8" r="2" fill="#ffc93c" opacity="0.7"/>`,
  },
  'wianek-aloha': {
    body:
      `<ellipse cx="32" cy="34" rx="22" ry="12" fill="none" stroke="#3f8f3e" stroke-width="5"/>` +
      [0, 45, 90, 135, 180, 225, 270, 315]
        .map((a, i) => {
          const r = (a * Math.PI) / 180;
          return flat(
            circ(32 + Math.cos(r) * 22, 34 + Math.sin(r) * 12, 6),
            ['#ff7aa8', '#ffd23f', '#ff3d50'][i % 3]!,
            LINE,
            1.5,
          );
        })
        .join(''),
  },
  'muszla-szczescia': {
    body:
      shaded(`M10 46Q32 6 54 46Q32 54 10 46Z`, ['#ffd9c7', '#f0b49a'], LINE, -3, -3) +
      stroke('M32 46V18M22 46L28 20M42 46L36 20M15 44L24 26M49 44L40 26', '#c98d72', 2),
  },
  monokl: {
    body:
      flat(circ(28, 30, 15), '#bfe6f7', LINE, 0) +
      `<circle cx="28" cy="30" r="15" fill="#bfe6f7" fill-opacity="0.6" stroke="#ffc93c" stroke-width="5"/>` +
      stroke('M22 24l6 -2', '#ffffff', 3) +
      stroke('M40 40Q46 50 52 56', '#ffc93c', 2.5),
  },
  cylinder: {
    body:
      shaded(rr(18, 10, 28, 34, 3), ['#2b2e38', '#1d1f26'], LINE, -3, -2) +
      shaded(rr(8, 42, 48, 9, 4), ['#2b2e38', '#1d1f26'], LINE, -2, -2) +
      flat(rr(18, 34, 28, 6, 1), '#b45cff', LINE, 2),
  },
  'rekawice-bokserskie': {
    body:
      shaded(
        `M10 30Q10 14 24 14Q34 14 34 26V40H14Q10 40 10 34Z`,
        ['#ff3d50', '#bd1c31'],
        LINE,
        -3,
        -3,
      ) +
      shaded(rr(14, 40, 18, 10, 3), ['#f6f2e9', '#d8cfbf'], LINE, -1, -1) +
      shaded(
        `M30 34Q30 18 44 18Q54 18 54 30V44H34Q30 44 30 38Z`,
        ['#ff3d50', '#bd1c31'],
        LINE,
        -3,
        -3,
      ) +
      shaded(rr(34, 44, 18, 10, 3), ['#f6f2e9', '#d8cfbf'], LINE, -1, -1),
  },
  'kurtka-karkos': {
    body:
      shirt(['#3a3d4a', '#262833']) +
      stroke('M32 18V52', LINE, 2.5) +
      flat(
        poly([
          [22, 32],
          [28, 30],
          [30, 36],
          [24, 38],
        ]),
        '#ff3d50',
        LINE,
        1.5,
      ) +
      flat(circ(39, 40, 4), '#ffc93c', LINE, 1.5) +
      flat(rr(36, 24, 7, 7, 1), '#4cc7ff', LINE, 1.5),
  },
  // ---------- coin shop gear ----------
  'buty-trampki': { body: shoe(['#f6f2e9', '#d8cfbf'], '#ff3d50') },
  'buty-glany': {
    body:
      shaded(
        `M18 14H34V38L52 42Q56 44 56 50V54H14V20Q14 14 18 14Z`,
        ['#3a3d4a', '#262833'],
        LINE,
        -3,
        -3,
      ) +
      stroke('M20 22h10M20 28h10M20 34h10', '#b7bec9', 2.5) +
      flat(rr(12, 50, 46, 6, 2), '#8f5e3b', LINE, 2),
  },
  'buty-sprintery': {
    body:
      shoe(['#4cc7ff', '#1b86c9'], '#ffc93c') +
      stroke('M4 28h10M2 36h12M6 44h8', '#ffc93c', 3) +
      stroke('M30 30l6 -6l2 6l6 -6', '#ffffff', 2.5),
  },
  // premium (looks only): the same shoe in gold
  'buty-sprintery-zlote': {
    body:
      shoe(['#ffc93c', '#d98a0b'], '#fff3c4') +
      stroke('M4 28h10M2 36h12M6 44h8', '#ffc93c', 3) +
      `<circle cx="50" cy="16" r="3" fill="#ffffff"/><circle cx="56" cy="24" r="2" fill="#ffe27a"/>`,
  },
  'spodnie-dresy': { body: pants(['#3a3d4a', '#262833'], '#a3e635') },
  'spodnie-bojowki': {
    body:
      pants(['#8a8a5a', '#6b6b44']) +
      flat(rr(15, 32, 9, 9, 2), '#6b6b44', LINE, 1.5) +
      flat(rr(40, 32, 9, 9, 2), '#6b6b44', LINE, 1.5),
  },
  'kamizelka-odblaskowa': {
    body:
      shaded(
        `M20 12L28 12L32 20L36 12L44 12L50 22V54H14V22Z`,
        ['#ff9a1f', '#d97a0b'],
        LINE,
        -3,
        -3,
      ) + stroke('M14 36H50M14 44H50', '#e6ebf2', 4),
  },
  'bluza-kewlar': {
    body:
      shirt(['#4a505c', '#363a47']) +
      stroke('M22 26l20 20M22 36l12 12M30 24l12 12M22 46l4 4', '#5d6470', 2) +
      shaded(`M32 24L42 28V38Q42 46 32 50Q22 46 22 38V28Z`, ['#ffc93c', '#d98a0b'], LINE, -2, -2),
  },
  'kask-twardziel': {
    body:
      shaded(`M10 42Q10 14 32 14Q54 14 54 42Z`, ['#a3e635', '#7cc01a'], LINE, -4, -3) +
      stroke('M24 18v20M32 15v23M40 18v20', '#5d9a12', 3) +
      flat(rr(8, 40, 48, 7, 3), '#3a3d4a', LINE, 2),
  },
  'okulary-lisie-oko': {
    body:
      shaded(`M6 26H28Q30 40 18 42Q6 42 6 30Z`, ['#ff9a1f', '#d97a0b'], LINE, -2, -2) +
      shaded(`M36 26H58V30Q58 42 46 42Q34 40 36 26Z`, ['#ff9a1f', '#d97a0b'], LINE, -2, -2) +
      stroke('M28 28Q32 24 36 28', LINE, 3) +
      stroke('M10 30l6 0M40 30l6 0', '#ffffff', 2.5, 0.8),
  },
  'rekawiczki-kleks': {
    body:
      shaded(
        `M18 54V30L14 22Q12 18 16 18L22 26V12Q22 8 26 8Q30 8 30 12V24V10Q30 6 34 6Q38 6 38 10V26V14Q38 10 42 10Q46 10 46 14V40Q46 54 34 54Z`,
        ['#f6f2e9', '#d8cfbf'],
        LINE,
        -3,
        -2,
      ) +
      flat(circ(34, 40, 5), '#b45cff', LINE, 1.5) +
      flat(circ(26, 30, 3), '#4cc7ff', LINE, 1.5) +
      flat(circ(40, 22, 2.5), '#a3e635', LINE, 1.5),
  },
  'plecak-szperacz': {
    body:
      shaded(rr(14, 14, 36, 42, 10), ['#3fb39b', '#2c8574'], LINE, -3, -3) +
      stroke('M24 14Q24 6 32 6Q40 6 40 14', LINE, 3) +
      shaded(rr(20, 34, 24, 16, 4), ['#2c8574', '#1f6b5c'], LINE, -2, -2) +
      flat(circ(40, 22, 5), '#ffc93c', LINE, 1.5) +
      stroke('M38 24l2 -4l2 4', LINE, 1.5),
  },
  'mikrofon-bit': {
    body:
      shaded(rr(26, 30, 12, 26, 4), ['#3a3d4a', '#262833'], LINE, -2, -2) +
      shaded(circ(32, 20, 13), ['#b7bec9', '#8a929e'], LINE, -3, -3) +
      stroke('M24 16h16M23 22h18M26 28h12', '#5d6470', 2) +
      flat(rr(29, 40, 6, 4, 1), '#ff3d50', LINE, 1),
  },
};

/** A trainer seen from the side; `stripe` for the sole and the laces. */
function shoe(tone: Tone, stripe: string) {
  return (
    shaded(`M8 30Q10 22 20 22L30 20Q36 30 46 32L54 34Q60 36 58 44V48H8Z`, tone, LINE, -3, -3) +
    flat(rr(6, 44, 54, 8, 3), stripe, LINE, 2) +
    stroke('M22 24l4 6M28 22l4 6', LINE, 2)
  );
}

function pants(tone: Tone, stripe?: string) {
  return (
    shaded(`M16 8H48L50 56H36L32 24L28 56H14Z`, tone, LINE, -3, -3) +
    flat(rr(16, 8, 32, 6, 2), tone[1], LINE, 2) +
    (stripe ? stroke('M18 16L16 54M46 16L48 54', stripe, 3) : '')
  );
}

const ICONS_SKILLS: Record<string, Icon> = {
  flow: {
    body:
      shaded(rr(24, 8, 16, 26, 8), ['#b7bec9', '#8a929e'], LINE, -2, -2) +
      stroke('M26 14h12M26 19h12M26 24h12', '#5d5853', 2) +
      stroke('M18 28q0 14 14 14q14 0 14 -14M32 42v10M24 54h16', LINE, 3.5),
  },
  graffiti: {
    body:
      shaded(rr(18, 20, 18, 34, 5), ['#b45cff', '#8a3fd1'], LINE, -3, -2) +
      shaded(rr(22, 12, 10, 9, 3), ['#e6ebf2', '#b7bec9'], LINE, -1, -1, 2) +
      `<circle cx="42" cy="14" r="4" fill="#a3e635"/><circle cx="50" cy="10" r="3" fill="#4cc7ff"/><circle cx="48" cy="20" r="3" fill="#ff3d50"/>`,
  },
  surfing: {
    body:
      `<path d="M4 44Q16 30 28 44T52 44T76 44V60H4Z" fill="#4cc7ff" stroke="${LINE}" stroke-width="3"/>` +
      shaded(`M14 30Q32 14 54 18Q38 30 14 30Z`, ['#ff9a1f', '#d97a0b'], LINE, -2, -2),
  },
  spryt: {
    body:
      shaded(
        `M32 8Q48 8 48 24Q48 32 40 38V44H24V38Q16 32 16 24Q16 8 32 8Z`,
        ['#ffe27a', '#ffc93c'],
        LINE,
        -3,
        -3,
      ) +
      shaded(rr(24, 44, 16, 9, 3), ['#b7bec9', '#8a929e'], LINE, -1, -1) +
      stroke('M28 30l4 -6l4 6', '#d98a0b', 2.5),
  },
  walka: {
    body:
      shaded(
        `M14 30Q14 18 26 18H42Q50 18 50 28V40Q50 52 38 52H26Q14 52 14 40Z`,
        ['#f3c9a6', '#d49e78'],
        LINE,
        -3,
        -3,
      ) +
      stroke('M24 18v14M32 18v14M40 18v14', '#d49e78', 2.5) +
      stroke('M14 34h10', LINE, 2.5),
  },
  przetrwanie: {
    body:
      shaded(`M32 8L52 16V30Q52 48 32 56Q12 48 12 30V16Z`, ['#5cc84a', '#3f9a3e'], LINE, -3, -3) +
      `<ellipse cx="32" cy="32" rx="12" ry="8" fill="#ffffff" stroke="${LINE}" stroke-width="2.5"/>` +
      flat(circ(32, 32, 4), LINE, LINE, 0),
  },
};

/** HUD buttons (Resources/Ui): the treasure map. The bud's head is the app icon (Assets/Buds/buds). */
const ICONS_UI: Record<string, Icon> = {
  mapa: {
    body:
      // parchment with rolled ends
      shaded(
        'M10 14Q20 10 32 14Q44 18 54 14V50Q44 54 32 50Q20 46 10 50Z',
        ['#f3dfa8', '#d8bd7a'],
        LINE,
        -3,
        -3,
      ) +
      shaded(rr(6, 10, 8, 44, 4), ['#e6cc8c', '#c4a35f'], LINE, -1, -1, 2.5) +
      shaded(rr(50, 10, 8, 44, 4), ['#e6cc8c', '#c4a35f'], LINE, -1, -1, 2.5) +
      // a bit of land and sea
      flat('M18 22Q24 18 30 22Q34 28 28 32Q22 34 18 30Z', '#9fd27a', '#5f9a3a', 1.5) +
      flat('M36 34Q42 30 46 34Q48 40 42 42Q36 42 36 34Z', '#9fd27a', '#5f9a3a', 1.5) +
      // the dotted way to the treasure
      stroke('M22 28Q26 38 34 36Q40 34 42 26', '#8a4a0b', 2.5, 0.9) +
      [
        [24, 33],
        [30, 37],
        [37, 35],
      ]
        .map(([x, y]) => flat(circ(x!, y!, 1.2), '#f3dfa8', '#f3dfa8', 0))
        .join('') +
      // the X
      stroke('M38 20l8 8M46 20l-8 8', '#bd1c31', 5) +
      stroke('M38 20l8 8M46 20l-8 8', '#ff3d50', 2.6) +
      // compass
      flat(circ(20, 42, 4.5), '#ffffff', LINE, 1.5) +
      flat('M20 38L21.5 42L20 46L18.5 42Z', '#ff3d50', LINE, 0.8),
  },
};

// Rywalizacja: the HUD button (a spray can that crowned its turf) and the ruler's crown.
ICONS_UI.rewiry = {
  body:
    // a tag sprayed on the wall behind
    stroke('M8 46Q14 36 20 44T32 40', '#a3e635', 5) +
    stroke('M8 46Q14 36 20 44T32 40', LINE, 1.5, 0.5) +
    // the can
    shaded(rr(26, 22, 20, 34, 4), ['#4cc7ff', '#1b86c9'], LINE, -3, -2) +
    flat(rr(26, 30, 20, 9, 1), '#f6f2e9', LINE, 2) +
    shaded(rr(30, 14, 12, 9, 2), ['#b7bec9', '#8a929e'], LINE, -1, -1, 2.5) +
    flat(rr(33, 9, 6, 6, 1.5), '#ff3d50', LINE, 2) +
    // spray mist from the nozzle
    [
      [24, 10, 1.6],
      [20, 13, 1.2],
      [18, 8, 1],
      [22, 6, 1],
    ]
      .map(([x, y, r]) => flat(circ(x!, y!, r!), '#a3e635', LINE, 0.8))
      .join('') +
    // the crown on top of it all
    shaded('M40 4L44 12L49 6L53 12L57 4L56 18H41Z', ['#ffe27a', '#ffc93c'], LINE, -2, -2, 2.5),
};
// The quest log button: a rolled-up job sheet with a big question mark (drawn, the icons have no font).
ICONS_UI.zadania = {
  body:
    shaded(rr(13, 8, 38, 46, 4), ['#f3dfa8', '#d8bd7a'], LINE, -3, -3) +
    shaded(rr(9, 4, 46, 9, 4.5), ['#e6cc8c', '#c4a35f'], LINE, -1, -1, 2.5) +
    shaded(rr(9, 50, 46, 9, 4.5), ['#e6cc8c', '#c4a35f'], LINE, -1, -1, 2.5) +
    // the question mark: a hook and a dot, ink under gold
    stroke('M24 25Q24 18 32 18Q40 18 40 25Q40 29 35 31Q32 32.5 32 36V38', LINE, 9) +
    stroke('M24 25Q24 18 32 18Q40 18 40 25Q40 29 35 31Q32 32.5 32 36V38', '#ffc93c', 5) +
    flat(circ(32, 44.5, 3.8), '#ffc93c', LINE, 2.5),
};
// The call-out button (multiplayer): a comic speech bubble with three dots, a small one answering behind it.
ICONS_UI.hasla = {
  body:
    shaded(rr(30, 6, 28, 20, 9), ['#4cc7ff', '#1b86c9'], LINE, -2, -2, 2.5) +
    shaded(
      'M14 20H42Q52 20 52 30V40Q52 50 42 50H28L18 59L20 50H14Q4 50 4 40V30Q4 20 14 20Z',
      ['#f6f2e9', '#d9d2c3'],
      LINE,
      -3,
      -3,
    ) +
    [16, 28, 40].map((x) => flat(circ(x, 35, 3.6), '#a3e635', LINE, 2)).join(''),
};
// Dzielnice graczy: the four resources of a district, the rent (coins) and the district button (a skyline).
ICONS_UI['zasob-beton'] = {
  body:
    // a stack of concrete blocks
    shaded(rr(6, 34, 26, 18, 3), ['#d9dce1', '#a9aeb8'], LINE, -2, -2) +
    shaded(rr(32, 34, 26, 18, 3), ['#d9dce1', '#a9aeb8'], LINE, -2, -2) +
    shaded(rr(18, 16, 28, 18, 3), ['#e4e7eb', '#b3b8c1'], LINE, -2, -2) +
    [
      [12, 40],
      [24, 46],
      [40, 42],
      [50, 47],
      [26, 22],
      [37, 27],
    ]
      .map(([x, y]) => flat(circ(x!, y!, 1.6), '#8a909a', 'none', 0))
      .join('') +
    stroke('M10 37h18M22 19h20', '#ffffff', 2.5, 0.6),
};
ICONS_UI['zasob-stal'] = {
  body:
    // two steel I-beams, one on the other
    shaded('M6 40H58V46H52V50H58V56H6V50H12V46H6Z', ['#9aa6b4', '#727f8e'], LINE, -2, -2) +
    shaded('M10 14H54V20H48V30H54V36H10V30H16V20H10Z', ['#b7c2ce', '#8592a1'], LINE, -2, -2) +
    stroke('M14 16h36M10 42h44', '#ffffff', 2, 0.6),
};
ICONS_UI['zasob-energia'] = {
  body:
    // a lightning bolt in a gold ring
    shaded(circ(32, 32, 26), ['#2f3440', '#1f232c'], LINE, -2, -2) +
    shaded('M36 6L16 36H30L26 58L48 26H34Z', ['#ffe27a', '#ffc93c'], LINE, -3, -3) +
    stroke('M34 12L22 32', '#ffffff', 2.5, 0.6),
};
ICONS_UI['zasob-zywnosc'] = {
  body:
    // a crate of greens and tomatoes
    shaded(rr(8, 32, 48, 24, 3), ['#c99a6b', '#a07448'], LINE, -2, -2) +
    stroke('M12 41h40M12 49h40', '#7f522b', 2, 0.6) +
    shaded(circ(20, 28, 9), ['#86d062', '#4f9e45'], '#2b5a2c', -2, -2) +
    shaded(circ(44, 27, 10), ['#86d062', '#4f9e45'], '#2b5a2c', -2, -2) +
    shaded(circ(32, 26, 9), ['#ff7a6b', '#d9564a'], '#7a2a22', -2, -2) +
    stroke('M30 18l2 -4l3 3', '#2b5a2c', 2.5) +
    stroke('M28 23a4 4 0 0 1 4 -3', '#ffffff', 2, 0.7),
};
ICONS_UI['zasob-monety'] = {
  body:
    // a stack of coins with one standing in front
    shaded(rr(8, 42, 32, 10, 5), ['#ffc93c', '#d98a0b'], LINE, -1, -1) +
    shaded(rr(10, 34, 32, 10, 5), ['#ffd25c', '#d98a0b'], LINE, -1, -1) +
    shaded(rr(8, 26, 32, 10, 5), ['#ffc93c', '#d98a0b'], LINE, -1, -1) +
    shaded(circ(44, 38, 15), ['#ffe27a', '#ffc93c'], LINE, -3, -3) +
    flat(circ(44, 38, 9), 'none', '#d98a0b', 2.5) +
    stroke('M37 31a10 10 0 0 1 8 -4', '#ffffff', 2.5, 0.7),
};
ICONS_UI.dzielnica = {
  body:
    // a little skyline: a glass tower, a block, a hall with a lime flag
    shaded(rr(24, 8, 16, 48, 3), ['#7cc6ec', '#4a97c8'], LINE, -2, -2) +
    stroke('M28 14v38M32 14v38M36 14v38', '#e9eef3', 1.6, 0.7) +
    shaded(rr(6, 26, 20, 30, 3), ['#d9dce1', '#a9aeb8'], LINE, -2, -2) +
    [30, 38, 46].map((y) => flat(rr(10, y, 12, 5, 1), '#ffe3a1', LINE, 1.2)).join('') +
    shaded(rr(38, 34, 20, 22, 3), ['#f4f6f8', '#d6dbe1'], LINE, -2, -2) +
    flat(rr(42, 42, 12, 14, 1), '#7cc6ec', LINE, 1.5) +
    stroke('M54 34V18', LINE, 2.5) +
    shaded('M55 18q6 -2 9 1q-3 3 -9 4Z', ['#a3e635', '#5d9a12'], LINE, -1, -1, 1.5) +
    stroke('M2 57H62', LINE, 3),
};
ICONS_UI.korona = {
  body:
    shaded('M8 48L6 18L20 30L32 10L44 30L58 18L56 48Z', ['#ffe27a', '#ffc93c'], LINE, -4, -4) +
    flat(rr(8, 46, 48, 8, 3), '#d98a0b', LINE, 2.5) +
    flat(circ(32, 36, 5), '#ff3d50', LINE, 2) +
    flat(circ(18, 40, 3), '#4cc7ff', LINE, 1.5) +
    flat(circ(46, 40, 3), '#a3e635', LINE, 1.5),
};

export const ICONS = {
  items: { ...GEAR_ICONS, ...RIDE_ICONS, ...ICONS_ITEMS },
  skills: ICONS_SKILLS,
  ui: ICONS_UI,
};
