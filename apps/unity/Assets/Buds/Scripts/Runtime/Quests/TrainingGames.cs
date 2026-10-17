using System;
using System.Collections.Generic;

namespace Buds.Quests
{
    /// <summary>
    /// A training mini-game as plain logic. Every skill trains differently (TrainingGames.For): the score is the
    /// number of rounds done well (0..Rounds), the server turns it into training XP. Inputs are action indexes
    /// (keys and on-screen buttons map onto them); a press and, for held actions, a release.
    /// </summary>
    public interface ITrainingGame
    {
        int Rounds { get; }
        int Round { get; }
        int Score { get; }
        bool Done { get; }
        void Tick(float dt);
        void Press(int action);
        void Release(int action);
        /// <summary>+1 a round (or a step) went well, -1 it didn't, 0 nothing new since the last call.</summary>
        int TakeFeedback();
        /// <summary>Plays perfectly for a frame (EditMode tests and the autopilot's screenshots).</summary>
        void Bot(float dt);
    }

    public static class TrainingGames
    {
        /// <summary>The kind of mini-game a skill trains with.</summary>
        public static string KindFor(string skill) => skill switch
        {
            "walka" => "combo",
            "flow" => "rhythm",
            "graffiti" => "stencil",
            "surfing" => "balance",
            "przetrwanie" => "runner",
            _ => "timing", // spryt: focus, stop the marker in the zone
        };

        /// <param name="rank">The bud's rank in the skill: the rhythm's tempo follows it (a beginner gets a slow, wide beat).</param>
        public static ITrainingGame For(string skill, int rounds, int seed, int rank = 0) => KindFor(skill) switch
        {
            "combo" => new ComboGame(rounds, seed),
            "rhythm" => new RhythmGame(rounds, seed, rank),
            "stencil" => new StencilGame(rounds, seed),
            "balance" => new BalanceGame(rounds, seed),
            "runner" => new RunnerGame(rounds, seed),
            _ => new TimingGame(rounds, seed),
        };
    }

    // ---------- walka: combos ----------

    /// <summary>
    /// Kombinacje: a combo of directions shows up, the player beats it out in order before time runs out. A wrong
    /// direction or the clock ends the round. Longer combos and less time as the rounds go.
    /// </summary>
    public sealed class ComboGame : ITrainingGame
    {
        readonly Random rng;
        int feedback;
        public int Rounds { get; }
        public int Round { get; private set; }
        public int Score { get; private set; }
        public bool Done => Round >= Rounds;
        /// <summary>0 left, 1 up, 2 right, 3 down.</summary>
        public int[] Sequence { get; private set; } = Array.Empty<int>();
        public int Position { get; private set; }
        public float TimeLeft { get; private set; }
        public float TimeLimit { get; private set; }
        /// <summary>A short pause after each combo so the result can be seen.</summary>
        public float Pause { get; private set; }
        float botWait;

        public ComboGame(int rounds = 5, int seed = 0)
        {
            Rounds = Math.Max(1, rounds);
            rng = new Random(seed);
            NextCombo();
        }

        void NextCombo()
        {
            var length = 3 + Round / 2;
            Sequence = new int[length];
            for (var i = 0; i < length; i++)
            {
                // never the same direction three times in a row: it should feel like a combo, not mashing
                int d;
                do d = rng.Next(4);
                while (i >= 2 && d == Sequence[i - 1] && d == Sequence[i - 2]);
                Sequence[i] = d;
            }
            Position = 0;
            TimeLimit = (1.0f + 0.55f * length) * (1 - 0.06f * Round);
            TimeLeft = TimeLimit;
        }

        void EndRound(bool hit)
        {
            if (hit) Score++;
            feedback = hit ? 1 : -1;
            Round++;
            Pause = 0.45f;
            if (!Done) NextCombo();
        }

        public void Tick(float dt)
        {
            if (Done) return;
            if (Pause > 0)
            {
                Pause = Math.Max(0, Pause - dt);
                return;
            }
            TimeLeft -= dt;
            if (TimeLeft <= 0) EndRound(false);
        }

