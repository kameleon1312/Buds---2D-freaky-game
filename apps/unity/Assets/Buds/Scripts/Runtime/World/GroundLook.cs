using System.Collections.Generic;
using UnityEngine;

namespace Buds.World
{
    /// <summary>
    /// The surface of every ground layer: a small tiling texture drawn in code that the ground's flat colour is
    /// multiplied by (grass blades, asphalt grain, paving slabs with joints, cobbles, boards, sand and pebbles, water
    /// ripples), so streets, parks and beaches read as materials instead of flat fills. Textures are near white (the
    /// map's colours stay the map's colours); <see cref="Gain"/> lifts the layer back to its average brightness.
    /// Patterns are plain maths (EditMode-testable) and the same on every run.
    /// </summary>
    public static class GroundLook
    {
        public enum Pattern
        {
            Grain,
            Grass,
            Asphalt,
            Slabs,
            Cobble,
            Boards,
            Sand,
            Water,
            Leaves,
            // district materials (DistrictLook): appended, so the patterns above keep their seeds
            Rock,
            Rubble,
            Lawn,
            Ripples,
            Cracked,
        }

        /// <summary>Texture pixels and the world size one texture covers (tiles).</summary>
        public const int Size = 128;
        public const float Span = 2f;

        static bool IsWater(string kind) =>
            kind.Contains("water") || kind.Contains("ocean") || kind.Contains("shallow") || kind.Contains("lagoon") ||
            kind == "sludge" || kind == "bog";

        /// <summary>
        /// The pattern a ground style gets: water when everything it covers is water (whatever the style is called: a
        /// "shore" style laid over a lake is still the lake), otherwise by its name in the map file.
        /// </summary>
        public static Pattern For(string style, IReadOnlyCollection<string> kinds, string district)
        {
            var basic = For(style, kinds);
            // each district's own version of a material: the manor's mown lawns, the wind-rippled beaches of Las Palmas,
            // the cracked concrete and asphalt of Los Karkos; rock and rubble everywhere they are
            style ??= "";
            if (style == "rock") return Pattern.Rock;
            if (style == "rubble") return Pattern.Rubble;
            switch (district)
            {
                case "dwor-carski" when basic == Pattern.Grass && style.StartsWith("lawn"):
                    return Pattern.Lawn;
                case "las-palmas" when style == "sand":
                    return Pattern.Ripples;
                case "los-karkos" when style == "concrete" || style == "asphalt":
                    return Pattern.Cracked;
            }
            return basic;
        }

        public static Pattern For(string style, IReadOnlyCollection<string> kinds)
        {
            if (kinds != null && kinds.Count > 0)
            {
                var allWater = true;
                foreach (var k in kinds)
                    if (!IsWater(k ?? ""))
                        allWater = false;
                if (allWater) return Pattern.Water;
            }
            return For(style);
        }

        /// <summary>The pattern a ground style gets, from its name in the map file.</summary>
        public static Pattern For(string style)
        {
            style = style ?? "";
            if (style.Contains("water") || style.Contains("ocean") || style.Contains("shallow") || style.Contains("lagoon") ||
                style == "sludge" || style == "bog")
                return style == "lagoon-shore" ? Pattern.Sand : Pattern.Water;
            if (style.StartsWith("grass") || style.StartsWith("lawn") || style == "jungle" || style == "weeds") return Pattern.Grass;
            if (style == "forest" || style == "hedge") return Pattern.Leaves;
            if (style == "asphalt") return Pattern.Asphalt;
            if (style == "sidewalk" || style == "plaza" || style == "concrete") return Pattern.Slabs;
            if (style == "cobble") return Pattern.Cobble;
            if (style == "floor" || style == "planks") return Pattern.Boards;
            if (style == "sand" || style == "shore" || style == "path" || style == "dirt" || style == "gravel" || style == "soil" ||
                style == "rubble" || style == "rock")
                return Pattern.Sand;
            return Pattern.Grain;
        }

        static readonly Dictionary<Pattern, Texture2D> cache = new();
        static readonly Dictionary<Pattern, float> gains = new();

