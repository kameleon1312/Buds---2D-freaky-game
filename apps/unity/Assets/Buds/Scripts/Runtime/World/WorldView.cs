using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Tilemaps;

namespace Buds.World
{
    /// <summary>
    /// Shows a WorldMap: smooth flat-coloured ground (rounded paths, a layered pond, garden bed) built as meshes,
    /// vector props (trees, cottages, fence…) as y-sorted sprites, and invisible tilemaps for collision.
    /// 1 tile = 1 world unit.
    /// </summary>
    public sealed class WorldView : MonoBehaviour
    {
        const int SortGround = -1000; // ground layers count up from here
        const int SortDecor = -100; // flat decorations: flowers, tufts, pebbles, lily pads

        public WorldMap Map { get; private set; }

        /// <summary>Sprites lower on screen draw in front; shared by props and actors.</summary>
        public static int SortOrderFor(float worldY) => 10000 - Mathf.RoundToInt(worldY * 100);

        public static WorldView Create(WorldMap map)
        {
            var root = new GameObject("World", typeof(Grid));
            var view = root.AddComponent<WorldView>();
            view.Map = map;

            Colliders(root.transform, "Ground", map.Ground, map);
            Colliders(root.transform, "Objects", map.Objects, map);
            var material = SpriteMaterial();
            Ground(root.transform, map, material);
            Props(root.transform, map, PropArt.Load());
            return view;
        }

        /// <summary>Map row 0 is the north edge; Unity's y grows upward.</summary>
        public static Vector3Int ToCell(int x, int y, int mapHeight) => new(x, mapHeight - 1 - y, 0);

        public Vector3 CellCenter(int x, int y) => (Vector3)ToCell(x, y, Map.Height) + new Vector3(0.5f, 0.5f, 0);

        // ---------- collision ----------

        static void Colliders(Transform parent, string name, int[,] data, WorldMap map)
        {
            var go = new GameObject(name + "Collision", typeof(Tilemap));
            go.transform.SetParent(parent, false);
            var tilemap = go.GetComponent<Tilemap>();
            var solid = ScriptableObject.CreateInstance<Tile>();
            solid.colliderType = Tile.ColliderType.Grid;

            var positions = new List<Vector3Int>();
            for (var y = 0; y < map.Height; y++)
            for (var x = 0; x < map.Width; x++)
                if (Tiles.IsSolid(data[y, x])) positions.Add(ToCell(x, y, map.Height));
            var tiles = new TileBase[positions.Count];
            Array.Fill(tiles, solid);
            tilemap.SetTiles(positions.ToArray(), tiles);
            go.AddComponent<TilemapCollider2D>();
        }

        // ---------- ground ----------

        static readonly Color Grass = Hex("#86c95a");
        static readonly Color GrassPatch = Hex("#7bbf51");

        static void Ground(Transform parent, WorldMap map, Material material)
        {
            var w = map.Width;
            var h = map.Height;
            var order = SortGround;

            // grass base, a little bigger than the map
            var baseMesh = new GroundMesh();
            baseMesh.Vertices.AddRange(new[]
            {
                new Vector3(-2, -2), new Vector3(w + 2, -2), new Vector3(w + 2, h + 2), new Vector3(-2, h + 2),
            });
            baseMesh.Triangles.AddRange(new[] { 0, 2, 1, 0, 3, 2 });
            Layer(parent, "Grass", baseMesh, Grass, order++, material);

            bool Is(int x, int y, int tile) => map.Ground[y, x] == tile;

            // soft darker patches where the grass varies
            var patches = GroundShapes.Field((x, y) => Is(x, y, Tiles.Grass2), w, h, 2.2f);
            Layer(parent, "GrassPatches", GroundShapes.Contour(patches, 0.3f, h), GrassPatch, order++, material);

            var path = GroundShapes.Field((x, y) => Is(x, y, Tiles.Path), w, h);
            Bands(parent, "Path", path, h, material, ref order, (0.36f, "#d8b878"), (0.48f, "#ecd3a0"));

            // the pond is a tile ellipse: a wide radius turns its staircase into a smooth curve
            var shore = GroundShapes.Field((x, y) => Is(x, y, Tiles.Shore) || Is(x, y, Tiles.Water), w, h, 2.4f);
            Bands(parent, "Shore", shore, h, material, ref order, (0.42f, "#e2c98f"), (0.5f, "#f1dfae"));

            var water = GroundShapes.Field((x, y) => Is(x, y, Tiles.Water), w, h, 2.4f);
            Bands(parent, "Water", water, h, material, ref order,
                (0.44f, "#3f93c9"), (0.5f, "#c4ecfc"), (0.56f, "#5cbdeb"), (0.88f, "#48a8de"));

            // the garden bed: only flower cells with flower neighbours (scattered single clumps stay on grass)
            bool Bed(int x, int y)
            {
                if (!Is(x, y, Tiles.Flowers)) return false;
                var n = 0;
                if (x > 0 && Is(x - 1, y, Tiles.Flowers)) n++;
                if (x < w - 1 && Is(x + 1, y, Tiles.Flowers)) n++;
                if (y > 0 && Is(x, y - 1, Tiles.Flowers)) n++;
                if (y < h - 1 && Is(x, y + 1, Tiles.Flowers)) n++;
                return n >= 2;
            }
            var bed = GroundShapes.Field(Bed, w, h);
            Bands(parent, "GardenBed", bed, h, material, ref order, (0.52f, "#7a5236"), (0.58f, "#9c6b45"));
        }

