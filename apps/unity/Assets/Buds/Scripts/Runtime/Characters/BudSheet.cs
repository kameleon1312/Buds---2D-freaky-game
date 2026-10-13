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

        public int Scale { get; }

        public BudSheet(Texture2D source)
        {
            Scale = ScaleOf(source.width, source.height);
            // scale 1 = legacy pixel art (crisp); larger = smooth vector art, downscaled with mipmaps
            var texture = Scale > 1 ? WithMipmaps(source) : source;
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
