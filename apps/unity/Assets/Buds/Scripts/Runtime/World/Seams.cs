using UnityEngine;

namespace Buds.World
{
    /// <summary>
    /// Where two maps meet with no loading in between (a city and the wasteland that leaves it): the exit of one and
    /// the exit of the other are road strips of the same width on facing edges, so the second map can be laid right
    /// next to the first and the road runs on. Plain maths (EditMode-testable); the game builds the neighbour at
    /// <see cref="OffsetOf"/> and walks across.
    /// </summary>
    public static class Seams
    {
        public enum Side
        {
            North,
            South,
            East,
            West,
        }

        /// <summary>Which edge of <paramref name="map"/> an exit lies on (null for one inside the map).</summary>
        public static Side? SideOf(Exit e, WorldMap map)
        {
            if (e.Y0 == 0 && e.Y1 == 0) return Side.North;
            if (e.Y0 == map.Height - 1 && e.Y1 == map.Height - 1) return Side.South;
            if (e.X0 == map.Width - 1 && e.X1 == map.Width - 1) return Side.East;
            if (e.X0 == 0 && e.X1 == 0) return Side.West;
            return null;
        }

        static Side Opposite(Side s) => s switch
        {
            Side.North => Side.South,
            Side.South => Side.North,
            Side.East => Side.West,
            _ => Side.East,
        };

        /// <summary>The exit of <paramref name="from"/> that leads to <paramref name="to"/>, or null.</summary>
        public static Exit ExitTo(WorldMap from, string to) => from.Exits.Find(e => e.DistrictId == to);

        /// <summary>
        /// Where <paramref name="b"/>'s origin (its south-west corner in world units) sits when <paramref name="a"/>'s
        /// origin is at zero and the two road strips meet; null when the maps don't line up (no exits to each other, not on
        /// facing edges, or strips of different widths).
        /// </summary>
        public static Vector2? OffsetOf(WorldMap a, WorldMap b)
        {
            var ea = ExitTo(a, b.Id);
            var eb = ExitTo(b, a.Id);
            if (ea == null || eb == null) return null;
            var sa = SideOf(ea, a);
            var sb = SideOf(eb, b);
            if (sa == null || sb == null || sb != Opposite(sa.Value)) return null;
            if (ea.X1 - ea.X0 != eb.X1 - eb.X0 || ea.Y1 - ea.Y0 != eb.Y1 - eb.Y0) return null;
            return sa.Value switch
            {
                Side.North => new Vector2(ea.X0 - eb.X0, a.Height),
                Side.South => new Vector2(ea.X0 - eb.X0, -b.Height),
                Side.East => new Vector2(a.Width, a.Height - ea.Y0 - b.Height + eb.Y0),
                _ => new Vector2(-b.Width, a.Height - ea.Y0 - b.Height + eb.Y0),
            };
        }

        /// <summary>The gap a map's outline leaves for a road out, as two points on its edge (local world units).</summary>
        public static (Vector2 from, Vector2 to) Gap(Exit e, WorldMap map)
        {
            var side = SideOf(e, map) ?? Side.North;
            return side switch
            {
                Side.North => (new Vector2(e.X0, map.Height), new Vector2(e.X1 + 1, map.Height)),
                Side.South => (new Vector2(e.X0, 0), new Vector2(e.X1 + 1, 0)),
                Side.East => (new Vector2(map.Width, map.Height - 1 - e.Y1), new Vector2(map.Width, map.Height - e.Y0)),
                _ => (new Vector2(0, map.Height - 1 - e.Y1), new Vector2(0, map.Height - e.Y0)),
            };
        }

        /// <summary>
        /// A map's outline as an open line around it that leaves out the road's gap (or closed all round with no gap),
        /// in local world units: walls on every edge except where the next map begins.
        /// </summary>
        public static Vector2[] Outline(WorldMap map, Exit open)
        {
            float w = map.Width, h = map.Height;
            if (open == null) return new[] { new Vector2(0, 0), new Vector2(w, 0), new Vector2(w, h), new Vector2(0, h), new Vector2(0, 0) };
            var (a, b) = Gap(open, map);
            return (SideOf(open, map) ?? Side.North) switch
            {
                Side.North => new[] { b, new Vector2(w, h), new Vector2(w, 0), new Vector2(0, 0), new Vector2(0, h), a },
                Side.South => new[] { b, new Vector2(w, 0), new Vector2(w, h), new Vector2(0, h), new Vector2(0, 0), a },
                Side.East => new[] { b, new Vector2(w, h), new Vector2(0, h), new Vector2(0, 0), new Vector2(w, 0), a },
                _ => new[] { b, new Vector2(0, h), new Vector2(w, h), new Vector2(w, 0), new Vector2(0, 0), a },
            };
        }

