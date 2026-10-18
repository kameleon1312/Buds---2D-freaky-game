using System;
using UnityEngine;

namespace Buds.Quests
{
    /// <summary>
    /// How a side NPC potters about (plain math, EditMode-testable): it stands a while, looks around, then strolls to
    /// another free spot within <see cref="Radius"/> tiles of home along a clear straight line, and stands again.
    /// It never leaves its patch, never walks through anything solid, and stops and turns to the player who comes
    /// close or talks to it. Deterministic for a seed, so the same NPC behaves the same way in tests.
    /// </summary>
    public sealed class NpcWander
    {
        /// <summary>Strolling pace (tiles/s): well under the bud's walk.</summary>
        public const float Speed = 1.5f;
        /// <summary>The player this close (tiles) makes the NPC stop and look at them.</summary>
        public const float NoticeRange = 2.4f;
        const float Arrive = 0.08f;

        public readonly Vector2 Home;
        public readonly float Radius;
        readonly Func<Vector2, bool> walkable;
        readonly System.Random random;

        Vector2? target;
        float wait;
        float lookTimer;

        /// <summary>Which way the NPC looks while standing (set when it looks around).</summary>
        public Vector2 Look { get; private set; } = Vector2.down;
        /// <summary>The walk target, or null while standing.</summary>
        public Vector2? Target => target;

        /// <param name="home">Where the NPC belongs (world units, feet).</param>
        /// <param name="walkable">Can feet stand at this world position?</param>
        public NpcWander(Vector2 home, float radius, Func<Vector2, bool> walkable, int seed)
        {
            Home = home;
            Radius = radius;
            this.walkable = walkable;
            random = new System.Random(seed);
            wait = 1 + (float)random.NextDouble() * 3; // they don't all set off at once
            lookTimer = 1.5f;
        }

        /// <summary>
        /// One frame: returns the velocity to move with (zero while standing). <paramref name="player"/> is the
        /// player's feet; <paramref name="busy"/> = talking or a dialog is open (stand still).
        /// </summary>
        public Vector2 Tick(float dt, Vector2 position, Vector2? player, bool busy)
        {
            if (busy || (player.HasValue && Vector2.Distance(player.Value, position) < NoticeRange))
            {
                // someone's here: stop, and pick the stroll up again a little after they've gone
                target = null;
                wait = Mathf.Max(wait, 1.2f);
                if (player.HasValue) Look = player.Value - position;
                return Vector2.zero;
            }

            if (target is { } t)
            {
                var to = t - position;
                if (to.magnitude <= Arrive)
                {
                    target = null;
                    wait = 2 + (float)random.NextDouble() * 4;
                    lookTimer = 0.8f + (float)random.NextDouble() * 1.5f;
                    return Vector2.zero;
                }
                var step = to.normalized * Speed;
                // the way ahead got blocked (the player stepped in): give up and stand
                if (!walkable(position + to.normalized * 0.35f))
                {
                    target = null;
                    wait = 1.5f;
                    return Vector2.zero;
                }
                Look = to;
                return step;
            }

            wait -= dt;
            lookTimer -= dt;
            if (lookTimer <= 0)
            {
                // standing about: glance one way, then another
                Vector2[] looks = { Vector2.down, Vector2.left, Vector2.right, Vector2.up, Vector2.down };
                Look = looks[random.Next(looks.Length)];
                lookTimer = 1.2f + (float)random.NextDouble() * 2;
            }
            if (wait <= 0)
            {
                target = PickSpot(position);
                wait = target == null ? 1.5f : 0;
            }
            return Vector2.zero;
        }

        static readonly Vector2[] Axes = { Vector2.left, Vector2.right, Vector2.up, Vector2.down };

        /// <summary>
        /// A free spot inside the patch, straight up, down, left or right of the NPC (people walk like the player: along
        /// one axis at a time), reachable in a straight line, at least a tile away. Spots that lead home come first.
        /// </summary>
        Vector2? PickSpot(Vector2 from)
        {
            for (var attempt = 0; attempt < 12; attempt++)
            {
                var dir = Axes[random.Next(Axes.Length)];
                // far from home: step back towards it
                if (attempt < 4 && Vector2.Distance(from, Home) > Radius * 0.6f)
                {
                    var back = Home - from;
                    dir = Mathf.Abs(back.x) > Mathf.Abs(back.y) ? new Vector2(Mathf.Sign(back.x), 0) : new Vector2(0, Mathf.Sign(back.y));
                }
                var dist = Mathf.Lerp(1f, Radius, (float)random.NextDouble());
                var spot = from + dir * dist;
                if (Vector2.Distance(spot, Home) > Radius) continue;
                if (ClearLine(from, spot)) return spot;
            }
            return null;
        }

        bool ClearLine(Vector2 a, Vector2 b)
        {
            var steps = Mathf.CeilToInt(Vector2.Distance(a, b) / 0.25f);
            for (var i = 1; i <= steps; i++)
                if (!walkable(Vector2.Lerp(a, b, i / (float)steps)))
                    return false;
            return true;
        }
    }
}
