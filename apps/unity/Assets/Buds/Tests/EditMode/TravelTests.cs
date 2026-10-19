using System.Collections.Generic;
using Buds.Quests;
using Buds.World;
using NUnit.Framework;
using UnityEngine;

namespace Buds.Tests
{
    /// <summary>The wastelands between the cities, the ambushes in their bushes, and the ferries.</summary>
    public class TravelTests
    {
        static readonly QuestContent Content = QuestContent.Load();

        static IEnumerable<string> Routes()
        {
            foreach (var r in Districts.Routes) yield return r.Id;
        }

        [Test]
        public void EveryRoadOutOfTheCityLeadsOntoAWasteland()
        {
            var city = MapFormat.Load(Districts.Start);
            Assert.AreEqual(4, city.Exits.Count);
            foreach (var e in city.Exits) Assert.IsTrue(Districts.IsRoute(e.DistrictId), e.DistrictId);
            // and every wasteland connects two cities, in the registry and on its map
            foreach (var r in Districts.Routes)
            {
                var map = MapFormat.Load(r.Id);
                Assert.AreEqual(r.Name, map.Name);
                Assert.IsNotNull(map.Exits.Find(x => x.DistrictId == r.A), $"{r.Id} → {r.A}");
                Assert.IsNotNull(map.Exits.Find(x => x.DistrictId == r.B), $"{r.Id} → {r.B}");
            }
        }

        [Test]
        public void TheRoadNeedsTheFarCitysLevelButHomeIsAlwaysOpen()
        {
            Assert.IsFalse(Districts.CanEnterRoute("pustkowie-nieuzytki", "miasto-ziomkow", 3));
            Assert.IsTrue(Districts.CanEnterRoute("pustkowie-nieuzytki", "miasto-ziomkow", 7));
            Assert.IsTrue(Districts.CanEnterRoute("pustkowie-nieuzytki", "los-karkos", 1), "home is always open");
            Assert.IsFalse(Districts.CanEnterRoute("pustkowie-nieuzytki", "las-palmas", 20), "not an end of it");
            Assert.AreEqual("Wydmy", Districts.NameOf("pustkowie-wydmy"));
        }

        [TestCaseSource(nameof(Routes))]
        public void LurkersHideInNooksOffTheRoad(string id)
        {
            var map = MapFormat.Load(id);
            var lurkers = System.Array.FindAll(Content.enemies, e => e.district == id);
            Assert.GreaterOrEqual(lurkers.Length, 4, id);
            var weakest = int.MaxValue;
            var strongest = 0;
            foreach (var e in lurkers)
            {
                Assert.IsTrue(e.ambush, $"{e.id} lies in wait");
                weakest = Mathf.Min(weakest, e.level);
                strongest = Mathf.Max(strongest, e.level);
                var s = e.spots[0];
                Assert.IsTrue(map.IsWalkable(s.x, s.y), $"{e.id} stands on free ground");
                // a ring of bushes, rocks or junk around it, with a way in
                var closed = 0;
                for (var dy = -2; dy <= 2; dy++)
                for (var dx = -2; dx <= 2; dx++)
                    if (Mathf.Max(Mathf.Abs(dx), Mathf.Abs(dy)) == 2 && !map.IsWalkable(s.x + dx, s.y + dy)) closed++;
                Assert.GreaterOrEqual(closed, 12, $"{e.id} is hidden in a nook");
                Assert.Less(closed, 16, $"{e.id}'s nook has a way in");
            }
            Assert.Less(weakest, strongest, $"{id} has weak and strong ones");
        }

        [Test]
        public void TheScraplandIsTheDangerousOne()
        {
            int Top(string route)
            {
                var top = 0;
                foreach (var e in Content.enemies)
                    if (e.district == route) top = Mathf.Max(top, e.level);
                return top;
            }
            Assert.Greater(Top("pustkowie-nieuzytki"), Top("pustkowie-ostepy"));
        }

        [Test]
        public void ALurkerSpringsOnlyWhenReadyCloseAndNothingElseIsGoingOn()
        {
            Assert.IsTrue(Ambush.ShouldSpring(2f, true, false));
            Assert.IsFalse(Ambush.ShouldSpring(Ambush.SpringRadius + 0.1f, true, false), "too far");
            Assert.IsFalse(Ambush.ShouldSpring(1f, false, false), "resting or waiting");
            Assert.IsFalse(Ambush.ShouldSpring(1f, true, true), "already fighting");
        }

        [Test]
        public void EveryCityHasAHarbourWithAFerrymanOnFreeShore()
        {
            Assert.AreEqual(Districts.All.Length, Content.ports.Length);
            foreach (var p in Content.ports)
            {
                var npc = Content.Npc(p.npc);
                Assert.IsNotNull(npc, p.npc);
                Assert.AreEqual(p.district, npc.district);
                Assert.AreEqual(p.id, Content.PortOfNpc(npc.id).id);
                Assert.That(p.fare, Is.InRange(1, 40), "a small fare");
                var map = MapFormat.Load(p.district);
                Assert.IsTrue(map.IsWalkable(p.x, p.y), $"{p.id} pier");
            }
        }
    }
}
