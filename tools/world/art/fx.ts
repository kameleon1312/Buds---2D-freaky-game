// Duel and rivalry effects: comic street art in the Buds style (ink outlines, hard drops, flat colour, halftone,
// spray stencil). Rendered by export-art.ts to apps/unity/Assets/Buds/Resources/Ui/Fx/<name>.png at 1 px per unit.
// Lettering is the game's Rubik Black. White pieces (speed lines, halftone, splat, star) are tinted in Unity.
import { circ, n, rng } from './kit';

export type FxArt = { w: number; h: number; body: string };

const INK = '#121218';
const PAPER = '#f6f2e9';
const WHITE = '#ffffff';
const LIME = '#a3e635';
const LIME_D = '#5d9a12';
const GOLD = '#ffc93c';
const GOLD_D = '#d98a0b';
const REP = '#4cc7ff';
const REP_D = '#1b86c9';
const ALERT = '#ff3d50';
const ALERT_D = '#bd1c31';
const FONT = 'Rubik Black';

let uid = 0;
const id = (p: string) => `${p}${uid++}`;

/** Big lettering: a hard ink drop, then the word with a thick ink contour drawn under its fill. */
function word(
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  { rotate = 0, skew = 0, line = size * 0.15, drop = size * 0.07, spacing = 0, outline = INK } = {},
): string {
  const common = `font-family="${FONT}" font-size="${size}" text-anchor="middle" letter-spacing="${spacing}" stroke-linejoin="round"`;
  // the baseline sits so the capitals are centred on y
  const base = n(size * 0.36);
  return (
    `<g transform="translate(${n(x)} ${n(y)}) rotate(${rotate}) skewX(${skew})">` +
    `<text x="${n(drop)}" y="${n(base + drop)}" ${common} fill="${INK}" stroke="${INK}" stroke-width="${n(line)}">${text}</text>` +
    `<text x="0" y="${base}" ${common} fill="${color}" stroke="${outline}" stroke-width="${n(line)}" paint-order="stroke">${text}</text>` +
    `</g>`
  );
}

/** A jagged comic burst: irregular spikes on an ellipse. */
function burstPath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  spikes: number,
  seed: number,
  inner = 0.66,
) {
  const r = rng(seed);
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 + (r() - 0.5) * 0.12;
    const k = i % 2 === 0 ? 0.86 + r() * 0.14 : inner + r() * 0.08;
    pts.push(`${n(cx + Math.cos(a) * rx * k)} ${n(cy + Math.sin(a) * ry * k)}`);
  }
  return `M${pts.join('L')}Z`;
}

/** Halftone dots inside a clip, growing towards one corner (the comic print shade). */
function halftoneDots(
  w: number,
  h: number,
  color: string,
  step: number,
  max: number,
  fromX: number,
  fromY: number,
) {
  let dots = '';
  const far = Math.hypot(w, h);
  for (let y = step / 2; y < h; y += step)
    for (let x = (Math.round(y / step) % 2) * (step / 2) + step / 2; x < w; x += step) {
      const k = 1 - Math.hypot(x - fromX, y - fromY) / far;
      const rad = max * k * k;
      if (rad > 0.7) dots += circ(x, y, rad);
    }
  return `<path d="${dots}" fill="${color}"/>`;
}

/** An impact burst with its sound: two-tone burst, halftone shade, ink outline and drop, the word on top. */
function impact(
  text: string,
  w: number,
  h: number,
  [outer, outerDark]: [string, string],
  innerColor: string,
  textColor: string,
  seed: number,
  textSize: number,
  rotate = -7,
): FxArt {
  const cx = w / 2 - 6;
  const cy = h / 2 - 6;
  const shape = burstPath(cx, cy, w / 2 - 14, h / 2 - 14, 13, seed);
  const inner = burstPath(cx, cy, w / 2 - 54, h / 2 - 44, 11, seed + 7, 0.72);
  const clip = id('b');
  return {
    w,
    h,
    body:
      `<clipPath id="${clip}"><path d="${shape}"/></clipPath>` +
      `<path d="${shape}" fill="${INK}" transform="translate(10 12)"/>` +
      `<path d="${shape}" fill="${outer}"/>` +
      `<g clip-path="url(#${clip})">${halftoneDots(w, h, outerDark, 13, 5.2, w, h)}</g>` +
      `<path d="${inner}" fill="${innerColor}"/>` +
      `<path d="${shape}" fill="none" stroke="${INK}" stroke-width="7" stroke-linejoin="miter" stroke-miterlimit="8"/>` +
      word(text, cx, cy, textSize, textColor, { rotate, skew: -8 }),
  };
}

