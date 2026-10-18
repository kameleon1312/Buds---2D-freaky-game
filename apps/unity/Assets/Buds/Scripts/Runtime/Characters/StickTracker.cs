using System.Collections.Generic;
using UnityEngine;

namespace Buds.Characters
{
    /// <summary>One finger on the screen this frame, as the stick needs it.</summary>
    public struct TouchSample
    {
        public int Id;
        public bool Pressed;
        public bool Began;
        public Vector2 Position;
        /// <summary>Where the finger first touched the screen.</summary>
        public Vector2 Start;
    }

    /// <summary>
    /// Which finger steers the fixed phone stick (plain class, EditMode-testable). The finger is kept only while a
    /// touch with its id is pressed this very frame: a release the game never saw (a dropped frame, a touch the system
    /// cancelled, or a quick re-tap that reused the same touch slot with a new id) frees the stick at once instead of
    /// holding it for ever. A finger that started on the stick takes it over, even if its first frame was missed.
    /// </summary>
    public sealed class StickTracker
    {
        /// <summary>How far from the centre (× radius) a touch may start and still take the stick.</summary>
        public const float GrabReach = 1.5f;

        public int Finger { get; private set; } = -1;
        public bool Active => Finger >= 0;
        public Vector2 Position { get; private set; }

        public void Step(IReadOnlyList<TouchSample> touches, Vector2 center, float radius)
        {
            var kept = false;
            if (Finger >= 0)
                foreach (var t in touches)
                    if (t.Id == Finger && t.Pressed)
                    {
                        kept = true;
                        Position = t.Position;
                        break;
                    }
            if (!kept) Finger = -1;
            if (Finger >= 0) return;
            var reach = radius * GrabReach;
            foreach (var t in touches)
            {
                if (!t.Pressed || t.Id == 0) continue;
                var startedHere = Vector2.Distance(t.Start, center) <= reach;
                var landsHere = t.Began && Vector2.Distance(t.Position, center) <= reach;
                if (!startedHere && !landsHere) continue;
                Finger = t.Id;
                Position = t.Position;
                return;
            }
        }

        /// <summary>The app lost focus or paused: no finger is on the stick any more.</summary>
        public void Release() => Finger = -1;
    }
}
