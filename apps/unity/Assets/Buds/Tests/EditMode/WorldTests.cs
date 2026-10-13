using System.Collections.Generic;
using Buds.World;
using NUnit.Framework;
using UnityEngine;

namespace Buds.Tests
{
    public class VillageTests
    {
        WorldMap map;

        [SetUp]
        public void Build() => map = Village.Build();

        [Test]
        public void IsDeterministic()
        {
            var again = Village.Build();
            Assert.AreEqual(map.Ground, again.Ground);
            Assert.AreEqual(map.Objects, again.Objects);
            Assert.AreEqual(map.Above, again.Above);
        }

        [Test]
        public void SpawnIsWalkable() => Assert.IsTrue(map.IsWalkable(map.SpawnX, map.SpawnY));

        [Test]
        public void BorderIsClosedExceptRoadExits()
        {
            for (var x = 0; x < map.Width; x++)
            {
                var exit = x is 23 or 24;
                Assert.AreEqual(!exit, Tiles.IsSolid(map.Objects[0, x]), $"north edge x={x}");
                Assert.AreEqual(!exit, Tiles.IsSolid(map.Objects[map.Height - 1, x]), $"south edge x={x}");
            }
            for (var y = 0; y < map.Height; y++)
            {
                Assert.IsTrue(Tiles.IsSolid(map.Objects[y, 0]), $"west edge y={y}");
                var eastExit = y is 17 or 18;
                Assert.AreEqual(!eastExit, Tiles.IsSolid(map.Objects[y, map.Width - 1]), $"east edge y={y}");
            }
        }

        [Test]
        public void EveryWalkableTileIsReachableFromSpawn()
        {
            var seen = new bool[map.Height, map.Width];
            var queue = new Queue<Vector2Int>();
            queue.Enqueue(new Vector2Int(map.SpawnX, map.SpawnY));
            seen[map.SpawnY, map.SpawnX] = true;
            var reached = 0;
            while (queue.Count > 0)
            {
                var c = queue.Dequeue();
                reached++;
                foreach (var d in new[] { Vector2Int.up, Vector2Int.down, Vector2Int.left, Vector2Int.right })
                {
                    var n = c + d;
                    if (!map.IsWalkable(n.x, n.y) || seen[n.y, n.x]) continue;
                    seen[n.y, n.x] = true;
                    queue.Enqueue(n);
                }
            }

            var walkable = 0;
            var stranded = new List<string>();
            for (var y = 0; y < map.Height; y++)
            for (var x = 0; x < map.Width; x++)
            {
                if (!map.IsWalkable(x, y)) continue;
                walkable++;
                if (!seen[y, x]) stranded.Add($"({x},{y})");
            }
            // a few pockets enclosed by random bushes are acceptable; whole areas are not
            Assert.LessOrEqual(stranded.Count, walkable / 50, "unreachable: " + string.Join(" ", stranded));
            Assert.Greater(reached, 800);
        }

        [Test]
        public void SignsSitOnSolidTilesNextToWalkableGround()
        {
            Assert.IsNotEmpty(map.Signs);
            foreach (var s in map.Signs)
            {
                Assert.AreEqual(Tiles.Sign, map.Objects[s.Y, s.X]);
                Assert.IsTrue(map.IsWalkable(s.X, s.Y + 1), "sign must be readable from the south");
            }
        }

        [Test]
        public void CanopiesOnlyAboveTrunks()
        {
            for (var y = 0; y < map.Height; y++)
            for (var x = 0; x < map.Width; x++)
            {
                if (map.Above[y, x] == Tiles.Empty) continue;
                Assert.AreEqual(Tiles.TreeTop, map.Above[y, x]);
                Assert.AreEqual(Tiles.TreeTrunk, map.Objects[y + 1, x], $"canopy at ({x},{y})");
            }
        }
    }

    public class DistrictTests
    {
        [Test]
        public void StartsInPaczkowoAndUnlocksInOrder()
        {
            Assert.AreEqual(Districts.Start, Districts.All[0].Id);
            Assert.IsTrue(Districts.CanEnter(Districts.Start, 1));
            for (var i = 1; i < Districts.All.Length; i++)
                Assert.GreaterOrEqual(Districts.All[i].UnlockLevel, Districts.All[i - 1].UnlockLevel);
        }