/** Radial focus lines (manga speed lines) around a clear middle; white, tinted in the game. */
function speedLines(w: number, h: number, seed: number): FxArt {
  const r = rng(seed);
  const cx = w / 2;
  const cy = h / 2;
  let d = '';
  const count = 84;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (r() - 0.5) * 0.05;
    const width = 0.006 + r() * 0.018;
    const inner = 0.5 + r() * 0.22; // where each line starts, as a share of the half-size
    const tip = [cx + Math.cos(a) * (w / 2) * inner, cy + Math.sin(a) * (h / 2) * inner];
    const far = Math.max(w, h);
    const p1 = [cx + Math.cos(a - width) * far, cy + Math.sin(a - width) * far];
    const p2 = [cx + Math.cos(a + width) * far, cy + Math.sin(a + width) * far];
    d += `M${n(tip[0]!)} ${n(tip[1]!)}L${n(p1[0]!)} ${n(p1[1]!)}L${n(p2[0]!)} ${n(p2[1]!)}Z`;
  }
  const clip = id('s');
  return {
    w,
    h,
    body: `<clipPath id="${clip}"><rect width="${w}" height="${h}"/></clipPath><path d="${d}" fill="${WHITE}" clip-path="url(#${clip})"/>`,
  };
}

/** Overspray: fine specks of paint around a stencil. */
function overspray(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  seed: number,
  count: number,
) {
  const r = rng(seed);
  let out = '';
  for (let i = 0; i < count; i++) {
    // more specks near the edges of the box, like paint missing the stencil
    const edge = r() < 0.6;
    const x = edge ? (r() < 0.5 ? x0 + r() * 30 : x1 - r() * 30) : x0 + r() * (x1 - x0);
    const y = edge ? y0 + r() * (y1 - y0) : r() < 0.5 ? y0 + r() * 22 : y1 - r() * 22;
    out += `<path d="${circ(x, y, 0.8 + r() * 2.6)}" fill="${color}" opacity="${n(0.35 + r() * 0.5)}"/>`;
  }
  return out;
}

/** Paint running down from a line: rounded drips of different lengths. */
function drips(xs: number[], y: number, color: string, seed: number, line?: string) {
  const r = rng(seed);
  return xs
    .map((x) => {
      const wdt = 8 + r() * 6;
      const len = 18 + r() * 46;
      const d = `M${n(x - wdt / 2)} ${n(y)}V${n(y + len)}a${n(wdt / 2)} ${n(wdt / 2)} 0 0 0 ${n(wdt)} 0V${n(y)}Z${circ(x, y + len + wdt * 0.1, wdt * 0.62)}`;
      return line
        ? `<path d="${d}" fill="${color}" stroke="${line}" stroke-width="4" stroke-linejoin="round"/>`
        : `<path d="${d}" fill="${color}"/>`;
    })
    .join('');
}

/** A spray stencil: flat letters with stencil bridges cut out, overspray around and drips below. */
function stencil(
  lines: string[],
  w: number,
  h: number,
  color: string,
  dark: string,
  size: number,
  seed: number,
  dripXs: number[],
): FxArt {
  const mask = id('m');
  const r = rng(seed);
  const lineH = size * 0.92;
  const top = h / 2 - ((lines.length - 1) * lineH) / 2;
  // stencil bridges: thin vertical gaps through the letters at a few places
  let bridges = '';
  for (let i = 0; i < 9; i++) {
    const x = w * (0.12 + i * 0.095) + (r() - 0.5) * 10;
    bridges += `<rect x="${n(x)}" y="0" width="${n(5 + r() * 3)}" height="${h}" fill="black"/>`;
  }
  const text = lines
    .map(
      (l, i) =>
        `<text x="${w / 2}" y="${n(top + i * lineH + size * 0.36)}" font-family="${FONT}" font-size="${size}" text-anchor="middle" letter-spacing="${n(size * 0.04)}">${l}</text>`,
    )
    .join('');
  const bottom = top + (lines.length - 1) * lineH + size * 0.36;
  return {
    w,
    h,
    body:
      `<mask id="${mask}"><rect width="${w}" height="${h}" fill="white"/>${bridges}</mask>` +
      overspray(w * 0.08, top - size * 0.55, w * 0.92, bottom + 14, color, seed + 1, 220) +
      `<g fill="${dark}" transform="translate(4 5)" mask="url(#${mask})">${text}</g>` +
      `<g fill="${color}" mask="url(#${mask})">${text}</g>` +
      drips(dripXs, bottom - 8, color, seed + 2),
  };
}

