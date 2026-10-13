import type { BudRecord, CreateBudInput, ItemSource, OwnedItem } from '@buds/shared';

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
  /** Items granted beyond the free starter set. */
  items(slug: string): Promise<OwnedItem[]>;
  /** Server-only (rewards, verified purchases). Idempotent: granting an owned item is a no-op. */
  grantItem(slug: string, itemId: string, source: ItemSource): Promise<void>;
  /** Ids of quests the bud has completed. */
  completedQuests(slug: string): Promise<string[]>;
  /**
   * Records the completion and adds `xp` atomically. Returns the bud's new XP, or null when the quest was
   * already completed (then nothing changes).
   */
  completeQuest(slug: string, questId: string, xp: number): Promise<number | null>;
  /** Skill ranks (skills never upgraded are absent). */
  skills(slug: string): Promise<{ id: string; rank: number }[]>;
  /**
   * Spends one point on a skill if the bud has a free point (`points` earned in total) and the skill is below
   * `maxRank`. Returns the new rank, or null when not allowed. Must be atomic.
   */
  upgradeSkill(
    slug: string,
    skillId: string,
    points: number,
    maxRank: number,
  ): Promise<number | null>;
  wallet(slug: string): Promise<{ coins: number; gems: number }>;
}
