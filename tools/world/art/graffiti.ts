// Graffiti walls painted like real street murals, without words: a concrete or brick wall with buffed-out patches,
// rain streaks and grime, and on it one motif per wall: a mandala, a cartoon character, a sunset over the sea, an
// abstract wildstyle of arrows and shards, a big dripping eye, or a wall bombed with tags and throw-up bubbles.
// Every motif is sprayed: a soft mist of paint around it, a black outline, highlights and drips. Small tags and
// sparkles go round the edges. Deterministic per seed, so every export draws the same walls.
import {
  LINE,
  T,
  bricks,
  fill,
  frame,
  n,
  rng,
  rr,
  shaded,
  shadow,
  stroke,
  type Prop,
  type Tone,
} from './kit';

const INK = '#14141a';

let uid = 0;

type Paint = { a: string; b: string; c: string };
type Box = { x0: number; y0: number; x1: number; y1: number };

/** The can's soft mist around a shape (an overspray halo), drawn under it. */
function mist(shape: string, color: string, spread: number): string {
  const id = `gm${uid++}`;
  return (
    `<filter id="${id}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${n(spread)}"/></filter>` +
    `<g filter="url(#${id})" opacity="0.5" fill="${color}">${shape}</g>`
  );
}

/** A drip of paint running down from (x, y), thicker at its drop. */
function drip(x: number, y: number, len: number, color: string, w = 2.4): string {
  return (
    stroke(`M${n(x)} ${n(y)}v${n(len)}`, INK, w + 1.6, 0.8) +
    stroke(`M${n(x)} ${n(y)}v${n(len)}`, color, w) +
    `<ellipse cx="${n(x)}" cy="${n(y + len)}" rx="${n(w * 0.75)}" ry="${n(w)}" fill="${color}" stroke="${INK}" stroke-width="1"/>`
  );
}

/** A cursive-looking tag: a quick scribble of loops with a flourish under it. */
function tag(x: number, y: number, w: number, color: string, r: () => number): string {
  let d = `M${n(x)} ${n(y)}`;
  const parts = 4 + Math.floor(r() * 3);
  for (let i = 0; i < parts; i++) {
    const step = w / parts;
    const up = 6 + r() * 8;
    d += `c${n(step * 0.2)} ${n(-up)} ${n(step * 0.7)} ${n(-up * 1.1)} ${n(step * 0.5)} ${n(-up * 0.2)}`;
    d += `s${n(-step * 0.5)} ${n(up * 0.9)} ${n(step * 0.5)} ${n(up * 0.4 + (r() - 0.5) * 3)}`;
  }
  d += `M${n(x - 2)} ${n(y + 5)}q${n(w * 0.5)} ${n(4 + r() * 3)} ${n(w + 6)} ${n(-3)}`;
  return (
    stroke(d, color, 2.2, 0.92) +
    (r() > 0.5 ? stroke(`M${n(x + w * 0.3)} ${n(y + 2)}v${n(5 + r() * 7)}`, color, 1.6, 0.8) : '')
  );
}

/** A small four-pointed sparkle. */
function sparkle(cx: number, cy: number, rad: number, color = '#ffffff'): string {
  const k = rad * 0.28;
  return `<path d="M${n(cx)} ${n(cy - rad)}Q${n(cx + k)} ${n(cy - k)} ${n(cx + rad)} ${n(cy)}Q${n(cx + k)} ${n(cy + k)} ${n(cx)} ${n(cy + rad)}Q${n(cx - k)} ${n(cy + k)} ${n(cx - rad)} ${n(cy)}Q${n(cx - k)} ${n(cy - k)} ${n(cx)} ${n(cy - rad)}Z" fill="${color}" stroke="${INK}" stroke-width="1.4"/>`;
}

// ---------- the motifs ----------