/** A comic sparkle: four sharp points. */
const star = (cx: number, cy: number, r: number) =>
  `M${n(cx)} ${n(cy - r)}Q${n(cx + r * 0.16)} ${n(cy - r * 0.16)} ${n(cx + r)} ${n(cy)}Q${n(cx + r * 0.16)} ${n(cy + r * 0.16)} ${n(cx)} ${n(cy + r)}Q${n(cx - r * 0.16)} ${n(cy + r * 0.16)} ${n(cx - r)} ${n(cy)}Q${n(cx - r * 0.16)} ${n(cy - r * 0.16)} ${n(cx)} ${n(cy - r)}Z`;

/** A crown doodle (rulers, winners). */
const crown = (x: number, y: number, s: number, fill: string) => {
  const d = `M${n(x)} ${n(y + s * 0.8)}L${n(x - s * 0.1)} ${n(y + s * 0.15)}L${n(x + s * 0.28)} ${n(y + s * 0.45)}L${n(x + s * 0.5)} ${n(y)}L${n(x + s * 0.72)} ${n(y + s * 0.45)}L${n(x + s * 1.1)} ${n(y + s * 0.15)}L${n(x + s)} ${n(y + s * 0.8)}Z`;
  return (
    `<path d="${d}" fill="${INK}" transform="translate(5 6)"/>` +
    `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>` +
    `<path d="${circ(x + s * 0.5, y + s * 0.58, s * 0.08)}" fill="${ALERT}" stroke="${INK}" stroke-width="3"/>`
  );
};

/** A paint splat (white, tinted in the game). */
function splat(w: number, seed: number): FxArt {
  const r = rng(seed);
  const c = w / 2;
  const pts: string[] = [];
  const count = 22;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const k = 0.42 + r() * 0.22 + (i % 3 === 0 ? r() * 0.18 : 0);
    pts.push(`${n(c + Math.cos(a) * c * k)} ${n(c + Math.sin(a) * c * k)}`);
  }
  let drops = '';
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2;
    const dist = c * (0.68 + r() * 0.26);
    drops += circ(c + Math.cos(a) * dist, c + Math.sin(a) * dist, 3 + r() * 7);
  }
  return {
    w,
    h: w,
    body: `<path d="M${pts.join('L')}Z" fill="${WHITE}" stroke="${WHITE}" stroke-width="10" stroke-linejoin="round"/><path d="${drops}" fill="${WHITE}"/>`,
  };
}

/** The graffiti tag of a win: extruded letters, ink contour, drips, a crown and sparkles. */
function tag(text: string, w: number, h: number, color: string, size: number): FxArt {
  const x = w / 2;
  const y = h / 2 + 10;
  const common = `font-family="${FONT}" font-size="${size}" text-anchor="middle" letter-spacing="${n(size * 0.02)}" stroke-linejoin="round"`;
  const base = n(size * 0.36);
  let block = '';
  // the 3D block behind the letters
  for (let i = 12; i >= 1; i--)
    block += `<text x="${i}" y="${n(base + i)}" ${common} fill="${INK}" stroke="${INK}" stroke-width="${n(size * 0.16)}">${text}</text>`;
  const sparkles = [
    [w * 0.1, h * 0.28, 16],
    [w * 0.9, h * 0.22, 20],
    [w * 0.84, h * 0.82, 12],
  ]
    .map(
      ([sx, sy, sr]) =>
        `<path d="${star(sx!, sy!, sr!)}" fill="${WHITE}" stroke="${INK}" stroke-width="3"/>`,
    )
    .join('');
  return {
    w,
    h,
    body:
      `<g transform="translate(${n(x)} ${n(y)}) rotate(-6) skewX(-10)">` +
      // a paper halo around letters and block: the tag reads on any wall, dark or light
      `<text x="6" y="${n(base + 6)}" ${common} fill="${PAPER}" stroke="${PAPER}" stroke-width="${n(size * 0.42)}">${text}</text>` +
      block +
      // paint runs out from under the letters
      drips([-size * 1.55, -size * 0.6, size * 0.45, size * 1.4], size * 0.3, color, 41, INK) +
      `<text x="0" y="${base}" ${common} fill="${color}" stroke="${INK}" stroke-width="${n(size * 0.16)}" paint-order="stroke">${text}</text>` +
      `</g>` +
      crown(w * 0.12, h * 0.02, 64, GOLD) +
      sparkles,
  };
}

