// Training mini-game art: the scenes of every skill's training (a shark on the wave, the sparring glove, the
// street hustler's cups, the stage, the chasing dog, the parkour obstacles) and the murals painted from memory.
// Rendered by export-art.ts to apps/unity/Assets/Buds/Resources/Ui/Training/<name>.png at 1 px per unit; the
// murals go to Ui/Training/Murals/<mural>-<region>.png (white regions with their ink contour, tinted in the
// game, stacked in order) plus murals.json with where the can aims on every region.
import { impact, type FxArt } from './fx';
import { circ, n, rng, rr, shaded } from './kit';

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

/** A shape with the ink contour every game piece carries (cel shade from the top-left). */
const piece = (d: string, tone: [string, string], width = 5) => shaded(d, tone, INK, -5, -6, width);

/** A dorsal fin cutting the water, foam round its base. */
function fin(): FxArt {
  const d = 'M14 86Q46 70 74 6Q80 52 118 86Z';
  return {
    w: 132,
    h: 104,
    body:
      `<ellipse cx="66" cy="88" rx="62" ry="13" fill="${WHITE}" opacity="0.55"/>` +
      piece(d, ['#7d93a6', '#4f6275']) +
      `<path d="M10 88Q66 104 122 88Q118 98 66 101Q14 98 10 88Z" fill="${WHITE}"/>` +
      `<path d="${circ(22, 80, 5)}${circ(112, 78, 4)}${circ(124, 88, 3)}" fill="${WHITE}"/>`,
  };
}

/** The shark breaching with its jaws wide open (a bite). */
function shark(): FxArt {
  const head = 'M36 236C24 140 70 40 130 14C190 40 236 140 224 236Z';
  const belly = 'M74 236C74 186 102 160 130 160C158 160 186 186 186 236Z';
  const cx = 130;
  const cy = 132;
  const rx = 70;
  const ry = 56;
  let teeth = '';
  const tooth = (a: number, up: boolean) => {
    const at = (deg: number, k: number) => [
      cx + Math.cos((deg * Math.PI) / 180) * rx * k,
      cy + Math.sin((deg * Math.PI) / 180) * ry * k,
    ];
    const [x1, y1] = at(a - 7, 1);
    const [x2, y2] = at(a + 7, 1);
    const [tx, ty] = at(a, up ? 0.66 : 0.7);
    teeth += `M${n(x1!)} ${n(y1!)}L${n(tx!)} ${n(ty!)}L${n(x2!)} ${n(y2!)}Z`;
  };
  for (let a = 196; a <= 344; a += 16) tooth(a, true);
  for (let a = 28; a <= 152; a += 18) tooth(a, false);
  const r = rng(5);
  let drops = '';
  for (let i = 0; i < 14; i++) {
    const x = 14 + r() * 232;
    drops += circ(x, 206 + r() * 30, 4 + r() * 9);
  }
  return {
    w: 260,
    h: 248,
    body:
      piece(head, ['#7d93a6', '#4f6275'], 6) +
      `<path d="${belly}" fill="#e9eef2" stroke="${INK}" stroke-width="4"/>` +
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#5c0f1c" stroke="${INK}" stroke-width="6"/>` +
      `<ellipse cx="${cx}" cy="${cy + 26}" rx="40" ry="18" fill="#d4495a"/>` +
      `<path d="${teeth}" fill="${WHITE}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="${circ(86, 62, 10)}${circ(174, 62, 10)}" fill="${INK}"/>` +
      `<path d="${circ(83, 58, 3.5)}${circ(171, 58, 3.5)}" fill="${WHITE}"/>` +
      `<ellipse cx="130" cy="236" rx="126" ry="12" fill="${WHITE}"/>` +
      `<path d="${drops}" fill="${WHITE}" stroke="${INK}" stroke-width="3"/>`,
  };
}

/** A surfboard from above, nose up (the bud rides it from behind). */
function board(): FxArt {
  return {
    w: 68,
    h: 184,
    body:
      piece(rr(8, 6, 52, 172, 26), [GOLD, GOLD_D]) +
      `<path d="M32 16H36V168H32Z" fill="${ALERT}"/>` +
      `<path d="M14 120H54" stroke="${ALERT_D}" stroke-width="5" opacity="0.6"/>`,
  };
}

