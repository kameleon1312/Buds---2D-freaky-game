using System;
using UnityEngine;

namespace Buds.World
{
    /// <summary>
    /// Fog of war for the map screen: which cells of a district the bud has seen (a circle around it as it walks).
    /// Plain data, a base64 bit field per bud and map: kept on the device and on the server, so it follows the bud's account.
    /// </summary>
    public sealed class Exploration
    {
        /// <summary>About what the camera shows around the bud.</summary>
        public const int SightRadius = 7;

        public int Width { get; }
        public int Height { get; }
        readonly bool[] seen;

        public Exploration(int width, int height)
        {
            Width = width;
            Height = height;
            seen = new bool[width * height];
        }

        public bool IsSeen(int x, int y) => x >= 0 && y >= 0 && x < Width && y < Height && seen[y * Width + x];

        /// <summary>Marks the cells within <paramref name="radius"/> of (x, y); true when anything new was seen.</summary>
        public bool Reveal(int x, int y, int radius = SightRadius)
        {
            var changed = false;
            for (var dy = -radius; dy <= radius; dy++)
            for (var dx = -radius; dx <= radius; dx++)
            {
                if (dx * dx + dy * dy > radius * radius + radius) continue; // a round, slightly full circle
                var cx = x + dx;
                var cy = y + dy;
                if (cx < 0 || cy < 0 || cx >= Width || cy >= Height || seen[cy * Width + cx]) continue;
                seen[cy * Width + cx] = true;
                changed = true;
            }
            return changed;
        }

        /// <summary>Share of the walkable cells seen so far (0..1).</summary>
        public float Explored(WorldMap map)
        {
            int walk = 0, known = 0;
            for (var y = 0; y < Height && y < map.Height; y++)
            for (var x = 0; x < Width && x < map.Width; x++)
            {
                if (map.Solid[y, x]) continue;
                walk++;
                if (seen[y * Width + x]) known++;
            }
            return walk == 0 ? 0 : (float)known / walk;
        }

        public string Save()
        {
            var bytes = new byte[(seen.Length + 7) / 8];
            for (var i = 0; i < seen.Length; i++)
                if (seen[i]) bytes[i >> 3] |= (byte)(1 << (i & 7));
            return Convert.ToBase64String(bytes);
        }

        /// <summary>Adds what another save has seen; anything unreadable or for another map size adds nothing. True when something new came.</summary>
        public bool Merge(string data)
        {
            var other = Load(Width, Height, data);
            var changed = false;
            for (var i = 0; i < seen.Length; i++)
                if (other.seen[i] && !seen[i])
                {
                    seen[i] = true;
                    changed = true;
                }
            return changed;
        }

        /// <summary>Restores saved data; anything unreadable or for another map size starts fresh.</summary>
        public static Exploration Load(int width, int height, string data)
        {
            var fog = new Exploration(width, height);
            if (string.IsNullOrEmpty(data)) return fog;
            byte[] bytes;
            try
            {
                bytes = Convert.FromBase64String(data);
            }
            catch (FormatException)
            {
                return fog;
            }
            if (bytes.Length != (fog.seen.Length + 7) / 8) return fog;
            for (var i = 0; i < fog.seen.Length; i++) fog.seen[i] = (bytes[i >> 3] & (1 << (i & 7))) != 0;
            return fog;
        }
    }

    /// <summary>Colours for the map screen: one pixel per cell, from the map's own ground styles.</summary>
    public static class MapPicture
    {
        public static readonly Color32 Unknown = new(0x2a, 0x2d, 0x37, 0xff);

        /// <summary>Colour of a cell: its ground style's innermost band, darker where something solid stands.</summary>
        public static Color CellColor(WorldMap map, int x, int y)
        {
            var kind = map.GroundAt(x, y);
            var color = map.BaseColor;
            // later styles are drawn on top, so the last one listing this ground wins
            foreach (var style in map.GroundStyles)
                if (Array.IndexOf(style.Kinds, kind) >= 0 && style.Bands.Length > 0)
                    color = style.Bands[^1].Color;
            return map.Solid[y, x] ? Color.Lerp(color, new Color(0.11f, 0.1f, 0.13f), 0.38f) : color;
        }

