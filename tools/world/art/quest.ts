// Quest visuals: markers above NPCs (gold "!" = quest to take, "?" = ready to hand in, grey "…" = in progress),
// the ground ring for "reach" targets, and the items players pick up.
import { T, circ, flat, n, rr, shaded, shadow, stroke, type Prop, type Tone } from './kit';

const LINE = '#121218';

/** Round badge with a symbol, floating above an NPC's head (anchor = bottom tip). */
function marker(fillTone: Tone, symbol: string): Prop {
  const w = 0.8 * T;
  const h = 1 * T;
  const ax = w / 2;
  const ay = h - 4;
  const cy = 24;
  return {
    w,
    h,
    ax,
    ay,
    body:
      `<path d="M${ax - 9} ${cy + 16}L${ax} ${ay}L${ax + 9} ${cy + 16}Z" fill="${fillTone[1]}" stroke="${LINE}" stroke-width="3" stroke-linejoin="round"/>` +
      shaded(circ(ax, cy, 20), fillTone, LINE, -3, -3, 3.5) +
      symbol,
  };
}

const bang = (cx: number, cy: number) =>
  flat(rr(cx - 4, cy - 13, 8, 17, 4), '#ffffff', LINE, 2.5) +
  flat(circ(cx, cy + 9, 4), '#ffffff', LINE, 2.5);
const question = (cx: number, cy: number) =>
  stroke(`M${cx - 7} ${cy - 6}q0 -9 7 -9q8 0 8 7q0 5 -6 7q-2 1 -2 5`, LINE, 9) +
  stroke(`M${cx - 7} ${cy - 6}q0 -9 7 -9q8 0 8 7q0 5 -6 7q-2 1 -2 5`, '#ffffff', 5) +
  flat(circ(cx, cy + 11, 3.5), '#ffffff', LINE, 2.5);
/** A small clenched fist for the duel marker. */
const fist = (cx: number, cy: number) =>
  flat(rr(cx - 10, cy - 8, 20, 16, 5), '#ffffff', LINE, 2.5) +
  stroke(`M${cx - 4} ${cy - 8}v8M${cx + 3} ${cy - 8}v8`, LINE, 2) +
  flat(rr(cx - 13, cy - 3, 6, 9, 3), '#ffffff', LINE, 2);
const dots = (cx: number, cy: number) =>
  [-8, 0, 8].map((dx) => flat(circ(cx + dx, cy, 3.5), '#ffffff', LINE, 2)).join('');

/** Pulsing ring on the ground where a "reach" step points. */
const targetRing = (): Prop => ({
  w: 1.6 * T,
  h: 0.9 * T,
  ax: 0.8 * T,
  ay: 0.45 * T + 6,
  flat: true,
  body:
    `<ellipse cx="${0.8 * T}" cy="${0.45 * T}" rx="${0.7 * T}" ry="${0.32 * T}" fill="#ffc93c" fill-opacity="0.3" stroke="#ffc93c" stroke-width="5"/>` +
    `<ellipse cx="${0.8 * T}" cy="${0.45 * T}" rx="${0.42 * T}" ry="${0.19 * T}" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.8"/>`,
});

/** A pickup lying on the ground with a soft glow, so it reads as "take me". */
function pickup(body: string): Prop {
  const w = 0.9 * T;
  const h = 0.9 * T;
  return {
    w,
    h,
    ax: w / 2,
    ay: h - 8,
    body:
      `<ellipse cx="${n(w / 2)}" cy="${n(h - 14)}" rx="26" ry="10" fill="#ffe27a" opacity="0.45"/>` +
      shadow(w / 2, h - 10, 16, 4, 0.25) +
      body,
  };
}

const bag = pickup(
  shaded(`M18 26H40L42 48H16Z`, ['#f6f2e9', '#d8cfbf'], LINE, -3, -2) +
    stroke('M23 26q6 -12 12 0', LINE, 3) +
    flat(`M22 30h14v6h-14Z`, '#3fb39b', LINE, 1.5) +
    flat(circ(25, 22, 5), '#ff7a3c', LINE, 1.5) +
    flat(circ(33, 21, 4), '#a3e635', LINE, 1.5),
);

const tomato = pickup(
  shaded(circ(29, 36, 13), ['#ff4a3a', '#c8322a'], LINE, -3, -3) +
    flat(`M22 25l7 4l7 -4l-3 6h-8Z`, '#4fae55', LINE, 1.5) +
    `<ellipse cx="24" cy="31" rx="4" ry="2.5" fill="#ffffff" opacity="0.6"/>`,
);

const sprayCan = pickup(
  shaded(rr(21, 22, 16, 28, 5), ['#b45cff', '#8a3fd1'], LINE, -3, -2) +
    shaded(rr(24, 15, 10, 8, 3), ['#e6ebf2', '#b7bec9'], LINE, -1, -1, 2) +
    flat(rr(21, 31, 16, 8, 1), '#ffffff', LINE, 1.5) +
    `<circle cx="38" cy="16" r="2.5" fill="#b45cff"/><circle cx="43" cy="13" r="1.8" fill="#b45cff" opacity="0.7"/>`,
);

const coconut = pickup(
  shaded(circ(29, 36, 13), ['#8a5a32', '#6b4229'], LINE, -3, -3) +
    flat(circ(24, 33, 2), '#3a2a20', LINE, 0) +
    flat(circ(30, 31, 2), '#3a2a20', LINE, 0) +
    flat(circ(27, 38, 2), '#3a2a20', LINE, 0),
);

