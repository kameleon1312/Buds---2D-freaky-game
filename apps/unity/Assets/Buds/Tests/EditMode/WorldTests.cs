using System.Collections.Generic;
using Buds.World;
using NUnit.Framework;
using UnityEngine;

namespace Buds.Tests
{
    public class MapFormatTests
    {
        const string Sample = @"// tiny test map
[district]
id = test
name = Test
base = #86c95a
spawn = 1,1

[legend]
. = grass
T = grass + tree-a|tree-b !
# = sidewalk !
= = asphalt
s = grass + sign !

[ground]
road : asphalt : 0.8 : 0.45 #3a3e48, 0.5 #4c5160

[scatter]
grass : 0.5 : tuft

[signs]
3,1 | Hello | World

[exits]
0,2,0,2 | las-palmas

[zones]
0,0,4,3 | Everything
1,1,2,2 | Middle

[grid]
TTTTT
T..sT
==..T
TT#TT
";

        [Test]
        public void ParsesEverySection()
        {
            var map = MapFormat.Parse(Sample);
            Assert.AreEqual("test", map.Id);
            Assert.AreEqual(5, map.Width);
            Assert.AreEqual(4, map.Height);
            Assert.AreEqual(1, map.SpawnX);
            Assert.AreEqual(1, map.SpawnY);
            Assert.IsTrue(map.Solid[0, 0]);
            Assert.IsFalse(map.Solid[1, 1]);
            Assert.IsTrue(map.Solid[3, 2]); // footprint cell without a prop
            Assert.AreEqual("asphalt", map.GroundAt(0, 2));
            Assert.AreEqual(1, map.GroundStyles.Count);
            Assert.AreEqual(2, map.GroundStyles[0].Bands.Length);
            Assert.AreEqual("Hello", map.Signs[0].Title);
            Assert.AreEqual("World", map.Signs[0].Text);
            Assert.AreEqual("las-palmas", map.Exits[0].DistrictId);
            Assert.AreEqual("Middle", map.ZoneAt(1, 1).Name); // the smallest zone wins
            Assert.AreEqual("Everything", map.ZoneAt(4, 0).Name);
        }

        [Test]
        public void PicksPropVariantsDeterministically()
        {
            var a = MapFormat.Parse(Sample);
            var b = MapFormat.Parse(Sample);
            var trees = 0;
            for (var i = 0; i < a.Props.Count; i++)
            {
                Assert.AreEqual(a.Props[i].Name, b.Props[i].Name);
                if (a.Props[i].Name.StartsWith("tree-")) trees++;
            }
            Assert.AreEqual(12, trees);
        }

        [Test]
        public void ArrivalIsNextToTheExitBack()
        {
            var map = MapFormat.Parse(Sample);
            var at = map.ArrivalFrom("las-palmas");
            Assert.IsTrue(map.IsWalkable(at.x, at.y));
            Assert.AreEqual(2, at.y);
            Assert.AreEqual(new Vector2Int(map.SpawnX, map.SpawnY), map.ArrivalFrom("nowhere"));
        }

        [TestCase("[grid]\n..\n.")]
        [TestCase("[legend]\n. = grass\n[grid]\n.x")]
        [TestCase("[district]\nwhat = 1\n[grid]\n.")]
        [TestCase("[ground]\nbad line\n[grid]\n.")]
        public void RejectsBrokenFiles(string text)
        {
            Assert.Throws<MapFormatException>(() => MapFormat.Parse(text));
        }
    }

    public class DistrictTests
    {
        [Test]
        public void StartsInMiastoZiomkowAndUnlocksInOrder()
        {
            Assert.AreEqual(Districts.Start, Districts.All[0].Id);
            Assert.IsTrue(Districts.CanEnter(Districts.Start, 1));
            for (var i = 1; i < Districts.All.Length; i++)
                Assert.GreaterOrEqual(Districts.All[i].UnlockLevel, Districts.All[i - 1].UnlockLevel);
        }

        [Test]
        public void LevelGatesTheOtherDistricts()
        {
            Assert.IsFalse(Districts.CanEnter("las-palmas", 2));
            Assert.IsTrue(Districts.CanEnter("las-palmas", 3));
            Assert.IsFalse(Districts.CanEnter("nowhere", 99));
            StringAssert.Contains("poziomu 7", Districts.ClosedReason(Districts.Get("los-karkos"), 1));
        }
    }

