using System.Collections.Generic;
using Buds.Quests;
using Buds.World;
using NUnit.Framework;
using UnityEngine;

namespace Buds.Tests
{
    /// <summary>Room to grow: every district keeps clear plots for future quests, NPCs and attractions.</summary>
    public class PlotTests
    {
        static IEnumerable<string> Ids()
        {
            foreach (var d in Districts.All) yield return d.Id;
        }

        [Test]
        public void ParsesPlots()
        {
            var map = MapFormat.Parse("[legend]\n. = grass\n[plots]\n0,0,1,1 | p1 | quest | Plac\n[grid]\n..\n..\n");
            Assert.AreEqual(1, map.Plots.Count);
            Assert.AreEqual("p1", map.Plots[0].Id);
            Assert.AreEqual("quest", map.Plots[0].Kind);
            Assert.IsTrue(map.Plots[0].Contains(1, 1));
            Assert.Throws<MapFormatException>(() => MapFormat.Parse("[legend]\n. = grass\n[plots]\n0,0,1,1 | p1\n[grid]\n.\n"));
        }

        [TestCaseSource(nameof(Ids))]
        public void DistrictsGrewAndKeepClearPlots(string id)
        {
            var map = MapFormat.Load(id);
            Assert.GreaterOrEqual(map.Width, 176, "districts grew east");
            Assert.GreaterOrEqual(map.Height, 132, "and south");
            Assert.GreaterOrEqual(map.Plots.Count, 3, $"{id} has plots for future content");
            var ids = new HashSet<string>();
            foreach (var p in map.Plots)
            {
                Assert.IsTrue(ids.Add(p.Id), $"{p.Id} is unique");
                CollectionAssert.Contains(new[] { "quest", "attraction", "minigame", "shop", "arena" }, p.Kind, p.Id);
                for (var y = p.Y0; y <= p.Y1; y++)
                for (var x = p.X0; x <= p.X1; x++)
                    Assert.IsTrue(map.IsWalkable(x, y), $"{p.Id}: ({x},{y}) is clear");
            }
        }
    }

    /// <summary>The tutorial island: where new buds start and how they leave.</summary>
    public class TutorialTests
    {
        static readonly QuestContent Content = QuestContent.Load();

        [Test]
        public void TheIslandLoadsWithAPierToTheCity()
        {
            var map = MapFormat.Load(Districts.Tutorial);
            Assert.AreEqual(Districts.TutorialName, map.Name);
            Assert.IsTrue(map.IsWalkable(map.SpawnX, map.SpawnY));
            var pier = map.Exits.Find(e => e.DistrictId == Districts.Start);
            Assert.IsNotNull(pier, "the boat goes to Miasto Ziomków");
            Assert.AreEqual(map.Width - 1, pier.X1, "at the edge");
            // the city has no road back: arriving puts the bud on its spawn (the Rynek)
            var city = MapFormat.Load(Districts.Start);
            Assert.AreEqual(new Vector2Int(city.SpawnX, city.SpawnY), city.ArrivalFrom(Districts.Tutorial));
        }

        [Test]
        public void TheIslandHasItsPeopleQuestsAndADummy()
        {
            var npcs = new List<NpcData>(Content.NpcsIn(Districts.Tutorial));
            Assert.GreaterOrEqual(npcs.Count, 3);
            Assert.IsNotNull(Content.Quest(Districts.TutorialFinalQuest));
            Assert.AreEqual(Districts.Tutorial, Content.Quest(Districts.TutorialFinalQuest).district);
            Assert.IsTrue(System.Array.Exists(Content.enemies, e => e.district == Districts.Tutorial));
            Assert.AreEqual("Wyspa Startowa", Districts.NameOf(Districts.Tutorial));
            Assert.AreEqual("Miasto Ziomków", Districts.NameOf(Districts.Start));
        }

        [Test]
        public void NewBudsStartOnTheIslandOldOnesInTheCity()
        {
            var fresh = new QuestLog(Content);
            Assert.IsFalse(fresh.TutorialDone(Districts.Tutorial, Districts.TutorialFinalQuest));
            fresh.Completed.Add("wyspa-powitanie");
            Assert.IsFalse(fresh.TutorialDone(Districts.Tutorial, Districts.TutorialFinalQuest), "island quests alone don't count");
            fresh.Completed.Add(Districts.TutorialFinalQuest);
            Assert.IsTrue(fresh.TutorialDone(Districts.Tutorial, Districts.TutorialFinalQuest));

            var veteran = new QuestLog(Content);
            veteran.Completed.Add("witaj-w-miescie"); // played before the island existed
            Assert.IsTrue(veteran.TutorialDone(Districts.Tutorial, Districts.TutorialFinalQuest));
        }

        [Test]
        public void ADuelStepCompletesOnAWinAgainstThatOpponent()
        {
            var log = new QuestLog(Content) { Level = 1 };
            log.Completed.Add("wyspa-powitanie");
            log.Accept("wyspa-trening");
            Assert.AreEqual("duel", log.CurrentStep("wyspa-trening").kind);
            Assert.AreEqual("Pokonaj manekina", log.Objective("wyspa-trening"));
            Assert.AreEqual((Districts.Tutorial, 53, 42), log.Target("wyspa-trening"));
            Assert.IsFalse(log.Duel("kibol-mirek"), "another opponent doesn't count");
            Assert.IsTrue(log.Duel("manekin-treningowy"));
            Assert.IsTrue(log.IsReady("wyspa-trening"));
        }
    }
}
