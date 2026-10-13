import { HAIR_COLORS, OUTFIT_COLORS, PANTS_COLORS, SKINS, type HairStyle } from './constants';
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
const BODY_DROP = 6;
const HIP_Y = 106 + BODY_DROP;

export const FACINGS = ['down', 'side', 'up'] as const;
/** `side` faces left; mirror it for right. */
export type Facing = (typeof FACINGS)[number];
/** 0 = standing, 1 and 2 = alternating steps. Walk cycle: 1, 0, 2, 0. */
export type WalkFrame = 0 | 1 | 2;

const OUT = '#121218';
type Pair = [base: string, shade: string];

// skin shades matched to SKINS (hand-picked like the design sheet, not a flat darken)
const SKIN_SHADES = ['#dcae8e', '#d49e78', '#a46a42', '#7f5034', '#663c22', '#4f2c18'] as const;

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
  const cap = OUTFIT_COLORS[(look.outfitColor + 3) % OUTFIT_COLORS.length] ?? OUTFIT_COLORS[3];
  const lightTop = top === '#f6f2e9';
  return {
    skin: [skin, SKIN_SHADES[look.skin] ?? shade(skin)],
    hair: [hair, shade(hair, 0.4)],
    top: [top, shade(top)],
    pants: [pants, shade(pants)],
    shoes: lightTop ? ['#3a3d4a', '#262833'] : ['#f6f2e9', '#cfc6b4'],
    sole: top === '#a3e635' ? '#ff3d50' : '#a3e635',
    soleTone: lightTop ? ['#f6f2e9', '#cfc6b4'] : ['#e4dccb', '#b9ae99'],
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
const TORSO_M = 'M37 84 Q37 69 52 67 H68 Q83 69 83 84 L84 106 Q84 114 76 114 H44 Q36 114 36 106Z';
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

  if (facing === 'up') {
    // the back of the head is all hair
    pen.shaded('M33 42 Q31 12 60 12 Q89 12 87 42 Q86 60 70 64 H50 Q34 60 33 42Z', p.hair, -4, -4);
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
    return headwear(pen, style, p, facing);
  }

  pen.shaded(HAIR_FRONT[style] ?? HAIR_FRONT.krotkie!, p.hair, -3, -3);
  return headwear(pen, style, p, facing);
}

// ---------- faces ----------

const eye = (x: number, y = 44.5, ry = 5.4) =>
  `<ellipse cx="${x}" cy="${y}" rx="3.9" ry="${ry}" fill="${OUT}"/>` +
  `<circle cx="${x - 1.2}" cy="${r2(y - ry * 0.42)}" r="1.7" fill="#fff"/>` +
  `<circle cx="${x + 1.3}" cy="${r2(y + ry * 0.4)}" r="0.8" fill="#fff" opacity="0.8"/>`;

function face(pen: Pen, look: BudLook, p: BudPalette) {
  const fem = look.gender === 'ona';
  const mouthColor = fem ? p.lips : OUT;
  const blush = (op: number, rx = 3.6) =>
    `<ellipse cx="44" cy="51" rx="${rx}" ry="2" fill="#ff8f8f" opacity="${op}"/><ellipse cx="76" cy="51" rx="${rx}" ry="2" fill="#ff8f8f" opacity="${op}"/>`;
  let open = true;
  switch (look.mood) {
    case 'radosny':
      pen.raw(eye(51) + eye(69));
      pen.line('M46 36.5 Q51 34 55.5 36 M64.5 36 Q69 34 74 36.5', 2.2);
      pen.raw(
        `<path d="M54 53 Q60 61.5 66 53 Z" fill="#7a2a2a" stroke="${OUT}" stroke-width="1.6" stroke-linejoin="round"/>`,
      );
      pen.raw(blush(0.5));
      break;
    case 'wyluzowany':
      open = false;
      pen.raw(
        `<ellipse cx="51" cy="45.5" rx="3.4" ry="2.8" fill="${OUT}"/><ellipse cx="69" cy="45.5" rx="3.4" ry="2.8" fill="${OUT}"/>`,
      );
      pen
        .line('M47 42.6 H55.5 M64.5 42.6 H73', 2.4)
        .line('M46 37 Q51 36 55.5 37 M64.5 37 Q69 36 74 37', 2.2);
      pen.line('M55 55 Q61 56.5 66 52.5', 2, mouthColor);
      pen.raw(blush(0.3));
      break;
    case 'zadziorny':
      pen.raw(eye(51) + eye(69));
      pen.line('M45.5 34.5 L55.5 38.5 M64.5 38.5 L74.5 34.5', 2.8);
      pen.line('M54 54 Q60 58.5 66 53', 2, mouthColor);
      pen.raw(
        `<rect x="60.5" y="54.6" width="3" height="2.6" rx="0.6" fill="#fff" stroke="${OUT}" stroke-width="1"/>`,
      );
      pen.raw(blush(0.3));
      break;
    case 'niesmialy':
      pen.raw(eye(51, 45.5, 4) + eye(69, 45.5, 4));
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
      pen.raw(blush(0.3));
      break;
    case 'tajemniczy':
      pen.raw(eye(51, 44.5, 3) + eye(69, 44.5, 3));
      pen.line('M46 35 Q51 32.5 55.5 35.5 M64.5 37.5 H74', 2.2);
      pen.line('M56 55 H64', 2, mouthColor);
      break;
  }
  if (fem && open)
    pen.line('M48 40.6 l-2.8 -1.8 M47.6 43 l-3 -0.6 M72 40.6 l2.8 -1.8 M72.4 43 l3 -0.6', 1.6);
}

