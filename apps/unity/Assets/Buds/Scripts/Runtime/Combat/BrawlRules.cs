using System.Collections.Generic;
using Buds.Api;
using UnityEngine;

namespace Buds.Combat
{
    /// <summary>
    /// The bud's own side of a fight (docs/walka.md) as plain code: its five buttons, when each is ready again, its
    /// health and holds, as the server last said (`you`) plus what the game already knows from its own presses (a
    /// pressed button greys out at once; the server's word corrects it). EditMode-testable.
    /// </summary>
    public sealed class BrawlSelf
    {
        public const int Slots = 5;
        public const int Basic = 0;
        public const int Guard = 3;
        public const int Ultimate = 4;
        /// <summary>The least time between two presses (brawl.ts GLOBAL_COOLDOWN_MS).</summary>
        public const float GlobalCooldown = 0.22f;

        public readonly KitEntryDto[] Kit = new KitEntryDto[Slots];
        readonly float[] readyAt = new float[Slots];
        float lastPress = -99;

        public int Hp { get; private set; }
        public int MaxHp { get; private set; }
        public int Shield { get; private set; }
        public float DownUntil { get; private set; }
        public float GuardUntil { get; private set; }
        public float StunUntil { get; private set; }
        /// <summary>Can fight other buds where it stands (level 6+ and outside the safe zones).</summary>
        public bool Open { get; private set; }
        /// <summary>The kit came from the server at least once: the buttons can show.</summary>
        public bool Armed { get; private set; }
        /// <summary>The last forced move (dash, knockback, getting up) applied here; sent back with every move.</summary>
        public int Forced { get; set; }

        public bool Down(float now) => now < DownUntil;
        public bool Stunned(float now) => now < StunUntil;
        public float Health01 => MaxHp > 0 ? Mathf.Clamp01((float)Hp / MaxHp) : 1;

        /// <summary>The server's `you`: health, holds, cooldowns (ms left) and, when it changed, the kit.</summary>
        public void Apply(LiveIn you, float now)
        {
            Hp = you.hp;
            MaxHp = you.mhp;
            Shield = you.sh;
            DownUntil = you.ko > 0 ? now + you.ko / 1000f : 0;
            GuardUntil = you.guard > 0 ? now + you.guard / 1000f : 0;
            StunUntil = you.stun > 0 ? now + you.stun / 1000f : 0;
            Open = you.open;
            if (you.kit != null && you.kit.Length == Slots)
            {
                for (var i = 0; i < Slots; i++) Kit[i] = you.kit[i] != null && you.kit[i].Present ? you.kit[i] : null;
                Armed = true;
            }
            if (you.cd != null)
                for (var i = 0; i < Slots && i < you.cd.Length; i++) readyAt[i] = now + you.cd[i] / 1000f;
        }

        /// <summary>Seconds until a button can be pressed again (0 = now).</summary>
        public float CooldownLeft(int slot, float now) =>
            slot < 0 || slot >= Slots ? 0 : Mathf.Max(0, Mathf.Max(readyAt[slot], lastPress + GlobalCooldown) - now);

        /// <summary>How much of the cooldown is still to go (1 just pressed … 0 ready), for the button's dark wedge.</summary>
        public float CooldownShare(int slot, float now)
        {
            var e = slot >= 0 && slot < Slots ? Kit[slot] : null;
            if (e == null || e.cd <= 0) return 0;
            return Mathf.Clamp01(Mathf.Max(0, readyAt[slot] - now) / (e.cd / 1000f));
        }

        /// <summary>Can this button be pressed now: it has an ability, it is ready, the bud stands and isn't held.</summary>
        public bool CanPress(int slot, float now) =>
            slot >= 0 && slot < Slots && Kit[slot] != null && !Down(now) && !Stunned(now) && CooldownLeft(slot, now) <= 0.04f;

        /// <summary>A press the game sends: the button greys out now, the server's answer keeps or corrects it.</summary>
        public void Pressed(int slot, float now)
        {
            if (slot < 0 || slot >= Slots || Kit[slot] == null) return;
            readyAt[slot] = now + Kit[slot].cd / 1000f;
            lastPress = now;
        }

        /// <summary>A new map or a lost connection: nothing is known until the server speaks again.</summary>
        public void Reset()
        {
            for (var i = 0; i < Slots; i++)
            {
                Kit[i] = null;
                readyAt[i] = 0;
            }
            Hp = MaxHp = Shield = 0;
            DownUntil = GuardUntil = StunUntil = 0;
            Open = false;
            Armed = false;
            Forced = 0;
        }
    }

    /// <summary>Who stands where and on which side: what the auto-aim and the colours need to know of a unit.</summary>
    public struct BrawlTarget
    {
        public string Id;
        public Vector2 At;
        public bool Hostile;
    }

    /// <summary>Aiming as plain maths: the auto-aim of a tap, a dragged aim, the reach of each shape, the facing.</summary>
    public static class BrawlAim
    {
        /// <summary>A tap looks for a foe this far past the ability's own reach (the bud walks in with the blow).</summary>
        public const float TapSlack = 2.5f;
        /// <summary>A drag shorter than this share of the button's pull is a tap.</summary>
        public const float TapDrag = 0.18f;

