using System;
using UnityEngine;

namespace Buds.Characters
{
    /// <summary>
    /// How a bud moves, as plain math (EditMode-testable): up, down, left or right like a classic top-down RPG (a
    /// diagonal push keeps the axis it started on until the other clearly wins), speeding up and slowing down quickly
    /// instead of snapping, slower on a half-pushed stick, running, and slipping around the corners of walls it would
    /// otherwise snag on.
    /// </summary>
    public sealed class BudMotor
    {
        public const float WalkSpeed = 3.8f; // tiles per second: a brisk walk for a bud two tiles tall
        public const float RunSpeed = 6.2f;
        /// <summary>Tiles/s²: full walking speed in about an eighth of a second (a step to get going, not a snap).</summary>
        public const float Acceleration = 30f;
        /// <summary>Stopping and turning around are a bit snappier than starting.</summary>
        public const float Braking = 45f;
        /// <summary>The other axis has to win by this factor before the facing flips, so diagonals don't flicker.</summary>
        public const float FacingBias = 1.3f;
        /// <summary>How far (tiles) the bud is nudged sideways around a corner it pushes against.</summary>
        public const float CornerReach = 0.45f;

        /// <summary>The other axis has to be this much stronger before a diagonal push changes the walking axis.</summary>
        public const float AxisBias = 1.25f;

        /// <summary>0 = standing, 1 = walking along x, 2 = along y.</summary>
        int axis;

        /// <summary>
        /// The stick or keys turned into one of four directions, keeping its strength. Pushing diagonally keeps the axis
        /// the bud already walks on until the other one wins by <see cref="AxisBias"/>, so it never zig-zags.
        /// </summary>
        public Vector2 FourWay(Vector2 input)
        {
            var ax = Mathf.Abs(input.x);
            var ay = Mathf.Abs(input.y);
            if (ax < 0.01f && ay < 0.01f)
            {
                axis = 0;
                return Vector2.zero;
            }
            axis = axis switch
            {
                1 => ay > ax * AxisBias ? 2 : 1,
                2 => ax > ay * AxisBias ? 1 : 2,
                _ => ax >= ay ? 1 : 2,
            };
            var strength = Mathf.Min(1, input.magnitude);
            return axis == 1 ? new Vector2(Mathf.Sign(input.x) * strength, 0) : new Vector2(0, Mathf.Sign(input.y) * strength);
        }

        public Vector2 Velocity { get; private set; }
        /// <summary>Speed from gear (1.1 = +10%).</summary>
        public float SpeedMultiplier { get; set; } = 1;
        public Facing Facing { get; private set; } = Facing.Down;
        /// <summary>Side frames face left; true = mirror them to face right.</summary>
        public bool FacingRight { get; private set; }

        /// <summary>
        /// Velocity for one physics step. <paramref name="input"/> is the stick (magnitude 0..1), <paramref name="actual"/>
        /// what the physics let the body do last step (walls), so speed lost against a wall isn't kept.
        /// </summary>
        public Vector2 Step(Vector2 input, bool run, float dt, Vector2? actual = null)
        {
            // a broken number from the physics (or a broken speed) never sticks: the bud starts again from rest
            if (!Finite(Velocity)) Velocity = Vector2.zero;
            if (actual.HasValue && Finite(actual.Value) && actual.Value.sqrMagnitude < Velocity.sqrMagnitude) Velocity = actual.Value;
            if (!float.IsFinite(SpeedMultiplier) || SpeedMultiplier <= 0) SpeedMultiplier = 1;
            var target = Vector2.ClampMagnitude(input, 1) * ((run ? RunSpeed : WalkSpeed) * SpeedMultiplier);
            var slowing = target.sqrMagnitude < Velocity.sqrMagnitude || Vector2.Dot(target, Velocity) < 0;
            Velocity = Vector2.MoveTowards(Velocity, target, (slowing ? Braking : Acceleration) * dt);
            return Velocity;
        }