        public static Texture2D Texture(Pattern pattern)
        {
            if (cache.TryGetValue(pattern, out var tex) && tex) return tex;
            var pixels = Pixels(pattern);
            tex = new Texture2D(Size, Size, TextureFormat.RGBA32, true)
            {
                name = "Ground " + pattern,
                wrapMode = TextureWrapMode.Repeat,
                filterMode = FilterMode.Trilinear,
                anisoLevel = 2,
            };
            var sum = 0f;
            var colors = new Color32[pixels.Length];
            for (var i = 0; i < pixels.Length; i++)
            {
                var v = Mathf.Clamp01(pixels[i]);
                sum += v;
                var b = (byte)Mathf.RoundToInt(v * 255);
                colors[i] = new Color32(b, b, b, 255);
            }
            tex.SetPixels32(colors);
            tex.Apply(true, true);
            cache[pattern] = tex;
            gains[pattern] = Mathf.Clamp(pixels.Length / Mathf.Max(1, sum), 1f, 1.15f);
            return tex;
        }

        /// <summary>How much to brighten a layer's colour so the texture keeps its average brightness.</summary>
        public static float Gain(Pattern pattern)
        {
            Texture(pattern);
            return gains[pattern];
        }

        static Texture2D macro;
        static Texture2D blob;

        /// <summary>
        /// The world's soft patches (the ground and water shaders' _BudsMacro): smooth tiling noise, three octaves of
        /// lumps, mid-grey on average, so a shader can lighten and darken large stretches of ground around it.
        /// </summary>
        public static Texture2D Macro()
        {
            if (macro) return macro;
            const int size = 128;
            macro = new Texture2D(size, size, TextureFormat.R8, true)
            {
                name = "Ground patches", wrapMode = TextureWrapMode.Repeat, filterMode = FilterMode.Trilinear,
            };
            var px = new byte[size * size];
            for (var y = 0; y < size; y++)
            for (var x = 0; x < size; x++)
            {
                var v = Noise(x, y, 4, 71) * 0.55f + Noise(x, y, 8, 72) * 0.3f + Noise(x, y, 16, 73) * 0.15f;
                // stretched a little from the middle, so the patches have some edge to them
                v = Mathf.Clamp01(0.5f + (v - 0.5f) * 1.6f);
                px[y * size + x] = (byte)Mathf.RoundToInt(v * 255);
            }
            macro.SetPixelData(px, 0);
            macro.Apply(true, true);
            return macro;
        }

        /// <summary>A soft round spot (white, its alpha fading out to the edge): contact shade under things on the ground.</summary>
        public static Texture2D SoftBlob()
        {
            if (blob) return blob;
            const int size = 64;
            blob = new Texture2D(size, size, TextureFormat.RGBA32, true)
            {
                name = "Soft blob", wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear,
            };
            var px = new Color32[size * size];
            for (var y = 0; y < size; y++)
            for (var x = 0; x < size; x++)
            {
                var dx = (x + 0.5f) / size * 2 - 1;
                var dy = (y + 0.5f) / size * 2 - 1;
                var d = Mathf.Sqrt(dx * dx + dy * dy);
                // dense in the middle, a long soft falloff
                var a = Mathf.Clamp01(1 - d);
                a = a * a * (3 - 2 * a);
                px[y * size + x] = new Color32(255, 255, 255, (byte)Mathf.RoundToInt(a * 255));
            }
            blob.SetPixels32(px);
            blob.Apply(true, true);
            return blob;
        }

        // ---------- the patterns (values 0…1, multiplied with the ground colour) ----------

