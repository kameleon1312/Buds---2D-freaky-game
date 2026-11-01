using System.Collections.Generic;
using Buds.Characters;
using Buds.Core;
using Buds.Quests;
using Buds.World;
using NUnit.Framework;
using UnityEngine;

namespace Buds.Tests
{
    public class LightTests
    {
        [Test]
        public void ShadowsFallNorthEastFromTheGroundPoint()
        {
            // the ground point and what lies under it stay put; the rest stretches away from the low sun
            Assert.AreEqual(Vector2.zero, Buds.World.WorldView.ShadowPoint(Vector2.zero));
            Assert.AreEqual(new Vector2(0.3f, -0.1f), Buds.World.WorldView.ShadowPoint(new Vector2(0.3f, -0.1f)));
            var top = Buds.World.WorldView.ShadowPoint(new Vector2(0, 2));
            Assert.Greater(top.x, 0);
            Assert.Less(top.y, 2);
            Assert.Greater(top.y, 0);
        }

        [Test]
        public void PlantsSwayAndHousesStandStill()
        {
            Assert.Greater(Buds.World.WorldView.SwayFor("tree-a"), 0);
            Assert.Greater(Buds.World.WorldView.SwayFor("bush-b"), Buds.World.WorldView.SwayFor("tree-a"));
            Assert.AreEqual(0, Buds.World.WorldView.SwayFor("kamienica-a"));
            for (var t = 0f; t < 20; t += 0.37f)
                Assert.LessOrEqual(Mathf.Abs(Buds.World.WorldView.Wind(12, 40, t)), 1.0001f);
        }
    }

    public class FourWayTests
    {
        [Test]
        public void TheBudWalksAlongOneAxisAtATime()
        {
            var m = new BudMotor();
            Assert.AreEqual(Vector2.right, m.FourWay(Vector2.right));
            // a diagonal keeps the axis it started on…
            Assert.AreEqual(new Vector2(1, 0), m.FourWay(new Vector2(0.7f, 0.7f)).normalized);
            // …until the other clearly wins
            var turned = m.FourWay(new Vector2(0.3f, 0.95f));
            Assert.AreEqual(0, turned.x, 1e-5);
            Assert.Greater(turned.y, 0);
            // a half-pushed stick keeps its strength
            m.FourWay(Vector2.zero);
            Assert.AreEqual(0.5f, m.FourWay(new Vector2(0, -0.5f)).magnitude, 1e-4);
            Assert.AreEqual(Vector2.zero, m.FourWay(Vector2.zero));
        }
    }

    public class BudMotorTests
    {
        [Test]
        public void SpeedsUpAndSlowsDownInsteadOfSnapping()
        {
            var m = new BudMotor();
            var v = m.Step(Vector2.right, false, 0.02f);
            Assert.Greater(v.x, 0);
            Assert.Less(v.x, BudMotor.WalkSpeed, "no instant full speed");
            for (var i = 0; i < 30; i++) v = m.Step(Vector2.right, false, 0.02f);
            Assert.AreEqual(BudMotor.WalkSpeed, v.x, 1e-3);
            v = m.Step(Vector2.zero, false, 0.02f);
            Assert.Greater(v.x, 0, "glides a moment");
            for (var i = 0; i < 30; i++) v = m.Step(Vector2.zero, false, 0.02f);
            Assert.AreEqual(Vector2.zero, v);
        }

        [Test]
        public void RunsFasterAndWalksSlowerOnAHalfPushedStick()
        {
            var run = new BudMotor();
            var slow = new BudMotor();
            Vector2 a = default, b = default;
            for (var i = 0; i < 60; i++)
            {
                a = run.Step(Vector2.up, true, 0.02f);
                b = slow.Step(Vector2.up * 0.5f, false, 0.02f);
            }
            Assert.AreEqual(BudMotor.RunSpeed, a.y, 1e-3);
            Assert.AreEqual(BudMotor.WalkSpeed * 0.5f, b.y, 1e-3);
        }

        [Test]
        public void DropsSpeedLostAgainstAWall()
        {
            var m = new BudMotor();
            for (var i = 0; i < 30; i++) m.Step(Vector2.right, false, 0.02f);
            var v = m.Step(Vector2.right, false, 0.02f, Vector2.zero); // the wall stopped it
            Assert.Less(v.x, 1f);
        }

