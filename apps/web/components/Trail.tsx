'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import type { BudLook, Facing, WalkFrame } from '@buds/shared';
import { BudSprite } from '@/components/BudSprite';

export type TrailStop = {
  id: string;
  kicker: string;
  title: string;
  text: string;
  /** a bit of Buds trivia shown under the text */
  fact: string;
  src: string;
  alt: string;
};

const FACINGS: Facing[] = ['down', 'side', 'up'];
const FRAMES: WalkFrame[] = [0, 1, 2];
// walk cycle: stand, left foot, stand, right foot; one step every STRIDE px walked, but never quicker than
// MIN_STEP ms a step, so a fast scroll is a brisk walk rather than flickering legs
const CYCLE: WalkFrame[] = [0, 1, 0, 2];
const STRIDE = 18;
const MIN_STEP = 85;
// how closely the bud follows the scroll (s): short enough to feel attached, long enough that a wheel notch is a
// few steps instead of a jump
const FOLLOW = 0.11;
// the bud puts its feet together once it has not moved for this long (ms)
const STAND = 120;

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
 * The journey as a street: it runs down one side of the page past a stop, crosses over to the other side, runs
 * down past the next stop, and so on to the finish. A bud walks it with the scroll: the scroll position maps onto a
 * point of the street at one fixed ratio, and the bud follows that point closely (a wheel notch becomes a few steps
 * rather than a jump), stepping with the distance walked and standing still when the reader stops. A stop opens while the bud is at it or past it (the screenshot and the story
 * slide in) and folds away again when the bud walks back. Without JavaScript every stop is simply shown and there
 * is no road.
 */
export function Trail({ stops, walker }: { stops: TrailStop[]; walker: BudLook }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trail = root.current;
    if (!trail) return;
    const svg = trail.querySelector<SVGSVGElement>('.trail-road')!;
    const paths = Array.from(svg.querySelectorAll<SVGPathElement>('.trail-road-path'));
    const marks = svg.querySelector<SVGGElement>('.trail-marks')!;
    const done = svg.querySelector<SVGPathElement>('.trail-road-done')!;
    const marker = trail.querySelector<HTMLDivElement>('.trail-marker')!;
    const goal = trail.querySelector<HTMLDivElement>('.trail-goal')!;
    const items = Array.from(trail.querySelectorAll<HTMLLIElement>('.stop'));

    let stopLens: number[] = [];
    let total = 0;
    let startY = 0;
    let endY = 1;
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
      startY = 100;
      const pts: [number, number][] = [[nodes[0]!.x, startY]];
      let radius = narrow ? 80 : 140;
      nodes.forEach((n, i) => {
        pts.push([n.x, n.top], [n.x, n.bottom]);
        const next = nodes[i + 1];
        if (!next) return;
        const mid = (n.bottom + next.top) / 2;
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
      const last = nodes[nodes.length - 1]!;
      endY = h - 96;
      pts.push([last.x, endY]);
      const d = roundedPath(pts, radius);

      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      svg.setAttribute('width', `${w}`);
      svg.setAttribute('height', `${h}`);
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
      goal.style.transform = `translate(${last.x}px, ${endY}px)`;
      goal.dataset.side = narrow ? 'left' : last.x > w / 2 ? 'right' : 'left';
      total = done.getTotalLength();
      done.style.strokeDasharray = `${total} ${total}`;

      // where along the street each stop is: the point closest to its number, a little before it
      stopLens = nodes.map((n) => {
        let best = 0;
        let bestDist = Infinity;
        for (let len = 0; len <= total; len += 4) {
          const p = done.getPointAtLength(len);
          const dist = Math.hypot(p.x - n.x, p.y - n.y);
          if (dist < bestDist) {
            bestDist = dist;
            best = len;
          }
        }
        return Math.max(0, best - (n.y - n.top - 60));
      });
      current = -1;
      update();
    };

    /** The point on the street for the current scroll position: one fixed ratio from start to finish. */
    const targetLength = () => {
      const box = trail.getBoundingClientRect();
      const y = window.innerHeight * 0.55 - box.top;
      const t = Math.min(1, Math.max(0, (y - startY) / (endY - startY)));
      return t * total;
    };

    const draw = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
      last = now;
      const target = targetLength();
      const prev = current;
      if (prev < 0 || reduce) current = target;
      else current += (target - current) * (1 - Math.exp(-dt / FOLLOW));
      if (Math.abs(target - current) < 0.3) current = target;
      const delta = prev < 0 ? 0 : current - prev;

      if (Math.abs(delta) > 0.05) {
        lastMove = now;
        // face along the street, the way the bud is going; turning only once the bend is clearly sideways or
        // clearly straight again, so it doesn't flicker between poses halfway round a corner
        const ahead = done.getPointAtLength(Math.min(total, current + 6));
        const behind = done.getPointAtLength(Math.max(0, current - 6));
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
      const frame = standing ? 0 : CYCLE[step % CYCLE.length]!;

      const p = done.getPointAtLength(current);
      marker.style.transform = `translate(${p.x}px, ${p.y}px)`;
      marker.dataset.facing = facing;
      marker.dataset.frame = String(frame);
      marker.classList.toggle('is-flipped', flip);
      done.style.strokeDashoffset = `${total - current}`;
      // a stop is open while the bud is at it or past it, and folds away again when the bud walks back
      stopLens.forEach((len, i) => items[i]!.classList.toggle('is-reached', current >= len));
      // keep going while catching up or until the feet are together
      if (current !== target || !standing) raf = requestAnimationFrame(draw);
      else last = 0;
    };

    const update = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };

    trail.classList.add('is-live');
    layout();
    const ro = new ResizeObserver(() => layout());
    ro.observe(trail);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="trail" ref={root}>
      <svg className="trail-road" aria-hidden>
        <path className="trail-road-path trail-road-curb" />
        <path className="trail-road-path trail-road-pavement" />
        <path className="trail-road-path trail-road-edge" />
        <path className="trail-road-path trail-road-base" />
        <path className="trail-road-path trail-road-dash" />
        <path className="trail-road-path trail-road-done" />
        <g className="trail-marks" />
      </svg>
      <div className="trail-marker" aria-hidden data-facing="down" data-frame="0">
        {FACINGS.map((f) =>
          FRAMES.map((fr) => (
            <span key={`${f}-${fr}`} className="trail-pose" data-facing={f} data-frame={fr}>
              <BudSprite look={walker} facing={f} frame={fr} height={96} />
            </span>
          )),
        )}
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
                    sizes="(max-width: 760px) 100vw, 520px"
                    className="device-shot is-active"
                  />
                </div>
              </div>
            </div>
            <div className="stop-copy">
              <p className="stop-kicker">{s.kicker}</p>
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
        <a href="#kreator" className="btn btn-primary">
          Meta: stwórz swojego Buda
        </a>
      </div>
    </div>
  );
}