        public static float[] Pixels(Pattern pattern)
        {
            var p = new float[Size * Size];
            var seed = (int)pattern * 977 + 13;
            for (var y = 0; y < Size; y++)
            for (var x = 0; x < Size; x++)
            {
                // soft mottling everywhere: big patches, then finer ones
                var mottle = Noise(x, y, 16, seed) * 0.6f + Noise(x, y, 32, seed + 1) * 0.4f;
                p[y * Size + x] = pattern switch
                {
                    Pattern.Grass => 0.9f + 0.07f * mottle,
                    Pattern.Leaves => 0.86f + 0.12f * mottle,
                    Pattern.Asphalt => 0.9f + 0.05f * mottle,
                    Pattern.Water => 0.9f + 0.03f * mottle,
                    Pattern.Sand or Pattern.Ripples => 0.91f + 0.06f * mottle,
                    Pattern.Lawn => 0.9f + 0.07f * mottle,
                    Pattern.Rock or Pattern.Rubble => 0.88f + 0.08f * mottle,
                    Pattern.Cracked => 0.9f + 0.06f * mottle,
                    _ => 0.92f + 0.05f * mottle,
                };
            }
            var r = new System.Random(seed);
            switch (pattern)
            {
                case Pattern.Grass:
                    // blades: short strokes leaning a little, dark ones with a lit tip beside them
                    for (var i = 0; i < 420; i++)
                    {
                        int x = r.Next(Size), y = r.Next(Size), len = 3 + r.Next(4);
                        var lean = r.Next(3) - 1;
                        for (var k = 0; k < len; k++)
                        {
                            Mul(p, x + (lean * k) / 3, y + k, 0.86f);
                            if (k == len - 1) Set(p, x + (lean * k) / 3 + 1, y + k, 1f);
                        }
                    }
                    break;
                case Pattern.Leaves:
                    for (var i = 0; i < 160; i++) Blob(p, r.Next(Size), r.Next(Size), 2 + r.Next(3), r.Next(2) == 0 ? 0.82f : 1.02f);
                    break;
                case Pattern.Asphalt:
                    // aggregate: dark and light specks
                    for (var i = 0; i < 1400; i++) Set(p, r.Next(Size), r.Next(Size), r.Next(3) == 0 ? 1f : 0.8f);
                    break;
                case Pattern.Sand:
                    for (var i = 0; i < 900; i++) Set(p, r.Next(Size), r.Next(Size), r.Next(2) == 0 ? 1f : 0.84f);
                    // pebbles
                    for (var i = 0; i < 26; i++)
                    {
                        int x = r.Next(Size), y = r.Next(Size);
                        Blob(p, x, y, 1 + r.Next(2), 0.8f);
                        Set(p, x - 1, y - 1, 1f);
                    }
                    break;
                case Pattern.Slabs:
                    Slabs(p, 32, 32, r, true);
                    break;
                case Pattern.Cobble:
                    Cobbles(p, r);
                    break;
                case Pattern.Boards:
                    Slabs(p, 128, 16, r, false); // sizes that divide the texture: no seam where it repeats
                    break;
                case Pattern.Water:
                    Caustics(p, r);
                    break;
                case Pattern.Rock:
                    RockSlabs(p, r);
                    break;
                case Pattern.Rubble:
                    for (var i = 0; i < 90; i++)
                    {
                        int x = r.Next(Size), y = r.Next(Size), rad = 1 + r.Next(4);
                        Blob(p, x, y, rad, r.Next(3) == 0 ? 1.06f : 0.8f);
                        Set(p, x - rad / 2, y - rad / 2, 1f); // each chunk's lit corner
                    }
                    for (var i = 0; i < 600; i++) Set(p, r.Next(Size), r.Next(Size), r.Next(2) == 0 ? 1f : 0.84f);
                    break;
                case Pattern.Lawn:
                    // mown stripes (half a tile each, the texture holds four) under the blades
                    for (var y = 0; y < Size; y++)
                    {
                        var k = (y / 32) % 2 == 0 ? 1f : 0.93f;
                        for (var x = 0; x < Size; x++) p[y * Size + x] *= k;
                    }
                    for (var i = 0; i < 380; i++)
                    {
                        int x = r.Next(Size), y = r.Next(Size), len = 2 + r.Next(3);
                        for (var k = 0; k < len; k++) Mul(p, x, y + k, 0.88f);
                    }
                    break;
                case Pattern.Ripples:
                    // ripples the wind left in the sand: soft wavy crests, lit on one side
                    for (var y = 0; y < Size; y++)
                    for (var x = 0; x < Size; x++)
                    {
                        var wave = Mathf.Sin((y + Noise(x, y, 4, seed + 9) * 22f) * Mathf.PI * 2 / 16f);
                        p[y * Size + x] *= wave > 0.75f ? 1.04f : wave < -0.6f ? 0.95f : 1f;
                    }
                    for (var i = 0; i < 500; i++) Set(p, r.Next(Size), r.Next(Size), r.Next(2) == 0 ? 1f : 0.86f);
                    break;
                case Pattern.Cracked:
                    Slabs(p, 64, 64, r, true);
                    Cracks(p, r, 14);
                    for (var i = 0; i < 18; i++) Blob(p, r.Next(Size), r.Next(Size), 2 + r.Next(5), 0.9f); // stains
                    break;
                default:
                    for (var i = 0; i < 700; i++) Set(p, r.Next(Size), r.Next(Size), r.Next(2) == 0 ? 1f : 0.86f);
                    break;
            }
            // never darker than half: the layer keeps its colour, the pattern only shades it
            for (var i = 0; i < p.Length; i++) p[i] = Mathf.Clamp(p[i], 0.55f, 1f);
            return p;
        }