function sideFace(pen: Pen, look: BudLook, p: BudPalette) {
  const fem = look.gender === 'ona';
  const mouthColor = fem ? p.lips : OUT;
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
      pen.raw(`<ellipse cx="46" cy="45.5" rx="3" ry="2.8" fill="${OUT}"/>`);
      pen.line('M42 42.6 H50', 2.4).line('M38.5 55 Q42 56 45.5 53', 2, mouthColor);
      break;
    case 'zadziorny':
      pen.raw(
        `<ellipse cx="46" cy="44" rx="3" ry="4.6" fill="${OUT}"/><circle cx="45" cy="42.2" r="1.3" fill="#fff"/>`,
      );
      pen.line('M40.5 34.5 L50.5 38.5', 2.8).line('M38.5 55 Q42 57.5 46 54', 2, mouthColor);
      break;
    case 'tajemniczy':
      pen.raw(`<ellipse cx="46" cy="44.5" rx="3" ry="3" fill="${OUT}"/>`);
      pen.line('M41 35 Q46 32.5 50.5 35.5', 2.2).line('M39 55 H44.5', 2, mouthColor);
      break;
    case 'niesmialy':
      pen.raw(
        `<ellipse cx="46" cy="45.5" rx="3" ry="4" fill="${OUT}"/><circle cx="45" cy="43.8" r="1.3" fill="#fff"/>`,
      );
      pen.line('M41 36 Q46 38 50.5 35.5', 2.2).line('M39 55.5 q1.6 -1.5 3.2 0', 1.8, mouthColor);
      pen.raw('<ellipse cx="51" cy="51" rx="5" ry="2.2" fill="#ff8f8f" opacity="0.75"/>');
      break;
    default:
      pen.raw(
        `<ellipse cx="46" cy="44" rx="3" ry="4.6" fill="${OUT}"/><circle cx="45" cy="42.2" r="1.3" fill="#fff"/>`,
      );
      pen.line('M41 36 Q46 34 50.5 36', 2.2);
      pen.raw(
        `<path d="M38 53 Q42 59 47 53.5 Z" fill="#7a2a2a" stroke="${OUT}" stroke-width="1.5" stroke-linejoin="round"/>`,
      );
  }
  if (look.mood !== 'niesmialy')
    pen.raw('<ellipse cx="51" cy="51" rx="3.4" ry="1.9" fill="#ff8f8f" opacity="0.35"/>');
  if (fem && open) pen.line('M43 40.6 l-2.6 -1.8 M42.6 43 l-2.8 -0.6', 1.6);
  pen.line('M33.6 44.5 Q31 47.5 34 49', 1.6); // nose
}

// ---------- body ----------

type Ctx = { look: BudLook; p: BudPalette; frame: WalkFrame };