    /// <summary>Every district map shipped with the game: loads, connects, and only uses known art.</summary>
    public class DistrictMapTests
    {
        static IEnumerable<string> Ids()
        {
            foreach (var d in Districts.All) yield return d.Id;
        }

        /// <summary>Every map you walk on outdoors: the districts and the wastelands between them.</summary>
        static IEnumerable<string> Outdoors()
        {
            foreach (var d in Districts.All) yield return d.Id;
            foreach (var r in Districts.Routes) yield return r.Id;
        }

        static HashSet<string> knownProps;

        static HashSet<string> KnownProps()
        {
            if (knownProps != null) return knownProps;
            knownProps = new HashSet<string>();
            foreach (var e in PropArt.LoadManifest().props) knownProps.Add(e.name);
            return knownProps;
        }

        [TestCaseSource(nameof(Ids))]
        public void LoadsBigWithAWalkableSpawn(string id)
        {
            var map = MapFormat.Load(id);
            Assert.AreEqual(id, map.Id);
            Assert.AreEqual(Districts.Get(id).Name, map.Name);
            Assert.GreaterOrEqual(map.Width * map.Height, 96 * 96, "districts are big");
            Assert.IsTrue(map.IsWalkable(map.SpawnX, map.SpawnY), "spawn");
            Assert.IsNotEmpty(map.Zones);
            Assert.IsNotEmpty(map.GroundStyles);
        }

        [TestCaseSource(nameof(Outdoors))]
        public void StandingThingsDrawOverTheGroundEverywhere(string id)
        {
            // characters, props and caches at the north end of a big map used to sort under the ground and road markings
            var map = MapFormat.Load(id);
            var previous = int.MaxValue;
            for (var y = -1f; y <= map.Height + 1; y += 0.5f)
            {
                var order = WorldView.SortOrderFor(y);
                Assert.Greater(order, -90, $"{id}: y {y} sorts under flat decorations");
                Assert.Less(order, 20000, $"{id}: y {y} sorts over the quest markers");
                Assert.Less(order, previous, $"{id}: y {y} lost the north-south order");
                previous = order;
            }
        }

        [TestCaseSource(nameof(Outdoors))]
        public void UsesOnlyKnownProps(string id)
        {
            var map = MapFormat.Load(id);
            foreach (var p in WorldView.AllProps(map))
                Assert.IsTrue(KnownProps().Contains(p.Name), $"{id}: unknown prop '{p.Name}' at ({p.X},{p.Y})");
        }

        [TestCaseSource(nameof(Outdoors))]
        public void ExitsAreAtTheEdgeAndLeadBack(string id)
        {
            var map = MapFormat.Load(id);
            Assert.IsNotEmpty(map.Exits);
            foreach (var exit in map.Exits)
            {
                Assert.IsTrue(Districts.Get(exit.DistrictId) != null || Districts.IsRoute(exit.DistrictId), exit.DistrictId);
                Assert.IsTrue(exit.Y0 == 0 || exit.Y1 == map.Height - 1 || exit.X0 == 0 || exit.X1 == map.Width - 1,
                    $"{id} → {exit.DistrictId} is not at the edge");
                // the other side has a road back, and arriving there puts you on walkable ground
                var other = MapFormat.Load(exit.DistrictId);
                Assert.IsNotNull(other.Exits.Find(e => e.DistrictId == id), $"{exit.DistrictId} has no road back to {id}");
                var at = other.ArrivalFrom(id);
                Assert.IsTrue(other.IsWalkable(at.x, at.y));
            }
        }