        /// <summary>Paving slabs (or boards): a tint per slab, joints with a lit edge, a few specks.</summary>
        static void Slabs(float[] p, int w, int h, System.Random r, bool stagger)
        {
            var joint = stagger ? 0.84f : 0.9f; // boards: gentler seams than paving joints
            var rows = (Size + h - 1) / h; // a last, cut row when h does not divide the texture
            var cols = (Size + w - 1) / w;
            var tint = new float[rows, cols + 1];
            for (var j = 0; j < rows; j++)
            for (var i = 0; i <= cols; i++)
                tint[j, i] = 0.95f + (float)r.NextDouble() * 0.05f;
            for (var y = 0; y < Size; y++)
            for (var x = 0; x < Size; x++)
            {
                var row = y / h;
                var shift = stagger && row % 2 == 1 ? w / 2 : row % 2 == 1 ? w / 3 : 0;
                var xx = (x + shift) % Size;
                var col = xx / w;
                var lx = xx % w;
                var ly = y % h;
                var v = p[y * Size + x] * tint[row, col];
                if (lx == 0 || ly == 0) v *= joint; // the joint
                else if (lx == 1 || ly == 1) v = Mathf.Min(1, v * 1.04f); // its lit edge
                p[y * Size + x] = v;
            }
            for (var i = 0; i < 260; i++) Mul(p, r.Next(Size), r.Next(Size), 0.9f);
        }

        /// <summary>
        /// Water: a web of light like sunlight through ripples (the edges between tiling cells, bright where two cells
        /// meet, fading into the cell), drawn by the water shader in two layers drifting against each other.
        /// </summary>
        static void Caustics(float[] p, System.Random r)
        {
            const int points = 14;
            var px = new float[points];
            var py = new float[points];
            for (var i = 0; i < points; i++)
            {
                px[i] = (float)r.NextDouble() * Size;
                py[i] = (float)r.NextDouble() * Size;
            }
            for (var y = 0; y < Size; y++)
            for (var x = 0; x < Size; x++)
            {
                float f1 = float.MaxValue, f2 = float.MaxValue;
                for (var i = 0; i < points; i++)
                {
                    // the nearest copy of the point on the tiling texture
                    var dx = Mathf.Abs(x - px[i]);
                    var dy = Mathf.Abs(y - py[i]);
                    dx = Mathf.Min(dx, Size - dx);
                    dy = Mathf.Min(dy, Size - dy);
                    var d = Mathf.Sqrt(dx * dx + dy * dy);
                    if (d < f1)
                    {
                        f2 = f1;
                        f1 = d;
                    }
                    else if (d < f2) f2 = d;
                }
                var edge = Mathf.Clamp01(1 - (f2 - f1) / 7f);
                p[y * Size + x] = 0.86f + 0.14f * edge * edge;
            }
        }

        /// <summary>Bare rock: big irregular slabs with dark fissures between them, each its own shade, a few cracks.</summary>
        static void RockSlabs(float[] p, System.Random r)
        {
            const int points = 9;
            var px = new float[points];
            var py = new float[points];
            var tint = new float[points];
            for (var i = 0; i < points; i++)
            {
                px[i] = (float)r.NextDouble() * Size;
                py[i] = (float)r.NextDouble() * Size;
                tint[i] = 0.93f + (float)r.NextDouble() * 0.08f;
            }
            for (var y = 0; y < Size; y++)
            for (var x = 0; x < Size; x++)
            {
                float f1 = float.MaxValue, f2 = float.MaxValue;
                var nearest = 0;
                for (var i = 0; i < points; i++)
                {
                    var dx = Mathf.Abs(x - px[i]);
                    var dy = Mathf.Abs(y - py[i]);
                    dx = Mathf.Min(dx, Size - dx);
                    dy = Mathf.Min(dy, Size - dy);
                    var d = Mathf.Sqrt(dx * dx + dy * dy);
                    if (d < f1)
                    {
                        f2 = f1;
                        f1 = d;
                        nearest = i;
                    }
                    else if (d < f2) f2 = d;
                }
                var v = p[y * Size + x] * tint[nearest];
                var gap = f2 - f1;
                if (gap < 1.6f) v *= 0.78f; // the fissure
                else if (gap < 3f) v = Mathf.Min(1, v * 1.04f); // its lit lip
                p[y * Size + x] = v;
            }
            Cracks(p, r, 6);
        }