/** A mandala: rings of petals and dots around a sun, every ring its own colour. */
function mandala(cx: number, cy: number, rad: number, p: Paint, r: () => number): string {
  const rings = [
    { count: 16, at: rad * 0.95, len: rad * 0.3, width: rad * 0.13, color: p.a },
    { count: 12, at: rad * 0.68, len: rad * 0.28, width: rad * 0.15, color: p.b },
    { count: 8, at: rad * 0.44, len: rad * 0.24, width: rad * 0.17, color: p.c },
  ];
  let s = mist(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(rad)}"/>`, p.a, rad * 0.14);
  s += `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(rad * 1.04)}" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="3 4"/>`;
  for (const ring of rings) {
    const turn = r() * 30;
    for (let i = 0; i < ring.count; i++) {
      const a = turn + (360 / ring.count) * i;
      // a teardrop petal pointing out, and a dot between petals
      const petal = `M0 ${n(-ring.at)}q${n(ring.width)} ${n(ring.len * 0.45)} 0 ${n(ring.len)}q${n(-ring.width)} ${n(-ring.len * 0.55)} 0 ${n(-ring.len)}Z`;
      s += `<path transform="translate(${n(cx)} ${n(cy)}) rotate(${n(a)})" d="${petal}" fill="${ring.color}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`;
      s += `<circle transform="translate(${n(cx)} ${n(cy)}) rotate(${n(a + 180 / ring.count)})" cx="0" cy="${n(-ring.at + ring.len * 0.2)}" r="${n(ring.width * 0.26)}" fill="#ffffff" stroke="${INK}" stroke-width="0.9"/>`;
    }
  }
  s += `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(rad * 0.22)}" fill="#ffc93c" stroke="${INK}" stroke-width="2"/>`;
  s += `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(rad * 0.1)}" fill="${p.b}" stroke="${INK}" stroke-width="1.4"/>`;
  s += `<circle cx="${n(cx - rad * 0.07)}" cy="${n(cy - rad * 0.08)}" r="${n(rad * 0.045)}" fill="#ffffff" opacity="0.85"/>`;
  return s;
}

/** A street-art character: a big round head in a cap, huge eyes, a grin, a shine, sprayed on with drips. */
function character(cx: number, cy: number, size: number, p: Paint, r: () => number): string {
  let s = mist(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(size)}"/>`, p.a, size * 0.18);
  // the 3D block behind the head and the white second outline
  s += `<circle cx="${n(cx + size * 0.14)}" cy="${n(cy + size * 0.12)}" r="${n(size * 1.04)}" fill="#2f2a4a" stroke="${INK}" stroke-width="2.4"/>`;
  s += `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(size * 1.09)}" fill="#ffffff"/>`;
  s += `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(size)}" fill="${p.a}" stroke="${INK}" stroke-width="2.6"/>`;
  // shade on the lower right, the spray's fade
  s += `<path d="M${n(cx + size * 0.98)} ${n(cy)}A${n(size)} ${n(size)} 0 0 1 ${n(cx - size * 0.3)} ${n(cy + size * 0.95)}Q${n(cx + size * 0.6)} ${n(cy + size * 0.5)} ${n(cx + size * 0.98)} ${n(cy)}Z" fill="${INK}" opacity="0.18"/>`;
  // the cap: a dome, a brim to the side, a lit edge
  s += `<path d="M${n(cx - size * 0.97)} ${n(cy - size * 0.2)}Q${n(cx)} ${n(cy - size * 1.38)} ${n(cx + size * 0.97)} ${n(cy - size * 0.2)}Z" fill="${p.b}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`;
  s += `<path d="M${n(cx + size * 0.5)} ${n(cy - size * 0.28)}q${n(size * 0.7)} ${n(-size * 0.08)} ${n(size * 0.95)} ${n(size * 0.14)}q${n(-size * 0.42)} ${n(size * 0.14)} ${n(-size * 0.95)} ${n(size * 0.02)}Z" fill="${p.b}" stroke="${INK}" stroke-width="2.2"/>`;
  s += stroke(
    `M${n(cx - size * 0.6)} ${n(cy - size * 0.52)}q${n(size * 0.4)} ${n(-size * 0.36)} ${n(size * 0.8)} ${n(-size * 0.3)}`,
    '#ffffff',
    2.2,
    0.7,
  );
  // eyes: big whites, pupils looking the same way, a highlight each
  const look = (r() - 0.5) * size * 0.14;
  for (const dx of [-0.36, 0.36]) {
    const ex = cx + dx * size;
    const ey = cy + size * 0.06;
    s += `<ellipse cx="${n(ex)}" cy="${n(ey)}" rx="${n(size * 0.24)}" ry="${n(size * 0.3)}" fill="#ffffff" stroke="${INK}" stroke-width="2"/>`;
    s += `<circle cx="${n(ex + look)}" cy="${n(ey + size * 0.05)}" r="${n(size * 0.12)}" fill="${INK}"/>`;
    s += `<circle cx="${n(ex + look - size * 0.04)}" cy="${n(ey - size * 0.01)}" r="${n(size * 0.04)}" fill="#ffffff"/>`;
  }
  // a wide grin with one tooth, rosy cheeks
  s += `<path d="M${n(cx - size * 0.4)} ${n(cy + size * 0.48)}Q${n(cx)} ${n(cy + size * 0.86)} ${n(cx + size * 0.42)} ${n(cy + size * 0.45)}Q${n(cx)} ${n(cy + size * 0.62)} ${n(cx - size * 0.4)} ${n(cy + size * 0.48)}Z" fill="${INK}"/>`;
  s += `<rect x="${n(cx + size * 0.04)}" y="${n(cy + size * 0.52)}" width="${n(size * 0.12)}" height="${n(size * 0.1)}" fill="#ffffff"/>`;
  for (const dx of [-0.66, 0.66])
    s += `<circle cx="${n(cx + dx * size)}" cy="${n(cy + size * 0.42)}" r="${n(size * 0.11)}" fill="#ff8fa3" opacity="0.8"/>`;
  s += `<ellipse cx="${n(cx - size * 0.58)}" cy="${n(cy - size * 0.02)}" rx="${n(size * 0.06)}" ry="${n(size * 0.16)}" fill="#ffffff" opacity="0.7" transform="rotate(20 ${n(cx - size * 0.58)} ${n(cy - size * 0.02)})"/>`;
  // paint running off the sides of the head, the way a big sprayed fill does
  for (const dx of [-0.82, 0.86])
    s += drip(cx + dx * size, cy + size * 0.5, size * (0.25 + r() * 0.25), p.a, 2);
  return s;
}

