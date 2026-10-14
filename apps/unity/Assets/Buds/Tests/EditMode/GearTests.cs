using System.Collections.Generic;
using Buds.Characters;
using Buds.Quests;
using Buds.World;
using NUnit.Framework;
using UnityEngine;

namespace Buds.Tests
{
    /// <summary>Gear stats: the same numbers as packages/shared/test/gear.test.ts (Gear.cs mirrors gear.ts).</summary>
    public class GearTests
    {
        static readonly QuestContent Content = QuestContent.Load();
        static readonly Dictionary<string, int> NoRanks = new();

        [Test]
        public void ExportsGearWithSlotsAndBonuses()
        {
            var shoes = Content.Item("buty-sprintery");
            Assert.IsNotNull(shoes);
            Assert.AreEqual("feet", shoes.slot);
            Assert.AreEqual(10, shoes.speed);
            Assert.IsTrue(shoes.shop);
            Assert.IsTrue(shoes.IsGear);
            Assert.IsFalse(Content.Item("outfit-bluza").IsGear, "looks are not gear");
            Assert.AreEqual(9, Content.slots.Length); // eight body slots + the ride
            Assert.AreEqual(4, Content.stats.Length);
            // real money buys looks and an earlier start: a premium item with power matches its earned twin exactly
            foreach (var item in Content.items)
            {
                if (!item.premium) continue;
                var power = item.attack + item.speed + item.armor + item.luck + item.mountSpeed + item.skillBonus.Length;
                if (power == 0 && string.IsNullOrEmpty(item.weapon)) continue;
                var twin = Content.Item(item.twin);
                Assert.IsNotNull(twin, $"{item.id} needs an earned twin");
                Assert.IsFalse(twin.premium, item.id);
                Assert.AreEqual((twin.attack, twin.speed, twin.armor, twin.luck, twin.mountSpeed, twin.weapon, twin.slot),
                    (item.attack, item.speed, item.armor, item.luck, item.mountSpeed, item.weapon, item.slot), item.id);
                Assert.AreEqual(0, item.coins, $"{item.id}: gems only");
                Assert.Greater(item.gems, 0, item.id);
            }
        }

        [Test]
        public void AddsUpWornItems()
        {
            var s = Gear.Stats(Content, new[] { "buty-sprintery", "spodnie-dresy", "bluza-kewlar" }, NoRanks);
            Assert.AreEqual(12, s.Speed);
            Assert.AreEqual(8, s.Armor);
            Assert.AreEqual(0, s.Luck);
        }

        [Test]
        public void AddsGearToSkillsWithinLimits()
        {
            var s = Gear.Stats(Content, new[] { "monokl", "cylinder", "plecak-szperacz" }, new Dictionary<string, int> { ["spryt"] = 1 });
            Assert.AreEqual(3, s.SkillRank("spryt"), "three items, but at most +2");
            Assert.AreEqual(2, s.SkillBonus["spryt"]);
            Assert.AreEqual(0, s.SkillRank("flow"));
            Assert.IsFalse(s.SkillBonus.ContainsKey("flow"));
        }

        [Test]
        public void IgnoresUnknownItemsAndCapsStats()
        {
            var many = new List<string> { "nie-ma-takiego", null };
            for (var i = 0; i < 20; i++) many.Add("buty-sprintery");
            Assert.AreEqual(25, Gear.Stats(Content, many, NoRanks).Speed);
        }

        [Test]
        public void DescribesWhatAnItemGives()
        {
            Assert.AreEqual("+10% Szybkość", Gear.Describe(Content, Content.Item("buty-sprintery")));
            StringAssert.Contains("+1 Spryt", Gear.Describe(Content, Content.Item("plecak-szperacz")));
            Assert.AreEqual("Bez bonusów", Gear.Describe(Content, Content.Item("outfit-bluza")));
        }

        [Test]
        public void SpeedFromGearMakesTheBudFaster()
        {
            var plain = new BudMotor();
            var fast = new BudMotor { SpeedMultiplier = 1.12f };
            Vector2 a = default, b = default;
            for (var i = 0; i < 60; i++)
            {
                a = plain.Step(Vector2.right, false, 0.02f);
                b = fast.Step(Vector2.right, false, 0.02f);
            }
            Assert.AreEqual(BudMotor.WalkSpeed * 1.12f, b.x, 1e-3);
            Assert.Greater(b.x, a.x);
        }

        [Test]
        public void EveryItemHasALevelAndEveryHeldItemIsAWeapon()
        {
            foreach (var item in Content.items)
            {
                Assert.GreaterOrEqual(item.minLevel, 1, item.id);
                if (item.slot == "held") Assert.IsNotEmpty(item.weapon, $"{item.id} is a weapon");
            }
            for (var slot = 0; slot < Content.slots.Length; slot++)
            {
                var n = 0;
                foreach (var item in Content.items)
                    if (item.slot == Content.slots[slot].id) n++;
                // ten or more items per body slot; rides are their own small set (RideTests)
                Assert.GreaterOrEqual(n, Content.slots[slot].id == "mount" ? 6 : 10, Content.slots[slot].id);
            }
        }

        [Test]
        public void AddsAttackFromWeapons()
        {
            var s = Gear.Stats(Content, new[] { "kij-hejnal", "bransoleta-z-kolcami" }, NoRanks);
            Assert.AreEqual(Content.Item("kij-hejnal").attack + Content.Item("bransoleta-z-kolcami").attack, s.Attack);
            StringAssert.StartsWith("+4 Atak", Gear.Describe(Content, Content.Item("kij-hejnal")));
        }
    }

    /// <summary>Duels: the game only animates, but its data has to match what the server plays.</summary>
    public class DuelContentTests
    {
        static readonly QuestContent Content = QuestContent.Load();
        static readonly string[] Anims = { "jab", "hook", "kick", "guard", "thrust", "swing", "spin", "shoot", "spray", "shout", "flip", "dodge", "aim" };

        [Test]
        public void EveryWeaponKindHasFourKnownMoves()
        {
            Assert.AreEqual(6, Content.weapons.Length);
            foreach (var w in Content.weapons)
            {
                Assert.AreEqual(4, w.moves.Length, w.kind);
                foreach (var id in w.moves)
                {
                    var m = Content.Move(id);
                    Assert.IsNotNull(m, id);
                    CollectionAssert.Contains(Anims, m.anim, $"{id}: the fight screen knows how to play it");
                }
            }
            CollectionAssert.AreEqual(Content.MovesFor("piesci"), Content.MovesFor("nieznana"), "unknown = fists");
        }

        [Test]
        public void OpponentsStandOnFreeGroundWithTheirSheets()
        {
            Assert.GreaterOrEqual(Content.enemies.Length, 20);
            foreach (var e in Content.enemies)
            {
                var map = MapFormat.Load(e.district);
                Assert.IsNotEmpty(e.spots, e.id);
                foreach (var p in e.spots) Assert.IsTrue(map.IsWalkable(p.x, p.y), $"{e.id} at ({p.x},{p.y})");
                Assert.IsTrue(Resources.Load<Texture2D>("Enemies/" + e.id), $"{e.id} has a sprite sheet");
                Assert.IsNotEmpty(e.lines, e.id);
            }
        }
    }
}
