'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Image from 'next/image';
import { budSheetSvg, type BudLook, type Facing, type WalkFrame } from '@buds/shared';
import { BudSprite } from '@/components/BudSprite';

export type Biome = 'wyspa' | 'miasto' | 'noc' | 'pustkowie' | 'dystrykt' | 'razem';

export type TrailStop = {
  id: string;
  title: string;
  text: string;
  /** a bit of Buds trivia shown under the text */
  fact: string;
  src: string;
  alt: string;
  biome: Biome;
};

/**
 * One thing along the road, from the game's own art or a bud: `x` is where across the page (0..1), `y` how far from
 * the middle of the road its feet stand (positive: behind the road, negative: in front of it, 0: on it).
 */
export type TrailProp = {
  /** a picture in public/world */
  art?: string;
  /** its size there, to keep its proportions */
  size?: [number, number];
  /** a bud instead of a picture */
  bud?: BudLook;
  /** width on the page, px */
  w: number;
  x: number;
  y: number;
  /** a line in a speech bubble, shown once the walker is near */
  say?: string;
  /** what happens as the walker reaches it */
  event?: 'fight' | 'ambush' | 'join';
  /** also shown on a phone, where there is little room */
  phone?: boolean;
};

const FACINGS: Facing[] = ['down', 'side', 'up'];
// walk cycle: stand, left foot, stand, right foot; one step every STRIDE px walked, but never quicker than
// MIN_STEP ms a step, so a fast scroll is a brisk walk rather than flickering legs
const CYCLE: WalkFrame[] = [0, 1, 0, 2];
const STRIDE = 18;
const MIN_STEP = 85;
// how closely the bud follows the scroll (s): it only softens a wheel notch into a few steps...
const FOLLOW = 0.045;
// ...and it is never further than this many px of road behind, however fast the page goes
const MAX_LAG = 48;
// the height of the screen where the bud walks (0..1)
const ANCHOR = 0.55;
// the bud puts its feet together once it has not moved for this long (ms)
const STAND = 120;
// things along the road rise this many px of road before the walker gets to them
const AHEAD = 300;
// the road's points are measured this far apart (px)
const SAMPLE = 8;
// the ones who joined keep this far behind on the road
const FOLLOW_GAP = 74;
// a part of the world starts this far above the middle of the crossing that leads into it
const GROUND_ABOVE = 196;

