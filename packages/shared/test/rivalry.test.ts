import { describe, expect, it } from 'vitest';
import {
  CONTENT,
  DISTRICTS,
  LEAGUES,
  MARKET_MAX_PRICE,
  MARKET_MIN_PRICE,
  RATING_K,
  ROOM_DOORS,
  TURFS,
  crewTagSchema,
  leagueFor,
  marketPayout,
  previousWeek,
  pvpCoins,
  pvpEnemyId,
  pvpOpponentOf,
  ratingDelta,
  turfAt,
  turfOf,
  weekEnds,
  weekKey,
} from '../src';

describe('rivalry weeks', () => {
  it('uses ISO weeks in UTC', () => {
    expect(weekKey(new Date('2026-10-12T00:00:00Z'))).toBe('2026-W42'); // Monday
    expect(weekKey(new Date('2026-10-18T23:59:59Z'))).toBe('2026-W42'); // Sunday
    expect(weekKey(new Date('2026-10-19T00:00:00Z'))).toBe('2026-W43');
    expect(weekKey(new Date('2027-01-01T12:00:00Z'))).toBe('2026-W53'); // the year's Thursday decides
    expect(weekKey(new Date('2025-12-29T12:00:00Z'))).toBe('2026-W01');
    expect(previousWeek(new Date('2026-10-12T00:00:00Z'))).toBe('2026-W41');
    expect(weekEnds(new Date('2026-10-17T15:00:00Z')).toISOString()).toBe(
      '2026-10-19T00:00:00.000Z',
    );
    expect(weekEnds(new Date('2026-10-19T00:00:00Z')).toISOString()).toBe(
      '2026-10-26T00:00:00.000Z',
    );
  });
});

describe('turfs', () => {
  it('every district has turfs with unique ids, none for the tutorial island', () => {
    expect(new Set(TURFS.map((t) => t.id)).size).toBe(TURFS.length);
    for (const d of DISTRICTS) expect(TURFS.some((t) => t.district === d.id)).toBe(true);
    expect(TURFS.some((t) => t.district === 'wyspa-startowa')).toBe(false);
    for (const t of TURFS) expect(t.id).toMatch(/^[a-z0-9-]{2,40}$/);
  });

  it('picks the smallest turf holding a cell', () => {
    for (const t of TURFS) {
      const cx = Math.floor((t.x0 + t.x1) / 2);
      const cy = Math.floor((t.y0 + t.y1) / 2);
      const found = turfAt(t.district, cx, cy)!;
      const area = (x: typeof t) => (x.x1 - x.x0 + 1) * (x.y1 - x.y0 + 1);
      expect(area(found)).toBeLessThanOrEqual(area(t));
    }
    expect(turfAt('miasto-ziomkow', -5, -5)).toBeUndefined();
  });

  it('a room counts for the turf at its door', () => {
    for (const [room, [district, x, y]] of Object.entries(ROOM_DOORS))
      expect(turfOf('ignored', room, 1, 1)).toEqual(turfAt(district, x, y));
  });

  it('most of what earns influence happens inside a turf', () => {
    const outside = [
      ...CONTENT.caches.filter(
        (k) => !turfOf(k.district, k.map, k.x, k.y) && k.district !== 'wyspa-startowa',
      ),
      ...CONTENT.training.filter(
        (s) => !turfOf(s.district, s.map, s.x, s.y) && s.district !== 'wyspa-startowa',
      ),
    ];
    const all = CONTENT.caches.length + CONTENT.training.length;
    expect(outside.length / all).toBeLessThan(0.25);
  });
});

describe('PvP', () => {
  it('Elo moves 1..K, more for an upset', () => {
    expect(ratingDelta(1000, 1000)).toBe(RATING_K / 2);
    expect(ratingDelta(800, 1200)).toBeGreaterThan(ratingDelta(1200, 800));
    expect(ratingDelta(3000, 0)).toBe(1);
    expect(ratingDelta(0, 3000)).toBeLessThanOrEqual(RATING_K);
  });

  it('leagues and their coins', () => {
    expect(leagueFor(0).id).toBe('braz');
    expect(leagueFor(1050).id).toBe('srebro');
    expect(leagueFor(9999).id).toBe(LEAGUES.at(-1)!.id);
    expect(pvpCoins(1000)).toBe(10);
    expect(pvpCoins(1500)).toBe(10 + 5 * (LEAGUES.length - 1));
  });

  it('fight ids carry the opponent and fit the fight id format', () => {
    const slug = 'abcdefghijklmnopqrst-abcd'; // the longest slug makeSlug makes
    expect(pvpOpponentOf(pvpEnemyId(slug))).toBe(slug);
    expect(pvpEnemyId(slug)).toMatch(/^[a-z0-9-]{2,40}$/);
    expect(pvpOpponentOf('herszt-borys')).toBeNull();
  });
});

describe('crews and the market', () => {
  it('tags are upper-cased', () => {
    expect(crewTagSchema.parse(' zr ')).toBe('ZR');
    expect(crewTagSchema.safeParse('Z').success).toBe(false);
    expect(crewTagSchema.safeParse('ZIOMS').success).toBe(false);
  });

  it('the fee is 10%, at least one coin, and the seller always gets something', () => {
    expect(marketPayout(100)).toBe(90);
    expect(marketPayout(MARKET_MIN_PRICE)).toBe(MARKET_MIN_PRICE - 1);
    expect(marketPayout(MARKET_MAX_PRICE)).toBe(MARKET_MAX_PRICE * 0.9);
    for (let p = MARKET_MIN_PRICE; p <= 200; p++) expect(marketPayout(p)).toBeGreaterThan(0);
  });
});