        /// <summary>Thin branching cracks (random walks that wrap round the texture).</summary>
        static void Cracks(float[] p, System.Random r, int count)
        {
            for (var c = 0; c < count; c++)
            {
                float x = r.Next(Size), y = r.Next(Size);
                var a = (float)(r.NextDouble() * Mathf.PI * 2);
                var len = 12 + r.Next(26);
                for (var k = 0; k < len; k++)
                {
                    a += (float)(r.NextDouble() - 0.5) * 0.9f;
                    x += Mathf.Cos(a);
                    y += Mathf.Sin(a);
                    Mul(p, Mathf.RoundToInt(x), Mathf.RoundToInt(y), 0.8f);
                }
            }
        }

        /// <summary>Cobbles: rounded stones in staggered rows with dark gaps.</summary>
        static void Cobbles(float[] p, System.Random r)
        {
            const int cell = 16;
            for (var y = 0; y < Size; y++)
            for (var x = 0; x < Size; x++)
            {
                var row = y / cell;
                var xx = (x + (row % 2) * cell / 2) % Size;
                var dx = xx % cell - cell / 2f + 0.5f;
                var dy = y % cell - cell / 2f + 0.5f;
                var d = Mathf.Sqrt(dx * dx * 0.8f + dy * dy) / (cell / 2f);
                var v = p[y * Size + x];
                if (d > 0.92f) v *= 0.76f;
                else if (dx + dy < -6) v = Mathf.Min(1, v * 1.05f); // the stone's lit top-left
                p[y * Size + x] = v;
            }
            for (var i = 0; i < 200; i++) Mul(p, r.Next(Size), r.Next(Size), 0.92f);
        }

        // ---------- helpers ----------

        static int Wrap(int v) => ((v % Size) + Size) % Size;

        /// <summary>A speck: 1 = a lit pixel, below 1 = at most that dark.</summary>
        static void Set(float[] p, int x, int y, float v)
        {
            var i = Wrap(y) * Size + Wrap(x);
            p[i] = v >= 1 ? 1 : Mathf.Min(p[i], v);
        }

        static void Mul(float[] p, int x, int y, float k) => p[Wrap(y) * Size + Wrap(x)] *= k;

        static void Blob(float[] p, int cx, int cy, int radius, float k)
        {
            for (var y = -radius; y <= radius; y++)
            for (var x = -radius; x <= radius; x++)
                if (x * x + y * y <= radius * radius)
                {
                    var i = Wrap(cy + y) * Size + Wrap(cx + x);
                    p[i] = Mathf.Min(1, p[i] * k);
                }
        }

        /// <summary>Smooth value noise that tiles over the texture (period = cells across).</summary>
        static float Noise(int x, int y, int cells, int seed)
        {
            var fx = x * cells / (float)Size;
            var fy = y * cells / (float)Size;
            int x0 = Mathf.FloorToInt(fx), y0 = Mathf.FloorToInt(fy);
            var tx = Smooth(fx - x0);
            var ty = Smooth(fy - y0);
            float H(int i, int j) => Hash(((i % cells) + cells) % cells, ((j % cells) + cells) % cells, seed);
            var a = Mathf.Lerp(H(x0, y0), H(x0 + 1, y0), tx);
            var b = Mathf.Lerp(H(x0, y0 + 1), H(x0 + 1, y0 + 1), tx);
            return Mathf.Lerp(a, b, ty);
        }

        static float Smooth(float t) => t * t * (3 - 2 * t);

        static float Hash(int x, int y, int seed)
        {
            unchecked
            {
                var h = (uint)(x * 374761393 + y * 668265263 + seed * 1442695041);
                h = (h ^ (h >> 13)) * 1274126177;
                return (h ^ (h >> 16)) / (float)uint.MaxValue;
            }
        }
    }
}
