using System.Collections.Generic;
using Buds.Quests;
using Buds.World;
using NUnit.Framework;
using UnityEngine;

namespace Buds.Tests
{
    public class QuestLogTests
    {
        const string Json = @"{
  ""npcs"": [
    { ""id"": ""a"", ""name"": ""Ala"", ""district"": ""d"", ""x"": 1, ""y"": 1, ""lines"": [""Hej""] },
    { ""id"": ""b"", ""name"": ""Bolek"", ""district"": ""d"", ""x"": 5, ""y"": 5, ""lines"": [""Siema""] }
  ],
  ""quests"": [
    { ""id"": ""q1"", ""title"": ""Pierwsze"", ""district"": ""d"", ""giver"": ""a"", ""xp"": 50, ""minLevel"": 1, ""requires"": [],
      ""intro"": ""Zrób to"", ""done"": ""Dzięki"",
      ""steps"": [
        { ""kind"": ""talk"", ""npc"": ""b"", ""text"": ""Cześć od Bolka"" },
        { ""kind"": ""reach"", ""x"": 10, ""y"": 10, ""radius"": 1, ""label"": ""Studnia"" },
        { ""kind"": ""collect"", ""item"": ""pomidor"", ""label"": ""Pomidory"", ""spots"": [ { ""x"": 2, ""y"": 2 }, { ""x"": 3, ""y"": 3 } ] }
      ] },
    { ""id"": ""q2"", ""title"": ""Drugie"", ""district"": ""d"", ""giver"": ""a"", ""xp"": 30, ""minLevel"": 1, ""requires"": [""q1""],
      ""intro"": ""Jeszcze to"", ""done"": ""Super"", ""steps"": [ { ""kind"": ""reach"", ""x"": 0, ""y"": 0, ""radius"": 1, ""label"": ""Róg"" } ] },
    { ""id"": ""q3"", ""title"": ""Trudne"", ""district"": ""d"", ""giver"": ""b"", ""xp"": 80, ""minLevel"": 3, ""requires"": [],
      ""intro"": ""Dla twardzieli"", ""done"": ""Brawo"", ""steps"": [ { ""kind"": ""reach"", ""x"": 0, ""y"": 0, ""radius"": 1, ""label"": ""Róg"" } ] }
  ]
}";

        QuestLog log;

        [SetUp]
        public void Make() => log = new QuestLog(QuestContent.Parse(Json));

        [Test]
        public void OffersOnlyWhatYouCanTake()
        {
            Assert.AreEqual("q1", log.OfferFrom("a").id);
            Assert.IsNull(log.OfferFrom("b"), "q3 needs level 3");
            Assert.AreEqual("q3", log.LockedByLevelAt("b").id);
            Assert.AreEqual(NpcMarker.Offer, log.MarkerFor("a"));
            Assert.AreEqual(NpcMarker.None, log.MarkerFor("b"));
            log.Level = 3;
            Assert.AreEqual("q3", log.OfferFrom("b").id);
        }

        [Test]
        public void WalksThroughEveryStepKind()
        {
            log.Accept("q1");
            Assert.AreEqual("Porozmawiaj: Bolek", log.Objective("q1"));
            Assert.AreEqual(NpcMarker.TurnIn, log.MarkerFor("b"), "the next talk is with Bolek");
            Assert.AreEqual(NpcMarker.Progress, log.MarkerFor("a"));
            Assert.IsNull(log.TalkTo("a"));
            Assert.AreEqual("Cześć od Bolka", log.TalkTo("b"));

            Assert.AreEqual("Idź do: Studnia", log.Objective("q1"));
            Assert.AreEqual(("d", 10, 10), log.Target("q1").Value);
            Assert.IsFalse(log.Reach("d", 7, 7));
            Assert.IsFalse(log.Reach("other", 10, 10));
            Assert.IsTrue(log.Reach("d", 11, 9));

            Assert.AreEqual("Zbierz: Pomidory 0/2", log.Objective("q1"));
            var pickups = new List<(QuestData, StepData, int)>(log.Pickups("d"));
            Assert.AreEqual(2, pickups.Count);
            log.Collect("q1", 1);
            log.Collect("q1", 1); // twice is once
            Assert.AreEqual("Zbierz: Pomidory 1/2", log.Objective("q1"));
            log.Collect("q1", 0);

            Assert.IsTrue(log.IsReady("q1"));
            Assert.AreEqual("Wróć do: Ala", log.Objective("q1"));
            Assert.AreEqual(NpcMarker.TurnIn, log.MarkerFor("a"));
            Assert.AreEqual("q1", log.TurnInAt("a").id);

            log.Complete("q1");
            Assert.IsFalse(log.IsActive("q1"));
            Assert.AreEqual("q2", log.OfferFrom("a").id, "completing q1 unlocks q2");
        }

        [Test]
        public void CannotTakeTheSameQuestTwice()
        {
            log.Accept("q1");
            log.Accept("q1");
            Assert.AreEqual(1, new List<QuestData>(log.Active).Count);
            log.Accept("q3"); // level too low
            Assert.IsFalse(log.IsActive("q3"));
        }

