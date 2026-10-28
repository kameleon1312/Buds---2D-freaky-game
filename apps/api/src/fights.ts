import {
  KO_LOSS_PVE,
  KO_LOSS_PVP,
  fightXp,
  levelFromXp,
  newFight,
  pvpEnemyId,
  pvpOpponentOf,
  raidPlotOf,
  rollLoot,
  turfAt,
  type BudRecord,
  type CatalogItem,
  type DistrictContent,
  type FightReward,
  type FightState,
  type Fighter,
  type Influence,
  type PvpResult,
  type RaidResult,
} from '@buds/shared';
import type { BudStore } from './store/types.js';
import type { createLand } from './land.js';
import type { createRivalry } from './rivalry.js';

/**
 * The ends of real-time fights (docs/walka.md), written down once like every reward: the live server runs the fight
 * (brawl.ts), this grants what it earned through the same store calls the duels always used (a fight record finished
 * atomically with its XP and coins, loot, influence in the turf, the PvP rating, a raid's loot) and takes the coins a
 * knockout costs (atomic `knockout_coins`).
 */
export type Fights = ReturnType<typeof createFights>;

export type FightWin = {
  reward: FightReward | null;
  influence: Influence | null;
  pvp: PvpResult | null;
  raid: RaidResult | null;
};

