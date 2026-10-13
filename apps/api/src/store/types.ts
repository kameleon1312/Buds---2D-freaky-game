import type {
  BudRecord,
  CreateBudInput,
  FightState,
  FightStatus,
  ItemSource,
  OwnedItem,
  SlotId,
} from '@buds/shared';

export type BuyResult = { status: 'ok' | 'owned' | 'poor'; coins: number };
/** ok = linked now, mine = already this user's, taken = another user's. */
export type ClaimResult = 'ok' | 'mine' | 'taken';

/**
 * A bud can have several player tokens (web browser, phone app…). Only sha256 hashes are stored.
 */
export interface BudStore {
  /** `userId`: the account creating it (signed in on the website), if any. */
  create(input: CreateBudInput, tokenHash: string, userId?: string): Promise<BudRecord>;
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
  /** Ids of the caches the bud has opened. */
  openedCaches(slug: string): Promise<string[]>;
  /**
   * Records the opening and adds `coins` to the wallet and `xp` to the bud atomically. Returns the new XP and coin
   * balance, or null when the cache was already opened (then nothing changes).
   */
  openCache(
    slug: string,
    cacheId: string,
    coins: number,
    xp: number,
  ): Promise<{ xp: number; coins: number } | null>;
  /** Worn items by slot (empty slots are absent). */
  equipment(slug: string): Promise<Partial<Record<SlotId, string>>>;
  /** Puts an item into a slot, or empties it (null). The API checks ownership and the slot first. */
  equip(slug: string, slot: SlotId, itemId: string | null): Promise<void>;
  /** Buys an item for coins atomically: never twice, never below zero coins. */
  buyItem(slug: string, itemId: string, price: number): Promise<BuyResult>;
  /** Buds of an account, oldest first. */
  budsOfUser(userId: string): Promise<BudRecord[]>;
  /** The account a bud belongs to, or null for a guest bud. */
  ownerOf(slug: string): Promise<string | null>;
  /** Links a guest bud to an account (only if it has no account yet). */
  claimBud(slug: string, userId: string): Promise<ClaimResult>;
  /** Starts a duel; returns its id. */
  createFight(slug: string, state: FightState): Promise<string>;
  /** Ends any duel the bud left unfinished (status "fled", no reward). */
  abandonFights(slug: string): Promise<void>;
  fight(slug: string, id: string): Promise<FightState | null>;
  /** Saves a played turn if the fight is still active at `turn`; false on a race or retry. */
  saveTurn(slug: string, id: string, turn: number, state: FightState): Promise<boolean>;
  /**
   * Ends an active fight at `turn` with its last state, granting XP and coins atomically, once. Returns the new XP
   * and coin balance, or null when it was not active at that turn.
   */
  finishFight(
    slug: string,
    id: string,
    turn: number,
    state: FightState,
    status: Exclude<FightStatus, 'active'>,
    xp: number,
    coins: number,
  ): Promise<{ xp: number; coins: number } | null>;
  /** When the bud last beat this opponent. */
  lastWin(slug: string, enemyId: string): Promise<Date | null>;
}