/** A sunset mural: a striped sun sinking into waves under the mountains, birds in the sky, in a sprayed frame. */
function sunset(box: Box, p: Paint, r: () => number): string {
  const { x0, y0, x1, y1 } = box;
  const id = `gs${uid++}`;
  const w = x1 - x0;
  const h = y1 - y0;
  const frameShape = rr(x0, y0, w, h, 10);
  let s = mist(`<path d="${frameShape}"/>`, '#ff9a1f', 5);
  s += `<linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4c2a7a"/><stop offset="0.45" stop-color="#ff5a6e"/><stop offset="1" stop-color="#ffc93c"/></linearGradient>`;
  s += `<clipPath id="${id}c"><path d="${frameShape}"/></clipPath>`;
  s += `<path d="${frameShape}" fill="url(#${id}g)"/><g clip-path="url(#${id}c)">`;
  // the sun with the retro stripes across its lower half
  const sx = x0 + w * (0.4 + r() * 0.2);
  const sy = y0 + h * 0.62;
  const sr = h * 0.36;
  s += `<circle cx="${n(sx)}" cy="${n(sy)}" r="${n(sr)}" fill="#ffe28a"/>`;
  for (let k = 0; k < 4; k++)
    s += fill(
      `M${n(sx - sr)} ${n(sy + k * sr * 0.18)}h${n(sr * 2)}v${n(2 + k)}h${n(-sr * 2)}Z`,
      '#ff5a6e',
    );
  // mountains, the sea and its waves
  s += `<path d="M${n(x0)} ${n(y0 + h * 0.7)}L${n(x0 + w * 0.18)} ${n(y0 + h * 0.4)}L${n(x0 + w * 0.32)} ${n(y0 + h * 0.62)}L${n(x0 + w * 0.48)} ${n(y0 + h * 0.36)}L${n(x0 + w * 0.7)} ${n(y0 + h * 0.66)}L${n(x0 + w * 0.86)} ${n(y0 + h * 0.46)}L${n(x1)} ${n(y0 + h * 0.64)}V${n(y1)}H${n(x0)}Z" fill="#3a2c6a" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`;
  s += fill(`M${n(x0)} ${n(y0 + h * 0.74)}H${n(x1)}V${n(y1)}H${n(x0)}Z`, p.c);
  for (let k = 0; k < 3; k++) {
    let d = `M${n(x0)} ${n(y0 + h * (0.8 + k * 0.08))}`;
    for (let x = x0; x < x1; x += 14) d += `q7 -5 14 0`;
    s += stroke(d, '#ffffff', 1.8, 0.75 - k * 0.15);
  }
  for (let i = 0; i < 3; i++) {
    const bx = x0 + w * (0.15 + r() * 0.6);
    const by = y0 + h * (0.12 + r() * 0.15);
    s += stroke(`M${n(bx - 5)} ${n(by)}q2.5 -3 5 0q2.5 -3 5 0`, INK, 1.6);
  }
  s += `</g><path d="${frameShape}" fill="none" stroke="${INK}" stroke-width="2.6"/>`;
  s += `<path d="${rr(x0 - 3, y0 - 3, w + 6, h + 6, 12)}" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.85"/>`;
  for (let i = 0; i < 3; i++)
    s += drip(x0 + 14 + r() * (w - 28), y1 - 1, 6 + r() * 12, '#ff5a6e', 2);
  return s;
}

