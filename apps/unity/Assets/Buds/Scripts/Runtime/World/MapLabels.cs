using System.Collections.Generic;
using UnityEngine;

namespace Buds.World
{
    /// <summary>
    /// Places the map screen's names so none of them overlap each other or the markers. Each label tries a few spots
    /// around its anchor (on it, just above, just below, a little to each side) and takes the first free one; labels
    /// are tried in priority order, so when space runs out the least important ones are left out. Plain class: tested
    /// in EditMode.
    /// </summary>
    public static class MapLabels
    {
        public struct Label
        {
            /// <summary>Centre the label would like, in picture units.</summary>
            public Vector2 Anchor;
            public Vector2 Size;
            /// <summary>Higher goes first.</summary>
            public int Priority;
        }

        /// <summary>A little air between two labels.</summary>
        const float Gap = 4;

        /// <summary>
        /// Where each label goes (its centre), or null when it doesn't fit anywhere. `bounds` is the picture; the
        /// obstacles (markers) are never covered.
        /// </summary>
        public static Vector2?[] Place(IReadOnlyList<Label> labels, Rect bounds, IReadOnlyList<Rect> obstacles)
        {
            var result = new Vector2?[labels.Count];
            var order = new List<int>();
            for (var i = 0; i < labels.Count; i++) order.Add(i);
            // stable: equal priorities keep their given order
            order.Sort((a, b) => labels[b].Priority != labels[a].Priority
                ? labels[b].Priority.CompareTo(labels[a].Priority)
                : a.CompareTo(b));

            var taken = new List<Rect>(obstacles);
            foreach (var i in order)
            {
                var l = labels[i];
                var step = l.Size.y + Gap;
                Vector2[] tries =
                {
                    l.Anchor,
                    l.Anchor + new Vector2(0, step),
                    l.Anchor - new Vector2(0, step),
                    l.Anchor + new Vector2(l.Size.x * 0.35f, 0),
                    l.Anchor - new Vector2(l.Size.x * 0.35f, 0),
                    l.Anchor + new Vector2(0, step * 2),
                    l.Anchor - new Vector2(0, step * 2),
                };
                foreach (var t in tries)
                {
                    var at = Clamp(t, l.Size, bounds);
                    var rect = RectAt(at, l.Size);
                    if (Hits(rect, taken)) continue;
                    result[i] = at;
                    taken.Add(Grow(rect, Gap));
                    break;
                }
            }
            return result;
        }

        public static Rect RectAt(Vector2 centre, Vector2 size) =>
            new(centre.x - size.x / 2, centre.y - size.y / 2, size.x, size.y);

        static Vector2 Clamp(Vector2 centre, Vector2 size, Rect bounds) => new(
            Mathf.Clamp(centre.x, bounds.xMin + size.x / 2, Mathf.Max(bounds.xMin + size.x / 2, bounds.xMax - size.x / 2)),
            Mathf.Clamp(centre.y, bounds.yMin + size.y / 2, Mathf.Max(bounds.yMin + size.y / 2, bounds.yMax - size.y / 2)));

        static Rect Grow(Rect r, float by) => new(r.x - by, r.y - by, r.width + by * 2, r.height + by * 2);

        static bool Hits(Rect r, List<Rect> taken)
        {
            foreach (var t in taken)
                if (r.Overlaps(t))
                    return true;
            return false;
        }
    }
}
