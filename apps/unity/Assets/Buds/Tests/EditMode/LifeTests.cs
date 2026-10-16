using Buds.Characters;
using Buds.Quests;
using NUnit.Framework;
using UnityEngine;

namespace Buds.Tests
{
    public class WalkCycleTests
    {
        static WalkCycle Bud() => new(BudMotor.WalkSpeed, BudMotor.RunSpeed, 0.95f, 1.35f, 0.035f);

        /// <summary>Walks `distance` tiles at `speed` in small frames; returns how many steps landed.</summary>
        static int Steps(WalkCycle w, float speed, float distance)
        {
            var landed = 0;
            const float dt = 1 / 60f;
            for (var d = 0f; d < distance; d += speed * dt)
            {
                w.Tick(speed, dt);
                if (w.Landed) landed++;
            }
            return landed;
        }

        [Test]
        public void FeetFollowTheGroundInsteadOfSliding()
        {
            // ten tiles at walking pace take about ten steps (a step is just under a tile), not four
            var steps = Steps(Bud(), BudMotor.WalkSpeed, 10);
            Assert.That(steps, Is.InRange(10, 13));
        }

        [Test]
        public void RunningTakesLongerStepsNotJustFasterOnes()
        {
            var walk = Bud();
            Assert.Greater(walk.StepLength(BudMotor.RunSpeed), walk.StepLength(BudMotor.WalkSpeed) * 1.25f);
            Assert.Less(Steps(Bud(), BudMotor.RunSpeed, 10), Steps(Bud(), BudMotor.WalkSpeed, 10));
        }

        [Test]
        public void MovingOffStartsWithAStepAndStoppingBringsTheFeetTogether()
        {
            var w = Bud();
            w.Tick(BudMotor.WalkSpeed, 1 / 60f);
            Assert.IsTrue(w.Landed, "the first move is a step");
            Assert.AreNotEqual(0, w.Frame, "a foot forward, not standing");
            for (var i = 0; i < 10; i++) w.Tick(BudMotor.WalkSpeed, 1 / 60f);
            for (var i = 0; i < 20; i++) w.Tick(0, 1 / 60f);
            Assert.AreEqual(0, w.Frame);
            Assert.AreEqual(0, w.Lift, 1e-4);
            Assert.AreEqual(1, w.Squash, 1e-4);
        }

        [Test]
        public void BodyIsHighestBetweenStepsAndLowestAsAFootLands()
        {
            var w = Bud();
            float atContact = float.MaxValue, highest = 0;
            for (var i = 0; i < 120; i++)
            {
                w.Tick(BudMotor.WalkSpeed, 1 / 60f);
                if (w.Landed) atContact = Mathf.Min(atContact, w.Lift);
                highest = Mathf.Max(highest, w.Lift);
            }
            Assert.Greater(highest, 0.02f);
            Assert.Less(atContact, highest * 0.5f);
        }
    }

    public class NpcWanderTests
    {
        /// <summary>An open yard 20×20 with a wall column at x = 12.</summary>
        static bool Yard(Vector2 p) => p.x > 0 && p.y > 0 && p.x < 20 && p.y < 20 && !(p.x >= 12 && p.x < 13);

        [Test]
        public void StrollsButNeverLeavesItsPatchOrWalksThroughWalls()
        {
            var home = new Vector2(10, 10);
            var w = new NpcWander(home, 3, Yard, 42);
            var pos = home;
            var moved = 0f;
            const float dt = 1 / 30f;
            for (var i = 0; i < 30 * 120; i++)
            {
                var v = w.Tick(dt, pos, null, false);
                var next = pos + v * dt;
                Assert.IsTrue(Yard(next), $"walked into a wall at {next}");
                moved += (next - pos).magnitude;
                pos = next;
                Assert.LessOrEqual(Vector2.Distance(pos, home), 3.05f, "left its patch");
                Assert.LessOrEqual(v.magnitude, NpcWander.Speed + 1e-4);
            }
            Assert.Greater(moved, 10, "in two minutes it goes for a few strolls");
        }

        [Test]
        public void StopsAndLooksAtThePlayerWhoComesClose()
        {
            var home = new Vector2(10, 10);
            var w = new NpcWander(home, 3, Yard, 7);
            var pos = home;
            // let it set off
            for (var i = 0; i < 30 * 8 && w.Target == null; i++) w.Tick(1 / 30f, pos, null, false);
            var player = pos + new Vector2(-1.5f, 0);
            var v = w.Tick(1 / 30f, pos, player, false);
            Assert.AreEqual(Vector2.zero, v);
            Assert.Less(w.Look.x, 0, "turns towards the player");
            Assert.AreEqual(Vector2.zero, w.Tick(1 / 30f, pos, null, true), "stands still while talking");
        }

        [Test]
        public void SameSeedSameStroll()
        {
            Vector2 Run(int seed)
            {
                var w = new NpcWander(new Vector2(10, 10), 3, Yard, seed);
                var p = new Vector2(10, 10);
                for (var i = 0; i < 600; i++) p += w.Tick(1 / 30f, p, null, false) / 30f;
                return p;
            }
            Assert.AreEqual(Run(5), Run(5));
        }
    }
}