        public void Press(int action)
        {
            if (Done || Pause > 0 || action < 0 || action > 3) return;
            if (action != Sequence[Position])
            {
                EndRound(false);
                return;
            }
            Position++;
            if (Position >= Sequence.Length) EndRound(true);
        }

        public void Release(int action)
        {
        }

        public int TakeFeedback()
        {
            var f = feedback;
            feedback = 0;
            return f;
        }

        public void Bot(float dt)
        {
            Tick(dt);
            botWait -= dt;
            if (Done || Pause > 0 || botWait > 0) return;
            Press(Sequence[Position]);
            botWait = 0.18f;
        }
    }

    // ---------- flow: rhythm ----------

    /// <summary>
    /// Rytm: notes slide along three lanes to the line; hit the lane as a note crosses it. Rounds are phrases of four
    /// notes; a phrase counts with at least three hits. The tempo follows the bud's Flow rank: a beginner gets a slow beat,
    /// notes in view for longer and a wide window; every rank speeds it up a little, and it picks up gently phrase by
    /// phrase. Even at the top rank there is more than a quarter of a second between notes.
    /// </summary>
    public sealed class RhythmGame : ITrainingGame
    {
        public sealed class Note
        {
            public float Time;
            public int Lane;
            public int Phrase;
            /// <summary>0 waiting, 1 hit, -1 missed.</summary>
            public int State;
        }

        public const int Lanes = 3;
        public const int NotesPerPhrase = 4;
        public const int HitsNeeded = 3;
        /// <summary>How far from the line a press still counts (seconds): 0.22 for a beginner, 0.16 at rank 5.</summary>
        public float Window { get; }
        /// <summary>Seconds a note is visible before it reaches the line: 2.6 for a beginner, 1.8 at rank 5.</summary>
        public float Lead { get; }
        /// <summary>Seconds between notes in the first phrase.</summary>
        public float FirstBeat { get; }

        readonly List<Note> notes = new();
        readonly int[] phraseHits;
        readonly int[] phraseJudged;
        int feedback;
        public int Rounds { get; }
        public int Round { get; private set; }
        public int Score { get; private set; }
        public bool Done => Round >= Rounds;
        public float Clock { get; private set; }
        public IReadOnlyList<Note> Notes => notes;
        /// <summary>The lane pressed last and when (for the flash on the line).</summary>
        public int LastLane { get; private set; } = -1;

        public RhythmGame(int rounds = 5, int seed = 0, int rank = 0)
        {
            Rounds = Math.Max(1, rounds);
            rank = Math.Clamp(rank, 0, 5); // the top trained rank; gear never makes the beat faster
            Window = 0.22f - 0.012f * rank;
            Lead = 2.6f - 0.16f * rank;
            FirstBeat = 1.0f - 0.07f * rank;
            phraseHits = new int[Rounds];
            phraseJudged = new int[Rounds];
            var rng = new Random(seed);
            var t = Lead + 0.4f;
            for (var p = 0; p < Rounds; p++)
            {
                var beat = Math.Max(0.45f, FirstBeat - 0.04f * p);
                var lane = rng.Next(Lanes);
                for (var i = 0; i < NotesPerPhrase; i++)
                {
                    // mostly a step to a neighbouring lane, sometimes a jump, never the same lane twice
                    var step = rng.Next(4) == 0 ? 2 : 1;
                    lane = (lane + (rng.Next(2) == 0 ? step : Lanes - step)) % Lanes;
                    notes.Add(new Note { Time = t, Lane = lane, Phrase = p });
                    t += beat;
                }
                t += beat * 0.8f; // a breath between phrases
            }
        }

        void Judge(Note n, bool hit)
        {
            n.State = hit ? 1 : -1;
            if (hit) phraseHits[n.Phrase]++;
            phraseJudged[n.Phrase]++;
            feedback = hit ? 1 : -1;
            if (phraseJudged[n.Phrase] < NotesPerPhrase) return;
            if (phraseHits[n.Phrase] >= HitsNeeded) Score++;
            Round = Math.Max(Round, n.Phrase + 1);
        }

