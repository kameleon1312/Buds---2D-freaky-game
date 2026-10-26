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
        /// <summary>Free spots for a 3×3 building in a new district (gate to the south): either side of the gate's sector.</summary>
        static readonly Vector2Int A = new(7, 22);
        static readonly Vector2Int B = new(17, 22);
        const string Plot = "ostepy-1";
        static Vector2Int HallAt => Land.HallSpot("s", Content.land.sector, Content.land.sectors);

        /// <summary>A district like land.ts newLand: a small clearing by the gate, the town hall behind it, concrete and steel.</summary>
        static Land NewLand(int concrete = 100, int steel = 40, string plot = Plot, int[] sectors = null, int hall = 1, LandClearingDto clearing = null)
        {
            var land = new Land(Content.land);
            var r = Content.land;
            var gate = r.Plot(plot).gate;
            var at = Land.HallSpot(gate, r.sector, r.sectors);
            land.Apply(new LandViewDto
            {
                land = new LandStateDto
                {
                    plot = plot,
                    name = "Nowa Huta",
                    sectors = sectors ?? Land.StartSectors(gate, r.sectors),
                    clearing = clearing,
                    resources = new LandResourcesDto { beton = concrete, stal = steel },
                    buildings = new[]
                    {
                        new LandBuildingDto { id = 1, kind = Land.Hall, x = at.x, y = at.y, level = hall, readyAt = T0, collectedAt = T0 },
                    },
                    nextId = 2,
                    shieldUntil = T0 + 48 * H,
                },
                now = T0,
                storage = r.baseStorage,
            }, T0);
            return land;
        }

        static int[] All => System.Linq.Enumerable.ToArray(System.Linq.Enumerable.Range(0, Content.land.sectors * Content.land.sectors));

        [Test]
        public void TheRulesComeWithTheContent()
        {
            var r = Content.land;
            Assert.IsNotNull(r);
            Assert.AreEqual(25, r.plotSize);
            Assert.AreEqual(r.plotSize, r.sector * r.sectors);
            Assert.AreEqual(4, r.resources.Length);
            Assert.AreEqual(5, r.sectorLimit.Length);
            Assert.AreEqual(r.sectors * r.sectors - 4, r.clearings.Length);
            Assert.AreEqual("Osada", r.ranks[0].name);
            Assert.AreEqual("tropik", r.StyleOf("pustkowie-wydmy"));
            Assert.AreEqual("zlom", r.StyleOf("pustkowie-nieuzytki"));
            Assert.IsNotNull(r.Building(Land.Hall));
            Assert.AreEqual(Land.Rent, r.Building("apartamentowiec").produces);
            Assert.Greater(r.Building("iglica").prestige, r.Building("skwer").prestige);
            Assert.AreEqual("energia", r.BonusOf("pustkowie-ostepy"));
            foreach (var b in r.buildings)
            {
                Assert.AreEqual(1, b.w % 2, $"{b.id}: odd width");
                Assert.IsTrue(b.levels.Length is 1 or 5, b.id);
                Assert.AreEqual(5, b.limit.Length, b.id);
            }
        }

        [Test]
        public void PlacingFollowsTheServersRules()
        {
            var land = NewLand();
            Assert.IsNull(land.PlacementProblem("szklarnia", A.x, A.y, 3));
            Assert.IsNull(land.PlacementProblem("szklarnia", B.x, B.y, 3));
            Assert.AreEqual("outside", land.PlacementProblem("szklarnia", 7, 17, 9), "the sector beside the hall is still wild");
            Assert.AreEqual("occupied", land.PlacementProblem("szklarnia", HallAt.x, HallAt.y, 9));
            Assert.AreEqual("level_too_low", land.PlacementProblem("szklarnia", A.x, A.y, 2));
            Assert.AreEqual("poor", NewLand(0).PlacementProblem("szklarnia", A.x, A.y, 9));
            Assert.AreEqual("too_many", land.PlacementProblem(Land.Hall, A.x, A.y, 9));
            Assert.AreEqual("unknown_building", land.PlacementProblem("zamek", A.x, A.y, 9));
            Assert.AreEqual("gate", land.PlacementProblem("szklarnia", 12, 21, 9), "the gate keeps a clear way in");
            Assert.IsNull(NewLand(sectors: All).PlacementProblem("szklarnia", 7, 17, 9), "cleared land can be built on");
        }

        [Test]
        public void TheDistrictClearsItsPlotPieceByPiece()
        {
            var land = NewLand(2000, 2000);
            var west = 4 * Content.land.sectors; // (0, 4): beside the start's west sector
            Assert.AreEqual(4, land.ClearedCount);
            Assert.IsNull(land.ClearProblem(west, 3, 1000));
            Assert.AreEqual("not_next", land.ClearProblem(0, 3, 1000));
            Assert.AreEqual("cleared", land.ClearProblem(west + 2, 3, 1000));
            Assert.AreEqual("poor", land.ClearProblem(west, 3, 10));
            Assert.AreEqual("level_too_low", land.ClearProblem(west, 2, 1000));
            Assert.AreEqual(60, land.NextClearing.coins);
            Assert.AreEqual(west, land.WildSectorAt(new Vector2Int(2, 22)));
            Assert.AreEqual(-1, land.WildSectorAt(A));
            // a crew at work: one at a time, and its sector is cleared once it is done
            var busy = NewLand(2000, 2000, clearing: new LandClearingDto { sector = west, readyAt = T0 + 3_600_000_000d });
            Assert.AreEqual(west, busy.InWork);
            Assert.AreEqual("clearing", busy.ClearProblem(west + 4, 3, 1000));
            var done = NewLand(2000, 2000, clearing: new LandClearingDto { sector = west, readyAt = 1 });
            Assert.AreEqual(5, done.ClearedCount);
            Assert.IsTrue(done.Claimed(2, 22));
            Assert.AreEqual(100, done.NextClearing.coins, "the next piece costs more");
            // the town hall allows only so much
            var six = NewLand(2000, 2000, sectors: new[] { 21, 22, 23, 17, 20, 24 });
            Assert.AreEqual("hall_too_low", six.ClearProblem(15, 30, 99999));
            Assert.IsNull(NewLand(2000, 2000, sectors: new[] { 21, 22, 23, 17, 20, 24 }, hall: 2).ClearProblem(15, 30, 99999));
            Assert.AreEqual("cleared", NewLand(sectors: All).ClearProblem(0, 30, 99999));
            Assert.AreEqual("Dzielnica", Content.land.RankName(400));
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
            var top = new LandBuildingDto { id = 3, kind = "apartamentowiec", level = 5, readyAt = T0, collectedAt = T0 };
            Assert.AreEqual(25, land.RentBoostOf(new[] { new LandBuildingDto { kind = "iglica" } }));
            Assert.AreEqual(24, land.Hourly(top), "no boost without squares, fountains, the statue or the tower");
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
            Assert.AreEqual("dz-budowa", Land.SpriteFor(b, T0, "tropik"));
            Assert.AreEqual("dz-tropik-szklarnia", Land.SpriteFor(b, T0 + 2000, "tropik"));
            Assert.AreEqual("dz-las-szklarnia", Land.SpriteFor(new LandBuildingDto { kind = "szklarnia", level = 2, readyAt = T0 + 1000 }, T0, "las"),
                "an upgrade keeps the building standing");
            Assert.AreEqual("dz-budowa-duza",
                Land.SpriteFor(new LandBuildingDto { kind = "iglica", level = 1, readyAt = T0 + 1000 }, T0, "dwor", Content.land.Building("iglica")));
            Assert.AreEqual("dz-zlom-ratusz-1", Land.SpriteFor(new LandBuildingDto { kind = Land.Hall, level = 1, readyAt = T0 }, T0, "zlom"));
            Assert.AreEqual("dz-zlom-ratusz-2", Land.SpriteFor(new LandBuildingDto { kind = Land.Hall, level = 3, readyAt = T0 }, T0, "zlom"));
            Assert.AreEqual("dz-zlom-ratusz-3", Land.SpriteFor(new LandBuildingDto { kind = Land.Hall, level = 5, readyAt = T0 }, T0, "zlom"));
            // every look a district can show has its picture
            var manifest = PropArt.LoadManifest();
            foreach (var style in new[] { "las", "tropik", "dwor", "zlom" })
            foreach (var kind in Content.land.buildings)
            {
                var name = kind.id == Land.Hall ? $"dz-{style}-ratusz-1" : $"dz-{style}-{kind.id}";
                Assert.IsTrue(Array.Exists(manifest.props, e => e.name == name), name);
            }
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
        public void EveryPlotLiesOnOpenLandWithAWayToItsGate()
        {
            var size = Content.land.plotSize;
            foreach (var plot in Content.land.plots)
            {
                var map = MapFormat.Load(plot.route);
                // the game draws what grows on a plot: on the map it is open land, nothing standing
                for (var y = 0; y < size; y++)
                for (var x = 0; x < size; x++)
                    Assert.IsTrue(map.IsWalkable(plot.x + x, plot.y + y), $"{plot.id}: ({x}, {y}) is open");
                var outside = Land.OutsideGate(plot.gate, size);
                Assert.IsTrue(map.IsWalkable(plot.x + outside.x, plot.y + outside.y), $"{plot.id}: the way to the gate is open");
            }
            // a few plots a wasteland, far apart
            foreach (var route in new[] { "pustkowie-ostepy", "pustkowie-wydmy", "pustkowie-gosciniec", "pustkowie-nieuzytki" })
                Assert.AreEqual(4, Content.land.PlotsOn(route).Length, route);
        }
    }
}
