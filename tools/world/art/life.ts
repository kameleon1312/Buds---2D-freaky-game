// The small life of the world (Unity World/WorldLife): leaves that fall from the trees, butterflies over the flowers,
// pigeons that peck about on squares and lawns and take off when someone comes close, sparks and smoke over the burning
// barrels of the scrapland, puffs of dust kicked up from sand and paths. Tiny pictures in the same cel style as the
// rest (kit.ts), each a frame the game moves itself; marked flat so the export leaves them crisp (no finishing grain).
import { circ, fill, n, puffs, shaded, stroke, T, type Prop } from './kit';

const LINE = '#3a2a22';

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

const PIGEON: [string, string] = ['#a9adb8', '#7f8491'];
const PIGEON_DARK: [string, string] = ['#6e7280', '#535764'];

type Bird = {
  body: [string, string];
  wing: [string, string];
  neck: string;
  sheen: string;
  beak: string;
  legs: string;
};
const PIGEON_BIRD: Bird = {
  body: PIGEON,
  wing: PIGEON_DARK,
  neck: '#7d8fa0',
  sheen: '#6fb3a0',
  beak: '#4a3a2a',
  legs: '#e0707a',
};
const GULL: Bird = {
  body: ['#f6f7f8', '#d3d8de'],
  wing: ['#a9b4c0', '#86919e'],
  neck: '#eef1f4',
  sheen: '#ffffff',
  beak: '#f2b632',
  legs: '#f2b632',
};
const CROW: Bird = {
  body: ['#3a3d47', '#262830'],
  wing: ['#2a2c34', '#1b1c22'],
  neck: '#33363f',
  sheen: '#5a6a8a',
  beak: '#1b1b1b',
  legs: '#2a2a2a',
};

/** A bird on the ground, seen from the side: standing, or with its head down pecking. */
function pigeon(pecking: boolean, b: Bird = PIGEON_BIRD): Prop {
  const w = 0.5 * T;
  const h = 0.42 * T;
  const ax = w / 2;
  const ay = h - 3;
  let s = `<ellipse cx="${n(ax)}" cy="${n(ay)}" rx="9" ry="2.5" fill="#1d2a14" opacity="0.22"/>`;
  s += stroke(`M${n(ax - 2)} ${n(ay - 1)}v-5M${n(ax + 3)} ${n(ay - 1)}v-5`, b.legs, 1.8);
  // body and tail
  s += shaded(
    `M${n(ax - 12)} ${n(ay - 12)}Q${n(ax - 4)} ${n(ay - 18)} ${n(ax + 7)} ${n(ay - 13)}Q${n(ax + 10)} ${n(ay - 6)} ${n(ax + 2)} ${n(ay - 5)}Q${n(ax - 8)} ${n(ay - 5)} ${n(ax - 12)} ${n(ay - 12)}Z`,
    b.body,
    LINE,
    -2,
    -2,
    1.5,
  );
  s += shaded(
    `M${n(ax - 6)} ${n(ay - 13)}Q${n(ax + 1)} ${n(ay - 15)} ${n(ax + 4)} ${n(ay - 9)}Q${n(ax - 3)} ${n(ay - 8)} ${n(ax - 6)} ${n(ay - 13)}Z`,
    b.wing,
    LINE,
    -1,
    -1,
    1.2,
  );
  // head: up, or down to the ground
  const hx = pecking ? ax + 11 : ax + 8;
  const hy = pecking ? ay - 5 : ay - 17;
  s += stroke(`M${n(ax + 5)} ${n(ay - 12)}L${n(hx)} ${n(hy)}`, b.neck, 4.5);
  s += stroke(`M${n(ax + 5)} ${n(ay - 12)}L${n(hx - 1)} ${n(hy + 1)}`, b.sheen, 2, 0.8); // the green sheen on the neck
  s += shaded(circ(hx, hy, 3.6), b.body, LINE, -1, -1, 1.3);
  s += `<path d="M${n(hx + 3)} ${n(hy)}l3 ${pecking ? 2 : 1}" stroke="${b.beak}" stroke-width="1.6" stroke-linecap="round"/>`;
  s += fill(circ(hx + 1, hy - 1, 0.9), '#1b1b1b');
  return { w, h, ax, ay, flat: true, body: s };
}