        public void Tick(float dt)
        {
            if (Done) return;
            Clock += dt;
            foreach (var n in notes)
                if (n.State == 0 && Clock - n.Time > Window)
                    Judge(n, false);
        }

        public void Press(int action)
        {
            if (Done || action < 0 || action >= Lanes) return;
            LastLane = action;
            Note best = null;
            foreach (var n in notes)
                if (n.State == 0 && n.Lane == action && Math.Abs(n.Time - Clock) <= Window &&
                    (best == null || Math.Abs(n.Time - Clock) < Math.Abs(best.Time - Clock)))
                    best = n;
            if (best != null) Judge(best, true);
        }

        public void Release(int action)
        {
        }

        public int TakeFeedback()
        {
            var f = feedback;
            feedback = 0;
            return f;
        }

        public void Bot(float dt)
        {
            Tick(dt);
            foreach (var n in notes)
                if (n.State == 0 && Math.Abs(n.Time - Clock) <= 0.03f)
                    Press(n.Lane);
        }
    }

    // ---------- graffiti: stencil ----------

    /// <summary>
    /// Szablon: the can sweeps along a stencil once; hold to spray over the openings, let go over the mask. A strip
    /// counts when most of the openings are painted and little paint lands on the mask. Faster each strip.
    /// </summary>
    public sealed class StencilGame : ITrainingGame
    {
        public const int Bins = 100;
        public const float NeedCovered = 0.75f;
        public const float MaxOverspray = 0.2f;

        readonly Random rng;
        int feedback;
        public int Rounds { get; }
        public int Round { get; private set; }
        public int Score { get; private set; }
        public bool Done => Round >= Rounds;
        /// <summary>Openings of the stencil on the strip, as (from, to) in 0..1.</summary>
        public List<(float from, float to)> Openings { get; } = new();
        public bool[] Painted { get; } = new bool[Bins];
        public float Marker { get; private set; }
        public bool Holding { get; private set; }
        public float Speed { get; private set; }
        public float Pause { get; private set; }
        /// <summary>The last strip's result, for the screen: share of openings painted and of the mask sprayed.</summary>
        public float LastCovered { get; private set; }
        public float LastOverspray { get; private set; }

        public StencilGame(int rounds = 5, int seed = 0)
        {
            Rounds = Math.Max(1, rounds);
            rng = new Random(seed);
            NextStrip();
        }

        void NextStrip()
        {
            Openings.Clear();
            Array.Clear(Painted, 0, Bins);
            Marker = 0;
            Speed = 0.42f + 0.07f * Round;
            // 3 or 4 openings with masks between them, narrower later
            var count = Round < 2 ? 3 : 4;
            var x = 0.06f + (float)rng.NextDouble() * 0.04f;
            for (var i = 0; i < count; i++)
            {
                var width = 0.1f + (float)rng.NextDouble() * (0.12f - 0.012f * Round);
                Openings.Add((x, Math.Min(0.96f, x + width)));
                x += width + 0.07f + (float)rng.NextDouble() * 0.07f;
                if (x > 0.9f) break;
            }
        }

        public bool InOpening(float at)
        {
            foreach (var (a, b) in Openings)
                if (at >= a && at <= b) return true;
            return false;
        }

        void Judge()
        {
            int open = 0, openPainted = 0, mask = 0, maskPainted = 0;
            for (var i = 0; i < Bins; i++)
            {
                var at = (i + 0.5f) / Bins;
                if (InOpening(at))
                {
                    open++;
                    if (Painted[i]) openPainted++;
                }
                else
                {
                    mask++;
                    if (Painted[i]) maskPainted++;
                }
            }
            LastCovered = open > 0 ? openPainted / (float)open : 0;
            LastOverspray = mask > 0 ? maskPainted / (float)mask : 0;
            var hit = LastCovered >= NeedCovered && LastOverspray <= MaxOverspray;
            if (hit) Score++;
            feedback = hit ? 1 : -1;
            Round++;
            Pause = 0.7f;
            Holding = false;
        }