const netFloat = pickup(
  shaded(`M16 40Q29 18 42 40Z`, ['#ff9a1f', '#d97a0b'], LINE, -2, -2) +
    stroke('M14 44h30M18 48h22', '#c9b28e', 2.5) +
    stroke('M29 22v-6', LINE, 3),
);

const maskShard = pickup(
  shaded(`M18 44L22 24L38 20L42 40L30 48Z`, ['#ffc93c', '#d98a0b'], LINE, -3, -3) +
    stroke('M25 30h5M33 29h4M27 39q4 3 8 0', LINE, 2.5),
);

const feather = pickup(
  shaded(`M18 48Q16 30 36 16Q40 32 22 46Z`, ['#ff8fb4', '#e06a92'], LINE, -2, -2) +
    stroke('M18 48L34 20', '#b84a74', 2),
);

const pearl = pickup(
  shaded(`M14 42Q29 22 44 42Q29 50 14 42Z`, ['#d9c7e8', '#b8a3cc'], LINE, -2, -2) +
    shaded(circ(29, 38, 7), ['#ffffff', '#e6e1ea'], LINE, -2, -2, 2),
);

const key = pickup(
  shaded(circ(22, 34, 8), ['#ffc93c', '#d98a0b'], LINE, -2, -2) +
    flat(circ(22, 34, 3), '#86c95a', LINE, 1.5) +
    shaded(rr(28, 31, 18, 6, 2), ['#ffc93c', '#d98a0b'], LINE, -1, -1, 2.5) +
    flat(rr(38, 36, 4, 6, 1), '#ffc93c', LINE, 2),
);

const teacup = pickup(
  shaded(`M16 28H40V36Q40 46 28 46Q16 46 16 36Z`, ['#ffffff', '#dfe3ea'], LINE, -2, -2) +
    stroke('M40 31q8 0 6 6q-2 4 -7 3', LINE, 3) +
    stroke('M18 32h20', '#4c8fd6', 2.5) +
    `<ellipse cx="28" cy="48" rx="15" ry="3.5" fill="#ffffff" stroke="${LINE}" stroke-width="2.5"/>`,
);

const letter = pickup(
  shaded(rr(14, 26, 30, 20, 3), ['#f6f2e9', '#d8cfbf'], LINE, -2, -2) +
    stroke('M14 27l15 11l15 -11', LINE, 2.5) +
    flat(circ(29, 38, 4), '#e83a4a', LINE, 1.5),
);

const coin = pickup(
  shaded(circ(29, 36, 12), ['#ffc93c', '#d98a0b'], LINE, -3, -3) +
    flat(circ(29, 36, 7), 'none', '#b38a3e', 2.5) +
    stroke('M26 31l3 -2v13', '#b38a3e', 2.5),
);

const documentProp = pickup(
  shaded(rr(17, 18, 24, 30, 3), ['#f6f2e9', '#d8cfbf'], LINE, -2, -2) +
    stroke('M21 26h16M21 31h16M21 36h10', '#a9afbd', 2.5) +
    flat(circ(35, 42, 4), '#e83a4a', LINE, 1.5),
);

const part = pickup(
  shaded(circ(29, 36, 12), ['#b7bec9', '#8a929e'], LINE, -3, -3) +
    flat(circ(29, 36, 5), '#5d5853', LINE, 2) +
    stroke(
      'M29 21v-4M29 51v4M14 36h-4M44 36h4M18 25l-3 -3M40 47l3 3M40 25l3 -3M18 47l-3 3',
      LINE,
      3,
    ),
);

const medkit = pickup(
  shaded(rr(14, 24, 30, 24, 5), ['#ffffff', '#dfe3ea'], LINE, -2, -2) +
    flat(rr(25, 28, 8, 16, 1), '#ff3d50', '#ff3d50', 0) +
    flat(rr(21, 32, 16, 8, 1), '#ff3d50', '#ff3d50', 0) +
    stroke('M24 24v-4h10v4', LINE, 2.5),
);

const crate = pickup(
  shaded(rr(14, 24, 30, 24, 3), ['#c48a52', '#9a6537'], LINE, -2, -2) +
    stroke('M14 32h30M14 40h30M18 24v24M40 24v24', '#9a6537', 2.5),
);

const patch = pickup(
  shaded(`M29 20L44 28V40L29 48L14 40V28Z`, ['#ff3d50', '#bd1c31'], LINE, -2, -2) +
    stroke('M22 31l7 6l7 -6M29 37v6', '#ffffff', 3),
);

export const QUEST_PROPS: Record<string, Prop> = {
  'marker-quest': marker(['#ffc93c', '#d98a0b'], bang(0.4 * T, 24)),
  'marker-turnin': marker(['#a3e635', '#5d9a12'], question(0.4 * T, 24)),
  'marker-progress': marker(['#a6b0c3', '#7d8798'], dots(0.4 * T, 24)),
  // opponents: a red badge with a fist
  'marker-fight': marker(['#ff3d50', '#bd1c31'], fist(0.4 * T, 24)),
  'target-ring': targetRing(),
  'item-zakupy': bag,
  'item-pomidor': tomato,
  'item-puszka': sprayCan,
  'item-kokos': coconut,
  'item-siec': netFloat,
  'item-odlamek': maskShard,
  'item-pioro': feather,
  'item-perla': pearl,
  'item-klucz': key,
  'item-filizanka': teacup,
  'item-list': letter,
  'item-moneta': coin,
  'item-dokument': documentProp,
  'item-czesc': part,
  'item-apteczka': medkit,
  'item-skrzynka': crate,
  'item-naszywka': patch,
};
