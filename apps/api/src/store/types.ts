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
export type GemBuyResult = { status: 'ok' | 'owned' | 'poor'; gems: number };
/** ok = linked now, mine = already this user's, taken = another user's. */
export type ClaimResult = 'ok' | 'mine' | 'taken';

/**
 * A bud can have several player tokens (web browser, phone app…). Only sha256 hashes are stored.
 */
/** A row of the districts' ranking. */
export type LandTopRow = {
  slug: string;
  name: string;
  xp: number;
  /** The district's own name (chosen by the bud). */
  district: string;
  /** The wasteland its plot is on. */
  route: string;
  power: number;
};

/** One side of a raid to save: whose district, the version it was worked out from, the new state and might. */
export type LandSave = { slug: string; version: number; state: unknown; power: number };

/** Dystrykty: one document per bud on a plot of a wasteland, saved by compare-and-swap on its version. */
export interface LandStore {
  /** The bud's district and its version, or null when it has none. */
  getLand(slug: string): Promise<{ state: unknown; version: number } | null>;
  /** The district on a plot (its owner's slug, state and version), or null when the plot is free. */
  landOnPlot(plot: string): Promise<{ slug: string; state: unknown; version: number } | null>;
  /** Every district on a wasteland, with its owner's name and XP. */
  landsOn(route: string): Promise<{ slug: string; name: string; xp: number; state: unknown }[]>;
  /**
   * Buys a plot and makes the bud's district on it, paying `price` coins in the same transaction. `has_land`: the
   * bud already has one; `taken`: someone owns the plot; `poor`: not enough coins (`coins` is the balance).
   */
  createLand(
    slug: string,
    plot: string,
    route: string,
    state: unknown,
    power: number,
    price: number,
  ): Promise<{ status: 'ok' | 'has_land' | 'taken' | 'poor'; coins: number }>;
  /**
   * Saves a district worked out from `version`, moving `coinDelta` coins with it (never below zero). `conflict`: it
   * was saved by someone else meanwhile (work it out again from the new version).
   */
  saveLand(
    slug: string,
    version: number,
    state: unknown,
    power: number,
    coinDelta: number,
  ): Promise<{ status: 'ok' | 'conflict' | 'poor'; version?: number; coins: number }>;
  /** Saves both districts of a raid at once, or neither (`conflict` when either changed meanwhile). */
  saveRaid(raider: LandSave, defender: LandSave): Promise<'ok' | 'conflict'>;
  /** The mightiest districts. */
  topLands(limit: number): Promise<LandTopRow[]>;
}

