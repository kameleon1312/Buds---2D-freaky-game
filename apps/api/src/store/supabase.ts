import { createClient } from '@supabase/supabase-js';
import { budLookSchema, ownedItemSchema, type BudRecord, type SlotId } from '@buds/shared';
import { makeSlug } from './slug.js';
import type { BudStore, BuyResult } from './types.js';

type BudRow = {
  id: string;
  slug: string;
  name: string;
  look: unknown;
  xp: number;
  created_at: string;
};

const COLUMNS = 'id, slug, name, look, xp, created_at';
const UNIQUE_VIOLATION = '23505';

function toRecord(row: BudRow): BudRecord {
  return {
    slug: row.slug,
    name: row.name,
    look: budLookSchema.parse(row.look),
    xp: row.xp,
    createdAt: row.created_at,
  };
}

/** Uses the service-role key: RLS denies anon access to these tables, the API is the only gateway. */
export function createSupabaseStore(url: string, serviceRoleKey: string): BudStore {
  const db = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  async function rowBySlug(slug: string): Promise<BudRow | null> {
    const { data, error } = await db.from('buds').select(COLUMNS).eq('slug', slug).maybeSingle();
    if (error) throw error;
    return (data as BudRow | null) ?? null;
  }

  async function idBySlug(slug: string): Promise<string> {
    const row = await rowBySlug(slug);
    if (!row) throw new Error(`Bud ${slug} not found`);
    return row.id;
  }

  return {
    async getBySlug(slug) {
      const row = await rowBySlug(slug);
      return row ? toRecord(row) : null;
    },

    async getByTokenHash(tokenHash) {
      const { data, error } = await db
        .from('bud_tokens')
        .select(`buds(${COLUMNS})`)
        .eq('token_hash', tokenHash)
        .maybeSingle();
      if (error) throw error;
      const bud = (data as { buds: BudRow | null } | null)?.buds;
      return bud ? toRecord(bud) : null;
    },

    async create(input, tokenHash, userId) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await db
          .from('buds')
          .insert({
            slug: makeSlug(input.name),
            name: input.name,
            look: input.look,
            user_id: userId ?? null,
          })
          .select(COLUMNS)
          .single();
        if (error?.code === UNIQUE_VIOLATION) continue;
        if (error) throw error;
        const row = data as BudRow;
        const { error: tokenError } = await db
          .from('bud_tokens')
          .insert({ token_hash: tokenHash, bud_id: row.id });
        if (tokenError) throw tokenError;
        return toRecord(row);
      }
      throw new Error('Could not allocate a unique slug');
    },

    async addToken(slug, tokenHash) {
      const { error } = await db
        .from('bud_tokens')
        .insert({ token_hash: tokenHash, bud_id: await idBySlug(slug) });
      if (error) throw error;
    },

    async savePairCode(slug, code, expiresAt) {
      const { error } = await db
        .from('bud_pair_codes')
        .insert({ code, bud_id: await idBySlug(slug), expires_at: expiresAt.toISOString() });
      if (error) throw error;
    },

    async redeemPairCode(code, now) {
      const { data, error } = await db
        .from('bud_pair_codes')
        .delete()
        .eq('code', code)
        .select('expires_at, buds(slug)')
        .maybeSingle();
      if (error) throw error;
      const row = data as { expires_at: string; buds: { slug: string } | null } | null;
      if (!row?.buds || new Date(row.expires_at) <= now) return null;
      return row.buds.slug;
    },

    async top(limit) {
      const { data, error } = await db
        .from('buds')
        .select(COLUMNS)
        .order('xp', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(limit);
      if (error) throw error;
      return (data as BudRow[]).map(toRecord);
    },

    async items(slug) {
      const { data, error } = await db
        .from('bud_items')
        .select('item_id, source, acquired_at')
        .eq('bud_id', await idBySlug(slug))
        .order('acquired_at', { ascending: true });
      if (error) throw error;
      return (data as { item_id: string; source: string; acquired_at: string }[]).map((r) =>
        ownedItemSchema.parse({ itemId: r.item_id, source: r.source, acquiredAt: r.acquired_at }),
      );
    },

    async skills(slug) {
      const { data, error } = await db
        .from('bud_skills')
        .select('skill_id, rank')
        .eq('bud_id', await idBySlug(slug));
      if (error) throw error;
      return (data as { skill_id: string; rank: number }[]).map((r) => ({
        id: r.skill_id,
        rank: r.rank,
      }));
    },

    async upgradeSkill(slug, skillId, points, maxRank) {
      const { data, error } = await db.rpc('upgrade_skill', {
        p_bud: await idBySlug(slug),
        p_skill: skillId,
        p_points: points,
        p_max: maxRank,
      });
      if (error) throw error;
      return (data as number | null) ?? null;
    },

    async wallet(slug) {
      const { data, error } = await db
        .from('bud_wallets')
        .select('coins, gems')
        .eq('bud_id', await idBySlug(slug))
        .maybeSingle();
      if (error) throw error;
      const row = data as { coins: number; gems: number } | null;
      return { coins: row?.coins ?? 0, gems: row?.gems ?? 0 };
    },

    async equipment(slug) {
      const { data, error } = await db
        .from('bud_equipment')
        .select('slot, item_id')
        .eq('bud_id', await idBySlug(slug));
      if (error) throw error;
      return Object.fromEntries(
        (data as { slot: SlotId; item_id: string }[]).map((r) => [r.slot, r.item_id]),
      );
    },

    async equip(slug, slot, itemId) {
      const budId = await idBySlug(slug);
      const { error } = itemId
        ? await db
            .from('bud_equipment')
            .upsert(
              { bud_id: budId, slot, item_id: itemId, equipped_at: new Date().toISOString() },
              { onConflict: 'bud_id,slot' },
            )
        : await db.from('bud_equipment').delete().eq('bud_id', budId).eq('slot', slot);
      if (error) throw error;
    },

    async buyItem(slug, itemId, price) {
      const { data, error } = await db.rpc('buy_item', {
        p_bud: await idBySlug(slug),
        p_item: itemId,
        p_price: price,
      });
      if (error) throw error;
      return data as BuyResult;
    },

    async budsOfUser(userId) {
      const { data, error } = await db
        .from('buds')
        .select(COLUMNS)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as BudRow[]).map(toRecord);
    },

    async ownerOf(slug) {
      const { data, error } = await db
        .from('buds')
        .select('user_id')
        .eq('slug', slug)
        .maybeSingle();
      if (error) throw error;
      return (data as { user_id: string | null } | null)?.user_id ?? null;
    },

    async claimBud(slug, userId) {
      // only a bud without an account can be claimed: the filter makes it atomic
      const { data, error } = await db
        .from('buds')
        .update({ user_id: userId })
        .eq('slug', slug)
        .is('user_id', null)
        .select('id');
      if (error) throw error;
      if ((data as unknown[]).length) return 'ok';
      return (await this.ownerOf(slug)) === userId ? 'mine' : 'taken';
    },

    async openedCaches(slug) {
      const { data, error } = await db
        .from('bud_caches')
        .select('cache_id')
        .eq('bud_id', await idBySlug(slug));
      if (error) throw error;
      return (data as { cache_id: string }[]).map((r) => r.cache_id);
    },

    async openCache(slug, cacheId, coins, xp) {
      const { data, error } = await db.rpc('open_cache', {
        p_bud: await idBySlug(slug),
        p_cache: cacheId,
        p_coins: coins,
        p_xp: xp,
      });
      if (error) throw error;
      return (data as { xp: number; coins: number } | null) ?? null;
    },

    async completedQuests(slug) {
      const { data, error } = await db
        .from('bud_quests')
        .select('quest_id')
        .eq('bud_id', await idBySlug(slug));
      if (error) throw error;
      return (data as { quest_id: string }[]).map((r) => r.quest_id);
    },

    async completeQuest(slug, questId, xp) {
      const { data, error } = await db.rpc('complete_quest', {
        p_bud: await idBySlug(slug),
        p_quest: questId,
        p_xp: xp,
      });
      if (error) throw error;
      return (data as number | null) ?? null;
    },

    async grantItem(slug, itemId, source) {
      const { error } = await db
        .from('bud_items')
        .upsert(
          { bud_id: await idBySlug(slug), item_id: itemId, source },
          { onConflict: 'bud_id,item_id', ignoreDuplicates: true },
        );
      if (error) throw error;
    },
  };
}
