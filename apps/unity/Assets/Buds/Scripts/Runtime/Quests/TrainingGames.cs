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
        /// <summary>The kind of mini-game a skill trains with: a real task for each skill.</summary>
        public static string KindFor(string skill) => skill switch
        {
            "walka" => "boxing", // sparring: dodge, block, counter
            "flow" => "rhythm", // on stage: every note a word of the verse
            "graffiti" => "mural", // a mural from memory
            "surfing" => "shark", // out of the shark's way
            "przetrwanie" => "runner", // away from the guard dog
            _ => "shell", // spryt: the street hustler's cups
        };

        /// <param name="rank">The bud's rank in the skill: the rhythm's tempo follows it (a beginner gets a slow, wide beat).</param>
        public static ITrainingGame For(string skill, int rounds, int seed, int rank = 0) => KindFor(skill) switch
        {
            "boxing" => new BoxingGame(rounds, seed),
            "rhythm" => new RhythmGame(rounds, seed, rank),
            "mural" => new MuralGame(rounds, seed),
            "shark" => new SharkGame(rounds, seed),
            "runner" => new RunnerGame(rounds, seed),
            _ => new ShellGame(rounds, seed),
        };
    }

    // ---------- walka: sparring ----------

    /// <summary>
    /// Sparing: the partner telegraphs every blow (a hook from one side or a straight) and now and then drops the
    /// guard. Dodge away from a hook, block a straight, punch into an opening before it closes. A round counts when
    /// nothing got through and at least one counter landed. Quicker wind-ups and longer rounds as it goes.
    /// </summary>
    public sealed class BoxingGame : ITrainingGame
    {
        public const int DodgeLeft = 0, Guard = 1, DodgeRight = 2, Punch = 3;
        public const float DodgeTime = 0.42f, GuardTime = 0.45f, PunchTime = 0.22f;

        public sealed class Move
        {
            /// <summary>When the blow lands, or when the partner opens up.</summary>
            public float Time;
            /// <summary>The answer it needs: DodgeLeft / Guard / DodgeRight against a blow, Punch into an opening.</summary>
            public int Need;
            public float Windup;
            /// <summary>How long an opening stays open.</summary>
            public float Open;
            public int Round;
            /// <summary>0 coming, 1 answered, -1 got through (or the opening was missed).</summary>
            public int State;
        }

        readonly List<Move> moves = new();
        readonly int[] size;
        readonly int[] judged;
        readonly int[] hits;
        readonly int[] counters;
        int feedback;
        public int Rounds { get; }
        public int Round { get; private set; }
        public int Score { get; private set; }
        public bool Done => Round >= Rounds;
        public float Clock { get; private set; }
        public IReadOnlyList<Move> Moves => moves;
        /// <summary>What the bud is doing (-1 nothing) and for how much longer.</summary>
        public int Action { get; private set; } = -1;
        public float ActionLeft { get; private set; }
        public int HitsTaken { get; private set; }
        public int Counters { get; private set; }
        public int Openings { get; }

        public BoxingGame(int rounds = 5, int seed = 0)
        {
            Rounds = Math.Max(1, rounds);
            size = new int[Rounds];
            judged = new int[Rounds];
            hits = new int[Rounds];
            counters = new int[Rounds];
            var rng = new Random(seed);
            var t = 1.4f;
            for (var r = 0; r < Rounds; r++)
            {
                var count = 3 + r / 2;
                var windup = Math.Max(0.45f, 0.8f - 0.07f * r);
                var open = Math.Max(0.42f, 0.62f - 0.04f * r);
                for (var i = 0; i < count; i++)
                {
                    // every round ends on an opening, another may come after a blow (never two in a row)
                    var punch = i == count - 1 || i > 0 && moves[^1].Need != Punch && rng.Next(3) == 0;
                    var m = new Move { Round = r, Windup = windup, Open = open };
                    if (punch)
                    {
                        m.Need = Punch;
                        m.Time = t + 0.15f;
                        t = m.Time + open + 0.4f;
                    }
                    else
                    {
                        m.Need = rng.Next(3);
                        m.Time = t + windup;
                        t = m.Time + 0.35f + (float)rng.NextDouble() * 0.25f;
                    }
                    moves.Add(m);
                    size[r]++;
                    if (punch) Openings++;
                }
                t += 0.9f; // a breath between rounds
            }
        }

        /// <summary>The blow being wound up or the opening that is open now (null: nothing to answer).</summary>
        public Move Coming
        {
            get
            {
                foreach (var m in moves)
                    if (m.State == 0)
                        return Clock >= (m.Need == Punch ? m.Time : m.Time - m.Windup) ? m : null;
                return null;
            }
        }

        void Judge(Move m, bool ok)
        {
            m.State = ok ? 1 : -1;
            feedback = ok ? 1 : -1;
            if (m.Need == Punch && ok)
            {
                counters[m.Round]++;
                Counters++;
            }
            if (m.Need != Punch && !ok)
            {
                hits[m.Round]++;
                HitsTaken++;
            }
            if (++judged[m.Round] < size[m.Round]) return;
            if (hits[m.Round] == 0 && counters[m.Round] > 0) Score++;
            Round = Math.Max(Round, m.Round + 1);
        }

        public void Tick(float dt)
        {
            if (Done) return;
            Clock += dt;
            ActionLeft = Math.Max(0, ActionLeft - dt);
            if (ActionLeft <= 0) Action = -1;
            foreach (var m in moves)
            {
                if (m.State != 0) continue;
                if (m.Need != Punch && Clock >= m.Time) Judge(m, Action == m.Need);
                else if (m.Need == Punch && Clock > m.Time + m.Open) Judge(m, false);
            }
        }

        /// <summary>0 dodge left, 1 guard, 2 dodge right, 3 punch; one at a time.</summary>
        public void Press(int action)
        {
            if (Done || ActionLeft > 0 || action < 0 || action > 3) return;
            Action = action;
            ActionLeft = action switch { Punch => PunchTime, Guard => GuardTime, _ => DodgeTime };
            if (action != Punch) return;
            foreach (var m in moves)
                if (m.State == 0 && m.Need == Punch && Clock >= m.Time && Clock <= m.Time + m.Open)
                {
                    Judge(m, true);
                    break;
                }
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
            if (Done || ActionLeft > 0) return;
            foreach (var m in moves)
            {
                if (m.State != 0) continue;
                if (m.Need != Punch && m.Time - Clock <= 0.2f && m.Time > Clock) Press(m.Need);
                else if (m.Need == Punch && Clock >= m.Time + 0.06f) Press(Punch);
                break;
            }
        }
    }

    // ---------- graffiti: a mural from memory ----------

    /// <summary>
    /// Mural z pamięci: a mural shows in colour for a few seconds, then only its outline stays on the wall; paint
    /// every field (in order, the background first) with the colour it had. A mural counts only as a perfect copy.
    /// Bigger murals and less time to look as it goes; painting has its own clock.
    /// </summary>
    public sealed class MuralGame : ITrainingGame
    {
        /// <summary>The murals (art: tools/world/art/training.ts MURALS, same ids and field counts).</summary>
        public static readonly (string id, int fields)[] Templates =
        {
            ("zachod", 3), ("kwiat", 4), ("gora", 4), ("twarz", 5), ("napis", 5), ("oko", 5), ("miasto", 6),
        };

        /// <summary>Spray colours; action Paints takes the last field back.</summary>
        public const int Paints = 6;
        public const int Undo = Paints;
        public const float RevealTime = 1.6f;
        static readonly int[] Sizes = { 3, 4, 4, 5, 6 };

        public enum Stage
        {
            Look,
            Paint,
            Reveal,
        }

        readonly Random rng;
        readonly HashSet<int> used = new();
        int feedback;
        public int Rounds { get; }
        public int Round { get; private set; }
        public int Score { get; private set; }
        public bool Done => Round >= Rounds;
        public Stage Phase { get; private set; }
        public float PhaseLeft { get; private set; }
        public float PhaseTime { get; private set; }
        public int Template { get; private set; }
        public int[] Target { get; private set; } = Array.Empty<int>();
        public int[] Painted { get; private set; } = Array.Empty<int>();
        /// <summary>The field the can is on.</summary>
        public int Current { get; private set; }
        public int LastMistakes { get; private set; }

        public static float LookTime(int round) => Math.Max(3f, 5f - 0.5f * round);
        public static float PaintTime(int fields) => 2.4f * fields + 2.5f;

        public MuralGame(int rounds = 5, int seed = 0)
        {
            Rounds = Math.Max(1, rounds);
            rng = new Random(seed);
            NextMural();
        }

        void NextMural()
        {
            var want = Sizes[Math.Min(Round, Sizes.Length - 1)];
            var pick = new List<int>();
            for (var i = 0; i < Templates.Length; i++)
                if (Templates[i].fields == want && !used.Contains(i)) pick.Add(i);
            if (pick.Count == 0)
                for (var i = 0; i < Templates.Length; i++)
                    if (Templates[i].fields == want) pick.Add(i);
            Template = pick[rng.Next(pick.Count)];
            used.Add(Template);
            var n = Templates[Template].fields;
            Target = new int[n];
            for (var i = 0; i < n; i++)
            {
                // never the colour of the field under it: every field must stand out
                int c;
                do c = rng.Next(Paints);
                while (i > 0 && c == Target[i - 1]);
                Target[i] = c;
            }
            Painted = new int[n];
            for (var i = 0; i < n; i++) Painted[i] = -1;
            Current = 0;
            Phase = Stage.Look;
            PhaseTime = PhaseLeft = LookTime(Round);
        }

        void Judge()
        {
            LastMistakes = 0;
            for (var i = 0; i < Target.Length; i++)
                if (Painted[i] != Target[i]) LastMistakes++;
            var hit = LastMistakes == 0;
            if (hit) Score++;
            feedback = hit ? 1 : -1;
            Phase = Stage.Reveal;
            PhaseTime = PhaseLeft = RevealTime;
        }

        public void Tick(float dt)
        {
            if (Done) return;
            PhaseLeft -= dt;
            if (PhaseLeft > 0) return;
            switch (Phase)
            {
                case Stage.Look:
                    Phase = Stage.Paint;
                    PhaseTime = PhaseLeft = PaintTime(Target.Length);
                    break;
                case Stage.Paint:
                    Judge(); // out of time: what is on the wall is judged
                    break;
                default:
                    Round++;
                    if (!Done) NextMural();
                    break;
            }
        }

        /// <summary>0..5 sprays the field with that colour, 6 takes the last one back.</summary>
        public void Press(int action)
        {
            if (Done || Phase != Stage.Paint) return;
            if (action == Undo)
            {
                if (Current > 0) Painted[--Current] = -1;
                return;
            }
            if (action < 0 || action >= Paints) return;
            Painted[Current++] = action;
            if (Current >= Target.Length) Judge();
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
            if (Done || Phase != Stage.Paint || botWait > 0) return;
            Press(Target[Current]);
            botWait = 0.22f;
        }
    }

    // ---------- surfing: the shark ----------

    /// <summary>
    /// Rekin: the bud rides the board across five lanes, fins come at it; slide left or right out of their way.
    /// The first fin of every wave heads for the bud's lane, later hunters turn one lane towards it shortly before
    /// they reach it. A wave counts when no shark bites. More fins, closer together, more hunters as it goes.
    /// </summary>
    public sealed class SharkGame : ITrainingGame
    {
        public const int Lanes = 5;
        /// <summary>Seconds a fin is in view before it reaches the board.</summary>
        public const float Lead = 1.8f;
        /// <summary>A hunter turns this long before it arrives.</summary>
        public const float TurnAt = 0.8f;

        public sealed class Shark
        {
            public float Time;
            /// <summary>-1 until it shows up.</summary>
            public int Lane = -1;
            /// <summary>The lane it came from when it turned.</summary>
            public int From = -1;
            public bool First;
            public bool Hunter;
            public bool Turned;
            public int Wave;
            /// <summary>0 coming, 1 dodged, -1 bit.</summary>
            public int State;
        }

        readonly Random rng;
        readonly List<Shark> sharks = new();
        readonly int[] size;
        readonly int[] judged;
        readonly int[] bites;
        int feedback;
        public int Rounds { get; }
        public int Round { get; private set; }
        public int Score { get; private set; }
        public bool Done => Round >= Rounds;
        public float Clock { get; private set; }
        public int Lane { get; private set; } = Lanes / 2;
        public IReadOnlyList<Shark> Sharks => sharks;

        public SharkGame(int rounds = 5, int seed = 0)
        {
            Rounds = Math.Max(1, rounds);
            rng = new Random(seed);
            size = new int[Rounds];
            judged = new int[Rounds];
            bites = new int[Rounds];
            var t = Lead + 0.8f;
            for (var w = 0; w < Rounds; w++)
            {
                var count = 3 + w / 2;
                var gap = Math.Max(0.62f, 1.05f - 0.08f * w);
                for (var i = 0; i < count; i++)
                {
                    sharks.Add(new Shark
                    {
                        Time = t,
                        Wave = w,
                        First = i == 0,
                        Hunter = w >= 1 && i > 0 && rng.NextDouble() < 0.25 + 0.1 * w,
                    });
                    size[w]++;
                    t += gap + (float)rng.NextDouble() * 0.25f;
                }
                t += 1.2f;
            }
        }

        public void Tick(float dt)
        {
            if (Done) return;
            Clock += dt;
            foreach (var s in sharks)
            {
                if (s.State != 0) continue;
                if (s.Lane < 0 && Clock >= s.Time - Lead)
                {
                    // it picks its lane as it shows up: the first of a wave heads straight for the bud
                    s.Lane = s.First || rng.Next(3) == 0 ? Lane : rng.Next(Lanes);
                    s.From = s.Lane;
                }
                if (s.Lane >= 0 && s.Hunter && !s.Turned && Clock >= s.Time - TurnAt)
                {
                    s.Turned = true;
                    s.From = s.Lane;
                    if (Lane != s.Lane) s.Lane += Math.Sign(Lane - s.Lane);
                }
                if (Clock < s.Time) continue;
                var bit = s.Lane == Lane;
                s.State = bit ? -1 : 1;
                feedback = bit ? -1 : 1;
                if (bit) bites[s.Wave]++;
                if (++judged[s.Wave] < size[s.Wave]) continue;
                if (bites[s.Wave] == 0) Score++;
                Round = Math.Max(Round, s.Wave + 1);
            }
        }

        /// <summary>0 one lane left, 1 one lane right.</summary>
        public void Press(int action)
        {
            if (Done) return;
            if (action == 0) Lane = Math.Max(0, Lane - 1);
            else if (action == 1) Lane = Math.Min(Lanes - 1, Lane + 1);
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

        bool Threat(int lane, float within)
        {
            foreach (var s in sharks)
                if (s.State == 0 && s.Lane == lane && s.Time > Clock && s.Time - Clock <= within)
                    return true;
            return false;
        }

        public void Bot(float dt)
        {
            Tick(dt);
            if (Done || !Threat(Lane, 0.3f)) return;
            // out of the way, into a lane nothing reaches soon
            var left = Lane > 0 && !Threat(Lane - 1, 0.7f);
            var right = Lane < Lanes - 1 && !Threat(Lane + 1, 0.7f);
            Press(left && (!right || Lane > Lanes / 2) ? 0 : right ? 1 : Lane > 0 ? 0 : 1);
        }
    }

    // ---------- spryt: the cups ----------

    /// <summary>
    /// Trzy kubki: a street hustler shows the ball under a cup and shuffles; point at the cup with the ball. More
    /// swaps, quicker, and a fourth cup later on. A round with no pick in time is lost.
    /// </summary>
    public sealed class ShellGame : ITrainingGame
    {
        public const float ShowTime = 1.2f;
        public const float PickTime = 6f;
        public const float RevealTime = 1.3f;

        public enum Stage
        {
            Show,
            Shuffle,
            Pick,
            Reveal,
        }

        readonly Random rng;
        int feedback;
        public int Rounds { get; }
        public int Round { get; private set; }
        public int Score { get; private set; }
        public bool Done => Round >= Rounds;
        public Stage Phase { get; private set; }
        public float PhaseLeft { get; private set; }
        public int Cups { get; private set; }
        /// <summary>Where every cup stands (cup → slot).</summary>
        public int[] SlotOf { get; } = new int[4];
        /// <summary>The cup with the ball.</summary>
        public int Ball { get; private set; }
        /// <summary>The swaps of this round as pairs of slots.</summary>
        public (int a, int b)[] Swaps { get; private set; } = Array.Empty<(int, int)>();
        public int SwapIndex { get; private set; }
        /// <summary>0..1 through the swap under way.</summary>
        public float SwapProgress { get; private set; }
        public float SwapTime { get; private set; }
        /// <summary>The slot picked last (-1 none: time ran out).</summary>
        public int Picked { get; private set; } = -1;
        public bool LastHit { get; private set; }

        public ShellGame(int rounds = 5, int seed = 0)
        {
            Rounds = Math.Max(1, rounds);
            rng = new Random(seed);
            NextRound();
        }

        public int CupAt(int slot)
        {
            for (var c = 0; c < Cups; c++)
                if (SlotOf[c] == slot) return c;
            return -1;
        }

        void NextRound()
        {
            Cups = Round < 3 ? 3 : 4;
            for (var c = 0; c < SlotOf.Length; c++) SlotOf[c] = c;
            Ball = rng.Next(Cups);
            Swaps = new (int, int)[3 + 2 * Round];
            for (var i = 0; i < Swaps.Length; i++)
            {
                var a = rng.Next(Cups);
                var b = (a + 1 + rng.Next(Cups - 1)) % Cups;
                Swaps[i] = (a, b);
            }
            SwapTime = Math.Max(0.24f, 0.52f - 0.07f * Round);
            SwapIndex = 0;
            SwapProgress = 0;
            Picked = -1;
            Phase = Stage.Show;
            PhaseLeft = ShowTime;
        }

        public void Tick(float dt)
        {
            if (Done) return;
            switch (Phase)
            {
                case Stage.Show:
                    PhaseLeft -= dt;
                    if (PhaseLeft <= 0) Phase = Stage.Shuffle;
                    break;
                case Stage.Shuffle:
                    SwapProgress += dt / SwapTime;
                    while (SwapProgress >= 1 && SwapIndex < Swaps.Length)
                    {
                        var (a, b) = Swaps[SwapIndex];
                        int ca = CupAt(a), cb = CupAt(b);
                        SlotOf[ca] = b;
                        SlotOf[cb] = a;
                        SwapIndex++;
                        SwapProgress -= 1;
                    }
                    if (SwapIndex >= Swaps.Length)
                    {
                        SwapProgress = 0;
                        Phase = Stage.Pick;
                        PhaseLeft = PickTime;
                    }
                    break;
                case Stage.Pick:
                    PhaseLeft -= dt;
                    if (PhaseLeft <= 0) Judge(-1);
                    break;
                default:
                    PhaseLeft -= dt;
                    if (PhaseLeft > 0) break;
                    Round++;
                    if (!Done) NextRound();
                    break;
            }
        }

        void Judge(int slot)
        {
            Picked = slot;
            LastHit = slot >= 0 && CupAt(slot) == Ball;
            if (LastHit) Score++;
            feedback = LastHit ? 1 : -1;
            Phase = Stage.Reveal;
            PhaseLeft = RevealTime;
        }

        /// <summary>Points at the cup in that slot (0 = leftmost).</summary>
        public void Press(int action)
        {
            if (!Done && Phase == Stage.Pick && action >= 0 && action < Cups) Judge(action);
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
            if (!Done && Phase == Stage.Pick) Press(SlotOf[Ball]);
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
