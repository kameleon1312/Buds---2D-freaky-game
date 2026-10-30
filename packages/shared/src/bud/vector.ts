import {
  EYE_COLORS,
  HAIR_COLORS,
  OUTFIT_COLORS,
  PANTS_COLORS,
  SHOES_COLORS,
  SKINS,
  type HairStyle,
  type Outfit,
} from './constants';
import type { BudLook } from './look';

/**
 * Buds character art, following the "Postacie" sheet of the Buds design system:
 * 1 : 2.5 proportions (head ≈ 40% of height), 3 px outline in `outline`, cel shading
 * (base + one shade + one highlight, light from the top-left), realistic streetwear.
 *
 * Shapes are authored in the design system's 120 × 162 space (feet on y = 150) and placed into a
 * VIEW_W × VIEW_H frame (2:3, feet at y = 220) that the game slices into 16 × 24-unit cells.
 */
export const VIEW_W = 160;
export const VIEW_H = 240;
const PLACE = 'translate(5 32.5) scale(1.25)';
/** The torso and head sit this much lower than in the design sheet: shorter, chunkier legs. */
const BODY_DROP = 9;
/**
 * The body (legs, torso, arms) is drawn this much wider than the design sheet around the centre line; the head keeps
 * its shape. Sturdier figures that read well at game size, like the chunky heroes of mobile RPGs.
 */
const BULK = 1.2;
const BULK_SIDE = 1.2;
const widen = (k: number) => `translate(60 0) scale(${k} 1) translate(-60 0)`;
const HIP_Y = 106 + BODY_DROP;

export const FACINGS = ['down', 'side', 'up'] as const;
/** `side` faces left; mirror it for right. */
export type Facing = (typeof FACINGS)[number];
/** 0 = standing, 1 and 2 = alternating steps. Walk cycle: 1, 0, 2, 0. */
export type WalkFrame = 0 | 1 | 2;

const OUT = '#121218';
type Pair = [base: string, shade: string];

// skin shades matched to SKINS (hand-picked like the design sheet, not a flat darken)
const SKIN_SHADES = [
  '#dcae8e',
  '#d49e78',
  '#a46a42',
  '#7f5034',
  '#663c22',
  '#4f2c18',
  '#e6bfa5',
  '#3a1f12',
] as const;

function mix(a: string, b: string, t: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const v = [0, 1, 2].map((i) => Math.round(ch(a, i) * (1 - t) + ch(b, i) * t));
  return `#${v.map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

/** Shade towards a cool dark rather than black, so shadows stay colourful (cel look). */
const shade = (c: string, t = 0.26): string => mix(c, '#1b1430', t);

export type BudPalette = {
  skin: Pair;
  hair: Pair;
  top: Pair;
  pants: Pair;
  shoes: Pair;
  sole: string;
  soleTone: Pair;
  cap: Pair;
  lips: string;
};

export function budPalette(look: BudLook): BudPalette {
  const skin = SKINS[look.skin] ?? SKINS[0];
  const hair = HAIR_COLORS[look.hairColor] ?? HAIR_COLORS[0];
  const top = OUTFIT_COLORS[look.outfitColor] ?? OUTFIT_COLORS[0];
  const pants = PANTS_COLORS[look.pantsColor] ?? PANTS_COLORS[0];
  // trims, prints, hats: chosen, or one that goes with the top
  const cap =
    OUTFIT_COLORS[look.accent ?? -1] ??
    OUTFIT_COLORS[(look.outfitColor + 3) % OUTFIT_COLORS.length] ??
    OUTFIT_COLORS[3];
  const shoes = SHOES_COLORS[look.shoesColor ?? 0] ?? SHOES_COLORS[0];
  const lightShoes = shoes === '#f6f2e9' || shoes === '#c9b593';
  return {
    skin: [skin, SKIN_SHADES[look.skin] ?? shade(skin)],
    hair: [hair, shade(hair, 0.4)],
    top: [top, shade(top)],
    pants: [pants, shade(pants)],
    shoes: [shoes, shade(shoes, lightShoes ? 0.16 : 0.26)],
    // the accent stripe picks up the top's colour (or lime when the top is white)
    sole: top === '#f6f2e9' || top === shoes ? '#a3e635' : top,
    soleTone: lightShoes ? ['#e4dccb', '#b9ae99'] : ['#f6f2e9', '#cfc6b4'],
    cap: [cap, shade(cap)],
    lips: '#b23a55',
  };
}

// ---------- drawing primitives (design system technique) ----------

const circ = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

const rr = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;

/** Thin line between overlapping parts; the silhouette gets a heavy contour (variable line weight). */
const INNER_STROKE = 2;
const SILHOUETTE_STROKE = 7;

/**
 * Collects SVG fragments; clip-path ids are placeholders until the frame is finished.
 * Every shape is also recorded in a silhouette layer that is drawn first with a thick outline, so the
 * figure reads as one bold sticker shape while the parts inside are separated by thin lines.
 */
class Pen {
  private parts: string[] = [];
  private sil: string[] = [];
  private n = 0;

  /** Shade fill, base fill nudged towards the light (top-left) and clipped to the shape, inner line. */
  shaded(d: string, [base, dark]: Pair, dx = -4, dy = -4, contour = true): this {
    const id = `@@${this.n++}`;
    if (contour) this.sil.push(`<path d="${d}"/>`);
    this.parts.push(
      `<clipPath id="${id}"><path d="${d}"/></clipPath>` +
        `<path d="${d}" fill="${dark}"/>` +
        `<g clip-path="url(#${id})"><path d="${d}" fill="${base}" transform="translate(${dx} ${dy})"/></g>` +
        `<path d="${d}" fill="none" stroke="${OUT}" stroke-width="${INNER_STROKE}" stroke-linejoin="round"/>`,
    );
    return this;
  }

  /** Flat detail (pocket, cuff, band) inside a shape: no shading, no silhouette. */
  flat(d: string, color: string): this {
    this.parts.push(
      `<path d="${d}" fill="${color}" stroke="${OUT}" stroke-width="${INNER_STROKE}" stroke-linejoin="round"/>`,
    );
    return this;
  }

  line(d: string, width = 2, color = OUT, contour = false): this {
    if (contour)
      this.sil.push(
        `<path d="${d}" fill="none" stroke-width="${width + SILHOUETTE_STROKE - 2}" stroke-linecap="round"/>`,
      );
    this.parts.push(
      `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
    return this;
  }

  raw(markup: string): this {
    this.parts.push(markup);
    return this;
  }

  /** Details that must stay inside a shape (a check, a print): no silhouette. */
  clipped(d: string, draw: (pen: Pen) => void): this {
    const id = `@@${this.n++}`;
    const inner = new Pen();
    inner.n = this.n;
    draw(inner);
    this.n = inner.n;
    this.parts.push(
      `<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})">${inner.parts.join('')}</g>`,
    );
    return this;
  }

  group(transform: string, draw: (pen: Pen) => void): this {
    const inner = new Pen();
    inner.n = this.n;
    draw(inner);
    this.n = inner.n;
    this.parts.push(`<g transform="${transform}">${inner.parts.join('')}</g>`);
    if (inner.sil.length) this.sil.push(`<g transform="${transform}">${inner.sil.join('')}</g>`);
    return this;
  }

  toString(): string {
    const sil = this.sil.length
      ? `<g fill="${OUT}" stroke="${OUT}" stroke-width="${SILHOUETTE_STROKE}" stroke-linejoin="round">${this.sil.join('')}</g>`
      : '';
    return sil + this.parts.join('');
  }
}

const r2 = (n: number) => +n.toFixed(2);

/** Tapered capsule from (x1, y1) with radius ra to (x2, y2) with radius rb — limbs. */
function limb(x1: number, y1: number, ra: number, x2: number, y2: number, rb: number): string {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const nx = -(y2 - y1) / len;
  const ny = (x2 - x1) / len;
  return (
    `M${r2(x1 + nx * ra)} ${r2(y1 + ny * ra)}L${r2(x2 + nx * rb)} ${r2(y2 + ny * rb)}` +
    `A${rb} ${rb} 0 0 0 ${r2(x2 - nx * rb)} ${r2(y2 - ny * rb)}` +
    `L${r2(x1 - nx * ra)} ${r2(y1 - ny * ra)}A${ra} ${ra} 0 0 0 ${r2(x1 + nx * ra)} ${r2(y1 + ny * ra)}Z`
  );
}

/** FNV-1a — gives every distinct drawing its own clip-path ids, identical drawings identical ids. */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

// ---------- shapes ----------

// sloped shoulders, a slight taper to the waist and a hem that flares a touch (soft, not a box)
const TORSO_M =
  'M36 84 Q35 68 52 66 H68 Q85 68 84 84 Q82.5 95 84 106 Q84 114 76 114 H44 Q36 114 36 106 Q37.5 95 36 84Z';
const TORSO_F =
  'M39 84 Q39 69 53 67 H67 Q81 69 81 84 Q77 96 82 106 Q82 114 75 114 H45 Q38 114 38 106 Q43 96 39 84Z';
const TORSO_SIDE =
  'M46 84 Q46 69 57 67 H63 Q74 69 74 84 L75 106 Q75 114 67 114 H53 Q45 114 45 106Z';

const HAIR_FRONT: Partial<Record<HairStyle, string>> = {
  krotkie: 'M34 40 Q33 13 60 13 Q87 13 86 40 Q81 29 72 27 Q64 33 52 29 Q41 31 34 40Z',
  jezyk:
    'M34 40 L32 22 L40 25 L41 11 L50 19 L55 6 L62 17 L69 7 L73 19 L81 13 L81 25 L88 23 L86 40 Q81 29 72 27 Q64 33 52 29 Q41 31 34 40Z',
  grzywka: 'M33 42 Q31 12 60 12 Q89 12 87 42 Q86 35 81 34 L39 34 Q34 35 33 42Z',
  dlugie: 'M34 40 Q33 13 60 13 Q87 13 86 40 Q80 26 66 24 Q58 32 44 28 Q38 32 34 40Z',
  kucyk: 'M34 40 Q33 13 60 13 Q87 13 86 40 Q80 26 66 24 Q58 32 44 28 Q38 32 34 40Z',
  kok: 'M34 40 Q33 13 60 13 Q87 13 86 40 Q81 29 72 27 Q64 33 52 29 Q41 31 34 40Z',
  warkocze: 'M34 40 Q33 13 60 13 Q87 13 86 40 Q82 26 63 22 L60 28 L57 22 Q38 26 34 40Z',
  bob: 'M33 42 Q31 12 60 12 Q89 12 87 42 Q84 30 70 27 Q60 33 46 29 Q37 32 33 42Z',
  afro: 'M34 39 Q34 21 60 21 Q86 21 86 39 Q80 31 60 31 Q40 31 34 39Z',
  daszek: 'M34 40 Q33 13 60 13 Q87 13 86 40 Q81 29 72 27 Q64 33 52 29 Q41 31 34 40Z',
  sluchawki: 'M33 40 Q30 12 60 10 Q90 12 87 40 Q84 22 60 20 Q36 22 33 40Z',
  // the crest only; the shaved sides are the scalp
  irokez: 'M52 30 Q49 6 60 1 Q71 6 68 30 Q64 24 60 25 Q56 24 52 30Z',
  buzz: 'M35 37 Q34 15 60 15 Q86 15 85 37 Q80 25 60 24 Q40 25 35 37Z',
  loki: 'M33 42 Q29 12 60 11 Q91 12 87 42 Q84 34 79 36 Q76 28 70 32 Q66 25 60 30 Q54 25 50 32 Q44 28 41 36 Q36 34 33 42Z',
  kitki: 'M34 40 Q33 13 60 13 Q87 13 86 40 Q80 26 66 24 Q58 32 44 28 Q38 32 34 40Z',
  dredy:
    'M34 40 Q33 13 60 13 Q87 13 86 40 Q83 32 79 33 L76 28 L71 34 L66 27 L60 34 L54 27 L49 34 L44 28 L41 33 Q37 32 34 40Z',
  koczki: 'M34 40 Q33 13 60 13 Q87 13 86 40 Q82 26 63 22 L60 28 L57 22 Q38 26 34 40Z',
};

/** Strands drawn over the front hair so it reads as hair, not a helmet. */
const STRANDS: Partial<Record<HairStyle, string>> = {
  krotkie: 'M44 22 Q50 18 57 20 M63 18 Q71 18 77 24',
  dlugie: 'M42 24 Q50 19 58 21 M64 19 Q74 20 80 28',
  kucyk: 'M42 24 Q50 19 58 21 M64 19 Q74 20 80 28',
  kok: 'M44 22 Q50 18 57 20 M63 18 Q71 18 77 24',
  bob: 'M40 26 Q48 18 58 20 M64 19 Q76 19 82 30',
  grzywka: 'M42 30 V20 M52 33 V17 M62 33 V16 M72 32 V18',
  loki: 'M44 24 q3 -4 6 0 M56 20 q3 -4 6 0 M68 22 q3 -4 6 0',
  warkocze: 'M48 20 Q54 18 59 22 M61 22 Q66 18 72 20',
  kitki: 'M42 24 Q50 19 58 21 M64 19 Q74 20 80 28',
  dredy: 'M46 20 V27 M54 17 V26 M62 16 V26 M70 18 V27 M78 22 V29',
  koczki: 'M48 20 Q54 18 59 22 M61 22 Q66 18 72 20',
};

