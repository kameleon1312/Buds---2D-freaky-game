using System;
using System.Collections.Generic;
using UnityEngine;

// Field names mirror Resources/Quests/content.json (exported by tools/world/export-quests.ts from packages/shared).
// ReSharper disable InconsistentNaming
namespace Buds.Quests
{
    [Serializable]
    public sealed class NpcData
    {
        public string id;
        public string name;
        public string district;
        public int x;
        public int y;
        public string[] lines;
        /// <summary>Side characters stroll this many tiles around their cell; 0 = stands still (quest NPCs).</summary>
        public int wander;
    }

    [Serializable]
    public sealed class CellData
    {
        public int x;
        public int y;
    }

    /// <summary>One quest step, flattened: kind = talk (npc, text) | reach (x, y, radius, label) | collect (item, label, spots).</summary>
    [Serializable]
    public sealed class StepData
    {
        public string kind;
        public string npc;
        public string text;
        public int x;
        public int y;
        public int radius;
        public string label;
        public string item;
        public string enemy; // duel steps
        public CellData[] spots;
    }

    [Serializable]
    public sealed class QuestData
    {
        public string id;
        public string title;
        public string district;
        public string giver;
        public int xp;
        public int minLevel;
        public string[] requires;
        public string intro;
        public string done;
        public string rewardItem;
        public StepData[] steps;
    }

    [Serializable]
    public sealed class SkillBonusData
    {
        public string id;
        public int rank;
    }

    [Serializable]
    public sealed class ItemData
    {
        public string id;
        public string name;
        public string kind; // outfit | headwear | accessory | weapon | gear | …
        public string rarity; // common … mythic (design-system rarity colours)
        public string slot; // gear: head | face | torso | hands | legs | feet | accessory | held; "" = not worn
        public int speed;
        public int armor;
        public int luck;
        public SkillBonusData[] skillBonus;
        public int coins; // price in the coin shop (the server charges)
        public int gems; // price in the premium shop (gems come only from real-money purchases)
        public string twin; // premium items with power: the earned item they match exactly
        public int minLevel; // the bud's level needed to wear or buy it
        public string weapon; // held items: piesci | kij | procarka | spray | mikrofon | deska
        public int attack;
        public bool shop;
        public int mountSpeed; // mounts: % faster while riding (not part of the gear speed cap)
        public string drink; // energy drinks: the boost (turbo | sila | pancerz | fart | skupienie | regeneracja)
        public bool premium; // real money: looks only
        public bool available;
        public string description;

        public bool IsGear => !string.IsNullOrEmpty(slot);
        public bool IsMount => slot == "mount";
        public bool IsDrink => !string.IsNullOrEmpty(drink);
        /// <summary>Sold in the premium shop for gems (unique look, the power of its earned twin).</summary>
        public bool IsPremiumShop => premium && available && gems > 0;
    }

    /// <summary>An opponent for duels; the server holds its stats and resolves the fight.</summary>
    [Serializable]
    public sealed class EnemyData
    {
        public string id;
        public string name;
        public string district;
        public int level;
        public int hp;
        public string weapon;
        public bool boss;
        /// <summary>Lies in wait off the road on a route: hidden until the bud comes close, then picks the fight.</summary>
        public bool ambush;
        public string[] lines;
        public CellData[] spots;
    }

    /// <summary>A wasteland between two cities (packages/shared travel.ts ROUTES).</summary>
    [Serializable]
    public sealed class RouteData
    {
        public string id;
        public string name;
        public string a;
        public string b;
        public int minLevel;
        public int maxLevel;
    }

    /// <summary>A city's harbour: the ferryman's cell and the fare to sail here.</summary>
    [Serializable]
    public sealed class PortData
    {
        public string id;
        public string district;
        public string name;
        public int x;
        public int y;
        public int fare;
        public string npc;
    }

    /// <summary>A duel move: the animation the game plays for it (jab, hook, kick, swing, shoot…).</summary>
    [Serializable]
    public sealed class MoveData
    {
        public string id;
        public string name;
        public string anim;
        public string description;
        public int hits;
        public string effect;
        public bool damage;
        /// <summary>Damage per hit before stats [min, max], and the chance to hit in %: shown on the buttons.</summary>
        public int[] power;
        public int accuracy;
    }