/** An abstract wildstyle: interlocking shards and arrows with a 3D block, outlines, a fade and shines; no letters. */
function shards(box: Box, p: Paint, r: () => number): string {
  const { x0, y0, x1, y1 } = box;
  const id = `gw${uid++}`;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const w = x1 - x0;
  const h = y1 - y0;
  const pieces: string[] = [];
  // angular bursts of different sizes, turned every which way and overlapping, like a wildstyle with no letters
  for (let i = 0; i < 7; i++) {
    const px = x0 + w * (0.12 + (i / 6) * 0.76) + (r() - 0.5) * 10;
    const py = cy + (r() - 0.5) * h * 0.35;
    const size = h * (0.28 + r() * 0.22);
    const turn = (r() - 0.5) * 70;
    const corners = 5 + Math.floor(r() * 2);
    const pts: string[] = [];
    for (let k = 0; k < corners; k++) {
      const ang = ((Math.PI * 2) / corners) * k + r() * 0.5;
      // every other corner is a sharp spike
      const reach = size * (k % 2 ? 0.45 + r() * 0.15 : 0.9 + r() * 0.35);
      pts.push(`${n(Math.cos(ang) * reach)} ${n(Math.sin(ang) * reach * 0.8)}`);
    }
    pieces.push(`M${pts.join('L')}Z" transform="translate(${n(px)} ${n(py)}) rotate(${n(turn)})`);
  }
  const shape = pieces.map((d) => `<path d="${d}"/>`).join('');
  let s = mist(shape, p.a, 6);
  s += `<g fill="#ffffff" stroke="#ffffff" stroke-width="9" stroke-linejoin="round">${shape}</g>`;
  for (let k = 5; k >= 1; k--)
    s += `<g transform="translate(${n(k * 1.4)} ${n(k * 1.2)})" fill="#2a2630" stroke="${INK}" stroke-width="3" stroke-linejoin="round">${shape}</g>`;
  s += `<linearGradient id="${id}f" gradientUnits="userSpaceOnUse" x1="0" y1="${n(y0)}" x2="0" y2="${n(y1)}"><stop offset="0" stop-color="${p.a}"/><stop offset="0.5" stop-color="${p.a}"/><stop offset="0.62" stop-color="${p.b}"/><stop offset="1" stop-color="${p.b}"/></linearGradient>`;
  s += `<g fill="url(#${id}f)" stroke="${INK}" stroke-width="3" stroke-linejoin="round">${shape}</g>`;
  s += `<clipPath id="${id}c">${shape}</clipPath><g clip-path="url(#${id}c)">`;
  s += stroke(`M${n(x0)} ${n(cy - 2)}L${n(x1)} ${n(cy - 8)}`, '#ffffff', 2.4, 0.8);
  for (let i = 0; i < 8; i++)
    s += `<circle cx="${n(x0 + r() * w)}" cy="${n(y0 + h * (0.55 + r() * 0.35))}" r="${n(1.6 + r() * 2.4)}" fill="#ffffff" opacity="0.6"/>`;
  s += `</g>`;
  // arrows flying out of the piece
  for (const [ax, ay, len, a] of [
    [x1 - 14, y0 + 10, 26, -25],
    [x0 + 10, y1 - 8, 22, 160],
  ] as const) {
    const d = `M${n(ax)} ${n(ay)}q${n(len * 0.5)} ${n(-len * 0.3)} ${n(len)} 0l-6 -6M${n(ax + len)} ${n(ay)}l-7 5`;
    s += `<g transform="rotate(${a} ${n(ax)} ${n(ay)})">${stroke(d, INK, 7)}${stroke(d, p.c, 3.6)}</g>`;
  }
  s += sparkle(cx + w * 0.3, y0 + 4, 6) + sparkle(cx - w * 0.36, y1 - 12, 4);
  return s;
}