function backHair(pen: Pen, style: HairStyle, hair: Pair, facing: Facing) {
  if (facing === 'side') {
    switch (style) {
      case 'dlugie':
        return pen.shaded('M60 26 Q90 16 90 50 L92 82 Q84 88 75 82 L72 54Z', hair, -3, -2);
      case 'kucyk':
        return pen.shaded('M78 22 Q103 24 99 54 Q96 72 86 66 Q92 48 77 32Z', hair, -2, -2);
      case 'kok':
        return pen.shaded(circ(78, 15, 10), hair, -2, -2);
      case 'warkocze':
        return pen
          .shaded(rr(73, 48, 10, 36, 5), hair, -2, -1)
          .line('M74 60 H82 M74 70 H82', 1.2, 'rgba(0,0,0,0.35)');
      case 'bob':
        return pen.shaded('M46 20 Q88 10 88 42 L88 62 Q82 66 76 62 L74 42Z', hair, -3, -2);
      case 'afro':
        return pen.shaded(circ(62, 30, 33), hair, -4, -4);
      case 'loki':
        return pen.shaded(
          'M60 26 Q92 14 92 46 Q98 56 90 64 Q94 76 82 80 Q74 84 72 72 L70 50Z',
          hair,
          -3,
          -2,
        );
      case 'kitki':
        return pen.shaded(circ(76, 12, 9), hair, -2, -2);
      case 'koczki':
        return pen.shaded(circ(70, 8, 10.5), hair, -2, -2);
      case 'dredy':
        for (const [x, y] of [
          [66, 78],
          [73, 80],
          [80, 78],
          [87, 72],
        ] as const)
          pen.shaded(limb(x - 2, 30, 4, x, y, 3.2), hair, -1, -1);
        return pen;
      default:
        return pen;
    }
  }
  switch (style) {
    case 'dlugie':
      return pen.shaded(
        'M32 40 Q30 12 60 12 Q90 12 88 40 L91 80 Q78 86 73 72 H47 Q42 86 29 80Z',
        hair,
        -3,
        -2,
      );
    case 'kucyk':
      return facing === 'up'
        ? pen
        : pen.shaded('M80 24 Q102 26 98 56 Q95 74 85 68 Q91 50 76 32Z', hair, -2, -2);
    case 'warkocze':
      return pen
        .shaded(rr(27, 46, 10, 36, 5), hair, -2, -1)
        .shaded(rr(83, 46, 10, 36, 5), hair, -2, -1)
        .line('M28 58 H36 M28 68 H36 M84 58 H92 M84 68 H92', 1.2, 'rgba(0,0,0,0.35)');
    case 'kok':
      return pen.shaded(circ(60, 9, 10), hair, -2, -2);
    case 'bob':
      return pen.shaded(
        'M30 40 Q28 12 60 12 Q92 12 90 40 L90 62 Q85 67 80 62 L80 46 H40 L40 62 Q35 67 30 62Z',
        hair,
        -3,
        -2,
      );
    case 'afro':
      return pen.shaded(circ(60, 30, 34), hair, -4, -4);
    case 'loki':
      // a curly mane down to the shoulders
      return pen.shaded(
        'M31 42 Q27 10 60 10 Q93 10 89 42 Q97 52 90 62 Q95 74 84 80 Q76 84 74 72 H46 Q44 84 36 80 Q25 74 30 62 Q23 52 31 42Z',
        hair,
        -3,
        -2,
      );
    case 'kitki':
      return pen.shaded(circ(36, 14, 9.5), hair, -2, -2).shaded(circ(84, 14, 9.5), hair, -2, -2);
    case 'koczki':
      return pen.shaded(circ(40, 9, 10.5), hair, -2, -2).shaded(circ(80, 9, 10.5), hair, -2, -2);
    case 'dredy':
      for (const [x, tip, y] of [
        [34, 28, 76],
        [41, 37, 82],
        [79, 83, 82],
        [86, 92, 76],
      ] as const)
        pen.shaded(limb(x, 34, 4.4, tip, y, 3.4), hair, -1, -1);
      return pen;
    default:
      return pen;
  }
}

function headwear(pen: Pen, style: HairStyle, p: BudPalette, facing: Facing) {
  const side = facing === 'side';
  switch (style) {
    case 'czapka': {
      const dome = side ? 'M31 36 Q29 7 58 7 Q87 7 86 36Z' : 'M32 36 Q30 7 60 7 Q90 7 88 36Z';
      pen.shaded(dome, p.cap, -4, -3);
      pen.shaded(side ? rr(29, 30, 59, 10, 4) : rr(30, 30, 60, 10, 4), [p.cap[1], p.cap[1]], 0, 0);
      return pen.line(
        side
          ? 'M37 33 V38 M45 33 V38 M53 33 V38 M61 33 V38 M69 33 V38 M77 33 V38'
          : 'M38 33 V38 M46 33 V38 M54 33 V38 M62 33 V38 M70 33 V38 M78 33 V38',
        1.2,
        'rgba(0,0,0,0.3)',
      );
    }
    case 'daszek': {
      if (facing === 'up') {
        pen.shaded('M34 36 Q34 11 60 11 Q86 11 86 36Z', p.cap, -4, -3);
        return pen.shaded(rr(52, 30, 16, 7, 3), [p.cap[1], p.cap[1]], 0, 0);
      }
      if (side) {
        pen.shaded('M33 34 Q33 11 58 11 Q84 11 84 34Z', p.cap, -4, -3);
        return pen.shaded('M35 30 L13 28 Q11 35 35 36Z', [p.cap[1], p.cap[1]], 0, 0);
      }
      pen.shaded('M34 34 Q34 11 60 11 Q86 11 86 34Z', p.cap, -4, -3);
      pen.shaded('M35 30 L16 27 Q14 34 35 35Z', [p.cap[1], p.cap[1]], 0, 0);
      return pen.shaded(rr(34, 31, 52, 5, 2), [p.cap[1], p.cap[1]], 0, 0);
    }
    case 'sluchawki': {
      if (side) {
        pen.line('M44 26 Q58 2 78 24', 7, OUT, true).line('M44 26 Q58 2 78 24', 3, '#3a3d4a');
        return pen.shaded(rr(64, 33, 12, 20, 5), p.cap, -2, -2);
      }
      pen
        .line('M33 42 Q33 6 60 6 Q87 6 87 42', 7, OUT, true)
        .line('M33 42 Q33 6 60 6 Q87 6 87 42', 3, '#3a3d4a');
      return pen
        .shaded(rr(26, 33, 11, 19, 4.5), p.cap, -2, -2)
        .shaded(rr(83, 33, 11, 19, 4.5), p.cap, -2, -2);
    }
    default:
      return pen;
  }
}

function frontHair(pen: Pen, style: HairStyle, p: BudPalette, facing: Facing) {
  if (style === 'czapka') {
    // a little hair peeks out under the beanie
    if (facing === 'side') pen.shaded('M76 36 Q86 40 84 52 Q80 46 74 44Z', p.hair, -1, -1);
    else if (facing === 'down')
      pen.shaded('M34 36 Q33 46 37 50 L40 37Z M86 36 Q87 46 83 50 L80 37Z', p.hair, -1, -1);
    return headwear(pen, style, p, facing);
  }

  if (style === 'irokez' || style === 'buzz' || style === 'undercut') {
    // close crops: a darker scalp tone with the crest on top
    const scalp =
      facing === 'side'
        ? 'M35 38 Q34 15 58 15 Q84 15 84 40 Q80 30 66 26 Q50 24 35 38Z'
        : facing === 'up'
          ? 'M34 42 Q32 14 60 14 Q88 14 86 42 Q84 54 70 58 H50 Q36 54 34 42Z'
          : HAIR_FRONT.buzz!;
    pen.shaded(scalp, [mix(p.hair[0], p.skin[0], 0.45), mix(p.hair[1], p.skin[1], 0.45)], -2, -2);
    if (style === 'undercut') {
      const top =
        facing === 'side'
          ? 'M38 28 Q36 8 62 8 Q84 10 82 28 Q70 20 58 21 Q46 21 38 28Z'
          : facing === 'up'
            ? 'M38 30 Q38 9 60 9 Q82 9 82 30 Q70 23 60 23 Q50 23 38 30Z'
            : 'M36 31 Q33 9 63 8 Q90 9 85 31 Q80 22 70 22 Q54 30 42 25 Q38 26 36 31Z';
      pen.shaded(top, p.hair, -3, -3);
      pen.line(
        facing === 'side' ? 'M44 20 Q56 12 74 17' : 'M42 22 Q54 14 66 14 M60 22 Q70 15 80 22',
        1.4,
        p.hair[1],
      );
    }
    if (style === 'irokez') {
      const crest =
        facing === 'side'
          ? 'M38 26 Q40 6 58 2 Q78 2 84 24 Q72 16 60 16 Q48 16 38 26Z'
          : HAIR_FRONT.irokez!;
      pen.shaded(crest, p.hair, -2, -2);
    }
    return pen;
  }

  if (facing === 'up') {
    // the back of the head is all hair
    pen.shaded('M33 42 Q31 12 60 12 Q89 12 87 42 Q86 60 70 64 H50 Q34 60 33 42Z', p.hair, -4, -4);
    pen.line('M50 18 Q46 34 50 52 M60 15 Q61 34 59 54 M70 18 Q74 34 70 52', 1.4, p.hair[1]);
    if (style === 'jezyk')
      pen.shaded('M40 22 L42 9 L50 17 L55 5 L62 15 L69 5 L73 17 L81 11 L80 24Z', p.hair, -2, -2);
    if (style === 'kucyk') {
      pen.shaded('M54 50 Q49 76 60 90 Q71 76 66 50Z', p.hair, -2, -2);
      pen.shaded(rr(53, 46, 14, 7, 3), p.cap, 0, 0);
    }
    if (style === 'dlugie')
      pen.shaded('M33 44 Q36 70 44 80 H76 Q84 70 87 44 Q76 56 60 56 Q44 56 33 44Z', p.hair, -2, -2);
    return headwear(pen, style, p, facing);
  }

  if (facing === 'side') {
    const cap =
      style === 'jezyk'
        ? 'M34 40 L32 24 L40 26 L42 11 L51 19 L57 6 L64 17 L72 8 L76 21 L86 18 L85 42 Q84 56 77 63 Q74 46 64 36 Q56 30 44 30 Q38 33 34 40Z'
        : style === 'afro'
          ? 'M34 39 Q36 22 58 22 Q82 22 84 42 Q83 54 78 60 Q74 44 64 36 Q54 30 44 31 Q38 33 34 39Z'
          : 'M34 40 Q32 13 58 13 Q86 13 85 42 Q84 56 77 63 Q74 46 64 36 Q56 30 44 30 Q38 33 34 40Z';
    pen.shaded(cap, p.hair, -3, -3);
    if (style !== 'afro') pen.line('M46 24 Q58 18 72 22 M70 30 Q78 34 80 46', 1.4, p.hair[1]);
    return headwear(pen, style, p, facing);
  }

  pen.shaded(HAIR_FRONT[style] ?? HAIR_FRONT.krotkie!, p.hair, -3, -3);
  const strands = STRANDS[style];
  if (strands) pen.line(strands, 1.4, p.hair[1]);
  return headwear(pen, style, p, facing);
}

// ---------- faces ----------

/** An eye: dark outline shape, the iris in the lower part, a big and a small glint. */
const eye = (x: number, color: string, y = 44.5, ry = 5.4) => {
  const iris = Math.max(1.6, ry - 1.5);
  return (
    `<ellipse cx="${x}" cy="${y}" rx="3.9" ry="${ry}" fill="${OUT}"/>` +
    `<ellipse cx="${x}" cy="${r2(y + ry * 0.2)}" rx="2.7" ry="${r2(iris)}" fill="${color}"/>` +
    `<ellipse cx="${x}" cy="${r2(y + ry * 0.26)}" rx="1.5" ry="${r2(iris * 0.6)}" fill="${OUT}"/>` +
    `<circle cx="${x - 1.2}" cy="${r2(y - ry * 0.42)}" r="1.7" fill="#fff"/>` +
    `<circle cx="${x + 1.3}" cy="${r2(y + ry * 0.4)}" r="0.8" fill="#fff" opacity="0.85"/>`
  );
};