    [Serializable]
    public sealed class WeaponData
    {
        public string kind;
        public string[] moves;
    }

    /// <summary>A learned move: <see cref="from"/> turns into <see cref="to"/> from a level and a skill rank.</summary>
    [Serializable]
    public sealed class MoveUpgradeData
    {
        public string from;
        public string to;
        public int level;
        public string skill;
        public int rank;

        public bool Known(int budLevel, Func<string, int> rankOf) => budLevel >= level && rankOf(skill) >= rank;
    }

    [Serializable]
    public sealed class StatData
    {
        public string id; // speed | armor | luck
        public string name;
        public string unit;
        public int max;
        public string description;
    }

    [Serializable]
    public sealed class SlotData
    {
        public string id;
        public string name;
    }

    [Serializable]
    public sealed class SkillData
    {
        public string id;
        public string name;
        public string description;
        public string district;
    }

    /// <summary>A hidden cache (skrytka): coins and XP the server grants once, when the bud searches it.</summary>
    [Serializable]
    public sealed class CacheData
    {
        public string id;
        public string district;
        public string map; // the district itself or one of its rooms
        public int x;
        public int y;
        public string look; // art: skrytka-<look>, skrytka-<look>-pusta
        public int coins;
        public int xp;
        public int minLevel;
        public string text;
    }

    /// <summary>A special ability unlocked by a skill's rank (3 and 5); some add a duel move.</summary>
    [Serializable]
    public sealed class PerkData
    {
        public string id;
        public string skill;
        public int rank;
        public string name;
        public string description;
        public string move; // "" = no move
    }

    /// <summary>A boost of an energy drink.</summary>
    [Serializable]
    public sealed class BuffData
    {
        public string id;
        public string name;
        public int seconds;
        public string description;
    }

    /// <summary>A training station on the map: a timing mini-game that trains one skill.</summary>
    [Serializable]
    public sealed class TrainingSpotData
    {
        public string id;
        public string district;
        public string map;
        public int x;
        public int y;
        public string skill;
        public string name;
        public string look; // art: trening-<look>
        public string hint;
    }

    /// <summary>A cost in a district's resources (and coins, for land).</summary>
    [Serializable]
    public class LandCost
    {
        public int beton;
        public int stal;
        public int energia;
        public int zywnosc;
    }

    [Serializable]
    public sealed class LandLevelData : LandCost
    {
        public int seconds;
        public int player;
        public int value;
    }

    /// <summary>What clearing a sector asks for (materials, coins, the bud's level), how long the crew works, what it turns up.</summary>
    [Serializable]
    public sealed class LandClearData : LandCost
    {
        public int coins;
        public int level;
        public int seconds;
        public int yields;
    }

    /// <summary>A district rank by might (Osada … Legenda Pogranicza).</summary>
    [Serializable]
    public sealed class LandRankData
    {
        public int min;
        public string name;
    }

    /// <summary>The look of the districts on a wasteland (las, tropik, dwor, zlom).</summary>
    [Serializable]
    public sealed class RouteStyleData
    {
        public string route;
        public string style;
    }

    [Serializable]
    public sealed class BuildingData
    {
        public string id;
        public string name;
        public int w;
        public int h;
        public string produces;
        public int[] limit;
        public string blurb;
        /// <summary>Might it adds by itself (squares, fountains, the statue, the tower), and per cent more rent.</summary>
        public int prestige;
        public int rentBoost;
        public LandLevelData[] levels;
    }

    [Serializable]
    public sealed class ResourceData
    {
        public string id;
        public string name;
        public int price;
    }

    /// <summary>A plot on a wasteland (top-left map cell, the side its gate faces: n, s, e, w) and its price.</summary>
    [Serializable]
    public sealed class PlotData
    {
        public string id;
        public string route;
        public int x;
        public int y;
        public string gate;
        public int price;
    }

    [Serializable]
    public sealed class RouteBonusData
    {
        public string route;
        public string resource;
    }