        public void Tick(float dt)
        {
            if (Done) return;
            if (Pause > 0)
            {
                Pause = Math.Max(0, Pause - dt);
                if (Pause == 0) NextStrip();
                return;
            }
            var from = Marker;
            Marker = Math.Min(1, Marker + Speed * dt);
            if (Holding)
            {
                // paint every bin the can passed over this frame
                var a = (int)(from * Bins);
                var b = Math.Min(Bins - 1, (int)(Marker * Bins));
                for (var i = a; i <= b; i++) Painted[i] = true;
            }
            if (Marker >= 1) Judge();
        }

        public void Press(int action)
        {
            if (!Done && Pause <= 0) Holding = true;
        }

        public void Release(int action) => Holding = false;

        public int TakeFeedback()
        {
            var f = feedback;
            feedback = 0;
            return f;
        }

        public void Bot(float dt)
        {
            // looks a little ahead, like a steady hand would
            if (Pause <= 0)
            {
                var want = InOpening(Math.Min(1, Marker + Speed * dt * 0.5f));
                if (want && !Holding) Press(0);
                else if (!want && Holding) Release(0);
            }
            Tick(dt);
        }
    }

    // ---------- surfing: balance ----------

    /// <summary>
    /// Równowaga: the wave pushes the board one way and the other; nudge it back (left / right) to keep it in the
    /// steady band. A wave counts when the board stayed steady most of the time and never went over. Bigger waves later.
    /// </summary>
    public sealed class BalanceGame : ITrainingGame
    {
        public const float WaveLength = 4f;
        public const float Band = 0.42f;
        public const float NeedSteady = 0.72f;
        const float Nudge = 0.55f;

        readonly Random rng;
        int feedback;
        float force;
        float forceTarget;
        float forceTimer;
        float steady;
        bool fell;
        public int Rounds { get; }
        public int Round { get; private set; }
        public int Score { get; private set; }
        public bool Done => Round >= Rounds;
        /// <summary>-1..1: how far the board leans (±1 = in the water).</summary>
        public float Tilt { get; private set; }
        public float Velocity { get; private set; }
        public float WaveTime { get; private set; }
        public float Pause { get; private set; }
        public float SteadyShare => WaveTime > 0 ? steady / WaveTime : 1;
        public bool Fell => fell;

        public BalanceGame(int rounds = 5, int seed = 0)
        {
            Rounds = Math.Max(1, rounds);
            rng = new Random(seed);
            Pause = 0.6f;
        }

        public void Tick(float dt)
        {
            if (Done) return;
            if (Pause > 0)
            {
                Pause = Math.Max(0, Pause - dt);
                return;
            }
            // the wave: a push that changes every so often, stronger wave by wave
            forceTimer -= dt;
            if (forceTimer <= 0)
            {
                var strength = 0.8f + 0.2f * Round;
                forceTarget = ((float)rng.NextDouble() * 2 - 1) * strength;
                forceTimer = 0.55f + (float)rng.NextDouble() * 0.6f;
            }
            force += (forceTarget - force) * Math.Min(1, dt * 4);
            // a leaning board wants to lean further; water damps it
            Velocity += (force + Tilt * 1.4f) * dt;
            Velocity *= (float)Math.Pow(0.35, dt);
            Tilt += Velocity * dt;
            if (Math.Abs(Tilt) < Band) steady += dt;
            WaveTime += dt;
            if (Math.Abs(Tilt) >= 1)
            {
                fell = true;
                Tilt = Math.Sign(Tilt);
                EndWave();
                return;
            }
            if (WaveTime >= WaveLength) EndWave();
        }

        void EndWave()
        {
            var hit = !fell && SteadyShare >= NeedSteady;
            if (hit) Score++;
            feedback = hit ? 1 : -1;
            Round++;
            Tilt = 0;
            Velocity = 0;
            WaveTime = 0;
            steady = 0;
            fell = false;
            force = 0;
            forceTimer = 0;
            Pause = 0.6f;
        }

        /// <summary>0 leans left, 1 leans right.</summary>
        public void Press(int action)
        {
            if (Done || Pause > 0) return;
            Velocity += action == 0 ? -Nudge : Nudge;
        }

        public void Release(int action)
        {
        }