        [TestCaseSource(nameof(Outdoors))]
        public void ExitsSignsAndZonesAreReachableOnFoot(string id)
        {
            var map = MapFormat.Load(id);
            var seen = new bool[map.Height, map.Width];
            var queue = new Queue<Vector2Int>();
            queue.Enqueue(new Vector2Int(map.SpawnX, map.SpawnY));
            seen[map.SpawnY, map.SpawnX] = true;
            while (queue.Count > 0)
            {
                var c = queue.Dequeue();
                foreach (var d in new[] { Vector2Int.up, Vector2Int.down, Vector2Int.left, Vector2Int.right })
                {
                    var n = c + d;
                    if (!map.IsWalkable(n.x, n.y) || seen[n.y, n.x]) continue;
                    seen[n.y, n.x] = true;
                    queue.Enqueue(n);
                }
            }
            bool Any(int x0, int y0, int x1, int y1)
            {
                for (var y = y0; y <= y1; y++)
                for (var x = x0; x <= x1; x++)
                    if (map.InBounds(x, y) && seen[y, x]) return true;
                return false;
            }
            foreach (var e in map.Exits) Assert.IsTrue(Any(e.X0, e.Y0, e.X1, e.Y1), $"{id}: exit to {e.DistrictId}");
            foreach (var z in map.Zones) Assert.IsTrue(Any(z.X0, z.Y0, z.X1, z.Y1), $"{id}: zone {z.Name}");
            foreach (var s in map.Signs)
            {
                Assert.IsTrue(map.Solid[s.Y, s.X], $"{id}: sign {s.Title} should block");
                Assert.IsTrue(Any(s.X - 1, s.Y - 1, s.X + 1, s.Y + 1), $"{id}: sign {s.Title}");
            }
        }

        [Test]
        public void EveryDistrictCanBeWalkedToFromTheStart()
        {
            // every road crosses a wasteland that ends in another district; Chinatown lies past Dwór Carski
            var seen = new System.Collections.Generic.HashSet<string> { Districts.Start };
            var open = new System.Collections.Generic.Queue<string>();
            open.Enqueue(Districts.Start);
            while (open.Count > 0)
            {
                var city = open.Dequeue();
                foreach (var e in MapFormat.Load(city).Exits)
                {
                    var far = Districts.FarEnd(e.DistrictId, city);
                    if (far != null && seen.Add(far)) open.Enqueue(far);
                }
            }
            foreach (var d in Districts.All) Assert.IsTrue(seen.Contains(d.Id), d.Id);
            Assert.IsNull(MapFormat.Load(Districts.Start).Exits.Find(e => Districts.FarEnd(e.DistrictId, Districts.Start) == "chinatown"));
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

        [Test]
        public void TinyRadiusNeverProducesNaN()
        {
            var field = GroundShapes.Field((x, y) => (x + y) % 2 == 0, 6, 6, 0.3f);
            foreach (var v in field) Assert.IsFalse(float.IsNaN(v));
        }

        [Test]
        public void ChunksAddUpToTheWholeMesh()
        {
            var field = GroundShapes.Field((x, y) => (x * 7 + y * 3) % 5 < 2, 20, 16, 1.6f);
            var whole = GroundShapes.Contour(field, 0.5f, 16).Area();
            var n = GroundShapes.SamplesPerTile;
            var parts = 0f;
            for (var j = 0; j < 16 * n; j += 8 * n)
            for (var i = 0; i < 20 * n; i += 8 * n)
                parts += GroundShapes.Contour(field, 0.5f, 16, i, j, Mathf.Min(i + 8 * n, 20 * n), Mathf.Min(j + 8 * n, 16 * n)).Area();
            Assert.AreEqual(whole, parts, 1e-2);
        }
    }

    public class PropArtTests
    {
        [Test]
        public void ManifestParsesPivotsAndFlags()
        {
            var m = PropArt.Parse("{\"ppu\":96,\"props\":[{\"name\":\"road-dash\",\"pivotX\":0.5,\"pivotY\":0.05,\"flat\":true}]}");
            Assert.AreEqual(96, m.ppu);
            Assert.AreEqual("road-dash", m.props[0].name);
            Assert.IsTrue(m.props[0].flat);
        }

        [Test]
        public void FenceRailsJoinNeighbouringPosts()
        {
            var map = MapFormat.Parse("[legend]\n. = grass\nf = grass + fence-post !\n[grid]\n.f.\nff.\n");
            var names = new List<string>();
            foreach (var p in WorldView.AllProps(map)) names.Add($"{p.Name}@{p.X},{p.Y}");
            CollectionAssert.Contains(names, "fence-h@0,1");
            CollectionAssert.Contains(names, "fence-v@1,1");
        }
    }
}