    /// <summary>Dystrykty (packages/shared land.ts): the plots, the stages, the buildings and what things cost.</summary>
    [Serializable]
    public sealed class LandContent
    {
        public int plotSize;
        /// <summary>Cells in a sector's side, sectors in the plot's side, sectors allowed by the town hall's level.</summary>
        public int sector;
        public int sectors;
        public int[] sectorLimit;
        public int nameMin;
        public int nameMax;
        public int minLevel;
        public int baseStorage;
        public int producerHours;
        public float bonus;
        public int sellBatch;
        public int raidMinLevel;
        public int raidsPerDay;
        public int raidRetryMinutes;
        public int newShieldHours;
        public ResourceData[] resources;
        public RouteBonusData[] routeBonus;
        public PlotData[] plots;
        public LandClearData[] clearings;
        public LandRankData[] ranks;
        public RouteStyleData[] styles;
        public int maxRentBoost;
        public BuildingData[] buildings;

        public BuildingData Building(string id) => Array.Find(buildings ?? Array.Empty<BuildingData>(), b => b.id == id);
        public PlotData Plot(string id) => Array.Find(plots ?? Array.Empty<PlotData>(), p => p.id == id);
        public PlotData[] PlotsOn(string route) => Array.FindAll(plots ?? Array.Empty<PlotData>(), p => p.route == route);
        public string BonusOf(string route) => Array.Find(routeBonus ?? Array.Empty<RouteBonusData>(), b => b.route == route)?.resource;
        public ResourceData Resource(string id) => Array.Find(resources ?? Array.Empty<ResourceData>(), r => r.id == id);
        public string StyleOf(string route) => Array.Find(styles ?? Array.Empty<RouteStyleData>(), s => s.route == route)?.style ?? "las";

        /// <summary>The rank a might gives (index into <see cref="ranks"/>).</summary>
        public int RankIndex(int power)
        {
            var index = 0;
            for (var i = 0; i < (ranks?.Length ?? 0); i++)
                if (power >= ranks[i].min)
                    index = i;
            return index;
        }

        public string RankName(int power) => ranks == null || ranks.Length == 0 ? "" : ranks[RankIndex(power)].name;
    }

    /// <summary>All NPCs and quests the game knows (the API validates completions against the same data).</summary>
    [Serializable]
    public sealed class QuestContent
    {
        public NpcData[] npcs;
        public QuestData[] quests;
        public ItemData[] items;
        public SkillData[] skills;
        public int skillMaxRank;
        public CacheData[] caches;
        public StatData[] stats;
        public SlotData[] slots;
        public int skillGearMax;
        public EnemyData[] enemies;
        public MoveData[] moves;
        public WeaponData[] weapons;
        public MoveUpgradeData[] moveUpgrades;
        public RouteData[] routes;
        public PortData[] ports;
        public PerkData[] perks;
        public BuffData[] buffs;
        public TrainingSpotData[] training;
        public int trainingXpPerRank;
        public int trainingCooldown;
        public int trainingMaxScore;
        public LandContent land;

