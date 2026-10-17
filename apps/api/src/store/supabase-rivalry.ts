import type { SupabaseClient } from '@supabase/supabase-js';
import type { BudRecord } from '@buds/shared';
import type {
  CrewStatus,
  ListingRecord,
  ListStatus,
  MarketBuyStatus,
  RivalryStore,
} from './types.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LISTING = 'id, item_id, price, created_at, seller:buds!seller_id(slug, name)';

type Named = { slug: string; name: string };
type ListingRow = {
  id: string;
  item_id: string;
  price: number;
  created_at: string;
  seller: Named | null;
};

const toListing = (r: ListingRow): ListingRecord | null =>
  r.seller
    ? { id: r.id, itemId: r.item_id, price: r.price, seller: r.seller, createdAt: r.created_at }
    : null;

/** The Supabase store's rivalry part: writes through the SQL functions of migration 20261017000000_rivalry.sql. */
export function createSupabaseRivalry(
  db: SupabaseClient,
  idBySlug: (slug: string) => Promise<string>,
  budRows: (query: { minXp: number; maxXp: number; limit: number }) => Promise<BudRecord[]>,
): RivalryStore {
  async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await db.rpc(fn, args);
    if (error) throw error;
    return data as T;
  }

  /** Bud ids by slug (unknown slugs are absent). */
  async function ids(slugs: readonly string[]): Promise<Map<string, string>> {
    if (slugs.length === 0) return new Map();
    const { data, error } = await db
      .from('buds')
      .select('id, slug')
      .in('slug', [...slugs]);
    if (error) throw error;
    return new Map((data as { id: string; slug: string }[]).map((r) => [r.id, r.slug]));
  }

  return {
    async addInfluence(slug, turf, week, day, points, cap, min, challenge) {
      return rpc('add_influence', {
        p_bud: await idBySlug(slug),
        p_turf: turf,
        p_week: week,
        p_day: day,
        p_points: points,
        p_cap: cap,
        p_min: min,
        p_challenge: challenge,
      });
    },

    async bumpChallenge(slug, week, challenge) {
      return rpc('bump_challenge', {
        p_bud: await idBySlug(slug),
        p_week: week,
        p_challenge: challenge,
      });
    },

    async turfBoards(turfs, week) {
      if (turfs.length === 0) return [];
      const { data, error } = await db
        .from('rival_influence')
        .select('turf_id, points, buds(slug, name)')
        .in('turf_id', [...turfs])
        .eq('week', week)
        .gt('points', 0)
        .order('points', { ascending: false })
        .order('updated_at', { ascending: true })
        .limit(5000);
      if (error) throw error;
      return (data as unknown as { turf_id: string; points: number; buds: Named | null }[])
        .filter((r) => r.buds)
        .map((r) => ({
          turf: r.turf_id,
          slug: r.buds!.slug,
          name: r.buds!.name,
          points: r.points,
        }));
    },

    async claimTribute(slug, turf, week, day, coins, min) {
      return rpc('claim_tribute', {
        p_bud: await idBySlug(slug),
        p_turf: turf,
        p_week: week,
        p_day: day,
        p_coins: coins,
        p_min: min,
      });
    },

    async tributesClaimed(slug, day) {
      const { data, error } = await db
        .from('rival_tributes')
        .select('turf_id')
        .eq('bud_id', await idBySlug(slug))
        .eq('day', day);
      if (error) throw error;
      return (data as { turf_id: string }[]).map((r) => r.turf_id);
    },

    async settleWeek(week, min, turfCoins, topCoins) {
      return rpc('settle_week', {
        p_week: week,
        p_min: min,
        p_turf_coins: turfCoins,
        p_top_coins: [...topCoins],
      });
    },

    async titles(slug) {
      const { data, error } = await db
        .from('rival_titles')
        .select('week, title')
        .eq('bud_id', await idBySlug(slug))
        .order('week', { ascending: false });
      if (error) throw error;
      return data as { week: string; title: string }[];
    },

    async weekTotals(week, limit) {
      const rows = await rpc<{ slug: string; name: string; xp: number; points: number }[]>(
        'rival_week_totals',
        { p_week: week, p_limit: limit },
      );
      return rows.map((r) => ({ ...r, points: Number(r.points) }));
    },

    async weekStanding(slug, week) {
      const rows = await rpc<{ points: number; rank: number | null }[]>('rival_week_standing', {
        p_bud: await idBySlug(slug),
        p_week: week,
      });
      const r = rows[0];
      return { points: Number(r?.points ?? 0), rank: r?.rank == null ? null : Number(r.rank) };
    },

    async challengeLeaders(week, challenge, limit) {
      const { data, error } = await db
        .from('rival_counters')
        .select('count, buds(slug, name)')
        .eq('week', week)
        .eq('challenge', challenge)
        .gt('count', 0)
        .order('count', { ascending: false })
        .order('updated_at', { ascending: true })
        .limit(limit);
      if (error) throw error;
      return (data as unknown as { count: number; buds: Named | null }[])
        .filter((r) => r.buds)
        .map((r) => ({ slug: r.buds!.slug, name: r.buds!.name, count: r.count }));
    },

    async challengeStanding(slug, week) {
      const rows = await rpc<{ challenge: string; count: number; rank: number }[]>(
        'rival_challenge_standing',
        { p_bud: await idBySlug(slug), p_week: week },
      );
      return rows.map((r) => ({ challenge: r.challenge, count: r.count, rank: Number(r.rank) }));
    },

    async createCrew(slug, name, tag) {
      return rpc<CrewStatus>('create_crew', {
        p_bud: await idBySlug(slug),
        p_name: name,
        p_tag: tag,
      });
    },

    async joinCrew(slug, tag, max) {
      return rpc<CrewStatus>('join_crew', { p_bud: await idBySlug(slug), p_tag: tag, p_max: max });
    },

    async leaveCrew(slug) {
      return rpc<boolean>('leave_crew', { p_bud: await idBySlug(slug) });
    },

    async crewOf(slug) {
      const { data, error } = await db
        .from('crew_members')
        .select('crews(tag, name)')
        .eq('bud_id', await idBySlug(slug))
        .maybeSingle();
      if (error) throw error;
      return (
        (data as unknown as { crews: { tag: string; name: string } | null } | null)?.crews ?? null
      );
    },

    async crewByTag(tag) {
      const { data: crew, error } = await db
        .from('crews')
        .select('id, tag, name')
        .eq('tag', tag)
        .maybeSingle();
      if (error) throw error;
      if (!crew) return null;
      const { data, error: membersError } = await db
        .from('crew_members')
        .select('role, joined_at, buds(slug, name, xp)')
        .eq('crew_id', (crew as { id: string }).id)
        .order('joined_at', { ascending: true });
      if (membersError) throw membersError;
      const members = (
        data as unknown as {
          role: 'leader' | 'member';
          buds: { slug: string; name: string; xp: number } | null;
        }[]
      )
        .filter((m) => m.buds)
        .map((m) => ({ ...m.buds!, role: m.role }))
        .sort((a, b) => (a.role === b.role ? 0 : a.role === 'leader' ? -1 : 1));
      const c = crew as { tag: string; name: string };
      return { tag: c.tag, name: c.name, members };
    },

    async crews(limit) {
      const rows = await rpc<{ tag: string; name: string; members: number }[]>('crew_list', {
        p_limit: limit,
      });
      return rows.map((r) => ({ ...r, members: Number(r.members) }));
    },

    async crewTags(slugs) {
      const bySlug = await ids(slugs);
      const out = new Map<string, string>();
      if (bySlug.size === 0) return out;
      const { data, error } = await db
        .from('crew_members')
        .select('bud_id, crews(tag)')
        .in('bud_id', [...bySlug.keys()]);
      if (error) throw error;
      for (const r of data as unknown as { bud_id: string; crews: { tag: string } | null }[])
        if (r.crews) out.set(bySlug.get(r.bud_id)!, r.crews.tag);
      return out;
    },

    async crewWeekTotals(week, limit) {
      const rows = await rpc<{ tag: string; name: string; points: number; members: number }[]>(
        'crew_week_totals',
        { p_week: week, p_limit: limit },
      );
      return rows.map((r) => ({ ...r, points: Number(r.points), members: Number(r.members) }));
    },

    async ratings(slugs) {
      const bySlug = await ids(slugs);
      const out = new Map<string, { rating: number; wins: number; losses: number }>();
      if (bySlug.size === 0) return out;
      const { data, error } = await db
        .from('pvp_ratings')
        .select('bud_id, rating, wins, losses')
        .in('bud_id', [...bySlug.keys()]);
      if (error) throw error;
      for (const r of data as { bud_id: string; rating: number; wins: number; losses: number }[])
        out.set(bySlug.get(r.bud_id)!, { rating: r.rating, wins: r.wins, losses: r.losses });
      return out;
    },

    async budsAround(minXp, maxXp, limit) {
      return budRows({ minXp, maxXp, limit });
    },

    async pvpLastChallenges(slug) {
      const { data, error } = await db
        .from('pvp_challenges')
        .select('last_at, opponent:buds!opponent_id(slug)')
        .eq('bud_id', await idBySlug(slug));
      if (error) throw error;
      const out = new Map<string, Date>();
      for (const r of data as unknown as { last_at: string; opponent: { slug: string } | null }[])
        if (r.opponent) out.set(r.opponent.slug, new Date(r.last_at));
      return out;
    },

    async pvpChallenge(slug, opponent, cooldownSeconds) {
      return rpc<boolean>('pvp_challenge', {
        p_bud: await idBySlug(slug),
        p_opponent: await idBySlug(opponent),
        p_cooldown: cooldownSeconds,
      });
    },

    async pvpWin(winner, loser, delta, day, coins, paidWins) {
      return rpc('pvp_result', {
        p_winner: await idBySlug(winner),
        p_loser: await idBySlug(loser),
        p_delta: delta,
        p_day: day,
        p_coins: coins,
        p_paid: paidWins,
      });
    },

    async pvpLoss(loser, winner, delta) {
      return rpc<number>('pvp_loss', {
        p_loser: await idBySlug(loser),
        p_winner: await idBySlug(winner),
        p_delta: delta,
      });
    },

    async pvpLeaders(limit) {
      const { data, error } = await db
        .from('pvp_ratings')
        .select('rating, buds(slug, name)')
        .order('rating', { ascending: false })
        .order('wins', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data as unknown as { rating: number; buds: Named | null }[])
        .filter((r) => r.buds)
        .map((r) => ({ slug: r.buds!.slug, name: r.buds!.name, rating: r.rating }));
    },

    async pvpWinsToday(slug, day) {
      const { data, error } = await db
        .from('pvp_daily')
        .select('wins')
        .eq('bud_id', await idBySlug(slug))
        .eq('day', day)
        .maybeSingle();
      if (error) throw error;
      return (data as { wins: number } | null)?.wins ?? 0;
    },

    async marketList(slug, itemId, price, max) {
      return rpc<{ status: ListStatus; id?: string }>('market_list', {
        p_bud: await idBySlug(slug),
        p_item: itemId,
        p_price: price,
        p_max: max,
      });
    },

    async marketCancel(slug, id) {
      if (!UUID.test(id)) return false;
      return rpc<boolean>('market_cancel', { p_bud: await idBySlug(slug), p_listing: id });
    },

    async marketBuy(slug, id, fee) {
      const budId = await idBySlug(slug);
      if (!UUID.test(id)) {
        const { data } = await db
          .from('bud_wallets')
          .select('coins')
          .eq('bud_id', budId)
          .maybeSingle();
        return { status: 'gone', coins: (data as { coins: number } | null)?.coins ?? 0 };
      }
      const r = await rpc<{ status: MarketBuyStatus; coins: number | null }>('market_buy', {
        p_bud: budId,
        p_listing: id,
        p_fee: fee,
      });
      return { status: r.status, coins: r.coins ?? 0 };
    },

    async listings(limit) {
      const { data, error } = await db
        .from('market_listings')
        .select(LISTING)
        .is('sold_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data as unknown as ListingRow[])
        .map(toListing)
        .filter((l): l is ListingRecord => l !== null);
    },

    async listing(id) {
      if (!UUID.test(id)) return null;
      const { data, error } = await db
        .from('market_listings')
        .select(LISTING)
        .eq('id', id)
        .is('sold_at', null)
        .maybeSingle();
      if (error) throw error;
      return data ? toListing(data as unknown as ListingRow) : null;
    },
  };
}