/** Chunky sneaker: rounded upper with a stripe and a thick sole. `toe` -1 points left (side view). */
function shoe(pen: Pen, x: number, ground: number, p: BudPalette, toe: 0 | -1) {
  const g = ground;
  const upper =
    toe === 0
      ? `M${x - 10.5} ${g - 3}Q${x - 11.5} ${g - 13} ${x - 3} ${g - 13.5}H${x + 3}Q${x + 11.5} ${g - 13} ${x + 10.5} ${g - 3}Z`
      : `M${x + 7} ${g - 3}V${g - 10}Q${x + 7} ${g - 14} ${x + 1} ${g - 14}Q${x - 9} ${g - 13} ${x - 13} ${g - 3}Z`;
  pen.shaded(upper, p.shoes, -2, -2);
  pen.line(
    toe === 0
      ? `M${x - 6} ${g - 7.5}Q${x} ${g - 4.5} ${x + 6} ${g - 7.5}`
      : `M${x - 7} ${g - 6.5}Q${x - 1} ${g - 9} ${x + 4} ${g - 7}`,
    2,
    p.sole,
  );
  pen.shaded(
    toe === 0 ? rr(x - 12, g - 5, 24, 6.5, 3) : rr(x - 14, g - 5, 23, 6.5, 3),
    p.soleTone,
    -1,
    -1,
  );
}

function legsFront(pen: Pen, { p, frame }: Ctx) {
  for (const [x, lifted, foot] of [
    [50, frame === 1, 47],
    [70, frame === 2, 73],
  ] as const) {
    const ground = lifted ? 145 : 150;
    // a little taper from the hip to the ankle; feet turn slightly outwards
    pen.shaded(limb(x, HIP_Y, 7.5, foot, ground - 12, 5.5), p.pants, -2, -2);
    shoe(pen, foot, ground, p, 0);
  }
}

function legsSide(pen: Pen, { p, frame }: Ctx) {
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
    const pants: Pair = i === 0 ? [p.pants[1], p.pants[1]] : p.pants;
    pen.shaded(limb(60 + (x - 60) * 0.5, HIP_Y, 7.5, x, ground - 12, 5.5), pants, -2, -2);
    shoe(pen, x, ground, i === 0 ? { ...p, shoes: [p.shoes[1], p.shoes[1]] } : p, -1);
  });
}

/** Arm hanging from the shoulder at (sx, 76) to a rounded hand at (hx, hy). */
function arm(pen: Pen, sx: number, hx: number, hy: number, { look, p }: Ctx) {
  const wx = sx + (hx - sx) * 0.85;
  const wy = hy - 6;
  if (look.outfit === 'tshirt') {
    const ex = sx + (hx - sx) * 0.35;
    pen.shaded(limb(ex, 84, 5.5, wx, wy, 5), p.skin, -2, -2);
    pen.shaded(limb(sx, 76, 8, ex, 87, 7), p.top, -2, -2);
  } else {
    pen.shaded(limb(sx, 76, 7.5, wx, wy, 6), p.top, -2, -2);
    if (look.outfit === 'bluza' || look.outfit === 'kurtka')
      pen.flat(limb(sx + (wx - sx) * 0.88, wy - 3, 6.3, wx, wy, 6.3), p.top[1]); // ribbed cuff
  }
  pen.shaded(circ(hx, hy, 6.5), p.skin, -2, -2);
}

function torsoFront(pen: Pen, ctx: Ctx, back: boolean) {
  const { look, p } = ctx;
  const fem = look.gender === 'ona';
  pen.shaded(fem ? TORSO_F : TORSO_M, p.top, -6, -3);
  switch (look.outfit) {
    case 'bluza':
      if (back) {
        pen.shaded('M42 68 Q60 96 78 68 Q60 76 42 68Z', [p.top[1], p.top[1]], 0, 0);
      } else {
        pen.shaded('M44 68 Q60 82 76 68 Q71 62 60 62 Q49 62 44 68Z', [p.top[1], p.top[1]], 0, 0);
        pen.shaded(rr(47, 92, 26, 13, 5), p.top, -1, -2);
        pen.line('M55 72 V84 M65 72 V84', 1.6);
      }
      break;
    case 'tshirt':
      if (!back) pen.line('M50 68 Q60 76 70 68', 1.6);
      break;
    case 'kurtka':
      if (!back) pen.line('M60 70 V112', 1.6);
      pen.shaded(rr(fem ? 39 : 37, 106, fem ? 42 : 46, 8, 3), [p.top[1], p.top[1]], 0, 0);
      pen.shaded('M48 67 Q60 74 72 67 L70 64 Q60 69 50 64Z', p.cap, 0, -1);
      break;
    case 'ogrodniczki':
      if (back) {
        pen.line('M47 70 L73 100 M73 70 L47 100', 3, p.pants[1]);
        pen.shaded(rr(45, 98, 30, 16, 4), p.pants, -2, -2);
      } else {
        pen.shaded(rr(45, 80, 30, 34, 4), p.pants, -3, -2);
        pen.line('M47 82 L42 68 M73 82 L78 68', 3, p.pants[1]);
        pen.raw(
          `<circle cx="50" cy="85" r="2" fill="#ffc93c" stroke="${OUT}" stroke-width="1.2"/><circle cx="70" cy="85" r="2" fill="#ffc93c" stroke="${OUT}" stroke-width="1.2"/>`,
        );
        pen.shaded(rr(52, 92, 16, 9, 2), p.pants, 0, -1);
      }
      break;
  }
}

