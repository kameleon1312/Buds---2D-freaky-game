// Minimal reader for the district map text format (see MapFormat.cs): just enough to know which cells block.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export type MapGrid = {
  id: string;
  w: number;
  h: number;
  solid: boolean[][];
  props: (string | null)[][];
};

export function mapPath(id: string) {
  return fileURLToPath(
    new URL(`../../../apps/unity/Assets/Buds/Resources/Maps/${id}.txt`, import.meta.url),
  );
}

export function readMap(id: string): MapGrid {
  const text = readFileSync(mapPath(id), 'utf8').replace(/\r/g, '');
  const legend = new Map<string, { solid: boolean; prop: string | null }>();
  const rows: string[] = [];
  let section = '';
  for (const raw of text.split('\n')) {
    if (section === 'grid' && raw.length > 0 && !raw.startsWith('[')) {
      rows.push(raw);
      continue;
    }
    const line = raw.split('//')[0]!.trim();
    if (!line) continue;
    if (line.startsWith('[') && line.endsWith(']')) {
      section = line.slice(1, -1);
      continue;
    }
    if (section === 'legend') {
      const def = line.slice(1).trim().slice(1).trim();
      const solid = def.endsWith('!');
      const plus = def.indexOf('+');
      const prop =
        plus < 0
          ? null
          : def
              .slice(plus + 1)
              .replace(/!$/, '')
              .trim();
      legend.set(line[0]!, { solid, prop });
    }
  }
  const solid = rows.map((r) => [...r].map((c) => legend.get(c)?.solid ?? true));
  const props = rows.map((r) => [...r].map((c) => legend.get(c)?.prop ?? null));
  return { id, w: [...rows[0]!].length, h: rows.length, solid, props };
}

export const walkable = (m: MapGrid, x: number, y: number) =>
  x >= 0 && y >= 0 && x < m.w && y < m.h && !m.solid[y]![x];

/** Walkable cells reachable from (sx, sy), with some cells treated as blocked. */
export function reachable(m: MapGrid, sx: number, sy: number, blocked: Set<string> = new Set()) {
  const seen = new Set<string>([`${sx},${sy}`]);
  const queue: [number, number][] = [[sx, sy]];
  while (queue.length) {
    const [x, y] = queue.pop()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const k = `${nx},${ny}`;
      if (seen.has(k) || blocked.has(k) || !walkable(m, nx, ny)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return seen;
}
