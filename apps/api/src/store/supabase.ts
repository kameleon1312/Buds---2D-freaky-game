import { createClient } from '@supabase/supabase-js';
import { budLookSchema, ownedItemSchema, type BudRecord } from '@buds/shared';
import { makeSlug } from './slug.js';
import type { BudStore } from './types.js';

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

    async create(input, tokenHash) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await db
          .from('buds')
          .insert({ slug: makeSlug(input.name), name: input.name, look: input.look })
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
