import type { BudRecord, CreateBudInput } from '@buds/shared';

/**
 * A bud can have several player tokens (web browser, phone app…). Only sha256 hashes are stored.
 */
export interface BudStore {
  create(input: CreateBudInput, tokenHash: string): Promise<BudRecord>;
  getBySlug(slug: string): Promise<BudRecord | null>;
  getByTokenHash(tokenHash: string): Promise<BudRecord | null>;
  addToken(slug: string, tokenHash: string): Promise<void>;
  /** Short-lived code shown on the web and typed into the game to link a device. */
  savePairCode(slug: string, code: string, expiresAt: Date): Promise<void>;
  /** Consumes the code; returns the bud's slug, or null if unknown/expired. */
  redeemPairCode(code: string, now: Date): Promise<string | null>;
  top(limit: number): Promise<BudRecord[]>;
}