export function createFights(deps: {
  store: BudStore;
  catalog: readonly CatalogItem[];
  content: DistrictContent;
  rivalry: ReturnType<typeof createRivalry>;
  land: ReturnType<typeof createLand>;
  fighterOf: (bud: BudRecord, withDrinks: boolean) => Promise<Fighter>;
}) {
  const { store, catalog, content, rivalry, land } = deps;
  const seed = () => (Math.random() * 2 ** 31) | 0;

  const rewardOf = (
    bud: BudRecord,
    levelBefore: number,
    result: { xp: number; coins: number },
    xpGained: number,
    coinsGained: number,
    item: string | null,
    drink: string | null,
  ): FightReward => {
    const level = levelFromXp(result.xp).level;
    return {
      xpGained,
      xp: result.xp,
      level,
      levelUp: level > levelBefore,
      coinsGained,
      coins: result.coins,
      item,
      drink,
    };
  };

  /** A record of a fight that is over already: started and finished in one go. */
  const record = async (
    slug: string,
    state: FightState,
    status: 'won' | 'lost',
    xp: number,
    coins: number,
  ) => {
    const id = await store.createFight(slug, state);
    return store.finishFight(slug, id, 0, { ...state, status }, status, xp, coins);
  };

  return {
    fighterOf: deps.fighterOf,

    /** The bud's team: its crew's tag, or '' (alone). */
    async teamOf(slug: string): Promise<string> {
      return (await store.crewOf(slug))?.tag ?? '';
    },

    /**
     * Beat an opponent of the districts: XP for the level gap, coins with luck, loot by its rarity table, influence
     * in the turf of its spot. Once per knockout (the live server calls it once per bud that hit it).
     */
    async winMob(
      slug: string,
      enemyId: string,
      spot: number,
      me: Fighter,
    ): Promise<FightWin | null> {
      const enemy = content.enemies.find((e) => e.id === enemyId);
      const bud = await store.getBySlug(slug);
      if (!enemy || !bud) return null;
      const levelBefore = levelFromXp(bud.xp).level;
      const xpGained = fightXp(enemy, levelBefore);
      const owned = new Set((await store.items(slug)).map((i) => i.itemId));
      const s = seed();
      const loot = rollLoot(enemy, me.luck, catalog, owned, s, { perks: me.perks });
      const state: FightState = { ...newFight(enemy.id, me, me, s), spot };
      const result = await record(slug, state, 'won', xpGained, loot.coins);
      if (!result) return null;
      if (loot.itemId) await store.grantItem(slug, loot.itemId, 'reward');
      if (loot.drink) await store.grantConsumable(slug, loot.drink, 1);
      const at = enemy.spots[Math.min(spot, enemy.spots.length - 1)]!;
      const influence = await rivalry.earn(
        slug,
        turfAt(enemy.district, at.x, at.y),
        'duel',
        'zwyciestwa',
        enemy.boss ? 2 : 1,
      );
      return {
        reward: rewardOf(bud, levelBefore, result, xpGained, loot.coins, loot.itemId, loot.drink),
        influence,
        pvp: null,
        raid: null,
      };
    },

    /** Knocked out by an opponent of the districts: the loss written down and a few coins gone (burned). */
    async loseMob(
      slug: string,
      enemyId: string,
      me: Fighter,
    ): Promise<{ lost: number; coins: number }> {
      await record(slug, newFight(enemyId, me, me, seed()), 'lost', 0, 0);
      return store.knockout(slug, null, KO_LOSS_PVE.percent, KO_LOSS_PVE.max);
    },

    /** A rival's or a defender's fight the REST API started, still waiting to be fought: its state and its look. */
    async shadowFight(slug: string, id: string) {
      const state = await store.fight(slug, id);
      if (!state || state.status !== 'active') return null;
      const rival = pvpOpponentOf(state.enemyId);
      const plot = raidPlotOf(state.enemyId);
      if (!rival && !plot) return null;
      const look = rival ?? (await store.landOnPlot(plot!))?.slug ?? '';
      return { state, look, kind: rival ? ('pvp' as const) : ('raid' as const) };
    },

    /**
     * The first blow between a bud and a shadow: from now on walking away (or starting another duel) counts as a loss.
     */
    async exchanged(slug: string, id: string): Promise<void> {
      const state = await store.fight(slug, id);
      if (state?.status === 'active' && state.turn === 0)
        await store.saveTurn(slug, id, 0, { ...state, turn: 1 });
    },

    /**
     * The end of a shadow fight: won or lost on the street, or left without a knockout (fled: after the first blow
     * that counts as lost, like running from a duel always did).
     */
    async finishShadow(
      slug: string,
      id: string,
      outcome: 'won' | 'lost' | 'fled',
      exchanged: boolean,
    ): Promise<FightWin | null> {
      const bud = await store.getBySlug(slug);
      const before = await store.fight(slug, id);
      if (!bud || !before || before.status !== 'active') return null;
      if (!(await store.finishFight(slug, id, before.turn, before, outcome, 0, 0))) return null;
      const counted: FightState['status'] =
        outcome === 'fled' ? (exchanged ? 'lost' : 'fled') : outcome;
      if (counted === 'fled') return { reward: null, influence: null, pvp: null, raid: null };
      const state = { ...before, status: counted };
      if (pvpOpponentOf(state.enemyId)) {
        const { pvp, reward } = await rivalry.finishPvp(bud, state);
        return { reward, influence: null, pvp, raid: null };
      }
      return { reward: null, influence: null, pvp: null, raid: await land.finishRaid(bud, state) };
    },

    /**
     * One bud knocked another out on the street. When the pair hasn't paid each other lately (`pay`), the loser's
     * pocket loses a share to the winner (atomic) and the winner's rating moves like a won PvP duel.
     */
    async street(
      killer: string,
      victim: string,
      pay: boolean,
    ): Promise<{ win: FightWin | null; lost: number; left: number; taken: number }> {
      const [k, v] = await Promise.all([store.getBySlug(killer), store.getBySlug(victim)]);
      if (!k || !v || !pay) {
        const left = (await store.wallet(victim)).coins;
        return { win: null, lost: 0, left, taken: 0 };
      }
      const ko = await store.knockout(victim, killer, KO_LOSS_PVP.percent, KO_LOSS_PVP.max);
      const [me, them] = await Promise.all([deps.fighterOf(k, false), deps.fighterOf(v, false)]);
      const state: FightState = {
        ...newFight(pvpEnemyId(victim), me, them, seed()),
        status: 'won',
      };
      const { pvp, reward } = await rivalry.finishPvp(k, state);
      const wallet = await store.wallet(killer);
      return {
        win: {
          reward: reward && {
            ...reward,
            coinsGained: reward.coinsGained + ko.lost,
            coins: wallet.coins,
          },
          influence: null,
          pvp,
          raid: null,
        },
        lost: ko.lost,
        left: ko.coins,
        taken: ko.lost,
      };
    },
  };
}
