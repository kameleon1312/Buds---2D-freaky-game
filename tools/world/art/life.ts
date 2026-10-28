// The small life of the world (Unity World/WorldLife): leaves that fall from the trees, butterflies over the flowers,
// sparks and smoke over the burning barrels of the scrapland, puffs of dust kicked up from sand and paths. Tiny
// pictures in the same cel style as the rest (kit.ts), each a frame the game moves itself; marked flat so the export
// leaves them crisp (no finishing grain).
import { circ, fill, n, puffs, shaded, stroke, T, type Prop } from './kit';

/** A leaf, turned a little, with its midrib. */
function leaf(tone: [string, string], line: string): Prop {
  const w = 0.3 * T;
  const h = 0.24 * T;
  const ax = w / 2;
  const ay = h / 2;
  const d = `M${n(ax - 8)} ${n(ay + 3)}Q${n(ax - 4)} ${n(ay - 7)} ${n(ax + 8)} ${n(ay - 3)}Q${n(ax + 3)} ${n(ay + 6)} ${n(ax - 8)} ${n(ay + 3)}Z`;
  return {
    w,
    h,
    ax,
    ay,
    flat: true,
    body:
      shaded(d, tone, line, -1, -1, 1.4) +
      stroke(`M${n(ax - 7)} ${n(ay + 2)}L${n(ax + 6)} ${n(ay - 3)}`, line, 1, 0.6),
  };
}

/**
 * A butterfly: wings spread (two pairs, a dark edge and a spot on each upper wing) or folded up into one tall wing
 * seen edge-on (the game flips between the two to flap). Strong colours with a dark body, so it reads on grass and sand.
 */
function butterfly(open: boolean, wing: [string, string], spot: string): Prop {
  const w = 0.46 * T;
  const h = 0.4 * T;
  const ax = w / 2;
  const ay = h / 2 + 3;
  const line = '#2a1f1a';
  let s = '';
  if (open)
    for (const side of [-1, 1]) {
      s += shaded(
        `M${n(ax)} ${n(ay - 1)}C${n(ax + side * 6)} ${n(ay - 13)} ${n(ax + side * 14)} ${n(ay - 12)} ${n(ax + side * 12)} ${n(ay - 3)}C${n(ax + side * 10)} ${n(ay + 1)} ${n(ax + side * 4)} ${n(ay + 1)} ${n(ax)} ${n(ay)}Z`,
        wing,
        line,
        -1,
        -1,
        1.6,
      );
      s += shaded(
        `M${n(ax)} ${n(ay + 1)}C${n(ax + side * 7)} ${n(ay + 2)} ${n(ax + side * 9)} ${n(ay + 9)} ${n(ax + side * 4)} ${n(ay + 9)}C${n(ax + side * 2)} ${n(ay + 8)} ${n(ax + side * 1)} ${n(ay + 5)} ${n(ax)} ${n(ay + 2)}Z`,
        wing,
        line,
        -1,
        -1,
        1.6,
      );
      s += fill(circ(ax + side * 8, ay - 6, 2.2), spot);
    }
  else
    s += shaded(
      `M${n(ax)} ${n(ay + 3)}C${n(ax - 6)} ${n(ay - 4)} ${n(ax - 3)} ${n(ay - 14)} ${n(ax + 2)} ${n(ay - 13)}C${n(ax + 5)} ${n(ay - 6)} ${n(ax + 3)} ${n(ay)} ${n(ax)} ${n(ay + 3)}Z`,
      wing,
      line,
      -1,
      -1,
      1.6,
    );
  s += stroke(`M${n(ax)} ${n(ay - 6)}V${n(ay + 5)}`, line, 2.6);
  s += stroke(`M${n(ax)} ${n(ay - 6)}l-3 -4M${n(ax)} ${n(ay - 6)}l3 -4`, line, 1.1);
  return { w, h, ax, ay, flat: true, body: s };
}

/** A spark: a hot core in a soft glow. */
const spark = (): Prop => ({
  w: 0.2 * T,
  h: 0.2 * T,
  ax: 0.1 * T,
  ay: 0.1 * T,
  flat: true,
  body:
    `<circle cx="${n(0.1 * T)}" cy="${n(0.1 * T)}" r="5.5" fill="#ffb347" opacity="0.4"/>` +
    `<circle cx="${n(0.1 * T)}" cy="${n(0.1 * T)}" r="2.4" fill="#fff1b8"/>`,
});

/** A soft puff (smoke or dust): a few overlapping round clouds. */
function puff(c: { base: string; dark: string; light: string; line: string }): Prop {
  const w = 0.7 * T;
  const h = 0.55 * T;
  const ax = w / 2;
  const ay = h / 2 + 4;
  return {
    w,
    h,
    ax,
    ay,
    flat: true,
    body: puffs(
      [
        [ax - 8, ay, 9],
        [ax + 6, ay - 2, 10],
        [ax - 1, ay - 8, 9],
      ],
      c,
      '',
      2,
    ),
  };
}

export const LIFE_PROPS: Record<string, Prop> = {
  'zycie-lisc-a': leaf(['#8fcf5a', '#5e9e3a'], '#2f5a24'),
  'zycie-lisc-b': leaf(['#f2b84a', '#d98a2b'], '#7a4a14'),
  'zycie-motyl-a': butterfly(true, ['#ffb52e', '#e08a12'], '#2a1f1a'),
  'zycie-motyl-b': butterfly(false, ['#ffb52e', '#e08a12'], '#2a1f1a'),
  'zycie-motyl-c': butterfly(true, ['#6ec6ff', '#3a98d8'], '#ffffff'),
  'zycie-motyl-d': butterfly(false, ['#6ec6ff', '#3a98d8'], '#ffffff'),
  'zycie-iskra': spark(),
  'zycie-dym': puff({ base: '#b9bcc3', dark: '#959aa4', light: '#d7dae0', line: '#6f7480' }),
  'zycie-kurz': puff({ base: '#e8d5a8', dark: '#cdb583', light: '#f6ead0', line: '#b39a68' }),
};