/** A path through the points with every corner rounded off by a circular arc of about `radius`. */
function roundedPath(pts: [number, number][], radius: number) {
  const fmt = (x: number, y: number) => `${x.toFixed(1)} ${y.toFixed(1)}`;
  let d = `M ${fmt(...pts[0]!)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i]!;
    const [ax, ay] = pts[i - 1]!;
    const [bx, by] = pts[i + 1]!;
    const la = Math.hypot(ax - px, ay - py);
    const lb = Math.hypot(bx - px, by - py);
    if (la < 0.5 || lb < 0.5) continue;
    const ux = (ax - px) / la;
    const uy = (ay - py) / la;
    const vx = (bx - px) / lb;
    const vy = (by - py) / lb;
    const angle = Math.acos(Math.max(-1, Math.min(1, ux * vx + uy * vy)));
    if (Math.PI - angle < 0.01) {
      d += ` L ${fmt(px, py)}`;
      continue;
    }
    // how far back from the corner the arc starts, and the radius that gives (shorter legs, tighter arc)
    const cut = Math.min(radius / Math.tan(angle / 2), la / 2, lb / 2);
    const r = cut * Math.tan(angle / 2);
    // turning clockwise on screen (y points down) is SVG's sweep 1
    const sweep = -ux * vy + uy * vx > 0 ? 1 : 0;
    d += ` L ${fmt(px + ux * cut, py + uy * cut)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 ${sweep} ${fmt(px + vx * cut, py + vy * cut)}`;
  }
  return `${d} L ${fmt(...pts[pts.length - 1]!)}`;
}

/**
 * A walker is one sprite sheet behind one small window; a step only moves the sheet. It starts as the vector drawing
 * and is swapped for pixels of the exact size on screen, so walking redraws nothing.
 */
function Walker({ look }: { look: BudLook }) {
  const pose = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = pose.current;
    if (!el) return;
    const url = `data:image/svg+xml,${encodeURIComponent(budSheetSvg(look))}`;
    el.style.backgroundImage = `url("${url}")`;
    const image = new window.Image();
    image.onload = () => {
      const scale = Math.min(3, window.devicePixelRatio || 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(el.offsetWidth * scale) * 3;
      canvas.height = Math.round(el.offsetHeight * scale) * 3;
      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob && pose.current) el.style.backgroundImage = `url("${URL.createObjectURL(blob)}")`;
      });
    };
    image.src = url;
  }, [look]);
  return <span className="trail-pose" ref={pose} />;
}

/** Shows one pose of a walker's sheet. */
function setPose(marker: HTMLElement, facing: Facing, frame: WalkFrame) {
  const key = `${facing}${frame}`;
  if (marker.dataset.pose === key) return;
  marker.dataset.pose = key;
  marker.dataset.frame = String(frame);
  marker.dataset.side = facing === 'side' ? '1' : '0';
  marker.style.setProperty('--pose-x', `${frame * 50}%`);
  marker.style.setProperty('--pose-y', `${FACINGS.indexOf(facing) * 50}%`);
}

function Prop({ prop, gap }: { prop: TrailProp; gap: number }) {
  return (
    <div
      className={`prop ${prop.phone ? 'prop-phone' : ''} ${prop.event ? `prop-${prop.event}` : ''}`}
      data-gap={gap}
      data-x={prop.x}
      data-y={prop.y}
      style={{ width: prop.w } as CSSProperties}
    >
      {prop.say && <p className="prop-say">{prop.say}</p>}
      {prop.art && prop.size && (
        <Image
          src={`/world/${prop.art}.png`}
          alt=""
          width={prop.size[0]}
          height={prop.size[1]}
          sizes={`${prop.w * 2}px`}
          loading="lazy"
        />
      )}
      {prop.bud && (
        <span className="prop-bud">
          <BudSprite look={prop.bud} height={Math.round((prop.w * 3) / 2)} />
        </span>
      )}
      {prop.event === 'fight' && (
        <>
          <Image className="prop-word" src="/world/fx-bam.png" alt="" width={360} height={250} />
          <Image className="prop-ko" src="/world/fx-ko.png" alt="" width={560} height={300} />
        </>
      )}
      {prop.event === 'ambush' && (
        <Image className="prop-word" src="/world/fx-lup.png" alt="" width={340} height={250} />
      )}
    </div>
  );
}

/**
 * The journey as a street through the whole game: it runs down one side of the page past a stop, crosses over to the
 * other side, runs down past the next stop, and so on to the finish. Every stretch is its own part of the world: the
 * ground of the page, the pavement and the asphalt change with it, and things from the game's art rise along the road
 * as the bud nears them (the island's palms, a town, the night street where a rival waits, a wasteland with someone in
 * the bushes, a district that gets built one building at a time, a crowd where two buds join in and walk along).
 * A bud walks it with the scroll: along a stop it stands exactly at the same height of the screen, 1:1 with the page,
 * and it takes each crossing over the scroll of the gap between two stops, so the same scroll is always the same place
 * of the story, either way. It steps with the distance walked and stands still when the reader stops. Without
 * JavaScript every stop is simply shown and there is no road.
 */
export function Trail({
  stops,
  walker,
  friends,
  scenes,
}: {
  stops: TrailStop[];
  walker: BudLook;
  /** the two who join the walker at the crowd */
  friends: [BudLook, BudLook];
  /** what stands along the road before each stop, and one more for the finish */
  scenes: TrailProp[][];
}) {
  const root = useRef<HTMLDivElement>(null);
  // the walkers' many poses are drawn only in the browser: nothing to walk without JavaScript, and a lighter page
  const [live, setLive] = useState(false);

  useEffect(() => {
    setLive(true);
    const trail = root.current;
    if (!trail) return;
    const svg = trail.querySelector<SVGSVGElement>('.trail-road')!;
    const top = trail.querySelector<SVGSVGElement>('.trail-road-top')!;
    const paths = Array.from(trail.querySelectorAll<SVGPathElement>('.trail-road-path'));
    const segPave = svg.querySelector<SVGGElement>('.segs-pave')!;
    const segBase = svg.querySelector<SVGGElement>('.segs-base')!;
    const marks = top.querySelector<SVGGElement>('.trail-marks')!;
    const done = top.querySelector<SVGPathElement>('.trail-road-done')!;
    const marker = trail.querySelector<HTMLDivElement>('.trail-marker-me')!;
    const followers = Array.from(trail.querySelectorAll<HTMLDivElement>('.trail-marker-friend'));
    const goal = trail.querySelector<HTMLDivElement>('.trail-goal')!;
    const items = Array.from(trail.querySelectorAll<HTMLLIElement>('.stop'));
    const biomes = Array.from(trail.querySelectorAll<HTMLDivElement>('.biome'));
    const props = Array.from(trail.querySelectorAll<HTMLDivElement>('.prop'));

    let stopLens: number[] = [];
    let propLens: number[] = [];
    let eventLens: number[] = [];
    let joinLen = Infinity;
    let rideFrom = Infinity;
    let rideTo = -1;
    let total = 0;
    let startY = 0;
    let endY = 1;
    // where on the road the bud is when the page's height y is at the anchor: pairs of (y, length), y growing
    let keys: { y: number; len: number }[] = [];
    let anchorY = document.documentElement.clientHeight * ANCHOR;
    let seenW = window.innerWidth;
    let seenH = window.innerHeight;
    let dashed = -1;
    let current = -1;
    let raf = 0;
    let last = 0;
    let phase = 0;
    let step = 0;
    let lastStep = 0;
    let lastMove = 0;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let facing: Facing = 'down';
    let flip = false;

    /** Points along the road, measured once per layout: asking the path each time is slow. */
    let samples: { x: number; y: number; len: number }[] = [];

    /** A point of the road at a length, from the samples. */
    const pointAt = (len: number) => {
      const at = Math.min(samples.length - 1, Math.max(0, len / SAMPLE));
      const i = Math.min(samples.length - 2, Math.floor(at));
      const a = samples[i]!;
      const b = samples[i + 1] ?? a;
      const t = at - i;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    };

    /** The road's length nearest to a point of the page. */
    const nearest = (x: number, y: number) => {
      let best = 0;
      let bestDist = Infinity;
      for (const p of samples) {
        const dist = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          best = p.len;
        }
      }
      return best;
    };

    /** Rebuilds the street from where the stops ended up (on load and whenever the layout changes). */
    const layout = () => {
      const box = trail.getBoundingClientRect();
      const w = box.width;
      const h = trail.scrollHeight;
      const narrow = w < 720;
      const nodes = items.map((li) => {
        const r = li.getBoundingClientRect();
        const n = li.querySelector('.stop-node')!.getBoundingClientRect();
        return {
          x: n.left + n.width / 2 - box.left,
          y: n.top + n.height / 2 - box.top,
          top: r.top - box.top,
          bottom: r.bottom - box.top,
        };
      });
      if (!nodes.length) return;

      // the street starts a little below the heading so the bud never stands on the text
      startY = 60;
      const pts: [number, number][] = [[nodes[0]!.x, startY]];
      let radius = narrow ? 80 : 140;
      const mids: number[] = [];
      nodes.forEach((n, i) => {
        pts.push([n.x, n.top], [n.x, n.bottom]);
        const next = nodes[i + 1];
        if (!next) return;
        const mid = (n.bottom + next.top) / 2;
        mids.push(mid);
        if (narrow) {
          // one side only on a phone: a gentle wiggle between the stops
          const g = next.top - n.bottom;
          pts.push([n.x - 14, n.bottom + g * 0.35], [n.x + 14, n.bottom + g * 0.65]);
        } else {
          // across to the other side, with turns as round as the gap allows
          pts.push([n.x, mid], [next.x, mid]);
          radius = Math.min(radius, (next.top - n.bottom) / 2 - 4);
        }
      });
      const lastNode = nodes[nodes.length - 1]!;
      endY = h - 150;
      pts.push([lastNode.x, endY]);
      const d = roundedPath(pts, radius);

      for (const layer of [svg, top]) {
        layer.setAttribute('viewBox', `0 0 ${w} ${h}`);
        layer.setAttribute('width', `${w}`);
        layer.setAttribute('height', `${h}`);
      }
      paths.forEach((p) => p.setAttribute('d', d));
      // a zebra crossing on the street just before every stop
      const half = narrow ? 11 : 18;
      const bar = narrow ? 4 : 6;
      marks.innerHTML = nodes
        .map((n) => {
          const bars = [];
          for (let x = n.x - half; x + bar <= n.x + half + 0.5; x += bar * 2)
            bars.push(
              `<rect x="${x.toFixed(1)}" y="${n.top + 12}" width="${bar}" height="${narrow ? 14 : 22}"/>`,
            );
          return bars.join('');
        })
        .join('');
      // the finish sits at the end of the street, on whichever side that is
      goal.style.transform = `translate(${lastNode.x}px, ${endY}px)`;
      goal.dataset.side = narrow ? 'left' : lastNode.x > w / 2 ? 'right' : 'left';
      total = done.getTotalLength();
      done.style.strokeDasharray = `${total} ${total}`;
      samples = [];
      for (let len = 0; len <= total + SAMPLE; len += SAMPLE) {
        const p = done.getPointAtLength(Math.min(total, len));
        samples.push({ x: p.x, y: p.y, len });
      }
      dashed = -1;
      // along a stop the road runs straight down, one to one with the page; a crossing is spread over its gap
      keys = [{ y: startY, len: 0 }];
      for (const n of nodes) {
        keys.push(
          { y: n.top, len: nearest(n.x, n.top) },
          { y: n.bottom, len: nearest(n.x, n.bottom) },
        );
      }
      keys.push({ y: endY, len: total });

      // every part of the world fills the whole width of the page, from the middle of one crossing to the next
      const fullLeft = -box.left;
      const fullWidth = document.documentElement.clientWidth;
      biomes.forEach((b, i) => {
        // it begins well above the road, so what stands behind the crossing stands on its own ground
        const top = i === 0 ? 0 : mids[i - 1]! - GROUND_ABOVE;
        const bottom = i === biomes.length - 1 ? h : mids[i]! - GROUND_ABOVE;
        b.style.left = `${fullLeft}px`;
        b.style.width = `${fullWidth}px`;
        b.style.top = `${top}px`;
        b.style.height = `${bottom - top}px`;
      });
      // and the road takes on its ground: the same path, showing only that stretch
      const lens = mids.map((m, i) => nearest(nodes[i]!.x, m - (narrow ? 0 : radius)));
      const seg = (a: number, b: number, biome: string, cls: string) =>
        `<path class="seg ${cls} seg-${biome}" d="${d}" stroke-dasharray="0 ${a.toFixed(1)} ${(b - a).toFixed(1)} ${(total * 2).toFixed(0)}"/>`;
      const bounds = [0, ...lens, total];
      const names = stops.map((s) => s.biome);
      segPave.innerHTML = names
        .map((n, i) => seg(bounds[i]!, bounds[i + 1]!, n, 'seg-pave'))
        .join('');
      segBase.innerHTML = names
        .map((n, i) => seg(bounds[i]!, bounds[i + 1]!, n, 'seg-base'))
        .join('');

      // the things along the road stand at their spots around each crossing
      propLens = props.map((el) => {
        const g = Number(el.dataset.gap);
        const x = Number(el.dataset.x) * w;
        const y = Number(el.dataset.y);
        const hidden = narrow && !el.classList.contains('prop-phone');
        el.hidden = hidden;
        if (hidden) return Infinity;
        const road =
          g === 0
            ? Math.min(nodes[0]!.top - 100, 250)
            : g >= nodes.length
              ? endY - 60
              : mids[g - 1]!;
        // on a phone there is only the right of the street
        const left = narrow ? Math.max(nodes[0]!.x + 40, x) : x;
        el.style.left = `${left}px`;
        el.style.top = `${road - y}px`;
        return nearest(left, road);
      });
      // what happens at the rival and in the bushes, a little before the walker is on them
      eventLens = propLens.slice();
      const joiner = props.findIndex((el) => el.classList.contains('prop-join'));
      joinLen = joiner >= 0 ? propLens[joiner]! : Infinity;
      // the wastelands' stretch is ridden on a board
      const wild = names.indexOf('pustkowie');
      rideFrom = wild >= 0 ? bounds[wild]! : Infinity;
      rideTo = wild >= 0 ? bounds[wild + 1]! : -1;

      // where along the street each stop is: the point closest to its number, a little before it
      stopLens = nodes.map((n) => Math.max(0, nearest(n.x, n.y) - (n.y - n.top - 60)));
      current = -1;
      update();
    };

    /** The point on the street for the current scroll position: one fixed ratio from start to finish. */
    const targetLength = () => {
      const box = trail.getBoundingClientRect();
      const y = anchorY - box.top;
      if (y <= startY) return 0;
      for (let i = 1; i < keys.length; i++) {
        const a = keys[i - 1]!;
        const b = keys[i]!;
        if (y <= b.y) return a.len + ((b.len - a.len) * (y - a.y)) / Math.max(1, b.y - a.y);
      }
      return total;
    };

    const draw = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
      last = now;
      const target = targetLength();
      const prev = current;
      if (prev < 0 || reduce) current = target;
      else current += (target - current) * (1 - Math.exp(-dt / FOLLOW));
      if (Math.abs(target - current) > MAX_LAG)
        current = target - Math.sign(target - current) * MAX_LAG;
      if (Math.abs(target - current) < 0.3) current = target;
      const delta = prev < 0 ? 0 : current - prev;

      if (Math.abs(delta) > 0.05) {
        lastMove = now;
        // face along the street, the way the bud is going; turning only once the bend is clearly sideways or
        // clearly straight again, so it doesn't flicker between poses halfway round a corner
        const ahead = pointAt(current + 6);
        const behind = pointAt(current - 6);
        const dir = delta < 0 ? -1 : 1;
        const dx = (ahead.x - behind.x) * dir;
        const dy = (ahead.y - behind.y) * dir;
        if (
          facing === 'side' ? Math.abs(dy) > Math.abs(dx) * 1.4 : Math.abs(dx) > Math.abs(dy) * 1.4
        )
          facing = facing === 'side' ? (dy > 0 ? 'down' : 'up') : 'side';
        else if (facing !== 'side') facing = dy > 0 ? 'down' : 'up';
        if (facing === 'side' && Math.abs(dx) > 0.5) flip = dx > 0;
        // steps follow the distance walked, one at a time
        phase = Math.min(phase + Math.abs(delta) / STRIDE, step + 1);
        if (phase >= step + 1 && now - lastStep >= MIN_STEP) {
          step += 1;
          lastStep = now;
        }
      }
      const standing = now - lastMove > STAND;
      if (standing) phase = step = Math.ceil(step / 2) * 2; // next step starts from feet together
      // on the board the feet stay put
      const riding = current >= rideFrom && current < rideTo;
      const frame = standing || riding ? 0 : CYCLE[step % CYCLE.length]!;

      const p = pointAt(current);
      marker.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
      setPose(marker, facing, frame);
      marker.classList.toggle('is-flipped', flip);
      marker.classList.toggle('is-riding', riding);
      // the walked line lives on its own layer and is redrawn only when it has grown visibly
      if (Math.abs(current - dashed) >= 2 || current === target) {
        dashed = current;
        done.style.strokeDashoffset = `${total - current}`;
      }

      // the two from the crowd walk along behind once they have joined
      followers.forEach((f, i) => {
        const at = current - FOLLOW_GAP * (i + 1);
        const on = current >= joinLen && at > 0;
        f.classList.toggle('is-on', on);
        if (!on) return;
        const fp = pointAt(at);
        const a = pointAt(at + 6);
        const b = pointAt(at - 6);
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const side = Math.abs(dx) > Math.abs(dy);
        f.style.transform = `translate3d(${fp.x}px, ${fp.y}px, 0)`;
        setPose(
          f,
          side ? 'side' : dy > 0 ? 'down' : 'up',
          standing ? 0 : CYCLE[(step + i + 1) % CYCLE.length]!,
        );
        f.classList.toggle('is-flipped', side && dx > 0);
      });

      // a stop is open while the bud is at it or past it, and folds away again when the bud walks back
      stopLens.forEach((len, i) => items[i]!.classList.toggle('is-reached', current >= len));
      // things rise as the walker nears them; the rival and the ambusher act when it is on them
      props.forEach((el, i) => {
        el.classList.toggle('is-up', current >= propLens[i]! - AHEAD);
        el.classList.toggle('is-met', current >= eventLens[i]! - 34);
      });
      goal.classList.toggle('is-reached', current >= total - 30);
      // keep going while catching up or until the feet are together
      if (current !== target || !standing) raf = requestAnimationFrame(draw);
      else last = 0;
    };

    const update = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };

    // a phone's address bar sliding away is not a new screen: the bud must not jump because of it
    const resized = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w !== seenW || Math.abs(h - seenH) > 120) {
        seenW = w;
        seenH = h;
        anchorY = document.documentElement.clientHeight * ANCHOR;
      }
      update();
    };

    trail.classList.add('is-live');
    layout();
    // only a real change of size is worth working the whole road out again
    let seen = '';
    const ro = new ResizeObserver(() => {
      const r = trail.getBoundingClientRect();
      const size = `${Math.round(r.width)}x${Math.round(r.height)}`;
      if (size === seen) return;
      seen = size;
      layout();
    });
    ro.observe(trail);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', resized);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', resized);
      cancelAnimationFrame(raf);
    };
    // stops and scenes are constants of the page
  }, []);

  return (
    <div className="trail" ref={root}>
      {stops.map((s) => (
        <div key={s.id} className={`biome biome-${s.biome}`} aria-hidden>
          {s.biome === 'wyspa' && <span className="biome-island" />}
        </div>
      ))}
      <div className="trail-back" aria-hidden>
        {scenes.map((scene, gap) =>
          scene
            .filter((p) => p.y > 0)
            .map((p, i) => <Prop key={`${gap}-${i}`} prop={p} gap={gap} />),
        )}
      </div>
      <svg className="trail-road" aria-hidden>
        <path className="trail-road-path trail-road-curb" />
        <path className="trail-road-path trail-road-pavement" />
        <g className="segs-pave" />
        <path className="trail-road-path trail-road-edge" />
        <path className="trail-road-path trail-road-base" />
        <g className="segs-base" />
        <path className="trail-road-path trail-road-dash" />
      </svg>
      <svg className="trail-road trail-road-top" aria-hidden>
        <path className="trail-road-path trail-road-done" />
        <g className="trail-marks" />
      </svg>
      <div className="trail-front" aria-hidden>
        {scenes.map((scene, gap) =>
          scene
            .filter((p) => p.y <= 0)
            .map((p, i) => <Prop key={`${gap}-${i}`} prop={p} gap={gap} />),
        )}
      </div>

      {friends.map((look, i) => (
        <div key={i} className="trail-marker trail-marker-friend" aria-hidden data-frame="0">
          {live && <Walker look={look} />}
        </div>
      ))}
      <div className="trail-marker trail-marker-me" aria-hidden data-frame="0">
        <Image className="trail-board" src="/world/tr-deska.png" alt="" width={68} height={184} />
        {live && <Walker look={walker} />}
      </div>

      <ol className="trail-stops">
        {stops.map((s, i) => (
          <li key={s.id} className={`stop ${i % 2 ? 'is-flipped' : ''}`}>
            <div className="stop-node" aria-hidden>
              <span>{i + 1}</span>
            </div>
            <div className="stop-shot">
              <div className="device">
                <div className="device-screen">
                  <Image
                    src={s.src}
                    alt={s.alt}
                    width={1200}
                    height={521}
                    sizes="(max-width: 760px) 100vw, 560px"
                    className="device-shot is-active"
                  />
                </div>
              </div>
            </div>
            <div className="stop-copy">
              <h3>{s.title}</h3>
              <p>{s.text}</p>
              <aside className="stop-fact">
                <strong>Ciekawostka</strong>
                <span>{s.fact}</span>
              </aside>
            </div>
          </li>
        ))}
      </ol>

      <div className="trail-goal">
        <Image
          className="trail-goal-tag"
          src="/world/fx-wygrana.png"
          alt=""
          width={780}
          height={290}
        />
        <a href="#kreator" className="btn btn-primary btn-big">
          Stwórz swojego Buda
        </a>
      </div>
    </div>
  );
}
