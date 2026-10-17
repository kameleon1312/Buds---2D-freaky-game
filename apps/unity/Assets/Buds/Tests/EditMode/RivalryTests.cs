using System;
using System.Collections.Generic;
using Buds.Api;
using Buds.Quests;
using NUnit.Framework;

namespace Buds.Tests
{
    public class TrainingGameTests
    {
        static readonly string[] Skills = { "walka", "flow", "graffiti", "surfing", "przetrwanie", "spryt" };
        const float Dt = 1 / 60f;

        static int PlayBot(ITrainingGame g)
        {
            for (var t = 0f; t < 120 && !g.Done; t += Dt) g.Bot(Dt);
            return g.Score;
        }

        static int PlayIdle(ITrainingGame g)
        {
            for (var t = 0f; t < 120 && !g.Done; t += Dt) g.Tick(Dt);
            return g.Score;
        }

        [Test]
        public void EverySkillTrainsWithItsOwnGameAndOnlySprytKeepsTheTimingBar()
        {
            var kinds = new HashSet<string>();
            foreach (var s in Skills) kinds.Add(TrainingGames.KindFor(s));
            Assert.AreEqual(Skills.Length, kinds.Count);
            Assert.AreEqual("timing", TrainingGames.KindFor("spryt"));
            Assert.IsInstanceOf<TimingGame>(TrainingGames.For("spryt", 5, 1));
        }

        [Test]
        public void EveryGameCanBeWonAndEnds([Values(1, 7, 42, 1234)] int seed)
        {
            foreach (var s in Skills)
            {
                var g = TrainingGames.For(s, 5, seed);
                Assert.AreEqual(5, PlayBot(g), $"{s} seed {seed}");
                Assert.IsTrue(g.Done, s);
            }
        }

        [Test]
        public void DoingNothingDoesNotTrain([Values(1, 7, 42, 1234)] int seed)
        {
            // (spryt's marker waits for a press: it has no clock, so it never ends on its own)
            foreach (var s in new[] { "walka", "flow", "graffiti", "przetrwanie" })
            {
                var g = TrainingGames.For(s, 5, seed);
                Assert.AreEqual(0, PlayIdle(g), s);
                Assert.IsTrue(g.Done, $"{s} must end on its own");
            }
            // on the wave an idle board sometimes rides out a calm wave, never most of them
            var balance = new BalanceGame(5, seed);
            Assert.LessOrEqual(PlayIdle(balance), 2);
        }

        [Test]
        public void AWrongDirectionBreaksTheCombo()
        {
            var g = new ComboGame(5, 3);
            var wrong = (g.Sequence[0] + 1) % 4;
            g.Press(wrong);
            Assert.AreEqual(1, g.Round);
            Assert.AreEqual(0, g.Score);
            Assert.AreEqual(-1, g.TakeFeedback());
            Assert.AreEqual(0, g.TakeFeedback());
        }

        [Test]
        public void CombosGrowAndTimeShrinks()
        {
            var g = new ComboGame(5, 3);
            var firstLength = g.Sequence.Length;
            var firstTime = g.TimeLimit;
            for (var r = 0; r < 4; r++)
            {
                foreach (var d in g.Sequence) g.Press(d);
                g.Tick(1);
            }
            Assert.Greater(g.Sequence.Length, firstLength);
            Assert.Less(g.TimeLimit / g.Sequence.Length, firstTime / firstLength);
            Assert.AreEqual(4, g.Score);
        }

        [Test]
        public void TheRhythmFollowsTheFlowRankAndStaysPlayable([Values(0, 1, 3, 5)] int rank)
        {
            var beginner = new RhythmGame(5, 4, 0);
            var g = new RhythmGame(5, 4, rank);
            Assert.LessOrEqual(g.FirstBeat, beginner.FirstBeat);
            Assert.LessOrEqual(g.Lead, beginner.Lead);
            // never tighter than a human can press, never two notes closer than a quarter of a second
            Assert.GreaterOrEqual(g.Window, 0.15f);
            for (var i = 1; i < g.Notes.Count; i++) Assert.GreaterOrEqual(g.Notes[i].Time - g.Notes[i - 1].Time, 0.44f);
            Assert.AreEqual(5, PlayBot(g));
            // a player who presses 0.12 s late every time still clears a beginner's rhythm
            var late = new RhythmGame(5, 4, 0);
            var pressed = new HashSet<RhythmGame.Note>();
            for (var t = 0f; t < 120 && !late.Done; t += Dt)
            {
                late.Tick(Dt);
                foreach (var n in late.Notes)
                    if (n.State == 0 && !pressed.Contains(n) && late.Clock - n.Time >= 0.12f)
                    {
                        pressed.Add(n);
                        late.Press(n.Lane);
                    }
            }
            Assert.AreEqual(5, late.Score);
        }

