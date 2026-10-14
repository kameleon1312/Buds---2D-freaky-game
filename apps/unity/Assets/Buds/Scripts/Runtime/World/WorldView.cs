using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Tilemaps;

namespace Buds.World
{
    /// <summary>
    /// Shows a WorldMap: smooth flat-coloured ground (styles from the map file) built as chunked meshes,
    /// props as y-sorted sprites from one atlas, and invisible tilemaps for collision. 1 tile = 1 world unit.
    /// 2.5D: the ground lies flat (the XY plane, where the physics live) and a tilted perspective camera
    /// (FollowCamera) looks north across it; props and characters stand up facing the camera (Upright), so the world
    /// gets depth while the map, collisions and art stay the same.
    /// Chunks and sprites outside the camera are culled, so big districts stay cheap on phones.
    /// </summary>
    public sealed class WorldView : MonoBehaviour
    {
        const int SortGround = -1000; // ground layers count up from here
        const int SortDecor = -100; // flat decorations: flowers, tufts, road markings…
        public const int ChunkTiles = 32;

        /// <summary>Camera tilt from straight down, in degrees (FollowCamera); things that stand up lean back by the same.</summary>
        public const float Tilt = 40f;
        /// <summary>Rotation of everything that stands up (props, characters): facing the tilted camera.</summary>
        public static readonly Quaternion Upright = Quaternion.Euler(-Tilt, 0, 0);
        /// <summary>Characters are drawn this much bigger than their sheet, and a bit wider: sturdier next to the props.</summary>
        public const float CharacterScale = 1.35f;
        public const float CharacterWidth = 1.12f;

        /// <summary>The standing child for a character: bigger and a little wider than its sheet.</summary>
        public static Transform StandCharacter(Transform parent)
        {
            var t = Stand(parent);
            t.localScale = new Vector3(CharacterScale * CharacterWidth, CharacterScale, 1);
            return t;
        }

        /// <summary>A child that stands up (rotated towards the camera); sprites go in here, physics stay on the parent.</summary>
        public static Transform Stand(Transform parent, string name = "Visual", float scale = 1f)
        {
            var t = new GameObject(name).transform;
            t.SetParent(parent, false);
            t.localRotation = Upright;
            t.localScale = Vector3.one * scale;
            return t;
        }

        static Sprite shadowSprite;

        /// <summary>A soft dark oval on the ground under a character (flat, under every sprite).</summary>
        public static SpriteRenderer Shadow(Transform parent, float width)
        {
            if (!shadowSprite)
            {
                const int w = 64, h = 32;
                var tex = new Texture2D(w, h, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp };
                for (var y = 0; y < h; y++)
                for (var x = 0; x < w; x++)
                {
                    var dx = (x + 0.5f) / w * 2 - 1;
                    var dy = (y + 0.5f) / h * 2 - 1;
                    var d = dx * dx + dy * dy;
                    tex.SetPixel(x, y, new Color(0.11f, 0.16f, 0.08f, Mathf.Clamp01((1 - d) * 2.2f) * 0.32f));
                }
                tex.Apply();
                shadowSprite = Sprite.Create(tex, new Rect(0, 0, w, h), new Vector2(0.5f, 0.5f), w);
            }
            var go = new GameObject("Shadow");
            go.transform.SetParent(parent, false);
            go.transform.localPosition = new Vector3(0, 0.08f, 0);
            go.transform.localScale = new Vector3(width, width, 1);
            var r = go.AddComponent<SpriteRenderer>();
            r.sprite = shadowSprite;
            r.sortingOrder = -96; // on the ground, under every character
            return r;
        }

        public WorldMap Map { get; private set; }

        /// <summary>Sprites lower on screen draw in front; shared by props and actors.</summary>
        public static int SortOrderFor(float worldY) => 10000 - Mathf.RoundToInt(worldY * 100);

        public static WorldView Create(WorldMap map)
        {
            var root = new GameObject("World " + map.Id, typeof(Grid));
            var view = root.AddComponent<WorldView>();
            view.Map = map;

            Colliders(root.transform, map);
            Ground(root.transform, map, SpriteMaterial());
            Props(root.transform, map);
            return view;
        }

        /// <summary>Map row 0 is the north edge; Unity's y grows upward.</summary>
        public static Vector3Int ToCell(int x, int y, int mapHeight) => new(x, mapHeight - 1 - y, 0);

        public Vector3 CellCenter(int x, int y) => (Vector3)ToCell(x, y, Map.Height) + new Vector3(0.5f, 0.5f, 0);

        // ---------- collision ----------

        static void Colliders(Transform parent, WorldMap map)
        {
            var go = new GameObject("Collision", typeof(Tilemap));
            go.transform.SetParent(parent, false);
            var solid = ScriptableObject.CreateInstance<Tile>();
            solid.colliderType = Tile.ColliderType.Grid;
            var positions = new List<Vector3Int>();
            for (var y = 0; y < map.Height; y++)
            for (var x = 0; x < map.Width; x++)
                if (map.Solid[y, x]) positions.Add(ToCell(x, y, map.Height));
            var tiles = new TileBase[positions.Count];
            Array.Fill(tiles, solid);
            go.GetComponent<Tilemap>().SetTiles(positions.ToArray(), tiles);
            var collider = go.AddComponent<TilemapCollider2D>();
            collider.compositeOperation = Collider2D.CompositeOperation.Merge; // one shape instead of thousands
            go.AddComponent<Rigidbody2D>().bodyType = RigidbodyType2D.Static;
            go.AddComponent<CompositeCollider2D>();

            // the map's outline: exits lead to other districts, never into the void
            parent.gameObject.AddComponent<EdgeCollider2D>().points = new[]
            {
                new Vector2(0, 0), new Vector2(map.Width, 0), new Vector2(map.Width, map.Height), new Vector2(0, map.Height),
                new Vector2(0, 0),
            };
        }