        [Test]
        public void UnfinishedOrUnknownDistrictsAreClosed()
        {
            Assert.IsFalse(Districts.CanEnter("las-palmos", 99));
            Assert.IsFalse(Districts.CanEnter("nowhere", 99));
            StringAssert.Contains("poziomu 4", Districts.ClosedReason(Districts.Get("las-palmos"), 1));
        }

        [Test]
        public void VillageExitsAreRoadsAtTheMapEdgeToKnownDistricts()
        {
            var map = Village.Build();
            // the start district is the hub: one road to every other district
            Assert.AreEqual(Districts.All.Length - 1, map.Exits.Count);
            foreach (var exit in map.Exits)
            {
                Assert.IsNotNull(Districts.Get(exit.DistrictId), exit.DistrictId);
                Assert.IsTrue(exit.Y0 == 0 || exit.Y1 == map.Height - 1 || exit.X0 == 0 || exit.X1 == map.Width - 1);
                for (var y = exit.Y0; y <= exit.Y1; y++)
                for (var x = exit.X0; x <= exit.X1; x++)
                    Assert.IsTrue(map.IsWalkable(x, y), $"exit cell ({x},{y})");
            }
        }
    }

    public class GroundShapesTests
    {
        [Test]
        public void FullMaskCoversTheWholeMap()
        {
            var field = GroundShapes.Field((_, _) => true, 6, 4);
            Assert.AreEqual(24f, GroundShapes.Contour(field, 0.5f, 4).Area(), 1e-3);
        }

        [Test]
        public void EmptyMaskProducesNothing()
        {
            var field = GroundShapes.Field((_, _) => false, 6, 4);
            Assert.AreEqual(0, GroundShapes.Contour(field, 0.5f, 4).Triangles.Count);
        }

        [Test]
        public void BlockKeepsItsStraightEdgesAndRoundsItsCorners()
        {
            // a 4×4 block in a 12×12 map: area a bit under 16 (rounded corners), never over
            var field = GroundShapes.Field((x, y) => x is >= 4 and < 8 && y is >= 4 and < 8, 12, 12);
            var mesh = GroundShapes.Contour(field, 0.5f, 12);
            var area = mesh.Area();
            Assert.Less(area, 16f);
            Assert.Greater(area, 14.5f);
            // edge midpoints sit on the tile boundary, in world space (y up)
            var minX = float.MaxValue;
            var maxY = float.MinValue;
            foreach (var v in mesh.Vertices)
            {
                minX = Mathf.Min(minX, v.x);
                maxY = Mathf.Max(maxY, v.y);
            }
            Assert.AreEqual(4f, minX, 0.05f);
            Assert.AreEqual(8f, maxY, 0.05f); // map row 4 is world y 12 - 4 = 8
        }

        [Test]
        public void HigherThresholdIsANestedSmallerBand()
        {
            var field = GroundShapes.Field((x, y) => x is >= 2 and < 9 && y is >= 2 and < 9, 11, 11);
            Assert.Greater(GroundShapes.Contour(field, 0.4f, 11).Area(), GroundShapes.Contour(field, 0.8f, 11).Area());
        }
    }

    public class PropArtTests
    {
        [Test]
        public void ManifestParsesPivots()
        {
            var m = PropArt.Parse("{\"ppu\":96,\"props\":[{\"name\":\"tree-a\",\"pivotX\":0.5,\"pivotY\":0.05}]}");
            Assert.AreEqual(96, m.ppu);
            Assert.AreEqual("tree-a", m.props[0].name);
            Assert.AreEqual(0.05f, m.props[0].pivotY, 1e-6);
        }

        [Test]
        public void BundledManifestCoversEveryPropTheWorldUses()
        {
            var json = Resources.Load<TextAsset>("World/props");
            Assert.IsNotNull(json, "run tools/export-world-art.ts");
            var names = new HashSet<string>();
            foreach (var e in PropArt.Parse(json.text).props) names.Add(e.name);
            foreach (var name in new[]
                     {
                         "tree-a", "tree-b", "tree-c", "bush-a", "bush-b", "rock-a", "rock-b", "house-red", "house-blue",
                         "house-teal", "sign", "fence-post", "fence-h", "fence-v", "flowers-a", "flowers-b", "flowers-c",
                         "tuft", "pebbles", "lily",
                     })
                Assert.IsTrue(names.Contains(name), name);
        }
    }
}
