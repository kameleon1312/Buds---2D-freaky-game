using System;
using System.Collections.Generic;

namespace Buds.Quests
{
    /// <summary>What a bud's worn gear adds up to (speed %, armor, luck %) and its effective skill ranks.</summary>
    public sealed class GearStats
    {
        public int Attack;
        public int Speed;
        public int Armor;
        public int Luck;
        public readonly Dictionary<string, int> Skills = new();
        /// <summary>What gear adds to each skill (for "+1" labels).</summary>
        public readonly Dictionary<string, int> SkillBonus = new();

        public int Stat(string id) => id switch
        {
            "attack" => Attack,
            "speed" => Speed,
            "armor" => Armor,
            "luck" => Luck,
            _ => 0,
        };

        public int SkillRank(string id) => Skills.TryGetValue(id, out var r) ? r : 0;
    }

    /// <summary>
    /// Mirror of packages/shared/src/gear.ts `characterStats` (the server computes the same numbers and is the one
    /// that counts for coins). Change both together.
    /// </summary>
    public static class Gear
    {
        public static GearStats Stats(QuestContent content, IEnumerable<string> worn, IReadOnlyDictionary<string, int> ranks)
        {
            var stats = new GearStats();
            var gearSkills = new Dictionary<string, int>();
            foreach (var id in worn)
            {
                var item = id == null ? null : content.Item(id);
                if (item == null || item.IsMount) continue; // rides add their own speed (Rides)
                stats.Attack += item.attack;
                stats.Speed += item.speed;
                stats.Armor += item.armor;
                stats.Luck += item.luck;
                foreach (var b in item.skillBonus)
                    gearSkills[b.id] = (gearSkills.TryGetValue(b.id, out var n) ? n : 0) + b.rank;
            }
            stats.Attack = Math.Min(stats.Attack, Max(content, "attack", 40));
            stats.Speed = Math.Min(stats.Speed, Max(content, "speed", 25));
            stats.Armor = Math.Min(stats.Armor, Max(content, "armor", 40));
            stats.Luck = Math.Min(stats.Luck, Max(content, "luck", 50));

            var gearMax = content.skillGearMax > 0 ? content.skillGearMax : 2;
            foreach (var s in content.skills)
            {
                var trained = ranks != null && ranks.TryGetValue(s.id, out var r) ? r : 0;
                var bonus = Math.Min(gearSkills.TryGetValue(s.id, out var g) ? g : 0, gearMax);
                stats.Skills[s.id] = Math.Min(trained + bonus, content.skillMaxRank + gearMax);
                if (bonus > 0) stats.SkillBonus[s.id] = bonus;
            }
            return stats;
        }

        static int Max(QuestContent content, string id, int fallback)
        {
            foreach (var s in content.stats)
                if (s.id == id) return s.max;
            return fallback;
        }

        /// <summary>
        /// What putting an item on (or taking it off) changed: "Pancerz 0 → 3 · Szybkość +0% → +6%". Only stats that moved;
        /// empty when nothing did (a look-only item).
        /// </summary>
        public static string Diff(QuestContent content, GearStats before, GearStats after)
        {
            var parts = new List<string>();
            void Stat(string name, int a, int b, string unit, bool plus)
            {
                if (a == b) return;
                string F(int v) => (plus ? "+" : "") + v + unit;
                parts.Add($"{name} {F(a)} → {F(b)}");
            }
            Stat("Atak", before.Attack, after.Attack, "", false);
            Stat("Pancerz", before.Armor, after.Armor, "", false);
            Stat("Szybkość", before.Speed, after.Speed, "%", true);
            Stat("Szczęście", before.Luck, after.Luck, "%", true);
            foreach (var s in content.skills)
            {
                var a = before.SkillRank(s.id);
                var b = after.SkillRank(s.id);
                if (a != b) parts.Add($"{s.name} {a} → {b}");
            }
            return string.Join("  ·  ", parts);
        }

        /// <summary>"+10% Szybkość · +1 Spryt": what an item adds, for the panel and the shop.</summary>
        public static string Describe(QuestContent content, ItemData item)
        {
            var parts = new List<string>();
            if (item.attack > 0) parts.Add($"+{item.attack} Atak");
            if (item.speed > 0) parts.Add($"+{item.speed}% Szybkość");
            if (item.armor > 0) parts.Add($"+{item.armor} Pancerz");
            if (item.luck > 0) parts.Add($"+{item.luck}% Szczęście");
            if (item.mountSpeed > 0) parts.Add($"+{item.mountSpeed}% szybkości w jeździe");
            if (item.IsDrink)
            {
                var buff = content.Buff(item.drink);
                if (buff != null) return $"{buff.description} ({buff.seconds / 60} min)";
            }
            foreach (var b in item.skillBonus)
            {
                var skill = Array.Find(content.skills, s => s.id == b.id);
                parts.Add($"+{b.rank} {skill?.name ?? b.id}");
            }
            return parts.Count > 0 ? string.Join("  ·  ", parts) : item.premium ? "Tylko wygląd" : "Bez bonusów";
        }
    }
}