/** The hustler's cup, upside down on the table. */
function cup(): FxArt {
  const body = 'M24 122L38 18Q60 10 82 18L96 122Z';
  return {
    w: 120,
    h: 140,
    body:
      piece(body, [ALERT, ALERT_D]) +
      `<path d="M44 26L40 110M76 26L80 110" stroke="${WHITE}" stroke-width="4" opacity="0.35" stroke-linecap="round"/>` +
      `<ellipse cx="60" cy="18" rx="22" ry="6" fill="#ff7a86" stroke="${INK}" stroke-width="4"/>` +
      `<path d="M16 112Q60 126 104 112L106 126Q60 142 14 126Z" fill="${ALERT_D}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`,
  };
}

function ball(): FxArt {
  return {
    w: 52,
    h: 52,
    body:
      piece(circ(26, 26, 20), [GOLD, GOLD_D], 4) +
      `<path d="${circ(19, 18, 5)}" fill="${WHITE}" opacity="0.8"/>`,
  };
}

/** A boxing glove, the fist to the right. */
function glove(tone: [string, string] = [ALERT, ALERT_D], thumbTone = '#ff6b78'): FxArt {
  const mitt =
    'M34 30C34 10 62 6 92 10C124 14 136 40 134 64C132 92 110 106 84 104L48 104C34 104 30 90 32 76Z';
  const thumb = 'M56 70C68 60 92 62 96 74C92 84 70 86 58 82Z';
  return {
    w: 144,
    h: 116,
    body:
      piece(rr(6, 40, 34, 64, 10), [PAPER, '#cfc6b4']) +
      `<path d="M14 56H32M14 72H32M14 88H32" stroke="${INK}" stroke-width="3"/>` +
      piece(mitt, tone) +
      `<path d="${thumb}" fill="${thumbTone}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>` +
      `<path d="M70 22Q96 18 116 30" stroke="${WHITE}" stroke-width="6" opacity="0.45" stroke-linecap="round" fill="none"/>`,
  };
}

/**
 * The hall behind the sparring: dark stands packed with people, hanging lights, the ring with its corner posts, three
 * ropes and a canvas running towards the viewer. Everything that moves is drawn over it by the game.
 */