        /// <summary>A place counts as discovered once its middle has been seen: how many of the map's zones.</summary>
        public static (int seen, int total) Places(WorldMap map, Exploration fog)
        {
            var seen = 0;
            foreach (var z in map.Zones)
                if (fog == null || fog.IsSeen((z.X0 + z.X1) / 2, (z.Y0 + z.Y1) / 2))
                    seen++;
            return (seen, map.Zones.Count);
        }

        /// <summary>The fog over the map: dark and opaque where the bud hasn't been, one pixel a cell, drawn smoothed.</summary>
        public static Color32[] FogPixels(int width, int height, Exploration fog)
        {
            var px = new Color32[width * height];
            var clear = new Color32(Unknown.r, Unknown.g, Unknown.b, 0);
            for (var y = 0; y < height; y++)
            for (var x = 0; x < width; x++)
                px[(height - 1 - y) * width + x] = fog == null || fog.IsSeen(x, y) ? clear : Unknown;
            return px;
        }

        /// <summary>What a prop looks like from above on the map (the props with a place of their own).</summary>
        public static Color32? BlobColor(string name)
        {
            if (name.Contains("wisnia")) return new Color32(0xf1, 0x9d, 0xbd, 0xff);
            if (name.Contains("bambus")) return new Color32(0x6f, 0xa8, 0x4f, 0xff);
            if (name.Contains("palm")) return new Color32(0x4f, 0xa8, 0x58, 0xff);
            if (name.Contains("tree") || name.Contains("sosna") || name.Contains("swierk") || name.Contains("topiary") ||
                name.Contains("bush") || name.Contains("krzak") || name.Contains("drzewo"))
                return new Color32(0x3f, 0x87, 0x46, 0xff);
            return null;
        }