        [Test]
        public void SavesAndRestoresProgress()
        {
            log.Accept("q1");
            log.TalkTo("b");
            log.Reach("d", 10, 10);
            log.Collect("q1", 0);
            var saved = log.Save(includeCompleted: true);

            var again = new QuestLog(QuestContent.Parse(Json));
            again.Restore(saved);
            Assert.AreEqual("Zbierz: Pomidory 1/2", again.Objective("q1"));

            // a quest completed elsewhere (server) is not restored as active
            var synced = new QuestLog(QuestContent.Parse(Json));
            synced.Completed.Add("q1");
            synced.Restore(saved);
            Assert.IsFalse(synced.IsActive("q1"));

            Assert.DoesNotThrow(() => new QuestLog(QuestContent.Parse(Json)).Restore("not json"));
        }
    }

    /// <summary>The NPCs and quests shipped with the game fit the district maps.</summary>
    public class QuestContentTests
    {
        QuestContent content;

        [SetUp]
        public void Load() => content = QuestContent.Load();

        [Test]
        public void HasStarterContentInTheStartDistrict()
        {
            Assert.GreaterOrEqual(new List<NpcData>(content.NpcsIn(Districts.Start)).Count, 5);
            var xp = 0;
            foreach (var q in content.quests)
                if (q.district == Districts.Start) xp += q.xp;
            Assert.GreaterOrEqual(xp, 400, "enough XP to reach level 3");
        }

        [Test]
        public void EveryDistrictHasNpcsAndQuestsFromItsUnlockLevel()
        {
            foreach (var d in Districts.All)
            {
                Assert.GreaterOrEqual(new List<NpcData>(content.NpcsIn(d.Id)).Count, 5, d.Id);
                var count = 0;
                foreach (var q in content.quests)
                {
                    if (q.district != d.Id) continue;
                    count++;
                    Assert.GreaterOrEqual(q.minLevel, d.UnlockLevel, $"{q.id} is easier than its district");
                }
                Assert.GreaterOrEqual(count, 6, d.Id);
            }
        }

        [Test]
        public void QuestXpOfEachDistrictUnlocksTheNext()
        {
            var xp = 0;
            for (var i = 0; i < Districts.All.Length; i++)
            {
                var d = Districts.All[i];
                Assert.GreaterOrEqual(Core.Progression.Level(xp), d.UnlockLevel, $"not enough XP to enter {d.Name}");
                foreach (var q in content.quests)
                    if (q.district == d.Id) xp += q.xp;
            }
        }

        [Test]
        public void ItemsAndSkillsHaveIcons()
        {
            Assert.IsNotEmpty(content.items);
            Assert.AreEqual(6, content.skills.Length);
            foreach (var i in content.items) Assert.IsNotNull(Resources.Load<Texture2D>("Items/" + i.id), $"icon for {i.id}");
            foreach (var s in content.skills) Assert.IsNotNull(Resources.Load<Texture2D>("Skills/" + s.id), $"icon for {s.id}");
            foreach (var q in content.quests)
                if (!string.IsNullOrEmpty(q.rewardItem)) Assert.IsNotNull(content.Item(q.rewardItem), $"{q.id} reward");
        }

        [Test]
        public void EveryNpcHasASheetAndStandsOnFreeGround()
        {
            foreach (var n in content.npcs)
            {
                var tex = Resources.Load<Texture2D>("Npcs/" + n.id);
                Assert.IsNotNull(tex, $"Resources/Npcs/{n.id}.png");
                Assert.DoesNotThrow(() => Characters.BudSheet.ScaleOf(tex.width, tex.height), n.id);
                var map = MapFormat.Load(n.district);
                Assert.IsTrue(map.IsWalkable(n.x, n.y), $"{n.id} at ({n.x},{n.y})");
            }
        }

        [Test]
        public void QuestTargetsExistOnTheMap()
        {
            foreach (var q in content.quests)
            {
                Assert.IsNotNull(content.Npc(q.giver), $"{q.id} giver");
                var map = MapFormat.Load(q.district);
                foreach (var s in q.steps)
                {
                    switch (s.kind)
                    {
                        case "talk":
                            Assert.IsNotNull(content.Npc(s.npc), $"{q.id} talks to {s.npc}");
                            break;
                        case "reach":
                            Assert.IsTrue(map.InBounds(s.x, s.y), $"{q.id} reach {s.label}");
                            break;
                        case "ask":
                            Assert.IsNotNull(content.Npc(s.npc), $"{q.id} asks through {s.npc}");
                            Assert.Less(s.correct, s.answers.Length, $"{q.id}: the right answer is one of them");
                            break;
                        case "game":
                            Assert.IsNotNull(content.Npc(s.npc), $"{q.id} plays with {s.npc}");
                            Assert.DoesNotThrow(() => TrainingGames.For(s.skill, 5, 1, 0), $"{q.id}: {s.skill}");
                            break;
                        case "collect":
                            foreach (var c in s.spots) Assert.IsTrue(map.IsWalkable(c.x, c.y), $"{q.id} {s.item} at ({c.x},{c.y})");
                            Assert.IsNotNull(Resources.Load<Texture2D>("World/item-" + s.item), $"art for item-{s.item}");
                            break;
                        case "duel":
                            var foe = content.Enemy(s.enemy);
                            Assert.IsNotNull(foe, $"{q.id} duels {s.enemy}");
                            Assert.AreEqual(q.district, foe.district, $"{q.id}: {s.enemy} stands in the quest's map");
                            break;
                        default:
                            Assert.Fail($"{q.id}: unknown step kind {s.kind}");
                            break;
                    }
                }
            }
        }

        static QuestLog Twisted()
        {
            var content = new QuestContent
            {
                npcs = new[] { new NpcData { id = "a", name = "A" }, new NpcData { id = "b", name = "B" } },
                quests = new[]
                {
                    new QuestData
                    {
                        id = "q", giver = "a", district = "d", requires = new string[0], minLevel = 1, fragile = "Upadek!",
                        steps = new[]
                        {
                            new StepData { kind = "talk", npc = "b", text = "Hasło: fala" },
                            new StepData { kind = "ask", npc = "a", text = "?", answers = new[] { "x", "fala" }, correct = 1, wrong = "nie", back = 1 },
                            new StepData { kind = "game", npc = "b", skill = "walka", score = 3, wrong = "za mało" },
                            new StepData { kind = "reach", x = 1, y = 1, radius = 1, seconds = 10, back = 1, late = "Za późno" },
                        },
                    },
                },
            };
            var log = new QuestLog(content);
            log.Accept("q");
            return log;
        }

        [Test]
        public void AWrongAnswerGoesBackToHearItAgain()
        {
            var log = Twisted();
            log.TalkTo("b");
            Assert.AreEqual(NpcMarker.TurnIn, log.MarkerFor("a"), "the one asking is marked");
            Assert.AreEqual("ask", log.WaitingAt("a")?.step.kind);
            Assert.IsFalse(log.Answer("q", 0));
            Assert.AreEqual("talk", log.CurrentStep("q").kind);
            log.TalkTo("b");
            Assert.IsTrue(log.Answer("q", 1));
            Assert.AreEqual("game", log.CurrentStep("q").kind);
        }

        [Test]
        public void AMiniGameCountsOnlyWithEnoughPoints()
        {
            var log = Twisted();
            log.TalkTo("b");
            log.Answer("q", 1);
            Assert.IsFalse(log.GameScore("q", 2));
            Assert.AreEqual("game", log.CurrentStep("q").kind, "too few points: the same game again");
            Assert.IsTrue(log.GameScore("q", 3));
            Assert.AreEqual("reach", log.CurrentStep("q").kind);
        }

        [Test]
        public void TooLateGoesBackAndTheClockStartsAfresh()
        {
            var log = Twisted();
            log.TalkTo("b");
            log.Answer("q", 1);
            log.GameScore("q", 5);
            Assert.AreEqual(10, log.TimeLeft("q"), 0.01f);
            Assert.IsEmpty(log.Tick(4));
            Assert.AreEqual(6, log.TimeLeft("q"), 0.01f);
            StringAssert.Contains("6 s", log.Objective("q"));
            CollectionAssert.AreEqual(new[] { "Za późno" }, log.Tick(7));
            Assert.AreEqual("game", log.CurrentStep("q").kind);
            log.GameScore("q", 5);
            Assert.AreEqual(10, log.TimeLeft("q"), 0.01f, "a new try, a full clock");
        }

        [Test]
        public void AKnockoutSendsAFragileQuestBackToItsStart()
        {
            var log = Twisted();
            Assert.IsEmpty(log.KnockedOut(), "nothing to lose yet");
            log.TalkTo("b");
            CollectionAssert.AreEqual(new[] { "Upadek!" }, log.KnockedOut());
            Assert.AreEqual("talk", log.CurrentStep("q").kind);
        }

        [Test]
        public void AfterFailingAgainstTheClockTheGiverStartsItAgain()
        {
            var content = new QuestContent
            {
                npcs = new[] { new NpcData { id = "a", name = "A", district = "d" } },
                quests = new[]
                {
                    new QuestData
                    {
                        id = "q", giver = "a", district = "d", requires = new string[0], minLevel = 1,
                        steps = new[] { new StepData { kind = "reach", x = 1, y = 1, radius = 1, seconds = 10, late = "Za późno" } },
                    },
                },
            };
            var log = new QuestLog(content);
            log.Accept("q");
            log.Tick(11);
            Assert.AreEqual(NpcMarker.TurnIn, log.MarkerFor("a"));
            Assert.IsEmpty(log.Tick(100), "no clock until the bud has been back");
            Assert.IsFalse(log.Reach("d", 1, 1), "and the place doesn't count");
            StringAssert.Contains("A", log.Objective("q"));
            Assert.IsNotNull(log.TalkTo("a"));
            Assert.AreEqual(10, log.TimeLeft("q"), 0.01f);
            Assert.IsTrue(log.Reach("d", 1, 1));
            Assert.IsTrue(log.IsReady("q"));
        }
    }
}
