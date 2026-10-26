using System.Collections.Generic;
using Buds.World;
using NUnit.Framework;
using UnityEngine;

namespace Buds.Tests
{
    /// <summary>Cities and their wastelands lie side by side with the road running on across the seam.</summary>
    public class SeamTests
    {
        static IEnumerable<TestCaseData> Pairs()
        {
            foreach (var r in Districts.Routes)
            {
                yield return new TestCaseData(r.A, r.Id).SetName($"{r.A} next to {r.Id}");
                yield return new TestCaseData(r.B, r.Id).SetName($"{r.B} next to {r.Id}");
                yield return new TestCaseData(r.Id, r.A).SetName($"{r.Id} next to {r.A}");
                yield return new TestCaseData(r.Id, r.B).SetName($"{r.Id} next to {r.B}");
            }
        }

        [TestCaseSource(nameof(Pairs))]
        public void TheRoadRunsOnAcrossTheSeam(string aId, string bId)
        {
            var a = MapFormat.Load(aId);
            var b = MapFormat.Load(bId);
            var offset = Seams.OffsetOf(a, b);
            Assert.IsTrue(offset.HasValue, $"{aId} and {bId} must line up");
            var o = offset.Value;
            // the two maps touch along one edge and never overlap
            var ra = new Rect(0, 0, a.Width, a.Height);
            var rb = new Rect(o, new Vector2(b.Width, b.Height));
            Assert.IsFalse(ra.Overlaps(rb), "the maps overlap");
            var gapA = Seams.Gap(Seams.ExitTo(a, bId), a);
            var gapB = Seams.Gap(Seams.ExitTo(b, aId), b);
            Assert.AreEqual(gapA.from, gapB.from + o, "the road strips start at the same place");
            Assert.AreEqual(gapA.to, gapB.to + o, "and end at the same place");

            // every cell of the road on one side has a walkable cell right across on the other
            var ea = Seams.ExitTo(a, bId);
            for (var y = ea.Y0; y <= ea.Y1; y++)
            for (var x = ea.X0; x <= ea.X1; x++)
            {
                Assert.IsTrue(a.IsWalkable(x, y), $"{aId} road cell {x},{y}");
                var world = new Vector2(x + 0.5f, a.Height - 1 - y + 0.5f);
                var side = Seams.SideOf(ea, a)!.Value;
                var across = world + side switch
                {
                    Seams.Side.North => Vector2.up,
                    Seams.Side.South => Vector2.down,
                    Seams.Side.East => Vector2.right,
                    _ => Vector2.left,
                };
                var local = across - o;
                var bx = Mathf.FloorToInt(local.x);
                var by = b.Height - 1 - Mathf.FloorToInt(local.y);
                Assert.IsTrue(b.InBounds(bx, by), $"across {x},{y} lands outside {bId}");
                Assert.IsTrue(b.IsWalkable(bx, by), $"across {x},{y} of {aId} is a wall in {bId} ({bx},{by})");
            }

            // the ground beneath: each map's base stops at the shared edge, the neighbour's reaches as wide as the other's
            var baseA = Seams.BaseRect(a, b, o);
            var baseB = Seams.NeighbourBaseRect(b, a, o);
            var baseBWorld = new Rect(baseB.position + o, baseB.size);
            Assert.IsFalse(baseA.Overlaps(baseBWorld), "the two bases overlap (they would flicker)");
            Assert.IsTrue(baseA.Contains(new Vector2(a.Width / 2f, a.Height / 2f)));
        }

        [Test]
        public void TheOutlineLeavesOutOnlyTheRoad()
        {
            var city = MapFormat.Load(Districts.Start);
            var closed = Seams.Outline(city, null);
            Assert.AreEqual(closed[0], closed[^1], "closed all round");
            foreach (var exit in city.Exits)
            {
                var open = Seams.Outline(city, exit);
                var (from, to) = Seams.Gap(exit, city);
                Assert.AreEqual(to, open[0]);
                Assert.AreEqual(from, open[^1]);
                Assert.AreEqual(4f, Vector2.Distance(from, to), 0.001f, "the gap is the road's width");
            }
        }

        [Test]
        public void TheSeamIsFoundFromAnywhereNearTheRoad()
        {
            var city = MapFormat.Load(Districts.Start);
            var north = city.Exits.Find(e => Seams.SideOf(e, city) == Seams.Side.North);
            var gate = new Vector2(north.X0 + 2, city.Height - 0.5f);
            Assert.AreEqual(0, Seams.DistanceTo(north, city, gate), 0.6f);
            Assert.AreEqual(30, Seams.DistanceTo(north, city, gate - new Vector2(0, 30)), 0.6f);
            Assert.IsNull(Seams.OffsetOf(city, MapFormat.Load("las-palmas")), "cities without a road to each other never line up");
        }
    }
}
