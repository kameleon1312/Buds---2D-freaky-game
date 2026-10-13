using System;
using UnityEngine;

namespace Buds.World
{
    /// <summary>
    /// Fog of war for the map screen: which cells of a district the bud has seen (a circle around it as it walks).
    /// Plain data, saved per bud and district as a base64 bit field.
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
