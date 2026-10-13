using UnityEngine;

namespace Buds.Core
{
    /// <summary>Mirror of packages/shared/src/level.ts — keep the curve identical on web and in game.</summary>
    public static class Progression
    {
        public const int XpCurve = 100;

        public static int Level(int xp) => Mathf.FloorToInt(Mathf.Sqrt(Mathf.Max(0, xp) / (float)XpCurve)) + 1;

        public static int NextLevelXp(int xp)
        {
            var level = Level(xp);
            return XpCurve * level * level;
        }

        /// <summary>0..1 progress within the current level (levelFromXp(xp).progress on the web).</summary>
        public static float Progress(int xp)
        {
            xp = Mathf.Max(0, xp);
            var level = Level(xp);
            var floor = XpCurve * (level - 1) * (level - 1);
            return (xp - floor) / (float)(NextLevelXp(xp) - floor);
        }
    }
}