export interface BudStore extends RivalryStore, LandStore {
  /** `userId`: the account creating it (signed in on the website), if any. */
  create(input: CreateBudInput, tokenHash: string, userId?: string): Promise<BudRecord>;
  getBySlug(slug: string): Promise<BudRecord | null>;
  getByTokenHash(tokenHash: string): Promise<BudRecord | null>;
  addToken(slug: string, tokenHash: string): Promise<void>;
  /** Signs one device out: its token stops working (the bud and its other devices are untouched). */
  removeToken(tokenHash: string): Promise<void>;
  /** A new look for the bud (validated and checked against owned items by the API); the updated bud. */
  updateLook(slug: string, look: BudRecord['look']): Promise<BudRecord>;
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
  /** Fight loadouts (loadout.ts), one per weapon kind: five ability ids or null. */
  loadouts(slug: string): Promise<Record<string, (string | null)[]>>;
  setLoadout(slug: string, weapon: string, kit: (string | null)[]): Promise<void>;
  /** How far each move is upgraded (absent = 0). */
  moveRanks(slug: string): Promise<Record<string, number>>;
  /** One upgrade of a move from rank `from` for `price` coins, atomically (a stale rank is a race). */
  upgradeMove(
    slug: string,
    moveId: string,
    from: number,
    price: number,
  ): Promise<{ status: 'ok' | 'race' | 'poor'; coins: number; rank: number }>;
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
  /** Buys a premium item for gems atomically: never twice, never below zero gems. Source "purchase". */
  buyItemWithGems(slug: string, itemId: string, price: number): Promise<GemBuyResult>;
  /** Server-only: gems from a verified real-money purchase. Returns the new balance. */
  grantGems(slug: string, gems: number): Promise<number>;
  /** Buds of an account, oldest first. */
  budsOfUser(userId: string): Promise<BudRecord[]>;
  /** The account a bud belongs to, or null for a guest bud. */
  ownerOf(slug: string): Promise<string | null>;
  /** Links a guest bud to an account (only if it has no account yet). */
  claimBud(slug: string, userId: string): Promise<ClaimResult>;
  /** Starts a duel; returns its id. */
  createFight(slug: string, state: FightState): Promise<string>;
  /** Ends any duel the bud left unfinished (status "fled", no reward); the ones it ended, with their last turn. */
  abandonFights(slug: string): Promise<{ enemyId: string; turn: number }[]>;
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
  /**
   * A knockout in a real-time fight (walka.md): the victim loses `percent`% of its coins, at most `max`, atomically;
   * to the killer when there is one, burned otherwise. Returns what was lost and the victim's coins after.
   */
  knockout(
    victim: string,
    killer: string | null,
    percent: number,
    max: number,
  ): Promise<{ lost: number; coins: number }>;
  /** When the bud last beat this opponent. */
  lastWin(slug: string, enemyId: string): Promise<Date | null>;
  /** Training XP per skill (skills never trained are absent). */
  training(slug: string): Promise<{ skill: string; xp: number }[]>;
  /** When the bud last trained at this spot. */
  lastTrained(slug: string, spotId: string): Promise<Date | null>;
  /**
   * A training round: if the spot is not cooling down (`cooldownSeconds` since the last round), records it and adds
   * `xp` to the skill atomically. Returns the skill's new training XP, or null while cooling down.
   */
  train(
    slug: string,
    spotId: string,
    skill: string,
    xp: number,
    cooldownSeconds: number,
  ): Promise<number | null>;
  /** Energy drinks the bud carries (none = absent or qty 0). */
  consumables(slug: string): Promise<{ itemId: string; qty: number }[]>;
  /** Server-only (loot). Adds drinks to the count. */
  grantConsumable(slug: string, itemId: string, qty: number): Promise<void>;
  /** Pays a fare (the ferry) atomically: never below zero coins. */
  payFare(slug: string, price: number): Promise<{ status: 'ok' | 'poor'; coins: number }>;

  /** Buys one drink for coins atomically (never below zero coins); drinks can be bought again and again. */
  buyConsumable(slug: string, itemId: string, price: number): Promise<BuyResult>;
  /** Drinks one: takes it from the count and starts its boost. Returns the boost's end, or null if none left. */
  useConsumable(slug: string, itemId: string, buff: string, seconds: number): Promise<Date | null>;
  /** Boosts with their end (also ended ones; the API filters by time). */
  buffs(slug: string): Promise<{ buff: string; until: Date }[]>;
}

// ---------- rywalizacja (packages/shared rivalry.ts, migration 20261017000000_rivalry.sql) ----------

export type InfluenceResult = { gained: number; total: number; captured: boolean };
export type CrewStatus = 'ok' | 'in_crew' | 'taken' | 'full' | 'unknown';
export type ListStatus = 'ok' | 'not_owned' | 'worn' | 'too_many';
export type MarketBuyStatus = 'ok' | 'gone' | 'own' | 'owned' | 'poor';
export type ListingRecord = {
  id: string;
  itemId: string;
  price: number;
  seller: { slug: string; name: string };
  createdAt: string;
};