        public void Stop() => Velocity = Vector2.zero;

        static bool Finite(Vector2 v) => float.IsFinite(v.x) && float.IsFinite(v.y);

        /// <summary>Turns towards the input; <paramref name="fresh"/> = just started moving (take the main axis at once).</summary>
        public void Face(Vector2 dir, bool fresh)
        {
            var ax = Mathf.Abs(dir.x);
            var ay = Mathf.Abs(dir.y);
            if (ax < 0.01f && ay < 0.01f) return;
            bool side;
            if (fresh) side = ax > ay;
            else if (Facing == Facing.Side) side = ay <= ax * FacingBias;
            else side = ax > ay * FacingBias;

            if (side)
            {
                Facing = Facing.Side;
                if (ax > 0.01f) FacingRight = dir.x > 0;
            }
            else if (ay > 0.01f)
            {
                Facing = dir.y > 0 ? Facing.Up : Facing.Down;
            }
        }

        /// <summary>
        /// Corner assist: when the bud pushes straight into a wall but a gap starts within <see cref="CornerReach"/>
        /// to one side (a door, a path between two trees), it is steered sideways into the gap instead of stopping.
        /// </summary>
        /// <param name="centre">Centre of the feet box, world units (y up).</param>
        /// <param name="half">Half size of the feet box.</param>
        /// <param name="blocked">Is world cell (x, y) solid?</param>
        public static Vector2 AroundCorners(Vector2 input, Vector2 centre, Vector2 half, Func<int, int, bool> blocked)
        {
            var ax = Mathf.Abs(input.x);
            var ay = Mathf.Abs(input.y);
            if (ax < 0.1f && ay < 0.1f) return input;
            if (ax > ay * 3) return Slip(input, centre, half, blocked);
            if (ay > ax * 3)
            {
                // same thing with the axes swapped
                var swapped = Slip(new Vector2(input.y, input.x), new Vector2(centre.y, centre.x), new Vector2(half.y, half.x),
                    (a, b) => blocked(b, a));
                return new Vector2(swapped.y, swapped.x);
            }
            return input; // diagonals already slide along walls
        }

        /// <summary>Horizontal push: look one column ahead and slip up or down into the nearest free row.</summary>
        static Vector2 Slip(Vector2 input, Vector2 centre, Vector2 half, Func<int, int, bool> blocked)
        {
            var s = Mathf.Sign(input.x);
            var ahead = Mathf.FloorToInt(centre.x + s * (half.x + 0.05f));
            var bottom = Mathf.FloorToInt(centre.y - half.y + 0.001f);
            var top = Mathf.FloorToInt(centre.y + half.y - 0.001f);
            var free = true;
            for (var r = bottom; r <= top; r++)
                if (blocked(ahead, r)) free = false;
            if (free) return input;

            var col0 = Mathf.FloorToInt(centre.x - half.x + 0.001f);
            var col1 = Mathf.FloorToInt(centre.x + half.x - 0.001f);
            bool RowOpen(int row)
            {
                if (blocked(ahead, row)) return false;
                for (var c = col0; c <= col1; c++)
                    if (blocked(c, row)) return false; // nowhere to slip if the bud's own column is walled too
                return true;
            }

            var best = 0f;
            var bestShift = float.MaxValue;
            for (var row = bottom - 1; row <= top + 1; row++)
            {
                if (!RowOpen(row)) continue;
                // move the box fully into this row
                var shift = centre.y - half.y < row ? row + half.y - centre.y
                    : centre.y + half.y > row + 1 ? row + 1 - half.y - centre.y
                    : 0;
                if (Mathf.Abs(shift) < Mathf.Abs(bestShift))
                {
                    bestShift = shift;
                    best = Mathf.Sign(shift);
                }
            }
            if (bestShift == float.MaxValue || Mathf.Abs(bestShift) > CornerReach || best == 0) return input;
            var speed = input.magnitude;
            return new Vector2(s * 0.35f, best).normalized * speed;
        }
    }
}
