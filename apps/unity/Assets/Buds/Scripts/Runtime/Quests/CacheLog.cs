using System;
using System.Collections.Generic;

namespace Buds.Quests
{
    /// <summary>
    /// Hidden caches (skrytki), as plain logic: which ones lie on a map, which the bud has noticed (they stay invisible
    /// until it comes close) and which it has emptied. Opened ids come from the server for paired buds; guests keep
    /// them locally (Save / Restore). Coins and XP are only ever granted by the server.
    /// </summary>
    public sealed class CacheLog
    {
        /// <summary>Tiles around the bud in which caches give themselves away; Spryt adds to it.</summary>
        public const float BaseRevealRadius = 2.5f;
        public const float RevealPerSprytRank = 0.6f;

        public QuestContent Content { get; }
        public readonly HashSet<string> Opened = new();
        readonly HashSet<string> revealed = new();

        public event Action Changed;

        public CacheLog(QuestContent content)
        {
            Content = content;
        }

        public static float RevealRadius(int sprytRank) => BaseRevealRadius + RevealPerSprytRank * Math.Max(0, sprytRank);

        public IEnumerable<CacheData> On(string mapId)
        {
            foreach (var c in Content.caches)
                if (c.map == mapId) yield return c;
        }

        public CacheData Get(string id) => Array.Find(Content.caches, c => c.id == id);

        /// <summary>Noticed this session, or already emptied (an empty cache stays where it was).</summary>
        public bool IsVisible(CacheData c) => revealed.Contains(c.id) || Opened.Contains(c.id);

        /// <summary>
        /// Reveals hidden caches within <paramref name="radius"/> tiles of the bud (map coordinates, y down, cell
        /// centres at +0.5) and returns the ones that just appeared.
        /// </summary>
        public List<CacheData> Reveal(string mapId, float x, float y, float radius)
        {
            var found = new List<CacheData>();
            foreach (var c in On(mapId))
            {
                if (IsVisible(c)) continue;
                var dx = c.x + 0.5f - x;
                var dy = c.y + 0.5f - y;
                if (dx * dx + dy * dy > radius * radius) continue;
                revealed.Add(c.id);
                found.Add(c);
            }
            if (found.Count > 0) Changed?.Invoke();
            return found;
        }

        /// <summary>The closest noticed, still full cache within <paramref name="range"/> tiles.</summary>
        public CacheData Nearest(string mapId, float x, float y, float range)
        {
            CacheData best = null;
            var bestD = range * range;
            foreach (var c in On(mapId))
            {
                if (!revealed.Contains(c.id) || Opened.Contains(c.id)) continue;
                var dx = c.x + 0.5f - x;
                var dy = c.y + 0.5f - y;
                var d = dx * dx + dy * dy;
                if (d > bestD) continue;
                best = c;
                bestD = d;
            }
            return best;
        }

        public void Open(string id)
        {
            if (Opened.Add(id)) Changed?.Invoke();
        }

        /// <summary>Emptied and all caches of a district (its rooms included).</summary>
        public (int found, int total) CountIn(string district)
        {
            int found = 0, total = 0;
            foreach (var c in Content.caches)
            {
                if (c.district != district) continue;
                total++;
                if (Opened.Contains(c.id)) found++;
            }
            return (found, total);
        }

        public string Save() => string.Join(",", Opened);

        public void Restore(string saved)
        {
            if (string.IsNullOrEmpty(saved)) return;
            foreach (var id in saved.Split(','))
                if (Get(id) != null) Opened.Add(id);
        }
    }
}