/** Weekly turfs, challenges, crews, PvP and the market. Every write is atomic (SQL functions in Supabase). */
export interface RivalryStore {
  /**
   * Influence for something done in a turf, capped per bud, turf and day; also counts the week's `challenge`.
   * `captured`: the bud rules the turf now (at least `min` points, first there on a tie) and didn't before.
   */
  addInfluence(
    slug: string,
    turf: string,
    week: string,
    day: string,
    points: number,
    cap: number,
    min: number,
    challenge: string | null,
  ): Promise<InfluenceResult>;
  /** Counts a weekly challenge on its own (PvP wins). */
  bumpChallenge(slug: string, week: string, challenge: string): Promise<number>;
  /** Every bud's influence this week in these turfs, best first (ties: first there first). */
  turfBoards(
    turfs: readonly string[],
    week: string,
  ): Promise<{ turf: string; slug: string; name: string; points: number }[]>;
  /** The ruler collects today's tribute; the new coin balance, or null (not the ruler / already collected). */
  claimTribute(
    slug: string,
    turf: string,
    week: string,
    day: string,
    coins: number,
    min: number,
  ): Promise<number | null>;
  /** Turfs whose tribute the bud collected on `day`. */
  tributesClaimed(slug: string, day: string): Promise<string[]>;
  /** Settles a finished week once (titles and coins for its winners); false when already settled. */
  settleWeek(
    week: string,
    min: number,
    turfCoins: number,
    topCoins: readonly number[],
  ): Promise<boolean>;
  titles(slug: string): Promise<{ week: string; title: string }[]>;
  /** Buds by total influence this week, best first. */
  weekTotals(
    week: string,
    limit: number,
  ): Promise<{ slug: string; name: string; xp: number; points: number }[]>;
  /** A bud's total influence this week and its place (null without points). */
  weekStanding(slug: string, week: string): Promise<{ points: number; rank: number | null }>;
  challengeLeaders(
    week: string,
    challenge: string,
    limit: number,
  ): Promise<{ slug: string; name: string; count: number }[]>;
  /** The bud's count and place in every challenge it took part in this week. */
  challengeStanding(
    slug: string,
    week: string,
  ): Promise<{ challenge: string; count: number; rank: number }[]>;

  createCrew(slug: string, name: string, tag: string): Promise<CrewStatus>;
  joinCrew(slug: string, tag: string, max: number): Promise<CrewStatus>;
  leaveCrew(slug: string): Promise<boolean>;
  crewOf(slug: string): Promise<{ tag: string; name: string } | null>;
  /** A crew with its members, leader first, then by joining. */
  crewByTag(tag: string): Promise<{
    tag: string;
    name: string;
    members: { slug: string; name: string; xp: number; role: 'leader' | 'member' }[];
  } | null>;
  /** Crews by size, then age. */
  crews(limit: number): Promise<{ tag: string; name: string; members: number }[]>;
  /** Crew tags of these buds (buds without a crew are absent). */
  crewTags(slugs: readonly string[]): Promise<Map<string, string>>;
  /** Crews by their members' influence this week. */
  crewWeekTotals(
    week: string,
    limit: number,
  ): Promise<{ tag: string; name: string; points: number; members: number }[]>;

  /** PvP ratings of these buds (absent = never fought: the starting rating). */
  ratings(
    slugs: readonly string[],
  ): Promise<Map<string, { rating: number; wins: number; losses: number }>>;
  /** Buds with XP in the range, for matchmaking. */
  budsAround(minXp: number, maxXp: number, limit: number): Promise<BudRecord[]>;
  /** When the bud last challenged each opponent. */
  pvpLastChallenges(slug: string): Promise<Map<string, Date>>;
  /** Records a challenge if the rematch cooldown has passed. */
  pvpChallenge(slug: string, opponent: string, cooldownSeconds: number): Promise<boolean>;
  /**
   * The challenger won: ratings move by `delta`; the day's first `paidWins` wins pay `coins` (atomically).
   * The winner's new rating, wins today, coins paid and coin balance.
   */
  pvpWin(
    winner: string,
    loser: string,
    delta: number,
    day: string,
    coins: number,
    paidWins: number,
  ): Promise<{ rating: number; winsToday: number; paid: number; coins: number }>;
  /** The challenger lost: ratings move by `delta`; the loser's new rating. */
  pvpLoss(loser: string, winner: string, delta: number): Promise<number>;
  pvpLeaders(limit: number): Promise<{ slug: string; name: string; rating: number }[]>;
  /** PvP wins of the bud on `day` (the paid ones are the first PVP_PAID_WINS). */
  pvpWinsToday(slug: string, day: string): Promise<number>;

  marketList(
    slug: string,
    itemId: string,
    price: number,
    max: number,
  ): Promise<{ status: ListStatus; id?: string }>;
  marketCancel(slug: string, id: string): Promise<boolean>;
  marketBuy(
    slug: string,
    id: string,
    fee: number,
  ): Promise<{ status: MarketBuyStatus; coins: number }>;
  /** Unsold listings, newest first. */
  listings(limit: number): Promise<ListingRecord[]>;
  listing(id: string): Promise<ListingRecord | null>;
}