/** The "VS" sticker: a slanted torn badge. */
function vs(): FxArt {
  const w = 360;
  const h = 260;
  const badge = `M40 70L300 22L326 168L64 222Z`;
  const torn = `M64 222L58 206L72 196L60 184L70 170`;
  return {
    w,
    h,
    body:
      `<path d="${badge}" fill="${INK}" transform="translate(12 14)"/>` +
      `<path d="${badge}" fill="${GOLD}" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>` +
      `<clipPath id="vsc"><path d="${badge}"/></clipPath>` +
      `<g clip-path="url(#vsc)">${halftoneDots(w, h, GOLD_D, 12, 4.6, w, h)}</g>` +
      `<path d="${torn}" fill="none" stroke="${INK}" stroke-width="4"/>` +
      word('VS', 184, 122, 150, WHITE, { rotate: -10, skew: -12, line: 20, drop: 10 }) +
      `<path d="${star(318, 40, 22)}" fill="${WHITE}" stroke="${INK}" stroke-width="4"/>` +
      `<path d="${star(34, 200, 15)}" fill="${LIME}" stroke="${INK}" stroke-width="4"/>`,
  };
}

/** "WALCZ!" on a strip of lime tape with torn ends. */
function tape(text: string, w: number, h: number, color: string, dark: string): FxArt {
  const r = rng(77);
  // straight top and bottom, torn (zigzag) ends
  const steps = 8;
  const y0 = 20;
  const y1 = h - 26;
  const end = (x: number, dir: number) =>
    Array.from(
      { length: steps + 1 },
      (_, i) => `${n(x + dir * r() * 12)} ${n(y0 + ((y1 - y0) * i) / steps)}`,
    );
  const right = end(w - 18, -1);
  const left = end(18, 1).reverse();
  const d = `M${right.join('L')}L${left.join('L')}Z`;
  return {
    w,
    h,
    body:
      `<g transform="rotate(-3 ${w / 2} ${h / 2})">` +
      `<path d="${d}" fill="${INK}" transform="translate(9 10)"/>` +
      `<path d="${d}" fill="${color}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>` +
      `<path d="M30 ${h - 34}H${w - 30}" stroke="${dark}" stroke-width="6" opacity="0.6"/>` +
      `<text x="${w / 2}" y="${n(h / 2 + 30)}" font-family="${FONT}" font-size="84" text-anchor="middle" fill="${INK}" letter-spacing="4">${text}</text>` +
      `</g>`,
  };
}

uid = 0;
export const FX: Record<string, FxArt> = {
  // impact sounds by kind of blow (FightScreen picks one per hit)
  'fx-pac': impact('PAC!', 330, 240, [PAPER, '#d8cfbf'], WHITE, REP, 11, 70),
  'fx-lup': impact('ŁUP!', 340, 250, [GOLD, GOLD_D], '#ffe27a', ALERT, 23, 74, 6),
  'fx-bam': impact('BAM!', 360, 250, [REP, REP_D], '#a9e6ff', WHITE, 37, 76),
  'fx-trzask': impact('TRZASK!', 560, 340, [ALERT, ALERT_D], GOLD, WHITE, 53, 80, -5),
  'fx-bum': impact('BUM!', 420, 300, [LIME, LIME_D], '#d4f59a', WHITE, 71, 96, 4),
  // overlays
  'fx-speed': speedLines(1200, 480, 5),
  'fx-halftone': { w: 600, h: 300, body: halftoneDots(600, 300, WHITE, 14, 6.4, 0, 300) },
  'fx-splat': splat(220, 9),
  'fx-star': { w: 64, h: 64, body: `<path d="${star(32, 32, 30)}" fill="${WHITE}"/>` },
  // the intro and the end of a duel
  'fx-vs': vs(),
  'fx-walcz': tape('WALCZ!', 440, 150, LIME, LIME_D),
  'fx-ko': stencil(['K.O.'], 560, 300, ALERT, ALERT_D, 220, 91, [122, 178, 300, 362]),
  'fx-wygrana': tag('WYGRANA!', 720, 260, LIME, 128),
  // rivalry: a turf taken
  'fx-rewir': stencil(['TWÓJ', 'REWIR'], 560, 330, LIME, LIME_D, 128, 131, [170, 262, 330, 404]),
};