        public int TakeFeedback()
        {
            var f = feedback;
            feedback = 0;
            return f;
        }

        float botWait;

        public void Bot(float dt)
        {
            Tick(dt);
            botWait -= dt;
            if (botWait > 0 || Pause > 0 || Done) return;
            // where the board will be in a moment: lean against it
            var ahead = Tilt + Velocity * 0.35f;
            if (Math.Abs(ahead) > 0.12f)
            {
                Press(ahead > 0 ? 0 : 1);
                botWait = 0.16f;
            }
        }
    }

    // ---------- przetrwanie: runner ----------

    /// <summary>
    /// Tor przeszkód: hurdles come along the track (jump) and beams overhead (slide under); pick the right move at the
    /// right moment. Two obstacles a round; a round counts when both are cleared. Faster each round.
    /// </summary>
    public sealed class RunnerGame : ITrainingGame
    {
        public sealed class Obstacle
        {
            public float Time;
            /// <summary>0 hurdle (jump), 1 beam (slide).</summary>
            public int Kind;
            public int Round;
            /// <summary>0 coming, 1 cleared, -1 hit.</summary>
            public int State;
        }

        public const int PerRound = 2;
        public const float MoveTime = 0.6f;
        /// <summary>Seconds an obstacle is visible before it reaches the runner.</summary>
        public const float Lead = 1.8f;

        readonly List<Obstacle> obstacles = new();
        readonly int[] roundHits;
        readonly int[] roundJudged;
        int feedback;
        public int Rounds { get; }
        public int Round { get; private set; }
        public int Score { get; private set; }
        public bool Done => Round >= Rounds;
        public float Clock { get; private set; }
        public IReadOnlyList<Obstacle> Obstacles => obstacles;
        /// <summary>Seconds left of a jump or a slide (one at a time).</summary>
        public float JumpLeft { get; private set; }
        public float SlideLeft { get; private set; }

        public RunnerGame(int rounds = 5, int seed = 0)
        {
            Rounds = Math.Max(1, rounds);
            roundHits = new int[Rounds];
            roundJudged = new int[Rounds];
            var rng = new Random(seed);
            var t = Lead + 0.3f;
            for (var r = 0; r < Rounds; r++)
            {
                var gap = 1.35f - 0.1f * r;
                for (var i = 0; i < PerRound; i++)
                {
                    obstacles.Add(new Obstacle { Time = t, Kind = rng.Next(2), Round = r });
                    t += gap + (float)rng.NextDouble() * 0.35f;
                }
                t += 0.5f;
            }
        }

        public void Tick(float dt)
        {
            if (Done) return;
            Clock += dt;
            JumpLeft = Math.Max(0, JumpLeft - dt);
            SlideLeft = Math.Max(0, SlideLeft - dt);
            foreach (var o in obstacles)
            {
                if (o.State != 0 || Clock < o.Time) continue;
                // the moment it reaches the runner: the right move must be under way
                var cleared = o.Kind == 0 ? JumpLeft > 0 : SlideLeft > 0;
                o.State = cleared ? 1 : -1;
                if (cleared) roundHits[o.Round]++;
                roundJudged[o.Round]++;
                feedback = cleared ? 1 : -1;
                if (roundJudged[o.Round] == PerRound)
                {
                    if (roundHits[o.Round] == PerRound) Score++;
                    Round = Math.Max(Round, o.Round + 1);
                }
            }
        }

        /// <summary>0 jumps, 1 slides; one move at a time.</summary>
        public void Press(int action)
        {
            if (Done || JumpLeft > 0 || SlideLeft > 0) return;
            if (action == 0) JumpLeft = MoveTime;
            else SlideLeft = MoveTime;
        }

        public void Release(int action)
        {
        }

        public int TakeFeedback()
        {
            var f = feedback;
            feedback = 0;
            return f;
        }

        public void Bot(float dt)
        {
            foreach (var o in obstacles)
                if (o.State == 0 && o.Time - Clock <= MoveTime * 0.5f && o.Time - Clock > 0)
                {
                    Press(o.Kind);
                    break;
                }
            Tick(dt);
        }
    }
}