/** A pigeon flying off: wings up or down. */
function pigeonFlying(up: boolean, b: Bird = PIGEON_BIRD): Prop {
  const w = 0.6 * T;
  const h = 0.42 * T;
  const ax = w / 2;
  const ay = h / 2 + 4;
  let s = shaded(
    `M${n(ax - 10)} ${n(ay)}Q${n(ax)} ${n(ay - 5)} ${n(ax + 10)} ${n(ay)}Q${n(ax)} ${n(ay + 4)} ${n(ax - 10)} ${n(ay)}Z`,
    b.body,
    LINE,
    -1,
    -1,
    1.4,
  );
  for (const side of [-1, 1]) {
    const tip = up ? -13 : 8;
    s += shaded(
      `M${n(ax + side * 2)} ${n(ay - 1)}Q${n(ax + side * 10)} ${n(ay + tip)} ${n(ax + side * 17)} ${n(ay + tip * 0.7)}Q${n(ax + side * 9)} ${n(ay + 1)} ${n(ax + side * 2)} ${n(ay + 1)}Z`,
      b.wing,
      LINE,
      -1,
      -1,
      1.3,
    );
  }
  s += shaded(circ(ax + 10, ay - 2, 3.2), b.body, LINE, -1, -1, 1.2);
  return { w, h, ax, ay, flat: true, body: s };
}

/** A swan gliding on the water: a white body low on the water, the S of its neck, an orange beak; a ripple round it. */
function swan(): Prop {
  const w = 0.9 * T;
  const h = 0.75 * T;
  const ax = w / 2;
  const ay = h - 8;
  let s = `<ellipse cx="${n(ax)}" cy="${n(ay)}" rx="24" ry="5" fill="#ffffff" opacity="0.35"/>`;
  s += shaded(
    `M${n(ax - 22)} ${n(ay - 4)}Q${n(ax - 26)} ${n(ay - 20)} ${n(ax - 10)} ${n(ay - 18)}Q${n(ax + 4)} ${n(ay - 24)} ${n(ax + 16)} ${n(ay - 10)}Q${n(ax + 18)} ${n(ay - 2)} ${n(ax + 6)} ${n(ay - 1)}H${n(ax - 14)}Q${n(ax - 22)} ${n(ay - 1)} ${n(ax - 22)} ${n(ay - 4)}Z`,
    ['#ffffff', '#dde3ea'],
    '#5a6470',
    -2,
    -2,
    1.6,
  );
  s += stroke(
    `M${n(ax + 10)} ${n(ay - 12)}Q${n(ax + 18)} ${n(ay - 28)} ${n(ax + 10)} ${n(ay - 34)}Q${n(ax + 4)} ${n(ay - 38)} ${n(ax + 10)} ${n(ay - 42)}`,
    '#5a6470',
    7,
  );
  s += stroke(
    `M${n(ax + 10)} ${n(ay - 12)}Q${n(ax + 18)} ${n(ay - 28)} ${n(ax + 10)} ${n(ay - 34)}Q${n(ax + 4)} ${n(ay - 38)} ${n(ax + 10)} ${n(ay - 42)}`,
    '#ffffff',
    4.4,
  );
  s += shaded(circ(ax + 12, ay - 42, 3.6), ['#ffffff', '#dde3ea'], '#5a6470', -1, -1, 1.2);
  s += shaded(`M${n(ax + 15)} ${n(ay - 43)}l7 2l-7 2Z`, ['#ff9a3c', '#d9741a'], '#3a2a1a', 0, 0, 1);
  s += stroke(`M${n(ax - 14)} ${n(ay - 12)}q10 -6 22 -2`, '#c3ccd6', 1.6, 0.8);
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
  'zycie-golab': pigeon(false),
  'zycie-golab-dziob': pigeon(true),
  'zycie-golab-lot-a': pigeonFlying(true),
  'zycie-golab-lot-b': pigeonFlying(false),
  'zycie-mewa': pigeon(false, GULL),
  'zycie-mewa-dziob': pigeon(true, GULL),
  'zycie-mewa-lot-a': pigeonFlying(true, GULL),
  'zycie-mewa-lot-b': pigeonFlying(false, GULL),
  'zycie-wrona': pigeon(false, CROW),
  'zycie-wrona-dziob': pigeon(true, CROW),
  'zycie-wrona-lot-a': pigeonFlying(true, CROW),
  'zycie-wrona-lot-b': pigeonFlying(false, CROW),
  'zycie-labedz': swan(),
  'zycie-iskra': spark(),
  'zycie-dym': puff({ base: '#b9bcc3', dark: '#959aa4', light: '#d7dae0', line: '#6f7480' }),
  'zycie-kurz': puff({ base: '#e8d5a8', dark: '#cdb583', light: '#f6ead0', line: '#b39a68' }),
};