        [Test]
        public void KeepsItsFacingOnDiagonals()
        {
            var m = new BudMotor();
            m.Face(new Vector2(1, 0.2f), true);
            Assert.AreEqual(Facing.Side, m.Facing);
            Assert.IsTrue(m.FacingRight);
            m.Face(new Vector2(1, 1.1f), false); // almost diagonal: stays side
            Assert.AreEqual(Facing.Side, m.Facing);
            m.Face(new Vector2(0.3f, 1), false);
            Assert.AreEqual(Facing.Up, m.Facing);
            m.Face(new Vector2(1, 1.1f), false); // and now stays up
            Assert.AreEqual(Facing.Up, m.Facing);
            m.Face(new Vector2(-1, 0), false);
            Assert.AreEqual(Facing.Side, m.Facing);
            Assert.IsFalse(m.FacingRight);
        }

        // a wall column at x = 5 with a one-tile gap at y = 3 (world cells, y up)
        static bool Wall(int x, int y) => x == 5 && y != 3;

        static readonly Vector2 Half = new(5f / 16, 2.5f / 16); // the feet box

        [Test]
        public void SlipsIntoAGapItAlmostHits()
        {
            // feet box a bit too high for the gap: pushed right, it is steered down into it
            var centre = new Vector2(4.68f, 3.95f);
            var dir = BudMotor.AroundCorners(Vector2.right, centre, Half, Wall);
            Assert.Less(dir.y, 0);
            Assert.Greater(dir.x, 0);
            Assert.AreEqual(1f, dir.magnitude, 1e-3);
        }

        [Test]
        public void LeavesStraightRunsAndRealWallsAlone()
        {
            // lined up with the gap: nothing to fix
            Assert.AreEqual(Vector2.right, BudMotor.AroundCorners(Vector2.right, new Vector2(4.68f, 3.5f), Half, Wall));
            // far from the gap: just a wall
            Assert.AreEqual(Vector2.right, BudMotor.AroundCorners(Vector2.right, new Vector2(4.68f, 7.5f), Half, Wall));
            // diagonals already slide
            var diag = new Vector2(0.7f, 0.7f);
            Assert.AreEqual(diag, BudMotor.AroundCorners(diag, new Vector2(4.68f, 3.95f), Half, Wall));
        }

        [Test]
        public void SlipsVerticallyToo()
        {
            // a wall row at y = 5 with a gap at x = 3; walking up, a bit right of the gap
            var dir = BudMotor.AroundCorners(Vector2.up, new Vector2(3.95f, 4.8f), new Vector2(Half.x, Half.y),
                (x, y) => y == 5 && x != 3);
            Assert.Less(dir.x, 0);
            Assert.Greater(dir.y, 0);
        }

        [Test]
        public void StickStrengthGrowsWithTheDrag()
        {
            Assert.AreEqual(0.35f, PlayerInput.StickStrength(12, 1000), 1e-3);
            Assert.AreEqual(1f, PlayerInput.StickStrength(PlayerInput.WalkDrag * 1000, 1000), 1e-3);
            Assert.AreEqual(1f, PlayerInput.StickStrength(500, 1000), 1e-3);
        }
    }

    public class CacheLogTests
    {
        static QuestContent Content() => QuestContent.Parse(@"{""caches"":[
            {""id"":""a"",""district"":""d"",""x"":10,""y"":10,""look"":""worek"",""coins"":10,""xp"":5,""text"":""A""},
            {""id"":""b"",""district"":""d"",""map"":""d-room"",""x"":2,""y"":2,""look"":""kufer"",""coins"":20,""text"":""B""},
            {""id"":""c"",""district"":""e"",""x"":1,""y"":1,""look"":""dzban"",""coins"":5,""text"":""C""}]}");

        [Test]
        public void ParsesCachesAndDefaultsTheMap()
        {
            var c = Content();
            Assert.AreEqual(3, c.caches.Length);
            Assert.AreEqual("d", c.caches[0].map);
            Assert.AreEqual("d-room", c.caches[1].map);
            Assert.AreEqual(1, c.caches[0].minLevel);
        }