        [Test]
        public void ARhythmPressCountsOnlyNearTheLineAndInItsLane()
        {
            var g = new RhythmGame(5, 9);
            var first = g.Notes[0];
            g.Tick(first.Time - 0.5f);
            g.Press(first.Lane); // far too early
            Assert.AreEqual(0, first.State);
            g.Tick(0.5f);
            g.Press((first.Lane + 1) % RhythmGame.Lanes); // right time, wrong lane
            Assert.AreEqual(0, first.State);
            g.Press(first.Lane);
            Assert.AreEqual(1, first.State);
        }

        [Test]
        public void SprayingTheWholeStripFailsOnOverspray()
        {
            var g = new StencilGame(5, 4);
            g.Press(0);
            for (var t = 0f; t < 5 && g.Round == 0; t += Dt) g.Tick(Dt);
            Assert.AreEqual(1, g.Round);
            Assert.AreEqual(0, g.Score);
            Assert.AreEqual(1f, g.LastCovered, 0.001f);
            Assert.Greater(g.LastOverspray, StencilGame.MaxOverspray);
        }

        [Test]
        public void TheRunnerNeedsTheRightMoveForEachObstacle()
        {
            var g = new RunnerGame(5, 2);
            var first = g.Obstacles[0];
            // the wrong move just before it arrives
            g.Tick(first.Time - 0.2f);
            g.Press(1 - first.Kind);
            g.Tick(0.3f);
            Assert.AreEqual(-1, first.State);
        }

        [Test]
        public void ScoresNeverExceedTheServersMaximum()
        {
            foreach (var s in Skills)
            {
                var g = TrainingGames.For(s, 5, 99);
                PlayBot(g);
                Assert.That(g.Score, Is.InRange(0, 5), s);
            }
        }
    }

    public class GearDiffTests
    {
        [Test]
        public void TheEquipToastSaysWhatReallyChanged()
        {
            var content = new QuestContent
            {
                skills = new[] { new SkillData { id = "walka", name = "Walka" } },
                stats = System.Array.Empty<StatData>(),
                items = new[]
                {
                    new ItemData { id = "kask", slot = "head", armor = 3, skillBonus = System.Array.Empty<SkillBonusData>() },
                    new ItemData { id = "rekawice", slot = "hands", attack = 3, armor = 1,
                        skillBonus = new[] { new SkillBonusData { id = "walka", rank = 1 } } },
                    new ItemData { id = "czapka-premium", slot = "head", premium = true, skillBonus = System.Array.Empty<SkillBonusData>() },
                },
            };
            var none = Gear.Stats(content, new string[0], new Dictionary<string, int>());
            var helmet = Gear.Stats(content, new[] { "kask" }, new Dictionary<string, int>());
            var both = Gear.Stats(content, new[] { "kask", "rekawice" }, new Dictionary<string, int>());
            var looks = Gear.Stats(content, new[] { "czapka-premium" }, new Dictionary<string, int>());
            Assert.AreEqual("Pancerz 0 → 3", Gear.Diff(content, none, helmet));
            Assert.AreEqual("Atak 0 → 3  ·  Pancerz 3 → 4  ·  Walka 0 → 1", Gear.Diff(content, helmet, both));
            Assert.AreEqual("", Gear.Diff(content, none, looks));
        }
    }

    public class RivalryTextTests
    {
        [Test]
        public void PolishPlurals()
        {
            Assert.AreEqual("dzień", Rivalry.Plural(1, "dzień", "dni", "dni"));
            Assert.AreEqual("osoby", Rivalry.Plural(3, "osoba", "osoby", "osób"));
            Assert.AreEqual("osób", Rivalry.Plural(12, "osoba", "osoby", "osób"));
            Assert.AreEqual("osoby", Rivalry.Plural(22, "osoba", "osoby", "osób"));
            Assert.AreEqual("osób", Rivalry.Plural(25, "osoba", "osoby", "osób"));
        }