/** What grows or sits on the skin, under the eyes and mouth. Front view. */
function faceMark(pen: Pen, look: BudLook, p: BudPalette) {
  const dots = (pts: [number, number][], r: number, color: string, op = 0.8) =>
    pen.raw(
      pts
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${op}"/>`)
        .join(''),
    );
  switch (look.mark) {
    case 'piegi':
      dots(
        [
          [43, 50],
          [46.5, 52],
          [41, 53],
          [45, 48.5],
          [77, 50],
          [73.5, 52],
          [79, 53],
          [75, 48.5],
          [57.5, 48],
          [62.5, 48],
        ],
        0.75,
        p.skin[1] === p.skin[0] ? OUT : mix(p.skin[1], '#3a1f12', 0.45),
      );
      break;
    case 'pieprzyk':
      dots([[70.5, 54.5]], 1, mix(p.skin[1], '#1b1430', 0.6), 1);
      break;
    case 'blizna':
      // across the eyebrow, with two stitches
      pen.line('M73 32 L68 41', 1.5, mix(p.skin[1], '#7a2a2a', 0.45));
      pen.line('M69 34.5 l3.4 1.6 M67.8 37.5 l3.4 1.6', 0.9, mix(p.skin[1], '#7a2a2a', 0.45));
      break;
    case 'zarost':
      pen.raw(
        `<path d="M37 50 Q38 67 60 67 Q82 67 83 50 Q78 60 68 60 Q60 57 52 60 Q42 60 37 50Z" fill="${p.hair[1]}" opacity="0.28"/>`,
      );
      break;
    case 'wasy':
      pen.raw(
        `<path d="M50 53.5 Q55 49.5 60 51.5 Q65 49.5 70 53.5 Q65 54.5 60 53.5 Q55 54.5 50 53.5Z" fill="${p.hair[0]}" stroke="${OUT}" stroke-width="1" stroke-linejoin="round"/>`,
      );
      break;
    case 'broda':
      pen.raw(
        `<path d="M36 47 Q35 69 60 69 Q85 69 84 47 Q80 57 71 56 Q66 51 60 51 Q54 51 49 56 Q40 57 36 47Z" fill="${p.hair[0]}" stroke="${OUT}" stroke-width="1.4" stroke-linejoin="round"/>`,
      );
      pen.line('M45 61 q3 2 5 1 M70 61 q3 -1 5 -2 M58 64 h4', 1, p.hair[1]);
      break;
  }
}

function sideMark(pen: Pen, look: BudLook, p: BudPalette) {
  switch (look.mark) {
    case 'piegi':
      pen.raw(
        [
          [38, 50],
          [42, 52],
          [39, 48],
          [44, 49],
          [47, 52],
        ]
          .map(
            ([x, y]) =>
              `<circle cx="${x}" cy="${y}" r="0.75" fill="${mix(p.skin[1], '#3a1f12', 0.45)}" opacity="0.8"/>`,
          )
          .join(''),
      );
      break;
    case 'pieprzyk':
      pen.raw(`<circle cx="47" cy="54.5" r="1" fill="${mix(p.skin[1], '#1b1430', 0.6)}"/>`);
      break;
    case 'blizna':
      pen.line('M48 32 L43 41', 1.5, mix(p.skin[1], '#7a2a2a', 0.45));
      break;
    case 'zarost':
      pen.raw(
        `<path d="M33 52 Q34 66 54 66 Q68 65 70 50 Q62 58 50 58 Q40 58 33 52Z" fill="${p.hair[1]}" opacity="0.28"/>`,
      );
      break;
    case 'wasy':
      pen.raw(
        `<path d="M34 51.5 Q40 49 46 52.5 Q40 54 34 51.5Z" fill="${p.hair[0]}" stroke="${OUT}" stroke-width="1" stroke-linejoin="round"/>`,
      );
      break;
    case 'broda':
      pen.raw(
        `<path d="M32 50 Q32 68 54 68 Q70 66 71 48 Q64 56 50 55 Q42 51 32 50Z" fill="${p.hair[0]}" stroke="${OUT}" stroke-width="1.4" stroke-linejoin="round"/>`,
      );
      break;
  }
}

/** Glasses over the eyes; the frame takes the accent colour where it can. */
function glasses(pen: Pen, look: BudLook, p: BudPalette, side: boolean) {
  const kind = look.glasses ?? 'brak';
  if (kind === 'brak') return;
  const lens = (cx: number) => {
    switch (kind) {
      case 'lenonki':
        return `<circle cx="${cx}" cy="44.5" r="6.4" fill="#ffffff" fill-opacity="0.16" stroke="${OUT}" stroke-width="1.6"/>`;
      case 'przeciwsloneczne':
        return (
          `<rect x="${cx - 7.4}" y="39.5" width="14.8" height="10" rx="3.6" fill="${OUT}" stroke="${OUT}" stroke-width="1.6"/>` +
          `<path d="M${cx - 5} 42.5 l3 -1.4 M${cx - 5} 45.4 l5.6 -2.6" stroke="#fff" stroke-width="1.1" opacity="0.65" stroke-linecap="round"/>`
        );
      case 'sportowe':
        return '';
      default:
        return `<rect x="${cx - 7.2}" y="39.5" width="14.4" height="10" rx="3" fill="#ffffff" fill-opacity="0.16" stroke="${p.cap[1]}" stroke-width="2"/>`;
    }
  };
  if (side) {
    if (kind === 'sportowe')
      pen.raw(
        `<path d="M33 40 H52 Q55 45 51 49 H36 Q32 46 33 40Z" fill="${p.cap[0]}" stroke="${OUT}" stroke-width="1.6" stroke-linejoin="round"/><path d="M38 43 l6 -1.5" stroke="#fff" stroke-width="1.2" opacity="0.7" stroke-linecap="round"/>`,
      );
    else pen.raw(lens(45));
    pen.line('M52 43 L70 42', 1.5, kind === 'okulary' ? p.cap[1] : OUT);
    return;
  }
  if (kind === 'sportowe') {
    pen.raw(
      `<path d="M38 41 Q60 36 82 41 Q84 47 76 50 Q68 51 62 47 H58 Q52 51 44 50 Q36 47 38 41Z" fill="${p.cap[0]}" stroke="${OUT}" stroke-width="1.6" stroke-linejoin="round"/>` +
        `<path d="M43 43.5 l7 -1.6 M70 42.4 l5 1" stroke="#fff" stroke-width="1.2" opacity="0.7" stroke-linecap="round"/>`,
    );
    return;
  }
  pen.raw(lens(51) + lens(69));
  pen.line('M57.8 43.6 Q60 42 62.2 43.6', 1.5, kind === 'okulary' ? p.cap[1] : OUT);
  pen.line('M44 43 L36 41.5 M76 43 L84 41.5', 1.5, kind === 'okulary' ? p.cap[1] : OUT);
}

function face(pen: Pen, look: BudLook, p: BudPalette) {
  const fem = look.gender === 'ona';
  const mouthColor = fem ? p.lips : OUT;
  const iris = EYE_COLORS[look.eyes ?? 0] ?? EYE_COLORS[0];
  const blush = (op: number, rx = 3.6) =>
    `<ellipse cx="44" cy="51" rx="${rx}" ry="2" fill="#ff8f8f" opacity="${op}"/><ellipse cx="76" cy="51" rx="${rx}" ry="2" fill="#ff8f8f" opacity="${op}"/>`;
  const rosy = look.mark === 'rumience';
  faceMark(pen, look, p);
  let open = true;
  switch (look.mood) {
    case 'radosny':
      pen.raw(eye(51, iris) + eye(69, iris));
      pen.line('M46 36.5 Q51 34 55.5 36 M64.5 36 Q69 34 74 36.5', 2.2);
      pen.raw(
        `<path d="M54 53 Q60 61.5 66 53 Z" fill="#7a2a2a" stroke="${OUT}" stroke-width="1.6" stroke-linejoin="round"/>` +
          '<path d="M56 54.2 H64 Q63.4 55.6 60 55.6 Q56.6 55.6 56 54.2Z" fill="#fff"/>',
      );
      pen.raw(blush(rosy ? 0.8 : 0.5, rosy ? 5 : 3.6));
      break;
    case 'wyluzowany':
      open = false;
      pen.raw(
        `<ellipse cx="51" cy="45.5" rx="3.4" ry="2.8" fill="${OUT}"/><ellipse cx="69" cy="45.5" rx="3.4" ry="2.8" fill="${OUT}"/>` +
          `<ellipse cx="51" cy="46.2" rx="2.2" ry="1.7" fill="${iris}"/><ellipse cx="69" cy="46.2" rx="2.2" ry="1.7" fill="${iris}"/>` +
          '<circle cx="50" cy="45" r="0.9" fill="#fff"/><circle cx="68" cy="45" r="0.9" fill="#fff"/>',
      );
      pen
        .line('M47 42.6 H55.5 M64.5 42.6 H73', 2.4)
        .line('M46 37 Q51 36 55.5 37 M64.5 37 Q69 36 74 37', 2.2);
      pen.line('M55 55 Q61 56.5 66 52.5', 2, mouthColor);
      pen.raw(blush(rosy ? 0.75 : 0.3, rosy ? 5 : 3.6));
      break;
    case 'zadziorny':
      pen.raw(eye(51, iris) + eye(69, iris));
      pen.line('M45.5 34.5 L55.5 38.5 M64.5 38.5 L74.5 34.5', 2.8);
      pen.line('M54 54 Q60 58.5 66 53', 2, mouthColor);
      pen.raw(
        `<rect x="60.5" y="54.6" width="3" height="2.6" rx="0.6" fill="#fff" stroke="${OUT}" stroke-width="1"/>`,
      );
      pen.raw(blush(rosy ? 0.75 : 0.3, rosy ? 5 : 3.6));
      break;
    case 'niesmialy':
      pen.raw(eye(51, iris, 45.5, 4) + eye(69, iris, 45.5, 4));
      pen.line('M46 36 Q51 38 55.5 35.5 M64.5 35.5 Q69 38 74 36', 2.2);
      pen.line('M56.5 55.5 q1.7 -1.6 3.4 0 q1.7 1.6 3.4 0', 1.8, mouthColor);
      pen.raw(blush(0.75, 5));
      break;
    case 'zaspany':
      open = false;
      pen.line('M47.5 44 Q51 47.5 54.5 44 M65.5 44 Q69 47.5 72.5 44', 2.2);
      pen.line('M46 37.5 Q51 36.5 55.5 37.5 M64.5 37.5 Q69 36.5 74 37.5', 2);
      pen.raw(
        `<ellipse cx="60" cy="55.5" rx="2.4" ry="3" fill="#7a2a2a" stroke="${OUT}" stroke-width="1.4"/>`,
      );
      pen.raw(blush(rosy ? 0.75 : 0.3, rosy ? 5 : 3.6));
      break;
    case 'tajemniczy':
      pen.raw(eye(51, iris, 44.5, 3) + eye(69, iris, 44.5, 3));
      pen.line('M46 35 Q51 32.5 55.5 35.5 M64.5 37.5 H74', 2.2);
      pen.line('M56 55 H64', 2, mouthColor);
      if (rosy) pen.raw(blush(0.7, 5));
      break;
  }
  if (fem && open)
    pen.line('M48 40.6 l-2.8 -1.8 M47.6 43 l-3 -0.6 M72 40.6 l2.8 -1.8 M72.4 43 l3 -0.6', 1.6);
  pen.line('M58.6 49.6 Q60 51 61.4 49.6', 1.5, p.skin[1]); // nose
  glasses(pen, look, p, false);
}

function sideFace(pen: Pen, look: BudLook, p: BudPalette) {
  const fem = look.gender === 'ona';
  const mouthColor = fem ? p.lips : OUT;
  const iris = EYE_COLORS[look.eyes ?? 0] ?? EYE_COLORS[0];
  const sideEye = (ry: number, y = 44) =>
    `<ellipse cx="46" cy="${y}" rx="3" ry="${ry}" fill="${OUT}"/>` +
    `<ellipse cx="45.6" cy="${r2(y + ry * 0.22)}" rx="2" ry="${r2(Math.max(1.2, ry - 1.3))}" fill="${iris}"/>` +
    `<circle cx="45" cy="${r2(y - ry * 0.38)}" r="1.3" fill="#fff"/>`;
  sideMark(pen, look, p);
  let open = true;
  switch (look.mood) {
    case 'zaspany':
      open = false;
      pen.line('M42.5 44 Q46 47.5 49.5 44', 2.2).line('M41 37.5 Q46 36.5 50 37.5', 2);
      pen.raw(
        `<ellipse cx="40.5" cy="55.5" rx="2" ry="2.6" fill="#7a2a2a" stroke="${OUT}" stroke-width="1.3"/>`,
      );
      break;
    case 'wyluzowany':
      open = false;
      pen.raw(sideEye(2.8, 45.5));
      pen.line('M42 42.6 H50', 2.4).line('M38.5 55 Q42 56 45.5 53', 2, mouthColor);
      break;
    case 'zadziorny':
      pen.raw(sideEye(4.6));
      pen.line('M40.5 34.5 L50.5 38.5', 2.8).line('M38.5 55 Q42 57.5 46 54', 2, mouthColor);
      break;
    case 'tajemniczy':
      pen.raw(sideEye(3, 44.5));
      pen.line('M41 35 Q46 32.5 50.5 35.5', 2.2).line('M39 55 H44.5', 2, mouthColor);
      break;
    case 'niesmialy':
      pen.raw(sideEye(4, 45.5));
      pen.line('M41 36 Q46 38 50.5 35.5', 2.2).line('M39 55.5 q1.6 -1.5 3.2 0', 1.8, mouthColor);
      pen.raw('<ellipse cx="51" cy="51" rx="5" ry="2.2" fill="#ff8f8f" opacity="0.75"/>');
      break;
    default:
      pen.raw(sideEye(4.6));
      pen.line('M41 36 Q46 34 50.5 36', 2.2);
      pen.raw(
        `<path d="M38 53 Q42 59 47 53.5 Z" fill="#7a2a2a" stroke="${OUT}" stroke-width="1.5" stroke-linejoin="round"/>`,
      );
  }
  if (look.mood !== 'niesmialy')
    pen.raw(
      `<ellipse cx="51" cy="51" rx="${look.mark === 'rumience' ? 5 : 3.4}" ry="${look.mark === 'rumience' ? 2.4 : 1.9}" fill="#ff8f8f" opacity="${look.mark === 'rumience' ? 0.75 : 0.35}"/>`,
    );
  if (fem && open) pen.line('M43 40.6 l-2.6 -1.8 M42.6 43 l-2.8 -0.6', 1.6);
  pen.line('M33.6 44.5 Q31 47.5 34 49', 1.6); // nose
  glasses(pen, look, p, true);
}