function arena(): FxArt {
  const W = 1090;
  const H = 366;
  const r = rng(77);
  const shirts = [
    '#3a3d4a',
    '#4cc7ff',
    '#ff3d50',
    '#ffc93c',
    '#a3e635',
    '#b45cff',
    '#f6f2e9',
    '#ff9a1f',
  ];
  let stands = '';
  // rows of people, smaller and dimmer further up
  for (let row = 0; row < 4; row++) {
    const y = 34 + row * 34;
    const size = 11 + row * 2.5;
    const dim = 0.2 + row * 0.1;
    for (let x = -10 + (row % 2) * 12; x < W + 20; x += size * 2.5) {
      const dy = r() * 5;
      const shirt = shirts[Math.floor(r() * shirts.length)];
      const skin = ['#f3c9a6', '#c98d62', '#8a5636', '#f6d5bd'][Math.floor(r() * 4)];
      stands +=
        `<g opacity="${n(dim)}"><path d="${rr(x - size, y + size * 0.9 + dy, size * 2, size * 2.4, size * 0.8)}" fill="${shirt}"/>` +
        `<path d="${circ(x, y + dy, size * 0.9)}" fill="${skin}"/></g>`;
      // a raised arm here and there
      if (r() < 0.16)
        stands += `<path d="M${n(x + size)} ${n(y + size + dy)}L${n(x + size * 1.5)} ${n(y - size * 0.6 + dy)}" stroke="${skin}" stroke-width="${n(size * 0.5)}" stroke-linecap="round" opacity="${n(dim)}"/>`;
    }
  }
  // the truss with its lamps
  let lamps = '';
  for (let x = 90; x < W; x += 182)
    lamps +=
      `<path d="${rr(x - 20, 8, 40, 20, 5)}" fill="#20222c" stroke="${INK}" stroke-width="3"/>` +
      `<path d="${rr(x - 13, 22, 26, 8, 3)}" fill="#fff4c4"/>`;
  const canvas = 'M200 212H890L1170 372H-80Z';
  const post = (x: number, top: number, bottom: number, w: number, tone: [string, string]) =>
    piece(rr(x - w / 2, top, w, bottom - top, w * 0.3), tone, 4) +
    piece(rr(x - w * 0.7, top - w * 0.3, w * 1.4, w * 0.8, w * 0.3), ['#f6f2e9', '#cfc6b4'], 3);
  const rope = (d: string, color: string, w: number) =>
    `<path d="${d}" stroke="${INK}" stroke-width="${w + 4}" fill="none" stroke-linecap="round"/><path d="${d}" stroke="${color}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
  const ropes: [string, number][] = [
    [ALERT, 0],
    [PAPER, 1],
    [REP, 2],
  ];
  return {
    w: W,
    h: H,
    body:
      `<rect width="${W}" height="${H}" fill="#191b26"/>` +
      stands +
      // shade over the stands, so the ring stands out against them
      `<rect y="150" width="${W}" height="70" fill="#121320" opacity="0.72"/>` +
      `<rect width="${W}" height="30" fill="#14151e"/><rect y="26" width="${W}" height="5" fill="#2c2f3d"/>` +
      lamps +
      // the apron and the canvas with its big painted circle
      `<path d="${canvas}" fill="#2a78b8" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>` +
      `<path d="M200 212H890L906 222H184Z" fill="#7fc4ee"/>` +
      `<ellipse cx="545" cy="292" rx="290" ry="58" fill="#3a8ccc"/>` +
      `<ellipse cx="545" cy="292" rx="290" ry="58" fill="none" stroke="#a9dcff" stroke-width="5" opacity="0.8"/>` +
      `<ellipse cx="545" cy="292" rx="120" ry="24" fill="none" stroke="#a9dcff" stroke-width="4" opacity="0.6"/>` +
      `<path d="M-80 372L0 326H1090L1170 372Z" fill="#225f96" opacity="0.7"/>` +
      // back ropes, the posts, the side ropes running to the viewer
      ropes
        .map(([c, i]) => rope(`M214 ${118 + i * 32}Q545 ${124 + i * 32} 876 ${118 + i * 32}`, c, 6))
        .join('') +
      post(208, 96, 218, 24, [ALERT, ALERT_D]) +
      post(882, 96, 218, 24, [REP, REP_D]) +
      ropes
        .map(
          ([c, i]) =>
            rope(`M208 ${118 + i * 32}L${-40} ${150 + i * 54}`, c, 9) +
            rope(`M882 ${118 + i * 32}L${W + 40} ${150 + i * 54}`, c, 9),
        )
        .join(''),
  };
}

/** A soft cone of light, tinted warm; the game turns it slowly over the ring. */
function lightCone(): FxArt {
  return {
    w: 300,
    h: 400,
    body:
      `<path d="M126 0H174L300 400H0Z" fill="#fff6cc" opacity="0.09"/>` +
      `<path d="M138 0H162L230 400H70Z" fill="#fff6cc" opacity="0.1"/>`,
  };
}

/** The half of the canvas a hook will hit: hazard stripes in a rounded red field. */
function hazard(): FxArt {
  let stripes = '';
  for (let x = -150; x < 320; x += 56)
    stripes += `<path d="M${x} 150L${x + 80} 0H${x + 108}L${x + 28} 150Z" fill="${ALERT_D}"/>`;
  return {
    w: 300,
    h: 150,
    body:
      `<clipPath id="hz"><path d="${rr(5, 5, 290, 140, 26)}"/></clipPath>` +
      `<path d="${rr(5, 5, 290, 140, 26)}" fill="${ALERT}"/><g clip-path="url(#hz)">${stripes}</g>` +
      `<path d="${rr(5, 5, 290, 140, 26)}" fill="none" stroke="${INK}" stroke-width="6"/>`,
  };
}

/** The way out of a hook; points right, the game mirrors it. */
function exitArrow(): FxArt {
  return {
    w: 150,
    h: 110,
    body:
      piece('M8 36H84V8L142 55L84 102V74H8Z', [LIME, LIME_D], 6) +
      `<path d="M16 44H90" stroke="${WHITE}" stroke-width="5" opacity="0.5" stroke-linecap="round"/>`,
  };
}

/** Two gloves up in front of a face: the sign for the guard. */
function guardSign(): FxArt {
  const up = (x: number) =>
    piece(
      `M${x} 96V42C${x} 18 ${x + 16} 8 ${x + 30} 8C${x + 46} 8 ${x + 58} 22 ${x + 58} 44V96Z`,
      [REP, REP_D],
      5,
    ) + piece(rr(x + 2, 92, 54, 16, 5), [PAPER, '#cfc6b4'], 4);
  return { w: 150, h: 112, body: up(14) + up(78) };
}

/** Where to hit: gold rings and sights on the chin. */
function reticle(): FxArt {
  const ring = (rad: number, w: number, c: string) =>
    `<circle cx="70" cy="70" r="${rad}" fill="none" stroke="${c}" stroke-width="${w}"/>`;
  return {
    w: 140,
    h: 140,
    body:
      ring(52, 13, INK) +
      ring(52, 7, GOLD) +
      ring(22, 11, INK) +
      ring(22, 5, GOLD) +
      `<path d="M70 4V30M70 110V136M4 70H30M110 70H136" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>` +
      `<path d="M70 6V28M70 112V134M6 70H28M112 70H134" stroke="${GOLD}" stroke-width="6" stroke-linecap="round"/>`,
  };
}

/** The sweep of a hook through the air; swings from the right, the game mirrors it. */
function sweep(): FxArt {
  return {
    w: 420,
    h: 190,
    body:
      `<path d="M410 40Q210 214 12 74Q200 150 410 40Z" fill="${WHITE}" opacity="0.75" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>` +
      `<path d="M380 66Q210 170 70 100" fill="none" stroke="${ALERT}" stroke-width="5" opacity="0.8"/>`,
  };
}

function mic(): FxArt {
  let grid = '';
  for (let i = -2; i <= 2; i++) grid += `M${12 + (i + 2) * 11} 14V58M10 ${18 + (i + 2) * 9}H60`;
  return {
    w: 72,
    h: 172,
    body:
      `<path d="M20 70H52L44 164Q36 172 28 164Z" fill="#26262e" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>` +
      `<clipPath id="mic"><path d="${circ(36, 36, 28)}"/></clipPath>` +
      `<path d="${circ(36, 36, 28)}" fill="#6b7080"/>` +
      `<path d="${grid}" stroke="#3d4150" stroke-width="3" clip-path="url(#mic)"/>` +
      `<path d="${circ(36, 36, 28)}" fill="none" stroke="${INK}" stroke-width="5"/>` +
      `<path d="${circ(27, 26, 7)}" fill="${WHITE}" opacity="0.5"/>` +
      `<path d="${rr(16, 60, 40, 14, 5)}" fill="${LIME}" stroke="${INK}" stroke-width="4"/>`,
  };
}

function speaker(): FxArt {
  const cone = (cx: number, cy: number, r: number) =>
    `<path d="${circ(cx, cy, r)}" fill="#16181f" stroke="${INK}" stroke-width="4"/>` +
    `<path d="${circ(cx, cy, r * 0.7)}" fill="#3d4150"/>` +
    `<path d="${circ(cx, cy, r * 0.28)}" fill="#a9afbd" stroke="${INK}" stroke-width="3"/>`;
  return {
    w: 150,
    h: 222,
    body:
      `<path d="${rr(8, 6, 134, 208, 16)}" fill="#2c2f3a" stroke="${INK}" stroke-width="6"/>` +
      cone(75, 58, 28) +
      cone(75, 146, 52) +
      `<path d="M22 200H128" stroke="${LIME}" stroke-width="5" stroke-linecap="round"/>`,
  };
}

/** A row of the crowd: heads, shoulders, raised hands (white, tinted in the game). */
function crowd(seed: number): FxArt {
  const w = 880;
  const h = 150;
  const r = rng(seed);
  let body = '';
  for (let i = 0; i < 22; i++) {
    const x = 18 + i * 40 + (r() - 0.5) * 14;
    const head = 15 + r() * 6;
    const top = 50 + r() * 34;
    if (r() < 0.38) {
      const lean = (r() < 0.5 ? -1 : 1) * (8 + r() * 18);
      body += `<rect x="${n(x - 6)}" y="${n(top - 46)}" width="12" height="70" rx="6" transform="rotate(${n(lean)} ${n(x)} ${n(top + 24)})"/>`;
      body += `<path d="${circ(x + Math.sin((lean * Math.PI) / 180) * 70, top - 44, 8)}"/>`;
    }
    body += `<path d="${circ(x, top, head)}"/>`;
    body += `<path d="${rr(x - 27, top + head - 4, 54, h, 24)}"/>`;
  }
  return { w, h, body: `<g fill="${WHITE}">${body}</g>` };
}

/** The guard dog chasing the runner, facing right; two strides. */
function dog(stride: 0 | 1): FxArt {
  const DARK = '#3b2f2a';
  const TAN = '#c58a4a';
  const legs: [number, number, number, number][] =
    stride === 0
      ? [
          [52, 76, 14, 104],
          [64, 80, 30, 112],
          [130, 80, 168, 110],
          [140, 78, 186, 100],
        ]
      : [
          [54, 76, 80, 116],
          [64, 80, 92, 114],
          [132, 80, 112, 116],
          [142, 78, 124, 114],
        ];
  const shapes = (ink: boolean) => {
    const f = (color: string) => (ink ? INK : color);
    const sw = ink ? 9 : 0;
    const strokeOf = (w: number) => (ink ? w + 9 : w);
    let s = `<path d="M44 56Q22 50 14 28" fill="none" stroke="${f(DARK)}" stroke-width="${strokeOf(10)}" stroke-linecap="round"/>`;
    for (const [x1, y1, x2, y2] of legs) {
      s += `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${f(DARK)}" stroke-width="${strokeOf(14)}" stroke-linecap="round"/>`;
      s += `<path d="${circ(x2, y2, 7)}" fill="${f(TAN)}" stroke="${f(TAN)}" stroke-width="${sw}"/>`;
    }
    s += `<ellipse cx="96" cy="62" rx="58" ry="25" fill="${f(DARK)}" stroke="${f(DARK)}" stroke-width="${sw}"/>`;
    s += `<path d="${circ(140, 62, 26)}" fill="${f(DARK)}" stroke="${f(DARK)}" stroke-width="${sw}"/>`;
    s += `<path d="M156 30L164 8L176 32Z" fill="${f(DARK)}" stroke="${f(DARK)}" stroke-width="${sw}" stroke-linejoin="round"/>`;
    s += `<path d="${circ(168, 46, 22)}" fill="${f(DARK)}" stroke="${f(DARK)}" stroke-width="${sw}"/>`;
    s += `<path d="${rr(174, 44, 32, 18, 9)}" fill="${f(TAN)}" stroke="${f(TAN)}" stroke-width="${sw}"/>`;
    s += `<path d="M180 60Q194 78 206 60Z" fill="${f('#7a1022')}" stroke="${f('#7a1022')}" stroke-width="${sw}"/>`;
    return s;
  };
  return {
    w: 216,
    h: 130,
    body:
      shapes(true) +
      shapes(false) +
      `<path d="M118 70Q140 82 156 66" stroke="${TAN}" stroke-width="7" fill="none" stroke-linecap="round"/>` +
      `<ellipse cx="190" cy="70" rx="6" ry="9" fill="#ff8aa0"/>` +
      `<path d="${circ(204, 48, 5)}" fill="${INK}"/>` +
      `<path d="${circ(172, 38, 4.5)}" fill="${WHITE}"/><path d="${circ(173, 38, 2.4)}" fill="${INK}"/>` +
      `<path d="M150 44L162 36" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
  };
}

/** Diagonal warning stripes clipped to a shape. */
function striped(d: string, base: string, stripe: string, id: string, step = 26) {
  let lines = '';
  for (let x = -200; x < 400; x += step) lines += `M${x} 200L${x + 120} -40`;
  return (
    `<clipPath id="${id}"><path d="${d}"/></clipPath>` +
    `<path d="${d}" fill="${base}"/>` +
    `<path d="${lines}" stroke="${stripe}" stroke-width="${n(step * 0.42)}" clip-path="url(#${id})"/>` +
    `<path d="${d}" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`
  );
}

/** A road barrier to jump over. */
function barrier(): FxArt {
  const legs = 'M26 98L40 44M54 98L40 44M80 98L94 44M108 98L94 44';
  return {
    w: 134,
    h: 104,
    body:
      `<path d="${legs}" stroke="${INK}" stroke-width="11" stroke-linecap="round"/>` +
      `<path d="${legs}" stroke="#b7bec9" stroke-width="5" stroke-linecap="round"/>` +
      striped(rr(8, 26, 118, 32, 7), WHITE, ALERT, 'bar'),
  };
}

/** A scaffold beam hanging on chains: slide under it. */
function beam(): FxArt {
  return {
    w: 240,
    h: 132,
    body:
      `<path d="M44 0V90M196 0V90" stroke="${INK}" stroke-width="10" stroke-dasharray="12 6"/>` +
      `<path d="M44 0V90M196 0V90" stroke="#b7bec9" stroke-width="4" stroke-dasharray="12 6"/>` +
      striped(rr(6, 88, 228, 36, 8), GOLD, INK, 'beam', 30),
  };
}

/** The city skyline behind the course (white silhouette with lit windows cut out, tinted in the game). */
function skyline(seed: number): FxArt {
  const w = 1280;
  const h = 210;
  const r = rng(seed);
  let blocks = '';
  let holes = '';
  for (let x = 0; x < w;) {
    const bw = 60 + r() * 90;
    const bh = 60 + r() * 140;
    blocks += `<rect x="${n(x)}" y="${n(h - bh)}" width="${n(bw + 1)}" height="${n(bh)}"/>`;
    if (r() < 0.3)
      blocks += `<rect x="${n(x + bw * 0.6)}" y="${n(h - bh - 26)}" width="4" height="26"/>`;
    if (r() < 0.25)
      blocks += `<rect x="${n(x + bw * 0.2)}" y="${n(h - bh - 18)}" width="${n(bw * 0.3)}" height="18" rx="6"/>`;
    for (let wy = h - bh + 14; wy < h - 20; wy += 22)
      for (let wx = x + 10; wx < x + bw - 14; wx += 20)
        if (r() < 0.42)
          holes += `<rect x="${n(wx)}" y="${n(wy)}" width="9" height="11" fill="black"/>`;
    x += bw;
  }
  return {
    w,
    h,
    body:
      `<mask id="sky${seed}"><rect width="${w}" height="${h}" fill="white"/>${holes}</mask>` +
      `<g fill="${WHITE}" mask="url(#sky${seed})">${blocks}</g>`,
  };
}

export const TRAINING: Record<string, FxArt> = {
  'tr-pletwa': fin(),
  'tr-rekin': shark(),
  'tr-deska': board(),
  'tr-kubek': cup(),
  'tr-kulka': ball(),
  'tr-rekawica': glove(),
  'tr-rekawica-b': glove([REP, REP_D], '#a9e6ff'),
  'tr-arena': arena(),
  'tr-reflektor': lightCone(),
  'tr-strefa': hazard(),
  'tr-strzalka': exitArrow(),
  'tr-garda': guardSign(),
  'tr-cel': reticle(),
  'tr-luk': sweep(),
  'tr-mikrofon': mic(),
  'tr-glosnik': speaker(),
  'tr-tlum': crowd(11),
  'tr-pies-a': dog(0),
  'tr-pies-b': dog(1),
  'tr-barierka': barrier(),
  'tr-belka': beam(),
  'tr-miasto': skyline(3),
  // the words of the scenes
  'tr-champ': impact('CHAMP!', 470, 300, [ALERT, ALERT_D], GOLD, WHITE, 13, 84, -6),
  'tr-unik': impact('UNIK!', 360, 240, [REP, REP_D], '#a9e6ff', WHITE, 19, 70),
  'tr-blok': impact('BLOK!', 360, 240, [PAPER, '#d8cfbf'], WHITE, REP, 29, 70, 5),
  'tr-jest': impact('JEST!', 360, 250, [LIME, LIME_D], '#d4f59a', WHITE, 43, 76),
  'tr-pudlo': impact('PUDŁO!', 420, 260, [ALERT, ALERT_D], '#ff8a96', WHITE, 83, 68, 5),
  'tr-hype': impact('HYPE!', 380, 250, [GOLD, GOLD_D], '#ffe27a', ALERT, 61, 76),
};

// ---------- murals painted from memory ----------

/** Canvas of every mural (the wall's frame in the game). */
export const MURAL_W = 520;
export const MURAL_H = 260;

type Region = { markup: string; aim: [number, number] };

const BG = `<path d="${rr(3, 3, MURAL_W - 6, MURAL_H - 6, 18)}"/>`;
/** The bottom band with the wall's round corners. */
const bottom = (top: string) => `<path d="${top}V239Q517 257 499 257H21Q3 257 3 239Z"/>`;
const ink = (markup: string) => `<g fill="${INK}" stroke="none">${markup}</g>`;

/** In the order they are painted (and stacked): the background first. Region counts are mirrored in MuralGame.Templates. */
export const MURALS: Record<string, Region[]> = {
  zachod: [
    { markup: BG, aim: [110, 60] },
    { markup: `<path d="${circ(260, 150, 78)}"/>`, aim: [260, 112] },
    { markup: bottom('M3 172Q66 150 130 172T260 172T390 172T517 172'), aim: [260, 216] },
  ],
  kwiat: [
    { markup: BG, aim: [70, 60] },
    {
      markup:
        '<path d="M250 150H270V257H250Z"/><ellipse cx="212" cy="214" rx="42" ry="17" transform="rotate(-25 212 214)"/><ellipse cx="308" cy="204" rx="42" ry="17" transform="rotate(25 308 204)"/>',
      aim: [310, 204],
    },
    {
      markup: `<path d="${[0, 1, 2, 3, 4, 5]
        .map((i) =>
          circ(260 + Math.cos((i * Math.PI) / 3) * 58, 110 + Math.sin((i * Math.PI) / 3) * 58, 40),
        )
        .join('')}"/>`,
      aim: [260, 46],
    },
    { markup: `<path d="${circ(260, 110, 34)}"/>`, aim: [260, 110] },
  ],
  gora: [
    { markup: BG, aim: [90, 50] },
    { markup: `<path d="${circ(400, 76, 42)}"/>`, aim: [400, 76] },
    { markup: '<path d="M3 200L110 70L190 150L290 50L420 190L517 120V257H3Z"/>', aim: [290, 120] },
    { markup: bottom('M3 214Q130 156 260 204T517 196'), aim: [130, 228] },
  ],
  twarz: [
    { markup: BG, aim: [70, 60] },
    {
      markup:
        `<path d="${circ(260, 150, 92)}"/>` +
        ink(`<path d="${circ(222, 150, 11)}${circ(298, 150, 11)}"/>`),
      aim: [326, 170],
    },
    { markup: '<path d="M168 132C168 42 352 42 352 132Z"/>', aim: [260, 96] },
    {
      markup: '<path d="M330 118C390 108 440 118 454 134C420 148 370 144 330 138Z"/>',
      aim: [404, 128],
    },
    { markup: '<path d="M214 180Q260 238 306 180Z"/>', aim: [260, 198] },
  ],
  napis: [
    { markup: BG, aim: [44, 40] },
    ...(['B', 'U', 'D', 'S'] as const).map((letter, i) => ({
      markup: `<text x="${118 + i * 95}" y="206" font-family="Rubik Black" font-size="176" text-anchor="middle" stroke-width="8" paint-order="stroke" transform="rotate(${i % 2 === 0 ? -6 : 5} ${118 + i * 95} 140)">${letter}</text>`,
      aim: [118 + i * 95, 142] as [number, number],
    })),
  ],
  oko: [
    { markup: BG, aim: [50, 40] },
    {
      markup: `<path d="M${Array.from({ length: 32 }, (_, i) => {
        const a = (i / 32) * Math.PI * 2;
        const k = i % 2 === 0 ? 1 : 0.7;
        return `${n(260 + Math.cos(a) * 160 * k)} ${n(130 + Math.sin(a) * 118 * k)}`;
      }).join('L')}Z"/>`,
      aim: [384, 92],
    },
    { markup: '<path d="M140 130Q260 40 380 130Q260 220 140 130Z"/>', aim: [176, 130] },
    { markup: `<path d="${circ(260, 130, 50)}"/>`, aim: [234, 104] },
    { markup: `<path d="${circ(260, 130, 22)}"/>`, aim: [260, 130] },
  ],
  miasto: [
    { markup: BG, aim: [70, 40] },
    { markup: `<path d="${circ(436, 60, 30)}"/>`, aim: [436, 60] },
    ...(
      [
        [40, 92, 120],
        [190, 50, 130],
        [350, 120, 124],
      ] as const
    ).map(([x, y, w]) => {
      let windows = '';
      for (let wy = y + 18; wy < 214; wy += 30)
        for (let wx = x + 18; wx < x + w - 24; wx += 32) windows += rr(wx, wy, 14, 16, 3);
      return {
        markup: `<path d="M${x} ${y}H${x + w}V250H${x}Z"/>` + ink(`<path d="${windows}"/>`),
        aim: [x + w / 2, y + 40] as [number, number],
      };
    }),
    { markup: bottom('M3 226H517'), aim: [260, 242] },
  ],
};

/** One region of a mural: white with the ink contour, on the whole mural's canvas. */
export const muralRegion = (r: Region): FxArt => ({
  w: MURAL_W,
  h: MURAL_H,
  body: `<g fill="${WHITE}" stroke="${INK}" stroke-width="6" stroke-linejoin="round">${r.markup}</g>`,
});
