using UnityEngine;

namespace Buds.Characters
{
    public enum Facing
    {
        Down = 0,
        Side = 1, // faces left; flip the renderer for right
        Up = 2,
    }

    /// <summary>
    /// Slices the API sprite sheet: columns = walk frames 0..2, rows (top to bottom) = down, side, up.
    /// The sheet may be scaled by an integer factor; cells are detected from the texture size.
    /// </summary>
    public sealed class BudSheet
    {
        public const int CellW = 16;
        public const int CellH = 24;
        public const int Frames = 3;
        public const int Rows = 3;
        /// <summary>Feet rest 1/12 above the cell bottom (y = 220 of the 240-unit vector frame).</summary>
        public const float PivotY = 2f / CellH;

        readonly Sprite[,] sprites = new Sprite[Rows, Frames];
        readonly Sprite[] handCaps = new Sprite[Frames];
        readonly Texture2D texture;
        readonly bool ownsTexture;

        static readonly System.Collections.Generic.Dictionary<Texture2D, BudSheet> shared = new();

        /// <summary>
        /// One sheet per texture from Resources (NPCs, opponents): every map that shows them reuses it instead of
        /// copying the texture again.
        /// </summary>
        public static BudSheet Shared(Texture2D source)
        {
            if (shared.TryGetValue(source, out var sheet)) return sheet;
            return shared[source] = new BudSheet(source);
        }

        public int Scale { get; }

        /// <param name="downloaded">The texture came from the network: free it once copied with mipmaps.</param>
        public BudSheet(Texture2D source, bool downloaded = false)
        {
            Scale = ScaleOf(source.width, source.height);
            // scale 1 = legacy pixel art (crisp); larger = smooth vector art, downscaled with mipmaps
            texture = Scale > 1 ? WithMipmaps(source) : source;
            ownsTexture = texture != source;
            if (ownsTexture && downloaded) Object.Destroy(source);
            texture.filterMode = Scale > 1 ? FilterMode.Trilinear : FilterMode.Point;
            texture.wrapMode = TextureWrapMode.Clamp;
            for (var row = 0; row < Rows; row++)
            for (var frame = 0; frame < Frames; frame++)
            {
                sprites[row, frame] = Sprite.Create(
                    texture,
                    FrameRect((Facing)row, frame, Scale, texture.height),
                    new Vector2(0.5f, PivotY),
                    16 * Scale, // 16 sheet pixels = one world unit (one tile)
                    0,
                    SpriteMeshType.FullRect);
            }
        }

        public Sprite Get(Facing facing, int frame) => sprites[(int)facing, frame];

        // the near hand in the side frames, from packages/shared vector.ts: the arm hangs from the shoulder (60, 74)
        // to the hand (61, 107), swings ±22° on the steps, the body drops 9 and bobs 1.5 on a step, the side figure is
        // 1.12× wider around x 60 and everything sits in the frame at translate(5 32.5) scale(1.25)
        const float SvgPerUnit = 160f, FeetY = 220f, HandRadius = 10f;

        /// <summary>Where the near hand is in a side frame (facing left), in units from the feet: weapons go here.</summary>
        public static Vector2 SideHand(int frame)
        {
            var swing = (frame == 1 ? 22f : frame == 2 ? -22f : 0f) * Mathf.Deg2Rad;
            float dx = 61 - 60, dy = 107 - 74;
            var x = 60 + dx * Mathf.Cos(swing) - dy * Mathf.Sin(swing);
            var y = 74 + dx * Mathf.Sin(swing) + dy * Mathf.Cos(swing) + 9 + (frame == 0 ? 0 : -2f);
            x = 60 + (x - 60) * 1.2f;
            var fx = 5 + 1.25f * x;
            var fy = 32.5f + 1.25f * y;
            return new Vector2((fx - SvgPerUnit / 2) / SvgPerUnit, (FeetY - fy) / SvgPerUnit);
        }

        /// <summary>
        /// The near hand cut out of a side frame (centred on <see cref="SideHand"/>): drawn over a held weapon's grip
        /// so the fingers close around it instead of the weapon floating in front of the hand.
        /// </summary>
        public Sprite SideHandCap(int frame)
        {
            frame = Mathf.Clamp(frame, 0, Frames - 1);
            if (handCaps[frame]) return handCaps[frame];
            var cell = FrameRect(Facing.Side, frame, Scale, texture.height);
            var hand = SideHand(frame);
            var px = Scale * CellW / SvgPerUnit; // texture pixels per vector unit
            var cx = cell.x + cell.width / 2 + hand.x * SvgPerUnit * px;
            var cy = cell.y + PivotY * cell.height + hand.y * SvgPerUnit * px;
            var r = HandRadius * 1.25f * px;
            var rect = new Rect(Mathf.Round(cx - r), Mathf.Round(cy - r), Mathf.Round(r * 2), Mathf.Round(r * 2));
            var pivot = new Vector2((cx - rect.x) / rect.width, (cy - rect.y) / rect.height);
            handCaps[frame] = Sprite.Create(texture, rect, pivot, 16 * Scale, 0, SpriteMeshType.FullRect);
            return handCaps[frame];
        }

        /// <summary>Frees what this sheet made (its frames and its own copy of the texture); not for shared sheets.</summary>
        public void Dispose()
        {
            if (shared.ContainsValue(this)) return;
            foreach (var s in sprites)
                if (s) Object.Destroy(s);
            foreach (var s in handCaps)
                if (s) Object.Destroy(s);
            if (ownsTexture && texture) Object.Destroy(texture);
        }

        /// <summary>Downloaded textures have no mip chain; build one so the bud stays smooth when small.</summary>
        static Texture2D WithMipmaps(Texture2D source)
        {
            if (source.mipmapCount > 1 || !source.isReadable) return source;
            var copy = new Texture2D(source.width, source.height, TextureFormat.RGBA32, true) { name = source.name };
            copy.SetPixels32(source.GetPixels32());
            copy.Apply(true, true);
            return copy;
        }

        public static int ScaleOf(int width, int height)
        {
            if (width % (CellW * Frames) != 0 || height % (CellH * Rows) != 0)
                throw new System.ArgumentException($"Unexpected bud sheet size {width}×{height}");
            var scale = width / (CellW * Frames);
            if (height / (CellH * Rows) != scale) throw new System.ArgumentException("Bud sheet is not uniformly scaled");
            return scale;
        }

        /// <summary>Pixel rect of a cell. Unity textures start bottom-left, the sheet is laid out top-down.</summary>
        public static Rect FrameRect(Facing facing, int frame, int scale, int textureHeight)
        {
            var w = CellW * scale;
            var h = CellH * scale;
            return new Rect(frame * w, textureHeight - ((int)facing + 1) * h, w, h);
        }
    }
}