// ---------- body ----------

type Ctx = { look: BudLook; p: BudPalette; frame: WalkFrame };

const SHORT_SLEEVES: readonly Outfit[] = ['tshirt', 'polo', 'sukienka', 'kamizelka', 'jersey'];
/** The thread of denim and workwear, always a warm yellow. */
const STITCH = '#e3b04b';
const WHITE_TRIM = '#f6f2e9';
/** Metal: zips, buckles, buttons. */
const METAL = '#cfd4dc';

/** A row of short ticks across a band: ribbing on a hem or a cuff. */
const ribs = (x0: number, x1: number, y0: number, y1: number, step = 3.2) => {
  const out: string[] = [];
  for (let x = x0 + step; x < x1 - 0.5; x += step) out.push(`M${r2(x)} ${y0} V${y1}`);
  return out.join(' ');
};

/** Running stitches along a path. */
const stitches = (pen: Pen, d: string, color = STITCH, width = 0.8) =>
  pen.raw(
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-dasharray="1.6 1.3" stroke-linecap="round"/>`,
  );

/** A zip down the middle of a top: the teeth and the pull. */
function zip(pen: Pen, x: number, y0: number, y1: number) {
  pen.line(`M${x} ${y0} V${y1}`, 2.2, OUT);
  pen.raw(
    `<path d="M${x} ${y0} V${y1}" stroke="${METAL}" stroke-width="1" stroke-dasharray="1 1.1" fill="none"/>` +
      `<rect x="${x - 1.4}" y="${y0 + 1}" width="2.8" height="5" rx="1" fill="${METAL}" stroke="${OUT}" stroke-width="0.8"/>`,
  );
}

/** Legs that show skin below a hem: shorts from the knee, a skirt or a dress from the hem (leggings stay). */
function legSkin(look: BudLook): 'knee' | 'hem' | null {
  if (look.pants === 'szorty') return 'knee';
  if (look.pants === 'spodnica') return 'hem';
  if (look.outfit === 'sukienka' && look.pants !== 'legginsy') return 'hem';
  return null;
}

/** One leg from the hip (x1) to the ankle above `ground`, dressed in the look's legwear. */
function leg(
  pen: Pen,
  x1: number,
  x2: number,
  ground: number,
  p: BudPalette,
  look: BudLook,
  back: boolean,
) {
  const ankle = ground - 12;
  const pants: Pair = back ? [p.pants[1], p.pants[1]] : p.pants;
  const skin: Pair = back ? [p.skin[1], p.skin[1]] : p.skin;
  const bare = legSkin(look);
  const at = (t: number) => x1 + (x2 - x1) * t;
  const y = (t: number) => HIP_Y + (ankle - HIP_Y) * t;
  const light = mix(pants[0], '#ffffff', 0.22);
  const dark = back ? mix(pants[1], '#1b1430', 0.2) : pants[1];
  if (bare === 'hem') {
    pen.shaded(limb(x1, HIP_Y, 6.5, x2, ankle, 5), skin, -2, -2);
    return;
  }
  const wide: Record<string, number> = { bojowki: 8.6, legginsy: 6.6, szerokie: 9.4, rurki: 6.4 };
  const narrow: Record<string, number> = {
    legginsy: 4.8,
    dresy: 5,
    bojowki: 6.4,
    szerokie: 8.8,
    rurki: 4.6,
  };
  const w = wide[look.pants] ?? 7.5;
  const n = narrow[look.pants] ?? 5.5;
  if (bare === 'knee') {
    // shorts to just above the knee, then the leg
    pen.shaded(limb(at(0.55), y(0.55), 5.6, x2, ankle, 5), skin, -2, -2);
    pen.shaded(limb(x1, HIP_Y, w, at(0.5), y(0.5), 7.4), pants, -2, -2);
    pen.flat(rr(at(0.5) - 7.2, y(0.5) + 3.6, 14.4, 3.2, 1.2), dark);
    pen.line(
      `M${r2(at(0.3) + 4.6)} ${r2(y(0.3))} L${r2(at(0.5) + 5.4)} ${r2(y(0.5) + 3)}`,
      1.4,
      p.cap[0],
    );
    return;
  }
  pen.shaded(limb(x1, HIP_Y, w, x2, ankle, n), pants, -2, -2);
  // a band across the ankle, as wide as the leg is there
  const hem = (h: number, color: string) =>
    pen.flat(rr(x2 - n - 0.5, ankle - h, n * 2 + 1, h, 1.5), color);
  const outer = (t: number) => at(t) + 3.8;
  switch (look.pants) {
    case 'jeansy':
      // yellow outer seam, a worn patch on the knee, a turned-up hem
      pen.raw(
        `<ellipse cx="${r2(at(0.55) - 1)}" cy="${r2(y(0.55))}" rx="3.2" ry="4.2" fill="${light}" opacity="0.7"/>`,
      );
      stitches(pen, `M${r2(outer(0.1))} ${r2(y(0.1))} L${r2(x2 + 3.2)} ${r2(ankle - 5)}`);
      hem(4, light);
      stitches(pen, `M${r2(x2 - n)} ${r2(ankle - 2)} H${r2(x2 + n)}`, STITCH, 0.7);
      break;
    case 'dresy':
      // two stripes down the side, an elastic cuff that gathers
      pen.line(
        `M${r2(at(0.05) + 5)} ${r2(y(0.05))} L${r2(x2 + 3.5)} ${r2(ankle - 5)}`,
        1.3,
        WHITE_TRIM,
      );
      pen.line(
        `M${r2(at(0.05) + 2.7)} ${r2(y(0.05))} L${r2(x2 + 1.5)} ${r2(ankle - 5)}`,
        1.3,
        WHITE_TRIM,
      );
      hem(4.5, dark);
      pen.line(ribs(x2 - n, x2 + n, ankle - 4, ankle - 0.6, 2.2), 0.7, mix(dark, '#1b1430', 0.3));
      break;
    case 'bojowki':
      // a cargo pocket with a flap and a button, a strap at the shin
      pen.flat(rr(at(0.42) - 5.5, y(0.42), 11, 9, 1.8), dark);
      pen.flat(rr(at(0.42) - 6, y(0.42) - 0.6, 12, 3.6, 1.4), pants[0]);
      pen.raw(
        `<circle cx="${r2(at(0.42))}" cy="${r2(y(0.42) + 2)}" r="0.9" fill="${METAL}" stroke="${OUT}" stroke-width="0.5"/>`,
      );
      hem(3.4, dark);
      break;
    case 'chinosy':
      // a pressed crease and a rolled cuff
      pen.line(`M${r2(at(0.08))} ${r2(y(0.08))} L${r2(x2)} ${r2(ankle - 5)}`, 1, dark);
      hem(5, light);
      break;
    case 'legginsy':
      // a side panel from hip to ankle
      pen.line(`M${r2(at(0.15) - 2)} ${r2(y(0.15))} L${r2(x2 - 2)} ${r2(ankle - 3)}`, 1.6, light);
      break;
    case 'szerokie':
      // stacks of cloth over the shoe
      pen.line(`M${r2(x2 - n + 1)} ${r2(ankle - 6)} q${r2(n - 1)} 2.6 ${r2(n * 2 - 2)} 0`, 1, dark);
      pen.line(
        `M${r2(x2 - n + 1)} ${r2(ankle - 2.6)} q${r2(n - 1)} 2.6 ${r2(n * 2 - 2)} 0`,
        1,
        dark,
      );
      stitches(pen, `M${r2(outer(0.1) + 2)} ${r2(y(0.1))} L${r2(x2 + n - 1.6)} ${r2(ankle - 8)}`);
      break;
    case 'rurki':
      // ripped knee: skin through a torn gap with threads across
      pen.raw(
        `<ellipse cx="${r2(at(0.5))}" cy="${r2(y(0.5))}" rx="3.6" ry="2.3" fill="${skin[0]}" stroke="${OUT}" stroke-width="0.8"/>`,
      );
      pen.line(
        `M${r2(at(0.5) - 3.2)} ${r2(y(0.5) - 0.7)} H${r2(at(0.5) + 3.2)} M${r2(at(0.5) - 3)} ${r2(y(0.5) + 0.8)} H${r2(at(0.5) + 3)}`,
        0.6,
        WHITE_TRIM,
      );
      pen.line(`M${r2(at(0.75) - 3)} ${r2(y(0.75))} h4`, 0.9, skin[0]);
      break;
  }
  // a soft fold at the knee
  if (look.pants !== 'rurki') pen.line(`M${r2(at(0.62) - 3)} ${r2(y(0.62))} q3 1.5 6 0`, 1, dark);
}

/** The hem of a skirt or a dress, over the hips (drawn after the legs, under the torso). */
function skirt(pen: Pen, look: BudLook, p: BudPalette, side: boolean) {
  const dress = look.outfit === 'sukienka';
  if (!dress && look.pants !== 'spodnica') return;
  const tone = dress ? p.top : p.pants;
  const d = side ? 'M46 104 H74 L80 128 Q60 133 40 128Z' : 'M38 104 H82 L90 128 Q60 135 30 128Z';
  pen.shaded(d, tone, -3, -2);
  // pleats, and a band of the accent colour along the bottom
  pen.line(
    side
      ? 'M52 112 L48 129 M60 112 V131 M68 112 L72 129'
      : 'M46 112 L41 130 M53 112 L51 132 M60 112 V133 M67 112 L69 132 M74 112 L79 130',
    1.1,
    tone[1],
  );
  pen.line(side ? 'M42 124.5 Q60 129 78 124.5' : 'M33 124.5 Q60 131 87 124.5', 1.6, p.cap[0]);
}

/** A shoe of the look's style. `toe` -1 points left (side view). */
function shoe(pen: Pen, x: number, ground: number, p: BudPalette, toe: 0 | -1, look: BudLook) {
  const g = ground;
  const style = look.shoes ?? 'trampki';
  const front = toe === 0;
  const sole = (h: number, tone: Pair = p.soleTone) =>
    pen.shaded(
      front ? rr(x - 12, g - h + 1.5, 24, h, 3) : rr(x - 14, g - h + 1.5, 23, h, 3),
      tone,
      -1,
      -1,
    );
  const dark: Pair = ['#3a3d4a', '#262833'];
  const light = mix(p.shoes[0], '#ffffff', 0.35);
  switch (style) {
    case 'sandaly': {
      // the foot shows, with two straps and a buckle
      pen.shaded(
        front
          ? rr(x - 9, g - 10, 18, 9, 4)
          : `M${x + 6} ${g - 2}V${g - 8}Q${x + 2} ${g - 12} ${x - 4} ${g - 10}Q${x - 11} ${g - 8} ${x - 12} ${g - 2}Z`,
        p.skin,
        -1,
        -1,
      );
      if (front)
        pen.line(
          `M${x - 5} ${g - 3.5} v1.4 M${x} ${g - 3.5} v1.4 M${x + 5} ${g - 3.5} v1.4`,
          0.8,
          p.skin[1],
        );
      sole(4.5, p.shoes);
      pen.flat(front ? rr(x - 10, g - 9, 20, 3, 1.5) : rr(x - 9, g - 9, 15, 3, 1.5), p.shoes[0]);
      pen.flat(front ? rr(x - 10, g - 5, 20, 2.6, 1.3) : rr(x - 3, g - 12, 3, 9, 1.3), p.shoes[0]);
      pen.raw(
        `<rect x="${front ? x + 4 : x - 3}" y="${g - 9.4}" width="3" height="3.6" rx="0.8" fill="${METAL}" stroke="${OUT}" stroke-width="0.6"/>`,
      );
      return;
    }
    case 'mokasyny': {
      const upper = front
        ? `M${x - 10.5} ${g - 3}Q${x - 11} ${g - 10} ${x - 3} ${g - 10.5}H${x + 3}Q${x + 11} ${g - 10} ${x + 10.5} ${g - 3}Z`
        : `M${x + 7} ${g - 3}V${g - 8}Q${x + 6} ${g - 11} ${x} ${g - 11}Q${x - 9} ${g - 10} ${x - 13} ${g - 3}Z`;
      pen.shaded(upper, p.shoes, -2, -2);
      // the moccasin seam and the strap across
      pen.line(
        front
          ? `M${x - 6} ${g - 5} Q${x} ${g - 10} ${x + 6} ${g - 5}`
          : `M${x - 10} ${g - 4} Q${x - 5} ${g - 9} ${x + 1} ${g - 7}`,
        1.1,
        p.shoes[1],
      );
      pen.flat(front ? rr(x - 6, g - 8.2, 12, 2.2, 1) : rr(x - 7, g - 8.6, 9, 2.2, 1), p.shoes[1]);
      sole(3.5, dark);
      return;
    }
    case 'kalosze': {
      // a rubber boot: tall, shiny, a band at the top and a heavy tread
      const top = 28;
      const upper = front
        ? `M${x - 10.5} ${g - 3}V${g - top + 3}Q${x - 10} ${g - top} ${x - 6} ${g - top}H${x + 6}Q${x + 10} ${g - top} ${x + 10.5} ${g - top + 3}V${g - 3}Z`
        : `M${x + 7} ${g - 3}V${g - top + 3}Q${x + 7} ${g - top} ${x + 3} ${g - top}H${x - 5}Q${x - 7} ${g - top} ${x - 7} ${g - top + 4}V${g - 10}Q${x - 12} ${g - 8} ${x - 13} ${g - 3}Z`;
      pen.shaded(upper, p.shoes, -2, -2);
      pen.flat(
        front ? rr(x - 10.5, g - top, 21, 3.6, 1.5) : rr(x - 7, g - top, 14, 3.6, 1.5),
        p.shoes[1],
      );
      pen.line(
        front ? `M${x - 6} ${g - top + 7} V${g - 8}` : `M${x + 3} ${g - top + 7} V${g - 8}`,
        1.5,
        light,
      );
      sole(5, dark);
      pen.line(
        ribs(front ? x - 12 : x - 14, front ? x + 12 : x + 9, g - 1.8, g + 1, 3),
        0.8,
        '#121218',
      );
      return;
    }
    case 'glany':
    case 'kozaki':
    case 'wysokie': {
      // boots and high-tops: the upper climbs the ankle
      const top = style === 'kozaki' ? 30 : style === 'glany' ? 20 : 17;
      const upper = front
        ? `M${x - 10.5} ${g - 3}V${g - top + 4}Q${x - 10} ${g - top} ${x - 5} ${g - top}H${x + 5}Q${x + 10} ${g - top} ${x + 10.5} ${g - top + 4}V${g - 3}Z`
        : `M${x + 7} ${g - 3}V${g - top + 3}Q${x + 7} ${g - top} ${x + 2} ${g - top}H${x - 4}Q${x - 6} ${g - top} ${x - 6} ${g - top + 4}V${g - 9}Q${x - 11} ${g - 8} ${x - 13} ${g - 3}Z`;
      pen.shaded(upper, p.shoes, -2, -2);
      if (style === 'kozaki') {
        // a strap and buckle at the ankle, a zip up the inside
        pen.line(
          front ? `M${x + 4} ${g - top + 3} V${g - 6}` : `M${x + 4} ${g - top + 3} V${g - 6}`,
          1.2,
          p.shoes[1],
        );
        pen.flat(
          front ? rr(x - 10.5, g - 15, 21, 3.4, 1) : rr(x - 6, g - 15, 13, 3.4, 1),
          p.shoes[1],
        );
        pen.raw(
          `<rect x="${front ? x - 2 : x - 1}" y="${g - 15.6}" width="4.4" height="4.6" rx="1" fill="${METAL}" stroke="${OUT}" stroke-width="0.7"/>`,
        );
      } else {
        // laces through eyelets
        const lx = front ? x : x - 1;
        const count = style === 'glany' ? 4 : 3;
        for (let i = 0; i < count; i++) {
          const ly = g - 7 - i * 3.6;
          pen.line(`M${lx - 3} ${r2(ly)} H${lx + 3}`, 1.2, style === 'glany' ? WHITE_TRIM : p.sole);
          if (style === 'glany')
            pen.raw(
              `<circle cx="${lx - 3.4}" cy="${r2(ly)}" r="0.7" fill="${METAL}"/><circle cx="${lx + 3.4}" cy="${r2(ly)}" r="0.7" fill="${METAL}"/>`,
            );
        }
        pen.flat(
          front ? rr(x - 10.5, g - top, 21, 3.5, 1.5) : rr(x - 6, g - top, 13, 3.5, 1.5),
          p.shoes[1],
        );
        if (style === 'wysokie') {
          // a rubber toe cap and a round patch on the ankle
          pen.flat(
            front
              ? `M${x - 10.5} ${g - 3} Q${x - 10} ${g - 9} ${x} ${g - 9} Q${x + 10} ${g - 9} ${x + 10.5} ${g - 3}Z`
              : `M${x - 13} ${g - 3} Q${x - 11} ${g - 8} ${x - 5} ${g - 8} V${g - 3}Z`,
            p.soleTone[0],
          );
          pen.raw(
            `<circle cx="${front ? x + 6 : x + 2}" cy="${g - 12.5}" r="2.3" fill="${p.sole}" stroke="${OUT}" stroke-width="0.8"/>`,
          );
        }
      }
      sole(style === 'glany' ? 7 : 5.5, style === 'glany' ? dark : p.soleTone);
      if (style === 'glany')
        // the yellow welt of a work boot
        stitches(
          pen,
          front ? `M${x - 11} ${g - 4.2} H${x + 11}` : `M${x - 13} ${g - 4.2} H${x + 7.5}`,
        );
      return;
    }
    case 'biegowe': {
      // running shoes: a low upper, an accent flash and a thick two-tone sole
      const upper = front
        ? `M${x - 10.5} ${g - 3}Q${x - 11.5} ${g - 12} ${x - 3} ${g - 12.5}H${x + 3}Q${x + 11.5} ${g - 12} ${x + 10.5} ${g - 3}Z`
        : `M${x + 7} ${g - 3}V${g - 9}Q${x + 7} ${g - 13} ${x + 2} ${g - 13}Q${x - 8} ${g - 12} ${x - 13} ${g - 3}Z`;
      pen.shaded(upper, p.shoes, -2, -2);
      pen.line(
        front
          ? `M${x - 8} ${g - 8} L${x - 3} ${g - 5.5} L${x + 3} ${g - 8} L${x + 8} ${g - 5.5}`
          : `M${x - 9} ${g - 5} L${x - 4} ${g - 8.5} L${x} ${g - 5.5} L${x + 5} ${g - 9}`,
        1.7,
        p.sole,
      );
      pen.line(
        front ? `M${x - 2.5} ${g - 11} h5 M${x - 2.5} ${g - 9.2} h5` : `M${x - 1} ${g - 11.5} l3 1`,
        0.9,
        OUT,
      );
      sole(7);
      pen.line(
        front ? `M${x - 11} ${g - 1.4} H${x + 11}` : `M${x - 13} ${g - 1.4} H${x + 8}`,
        1.5,
        p.sole,
      );
      return;
    }
    default: {
      // canvas trainers: rounded upper, a rubber toe cap, laces and a thick striped sole
      const upper = front
        ? `M${x - 10.5} ${g - 3}Q${x - 11.5} ${g - 13} ${x - 3} ${g - 13.5}H${x + 3}Q${x + 11.5} ${g - 13} ${x + 10.5} ${g - 3}Z`
        : `M${x + 7} ${g - 3}V${g - 10}Q${x + 7} ${g - 14} ${x + 1} ${g - 14}Q${x - 9} ${g - 13} ${x - 13} ${g - 3}Z`;
      pen.shaded(upper, p.shoes, -2, -2);
      pen.flat(
        front
          ? `M${x - 10} ${g - 3} Q${x - 9} ${g - 8} ${x} ${g - 8} Q${x + 9} ${g - 8} ${x + 10} ${g - 3}Z`
          : `M${x - 13} ${g - 3} Q${x - 11} ${g - 7.6} ${x - 6} ${g - 7.6} V${g - 3}Z`,
        p.soleTone[0],
      );
      pen.line(
        front
          ? `M${x - 2.5} ${g - 12.4} h5 M${x - 2.5} ${g - 10.4} h5`
          : `M${x - 3} ${g - 10.6} l3 1.6 M${x - 0.6} ${g - 12} l3 1.6`,
        1,
        OUT,
      );
      sole(6.5);
      pen.line(
        front ? `M${x - 11} ${g - 2.2} H${x + 11}` : `M${x - 13} ${g - 2.2} H${x + 8}`,
        1.3,
        p.sole,
      );
    }
  }
}

function legsFront(pen: Pen, { look, p, frame }: Ctx) {
  // a step seen from the front: the leg going back rises up the picture and darkens (it is further away), the one
  // coming forward reaches lower; standing, both feet are planted a little apart and turn slightly outwards
  const back = frame === 1 ? 70 : frame === 2 ? 50 : 0;
  const legs = [
    { x: 50, foot: frame === 2 ? 48.5 : 47, ground: frame === 1 ? 152 : frame === 2 ? 144 : 150 },
    { x: 70, foot: frame === 1 ? 71.5 : 73, ground: frame === 2 ? 152 : frame === 1 ? 144 : 150 },
  ];
  // the leg further away first, so the near one overlaps it
  legs.sort((a, b) => (a.x === back ? -1 : b.x === back ? 1 : 0));
  for (const l of legs) {
    const far = l.x === back;
    leg(pen, l.x, l.foot, l.ground, p, look, far);
    shoe(pen, l.foot, l.ground, far ? { ...p, shoes: [p.shoes[1], p.shoes[1]] } : p, 0, look);
  }
  skirt(pen, look, p, false);
}

function legsSide(pen: Pen, { look, p, frame }: Ctx) {
  // back leg first (darker), then the front leg
  const legs: [number, boolean][] =
    frame === 0
      ? [
          [64, false],
          [58, false],
        ]
      : frame === 1
        ? [
            [70, true],
            [52, false],
          ]
        : [
            [65, false],
            [56, true],
          ];
  legs.forEach(([x, lifted], i) => {
    const ground = lifted ? 145 : 150;
    leg(pen, 60 + (x - 60) * 0.5, x, ground, p, look, i === 0);
    shoe(pen, x, ground, i === 0 ? { ...p, shoes: [p.shoes[1], p.shoes[1]] } : p, -1, look);
  });
  skirt(pen, look, p, true);
}

/** A band across a limb at t (0 shoulder .. 1 wrist). */
const sleeveBand = (sx: number, sy: number, wx: number, wy: number, t: number, r: number) => {
  const x = sx + (wx - sx) * t;
  const y = sy + (wy - sy) * t;
  return `M${r2(x - r)} ${r2(y)} H${r2(x + r)}`;
};

/** Arm hanging from the shoulder at (sx, 76) to a rounded hand at (hx, hy). */
function arm(pen: Pen, sx: number, hx: number, hy: number, { look, p }: Ctx) {
  const wx = sx + (hx - sx) * 0.85;
  const wy = hy - 6;
  const o = look.outfit;
  if (SHORT_SLEEVES.includes(o)) {
    const ex = sx + (hx - sx) * 0.35;
    pen.shaded(limb(ex, 84, 5.5, wx, wy, 5), p.skin, -2, -2);
    // a vest shows the T-shirt underneath at the shoulder
    const sleeve: Pair = o === 'kamizelka' ? p.cap : p.top;
    pen.shaded(limb(sx, 76, 8, ex, 87, 7), sleeve, -2, -2);
    if (o === 'jersey' || o === 'polo') {
      // a contrast band round the sleeve's end
      const band = `M${r2(ex - 6.4)} 89.4 Q${r2(ex)} 92 ${r2(ex + 6.4)} 89.4`;
      pen.line(band, 3.6, OUT).line(band, 2.2, p.cap[0]);
    } else pen.line(`M${r2(ex - 6)} 90.5 q6 2 12 0`, 0.9, sleeve[1]);
  } else {
    const thick = o === 'puchowka' ? 9 : 7.5;
    const end = o === 'puchowka' ? 7.2 : 6;
    pen.shaded(limb(sx, 76, thick, wx, wy, end), p.top, -2, -2);
    const ex = sx + (wx - sx) * 0.5;
    const ey = 76 + (wy - 76) * 0.5;
    const band = (t: number, r = 7, color = p.top[1], w = 1.1) =>
      pen.line(sleeveBand(sx, 76, wx, wy, t, r), w, color);
    if (o === 'puchowka') {
      // quilted: a rounded baffle every few units
      for (const t of [0.22, 0.42, 0.62, 0.8]) band(t, 7.6, p.top[1], 1.4);
    } else {
      pen.line(`M${r2(ex - 4)} ${r2(ey)} q4 2 8 0`, 1, p.top[1]); // a crease at the elbow
    }
    if (o === 'flanela') {
      // the check runs down the sleeve too
      band(0.2, 6.6, mix(p.top[1], '#1b1430', 0.2), 1.3);
      band(0.4, 6.4, mix(p.top[1], '#1b1430', 0.2), 1.3);
      band(0.6, 6.2, mix(p.top[1], '#1b1430', 0.2), 1.3);
      pen.line(`M${sx} 76 L${r2(wx)} ${r2(wy)}`, 1.3, mix(p.top[1], '#1b1430', 0.2));
    }
    if (o === 'dresowka') {
      // two stripes from shoulder to wrist
      const dx = sx < 60 ? -2.8 : sx > 60 ? 2.8 : 2;
      pen.line(`M${r2(sx + dx)} 72 L${r2(wx + dx)} ${r2(wy - 3)}`, 1.3, p.cap[0]);
      pen.line(`M${r2(sx + dx * 2)} 73 L${r2(wx + dx * 2)} ${r2(wy - 3)}`, 1.3, p.cap[0]);
    }
    if (o === 'jeansowka') stitches(pen, sleeveBand(sx, 76, wx, wy, 0.16, 7));
    const cx = sx + (wx - sx) * 0.88;
    if (o === 'koszula' || o === 'flanela' || o === 'jeansowka') {
      // a shirt cuff with a button
      pen.flat(limb(cx, wy - 3, 6.2, wx, wy, 6.2), mix(p.top[0], '#ffffff', 0.2));
      pen.raw(
        `<circle cx="${r2(wx + (hx < sx ? 2.6 : -2.6))}" cy="${r2(wy - 1)}" r="0.9" fill="${o === 'jeansowka' ? METAL : WHITE_TRIM}" stroke="${OUT}" stroke-width="0.5"/>`,
      );
    } else {
      // a ribbed cuff
      const cuff = o === 'kurtka' ? p.cap[0] : p.top[1];
      pen.flat(limb(cx, wy - 3, end + 0.3, wx, wy, end + 0.3), cuff);
      pen.line(ribs(wx - end, wx + end, wy - 4, wy + 3, 2.4), 0.7, mix(cuff, '#1b1430', 0.32));
    }
  }
  // a watch on the left wrist
  if (look.accessory === 'zegarek' && sx < 60) {
    pen.flat(limb(wx - 0.4, wy + 0.4, 5.7, wx, wy + 1.8, 5.7), '#3a3d4a');
    pen.raw(
      `<circle cx="${r2(wx)}" cy="${r2(wy + 1.1)}" r="3" fill="${p.cap[0]}" stroke="${OUT}" stroke-width="1"/><circle cx="${r2(wx)}" cy="${r2(wy + 1.1)}" r="1.4" fill="#fff"/>`,
    );
  }
  pen.shaded(circ(hx, hy, 5.8), p.skin, -2, -2);
  // a thumb, so the hand reads as a hand
  pen.line(
    `M${r2(hx + (hx < 60 ? 3 : -3))} ${r2(hy - 3)} q${hx < 60 ? 2.5 : -2.5} 2 ${hx < 60 ? 1 : -1} 5`,
    1.1,
    p.skin[1],
  );
}

/** A woven check, clipped to the shape: dark bars both ways and a thin light line in between (flannel). */
function plaid(pen: Pen, shape: string, x0: number, x1: number, tone: Pair) {
  pen.clipped(shape, (c) => {
    const bars: string[] = [];
    const thin: string[] = [];
    for (let x = x0 + 3; x < x1; x += 10) {
      bars.push(`M${x} 66 V114`);
      thin.push(`M${x + 5} 66 V114`);
    }
    for (let y = 70; y < 114; y += 10) {
      bars.push(`M${x0} ${y} H${x1}`);
      thin.push(`M${x0} ${y + 5} H${x1}`);
    }
    c.raw(
      `<path d="${bars.join(' ')}" stroke="${mix(tone[1], '#1b1430', 0.25)}" stroke-width="3" opacity="0.55" fill="none"/>` +
        `<path d="${thin.join(' ')}" stroke="${mix(tone[0], '#ffffff', 0.5)}" stroke-width="0.7" opacity="0.8" fill="none"/>`,
    );
  });
}

/** The print on a top, clipped to its shape, in the accent colour. */
function topPrint(pen: Pen, shape: string, ctx: Ctx, view: Facing) {
  const { look, p } = ctx;
  const print = look.print ?? 'gladka';
  if (print === 'gladka' || ['flanela', 'ogrodniczki', 'kamizelka'].includes(look.outfit)) return;
  const side = view === 'side';
  const cx = side ? 54 : 60;
  const accent = p.cap[0] === p.top[0] ? mix(p.top[0], '#ffffff', 0.55) : p.cap[0];
  const line = `stroke="${OUT}" stroke-width="1" stroke-linejoin="round"`;
  pen.clipped(shape, (c) => {
    switch (print) {
      case 'paski': {
        const bands: string[] = [];
        for (let y = 76; y < 110; y += 9) bands.push(`M30 ${y} H90`);
        c.raw(`<path d="${bands.join(' ')}" stroke="${accent}" stroke-width="3.6" fill="none"/>`);
        break;
      }
      case 'pas':
        c.raw(
          `<path d="M30 85 H90" stroke="${accent}" stroke-width="9" fill="none"/>` +
            `<path d="M30 78.8 H90 M30 91.2 H90" stroke="${WHITE_TRIM}" stroke-width="1.3" fill="none"/>`,
        );
        break;
      case 'moro': {
        const a = mix(p.top[0], '#1b1430', 0.32);
        const b = mix(p.top[0], '#ffffff', 0.28);
        c.raw(
          `<path d="M36 74 q8 -6 14 0 q4 6 -4 9 q-10 3 -12 -3Z M62 70 q10 -3 14 4 q2 7 -7 7 q-10 -2 -7 -11Z M42 94 q8 -5 13 1 q3 7 -5 8 q-11 0 -8 -9Z M66 92 q9 -4 13 3 q1 8 -7 8 q-10 0 -6 -11Z" fill="${a}"/>` +
            `<path d="M52 82 q5 -4 9 0 q2 5 -3 6 q-7 1 -6 -6Z M38 104 q5 -3 8 1 q0 5 -4 5 q-6 0 -4 -6Z M74 80 q4 -2 6 2 q0 4 -4 4 q-4 0 -2 -6Z M58 102 q5 -3 9 1 q1 5 -4 6 q-6 0 -5 -7Z" fill="${b}"/>`,
        );
        break;
      }
      case 'odznaka': {
        // a badge on the chest; on the back, large in the middle
        const big = view === 'up';
        const bx = big ? cx : side ? 52 : 69;
        const by = big ? 86 : 78;
        const r = big ? 10 : 5.4;
        c.raw(
          `<circle cx="${bx}" cy="${by}" r="${r}" fill="${accent}" ${line}/>` +
            `<circle cx="${bx}" cy="${by}" r="${r2(r * 0.62)}" fill="none" stroke="${OUT}" stroke-width="0.8"/>` +
            `<path d="M${bx} ${r2(by - r * 0.38)} L${r2(bx + r * 0.36)} ${r2(by + r * 0.3)} H${r2(bx - r * 0.36)}Z" fill="${OUT}"/>`,
        );
        break;
      }
      case 'blyskawica':
        c.raw(
          `<path transform="translate(${cx - 60} 0)" d="M64 72 L51 90 H59 L55 104 L70 84 H61 L66 72Z" fill="${accent}" ${line}/>`,
        );
        break;
      case 'gwiazda': {
        const pts: string[] = [];
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const r = i % 2 ? 5.2 : 11.5;
          pts.push(`${r2(cx + Math.cos(a) * r)} ${r2(86 + Math.sin(a) * r)}`);
        }
        c.raw(`<path d="M${pts.join('L')}Z" fill="${accent}" ${line}/>`);
        break;
      }
    }
  });
}

/** Worn on the body, over the top (the pack behind the bud is drawn separately). */
function accessoryFront(pen: Pen, ctx: Ctx, back: boolean) {
  const { look, p } = ctx;
  const trim = p.cap;
  switch (look.accessory) {
    case 'lancuch':
      if (back) return;
      pen.raw(
        `<path d="M47 68 Q60 92 73 68" fill="none" stroke="${OUT}" stroke-width="2.6"/>` +
          `<path d="M47 68 Q60 92 73 68" fill="none" stroke="#ffc93c" stroke-width="1.5" stroke-dasharray="1.8 0.9"/>` +
          `<circle cx="60" cy="81.5" r="3.2" fill="#ffc93c" stroke="${OUT}" stroke-width="1"/><circle cx="59" cy="80.5" r="0.9" fill="#fff"/>`,
      );
      return;
    case 'plecak':
      if (back) return; // the pack itself comes after the arms
      pen.flat(rr(43, 68, 5.4, 32, 2), trim[0]);
      pen.flat(rr(71.6, 68, 5.4, 32, 2), trim[0]);
      pen.line('M43 84 h5.4 M71.6 84 h5.4', 1, trim[1]);
      pen.raw(
        `<rect x="42" y="88" width="7.4" height="4.4" rx="1" fill="${METAL}" stroke="${OUT}" stroke-width="0.8"/><rect x="70.6" y="88" width="7.4" height="4.4" rx="1" fill="${METAL}" stroke="${OUT}" stroke-width="0.8"/>`,
      );
      return;
    case 'nerka':
      // a sling across the chest with a pouch on the hip
      pen.raw(
        `<path d="${back ? 'M76 68 L42 102' : 'M44 68 L78 102'}" stroke="${OUT}" stroke-width="5.2" stroke-linecap="round"/>` +
          `<path d="${back ? 'M76 68 L42 102' : 'M44 68 L78 102'}" stroke="${trim[1]}" stroke-width="3.2" stroke-linecap="round"/>`,
      );
      pen.shaded(back ? rr(36, 94, 22, 13, 5.5) : rr(62, 94, 22, 13, 5.5), trim, -2, -2);
      pen.line(back ? 'M39 99 H55' : 'M65 99 H81', 1.2, OUT);
      pen.raw(
        `<rect x="${back ? 52 : 77}" y="97.4" width="2.4" height="4" rx="0.8" fill="${METAL}" stroke="${OUT}" stroke-width="0.6"/>`,
      );
      return;
    case 'szalik':
      pen.shaded(rr(42, 63, 36, 11, 5), trim, -2, -2);
      pen.line('M50 64 v9 M58 64 v9 M66 64 v9 M74 65 v7', 1, trim[1]);
      if (!back) {
        pen.shaded(rr(62, 70, 10, 26, 2.5), trim, -1, -1);
        pen.line('M62 80 h10 M62 88 h10', 1.4, WHITE_TRIM);
        pen.line('M64 96 v3 M67 96 v3 M70 96 v3', 1.2, trim[0]);
      }
      return;
  }
}

/** The pack on the back: over everything seen from behind. */
function packBack(pen: Pen, p: BudPalette) {
  pen.shaded(rr(41, 72, 38, 40, 9), p.cap, -3, -3);
  pen.shaded(rr(46, 92, 28, 16, 5), [p.cap[1], mix(p.cap[1], '#1b1430', 0.2)], -1, -1);
  pen.line('M49 97 H71', 1.2, OUT);
  pen.raw(
    `<rect x="68" y="95.4" width="2.4" height="4" rx="0.8" fill="${METAL}" stroke="${OUT}" stroke-width="0.6"/>`,
  );
  pen.line('M46 80 Q60 75 74 80', 1.2, p.cap[1]);
  pen.shaded(rr(53, 67, 14, 7, 3.4), [p.cap[1], p.cap[1]], 0, 0);
}

function torsoFront(pen: Pen, ctx: Ctx, back: boolean) {
  const { look, p } = ctx;
  const fem = look.gender === 'ona';
  const shape = fem ? TORSO_F : TORSO_M;
  const hemX = fem ? 39 : 37;
  const hemW = fem ? 42 : 46;
  const o = look.outfit;
  const vest = o === 'kamizelka';
  // a vest goes over a T-shirt in the accent colour
  pen.shaded(shape, vest ? p.cap : p.top, -6, -3);
  if (o === 'flanela') plaid(pen, shape, hemX - 2, hemX + hemW + 2, p.top);
  topPrint(pen, shape, ctx, back ? 'up' : 'down');
  // light on the shoulders
  pen.line(
    'M44 72 Q50 69 54 70 M66 70 Q70 69 76 72',
    1.6,
    mix(vest ? p.cap[0] : p.top[0], '#ffffff', 0.35),
  );
  // a ribbed band along the hem
  const ribbedHem = (h = 6, color = p.top[1]) => {
    pen.flat(rr(hemX, 114 - h, hemW, h, 3), color);
    pen.line(ribs(hemX + 1, hemX + hemW - 1, 114 - h + 1, 113.4), 0.7, mix(color, '#1b1430', 0.32));
  };
  const collarLight: Pair = [mix(p.top[0], '#ffffff', 0.15), p.top[1]];
  const shirtCollar = (dark = collarLight) => {
    pen.shaded('M50 66 L60 75 L56 79 L47 70Z', dark, -1, -1);
    pen.shaded('M70 66 L60 75 L64 79 L73 70Z', dark, -1, -1);
  };
  const buttons = (ys: number[], color = WHITE_TRIM, x = 61.8) =>
    pen.raw(
      ys
        .map(
          (y) =>
            `<circle cx="${x}" cy="${y}" r="1.25" fill="${color}" stroke="${OUT}" stroke-width="0.8"/>`,
        )
        .join(''),
    );
  switch (o) {
    case 'bluza':
      if (back) {
        // the hood hanging down the back, with its seam
        pen.shaded('M40 67 Q60 98 80 67 Q60 76 40 67Z', p.top, -2, -2);
        pen.line('M60 77 V85', 1, p.top[1]);
      } else {
        // the hood's opening, drawstrings with metal tips, a kangaroo pocket
        pen.shaded(
          'M42 68 Q60 84 78 68 Q72 60 60 60 Q48 60 42 68Z',
          [p.top[1], mix(p.top[1], '#1b1430', 0.2)],
          0,
          0,
        );
        pen.line('M46 68 Q60 80 74 68', 1, mix(p.top[0], '#ffffff', 0.3));
        pen.line('M55 75 V87 M65 75 V87', 1.5, WHITE_TRIM);
        pen.raw(
          `<rect x="53.9" y="86.4" width="2.2" height="3.2" rx="0.6" fill="${METAL}" stroke="${OUT}" stroke-width="0.5"/><rect x="63.9" y="86.4" width="2.2" height="3.2" rx="0.6" fill="${METAL}" stroke="${OUT}" stroke-width="0.5"/>`,
        );
        pen.shaded('M46 106 L49 93 H71 L74 106Z', p.top, -1, -2);
        pen.line('M49 93 H71', 1, p.top[1]);
      }
      ribbedHem();
      break;
    case 'tshirt':
      if (!back) {
        pen.line('M49 67 Q60 77 71 67', 2.6, p.top[1]);
        pen.line('M49 67 Q60 77 71 67', 1, OUT);
        pen.line('M46 93 Q52 96 58 94 M64 103 Q70 105 75 102', 1, p.top[1]);
      } else pen.line('M50 67 Q60 71 70 67', 1.4);
      stitches(pen, `M${hemX + 2} 111.5 H${hemX + hemW - 2}`, p.top[1], 0.8);
      break;
    case 'kurtka':
      // a bomber: ribbed collar and hem with accent stripes, a sleeve-pocket zip, slanted pockets
      if (!back) zip(pen, 60, 70, 112);
      pen.flat(rr(hemX, 105, hemW, 9, 3), p.top[1]);
      pen.line(
        `M${hemX + 1} 108 H${hemX + hemW - 1} M${hemX + 1} 111 H${hemX + hemW - 1}`,
        1.1,
        p.cap[0],
      );
      pen.shaded('M46 67 Q60 75 74 67 L72 62.5 Q60 69 48 62.5Z', p.cap, 0, -1);
      pen.line('M47.5 66 Q60 73 72.5 66', 0.9, WHITE_TRIM);
      if (!back) {
        pen.line('M46 90 L51 100 M74 90 L69 100', 1.6, OUT);
        pen.flat(rr(66, 78, 9, 2.6, 1), p.cap[0]);
      } else pen.line('M47 80 Q60 86 73 80', 1, p.top[1]);
      break;
    case 'jeansowka':
      // a denim jacket: yellow stitching, chest pockets with flaps, a yoke and metal buttons
      if (!back) {
        shirtCollar();
        pen.line('M60 76 V113', 1.3);
        stitches(pen, 'M58 78 V112 M62.6 78 V112');
        buttons([82, 91, 100, 109], METAL, 60);
        for (const x of [44, 66]) {
          pen.flat(rr(x, 84, 11, 10, 1.6), p.top[1]);
          pen.flat(`M${x - 0.6} 82 H${x + 11.6} V86 L${x + 5.5} 89 L${x - 0.6} 86Z`, p.top[0]);
          stitches(pen, `M${x + 1} 84.5 L${x + 5.5} 87.2 L${x + 10} 84.5`);
          pen.raw(
            `<circle cx="${x + 5.5}" cy="86" r="0.9" fill="${METAL}" stroke="${OUT}" stroke-width="0.5"/>`,
          );
        }
        stitches(pen, 'M40 78 H56 M64 78 H80');
      } else {
        pen.shaded('M48 67 Q60 72 72 67 L72 71 Q60 76 48 71Z', [p.top[1], p.top[1]], 0, 0);
        stitches(pen, 'M38 80 H82 M46 80 L44 106 M74 80 L76 106');
      }
      pen.flat(rr(hemX, 107, hemW, 7, 2), p.top[1]);
      stitches(pen, `M${hemX + 2} 108.6 H${hemX + hemW - 2}`);
      break;
    case 'puchowka':
      // a puffer: baffles across the body, each with a shadow and a bit of light, a stand-up collar
      for (const y of [78, 88, 98, 107]) {
        pen.line(`M${fem ? 38 : 36} ${y} Q60 ${y + 2.5} ${fem ? 82 : 84} ${y}`, 1.6, p.top[1]);
        pen.line(`M${fem ? 44 : 42} ${y - 4} q6 -2 12 -1`, 1.1, mix(p.top[0], '#ffffff', 0.32));
      }
      pen.shaded(
        'M45 68 Q60 77 75 68 L74 61 Q60 67 46 61Z',
        [mix(p.top[0], '#ffffff', 0.1), p.top[1]],
        -1,
        -1,
      );
      if (!back) {
        zip(pen, 60, 72, 113);
        pen.line('M47 95 L50 103 M73 95 L70 103', 1.5, OUT);
      }
      break;
    case 'dresowka':
      // a track jacket: stand-up collar, zip, two stripes off the shoulders and a clean hem
      pen.shaded('M47 67 Q60 75 73 67 L72 62.5 Q60 69 48 62.5Z', [p.top[1], p.top[1]], 0, 0);
      pen.line('M42 72 L48 112 M45 71 L51 112 M78 72 L72 112 M75 71 L69 112', 1.3, p.cap[0]);
      if (!back) {
        zip(pen, 60, 72, 112);
        pen.line('M50 96 L53 104 M70 96 L67 104', 1.3, OUT);
      }
      ribbedHem(5);
      break;
    case 'jersey':
      // a club shirt: V collar and side panels in the accent colour, a big number
      pen.clipped(shape, (c) => {
        c.raw(
          `<path d="M30 70 H41 L43 114 H30Z M90 70 H79 L77 114 H90Z" fill="${p.cap[0]}"/><path d="M41 70 L43 114 M79 70 L77 114" stroke="${OUT}" stroke-width="1" fill="none"/>`,
        );
      });
      if (!back) {
        pen.raw(
          `<path d="M49 66 L60 79 L71 66 L67 65 L60 73 L53 65Z" fill="${p.cap[0]}" stroke="${OUT}" stroke-width="1.2" stroke-linejoin="round"/>`,
        );
      } else pen.flat(rr(50, 65, 20, 4, 1.6), p.cap[0]);
      pen.raw(
        `<path transform="translate(0 ${back ? -2 : 3})" d="M52 83 H68 V88 L60 104 H53.5 L61 88.5 H52Z" fill="${back ? p.cap[0] : WHITE_TRIM}" stroke="${OUT}" stroke-width="1.1" stroke-linejoin="round"/>`,
      );
      break;
    case 'ogrodniczki':
      if (back) {
        pen.line('M47 70 L73 100 M73 70 L47 100', 3.4, p.pants[1]);
        pen.shaded(rr(45, 98, 30, 16, 4), p.pants, -2, -2);
        stitches(pen, 'M47 100 H73');
        pen.flat(rr(50, 103, 9, 8, 1.4), p.pants[1]);
      } else {
        // the striped T-shirt shows on top, straps with brass buckles, a stitched bib pocket
        pen.line('M49 67 Q60 76 71 67', 1.4);
        pen.shaded(rr(45, 80, 30, 34, 4), p.pants, -3, -2);
        stitches(pen, 'M47 82.5 H73 M47 82.5 V112 M73 82.5 V112');
        pen.line('M47 82 L42 68 M73 82 L78 68', 3.4, p.pants[1]);
        pen.raw(
          `<rect x="46.6" y="81.4" width="6.8" height="5.6" rx="1.2" fill="#ffc93c" stroke="${OUT}" stroke-width="1"/><rect x="66.6" y="81.4" width="6.8" height="5.6" rx="1.2" fill="#ffc93c" stroke="${OUT}" stroke-width="1"/>`,
        );
        pen.flat(rr(52, 91, 16, 11, 2), p.pants[1]);
        stitches(pen, 'M53.6 93 H66.4 M53.6 93 V100.4 M66.4 93 V100.4 M53.6 100.4 H66.4');
      }
      break;
    case 'koszula':
    case 'flanela':
      if (back) {
        pen.shaded('M48 67 Q60 72 72 67 L72 71 Q60 76 48 71Z', [p.top[1], p.top[1]], 0, 0);
        pen.line('M42 80 H78', 1, p.top[1]);
        pen.line('M60 80 V86', 1, p.top[1]);
        break;
      }
      // a collar, a placket with buttons and a chest pocket; the tail drops at the hem
      shirtCollar();
      pen.flat(rr(58, 76, 4, 37, 1), o === 'flanela' ? p.top[1] : mix(p.top[0], '#ffffff', 0.12));
      buttons([82, 91, 100, 109], o === 'flanela' ? '#3a3d4a' : WHITE_TRIM, 60);
      pen.flat(rr(65, 81, 10, 9, 1.5), o === 'flanela' ? p.top[0] : p.top[1]);
      pen.line('M65 84 H75', 1, OUT);
      break;
    case 'sweter':
      // ribbed collar and hem, a knitted band of diamonds across the chest
      pen.shaded(
        back ? rr(47, 65, 26, 6, 3) : 'M47 66 Q60 76 73 66 L73 71 Q60 81 47 71Z',
        [p.top[1], p.top[1]],
        0,
        0,
      );
      if (!back)
        pen.line(
          'M50 69 l0.8 3 M55 71 l0.5 3.2 M60 72 v3.4 M65 71 l-0.5 3.2 M70 69 l-0.8 3',
          0.8,
          mix(p.top[1], '#1b1430', 0.3),
        );
      pen.line('M40 84 H80 M40 96 H80', 1.2, p.cap[0]);
      pen.line(
        'M42 90 l3 -3.6 l3 3.6 l3 -3.6 l3 3.6 l3 -3.6 l3 3.6 l3 -3.6 l3 3.6 l3 -3.6 l3 3.6 l3 -3.6 l3 3.6',
        1.3,
        mix(p.top[0], '#ffffff', 0.45),
      );
      ribbedHem(8);
      break;
    case 'polo':
      if (back) {
        pen.shaded(rr(48, 64.5, 24, 6, 2), [p.top[1], p.top[1]], 0, 0);
        pen.line('M49 69 H71', 1, p.cap[0]);
        break;
      }
      // a collar with a tipped edge, a short placket, a small badge
      pen.shaded('M51 65 L60 72 L57 77 L47 69Z', [p.top[1], p.top[1]], 0, 0);
      pen.shaded('M69 65 L60 72 L63 77 L73 69Z', [p.top[1], p.top[1]], 0, 0);
      pen.line('M48.4 69.6 L56.6 75.8 M71.6 69.6 L63.4 75.8', 1.1, p.cap[0]);
      pen.flat(rr(58.4, 72, 3.4, 14, 0.8), p.top[1]);
      buttons([76, 82], WHITE_TRIM, 60.1);
      pen.raw(
        `<circle cx="71" cy="82" r="2" fill="${p.cap[0]}" stroke="${OUT}" stroke-width="0.8"/>`,
      );
      break;
    case 'kamizelka':
      // two quilted vest panels over the T-shirt, with a zip edge and pockets
      if (!back) pen.line('M51 67 Q60 75 69 67', 1.4);
      pen.shaded(
        fem
          ? 'M41 76 Q42 69 53 68 L58 112 H45 Q39 112 40 104 Q44 94 41 76Z'
          : 'M39 76 Q40 69 52 68 L58 112 H44 Q37 112 38 104Z',
        p.top,
        -3,
        -2,
      );
      pen.shaded(
        fem
          ? 'M79 76 Q78 69 67 68 L62 112 H75 Q81 112 80 104 Q76 94 79 76Z'
          : 'M81 76 Q80 69 68 68 L62 112 H76 Q83 112 82 104Z',
        p.top,
        -3,
        -2,
      );
      pen.line(
        'M40 82 L55 84 M40 92 L56 94 M40 102 L57 104 M80 82 L65 84 M80 92 L64 94 M80 102 L63 104',
        1.1,
        p.top[1],
      );
      if (!back) {
        pen.flat(rr(44, 96, 9, 6, 1.5), p.top[1]);
        pen.flat(rr(67, 96, 9, 6, 1.5), p.top[1]);
      }
      break;
    case 'sukienka':
      // a fitted bodice with a neckline and a belt with a buckle; the skirt is drawn with the legs
      if (!back) {
        pen.line('M49 67 Q60 78 71 67', 1.6);
        pen.line('M50 69 Q60 79 70 69', 0.9, p.cap[0]);
      }
      pen.flat(rr(hemX + 1, 100, hemW - 2, 5, 2), p.top[1]);
      pen.line(`M${hemX + 1} 102.5 H${hemX + hemW - 1}`, 0.8, p.cap[0]);
      if (!back)
        pen.raw(
          `<rect x="56.6" y="99.2" width="6.8" height="6.6" rx="1.2" fill="#ffc93c" stroke="${OUT}" stroke-width="1"/><rect x="58.8" y="101" width="2.4" height="3" fill="${p.top[1]}"/>`,
        );
      break;
  }
  if (look.accessory !== 'plecak' || !back) accessoryFront(pen, ctx, back);
}

function torsoSide(pen: Pen, ctx: Ctx) {
  const { look, p } = ctx;
  const o = look.outfit;
  const vest = o === 'kamizelka';
  pen.shaded(TORSO_SIDE, vest ? p.cap : p.top, -5, -3);
  if (o === 'flanela') plaid(pen, TORSO_SIDE, 44, 76, p.top);
  topPrint(pen, TORSO_SIDE, ctx, 'side');
  const ribbedHem = (h = 6, color = p.top[1]) => {
    pen.flat(rr(45, 114 - h, 30, h, 3), color);
    pen.line(ribs(46, 74, 114 - h + 1, 113.4), 0.7, mix(color, '#1b1430', 0.32));
  };
  switch (o) {
    case 'bluza':
      pen.shaded('M64 66 Q84 62 80 84 Q73 75 64 76Z', p.top, -2, -2);
      pen.line('M66 70 Q74 72 77 80', 1, p.top[1]);
      pen.line('M50 72 V84', 1.4, WHITE_TRIM);
      pen.shaded('M45 106 L47 94 H63 L65 106Z', p.top, -1, -2);
      ribbedHem();
      break;
    case 'tshirt':
      pen.line('M50 67 Q54 72 60 69', 1.4);
      stitches(pen, 'M46 111.5 H74', p.top[1], 0.8);
      break;
    case 'kurtka':
      pen.flat(rr(45, 105, 30, 9, 3), p.top[1]);
      pen.line('M46 108 H74 M46 111 H74', 1.1, p.cap[0]);
      pen.shaded('M49 67 Q58 73 67 67 L65 63 Q58 68 51 63Z', p.cap, 0, -1);
      pen.line('M47 72 V104', 1.6);
      pen.line('M52 92 L56 101', 1.5);
      break;
    case 'jeansowka':
      pen.shaded(
        'M48 66 L56 72 L52 76 L45 70Z',
        [mix(p.top[0], '#ffffff', 0.15), p.top[1]],
        -1,
        -1,
      );
      pen.line('M47.5 76 V112', 1.2);
      stitches(pen, 'M49.5 78 V112');
      pen.flat(rr(52, 82, 11, 10, 1.6), p.top[1]);
      stitches(pen, 'M53 85 L57.5 87.6 L62 85');
      pen.flat(rr(45, 107, 30, 7, 2), p.top[1]);
      break;
    case 'puchowka':
      for (const y of [78, 88, 98, 107]) {
        pen.line(`M45 ${y} Q60 ${y + 2.5} 75 ${y}`, 1.6, p.top[1]);
        pen.line(`M49 ${y - 4} q6 -2 11 -1`, 1.1, mix(p.top[0], '#ffffff', 0.32));
      }
      pen.shaded(
        'M47 68 Q58 75 69 68 L68 61 Q58 66 48 61Z',
        [mix(p.top[0], '#ffffff', 0.1), p.top[1]],
        -1,
        -1,
      );
      break;
    case 'dresowka':
      pen.shaded('M49 67 Q58 73 67 67 L65 63 Q58 68 51 63Z', [p.top[1], p.top[1]], 0, 0);
      pen.line('M47.5 72 V108', 1.6);
      pen.line('M54 70 L55 108 M57 70 L58 108', 1.3, p.cap[0]);
      ribbedHem(5);
      break;
    case 'jersey':
      pen.clipped(TORSO_SIDE, (c) => {
        c.raw(
          `<path d="M64 66 H80 V116 H66Z" fill="${p.cap[0]}"/><path d="M64 66 L66 116" stroke="${OUT}" stroke-width="1" fill="none"/>`,
        );
      });
      pen.line('M49 67 L55 74', 2.4, p.cap[0]);
      pen.raw(
        `<path d="M49 86 H60 V90 L54.5 102 H50 L55 90 H49Z" fill="${WHITE_TRIM}" stroke="${OUT}" stroke-width="1" stroke-linejoin="round"/>`,
      );
      break;
    case 'ogrodniczki':
      pen.shaded(rr(46, 80, 22, 34, 4), p.pants, -3, -2);
      stitches(pen, 'M48 83 H66');
      pen.line('M50 82 L50 68', 3.4, p.pants[1]);
      pen.raw(
        `<rect x="46.8" y="81" width="6.6" height="5.4" rx="1.2" fill="#ffc93c" stroke="${OUT}" stroke-width="1"/>`,
      );
      pen.flat(rr(50, 92, 13, 10, 2), p.pants[1]);
      break;
    case 'koszula':
    case 'flanela':
      pen.shaded(
        'M48 66 L56 72 L52 76 L45 70Z',
        [mix(p.top[0], '#ffffff', 0.15), p.top[1]],
        -1,
        -1,
      );
      pen.flat(
        rr(46.5, 76, 3.4, 37, 1),
        o === 'flanela' ? p.top[1] : mix(p.top[0], '#ffffff', 0.12),
      );
      pen.flat(rr(53, 82, 9, 8, 1.5), o === 'flanela' ? p.top[0] : p.top[1]);
      break;
    case 'sweter':
      pen.shaded('M48 67 Q56 74 66 67 L66 71 Q56 78 48 71Z', [p.top[1], p.top[1]], 0, 0);
      pen.line('M46 84 H74 M46 96 H74', 1.2, p.cap[0]);
      pen.line(
        'M46 90 l3 -3.6 l3 3.6 l3 -3.6 l3 3.6 l3 -3.6 l3 3.6 l3 -3.6 l3 3.6',
        1.3,
        mix(p.top[0], '#ffffff', 0.45),
      );
      ribbedHem(8);
      break;
    case 'polo':
      pen.shaded('M49 66 L57 71 L54 76 L46 69Z', [p.top[1], p.top[1]], 0, 0);
      pen.line('M47.2 69.6 L54 75', 1.1, p.cap[0]);
      pen.raw(
        `<circle cx="52" cy="82" r="1.8" fill="${p.cap[0]}" stroke="${OUT}" stroke-width="0.8"/>`,
      );
      break;
    case 'kamizelka':
      pen.shaded('M45 76 Q46 69 56 68 L62 112 H51 Q44 112 45 104Z', p.top, -3, -2);
      pen.line('M45 84 L58 86 M45 94 L59 96 M45 104 L60 106', 1.1, p.top[1]);
      break;
    case 'sukienka':
      pen.flat(rr(45, 100, 30, 5, 2), p.top[1]);
      pen.line('M45 102.5 H75', 0.8, p.cap[0]);
      pen.line('M49 68 Q53 74 60 70', 1.4);
      break;
  }
  // worn on the side: a chain's edge, a strap, a scarf
  switch (look.accessory) {
    case 'lancuch':
      pen.raw(
        `<path d="M50 68 Q49 80 55 84" fill="none" stroke="${OUT}" stroke-width="2.4"/><path d="M50 68 Q49 80 55 84" fill="none" stroke="#ffc93c" stroke-width="1.4" stroke-dasharray="1.8 0.9"/>`,
      );
      break;
    case 'plecak':
      pen.flat('M53 68 Q51 84 54 102 L59 102 Q56 84 58 68Z', p.cap[0]);
      break;
    case 'nerka':
      pen.raw(
        `<path d="M60 68 L48 102" stroke="${OUT}" stroke-width="5" stroke-linecap="round"/><path d="M60 68 L48 102" stroke="${p.cap[1]}" stroke-width="3"/>`,
      );
      pen.shaded(rr(40, 94, 16, 13, 5), p.cap, -2, -2);
      break;
    case 'szalik':
      pen.shaded(rr(46, 63, 26, 11, 5), p.cap, -2, -2);
      pen.line('M53 64 v9 M60 64 v9 M67 64 v9', 1, p.cap[1]);
      pen.shaded(rr(47, 70, 9, 22, 2.5), p.cap, -1, -1);
      pen.line('M47 80 h9', 1.4, WHITE_TRIM);
      break;
  }
}

function head(pen: Pen, ctx: Ctx, facing: Facing) {
  const { look, p } = ctx;
  backHair(pen, look.hair, p.hair, facing);
  if (facing === 'side') {
    pen.shaded(circ(58, 40, 26), p.skin, -5, -5);
    frontHair(pen, look.hair, p, facing);
    if (look.hair !== 'czapka' && look.hair !== 'sluchawki') {
      pen.shaded(circ(70, 43, 5), p.skin, -1, -1).line('M69 41 Q72 43 69 45', 1.2, p.skin[1]);
    }
    sideFace(pen, look, p);
    pen.raw(
      '<path d="M38 26 Q42 18 50 16" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity="0.42"/>',
    );
    return;
  }
  pen.shaded(circ(34, 42, 5), p.skin, -1, -1).shaded(circ(86, 42, 5), p.skin, -1, -1);
  if (facing === 'down') {
    pen.line('M32.6 41 Q35 43 33.4 45 M87.4 41 Q85 43 86.6 45', 1, p.skin[1]);
  }
  pen.shaded(circ(60, 40, 26), p.skin, -5, -5);
  if (facing === 'down') {
    face(pen, look, p);
    if (look.mood === 'tajemniczy' && !['czapka', 'daszek', 'buzz', 'irokez'].includes(look.hair)) {
      // a lock of hair over one eye
      pen.shaded('M40 30 Q54 30 56 50 Q50 44 42 46 Q44 38 40 30Z', p.hair, -2, -2);
    }
  }
  frontHair(pen, look.hair, p, facing);
  // a soft bar of light on the top of the head, whatever covers it
  const hy = look.hair === 'czapka' ? 16 : look.hair === 'daszek' ? 18 : 20;
  pen.raw(
    `<path d="M40 ${hy + 6} Q44 ${hy - 1} 53 ${hy - 3}" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity="0.42"/>`,
  );
}

/** Inner SVG markup (no <svg> wrapper) for one frame in a VIEW_W × VIEW_H box. */
export function budFrameMarkup(
  look: BudLook,
  facing: Facing = 'down',
  frame: WalkFrame = 0,
): string {
  const ctx: Ctx = { look, p: budPalette(look), frame };
  const pen = new Pen();
  const bob = frame === 0 ? 0 : -2;

  if (facing === 'side') {
    pen.group(widen(BULK_SIDE), (legs) => legsSide(legs, ctx));
    const swing = frame === 1 ? 22 : frame === 2 ? -22 : 0;
    pen.group(`translate(0 ${bob + BODY_DROP})`, (up) => {
      // far arm behind the body, swinging opposite
      up.group(widen(BULK_SIDE), (b) =>
        b.group(`rotate(${-swing} 60 74)`, (a) => {
          const dark: Ctx = {
            ...ctx,
            p: {
              ...ctx.p,
              top: [ctx.p.top[1], ctx.p.top[1]],
              skin: [ctx.p.skin[1], ctx.p.skin[1]],
            },
          };
          arm(a, 60, 61, 107, dark);
        }),
      );
      // a pack sits behind the back, which is on the right in a side view
      if (look.accessory === 'plecak')
        up.group(widen(BULK_SIDE), (b) => {
          b.shaded(rr(70, 72, 15, 34, 6), ctx.p.cap, -2, -2);
          b.line('M73 90 H85', 1.1, OUT);
        });
      up.group(widen(BULK_SIDE), (b) => torsoSide(b, ctx));
      head(up, ctx, 'side');
      up.group(widen(BULK_SIDE), (b) =>
        b.group(`rotate(${swing} 60 74)`, (a) => arm(a, 60, 61, 107, ctx)),
      );
    });
  } else {
    pen.group(widen(BULK), (legs) => legsFront(legs, ctx));
    const leftHand = frame === 1 ? 102 : frame === 2 ? 110 : 107;
    const rightHand = frame === 2 ? 102 : frame === 1 ? 110 : 107;
    const leftX = frame === 2 ? 36.5 : 35;
    const rightX = frame === 1 ? 83.5 : 85;
    pen.group(`translate(0 ${bob + BODY_DROP})`, (up) => {
      up.group(widen(BULK), (b) => {
        torsoFront(b, ctx, facing === 'up');
        arm(b, 40.5, leftX, leftHand, ctx);
        arm(b, 79.5, rightX, rightHand, ctx);
        // soft shadow the head casts on the collar
        if (facing === 'down')
          b.raw(`<ellipse cx="60" cy="69" rx="13" ry="3.5" fill="${ctx.p.top[1]}" opacity="0.8"/>`);
        if (facing === 'up' && look.accessory === 'plecak') packBack(b, ctx.p);
      });
      head(up, ctx, facing);
    });
  }

  const body = `<ellipse cx="60" cy="151" rx="33" ry="6" fill="${OUT}" opacity="0.22"/>${pen}`;
  const prefix = `b${hash(body)}-`;
  return `<g transform="${PLACE}">${body.replace(/@@/g, prefix)}</g>`;
}

/** Standalone SVG for one frame. `flip` mirrors a side view to face right. */
export function budSvg(
  look: BudLook,
  opts: {
    facing?: Facing;
    frame?: WalkFrame;
    width?: number;
    flip?: boolean;
    viewBox?: string;
  } = {},
): string {
  const {
    facing = 'down',
    frame = 0,
    width = VIEW_W,
    flip = false,
    viewBox = `0 0 ${VIEW_W} ${VIEW_H}`,
  } = opts;
  const [, , vw, vh] = viewBox.split(' ').map(Number);
  const height = (width * (vh ?? VIEW_H)) / (vw ?? VIEW_W);
  const body = budFrameMarkup(look, facing, frame);
  const inner = flip ? `<g transform="translate(${VIEW_W} 0) scale(-1 1)">${body}</g>` : body;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${+height.toFixed(2)}" viewBox="${viewBox}">${inner}</svg>`;
}

/**
 * Sprite sheet for the game: columns = walk frames 0..2, rows = down, side (faces left), up.
 * Each cell is VIEW_W × VIEW_H logical units, rendered at `cellWidth` px.
 */
export function budSheetSvg(look: BudLook, cellWidth = 128): string {
  const s = cellWidth / VIEW_W;
  const cells = FACINGS.flatMap((facing, row) =>
    ([0, 1, 2] as const).map(
      (frame) =>
        `<g transform="translate(${frame * cellWidth} ${row * VIEW_H * s}) scale(${s})">${budFrameMarkup(look, facing, frame)}</g>`,
    ),
  ).join('');
  const w = cellWidth * 3;
  const h = VIEW_H * s * 3;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${cells}</svg>`;
}
