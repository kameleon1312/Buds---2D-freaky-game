using UnityEngine;

namespace Buds.Characters
{
    /// <summary>
    /// A walk that reads as walking, not gliding (plain math, EditMode-testable). The legs follow the ground: the
    /// cycle advances with the distance covered, one step per <see cref="StepLength"/>, so the feet never slide;
    /// steps get longer, not just faster, when running. The body rises as the legs pass under it and dips a little as
    /// a foot lands; moving off starts with a step, and stopping brings the feet together instead of freezing
    /// mid-stride. Frames are the sheet's walk frames: 0 = feet together, 1 and 2 = left and right foot forward.
    /// </summary>
    public sealed class WalkCycle
    {
        /// <summary>Contact, passing, contact, passing: the order the sheet's frames are played in.</summary>
        static readonly int[] Frames = { 1, 0, 2, 0 };

        /// <summary>Below this speed (tiles/s) the bud counts as standing.</summary>
        public const float StandSpeed = 0.2f;

        readonly float walkSpeed;
        readonly float runSpeed;
        readonly float walkStep;
        readonly float runStep;
        readonly float bob;

        /// <summary>Position in the cycle: 0..4, one unit per frame (two per step).</summary>
        float phase;
        float settle;

        public int Frame { get; private set; }
        /// <summary>How high the body sits above the feet now (world units).</summary>
        public float Lift { get; private set; }
        /// <summary>Vertical squash (1 = none), a little under 1 just as a foot lands.</summary>
        public float Squash { get; private set; } = 1;
        public bool Walking { get; private set; }
        /// <summary>True on the frame a foot touches down (dust, footprints).</summary>
        public bool Landed { get; private set; }

        /// <param name="walkStep">Ground covered by one step at walking speed (tiles).</param>
        /// <param name="runStep">Ground covered by one step at running speed (tiles).</param>
        /// <param name="bob">How far the body rises between steps (world units).</param>
        public WalkCycle(float walkSpeed, float runSpeed, float walkStep, float runStep, float bob)
        {
            this.walkSpeed = walkSpeed;
            this.runSpeed = runSpeed;
            this.walkStep = walkStep;
            this.runStep = runStep;
            this.bob = bob;
        }

        /// <summary>Length of one step at this speed: a stroll takes short steps, a sprint long ones.</summary>
        public float StepLength(float speed)
        {
            return speed <= walkSpeed
                ? Mathf.Lerp(walkStep * 0.8f, walkStep, speed / walkSpeed)
                : Mathf.Lerp(walkStep, runStep, Mathf.InverseLerp(walkSpeed, runSpeed, speed));
        }

        /// <summary>Advance by one frame of movement at <paramref name="speed"/> tiles/s.</summary>
        public void Tick(float speed, float dt)
        {
            Landed = false;
            if (speed > StandSpeed)
            {
                if (!Walking)
                {
                    // the first thing a bud does when it moves off is put a foot forward
                    phase = 0;
                    Walking = true;
                    Landed = true;
                }
                var before = phase;
                // two frames per step
                phase += speed * dt / (StepLength(speed) * 0.5f);
                if (Mathf.FloorToInt(before) / 2 != Mathf.FloorToInt(phase) / 2) Landed = true;
                phase %= Frames.Length;
                Frame = Frames[Mathf.FloorToInt(phase) % Frames.Length];

                // within a step: u = 0 a foot lands, u = 1 the next one is about to
                var u = (phase % 2) / 2f;
                var running = Mathf.InverseLerp(walkSpeed, runSpeed, speed);
                Lift = bob * (1 + running * 0.8f) * Mathf.Sin(u * Mathf.PI);
                Squash = 1 - (1 - Smooth(Mathf.Clamp01(u / 0.18f))) * (0.035f + running * 0.02f);
                settle = 0.1f;
                return;
            }

            // stopping: one quick settle with the feet together, then stand still
            Walking = false;
            if (settle > 0)
            {
                settle -= dt;
                Frame = 0;
                var k = Mathf.Clamp01(settle / 0.1f);
                Lift *= k;
                Squash = 1 - 0.03f * Mathf.Sin(k * Mathf.PI);
                return;
            }
            Frame = 0;
            Lift = 0;
            Squash = 1;
        }

        /// <summary>Back to standing at once (teleports, doors, cut scenes).</summary>
        public void Reset()
        {
            phase = 0;
            settle = 0;
            Walking = false;
            Frame = 0;
            Lift = 0;
            Squash = 1;
            Landed = false;
        }

        static float Smooth(float t) => t * t * (3 - 2 * t);
    }
}
