using System.Collections.Generic;

namespace Buds.Characters
{
    /// <summary>
    /// Rides (wierzchowce) as plain data and maths: which sprite a ride shows for a facing (art from
    /// tools/world/art/rides.ts: jazda-&lt;kind&gt;-bok / -przod / -tyl), how high the bud sits on it, and how fast the bud
    /// moves with gear, the ride, perks and the Turbo drink. Rides only work outdoors; the server checks ownership.
    /// </summary>
    public static class Rides
    {
        /// <summary>The art kind of a mount item ("mount-rower" → "rower"), or null for anything else.</summary>
        public static string KindOf(string itemId) =>
            itemId != null && itemId.StartsWith("mount-") ? itemId.Substring("mount-".Length) : null;

        static readonly string[] Shapes = { "e-hulajnowa", "hulajnowa", "deskorolka", "rower", "motocykl", "quad" };

        /// <summary>The shape a ride is drawn with: premium rides are recoloured earned ones ("quad-wulkan" → "quad").</summary>
        public static string ShapeOf(string kind)
        {
            if (kind == null) return null;
            foreach (var s in Shapes)
                if (kind == s || kind.StartsWith(s + "-"))
                    return s;
            return kind;
        }

        /// <summary>Tiles the bud is lifted: standing on a board, sitting on a bike or a quad.</summary>
        public static float Rise(string kind) => ShapeOf(kind) switch
        {
            "deskorolka" => 0.22f,
            "hulajnowa" => 0.12f,
            "e-hulajnowa" => 0.14f,
            "rower" => 0.28f,
            "motocykl" => 0.3f,
            "quad" => 0.34f,
            _ => 0.1f,
        };

        public static string SpriteFor(string kind, Facing facing) => facing switch
        {
            Facing.Side => $"jazda-{kind}-bok",
            Facing.Down => $"jazda-{kind}-przod",
            _ => $"jazda-{kind}-tyl",
        };

        /// <summary>The front and back views are drawn over the bud (handlebars, wheels), the side view behind it.
        /// A skateboard is always under the feet.</summary>
        public static bool DrawnOverBud(string kind, Facing facing) => facing != Facing.Side && ShapeOf(kind) != "deskorolka";

        /// <summary>Every ride sprite a district needs for these mounts.</summary>
        public static IEnumerable<string> SpriteNames(string kind)
        {
            yield return SpriteFor(kind, Facing.Side);
            yield return SpriteFor(kind, Facing.Down);
            yield return SpriteFor(kind, Facing.Up);
        }

        /// <summary>Walking speed perks: Rytm ulicy and Na fali, +5% each.</summary>
        public static int PerkSpeedPercent(IEnumerable<string> perks)
        {
            var n = 0;
            if (perks == null) return 0;
            foreach (var p in perks)
                if (p is "rytm-ulicy" or "na-fali") n += 5;
            return n;
        }

        /// <summary>
        /// The motor's speed multiplier: gear (capped on the server and in Gear.Stats) × the ride × (perks + Turbo).
        /// </summary>
        public static float SpeedMultiplier(int gearSpeedPercent, int mountSpeedPercent, int perkPercent, bool turbo) =>
            (1 + gearSpeedPercent / 100f) * (1 + mountSpeedPercent / 100f) * (1 + (perkPercent + (turbo ? 15 : 0)) / 100f);
    }
}
