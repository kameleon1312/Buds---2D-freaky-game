import type { BudRecord } from '@buds/shared';
import { makeSlug } from './slug.js';
import type { BudStore } from './types.js';

/** In-process store for tests and for local dev without Supabase. Data is lost on restart. */
export function createMemoryStore(now: () => Date = () => new Date()): BudStore {
  const buds = new Map<string, BudRecord>();
  const tokens = new Map<string, string>(); // tokenHash -> slug
  const pairCodes = new Map<string, { slug: string; expiresAt: Date }>();
  const copy = (bud: BudRecord | undefined) => (bud ? { ...bud, look: { ...bud.look } } : null);

  return {
    async create(input, tokenHash) {
      let slug = makeSlug(input.name);
      while (buds.has(slug)) slug = makeSlug(input.name);
      const bud: BudRecord = { ...input, slug, xp: 0, createdAt: now().toISOString() };
      buds.set(slug, bud);
      tokens.set(tokenHash, slug);
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
  };
}
