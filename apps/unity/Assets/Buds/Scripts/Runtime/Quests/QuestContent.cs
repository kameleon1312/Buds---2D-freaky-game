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
    public sealed class ItemData
    {
        public string id;
        public string name;
        public string kind; // outfit | headwear | accessory | weapon | …
        public string rarity; // common … mythic (design-system rarity colours)
    }

    [Serializable]
    public sealed class SkillData
    {
        public string id;
        public string name;
        public string description;
        public string district;
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

        public static QuestContent Parse(string json)
        {
            var content = JsonUtility.FromJson<QuestContent>(json) ?? new QuestContent();
            content.npcs ??= Array.Empty<NpcData>();
            content.quests ??= Array.Empty<QuestData>();
            content.items ??= Array.Empty<ItemData>();
            content.skills ??= Array.Empty<SkillData>();
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

        public QuestData Quest(string id) => Array.Find(quests, q => q.id == id);

        public ItemData Item(string id) => Array.Find(items, i => i.id == id);

        public IEnumerable<NpcData> NpcsIn(string district)
        {
            foreach (var n in npcs)
                if (n.district == district) yield return n;
        }
    }
}