        // ---------- ground ----------

        static void Ground(Transform parent, WorldMap map, Material material)
        {
            var w = map.Width;
            var h = map.Height;
            var root = new GameObject("Ground").transform;
            root.SetParent(parent, false);
            var order = SortGround;

            var baseMesh = new GroundMesh();
            // the base reaches far beyond the map: the tilted camera sees further towards the horizon
            baseMesh.Vertices.AddRange(new[]
            {
                new Vector3(-40, -12), new Vector3(w + 40, -12), new Vector3(w + 40, h + 60), new Vector3(-40, h + 60),
            });
            baseMesh.Triangles.AddRange(new[] { 0, 2, 1, 0, 3, 2 });
            Layer(root, "Base", baseMesh, map.BaseColor, order++, material);

            var chunk = ChunkTiles * GroundShapes.SamplesPerTile;
            var nx = w * GroundShapes.SamplesPerTile;
            var ny = h * GroundShapes.SamplesPerTile;
            foreach (var style in map.GroundStyles)
            {
                var kinds = new HashSet<string>(style.Kinds);
                var field = GroundShapes.Field((x, y) => kinds.Contains(map.GroundAt(x, y)), w, h, style.Radius);
                foreach (var (threshold, color) in style.Bands)
                {
                    for (var j0 = 0; j0 < ny; j0 += chunk)
                    for (var i0 = 0; i0 < nx; i0 += chunk)
                    {
                        var mesh = GroundShapes.Contour(field, threshold, h, i0, j0, Mathf.Min(i0 + chunk, nx),
                            Mathf.Min(j0 + chunk, ny));
                        Layer(root, $"{style.Name} {threshold:0.00} [{i0 / chunk},{j0 / chunk}]", mesh, color, order, material);
                    }
                    order++;
                }
            }
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

        /// <summary>Every prop the map shows: placed ones plus scattered decorations. Deterministic.</summary>
        public static List<PropSpot> AllProps(WorldMap map)
        {
            var all = new List<PropSpot>(map.Props);
            var occupied = new HashSet<long>();
            var byCell = new Dictionary<long, string>();
            foreach (var p in map.Props)
            {
                occupied.Add(p.Y * (long)map.Width + p.X);
                byCell[p.Y * (long)map.Width + p.X] = p.Name;
            }
            // fences: "x-post" cells get "x-h" rails to an east neighbour and "x-v" rails up to a north neighbour
            foreach (var p in map.Props)
            {
                if (!p.Name.EndsWith("-post")) continue;
                var kit = p.Name.Substring(0, p.Name.Length - 5);
                if (byCell.TryGetValue(p.Y * (long)map.Width + p.X + 1, out var east) && east == p.Name)
                    all.Add(new PropSpot { Name = kit + "-h", X = p.X, Y = p.Y });
                if (p.Y > 0 && byCell.TryGetValue((p.Y - 1) * (long)map.Width + p.X, out var north) && north == p.Name)
                    all.Add(new PropSpot { Name = kit + "-v", X = p.X, Y = p.Y });
            }
            for (var y = 0; y < map.Height; y++)
            for (var x = 0; x < map.Width; x++)
            {
                if (map.Solid[y, x] || occupied.Contains(y * (long)map.Width + x)) continue;
                var ground = map.GroundAt(x, y);
                for (var r = 0; r < map.Scatter.Count; r++)
                {
                    var rule = map.Scatter[r];
                    if (rule.Ground != ground || MapFormat.Hash(x, y, 7 + r) >= rule.Chance) continue;
                    all.Add(new PropSpot { Name = MapFormat.Pick(rule.Props, x, y, 13 + r), X = x, Y = y, Scattered = true });
                    break;
                }
            }
            return all;
        }

        static void Props(Transform parent, WorldMap map)
        {
            var spots = AllProps(map);
            var names = new HashSet<string>();
            foreach (var s in spots) names.Add(s.Name);
            var art = PropArt.Load(names);

            var root = new GameObject("Props").transform;
            root.SetParent(parent, false);
            foreach (var spot in spots)
            {
                var sprite = art.Get(spot.Name);
                if (!sprite) continue;
                var flat = art.IsFlat(spot.Name);
                var baseY = map.Height - 1 - spot.Y; // bottom edge of the cell in world units
                // scattered decorations wander a little inside their cell so they don't look planted in rows
                var jx = spot.Scattered ? (MapFormat.Hash(spot.X, spot.Y, 3) - 0.5f) * 0.5f : 0;
                var jy = spot.Scattered ? MapFormat.Hash(spot.X, spot.Y, 5) * 0.4f : 0;
                var go = new GameObject(spot.Name);
                go.transform.SetParent(root, false);
                go.transform.localPosition = new Vector3(spot.X + 0.5f + jx, baseY + 0.1f + jy, 0);
                if (!flat) go.transform.localRotation = Upright; // buildings, trees, lamps stand up; flowers and markings lie flat
                var r = go.AddComponent<SpriteRenderer>();
                r.sprite = sprite;
                r.sortingOrder = flat ? SortDecor : SortOrderFor(baseY + 0.1f);
            }
        }
    }
}
