using System.Collections.Generic;
using Buds.Characters;
using Buds.Quests;
using Buds.World;
using NUnit.Framework;
using UnityEngine;

namespace Buds.Tests
{
    public class GroundLookTests
    {
        [Test]
        public void EveryGroundGetsTheSurfaceOfItsMaterial()
        {
            Assert.AreEqual(GroundLook.Pattern.Grass, GroundLook.For("grass2"));
            Assert.AreEqual(GroundLook.Pattern.Slabs, GroundLook.For("sidewalk"));
            Assert.AreEqual(GroundLook.Pattern.Asphalt, GroundLook.For("asphalt"));
            Assert.AreEqual(GroundLook.Pattern.Water, GroundLook.For("ocean"));
            Assert.AreEqual(GroundLook.Pattern.Sand, GroundLook.For("lagoon-shore"));
            Assert.AreEqual(GroundLook.Pattern.Boards, GroundLook.For("floor"));
            Assert.AreEqual(GroundLook.Pattern.Grain, GroundLook.For("wall"));
        }

        [Test]
        public void SurfacesAreNearWhiteAndTheSameEveryTime()
        {
            foreach (GroundLook.Pattern pattern in System.Enum.GetValues(typeof(GroundLook.Pattern)))
            {
                var a = GroundLook.Pixels(pattern);
                var b = GroundLook.Pixels(pattern);
                CollectionAssert.AreEqual(a, b, pattern.ToString());
                var sum = 0f;
                foreach (var v in a)
                {
                    Assert.That(v, Is.InRange(0.5f, 1f), pattern.ToString());
                    sum += v;
                }
                // the map's colours stay the map's: the average is close to white and lifted back by the gain
                Assert.Greater(sum / a.Length, 0.85f, pattern.ToString());
                Assert.That(GroundLook.Gain(pattern), Is.InRange(1f, 1.15f));
            }
        }

        [Test]
        public void EveryDistrictHasItsOwnLight()
        {
            var city = WorldGrade.For("miasto-ziomkow", false);
            var forest = WorldGrade.For("dzika-puszcza", false);
            var room = WorldGrade.For("miasto-ziomkow", true);
            Assert.AreNotEqual(city.Highlights, forest.Highlights);
            Assert.Greater(room.Vignette, city.Vignette);
            // never so strong that the map's colours are lost
            foreach (var id in new[] { "miasto-ziomkow", "dzika-puszcza", "las-palmas", "dwor-carski", "los-karkos" })
            {
                var m = WorldGrade.For(id, false);
                Assert.That(m.Contrast, Is.InRange(0f, 20f));
                Assert.That(m.Saturation, Is.InRange(-15f, 20f));
                Assert.That(m.Vignette, Is.InRange(0f, 0.35f));
            }
        }
    }

    public class HeldWeaponTests
    {
        [Test]
        public void TheGripSitsInTheDrawnHandOnEveryFrame()
        {
            // the hand hangs at the hip, on the body's centre line (vector.ts: hand (61, 107) under the shoulder)
            var rest = BudSheet.SideHand(0);
            Assert.AreEqual(0.01f, rest.x, 0.02f);
            Assert.AreEqual(0.27f, rest.y, 0.03f);
            // a step swings it forward (−x: side frames face left) or back, a little higher
            Assert.Less(BudSheet.SideHand(1).x, rest.x - 0.05f);
            Assert.Greater(BudSheet.SideHand(2).x, rest.x + 0.05f);
        }
    }

    public class LearnedMoveTests
    {
        static readonly QuestContent Content = QuestContent.Load();

        static System.Func<string, int> Ranks(Dictionary<string, int> r) => id => r.TryGetValue(id, out var n) ? n : 0;

        [Test]
        public void MovesGrowStrongerWithLevelAndSkillLikeOnTheServer()
        {
            Assert.IsNotEmpty(Content.moveUpgrades);
            var none = Ranks(new Dictionary<string, int>());
            CollectionAssert.AreEqual(Content.MovesFor("piesci"), Content.LearnedMoves("piesci", 20, none));
            var fighter = Ranks(new Dictionary<string, int> { ["walka"] = 3, ["przetrwanie"] = 1 });
            CollectionAssert.AreEqual(new[] { "seria-ciosow", "bomba", "z-polobrotu", "kontra" },
                Content.LearnedMoves("piesci", 10, fighter));
            // every learned move is a real move with a name for the buttons
            foreach (var u in Content.moveUpgrades)
                Assert.IsNotNull(Content.Move(u.to), u.to);
        }

        [Test]
        public void TheNoteNamesOnlyMovesJustLearned()
        {
            var before = Content.LearnedMoves("piesci", 6, Ranks(new Dictionary<string, int> { ["walka"] = 2 }));
            var after = Content.LearnedMoves("piesci", 7, Ranks(new Dictionary<string, int> { ["walka"] = 2 }));
            CollectionAssert.AreEqual(new[] { "bomba" }, Content.NewlyLearned(before, after));
            // a different weapon is not "learning"
            Assert.IsEmpty(Content.NewlyLearned(Content.MovesFor("kij"), after));
        }
    }
}