        /// <summary>The margin of ground drawn around a map for the tilted camera (west, south, east, north).</summary>
        public static readonly Vector4 Margin = new(40, 12, 40, 60);

        /// <summary>
        /// The base ground of a map that has a neighbour laid next to it (local world units): its usual margin except on
        /// the shared edge, where it stops, so the two never overlap. The neighbour's base reaches along the shared edge
        /// as far as the other map's own margin, so no corner shows the void.
        /// </summary>
        public static Rect BaseRect(WorldMap map, WorldMap other, Vector2 otherOffset)
        {
            float x0 = -Margin.x, y0 = -Margin.y, x1 = map.Width + Margin.z, y1 = map.Height + Margin.w;
            if (other == null) return Rect.MinMaxRect(x0, y0, x1, y1);
            // which way the other map lies
            var ox0 = otherOffset.x;
            var oy0 = otherOffset.y;
            var ox1 = ox0 + other.Width;
            var oy1 = oy0 + other.Height;
            if (oy0 >= map.Height - 0.01f) y1 = map.Height; // other to the north: stop at the top edge
            else if (oy1 <= 0.01f) y0 = 0; // to the south
            else if (ox0 >= map.Width - 0.01f) x1 = map.Width; // to the east
            else if (ox1 <= 0.01f) x0 = 0; // to the west
            return Rect.MinMaxRect(x0, y0, x1, y1);
        }

        /// <summary>
        /// The base ground of the map laid next to the current one (in its own local units): from the shared edge away,
        /// with its margin, and along the shared edge as wide as the current map's base reaches.
        /// </summary>
        public static Rect NeighbourBaseRect(WorldMap neighbour, WorldMap current, Vector2 neighbourOffset)
        {
            float x0 = -Margin.x, y0 = -Margin.y, x1 = neighbour.Width + Margin.z, y1 = neighbour.Height + Margin.w;
            // the current map in the neighbour's local units
            var cx0 = -neighbourOffset.x;
            var cy0 = -neighbourOffset.y;
            var cx1 = cx0 + current.Width;
            var cy1 = cy0 + current.Height;
            if (cy1 <= 0.01f) // current to the south
            {
                y0 = 0;
                x0 = Mathf.Min(x0, cx0 - Margin.x);
                x1 = Mathf.Max(x1, cx1 + Margin.z);
            }
            else if (cy0 >= neighbour.Height - 0.01f) // current to the north
            {
                y1 = neighbour.Height;
                x0 = Mathf.Min(x0, cx0 - Margin.x);
                x1 = Mathf.Max(x1, cx1 + Margin.z);
            }
            else if (cx1 <= 0.01f) // current to the west
            {
                x0 = 0;
                y0 = Mathf.Min(y0, cy0 - Margin.y);
                y1 = Mathf.Max(y1, cy1 + Margin.w);
            }
            else if (cx0 >= neighbour.Width - 0.01f) // current to the east
            {
                x1 = neighbour.Width;
                y0 = Mathf.Min(y0, cy0 - Margin.y);
                y1 = Mathf.Max(y1, cy1 + Margin.w);
            }
            return Rect.MinMaxRect(x0, y0, x1, y1);
        }

        /// <summary>
        /// How far (tiles) a point on <paramref name="map"/> (local world units) is from an exit's strip: the bud's walk
        /// to the seam, to know when to lay the next map down and when to let it go.
        /// </summary>
        public static float DistanceTo(Exit e, WorldMap map, Vector2 at)
        {
            var (a, b) = Gap(e, map);
            var min = Vector2.Min(a, b);
            var max = Vector2.Max(a, b);
            var dx = Mathf.Max(min.x - at.x, 0, at.x - max.x);
            var dy = Mathf.Max(min.y - at.y, 0, at.y - max.y);
            return Mathf.Sqrt(dx * dx + dy * dy);
        }
    }
}
