namespace Buds.Quests
{
    /// <summary>
    /// Ambushes on the routes between cities, as plain rules (EditMode-testable): a lurker hidden in a nook springs
    /// when the bud comes within <see cref="SpringRadius"/>, never while something else is going on, and after the
    /// bud got away it waits <see cref="Cooldown"/> before it tries again.
    /// </summary>
    public static class Ambush
    {
        /// <summary>How close (tiles, feet to feet) the bud gets before a lurker jumps out: the mouth of its nook.</summary>
        public const float SpringRadius = 2.4f;
        /// <summary>Seconds a lurker stays put after springing (the bud ran away or the duel didn't start).</summary>
        public const float Cooldown = 25f;
        /// <summary>The pause between jumping out and the duel: long enough to see who it is.</summary>
        public const float WindUp = 0.7f;

        public static bool ShouldSpring(float distance, bool ready, bool busy) => ready && !busy && distance <= SpringRadius;

        /// <summary>What the bud sees when it walks into one: the lurker's own line, or a default.</summary>
        public static string Line(EnemyData e) =>
            e.lines is { Length: > 0 } ? e.lines[0] : "Zasadzka!";
    }
}