        [Test]
        public void RevealsOnlyWhenClose()
        {
            var log = new CacheLog(Content());
            var a = log.Get("a");
            Assert.IsFalse(log.IsVisible(a));
            Assert.IsEmpty(log.Reveal("d", 20, 20, 3));
            Assert.IsNull(log.Nearest("d", 10.5f, 11.5f, 2), "hidden caches can't be searched");
            var found = log.Reveal("d", 10.5f, 12.5f, 3);
            Assert.AreEqual(1, found.Count);
            Assert.IsTrue(log.IsVisible(a));
            Assert.IsEmpty(log.Reveal("d", 10.5f, 12.5f, 3), "only announced once");
            Assert.AreEqual(a, log.Nearest("d", 10.5f, 11.5f, 2));
            Assert.IsNull(log.Nearest("d-room", 10.5f, 11.5f, 2), "other maps don't count");
        }

        [Test]
        public void SprytWidensTheRevealRadius()
        {
            Assert.Greater(CacheLog.RevealRadius(3), CacheLog.RevealRadius(0));
            Assert.AreEqual(CacheLog.BaseRevealRadius, CacheLog.RevealRadius(-1));
        }

        [Test]
        public void OpenedCachesStayVisibleCountAndSave()
        {
            var log = new CacheLog(Content());
            log.Open("b");
            Assert.IsTrue(log.IsVisible(log.Get("b")));
            Assert.IsNull(log.Nearest("d-room", 2.5f, 3.5f, 2), "emptied");
            Assert.AreEqual((1, 2), log.CountIn("d"));
            Assert.AreEqual((0, 1), log.CountIn("e"));
            var copy = new CacheLog(Content());
            copy.Restore(log.Save() + ",nieznana");
            CollectionAssert.AreEquivalent(new[] { "b" }, copy.Opened);
        }
    }

    public class ExplorationTests
    {
        [Test]
        public void RevealsACircleAroundTheBud()
        {
            var fog = new Exploration(40, 30);
            Assert.IsTrue(fog.Reveal(20, 15, 5));
            Assert.IsTrue(fog.IsSeen(20, 15));
            Assert.IsTrue(fog.IsSeen(25, 15));
            Assert.IsFalse(fog.IsSeen(25, 20), "corner of the square is outside the circle");
            Assert.IsFalse(fog.Reveal(20, 15, 5), "nothing new");
            Assert.IsFalse(fog.IsSeen(-1, 0));
        }

        [Test]
        public void SavesAndLoads()
        {
            var fog = new Exploration(33, 7);
            fog.Reveal(3, 3, 2);
            fog.Reveal(30, 6, 1);
            var copy = Exploration.Load(33, 7, fog.Save());
            for (var y = 0; y < 7; y++)
            for (var x = 0; x < 33; x++)
                Assert.AreEqual(fog.IsSeen(x, y), copy.IsSeen(x, y));
        }

        [Test]
        public void ADeviceTakesWhatAnotherOneUncoveredAndLosesNothing()
        {
            var here = new Exploration(20, 10);
            here.Reveal(3, 3, 1);
            var there = new Exploration(20, 10);
            there.Reveal(15, 7, 1);
            Assert.IsTrue(here.Merge(there.Save()));
            Assert.IsTrue(here.IsSeen(3, 3));
            Assert.IsTrue(here.IsSeen(15, 7));
            Assert.IsFalse(here.IsSeen(10, 5));
            Assert.IsFalse(here.Merge(there.Save()), "nothing new the second time");
            Assert.IsFalse(here.Merge("AAAA"), "another size adds nothing");
            Assert.IsFalse(here.Merge(null));
        }

        [TestCase(null)]
        [TestCase("")]
        [TestCase("not base64!")]
        [TestCase("AAAA")] // wrong size
        public void BadSavesStartFresh(string data)
        {
            var fog = Exploration.Load(10, 10, data);
            Assert.IsFalse(fog.IsSeen(0, 0));
        }

        [Test]
        public void CountsExploredWalkableCells()
        {
            var map = MapFormat.Parse("[legend]\n. = grass\n# = grass !\n[grid]\n..##\n..##\n");
            var fog = new Exploration(4, 2);
            Assert.AreEqual(0f, fog.Explored(map));
            fog.Reveal(0, 0, 0);
            Assert.AreEqual(0.25f, fog.Explored(map), 1e-4);
        }

        [Test]
        public void MapPictureUsesGroundColoursAndHidesUnseenCells()
        {
            var map = MapFormat.Parse("[district]\nbase = #000000\n[legend]\n. = grass\n= = asphalt\n# = asphalt !\n" +
                                      "[ground]\nroad : asphalt : 0.8 : 0.45 #ff0000, 0.5 #00ff00\n[grid]\n.=#\n");
            Assert.AreEqual(Color.black, MapPicture.CellColor(map, 0, 0));
            Assert.AreEqual(Color.green, MapPicture.CellColor(map, 1, 0), "innermost band");
            Assert.Less(MapPicture.CellColor(map, 2, 0).g, 0.9f, "solid cells are darker");
            var fog = new Exploration(3, 1);
            fog.Reveal(1, 0, 0);
            var px = MapPicture.Pixels(map, fog);
            Assert.AreEqual(MapPicture.Unknown, px[0]);
            Assert.AreEqual((Color32)Color.green, px[1]);
        }

        [Test]
        public void TheMapPictureDrawsTheLandAndTheFogHidesOnlyWhatWasntSeen()
        {
            var map = MapFormat.Parse("[district]\nbase = #000000\n[legend]\n. = grass\n[ground]\nroad : grass : 0.8 : 0.45 #00ff00\n[grid]\n...\n");
            var px = MapPicture.Detailed(map, 4, _ => null);
            Assert.AreEqual(3 * 4 * 1 * 4, px.Length);
            Assert.Greater(px[0].g, 240, "the ground's colour");
            var fog = new Exploration(3, 1);
            fog.Reveal(1, 0, 0);
            var over = MapPicture.FogPixels(3, 1, fog);
            Assert.AreEqual(255, over[0].a);
            Assert.AreEqual(0, over[1].a, "where the bud has been the land shows");
        }

        [Test]
        public void ZoomKeepsThePointUnderTheFingerAndThePictureOverTheFrame()
        {
            var view = new MapView(new Vector2(100, 100), new Vector2(100, 75));
            Assert.AreEqual(Vector2.zero, view.Pan);
            view.PanBy(new Vector2(50, 50));
            Assert.AreEqual(Vector2.zero, view.Pan, "at the whole map there is nowhere to drag it");
            view.ZoomAt(2, new Vector2(20, 10));
            Assert.AreEqual(2, view.Zoom);
            Assert.AreEqual(new Vector2(-20, -10), view.Pan, "the point stays under the finger");
            view.PanBy(new Vector2(1000, 1000));
            Assert.AreEqual(new Vector2(50, 25), view.Pan, "no gap beyond the map's edge");
            view.ZoomAt(100, Vector2.zero);
            Assert.AreEqual(MapView.MaxZoom, view.Zoom);
            view.ZoomAt(0.001f, Vector2.zero);
            Assert.AreEqual(1, view.Zoom);
            Assert.AreEqual(Vector2.zero, view.Pan);
        }

        [TestCase(1, "1 moneta")]
        [TestCase(3, "3 monety")]
        [TestCase(5, "5 monet")]
        [TestCase(12, "12 monet")]
        [TestCase(22, "22 monety")]
        [TestCase(115, "115 monet")]
        public void CoinsAgreeWithTheNumber(int n, string text)
        {
            Assert.AreEqual(text, GameBootstrap.Coins(n));
        }
    }

    /// <summary>Doors and rooms: every door in a district leads into a room that leads back out in front of it.</summary>
    public class InteriorTests
    {
        static IEnumerable<string> Districts()
        {
            foreach (var d in World.Districts.All) yield return d.Id;
        }

        [Test]
        public void ParsesDoorsAndInteriors()
        {
            var room = MapFormat.Parse("[district]\nid = d-room\nkind = interior\noutside = d\nspawn = 1,1\n" +
                                       "[legend]\n. = floor\n# = wall !\n[exits]\n1,2,1,2 | d\n[grid]\n###\n#.#\n#.#\n");
            Assert.IsTrue(room.IsInterior);
            Assert.AreEqual("d", room.Outside);
            Assert.AreEqual("d", room.DistrictId);
            Assert.AreEqual(new Vector2Int(1, 1), room.ArrivalFrom("d"), "rooms start at their spawn");

            var street = MapFormat.Parse("[district]\nid = d\n[legend]\n. = grass\nH = grass + house-red !\n" +
                                         "[doors]\n1,0 | d-room | Dom\n[grid]\n.H.\n...\n");
            Assert.AreEqual("d", street.DistrictId);
            Assert.AreEqual("Dom", street.Doors[0].Name);
            Assert.AreEqual(street.Doors[0], street.DoorInFront(1, 1));
            Assert.IsNull(street.DoorInFront(1, 0));
            Assert.AreEqual(new Vector2Int(1, 1), street.ArrivalFrom("d-room"), "out in front of the door");
        }

        [TestCase("[district]\nkind = cellar\n[grid]\n.")]
        [TestCase("[legend]\n. = grass\n[doors]\n1,1 | room\n[grid]\n.")]
        public void RejectsBrokenDoors(string text)
        {
            Assert.Throws<MapFormatException>(() => MapFormat.Parse(text));
        }

        [TestCaseSource(nameof(Districts))]
        public void EveryDoorLeadsIntoARoomAndBack(string id)
        {
            var map = MapFormat.Load(id);
            Assert.IsNotEmpty(map.Doors, $"{id} has buildings to walk into");
            foreach (var door in map.Doors)
            {
                Assert.IsTrue(map.Solid[door.Y, door.X], $"{door.Name}: the door is part of the building");
                Assert.IsTrue(map.IsWalkable(door.Front.x, door.Front.y), $"{door.Name}: free ground in front");
                var room = MapFormat.Load(door.Target);
                Assert.IsTrue(room.IsInterior, door.Target);
                Assert.AreEqual(id, room.Outside, door.Target);
                Assert.IsTrue(room.IsWalkable(room.SpawnX, room.SpawnY), $"{door.Target}: spawn");
                var exit = room.Exits.Find(e => e.DistrictId == id);
                Assert.IsNotNull(exit, $"{door.Target} has a way out");
                Assert.AreEqual(room.Height - 1, exit.Y1, $"{door.Target}: the way out is in the front wall");
                Assert.AreEqual(door.Front, map.ArrivalFrom(door.Target));
                // from the spawn the doormat can be reached
                Assert.IsTrue(Reachable(room, room.SpawnX, room.SpawnY, exit.X0, exit.Y0), $"{door.Target}: doormat");
                foreach (var p in WorldView.AllProps(room))
                    Assert.IsTrue(Known.Contains(p.Name), $"{door.Target}: unknown prop '{p.Name}'");
            }
        }

        [Test]
        public void EveryCacheLiesOnFreeGroundOfAKnownMap()
        {
            var content = QuestContent.Load();
            Assert.GreaterOrEqual(content.caches.Length, 20);
            var maps = new Dictionary<string, WorldMap>();
            foreach (var c in content.caches)
            {
                if (!maps.TryGetValue(c.map, out var map)) maps[c.map] = map = MapFormat.Load(c.map);
                Assert.AreEqual(c.district, map.DistrictId, c.id);
                Assert.IsTrue(map.IsWalkable(c.x, c.y), $"{c.id} at ({c.x},{c.y})");
                Assert.IsTrue(Reachable(map, map.SpawnX, map.SpawnY, c.x, c.y), $"{c.id} can be reached");
            }
        }

        static HashSet<string> known;

        static HashSet<string> Known
        {
            get
            {
                if (known != null) return known;
                known = new HashSet<string>();
                foreach (var e in PropArt.LoadManifest().props) known.Add(e.name);
                return known;
            }
        }

        static bool Reachable(WorldMap map, int sx, int sy, int tx, int ty)
        {
            var seen = new bool[map.Height, map.Width];
            var queue = new Queue<Vector2Int>();
            queue.Enqueue(new Vector2Int(sx, sy));
            seen[sy, sx] = true;
            while (queue.Count > 0)
            {
                var c = queue.Dequeue();
                if (c.x == tx && c.y == ty) return true;
                foreach (var d in new[] { Vector2Int.up, Vector2Int.down, Vector2Int.left, Vector2Int.right })
                {
                    var n = c + d;
                    if (!map.IsWalkable(n.x, n.y) || seen[n.y, n.x]) continue;
                    seen[n.y, n.x] = true;
                    queue.Enqueue(n);
                }
            }
            return false;
        }
    }
}
