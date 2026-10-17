import { randomUUID } from 'node:crypto';
import type { BudRecord, OwnedItem, SlotId } from '@buds/shared';
import { RATING_START } from '@buds/shared';
import type { ListingRecord, RivalryStore } from './types.js';

/** What the rivalry part of the memory store shares with the rest of it. */
export type MemoryShared = {
  now: () => Date;
  buds: Map<string, BudRecord>;
  coins: Map<string, number>;
  owned: Map<string, OwnedItem[]>;
  gear: Map<string, Map<SlotId, string>>;
};

type Row = { points: number; at: number };

/** The memory store's rivalry part; mirrors the SQL functions of migration 20261017000000_rivalry.sql. */
export function createMemoryRivalry({ now, buds, coins, owned, gear }: MemoryShared): RivalryStore {
  // a strictly increasing clock: "who got there first" must never tie, even within one millisecond
  let tick = 0;
  const stamp = () => ++tick;
  const influence = new Map<string, Map<string, Row>>(); // "turf week" -> slug -> row
  const daily = new Map<string, number>(); // "slug turf day" -> points
  const counters = new Map<string, Map<string, Row>>(); // "week challenge" -> slug -> count
  const tributes = new Set<string>(); // "slug turf day"
  const settled = new Set<string>();
  const titles = new Map<string, { week: string; title: string }[]>();
  const crews = new Map<string, { name: string; createdAt: number }>(); // tag -> crew
  const members = new Map<string, { tag: string; role: 'leader' | 'member'; joinedAt: number }>();
  const ratings = new Map<string, { rating: number; wins: number; losses: number }>();
  const challenged = new Map<string, Map<string, Date>>(); // slug -> opponent -> last
  const pvpDaily = new Map<string, number>(); // "slug day" -> wins
  const listings = new Map<
    string,
    {
      seller: string;
      itemId: string;
      source: OwnedItem['source'];
      price: number;
      createdAt: Date;
      sold: boolean;
    }
  >();

  const name = (slug: string) => buds.get(slug)?.name ?? slug;
  const pay = (slug: string, n: number) => coins.set(slug, (coins.get(slug) ?? 0) + n);
  const best = (rows: Map<string, Row> | undefined, min: number): string | null => {
    let owner: string | null = null;
    let top: Row | null = null;
    for (const [slug, row] of rows ?? [])
      if (
        row.points >= min &&
        (!top || row.points > top.points || (row.points === top.points && row.at < top.at))
      ) {
        owner = slug;
        top = row;
      }
    return owner;
  };
  const sorted = (rows: Map<string, Row>) =>
    [...rows]
      .filter(([, r]) => r.points > 0)
      .sort(([, a], [, b]) => b.points - a.points || a.at - b.at);
  /** Total influence per bud in a week, with the time of its last gain. */
  const totals = (week: string) => {
    const sum = new Map<string, Row>();
    for (const [key, rows] of influence) {
      if (key.split(' ')[1] !== week) continue;
      for (const [slug, row] of rows) {
        const s = sum.get(slug) ?? { points: 0, at: 0 };
        sum.set(slug, { points: s.points + row.points, at: Math.max(s.at, row.at) });
      }
    }
    return sorted(sum);
  };
  const bump = (slug: string, week: string, challenge: string) => {
    const key = `${week} ${challenge}`;
    const rows = counters.get(key) ?? new Map<string, Row>();
    const row = { points: (rows.get(slug)?.points ?? 0) + 1, at: stamp() };
    rows.set(slug, row);
    counters.set(key, rows);
    return row.points;
  };
  const crewSize = (tag: string) => [...members.values()].filter((m) => m.tag === tag).length;
  const record = (id: string): ListingRecord | null => {
    const l = listings.get(id);
    return l && !l.sold
      ? {
          id,
          itemId: l.itemId,
          price: l.price,
          seller: { slug: l.seller, name: name(l.seller) },
          createdAt: l.createdAt.toISOString(),
        }
      : null;
  };
  const rate = (slug: string) => {
    const r = ratings.get(slug) ?? { rating: RATING_START, wins: 0, losses: 0 };
    ratings.set(slug, r);
    return r;
  };
  const duel = (winner: string, loser: string, delta: number) => {
    const w = rate(winner);
    const l = rate(loser);
    w.rating += delta;
    w.wins += 1;
    l.rating = Math.max(0, l.rating - delta);
    l.losses += 1;
    return { w, l };
  };

  return {
    async addInfluence(slug, turf, week, day, points, cap, min, challenge) {
      if (challenge) bump(slug, week, challenge);
      const key = `${turf} ${week}`;
      const rows = influence.get(key) ?? new Map<string, Row>();
      influence.set(key, rows);
      const before = best(rows, min);
      const dayKey = `${slug} ${turf} ${day}`;
      const today = daily.get(dayKey) ?? 0;
      const gained = Math.max(0, Math.min(points, cap - today));
      if (gained > 0) {
        daily.set(dayKey, today + gained);
        rows.set(slug, { points: (rows.get(slug)?.points ?? 0) + gained, at: stamp() });
      }
      const after = best(rows, min);
      return {
        gained,
        total: rows.get(slug)?.points ?? 0,
        captured: after === slug && before !== slug,
      };
    },

    async bumpChallenge(slug, week, challenge) {
      return bump(slug, week, challenge);
    },

    async turfBoards(turfs, week) {
      return turfs.flatMap((turf) =>
        sorted(influence.get(`${turf} ${week}`) ?? new Map()).map(([slug, r]) => ({
          turf,
          slug,
          name: name(slug),
          points: r.points,
        })),
      );
    },

    async claimTribute(slug, turf, week, day, gained, min) {
      if (best(influence.get(`${turf} ${week}`), min) !== slug) return null;
      const key = `${slug} ${turf} ${day}`;
      if (tributes.has(key)) return null;
      tributes.add(key);
      pay(slug, gained);
      return coins.get(slug)!;
    },

    async tributesClaimed(slug, day) {
      return [...tributes]
        .map((k) => k.split(' '))
        .filter(([s, , d]) => s === slug && d === day)
        .map(([, turf]) => turf!);
    },

    async settleWeek(week, min, turfCoins, topCoins) {
      if (settled.has(week)) return false;
      settled.add(week);
      const give = (slug: string, title: string, n: number) => {
        const list = titles.get(slug) ?? [];
        if (!list.some((t) => t.week === week && t.title === title)) list.push({ week, title });
        titles.set(slug, list);
        pay(slug, n);
      };
      for (const [key, rows] of influence) {
        const [turf, w] = key.split(' ');
        if (w !== week) continue;
        const owner = best(rows, min);
        if (owner) give(owner, `turf:${turf}`, turfCoins);
      }
      totals(week)
        .slice(0, 3)
        .forEach(([slug], i) => give(slug, `top:${i + 1}`, topCoins[i] ?? 0));
      return true;
    },

    async titles(slug) {
      return (titles.get(slug) ?? []).map((t) => ({ ...t }));
    },

    async weekTotals(week, limit) {
      return totals(week)
        .filter(([slug]) => buds.has(slug))
        .slice(0, limit)
        .map(([slug, r]) => ({ slug, name: name(slug), xp: buds.get(slug)!.xp, points: r.points }));
    },

    async weekStanding(slug, week) {
      const all = totals(week);
      const i = all.findIndex(([s]) => s === slug);
      return i < 0 ? { points: 0, rank: null } : { points: all[i]![1].points, rank: i + 1 };
    },

    async challengeLeaders(week, challenge, limit) {
      return sorted(counters.get(`${week} ${challenge}`) ?? new Map())
        .slice(0, limit)
        .map(([slug, r]) => ({ slug, name: name(slug), count: r.points }));
    },

    async challengeStanding(slug, week) {
      const out: { challenge: string; count: number; rank: number }[] = [];
      for (const [key, rows] of counters) {
        const [w, challenge] = key.split(' ');
        if (w !== week || !rows.has(slug)) continue;
        const i = sorted(rows).findIndex(([s]) => s === slug);
        if (i >= 0) out.push({ challenge: challenge!, count: rows.get(slug)!.points, rank: i + 1 });
      }
      return out;
    },

    async createCrew(slug, crewName, tag) {
      if (members.has(slug)) return 'in_crew';
      const lower = crewName.toLowerCase();
      if (crews.has(tag) || [...crews.values()].some((c) => c.name.toLowerCase() === lower))
        return 'taken';
      crews.set(tag, { name: crewName, createdAt: stamp() });
      members.set(slug, { tag, role: 'leader', joinedAt: stamp() });
      return 'ok';
    },

    async joinCrew(slug, tag, max) {
      if (!crews.has(tag)) return 'unknown';
      if (members.has(slug)) return 'in_crew';
      if (crewSize(tag) >= max) return 'full';
      members.set(slug, { tag, role: 'member', joinedAt: stamp() });
      return 'ok';
    },

    async leaveCrew(slug) {
      const m = members.get(slug);
      if (!m) return false;
      members.delete(slug);
      const heir = [...members]
        .filter(([, x]) => x.tag === m.tag)
        .sort(([, a], [, b]) => a.joinedAt - b.joinedAt)[0];
      if (!heir) crews.delete(m.tag);
      else if (m.role === 'leader') heir[1].role = 'leader';
      return true;
    },

    async crewOf(slug) {
      const m = members.get(slug);
      const crew = m && crews.get(m.tag);
      return m && crew ? { tag: m.tag, name: crew.name } : null;
    },

    async crewByTag(tag) {
      const crew = crews.get(tag);
      if (!crew) return null;
      const list = [...members]
        .filter(([, m]) => m.tag === tag)
        .sort(([, a], [, b]) =>
          a.role === b.role ? a.joinedAt - b.joinedAt : a.role === 'leader' ? -1 : 1,
        )
        .map(([slug, m]) => ({
          slug,
          name: name(slug),
          xp: buds.get(slug)?.xp ?? 0,
          role: m.role,
        }));
      return { tag, name: crew.name, members: list };
    },

    async crews(limit) {
      return [...crews]
        .map(([tag, c]) => ({ tag, name: c.name, members: crewSize(tag), createdAt: c.createdAt }))
        .sort((a, b) => b.members - a.members || a.createdAt - b.createdAt)
        .slice(0, limit)
        .map(({ tag, name: n, members: size }) => ({ tag, name: n, members: size }));
    },

    async crewTags(slugs) {
      const out = new Map<string, string>();
      for (const slug of slugs) {
        const m = members.get(slug);
        if (m) out.set(slug, m.tag);
      }
      return out;
    },

    async crewWeekTotals(week, limit) {
      const sums = new Map<string, number>();
      for (const [slug, r] of totals(week)) {
        const m = members.get(slug);
        if (m) sums.set(m.tag, (sums.get(m.tag) ?? 0) + r.points);
      }
      return [...sums]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, limit)
        .map(([tag, points]) => ({
          tag,
          name: crews.get(tag)!.name,
          points,
          members: crewSize(tag),
        }));
    },

    async ratings(slugs) {
      const out = new Map<string, { rating: number; wins: number; losses: number }>();
      for (const slug of slugs) {
        const r = ratings.get(slug);
        if (r) out.set(slug, { ...r });
      }
      return out;
    },

    async budsAround(minXp, maxXp, limit) {
      return [...buds.values()]
        .filter((b) => b.xp >= minXp && b.xp <= maxXp)
        .sort((a, b) => b.xp - a.xp || a.createdAt.localeCompare(b.createdAt))
        .slice(0, limit)
        .map((b) => ({ ...b, look: { ...b.look } }));
    },

    async pvpLastChallenges(slug) {
      return new Map(challenged.get(slug) ?? []);
    },

    async pvpChallenge(slug, opponent, cooldownSeconds) {
      const mine = challenged.get(slug) ?? new Map<string, Date>();
      const last = mine.get(opponent);
      if (last && now().getTime() - last.getTime() < cooldownSeconds * 1000) return false;
      mine.set(opponent, now());
      challenged.set(slug, mine);
      return true;
    },

    async pvpWin(winner, loser, delta, day, gained, paidWins) {
      const { w } = duel(winner, loser, delta);
      const key = `${winner} ${day}`;
      const winsToday = (pvpDaily.get(key) ?? 0) + 1;
      pvpDaily.set(key, winsToday);
      const paid = winsToday <= paidWins ? Math.max(0, gained) : 0;
      pay(winner, paid);
      return { rating: w.rating, winsToday, paid, coins: coins.get(winner) ?? 0 };
    },

    async pvpLoss(loser, winner, delta) {
      return duel(winner, loser, delta).l.rating;
    },

    async pvpLeaders(limit) {
      return [...ratings]
        .filter(([slug]) => buds.has(slug))
        .sort(([, a], [, b]) => b.rating - a.rating || b.wins - a.wins)
        .slice(0, limit)
        .map(([slug, r]) => ({ slug, name: name(slug), rating: r.rating }));
    },

    async pvpWinsToday(slug, day) {
      return pvpDaily.get(`${slug} ${day}`) ?? 0;
    },

    async marketList(slug, itemId, price, max) {
      const mine = owned.get(slug) ?? [];
      const item = mine.find((i) => i.itemId === itemId);
      if (!item) return { status: 'not_owned' };
      if ([...(gear.get(slug)?.values() ?? [])].includes(itemId)) return { status: 'worn' };
      if ([...listings.values()].filter((l) => l.seller === slug && !l.sold).length >= max)
        return { status: 'too_many' };
      owned.set(
        slug,
        mine.filter((i) => i.itemId !== itemId),
      );
      const id = randomUUID();
      listings.set(id, {
        seller: slug,
        itemId,
        source: item.source,
        price,
        createdAt: now(),
        sold: false,
      });
      return { status: 'ok', id };
    },

    async marketCancel(slug, id) {
      const l = listings.get(id);
      if (!l || l.seller !== slug || l.sold) return false;
      listings.delete(id);
      const mine = owned.get(slug) ?? [];
      if (!mine.some((i) => i.itemId === l.itemId))
        owned.set(slug, [
          ...mine,
          { itemId: l.itemId, source: l.source, acquiredAt: now().toISOString() },
        ]);
      return true;
    },

    async marketBuy(slug, id, fee) {
      const balance = coins.get(slug) ?? 0;
      const l = listings.get(id);
      if (!l || l.sold) return { status: 'gone', coins: balance };
      if (l.seller === slug) return { status: 'own', coins: balance };
      const mine = owned.get(slug) ?? [];
      if (mine.some((i) => i.itemId === l.itemId)) return { status: 'owned', coins: balance };
      if (balance < l.price) return { status: 'poor', coins: balance };
      coins.set(slug, balance - l.price);
      pay(l.seller, l.price - fee);
      owned.set(slug, [
        ...mine,
        { itemId: l.itemId, source: 'trade', acquiredAt: now().toISOString() },
      ]);
      l.sold = true;
      return { status: 'ok', coins: balance - l.price };
    },

    async listings(limit) {
      return [...listings.keys()]
        .reverse()
        .map(record)
        .filter((l): l is ListingRecord => l !== null)
        .slice(0, limit);
    },

    async listing(id) {
      return record(id);
    },
  };
}
