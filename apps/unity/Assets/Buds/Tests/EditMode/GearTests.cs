using System.Collections.Generic;
using Buds.Characters;
using Buds.Quests;
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
            Assert.AreEqual(8, Content.slots.Length);
            Assert.AreEqual(3, Content.stats.Length);
            foreach (var item in Content.items)
                if (item.premium)
                    Assert.IsTrue(item.speed == 0 && item.armor == 0 && item.luck == 0 && item.skillBonus.Length == 0,
                        $"{item.id}: real money buys looks only");
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
    }
}