        /// <summary>How far an ability reaches for the auto-aim (an area around the bud: its radius).</summary>
        public static float Reach(KitEntryDto e)
        {
            if (e == null) return 0;
            return e.shape switch
            {
                "self" => e.radius,
                "shield" or "buff" => 0,
                _ => Mathf.Max(1.2f, e.range),
            };
        }

        /// <summary>Abilities that need no aim at all (around the bud or on itself).</summary>
        public static bool Aimless(KitEntryDto e) => e != null && e.shape is "self" or "shield" or "buff";

        /// <summary>Areas put down at a spot: the drag picks the spot, not just a direction.</summary>
        public static bool AimsASpot(KitEntryDto e) => e != null && (e.shape == "circle" || (e.shape == "dash" && e.radius > 1.5f));

        /// <summary>The nearest foe within <paramref name="range"/> of <paramref name="me"/>, or null.</summary>
        public static string Nearest(Vector2 me, IReadOnlyList<BrawlTarget> targets, float range, out Vector2 at)
        {
            string best = null;
            at = me;
            var bestD = range;
            foreach (var t in targets)
            {
                if (!t.Hostile) continue;
                var d = Vector2.Distance(me, t.At);
                if (d > bestD) continue;
                bestD = d;
                best = t.Id;
                at = t.At;
            }
            return best;
        }

        /// <summary>
        /// A foe near a pointed spot (a mouse click, a dragged aim): the one closest to the line from the bud to the
        /// spot, within a forgiving cone, so a click a bit off the foe still aims at it.
        /// </summary>
        public static string Along(Vector2 me, Vector2 spot, IReadOnlyList<BrawlTarget> targets, float range, out Vector2 at)
        {
            string best = null;
            at = spot;
            var dir = spot - me;
            if (dir.sqrMagnitude < 1e-4f) return Nearest(me, targets, range, out at);
            dir.Normalize();
            var bestScore = float.MaxValue;
            foreach (var t in targets)
            {
                if (!t.Hostile) continue;
                var to = t.At - me;
                var d = to.magnitude;
                if (d > range || d < 1e-3f) continue;
                var angle = Vector2.Angle(dir, to);
                if (angle > 35 && Vector2.Distance(t.At, spot) > 1.2f) continue;
                var score = angle * 0.08f + Vector2.Distance(t.At, spot);
                if (score >= bestScore) continue;
                bestScore = score;
                best = t.Id;
                at = t.At;
            }
            return best;
        }

        /// <summary>
        /// A dragged aim: the pull (−1…1 on both axes, the button's radius = 1) turned into a spot in the world, as far
        /// as the pull is long for areas, at full reach for everything else.
        /// </summary>
        public static Vector2 FromPull(Vector2 me, Vector2 pull, KitEntryDto e, Vector2 facing)
        {
            var dir = pull.sqrMagnitude > 1e-4f ? pull.normalized : (facing.sqrMagnitude > 1e-4f ? facing.normalized : Vector2.down);
            var range = e != null ? Mathf.Max(0.5f, e.range) : 1;
            var share = AimsASpot(e) ? Mathf.Clamp01(pull.magnitude) : 1;
            return me + dir * Mathf.Max(0.6f, range * share);
        }

        /// <summary>A spot pulled back into reach (areas can't be put further than their range).</summary>
        public static Vector2 Clamp(Vector2 me, Vector2 spot, KitEntryDto e)
        {
            if (e == null) return spot;
            var d = spot - me;
            var range = Mathf.Max(0.5f, e.range);
            return d.magnitude > range ? me + d.normalized * range : spot;
        }

        /// <summary>The wire facing (0 down, 1 left, 2 up, 3 right) towards a direction.</summary>
        public static int FacingCode(Vector2 dir, int was)
        {
            if (dir.sqrMagnitude < 1e-4f) return was;
            if (Mathf.Abs(dir.x) > Mathf.Abs(dir.y)) return dir.x > 0 ? 3 : 1;
            return dir.y > 0 ? 2 : 0;
        }
    }

    /// <summary>Colours of a fight: who is on whose side, and how a number of damage is written.</summary>
    public static class BrawlLook
    {
        public enum Side { Me, Ally, Foe, Neutral }

        /// <summary>
        /// Another bud's side: the same crew is an ally (blue), a bud both can fight now is a foe (red), the rest stand
        /// apart (no bar colour of their own).
        /// </summary>
        public static Side BudSide(string myTeam, string theirTeam, bool bothOpen) =>
            !string.IsNullOrEmpty(myTeam) && myTeam == theirTeam ? Side.Ally : bothOpen ? Side.Foe : Side.Neutral;

        public static Color Fill(Side side) => side switch
        {
            Side.Me => UI.UiKit.Buds400,
            Side.Ally => UI.UiKit.Rep400,
            Side.Foe => UI.UiKit.Alert500,
            _ => UI.UiKit.Common,
        };

        /// <summary>The words over a blow: the damage, "!" for a critical hit, "Unik" when it missed.</summary>
        public static string DamageText(int damage, bool crit, bool evaded) =>
            evaded ? "Unik" : damage <= 0 ? "Blok" : crit ? $"{damage}!" : damage.ToString();
    }
}