        static void Bands(Transform parent, string name, float[,] field, int mapHeight, Material material, ref int order,
            params (float threshold, string color)[] bands)
        {
            foreach (var (threshold, color) in bands)
                Layer(parent, $"{name}{threshold:0.00}", GroundShapes.Contour(field, threshold, mapHeight), Hex(color), order++,
                    material);
        }

        static void Layer(Transform parent, string name, GroundMesh data, Color color, int order, Material material)
        {
            if (data.Triangles.Count == 0) return;
            var mesh = new Mesh { name = name, indexFormat = IndexFormat.UInt32 };
            mesh.SetVertices(data.Vertices);
            mesh.SetTriangles(data.Triangles, 0);
            var colors = new Color[data.Vertices.Count];
            Array.Fill(colors, color);
            mesh.colors = colors;
            mesh.RecalculateBounds();

            var go = new GameObject(name, typeof(MeshFilter), typeof(MeshRenderer));
            go.transform.SetParent(parent, false);
            go.GetComponent<MeshFilter>().sharedMesh = mesh;
            var renderer = go.GetComponent<MeshRenderer>();
            renderer.sharedMaterial = material;
            renderer.sortingOrder = order;
            renderer.shadowCastingMode = ShadowCastingMode.Off;
        }

        /// <summary>The default sprite material (always in the build) with a white texture: tinted by vertex colour.</summary>
        static Material SpriteMaterial()
        {
            var probe = new GameObject("probe").AddComponent<SpriteRenderer>();
            var material = new Material(probe.sharedMaterial) { name = "Ground", mainTexture = Texture2D.whiteTexture };
            DestroyImmediate(probe.gameObject);
            return material;
        }

        // ---------- props ----------

        static void Props(Transform parent, WorldMap map, PropArt art)
        {
            var root = new GameObject("Props").transform;
            root.SetParent(parent, false);
            var h = map.Height;

            void Place(string name, float x, float y, bool flat = false)
            {
                var sprite = art.Get(name);
                if (!sprite) return;
                var go = new GameObject(name);
                go.transform.SetParent(root, false);
                go.transform.localPosition = new Vector3(x, y, 0);
                var r = go.AddComponent<SpriteRenderer>();
                r.sprite = sprite;
                r.sortingOrder = flat ? SortDecor : SortOrderFor(y);
            }

            var houses = 0;
            for (var y = 0; y < h; y++)
            for (var x = 0; x < map.Width; x++)
            {
                var o = map.Objects[y, x];
                var g = map.Ground[y, x];
                var r = Noise(x, y);
                var baseY = h - 1 - y; // bottom edge of the cell in world units
                var jitter = (Noise(y, x) - 0.5f) * 0.2f;
                switch (o)
                {
                    case Tiles.TreeTrunk:
                        Place(r < 0.5f ? "tree-a" : r < 0.85f ? "tree-b" : "tree-c", x + 0.5f + jitter, baseY + 0.05f);
                        break;
                    case Tiles.Bush:
                        Place(r < 0.6f ? "bush-a" : "bush-b", x + 0.5f, baseY + 0.1f);
                        break;
                    case Tiles.Rock:
                        Place(r < 0.5f ? "rock-a" : "rock-b", x + 0.5f, baseY + 0.12f);
                        break;
                    case Tiles.Door:
                        Place(new[] { "house-red", "house-blue", "house-teal" }[houses++ % 3], x + 0.5f, baseY);
                        break;
                    case Tiles.Sign:
                        Place("sign", x + 0.5f, baseY + 0.1f);
                        break;
                    case Tiles.Fence:
                        Place("fence-post", x + 0.5f, baseY + 0.2f);
                        if (x + 1 < map.Width && map.Objects[y, x + 1] == Tiles.Fence)
                            Place("fence-h", x + 0.5f, baseY + 0.2f);
                        if (y > 0 && map.Objects[y - 1, x] == Tiles.Fence) Place("fence-v", x + 0.5f, baseY + 0.2f);
                        break;
                }

                if (o != Tiles.Empty) continue;
                if (g == Tiles.Flowers)
                    Place(r < 0.34f ? "flowers-a" : r < 0.67f ? "flowers-b" : "flowers-c", x + 0.5f + jitter, baseY + 0.3f, true);
                else if (g == Tiles.Grass2 && r < 0.3f) Place("tuft", x + 0.3f + jitter * 3, baseY + 0.4f, true);
                else if (g == Tiles.Path && r < 0.05f) Place("pebbles", x + 0.5f + jitter * 2, baseY + 0.4f, true);
                else if (g == Tiles.Water && r < 0.12f) Place("lily", x + 0.5f + jitter * 2, baseY + 0.3f, true);
            }
        }

        /// <summary>Deterministic 0..1 hash of a cell, so the decoration is the same every run.</summary>
        static float Noise(int x, int y)
        {
            unchecked
            {
                var n = (uint)(x * 374761393 + y * 668265263);
                n = (n ^ (n >> 13)) * 1274126177;
                return ((n ^ (n >> 16)) & 0xffffff) / (float)0x1000000;
            }
        }

        static Color Hex(string hex) => ColorUtility.TryParseHtmlString(hex, out var c) ? c : Color.magenta;
    }
}
