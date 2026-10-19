import { randomUUID } from 'node:crypto';
import type { BudRecord, FightState, OwnedItem, SlotId } from '@buds/shared';
import { makeSlug } from './slug.js';
import { createMemoryRivalry } from './memory-rivalry.js';
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
  const gems = new Map<string, number>(); // slug -> gem balance
  const gear = new Map<string, Map<SlotId, string>>(); // slug -> slot -> item
  const owners = new Map<string, string>(); // slug -> user id
  const fights = new Map<string, { slug: string; state: FightState; finishedAt?: Date }>();
  const training = new Map<string, Map<string, number>>(); // slug -> skill -> training XP
  const trainedAt = new Map<string, Date>(); // "slug spot" -> last round
  const drinks = new Map<string, Map<string, number>>(); // slug -> item -> qty
  const buffs = new Map<string, Map<string, Date>>(); // slug -> buff -> until
  const addDrinks = (slug: string, itemId: string, qty: number) => {
    const bag = drinks.get(slug) ?? new Map<string, number>();
    bag.set(itemId, (bag.get(itemId) ?? 0) + qty);
    drinks.set(slug, bag);
  };
  const copy = (bud: BudRecord | undefined) => (bud ? { ...bud, look: { ...bud.look } } : null);

  return {
    ...createMemoryRivalry({ now, buds, coins, owned, gear }),

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

    async removeToken(tokenHash) {
      tokens.delete(tokenHash);
    },

    async updateLook(slug, look) {
      const bud = buds.get(slug);
      if (!bud) throw new Error(`Bud ${slug} not found`);
      bud.look = { ...look };
      return copy(bud) as BudRecord;
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
      return { coins: coins.get(slug) ?? 0, gems: gems.get(slug) ?? 0 };
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

    async buyItemWithGems(slug, itemId, price) {
      const balance = gems.get(slug) ?? 0;
      if ((owned.get(slug) ?? []).some((i) => i.itemId === itemId))
        return { status: 'owned', gems: balance };
      if (balance < price) return { status: 'poor', gems: balance };
      gems.set(slug, balance - price);
      owned.set(slug, [
        ...(owned.get(slug) ?? []),
        { itemId, source: 'purchase', acquiredAt: now().toISOString() },
      ]);
      return { status: 'ok', gems: balance - price };
    },

    async grantGems(slug, n) {
      const balance = (gems.get(slug) ?? 0) + Math.max(0, n);
      gems.set(slug, balance);
      return balance;
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

    async createFight(slug, state) {
      const id = randomUUID();
      fights.set(id, { slug, state: structuredClone(state) });
      return id;
    },

    async abandonFights(slug) {
      const ended: { enemyId: string; turn: number }[] = [];
      for (const f of fights.values())
        if (f.slug === slug && f.state.status === 'active') {
          f.state.status = 'fled';
          f.finishedAt = now();
          ended.push({ enemyId: f.state.enemyId, turn: f.state.turn });
        }
      return ended;
    },

    async fight(slug, id) {
      const f = fights.get(id);
      return f && f.slug === slug ? structuredClone(f.state) : null;
    },

    async saveTurn(slug, id, turn, state) {
      const f = fights.get(id);
      if (!f || f.slug !== slug || f.state.status !== 'active' || f.state.turn !== turn)
        return false;
      f.state = structuredClone(state);
      return true;
    },

    async finishFight(slug, id, turn, state, status, xp, gained) {
      const f = fights.get(id);
      const bud = buds.get(slug);
      if (!f || !bud || f.slug !== slug || f.state.status !== 'active' || f.state.turn !== turn)
        return null;
      f.state = { ...structuredClone(state), status };
      f.finishedAt = now();
      bud.xp += Math.max(0, xp);
      coins.set(slug, (coins.get(slug) ?? 0) + Math.max(0, gained));
      return { xp: bud.xp, coins: coins.get(slug)! };
    },

    async lastWin(slug, enemyId) {
      let last: Date | null = null;
      for (const f of fights.values())
        if (
          f.slug === slug &&
          f.state.enemyId === enemyId &&
          f.state.status === 'won' &&
          f.finishedAt
        )
          if (!last || f.finishedAt > last) last = f.finishedAt;
      return last;
    },

    async training(slug) {
      return [...(training.get(slug) ?? [])].map(([skill, xp]) => ({ skill, xp }));
    },

    async lastTrained(slug, spotId) {
      return trainedAt.get(`${slug} ${spotId}`) ?? null;
    },

    async train(slug, spotId, skill, xp, cooldownSeconds) {
      const key = `${slug} ${spotId}`;
      const last = trainedAt.get(key);
      if (last && now().getTime() - last.getTime() < cooldownSeconds * 1000) return null;
      trainedAt.set(key, now());
      const skills = training.get(slug) ?? new Map<string, number>();
      const total = (skills.get(skill) ?? 0) + Math.max(0, xp);
      skills.set(skill, total);
      training.set(slug, skills);
      return total;
    },

    async consumables(slug) {
      return [...(drinks.get(slug) ?? [])].map(([itemId, qty]) => ({ itemId, qty }));
    },

    async grantConsumable(slug, itemId, qty) {
      addDrinks(slug, itemId, Math.max(0, qty));
    },

    async payFare(slug, price) {
      const balance = coins.get(slug) ?? 0;
      if (balance < price) return { status: 'poor', coins: balance };
      coins.set(slug, balance - price);
      return { status: 'ok', coins: balance - price };
    },

    async buyConsumable(slug, itemId, price) {
      const balance = coins.get(slug) ?? 0;
      if (balance < price) return { status: 'poor', coins: balance };
      coins.set(slug, balance - price);
      addDrinks(slug, itemId, 1);
      return { status: 'ok', coins: balance - price };
    },

    async useConsumable(slug, itemId, buff, seconds) {
      const bag = drinks.get(slug);
      if (!bag || (bag.get(itemId) ?? 0) <= 0) return null;
      bag.set(itemId, bag.get(itemId)! - 1);
      const until = new Date(now().getTime() + seconds * 1000);
      const active = buffs.get(slug) ?? new Map<string, Date>();
      active.set(buff, until);
      buffs.set(slug, active);
      return until;
    },

    async buffs(slug) {
      return [...(buffs.get(slug) ?? [])].map(([buff, until]) => ({ buff, until }));
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