        public static QuestContent Parse(string json)
        {
            var content = JsonUtility.FromJson<QuestContent>(json) ?? new QuestContent();
            content.npcs ??= Array.Empty<NpcData>();
            content.quests ??= Array.Empty<QuestData>();
            content.items ??= Array.Empty<ItemData>();
            content.skills ??= Array.Empty<SkillData>();
            content.caches ??= Array.Empty<CacheData>();
            content.stats ??= Array.Empty<StatData>();
            content.slots ??= Array.Empty<SlotData>();
            content.enemies ??= Array.Empty<EnemyData>();
            content.moves ??= Array.Empty<MoveData>();
            content.weapons ??= Array.Empty<WeaponData>();
            content.moveUpgrades ??= Array.Empty<MoveUpgradeData>();
            content.routes ??= Array.Empty<RouteData>();
            content.ports ??= Array.Empty<PortData>();
            content.perks ??= Array.Empty<PerkData>();
            content.buffs ??= Array.Empty<BuffData>();
            content.training ??= Array.Empty<TrainingSpotData>();
            foreach (var t in content.training)
                if (string.IsNullOrEmpty(t.map)) t.map = t.district;
            if (content.trainingXpPerRank < 1) content.trainingXpPerRank = 100;
            if (content.trainingCooldown < 1) content.trainingCooldown = 90;
            if (content.trainingMaxScore < 1) content.trainingMaxScore = 5;
            foreach (var e in content.enemies)
            {
                e.lines ??= Array.Empty<string>();
                e.spots ??= Array.Empty<CellData>();
            }
            foreach (var i in content.items)
            {
                i.slot ??= "";
                i.skillBonus ??= Array.Empty<SkillBonusData>();
                i.description ??= "";
                i.weapon ??= "";
                i.drink ??= "";
                i.twin ??= "";
                if (i.minLevel < 1) i.minLevel = 1;
            }
            foreach (var c in content.caches)
            {
                if (string.IsNullOrEmpty(c.map)) c.map = c.district;
                if (c.minLevel < 1) c.minLevel = 1;
            }
            if (content.skillMaxRank < 1) content.skillMaxRank = 5;
            foreach (var q in content.quests)
            {
                q.requires ??= Array.Empty<string>();
                q.steps ??= Array.Empty<StepData>();
                if (q.minLevel < 1) q.minLevel = 1;
            }
            return content;
        }

        public static QuestContent Load()
        {
            var asset = Resources.Load<TextAsset>("Quests/content");
            return asset ? Parse(asset.text) : Parse("{}");
        }

        public NpcData Npc(string id) => Array.Find(npcs, n => n.id == id);

        public EnemyData Enemy(string id) => Array.Find(enemies, e => e.id == id);

        public MoveData Move(string id) => Array.Find(moves, m => m.id == id);

        /// <summary>The moves a weapon kind gives (fists when unknown).</summary>
        public string[] MovesFor(string weapon)
        {
            var w = Array.Find(weapons, x => x.kind == weapon) ?? Array.Find(weapons, x => x.kind == "piesci");
            return w?.moves ?? Array.Empty<string>();
        }

        public PortData PortOfNpc(string npcId) => Array.Find(ports, p => p.npc == npcId);

        public PortData Port(string id) => Array.Find(ports, p => p.id == id);

        public MoveUpgradeData UpgradeOf(string move) => Array.Find(moveUpgrades, u => u.from == move);

        /// <summary>
        /// The weapon's moves as this bud knows them (the same rule the server fights with): each one swapped for its
        /// learned version once the level and the skill rank (training and gear count) are there.
        /// </summary>
        public string[] LearnedMoves(string weapon, int level, Func<string, int> rankOf)
        {
            var moves = (string[])MovesFor(weapon).Clone();
            for (var i = 0; i < moves.Length; i++)
            {
                var u = UpgradeOf(moves[i]);
                if (u != null && u.Known(level, rankOf)) moves[i] = u.to;
            }
            return moves;
        }

        /// <summary>Moves learned between two sets of the same weapon (for the "Nowy cios" note).</summary>
        public List<string> NewlyLearned(string[] before, string[] after)
        {
            var learned = new List<string>();
            if (before == null || after == null || before.Length != after.Length) return learned;
            for (var i = 0; i < after.Length; i++)
                if (before[i] != after[i] && UpgradeOf(before[i])?.to == after[i]) learned.Add(after[i]);
            return learned;
        }

        public QuestData Quest(string id) => Array.Find(quests, q => q.id == id);

        public BuffData Buff(string id) => Array.Find(buffs, b => b.id == id);

        public PerkData Perk(string id) => Array.Find(perks, p => p.id == id);

        /// <summary>The perks a bud has with these effective ranks (mirror of packages/shared perksFor).</summary>
        public List<string> PerksFor(IReadOnlyDictionary<string, int> ranks)
        {
            var list = new List<string>();
            foreach (var p in perks)
                if (ranks != null && ranks.TryGetValue(p.skill, out var r) && r >= p.rank) list.Add(p.id);
            return list;
        }

        public ItemData Item(string id) => Array.Find(items, i => i.id == id);

        public IEnumerable<NpcData> NpcsIn(string district)
        {
            foreach (var n in npcs)
                if (n.district == district) yield return n;
        }
    }
}
