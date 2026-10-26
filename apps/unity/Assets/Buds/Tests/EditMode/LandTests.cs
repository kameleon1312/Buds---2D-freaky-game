using System;
using Buds.Quests;
using Buds.World;
using NUnit.Framework;
using UnityEngine;

namespace Buds.Tests
{
    /// <summary>Dystrykty in the game: the same rules as packages/shared land.ts, and the plots on the wasteland maps.</summary>
    public class LandTests
    {
        static readonly QuestContent Content = QuestContent.Load();
        const double T0 = 1_800_000_000_000d;
        const double H = 3_600_000d;
        /// <summary>Free spots for a 3×3 building on a first-stage district, either side above the town hall.</summary>
        static readonly Vector2Int A = new(8, 9);
        static readonly Vector2Int B = new(14, 9);
        const string Plot = "ostepy-1";

        /// <summary>A district like land.ts newLand: the town hall in the middle, concrete and steel to start.</summary>
        static Land NewLand(int concrete = 100, int steel = 40, int stage = 1, string plot = Plot)
        {
            var land = new Land(Content.land);
            var r = Content.land;
            land.Apply(new LandViewDto
            {
                land = new LandStateDto
                {
                    plot = plot,
                    name = "Nowa Huta",
                    stage = stage,
                    resources = new LandResourcesDto { beton = concrete, stal = steel },
                    buildings = new[]
                    {
                        new LandBuildingDto { id = 1, kind = Land.Hall, x = r.hallX, y = r.hallY, level = 1, readyAt = T0, collectedAt = T0 },
                    },
                    nextId = 2,
                    shieldUntil = T0 + 48 * H,
                },
                now = T0,
                storage = r.baseStorage,
            }, T0);
            return land;
        }

        [Test]
        public void TheRulesComeWithTheContent()
        {
            var r = Content.land;
            Assert.IsNotNull(r);
            Assert.AreEqual(23, r.plotSize);
            Assert.AreEqual(4, r.resources.Length);
            Assert.AreEqual(4, r.stageSides.Length);
            Assert.AreEqual(r.stageSides.Length, r.stages.Length);
            Assert.IsNotNull(r.Building(Land.Hall));
            Assert.AreEqual(Land.Rent, r.Building("apartamentowiec").produces);
            Assert.AreEqual("energia", r.BonusOf("pustkowie-ostepy"));
            foreach (var b in r.buildings)
            {
                Assert.AreEqual(1, b.w % 2, $"{b.id}: odd width");
                Assert.AreEqual(5, b.levels.Length, b.id);
                Assert.AreEqual(5, b.limit.Length, b.id);
            }
        }

        [Test]
        public void PlacingFollowsTheServersRules()
        {
            var land = NewLand();
            var r = Content.land;
            Assert.IsNull(land.PlacementProblem("szklarnia", A.x, A.y, 3));
            Assert.IsNull(land.PlacementProblem("szklarnia", B.x, B.y, 3));
            Assert.AreEqual("outside", land.PlacementProblem("szklarnia", 3, 9, 9), "beyond the first stage's square");
            Assert.AreEqual("occupied", land.PlacementProblem("szklarnia", r.hallX, r.hallY, 9));
            Assert.AreEqual("level_too_low", land.PlacementProblem("szklarnia", A.x, A.y, 2));
            Assert.AreEqual("poor", NewLand(0).PlacementProblem("szklarnia", A.x, A.y, 9));
            Assert.AreEqual("too_many", land.PlacementProblem(Land.Hall, A.x, A.y, 9));
            Assert.AreEqual("unknown_building", land.PlacementProblem("zamek", A.x, A.y, 9));
            // at the last stage the square reaches the fence: the gate (south on this plot) keeps a clear way in
            Assert.AreEqual("gate", NewLand(stage: 4).PlacementProblem("szklarnia", (r.plotSize - 1) / 2, r.plotSize - 3, 9));
            Assert.IsNull(NewLand(stage: 2).PlacementProblem("szklarnia", 6, 9, 9), "the second stage reaches further");
        }

        [Test]
        public void TheDistrictGrowsWithLevelHallAndCoins()
        {
            var land = NewLand(2000, 2000);
            Assert.AreEqual(new RectInt(7, 7, 9, 9), land.StageArea(1));
            Assert.AreEqual(21, land.StageArea(4).width);
            Assert.AreEqual("level_too_low", land.GrowProblem(4, 9999));
            Assert.AreEqual("hall_too_low", land.GrowProblem(5, 9999));
            Assert.AreEqual("max_stage", NewLand(stage: 4).GrowProblem(30, 9999));
            Assert.IsNotNull(land.NextStage);
        }

