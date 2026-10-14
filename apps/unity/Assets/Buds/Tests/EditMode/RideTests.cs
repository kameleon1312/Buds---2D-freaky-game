using System.Collections.Generic;
using Buds.Characters;
using Buds.Quests;
using Buds.World;
using NUnit.Framework;

namespace Buds.Tests
{
    /// <summary>Rides, energy drinks, training stations and the timing mini-game.</summary>
    public class RideTests
    {
        static readonly QuestContent Content = QuestContent.Load();

        [Test]
        public void ExportsSixRidesWithArtAndRisingSpeed()
        {
            var speeds = new List<int>();
            foreach (var item in Content.items)
            {
                if (!item.IsMount) continue;
                Assert.Greater(item.mountSpeed, 0, item.id);
                if (item.premium) Assert.AreEqual(Content.Item(item.twin).mountSpeed, item.mountSpeed, $"{item.id}: as fast as its twin");
                else if (speeds.Count > 0 && speeds.Count < 6) Assert.Greater(item.mountSpeed, speeds[speeds.Count - 1]);
                speeds.Add(item.mountSpeed);
                var kind = Rides.KindOf(item.id);
                foreach (var name in Rides.SpriteNames(kind))
                    Assert.IsNotNull(UnityEngine.Resources.Load<UnityEngine.Texture2D>("World/" + name), name);
            }
            Assert.GreaterOrEqual(speeds.Count, 11, "six earned rides and the premium ones");
        }

        [Test]
        public void RidesDoNotCountAsGearSpeed()
        {
            var stats = Gear.Stats(Content, new[] { "mount-quad" }, new Dictionary<string, int>());
            Assert.AreEqual(0, stats.Speed);
        }

        [Test]
        public void SpeedMultipliesGearRidePerksAndTurbo()
        {
            Assert.AreEqual(1f, Rides.SpeedMultiplier(0, 0, 0, false), 1e-4);
            Assert.AreEqual(1.2f, Rides.SpeedMultiplier(0, 20, 0, false), 1e-4);
            Assert.AreEqual(1.1f * 1.85f * 1.25f, Rides.SpeedMultiplier(10, 85, 10, true), 1e-4);
            Assert.AreEqual(10, Rides.PerkSpeedPercent(new[] { "rytm-ulicy", "na-fali", "twardziel" }));
        }

        [Test]
        public void RideSpritesPerFacing()
        {
            Assert.AreEqual("rower", Rides.KindOf("mount-rower"));
            Assert.IsNull(Rides.KindOf("buty-trampki"));
            Assert.AreEqual("jazda-quad-bok", Rides.SpriteFor("quad", Facing.Side));
            Assert.IsFalse(Rides.DrawnOverBud("rower", Facing.Side));
            Assert.IsTrue(Rides.DrawnOverBud("rower", Facing.Down));
            Assert.IsFalse(Rides.DrawnOverBud("deskorolka", Facing.Down), "a board stays under the feet");
            Assert.Greater(Rides.Rise("quad"), Rides.Rise("deskorolka"));
            Assert.AreEqual("quad", Rides.ShapeOf("quad-wulkan"));
            Assert.AreEqual("hulajnowa", Rides.ShapeOf("hulajnowa-neon"));
            Assert.AreEqual("e-hulajnowa", Rides.ShapeOf("e-hulajnowa"));
            Assert.AreEqual(Rides.Rise("rower"), Rides.Rise("rower-chrom"));
            Assert.IsFalse(Rides.DrawnOverBud("deskorolka-holo", Facing.Down));
        }

        [Test]
        public void DrinksHaveBoosts()
        {
            var n = 0;
            foreach (var item in Content.items)
            {
                if (!item.IsDrink) continue;
                n++;
                Assert.IsNotNull(Content.Buff(item.drink), item.id);
                Assert.IsFalse(item.IsGear);
                StringAssert.Contains("min", Gear.Describe(Content, item));
            }
            Assert.AreEqual(6, n);
        }

        [Test]
        public void TrainingSpotsStandOnFreeGround()
        {
            Assert.GreaterOrEqual(Content.training.Length, 9);
            foreach (var t in Content.training)
            {
                var map = MapFormat.Load(t.map);
                Assert.IsTrue(map.IsWalkable(t.x, t.y), t.id);
                Assert.IsNotNull(UnityEngine.Resources.Load<UnityEngine.Texture2D>("World/trening-" + t.look), t.look);
                Assert.IsNotNull(System.Array.Find(Content.skills, s => s.id == t.skill), t.skill);
            }
        }

        [Test]
        public void PerksFollowEffectiveRanks()
        {
            Assert.AreEqual(12, Content.perks.Length);
            var perks = Content.PerksFor(new Dictionary<string, int> { ["walka"] = 5, ["flow"] = 3 });
            CollectionAssert.AreEquivalent(new[] { "cios-specjalny", "mistrz-ringu", "rytm-ulicy" }, perks);
            Assert.AreEqual("specjalny", Content.Perk("cios-specjalny").move);
            Assert.IsNotNull(Content.Move("specjalny"));
        }

        [Test]
        public void TimingGameCountsHitsAndGetsHarder()
        {
            var g = new TimingGame(5, 7);
            var width = g.ZoneWidth;
            var speed = g.Speed;
            g.SetMarker(g.ZoneCenter);
            Assert.IsTrue(g.Press());
            Assert.Less(g.ZoneWidth, width);
            Assert.Greater(g.Speed, speed);
            g.SetMarker(g.ZoneMax + 0.05f);
            Assert.IsFalse(g.Press());
            for (var i = 0; i < 3; i++)
            {
                g.SetMarker(g.ZoneCenter);
                g.Press();
            }
            Assert.IsTrue(g.Done);
            Assert.AreEqual(4, g.Score);
            Assert.IsFalse(g.Press(), "no rounds after the last");
        }

        [Test]
        public void TimingMarkerBouncesInsideTheBar()
        {
            var g = new TimingGame(5, 1);
            for (var i = 0; i < 200; i++)
            {
                g.Tick(0.05f);
                Assert.That(g.Marker, Is.InRange(0f, 1f));
            }
        }
    }
}
