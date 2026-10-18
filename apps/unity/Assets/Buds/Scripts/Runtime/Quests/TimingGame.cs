using System;

namespace Buds.Quests
{
    /// <summary>
    /// Skupienie (Spryt's training, ITrainingGame): a marker sweeps a bar back and forth, the player stops it inside the
    /// green zone. Five rounds; every round the zone shrinks and the marker speeds up. The score (hits) goes to the
    /// server, which turns it into training XP.
    /// </summary>
    public sealed class TimingGame : ITrainingGame
    {
        public const float StartWidth = 0.26f;
        public const float WidthStep = 0.03f;
        public const float StartSpeed = 0.85f; // bar lengths per second
        public const float SpeedStep = 0.18f;

        readonly Random rng;
        int dir = 1;
        int feedback;

        public int Rounds { get; }
        public int Round { get; private set; }
        public int Score { get; private set; }
        /// <summary>Marker position on the bar, 0..1.</summary>
        public float Marker { get; private set; }
        public float ZoneCenter { get; private set; }
        public float ZoneWidth { get; private set; }
        public float Speed { get; private set; }
        public bool Done => Round >= Rounds;
        /// <summary>Whether the last press hit the zone.</summary>
        public bool LastHit { get; private set; }

        public TimingGame(int rounds = 5, int seed = 0)
        {
            Rounds = Math.Max(1, rounds);
            rng = new Random(seed);
            NextZone();
        }

        public float ZoneMin => ZoneCenter - ZoneWidth / 2;
        public float ZoneMax => ZoneCenter + ZoneWidth / 2;

        public void Tick(float dt)
        {
            if (Done) return;
            dt = Math.Min(dt, 0.1f); // back from the background: no giant jump
            Marker += dir * Speed * dt;
            // bounce off the ends
            while (Marker > 1 || Marker < 0)
            {
                if (Marker > 1)
                {
                    Marker = 2 - Marker;
                    dir = -1;
                }
                if (Marker < 0)
                {
                    Marker = -Marker;
                    dir = 1;
                }
            }
        }

        /// <summary>Stops the marker: a hit if it is inside the zone. Returns whether it hit.</summary>
        public bool Press()
        {
            if (Done) return false;
            LastHit = Marker >= ZoneMin && Marker <= ZoneMax;
            if (LastHit) Score++;
            feedback = LastHit ? 1 : -1;
            Round++;
            if (!Done) NextZone();
            return LastHit;
        }

        void NextZone()
        {
            ZoneWidth = Math.Max(0.08f, StartWidth - WidthStep * Round);
            Speed = StartSpeed + SpeedStep * Round;
            ZoneCenter = 0.2f + (float)rng.NextDouble() * 0.6f;
        }

        void ITrainingGame.Press(int action) => Press();

        public void Release(int action)
        {
        }

        public int TakeFeedback()
        {
            var f = feedback;
            feedback = 0;
            return f;
        }

        /// <summary>Stops the marker as soon as it is well inside the zone.</summary>
        public void Bot(float dt)
        {
            Tick(dt);
            if (!Done && Math.Abs(Marker - ZoneCenter) < ZoneWidth * 0.2f) Press();
        }

        /// <summary>Puts the marker somewhere (tests and the autopilot).</summary>
        public void SetMarker(float value) => Marker = Math.Clamp(value, 0, 1);
    }
}
