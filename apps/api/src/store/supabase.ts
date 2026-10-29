import { createClient } from '@supabase/supabase-js';
import {
  budLookSchema,
  fightStateSchema,
  ownedItemSchema,
  type BudRecord,
  type SlotId,
} from '@buds/shared';
import { makeSlug } from './slug.js';
import { createSupabaseLand } from './supabase-land.js';
import { createSupabaseRivalry } from './supabase-rivalry.js';
import type { BudStore, BuyResult, GemBuyResult } from './types.js';

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

  async function budsAround(q: { minXp: number; maxXp: number; limit: number }) {
    const { data, error } = await db
      .from('buds')
      .select(COLUMNS)
      .gte('xp', q.minXp)
      .lte('xp', q.maxXp)
      .order('xp', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(q.limit);
    if (error) throw error;
    return (data as BudRow[]).map(toRecord);
  }

  return {
    ...createSupabaseRivalry(db, idBySlug, budsAround),
    ...createSupabaseLand(db, idBySlug),

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

    async updateLook(slug, look) {
      const { data, error } = await db
        .from('buds')
        .update({ look })
        .eq('slug', slug)
        .select(COLUMNS)
        .single();
      if (error) throw error;
      return toRecord(data as BudRow);
    },

    async removeTokens(slug, keep) {
      let q = db
        .from('bud_tokens')
        .delete({ count: 'exact' })
        .eq('bud_id', await idBySlug(slug));
      if (keep) q = q.neq('token_hash', keep);
      const { error, count } = await q;
      if (error) throw error;
      return count ?? 0;
    },

    async tokenCount(slug) {
      const { error, count } = await db
        .from('bud_tokens')
        .select('token_hash', { count: 'exact', head: true })
        .eq('bud_id', await idBySlug(slug));
      if (error) throw error;
      return count ?? 0;
    },

    async renameBud(slug, name, notSince) {
      // one statement: renamed only when it wasn't renamed after notSince (the column is null for a bud never renamed)
      const { data, error } = await db
        .from('buds')
        .update({ name, name_changed_at: new Date().toISOString() })
        .eq('slug', slug)
        .or(`name_changed_at.is.null,name_changed_at.lte.${notSince.toISOString()}`)
        .select(COLUMNS)
        .maybeSingle();
      if (error) throw error;
      return data ? toRecord(data as BudRow) : null;
    },

    async deleteBud(slug) {
      const id = await idBySlug(slug).catch(() => null);
      if (!id) return;
      // a leader hands the crew over (or closes it) the proper way before going
      await this.leaveCrew(slug);
      // every bud_* table, its tokens, its district and its market listings go with it (on delete cascade)
      const { error } = await db.from('buds').delete().eq('id', id);
      if (error) throw error;
    },

    async deleteUser(userId) {
      const { error } = await db.auth.admin.deleteUser(userId);
      if (error && error.status !== 404) throw error;
    },

    async removeToken(tokenHash) {
      const { error } = await db.from('bud_tokens').delete().eq('token_hash', tokenHash);
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

    async loadouts(slug) {
      const { data, error } = await db
        .from('bud_loadouts')
        .select('weapon, kit')
        .eq('bud_id', await idBySlug(slug));
      if (error) throw error;
      return Object.fromEntries(
        (data as { weapon: string; kit: (string | null)[] }[]).map((r) => [r.weapon, r.kit]),
      );
    },

    async setLoadout(slug, weapon, kit) {
      const { error } = await db.from('bud_loadouts').upsert({
        bud_id: await idBySlug(slug),
        weapon,
        kit,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },

    async moveRanks(slug) {
      const { data, error } = await db
        .from('bud_move_ranks')
        .select('move_id, rank')
        .eq('bud_id', await idBySlug(slug));
      if (error) throw error;
      return Object.fromEntries(
        (data as { move_id: string; rank: number }[]).map((r) => [r.move_id, r.rank]),
      );
    },

    async upgradeMove(slug, moveId, from, price) {
      const { data, error } = await db.rpc('upgrade_move', {
        p_bud: await idBySlug(slug),
        p_move: moveId,
        p_from: from,
        p_price: price,
      });
      if (error) throw error;
      return data as { status: 'ok' | 'race' | 'poor'; coins: number; rank: number };
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

    async buyItemWithGems(slug, itemId, price) {
      const { data, error } = await db.rpc('buy_item_gems', {
        p_bud: await idBySlug(slug),
        p_item: itemId,
        p_price: price,
      });
      if (error) throw error;
      return data as GemBuyResult;
    },

    async grantGems(slug, n) {
      const { data, error } = await db.rpc('grant_gems', {
        p_bud: await idBySlug(slug),
        p_gems: n,
      });
      if (error) throw error;
      return data as number;
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

    async createFight(slug, state) {
      const { data, error } = await db
        .from('bud_fights')
        .insert({ bud_id: await idBySlug(slug), enemy_id: state.enemyId, turn: state.turn, state })
        .select('id')
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    },

    async abandonFights(slug) {
      const { data, error } = await db
        .from('bud_fights')
        .update({ status: 'fled', finished_at: new Date().toISOString() })
        .eq('bud_id', await idBySlug(slug))
        .eq('status', 'active')
        .select('enemy_id, turn');
      if (error) throw error;
      return (data as { enemy_id: string; turn: number }[]).map((r) => ({
        enemyId: r.enemy_id,
        turn: r.turn,
      }));
    },

    async fight(slug, id) {
      const { data, error } = await db
        .from('bud_fights')
        .select('state, status')
        .eq('id', id)
        .eq('bud_id', await idBySlug(slug))
        .maybeSingle();
      if (error) throw error;
      const row = data as { state: unknown; status: string } | null;
      if (!row) return null;
      const state = fightStateSchema.parse(row.state);
      return { ...state, status: row.status as typeof state.status };
    },

    async saveTurn(slug, id, turn, state) {
      const { data, error } = await db
        .from('bud_fights')
        .update({ state, turn: turn + 1 })
        .eq('id', id)
        .eq('bud_id', await idBySlug(slug))
        .eq('status', 'active')
        .eq('turn', turn)
        .select('id');
      if (error) throw error;
      return (data as unknown[]).length === 1;
    },

    async finishFight(slug, id, turn, state, status, xp, coins) {
      const { data, error } = await db.rpc('finish_fight', {
        p_fight: id,
        p_bud: await idBySlug(slug),
        p_turn: turn,
        p_state: { ...state, status },
        p_status: status,
        p_xp: xp,
        p_coins: coins,
      });
      if (error) throw error;
      return (data as { xp: number; coins: number } | null) ?? null;
    },

    async knockout(victim, killer, percent, max) {
      const { data, error } = await db.rpc('knockout_coins', {
        p_victim: await idBySlug(victim),
        p_killer: killer ? await idBySlug(killer) : null,
        p_percent: percent,
        p_max: max,
      });
      if (error) throw error;
      return data as { lost: number; coins: number };
    },

    async training(slug) {
      const { data, error } = await db
        .from('bud_training')
        .select('skill_id, xp')
        .eq('bud_id', await idBySlug(slug));
      if (error) throw error;
      return (data as { skill_id: string; xp: number }[]).map((r) => ({
        skill: r.skill_id,
        xp: r.xp,
      }));
    },

    async lastTrained(slug, spotId) {
      const { data, error } = await db
        .from('bud_training_spots')
        .select('last_at')
        .eq('bud_id', await idBySlug(slug))
        .eq('spot_id', spotId)
        .maybeSingle();
      if (error) throw error;
      const at = (data as { last_at: string } | null)?.last_at;
      return at ? new Date(at) : null;
    },

    async train(slug, spotId, skill, xp, cooldownSeconds) {
      const { data, error } = await db.rpc('train', {
        p_bud: await idBySlug(slug),
        p_spot: spotId,
        p_skill: skill,
        p_xp: xp,
        p_cooldown: cooldownSeconds,
      });
      if (error) throw error;
      return (data as number | null) ?? null;
    },

    async consumables(slug) {
      const { data, error } = await db
        .from('bud_consumables')
        .select('item_id, qty')
        .eq('bud_id', await idBySlug(slug));
      if (error) throw error;
      return (data as { item_id: string; qty: number }[]).map((r) => ({
        itemId: r.item_id,
        qty: r.qty,
      }));
    },

    async grantConsumable(slug, itemId, qty) {
      const { error } = await db.rpc('grant_consumable', {
        p_bud: await idBySlug(slug),
        p_item: itemId,
        p_qty: qty,
      });
      if (error) throw error;
    },

    async payFare(slug, price) {
      const { data, error } = await db.rpc('pay_fare', {
        p_bud: await idBySlug(slug),
        p_price: price,
      });
      if (error) throw error;
      return data as { status: 'ok' | 'poor'; coins: number };
    },

    async buyConsumable(slug, itemId, price) {
      const { data, error } = await db.rpc('buy_consumable', {
        p_bud: await idBySlug(slug),
        p_item: itemId,
        p_price: price,
      });
      if (error) throw error;
      return data as BuyResult;
    },

    async useConsumable(slug, itemId, buff, seconds) {
      const { data, error } = await db.rpc('use_consumable', {
        p_bud: await idBySlug(slug),
        p_item: itemId,
        p_buff: buff,
        p_seconds: seconds,
      });
      if (error) throw error;
      return data ? new Date(data as string) : null;
    },

    async buffs(slug) {
      const { data, error } = await db
        .from('bud_buffs')
        .select('buff_id, until')
        .eq('bud_id', await idBySlug(slug));
      if (error) throw error;
      return (data as { buff_id: string; until: string }[]).map((r) => ({
        buff: r.buff_id,
        until: new Date(r.until),
      }));
    },

    async lastWin(slug, enemyId) {
      const { data, error } = await db
        .from('bud_fights')
        .select('finished_at')
        .eq('bud_id', await idBySlug(slug))
        .eq('enemy_id', enemyId)
        .eq('status', 'won')
        .order('finished_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const at = (data as { finished_at: string | null } | null)?.finished_at;
      return at ? new Date(at) : null;
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
