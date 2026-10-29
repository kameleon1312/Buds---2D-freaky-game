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
        public void EverySkillTrainsWithItsOwnRealTask()
        {
            var kinds = new HashSet<string>();
            foreach (var s in Skills) kinds.Add(TrainingGames.KindFor(s));
            Assert.AreEqual(Skills.Length, kinds.Count);
            Assert.IsInstanceOf<BoxingGame>(TrainingGames.For("walka", 5, 1));
            Assert.IsInstanceOf<RhythmGame>(TrainingGames.For("flow", 5, 1));
            Assert.IsInstanceOf<MuralGame>(TrainingGames.For("graffiti", 5, 1));
            Assert.IsInstanceOf<SharkGame>(TrainingGames.For("surfing", 5, 1));
            Assert.IsInstanceOf<RunnerGame>(TrainingGames.For("przetrwanie", 5, 1));
            Assert.IsInstanceOf<ShellGame>(TrainingGames.For("spryt", 5, 1));
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
        public void DoingNothingDoesNotTrainAndEveryGameEndsOnItsOwn([Values(1, 7, 42, 1234)] int seed)
        {
            foreach (var s in Skills)
            {
                var g = TrainingGames.For(s, 5, seed);
                Assert.AreEqual(0, PlayIdle(g), s);
                Assert.IsTrue(g.Done, $"{s} must end on its own");
            }
        }

        [Test]
        public void TheWrongAnswerToABlowGetsHit()
        {
            var g = new BoxingGame(5, 3);
            var blow = g.Moves[0];
            Assert.AreNotEqual(BoxingGame.Punch, blow.Need);
            g.Tick(blow.Time - blow.Windup + 0.01f);
            Assert.AreSame(blow, g.Coming);
            // dodging into the hook instead of away from it
            g.Press(blow.Need == BoxingGame.Guard ? BoxingGame.DodgeLeft : BoxingGame.Guard);
            g.Tick(blow.Windup);
            Assert.AreEqual(-1, blow.State);
            Assert.AreEqual(1, g.HitsTaken);
            Assert.AreEqual(-1, g.TakeFeedback());
        }

        [Test]
        public void ACounterLandsOnlyWhileTheGuardIsDown()
        {
            var g = new BoxingGame(5, 3);
            BoxingGame.Move opening = null;
            foreach (var m in g.Moves)
                if (m.Need == BoxingGame.Punch)
                {
                    opening = m;
                    break;
                }
            Assert.IsNotNull(opening);
            g.Tick(opening.Time - 0.2f);
            g.Press(BoxingGame.Punch); // too early: into the guard
            Assert.AreEqual(0, opening.State);
            g.Tick(0.3f);
            g.Press(BoxingGame.Punch);
            Assert.AreEqual(1, opening.State);
            Assert.AreEqual(1, g.Counters);
        }

        [Test]
        public void SparringRoundsSpeedUp()
        {
            var g = new BoxingGame(5, 8);
            float first = 0, last = 0;
            foreach (var m in g.Moves)
                if (m.Need != BoxingGame.Punch)
                {
                    if (m.Round == 0) first = m.Windup;
                    if (m.Round == 4) last = m.Windup;
                }
            Assert.Less(last, first);
            Assert.GreaterOrEqual(last, 0.45f);
        }

        [Test]
        public void TheMuralCountsOnlyAsAPerfectCopy()
        {
            var g = new MuralGame(5, 4);
            Assert.AreEqual(MuralGame.Stage.Look, g.Phase);
            Assert.AreEqual(3, g.Target.Length, "the first mural is the smallest");
            g.Press(g.Target[0]); // no painting while it is shown
            Assert.AreEqual(0, g.Current);
            g.Tick(MuralGame.LookTime(0) + 0.01f);
            Assert.AreEqual(MuralGame.Stage.Paint, g.Phase);
            // a wrong colour, taken back, then the right ones
            g.Press((g.Target[0] + 1) % MuralGame.Paints);
            g.Press(MuralGame.Undo);
            Assert.AreEqual(-1, g.Painted[0]);
            foreach (var c in g.Target) g.Press(c);
            Assert.AreEqual(1, g.Score);
            Assert.AreEqual(1, g.TakeFeedback());
            g.Tick(MuralGame.RevealTime + 0.01f);
            Assert.AreEqual(1, g.Round);
            Assert.GreaterOrEqual(g.Target.Length, 4);
            Assert.Less(MuralGame.LookTime(4), MuralGame.LookTime(0));
            Assert.GreaterOrEqual(MuralGame.LookTime(9), 3f);
            // one field off spoils the copy
            g.Tick(MuralGame.LookTime(1) + 0.01f);
            for (var i = 0; i < g.Target.Length; i++) g.Press(i == 1 ? (g.Target[i] + 1) % MuralGame.Paints : g.Target[i]);
            Assert.AreEqual(1, g.Score);
            Assert.AreEqual(1, g.LastMistakes);
        }

        [Test]
        public void EveryMuralsFieldsMatchItsArt()
        {
            var json = UnityEngine.Resources.Load<UnityEngine.TextAsset>("Ui/Training/murals").text;
            foreach (var (id, fields) in MuralGame.Templates)
            {
                for (var i = 0; i < fields; i++)
                    Assert.IsNotNull(UnityEngine.Resources.Load<UnityEngine.Texture2D>($"Ui/Training/Murals/{id}-{i}"), $"{id}-{i}");
                Assert.IsNull(UnityEngine.Resources.Load<UnityEngine.Texture2D>($"Ui/Training/Murals/{id}-{fields}"), $"{id} has more fields");
                StringAssert.Contains($"\"id\": \"{id}\"", json);
            }
        }

        [Test]
        public void TheSharkHuntsTheBudsLane()
        {
            var g = new SharkGame(5, 6);
            var first = g.Sharks[0];
            g.Tick(first.Time - SharkGame.Lead + 0.01f);
            Assert.AreEqual(g.Lane, first.Lane, "the first fin of a wave heads for the bud");
            g.Press(0);
            g.Tick(SharkGame.Lead);
            Assert.AreEqual(1, first.State);
            // a hunter turns one lane towards the bud shortly before it arrives
            SharkGame.Shark hunter = null;
            foreach (var s in g.Sharks)
                if (s.Hunter)
                {
                    hunter = s;
                    break;
                }
            Assert.IsNotNull(hunter);
            while (g.Clock < hunter.Time - SharkGame.TurnAt - 0.02f) g.Tick(Dt);
            var before = Math.Abs(g.Lane - hunter.Lane);
            g.Tick(0.05f);
            Assert.IsTrue(hunter.Turned);
            Assert.AreEqual(Math.Max(0, before - 1), Math.Abs(g.Lane - hunter.Lane));
        }

        [Test]
        public void TheBoardStaysOnTheWater()
        {
            var g = new SharkGame(5, 1);
            for (var i = 0; i < 9; i++) g.Press(0);
            Assert.AreEqual(0, g.Lane);
            for (var i = 0; i < 9; i++) g.Press(1);
            Assert.AreEqual(SharkGame.Lanes - 1, g.Lane);
        }

        [Test]
        public void TheCupWithTheBallIsFollowedThroughTheShuffle([Values(2, 5, 11)] int seed)
        {
            var g = new ShellGame(5, seed);
            var cups = g.Cups;
            var swaps = g.Swaps.Length;
            var time = g.SwapTime;
            while (g.Phase != ShellGame.Stage.Pick) g.Tick(Dt);
            // every swap only exchanged two cups: still one cup per slot
            var slots = new HashSet<int>();
            for (var c = 0; c < g.Cups; c++) slots.Add(g.SlotOf[c]);
            Assert.AreEqual(g.Cups, slots.Count);
            g.Press((g.SlotOf[g.Ball] + 1) % g.Cups);
            Assert.AreEqual(0, g.Score);
            Assert.IsFalse(g.LastHit);
            while (g.Round == 0) g.Tick(Dt);
            while (g.Phase != ShellGame.Stage.Pick) g.Tick(Dt);
            g.Press(g.SlotOf[g.Ball]);
            Assert.AreEqual(1, g.Score);
            Assert.Greater(g.Swaps.Length, swaps);
            Assert.Less(g.SwapTime, time);
            while (g.Round < 3) g.Bot(Dt);
            Assert.Greater(g.Cups, cups, "a fourth cup later on");
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