        [Test]
        public void ProductionAndRentTickLikeOnTheServer()
        {
            var land = NewLand();
            var solar = new LandBuildingDto { id = 2, kind = "farma-solarna", x = A.x, y = A.y, level = 1, readyAt = T0 + 60_000, collectedAt = T0 + 60_000 };
            Assert.AreEqual(30, land.Hourly(solar), "20 an hour, half as much again on Leśne Ostępy");
            Assert.AreEqual(0, land.Pending(solar, T0));
            Assert.AreEqual(30, land.Pending(solar, solar.readyAt + H));
            Assert.AreEqual(30 * Content.land.producerHours, land.Pending(solar, solar.readyAt + 100 * H), "never more than its store");
            var dunes = Array.Find(Content.land.plots, p => p.route == "pustkowie-wydmy");
            Assert.AreEqual(20, NewLand(plot: dunes.id).Hourly(solar));
            var flats = new LandBuildingDto { id = 3, kind = "apartamentowiec", x = A.x, y = A.y, level = 1, readyAt = T0, collectedAt = T0 };
            Assert.AreEqual(Content.land.Building("apartamentowiec").levels[0].value, land.Pending(flats, T0 + H), "rent: coins an hour");
            Assert.AreEqual(Content.land.baseStorage, land.Storage(T0));
            Assert.IsTrue(land.Shielded(T0));
            Assert.IsFalse(land.Shielded(T0 + 49 * H));
        }

        [Test]
        public void ThePlotSitsOnItsMap()
        {
            var land = NewLand();
            var plot = Content.land.Plot(Plot);
            Assert.AreEqual(new Vector2Int(plot.x + 3, plot.y + 4), land.ToMap(3, 4));
            Assert.AreEqual(new Vector2Int(3, 4), land.ToLocal(new Vector2Int(plot.x + 3, plot.y + 4)));
            Assert.IsTrue(land.OnPlot(new Vector2Int(plot.x, plot.y)));
            Assert.IsFalse(land.OnPlot(new Vector2Int(plot.x - 1, plot.y)));
        }

        [Test]
        public void TheHallGrowsUpAndACraneStandsWhileBuilding()
        {
            var b = new LandBuildingDto { kind = "szklarnia", level = 1, readyAt = T0 + 1000 };
            Assert.AreEqual("dz-budowa", Land.SpriteFor(b, T0));
            Assert.AreEqual("dz-szklarnia", Land.SpriteFor(b, T0 + 2000));
            Assert.AreEqual("dz-szklarnia", Land.SpriteFor(new LandBuildingDto { kind = "szklarnia", level = 2, readyAt = T0 + 1000 }, T0),
                "an upgrade keeps the building standing");
            Assert.AreEqual("dz-budowa-duza", Land.SpriteFor(new LandBuildingDto { kind = Land.Hall, level = 1, readyAt = T0 + 1000 }, T0));
            Assert.AreEqual("dz-ratusz-1", Land.SpriteFor(new LandBuildingDto { kind = Land.Hall, level = 1, readyAt = T0 }, T0));
            Assert.AreEqual("dz-ratusz-2", Land.SpriteFor(new LandBuildingDto { kind = Land.Hall, level = 3, readyAt = T0 }, T0));
            Assert.AreEqual("dz-ratusz-3", Land.SpriteFor(new LandBuildingDto { kind = Land.Hall, level = 5, readyAt = T0 }, T0));
            Assert.AreEqual("1:05", Land.Countdown(T0 + 65_000, T0));
            StringAssert.Contains("120 betonu", Land.CostText(new LandCost { beton = 120, stal = 60 }));
            Assert.AreEqual("+12 betonu, +4 energii", Land.LootText(new LandResourcesDto { beton = 12, energia = 4 }));
            Assert.IsNull(Land.LootText(new LandResourcesDto()));
        }

        [Test]
        public void DistrictNamesAreTidiedLikeOnTheServer()
        {
            Assert.AreEqual("Nowa Huta", Land.CleanName("  Nowa   Huta "));
            Assert.AreEqual("Os. Słoneczne-2", Land.CleanName("Os. Słoneczne-2"));
            Assert.IsNull(Land.CleanName("ab"));
            Assert.IsNull(Land.CleanName("-Huta"));
            Assert.IsNull(Land.CleanName("Huta@Nowa"));
            Assert.IsNull(Land.CleanName(new string('a', 25)));
            Assert.IsNull(Land.CleanName(null));
        }

        [Test]
        public void EveryPlotIsFencedOnItsWastelandWithAnOpenGate()
        {
            var size = Content.land.plotSize;
            foreach (var plot in Content.land.plots)
            {
                var map = MapFormat.Load(plot.route);
                var c = (size - 1) / 2;
                Assert.IsTrue(map.IsWalkable(plot.x + c, plot.y + c), $"{plot.id}: the middle is open");
                Assert.IsFalse(map.IsWalkable(plot.x, plot.y), $"{plot.id}: the fence's corner is solid");
                foreach (var g in Land.GateCells(plot.gate, size))
                    Assert.IsTrue(map.IsWalkable(plot.x + g.x, plot.y + g.y), $"{plot.id}: the gate is open");
                var outside = Land.OutsideGate(plot.gate, size);
                Assert.IsTrue(map.IsWalkable(plot.x + outside.x, plot.y + outside.y), $"{plot.id}: the way to the gate is open");
            }
        }
    }
}