        /// <summary>
        /// The map drawn in detail, <paramref name="scale"/> pixels a cell (texture row 0 = south): ground with rounded
        /// corners and a little grain, roofs of the buildings, tree crowns, small dots for the rest. The fog goes over it.
        /// <paramref name="foot"/> gives a prop's footprint, null for what lies flat on the ground.
        /// </summary>
        public static Color32[] Detailed(WorldMap map, int scale, Func<string, int[]> foot)
        {
            var w = map.Width * scale;
            var h = map.Height * scale;
            var px = new Color32[w * h];
            var cells = new Color32[map.Width * map.Height];
            for (var y = 0; y < map.Height; y++)
            for (var x = 0; x < map.Width; x++)
                cells[y * map.Width + x] = GroundColor(map, x, y);
            Color32 At(int x, int y) => cells[Mathf.Clamp(y, 0, map.Height - 1) * map.Width + Mathf.Clamp(x, 0, map.Width - 1)];
            static bool Same(Color32 a, Color32 b) => a.r == b.r && a.g == b.g && a.b == b.b;
            var round = scale * scale / 4;
            for (var y = 0; y < map.Height; y++)
            for (var x = 0; x < map.Width; x++)
            {
                var own = At(x, y);
                var ground = own;
                for (var py = 0; py < scale; py++)
                for (var ox = 0; ox < scale; ox++)
                {
                    var c = own;
                    // a corner where both neighbours on that side share another ground takes theirs: no stairs
                    var left = ox < scale / 2;
                    var up = py < scale / 2;
                    var side = At(left ? x - 1 : x + 1, y);
                    var over = At(x, up ? y - 1 : y + 1);
                    if (Same(side, over) && !Same(side, own))
                    {
                        var dx = left ? ox : scale - 1 - ox;
                        var dy = up ? py : scale - 1 - py;
                        var r = scale / 2;
                        if ((r - dx) * (r - dx) + (r - dy) * (r - dy) > round) c = side;
                    }
                    // a little grain, the same each time
                    var grain = ((x * scale + ox) * 7 + (y * scale + py) * 13) % 5 - 2;
                    px[(h - 1 - (y * scale + py)) * w + x * scale + ox] = new Color32(
                        (byte)Mathf.Clamp(c.r + grain, 0, 255), (byte)Mathf.Clamp(c.g + grain, 0, 255), (byte)Mathf.Clamp(c.b + grain, 0, 255), 255);
                }
            }

            void Rect(float x0, float y0, float x1, float y1, Color32 c)
            {
                for (var py = Mathf.FloorToInt(y0 * scale); py < Mathf.CeilToInt(y1 * scale); py++)
                for (var ox = Mathf.FloorToInt(x0 * scale); ox < Mathf.CeilToInt(x1 * scale); ox++)
                    if (ox >= 0 && py >= 0 && ox < w && py < h)
                        px[(h - 1 - py) * w + ox] = c;
            }
            void Disc(float cx, float cy, float r, Color32 c)
            {
                var s = r * scale;
                for (var py = Mathf.FloorToInt(cy * scale - s); py <= Mathf.CeilToInt(cy * scale + s); py++)
                for (var ox = Mathf.FloorToInt(cx * scale - s); ox <= Mathf.CeilToInt(cx * scale + s); ox++)
                {
                    var dx = ox + 0.5f - cx * scale;
                    var dy = py + 0.5f - cy * scale;
                    if (dx * dx + dy * dy <= s * s && ox >= 0 && py >= 0 && ox < w && py < h)
                        px[(h - 1 - py) * w + ox] = c;
                }
            }
            var line = new Color32(0x24, 0x22, 0x2a, 0xff);
            Color32[] roofs =
            {
                new(0xb9, 0x4a, 0x3a, 0xff), new(0x6c, 0x73, 0x88, 0xff), new(0xc9, 0x8f, 0x4e, 0xff), new(0x3f, 0x76, 0x72, 0xff), new(0x8a, 0x5a, 0x7a, 0xff),
            };
            foreach (var p in map.Props)
            {
                if (p.Scattered) continue;
                var f = foot(p.Name);
                if (f == null) continue;
                var blob = BlobColor(p.Name);
                if (blob is { } crown)
                {
                    Disc(p.X + 0.5f, p.Y + 0.5f, 0.66f, line);
                    Disc(p.X + 0.5f, p.Y + 0.5f, 0.54f, crown);
                    Disc(p.X + 0.38f, p.Y + 0.36f, 0.2f, Color32.Lerp(crown, new Color32(255, 255, 255, 255), 0.25f));
                }
                else if (f[0] >= 3)
                {
                    // a building's roof over its footprint, with its ridge
                    var x0 = p.X - (f[0] - 1) / 2f;
                    var y0 = p.Y - f[1] + 1f;
                    var x1 = x0 + f[0];
                    var y1 = p.Y + 1f;
                    var hash = 0;
                    foreach (var ch in p.Name) hash = hash * 31 + ch;
                    var roof = roofs[Mathf.Abs(hash) % roofs.Length];
                    Rect(x0, y0, x1, y1, line);
                    Rect(x0 + 0.14f, y0 + 0.14f, x1 - 0.14f, y1 - 0.14f, roof);
                    Rect(x0 + 0.14f, (y0 + y1) / 2 - 0.04f, x1 - 0.14f, (y0 + y1) / 2 + 0.04f, Color32.Lerp(roof, line, 0.45f));
                }
                else Disc(p.X + 0.5f, p.Y + 0.5f, 0.24f, Color32.Lerp(line, new Color32(0xc8, 0xc0, 0xb0, 0xff), 0.4f));
            }
            return px;
        }

        /// <summary>A cell's ground without what stands on it; bare solid ground (a wood, a cliff, a wall) is a shade darker.</summary>
        static Color32 GroundColor(WorldMap map, int x, int y)
        {
            var kind = map.GroundAt(x, y);
            var color = map.BaseColor;
            foreach (var style in map.GroundStyles)
                if (Array.IndexOf(style.Kinds, kind) >= 0 && style.Bands.Length > 0)
                    color = style.Bands[^1].Color;
            return color;
        }

        /// <summary>Pixels for a Width×Height texture (texture row 0 = the map's southern edge); unseen cells are dark.</summary>
        public static Color32[] Pixels(WorldMap map, Exploration fog)
        {
            var px = new Color32[map.Width * map.Height];
            for (var y = 0; y < map.Height; y++)
            for (var x = 0; x < map.Width; x++)
                px[(map.Height - 1 - y) * map.Width + x] = fog == null || fog.IsSeen(x, y) ? CellColor(map, x, y) : Unknown;
            return px;
        }
    }
}