/** A big eye with lashes, a rayed iris and a tear of paint running down: the Los Karkos wall. */
function eye(cx: number, cy: number, size: number, p: Paint, r: () => number): string {
  const lid = `M${n(cx - size)} ${n(cy)}Q${n(cx)} ${n(cy - size * 0.75)} ${n(cx + size)} ${n(cy)}Q${n(cx)} ${n(cy + size * 0.75)} ${n(cx - size)} ${n(cy)}Z`;
  let s = mist(`<path d="${lid}"/>`, p.a, size * 0.16);
  s += `<path d="${lid}" fill="#ffffff" stroke="#ffffff" stroke-width="7" stroke-linejoin="round"/>`;
  s += `<path d="${lid}" fill="#f6f2e9" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
  const id = `ge${uid++}`;
  s += `<clipPath id="${id}"><path d="${lid}"/></clipPath><g clip-path="url(#${id})">`;
  s += `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(size * 0.42)}" fill="${p.a}" stroke="${INK}" stroke-width="2"/>`;
  for (let i = 0; i < 12; i++)
    s += `<path transform="translate(${n(cx)} ${n(cy)}) rotate(${i * 30})" d="M0 ${n(-size * 0.38)}L${n(size * 0.05)} ${n(-size * 0.2)}L${n(-size * 0.05)} ${n(-size * 0.2)}Z" fill="${p.b}"/>`;
  s += `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(size * 0.18)}" fill="${INK}"/>`;
  s += `<circle cx="${n(cx - size * 0.1)}" cy="${n(cy - size * 0.1)}" r="${n(size * 0.07)}" fill="#ffffff"/>`;
  s += `</g>`;
  for (let i = 0; i < 7; i++) {
    const t = -0.75 + i * 0.25;
    const bx = cx + t * size * 0.95;
    const by = cy - size * 0.375 * (1 - t * t) - 1;
    s += stroke(`M${n(bx)} ${n(by)}l${n(t * 6)} ${n(-size * 0.22)}`, INK, 2.6);
  }
  s += drip(cx + size * 0.2, cy + size * 0.32, size * (0.45 + r() * 0.15), p.c, 3.2);
  return s;
}

/** A wall bombed over and over: throw-up bubbles (fat outlined blobs) and tags of many colours on top of each other. */
function bombing(box: Box, palette: string[], r: () => number): string {
  const { x0, y0, x1, y1 } = box;
  let s = '';
  for (let i = 0; i < 4; i++) {
    const bx = x0 + 18 + r() * (x1 - x0 - 50);
    const by = y0 + 18 + r() * (y1 - y0 - 30);
    const c = i % 2 ? '#d9dde4' : palette[Math.floor(r() * palette.length)]!;
    let blob = '';
    const parts = 2 + Math.floor(r() * 2);
    for (let k = 0; k < parts; k++)
      blob += `<ellipse cx="${n(bx + k * 13)}" cy="${n(by + (r() - 0.5) * 4)}" rx="${n(9 + r() * 4)}" ry="${n(11 + r() * 4)}"/>`;
    s += `<g fill="${INK}" stroke="${INK}" stroke-width="7">${blob}</g>`;
    s += `<g fill="${c}" stroke="${c === '#d9dde4' ? '#8d939e' : '#ffffff'}" stroke-width="1.6">${blob}</g>`;
    s += stroke(`M${n(bx - 4)} ${n(by - 6)}q4 -3 8 0`, '#ffffff', 2, 0.8);
  }
  for (let i = 0; i < 7; i++)
    s += tag(
      x0 + 4 + r() * (x1 - x0 - 46),
      y0 + 12 + r() * (y1 - y0 - 18),
      26 + r() * 20,
      i % 3 ? INK : palette[Math.floor(r() * palette.length)]!,
      r,
    );
  return s;
}

const MOTIFS = ['bombing', 'mandala', 'character', 'sunset', 'shards', 'eye'] as const;

/**
 * A wall three tiles wide with one mural on it (picked by the seed). `grime` = Los Karkos: a darker, dirtier wall,
 * more tags, cracks.
 */
