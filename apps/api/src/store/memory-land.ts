import type { BudRecord } from '@buds/shared';
import type { LandStore, LandTopRow } from './types.js';

/** The memory store's district part; mirrors the SQL functions of migration 20261024000000_lands.sql. */
export function createMemoryLand({
  buds,
  coins,
}: {
  buds: Map<string, BudRecord>;
  coins: Map<string, number>;
}): LandStore {
  const lands = new Map<
    string,
    { plot: string; route: string; state: unknown; version: number; power: number }
  >();
  const copy = <T>(v: T): T => structuredClone(v);

  return {
    async getLand(slug) {
      const row = lands.get(slug);
      return row ? { state: copy(row.state), version: row.version } : null;
    },

    async landOnPlot(plot) {
      for (const [slug, row] of lands)
        if (row.plot === plot) return { slug, state: copy(row.state), version: row.version };
      return null;
    },

    async landsOn(route) {
      const out: { slug: string; name: string; xp: number; state: unknown }[] = [];
      for (const [slug, row] of lands) {
        const bud = buds.get(slug);
        if (row.route === route && bud)
          out.push({ slug, name: bud.name, xp: bud.xp, state: copy(row.state) });
      }
      return out;
    },

    async createLand(slug, plot, route, state, power, price) {
      const balance = coins.get(slug) ?? 0;
      if (lands.has(slug)) return { status: 'has_land', coins: balance };
      if ([...lands.values()].some((r) => r.plot === plot))
        return { status: 'taken', coins: balance };
      if (balance < price) return { status: 'poor', coins: balance };
      lands.set(slug, { plot, route, state: copy(state), version: 0, power: Math.max(0, power) });
      coins.set(slug, balance - price);
      return { status: 'ok', coins: balance - price };
    },

    async saveLand(slug, version, state, power, coinDelta) {
      const balance = coins.get(slug) ?? 0;
      if (balance + coinDelta < 0) return { status: 'poor', coins: balance };
      const row = lands.get(slug);
      if (!row || row.version !== version) return { status: 'conflict', coins: balance };
      row.state = copy(state);
      row.power = Math.max(0, power);
      row.version = version + 1;
      coins.set(slug, balance + coinDelta);
      return { status: 'ok', version: row.version, coins: balance + coinDelta };
    },

    async saveRaid(raider, defender) {
      const a = lands.get(raider.slug);
      const d = lands.get(defender.slug);
      if (!a || !d || a.version !== raider.version || d.version !== defender.version)
        return 'conflict';
      for (const [row, save] of [
        [a, raider],
        [d, defender],
      ] as const) {
        row.state = copy(save.state);
        row.power = Math.max(0, save.power);
        row.version += 1;
      }
      return 'ok';
    },

    async topLands(limit) {
      const rows: LandTopRow[] = [];
      for (const [slug, row] of lands) {
        const bud = buds.get(slug);
        if (bud)
          rows.push({
            slug,
            name: bud.name,
            xp: bud.xp,
            district: (row.state as { name?: string }).name ?? '',
            route: row.route,
            power: row.power,
          });
      }
      return rows.sort((a, b) => b.power - a.power || a.slug.localeCompare(b.slug)).slice(0, limit);
    },
  };
}
