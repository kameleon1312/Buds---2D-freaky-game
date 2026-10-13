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
        public int minLevel; // the bud's level needed to wear or buy it
        public string weapon; // held items: piesci | kij | procarka | spray | mikrofon | deska
        public int attack;
        public bool shop;
        public bool premium; // real money: looks only
        public bool available;
        public string description;

        public bool IsGear => !string.IsNullOrEmpty(slot);
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
        public string[] lines;
        public CellData[] spots;
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
    }

    [Serializable]
    public sealed class WeaponData
    {
        public string kind;
        public string[] moves;
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

        public QuestData Quest(string id) => Array.Find(quests, q => q.id == id);

        public ItemData Item(string id) => Array.Find(items, i => i.id == id);

        public IEnumerable<NpcData> NpcsIn(string district)
        {
            foreach (var n in npcs)
                if (n.district == district) yield return n;
        }
    }
}