export function graffitiWall(seed: number, palette: string[], grime = false): Prop {
  const foot: [number, number] = [3, 1];
  const { w, h, ax, ay, L, R } = frame(foot, 1.9, 0.15);
  const top = ay - 1.55 * T;
  const r = rng(seed);
  const brick = r() > 0.5;
  const wallTone: Tone = grime
    ? ['#8f897f', '#726c63']
    : brick
      ? ['#b5654a', '#93503a']
      : ['#c9c5bc', '#a7a39a'];
  const id = `gwall${seed}`;
  let s = shadow(ax, ay - 2, 1.6 * T, 8, 0.22);
  s += shaded(rr(L, top, R - L, ay - top, 4), wallTone, LINE, -6, -3);
  s += `<clipPath id="${id}"><path d="${rr(L, top, R - L, ay - top, 4)}"/></clipPath><g clip-path="url(#${id})">`;
  if (brick) s += bricks(L, top, R - L, ay - top, wallTone[1], 0.5);
  else
    s += stroke(
      `M${n(L + (R - L) / 3)} ${n(top)}V${n(ay)}M${n(L + ((R - L) * 2) / 3)} ${n(top)}V${n(ay)}`,
      wallTone[1],
      2,
      0.8,
    );
  // patches where older pieces were buffed out, rain streaks, grime by the ground
  for (let i = 0; i < 2; i++)
    s += fill(
      rr(L + r() * (R - L - 60), top + 6 + r() * 30, 40 + r() * 40, 24 + r() * 26, 2),
      i % 2 ? '#bdb8ae' : '#8f8a82',
      grime ? 0.5 : 0.35,
    );
  for (let i = 0; i < 6; i++)
    s += stroke(
      `M${n(L + 8 + r() * (R - L - 16))} ${n(top + 4)}v${n(10 + r() * 30)}`,
      '#3c3a36',
      2 + r() * 2,
      grime ? 0.25 : 0.12,
    );
  s += fill(`M${L} ${n(ay - 14)}H${R}V${ay}H${L}Z`, '#2d2a26', grime ? 0.3 : 0.16);

  // the mural's paint: three colours that go together
  const pick = () => palette[Math.floor(r() * palette.length)]!;
  const a = pick();
  let b = pick();
  if (b === a) b = palette[(palette.indexOf(a) + 2) % palette.length]!;
  let c = pick();
  if (c === a || c === b) c = palette[(palette.indexOf(b) + 1) % palette.length]!;
  const paint = { a, b, c };
  const box: Box = { x0: L + 14, y0: top + 10, x1: R - 14, y1: ay - 12 };
  const midY = (box.y0 + box.y1) / 2;
  // a few old tags first: the mural goes over them, like on a real wall
  for (let i = 0; i < (grime ? 3 : 2); i++)
    s += tag(
      L + 6 + r() * (R - L - 50),
      top + 14 + r() * (ay - top - 30),
      26 + r() * 14,
      r() > 0.3 ? INK : '#e9ecf2',
      r,
    );
  switch (MOTIFS[seed % MOTIFS.length]) {
    case 'mandala':
      s += mandala(ax, midY, (box.y1 - box.y0) * 0.56, paint, r);
      s += sparkle(L + 24, top + 20, 6) + sparkle(R - 26, ay - 24, 5);
      break;
    case 'character':
      s += character(ax - 10, midY + 8, (box.y1 - box.y0) * 0.44, paint, r);
      s += sparkle(R - 30, top + 22, 7, '#ffc93c') + sparkle(L + 26, top + 24, 5);
      break;
    case 'sunset':
      s += sunset({ x0: box.x0 + 6, y0: box.y0 + 2, x1: box.x1 - 6, y1: box.y1 }, paint, r);
      break;
    case 'shards':
      s += shards(box, paint, r);
      break;
    case 'eye':
      s += eye(ax, midY, (box.x1 - box.x0) * 0.3, paint, r);
      s += sparkle(R - 24, top + 18, 5);
      break;
    default:
      s += bombing(box, palette, r);
  }
  if (grime)
    s += stroke(
      `M${L + 10} ${ay - 16}l18 -10l12 8M${R - 50} ${top + 14}l10 16l-4 10`,
      '#3c3833',
      2.5,
      0.8,
    );
  s += `</g>`;
  s += shaded(rr(L - 3, top - 4, R - L + 6, 10, 3), [wallTone[1], wallTone[1]], LINE, 0, 0, 2);
  return { w, h, ax, ay, foot, body: s };
}