        [Test]
        public void TimeLeftInTheWeek()
        {
            var now = new DateTime(2026, 10, 17, 15, 0, 0, DateTimeKind.Utc);
            Assert.AreEqual("1 dzień 9 godz.", Rivalry.TimeLeft("2026-10-19T00:00:00.000Z", now));
            Assert.AreEqual("2 godz. 30 min", Rivalry.TimeLeft("2026-10-17T17:30:00.000Z", now));
            Assert.AreEqual("chwila", Rivalry.TimeLeft("2026-10-17T15:00:20.000Z", now));
            Assert.AreEqual("tydzień 42", Rivalry.WeekName("2026-W42"));
            Assert.AreEqual("tydzień 3", Rivalry.WeekName("2027-W03"));
        }

        [Test]
        public void TheMarketFeeMatchesTheServer()
        {
            // marketPayout in packages/shared rivalry.ts: 10%, rounded, at least one coin
            Assert.AreEqual(90, Rivalry.Payout(100));
            Assert.AreEqual(4, Rivalry.Payout(5));
            Assert.AreEqual(13, Rivalry.Payout(15)); // 1.5 rounds up like Math.round
            Assert.AreEqual(4500, Rivalry.Payout(5000));
        }

        [Test]
        public void OnlyEarnedGearGoesOnTheBazar()
        {
            var rewards = new HashSet<string> { "czapka-z-zadania" };
            Assert.IsTrue(Rivalry.Tradeable(new ItemData { id = "kij", coins = 40 }, rewards));
            Assert.IsFalse(Rivalry.Tradeable(new ItemData { id = "kij-neon", gems = 90, premium = true }, rewards));
            Assert.IsFalse(Rivalry.Tradeable(new ItemData { id = "napoj", coins = 10, drink = "turbo" }, rewards));
            Assert.IsFalse(Rivalry.Tradeable(new ItemData { id = "bluza" }, rewards)); // starter clothes
            Assert.IsFalse(Rivalry.Tradeable(new ItemData { id = "czapka-z-zadania", coins = 30 }, rewards));
            Assert.IsFalse(Rivalry.Tradeable(null, rewards));
        }

        [Test]
        public void LinesAboutInfluenceAndRulers()
        {
            Assert.IsNull(Rivalry.InfluenceLine(new InfluenceDto())); // JsonUtility's "null"
            Assert.AreEqual("+10 wpływu · Skatepark (40)",
                Rivalry.InfluenceLine(new InfluenceDto { turf = "mz-skatepark", name = "Skatepark", gained = 10, total = 40 }));
            Assert.AreEqual("Rewir Skatepark jest teraz twój!",
                Rivalry.InfluenceLine(new InfluenceDto { turf = "mz-skatepark", name = "Skatepark", gained = 10, captured = true }));
            Assert.AreEqual("Dzienny limit wpływu w: Skatepark",
                Rivalry.InfluenceLine(new InfluenceDto { turf = "mz-skatepark", name = "Skatepark" }));

            var free = new TurfStateDto { name = "Rynek", owner = new TurfOwnerDto() };
            Assert.AreEqual("Rynek · rewir wolny", Rivalry.RulerLine(free, "ala"));
            var ruled = new TurfStateDto { name = "Rynek", owner = new TurfOwnerDto { slug = "bartek", name = "Bartek", crewTag = "ZR" } };
            Assert.AreEqual("Rynek · rządzi Bartek [ZR]", Rivalry.RulerLine(ruled, "ala"));
            Assert.AreEqual("Rynek · twój rewir", Rivalry.RulerLine(ruled, "bartek"));
        }

        [Test]
        public void TitlesInShort()
        {
            var titles = new[]
            {
                new TitleDto { week = "2026-W41", title = "top:1" },
                new TitleDto { week = "2026-W41", title = "turf:mz-rynek" },
                new TitleDto { week = "2026-W42", title = "turf:mz-skatepark" },
                new TitleDto { week = "2026-W42", title = "top:3" },
            };
            Assert.AreEqual("1× numer jeden tygodnia · 1× podium tygodnia · 2× władza nad rewirem", Rivalry.Titles(titles));
            Assert.AreEqual("", Rivalry.Titles(Array.Empty<TitleDto>()));
        }
    }
}
