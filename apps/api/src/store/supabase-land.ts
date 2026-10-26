import type { SupabaseClient } from '@supabase/supabase-js';
import type { LandStore, LandTopRow } from './types.js';

type BudJoin = { slug: string; name: string; xp: number } | null;

/** The Supabase store's district part: writes through the SQL functions of migration 20261024000000_lands.sql. */
export function createSupabaseLand(
  db: SupabaseClient,
  idBySlug: (slug: string) => Promise<string>,
): LandStore {
  return {
    async getLand(slug) {
      const { data, error } = await db
        .from('bud_lands')
        .select('state, version')
        .eq('bud_id', await idBySlug(slug))
        .maybeSingle();
      if (error) throw error;
      return data ? { state: data.state as unknown, version: data.version as number } : null;
    },

    async landOnPlot(plot) {
      const { data, error } = await db
        .from('bud_lands')
        .select('state, version, bud:buds!bud_id(slug)')
        .eq('plot', plot)
        .maybeSingle();
      if (error) throw error;
      const row = data as unknown as {
        state: unknown;
        version: number;
        bud: { slug: string } | null;
      } | null;
      return row?.bud ? { slug: row.bud.slug, state: row.state, version: row.version } : null;
    },

    async landsOn(route) {
      const { data, error } = await db
        .from('bud_lands')
        .select('state, bud:buds!bud_id(slug, name, xp)')
        .eq('route', route)
        .limit(200);
      if (error) throw error;
      return ((data ?? []) as unknown as { state: unknown; bud: BudJoin }[])
        .filter((r) => r.bud)
        .map((r) => ({ slug: r.bud!.slug, name: r.bud!.name, xp: r.bud!.xp, state: r.state }));
    },

    async createLand(slug, plot, route, state, power, price) {
      const { data, error } = await db.rpc('create_land', {
        p_bud: await idBySlug(slug),
        p_plot: plot,
        p_route: route,
        p_state: state,
        p_power: power,
        p_price: price,
      });
      if (error) throw error;
      return data as { status: 'ok' | 'has_land' | 'taken' | 'poor'; coins: number };
    },

    async saveLand(slug, version, state, power, coinDelta) {
      const { data, error } = await db.rpc('save_land', {
        p_bud: await idBySlug(slug),
        p_version: version,
        p_state: state,
        p_power: power,
        p_coins: coinDelta,
      });
      if (error) throw error;
      return data as { status: 'ok' | 'conflict' | 'poor'; version?: number; coins: number };
    },

    async saveRaid(raider, defender) {
      const [a, d] = await Promise.all([idBySlug(raider.slug), idBySlug(defender.slug)]);
      const { data, error } = await db.rpc('save_raid', {
        p_raider: a,
        p_raider_version: raider.version,
        p_raider_state: raider.state,
        p_raider_power: raider.power,
        p_defender: d,
        p_defender_version: defender.version,
        p_defender_state: defender.state,
        p_defender_power: defender.power,
      });
      if (error) throw error;
      return data === 'ok' ? 'ok' : 'conflict';
    },

    async topLands(limit) {
      const { data, error } = await db
        .from('bud_lands')
        .select('route, power, district:state->>name, bud:buds!bud_id(slug, name, xp)')
        .order('power', { ascending: false })
        .limit(limit);
      if (error) throw error;
      type Row = { route: string; power: number; district: string | null; bud: BudJoin };
      return ((data ?? []) as unknown as Row[])
        .filter((r) => r.bud)
        .map((r): LandTopRow => ({
          slug: r.bud!.slug,
          name: r.bud!.name,
          xp: r.bud!.xp,
          district: r.district ?? '',
          route: r.route,
          power: r.power,
        }));
    },
  };
}