function torsoSide(pen: Pen, { look, p }: Ctx) {
  pen.shaded(TORSO_SIDE, p.top, -5, -3);
  switch (look.outfit) {
    case 'bluza':
      pen.shaded('M66 66 Q82 64 79 82 Q73 75 66 75Z', [p.top[1], p.top[1]], 0, 0);
      break;
    case 'kurtka':
      pen.shaded(rr(45, 106, 30, 8, 3), [p.top[1], p.top[1]], 0, 0);
      pen.shaded('M50 67 Q58 72 66 67 L64 64 Q58 68 52 64Z', p.cap, 0, -1);
      break;
    case 'ogrodniczki':
      pen.shaded(rr(46, 80, 22, 34, 4), p.pants, -3, -2);
      pen.line('M50 82 L50 68', 3, p.pants[1]);
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
      '<ellipse cx="44" cy="20" rx="6" ry="3.4" fill="#fff" opacity="0.5" transform="rotate(-25 44 18)"/>',
    );
    return;
  }
  pen.shaded(circ(34, 42, 5), p.skin, -1, -1).shaded(circ(86, 42, 5), p.skin, -1, -1);
  pen.shaded(circ(60, 40, 26), p.skin, -5, -5);
  if (facing === 'down') {
    face(pen, look, p);
    if (look.mood === 'tajemniczy' && !['czapka', 'daszek'].includes(look.hair)) {
      // a lock of hair over one eye
      pen.shaded('M40 30 Q54 30 56 50 Q50 44 42 46 Q44 38 40 30Z', p.hair, -2, -2);
    }
  }
  frontHair(pen, look.hair, p, facing);
  const hy = look.hair === 'czapka' ? 16 : look.hair === 'daszek' ? 18 : 20;
  pen.raw(
    `<ellipse cx="46" cy="${hy}" rx="6" ry="3.4" fill="#fff" opacity="0.5" transform="rotate(-25 46 18)"/>`,
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
  const bob = frame === 0 ? 0 : -1.5;

  if (facing === 'side') {
    legsSide(pen, ctx);
    const swing = frame === 1 ? 22 : frame === 2 ? -22 : 0;
    pen.group(`translate(0 ${bob + BODY_DROP})`, (up) => {
      // far arm behind the body, swinging opposite
      up.group(`rotate(${-swing} 60 74)`, (a) => {
        const dark: Ctx = {
          ...ctx,
          p: { ...ctx.p, top: [ctx.p.top[1], ctx.p.top[1]], skin: [ctx.p.skin[1], ctx.p.skin[1]] },
        };
        arm(a, 60, 61, 107, dark);
      });
      torsoSide(up, ctx);
      head(up, ctx, 'side');
      up.group(`rotate(${swing} 60 74)`, (a) => arm(a, 60, 61, 107, ctx));
    });
  } else {
    legsFront(pen, ctx);
    const leftHand = frame === 1 ? 103 : frame === 2 ? 109 : 107;
    const rightHand = frame === 2 ? 103 : frame === 1 ? 109 : 107;
    pen.group(`translate(0 ${bob + BODY_DROP})`, (up) => {
      torsoFront(up, ctx, facing === 'up');
      arm(up, 40, 33, leftHand, ctx);
      arm(up, 80, 87, rightHand, ctx);
      // soft shadow the head casts on the collar
      if (facing === 'down')
        up.raw(`<ellipse cx="60" cy="69" rx="13" ry="3.5" fill="${ctx.p.top[1]}" opacity="0.8"/>`);
      head(up, ctx, facing);
    });
  }

  const body = `<ellipse cx="60" cy="151" rx="28" ry="5" fill="${OUT}" opacity="0.22"/>${pen}`;
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
