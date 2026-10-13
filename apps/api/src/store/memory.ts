import type { BudRecord, OwnedItem, SlotId } from '@buds/shared';
import { makeSlug } from './slug.js';
import type { BudStore } from './types.js';

/** In-process store for tests and for local dev without Supabase. Data is lost on restart. */
export function createMemoryStore(now: () => Date = () => new Date()): BudStore {
  const buds = new Map<string, BudRecord>();
  const tokens = new Map<string, string>(); // tokenHash -> slug
  const pairCodes = new Map<string, { slug: string; expiresAt: Date }>();
  const owned = new Map<string, OwnedItem[]>(); // slug -> granted items
  const quests = new Map<string, Set<string>>(); // slug -> completed quest ids
  const skills = new Map<string, Map<string, number>>(); // slug -> skill -> rank
  const caches = new Map<string, Set<string>>(); // slug -> opened cache ids
  const coins = new Map<string, number>(); // slug -> coin balance
  const gear = new Map<string, Map<SlotId, string>>(); // slug -> slot -> item
  const owners = new Map<string, string>(); // slug -> user id
  const copy = (bud: BudRecord | undefined) => (bud ? { ...bud, look: { ...bud.look } } : null);

  return {
    async create(input, tokenHash, userId) {
      let slug = makeSlug(input.name);
      while (buds.has(slug)) slug = makeSlug(input.name);
      const bud: BudRecord = { ...input, slug, xp: 0, createdAt: now().toISOString() };
      buds.set(slug, bud);
      tokens.set(tokenHash, slug);
      if (userId) owners.set(slug, userId);
      return copy(bud) as BudRecord;
    },

    async getBySlug(slug) {
      return copy(buds.get(slug));
    },

    async getByTokenHash(tokenHash) {
      const slug = tokens.get(tokenHash);
      return slug ? copy(buds.get(slug)) : null;
    },

    async addToken(slug, tokenHash) {
      tokens.set(tokenHash, slug);
    },

    async savePairCode(slug, code, expiresAt) {
      pairCodes.set(code, { slug, expiresAt });
    },

    async redeemPairCode(code, at) {
      const entry = pairCodes.get(code);
      pairCodes.delete(code);
      return entry && entry.expiresAt > at ? entry.slug : null;
    },

    async top(limit) {
      return [...buds.values()]
        .sort((a, b) => b.xp - a.xp || a.createdAt.localeCompare(b.createdAt))
        .slice(0, limit)
        .map((b) => copy(b) as BudRecord);
    },

    async items(slug) {
      return (owned.get(slug) ?? []).map((i) => ({ ...i }));
    },

    async grantItem(slug, itemId, source) {
      const list = owned.get(slug) ?? [];
      if (list.some((i) => i.itemId === itemId)) return;
      owned.set(slug, [...list, { itemId, source, acquiredAt: now().toISOString() }]);
    },

    async skills(slug) {
      return [...(skills.get(slug) ?? new Map<string, number>())].map(([id, rank]) => ({
        id,
        rank,
      }));
    },

    async upgradeSkill(slug, skillId, points, maxRank) {
      const ranks = skills.get(slug) ?? new Map<string, number>();
      const spent = [...ranks.values()].reduce((a, b) => a + b, 0);
      const rank = ranks.get(skillId) ?? 0;
      if (spent >= points || rank >= maxRank) return null;
      ranks.set(skillId, rank + 1);
      skills.set(slug, ranks);
      return rank + 1;
    },

    async wallet(slug) {
      return { coins: coins.get(slug) ?? 0, gems: 0 };
    },

    async equipment(slug) {
      return Object.fromEntries(gear.get(slug) ?? []);
    },

    async equip(slug, slot, itemId) {
      const worn = gear.get(slug) ?? new Map<SlotId, string>();
      if (itemId) worn.set(slot, itemId);
      else worn.delete(slot);
      gear.set(slug, worn);
    },

    async buyItem(slug, itemId, price) {
      const balance = coins.get(slug) ?? 0;
      if ((owned.get(slug) ?? []).some((i) => i.itemId === itemId))
        return { status: 'owned', coins: balance };
      if (balance < price) return { status: 'poor', coins: balance };
      coins.set(slug, balance - price);
      owned.set(slug, [
        ...(owned.get(slug) ?? []),
        { itemId, source: 'shop', acquiredAt: now().toISOString() },
      ]);
      return { status: 'ok', coins: balance - price };
    },

    async budsOfUser(userId) {
      return [...buds.values()]
        .filter((b) => owners.get(b.slug) === userId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((b) => copy(b) as BudRecord);
    },

    async ownerOf(slug) {
      return owners.get(slug) ?? null;
    },

    async claimBud(slug, userId) {
      const owner = owners.get(slug);
      if (owner) return owner === userId ? 'mine' : 'taken';
      owners.set(slug, userId);
      return 'ok';
    },

    async openedCaches(slug) {
      return [...(caches.get(slug) ?? [])];
    },

    async openCache(slug, cacheId, gained, xp) {
      const bud = buds.get(slug);
      if (!bud) throw new Error(`Bud ${slug} not found`);
      const opened = caches.get(slug) ?? new Set<string>();
      if (opened.has(cacheId)) return null;
      opened.add(cacheId);
      caches.set(slug, opened);
      bud.xp += xp;
      coins.set(slug, (coins.get(slug) ?? 0) + gained);
      return { xp: bud.xp, coins: coins.get(slug)! };
    },

    async completedQuests(slug) {
      return [...(quests.get(slug) ?? [])];
    },

    async completeQuest(slug, questId, xp) {
      const bud = buds.get(slug);
      if (!bud) throw new Error(`Bud ${slug} not found`);
      const done = quests.get(slug) ?? new Set<string>();
      if (done.has(questId)) return null;
      done.add(questId);
      quests.set(slug, done);
      bud.xp += xp;
      return bud.xp;
    },
  };
}
