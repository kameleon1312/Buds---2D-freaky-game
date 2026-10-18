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
        /// <summary>1: the sheets themselves are drawn sturdy now (BULK in packages/shared vector.ts).</summary>
        public const float CharacterWidth = 1f;

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

        /// <summary>The props' atlas of this map, freed with it.</summary>
        PropArt art;

        /// <summary>
        /// A map's meshes, materials and atlas are its own: they go when it goes (Destroy on the GameObject alone keeps
        /// them, and a phone ran out of memory after a few trips between districts).
        /// </summary>
        void OnDestroy()
        {
            foreach (var f in GetComponentsInChildren<MeshFilter>(true))
                if (f.sharedMesh) Destroy(f.sharedMesh);
            var materials = new HashSet<Material>();
            foreach (var r in GetComponentsInChildren<MeshRenderer>(true))
                if (r.sharedMaterial) materials.Add(r.sharedMaterial);
            foreach (var m in materials) Destroy(m);
            water.Clear();
            art?.Dispose();
        }

        /// <summary>Whether the map shown is outdoors (the sun casts shadows) or a room.</summary>
        public static bool Sunlit { get; private set; } = true;

        /// <summary>Highest standing sort order; markers above the world use 20000.</summary>
        const int SortStandTop = 18000;
        /// <summary>The order at worldY 0: room to spare south of the map (down to y -10) and north of it (up to y 170).</summary>
        const int SortStandZero = 17000;
        /// <summary>Lowest standing sort order: always above the ground (-1000…) and flat decorations (-100…-90).</summary>
        const int SortStandBottom = 0;

        /// <summary>
        /// Sprites lower on screen draw in front; shared by props and actors. Kept between SortStandBottom and
        /// SortStandTop for every map row (districts are 132 rows: 17000…3800), so nothing standing ever slips under
        /// the ground or a road marking at the north end of a map.
        /// </summary>
        public static int SortOrderFor(float worldY) =>
            Mathf.Clamp(SortStandZero - Mathf.RoundToInt(worldY * 100), SortStandBottom, SortStandTop);

        public static WorldView Create(WorldMap map)
        {
            var root = new GameObject("World " + map.Id, typeof(Grid));
            var view = root.AddComponent<WorldView>();
            view.Map = map;
            Sunlit = !map.IsInterior;

            Colliders(root.transform, map);
            var material = SpriteMaterial();
            Ground(root.transform, map, material);
            Props(view, root.transform, map, material);
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
            // every layer gets its material's surface (GroundLook): grass blades, paving slabs, asphalt grain, ripples…
            var surfaces = new Dictionary<GroundLook.Pattern, Material>();
            Material Surface(GroundLook.Pattern pattern)
            {
                if (surfaces.TryGetValue(pattern, out var m)) return m;
                m = new Material(material) { name = "Ground " + pattern, mainTexture = GroundLook.Texture(pattern) };
                if (pattern == GroundLook.Pattern.Water) water.Add(m);
                return surfaces[pattern] = m;
            }
            var basePattern = map.IsInterior ? GroundLook.Pattern.Grain : GroundLook.Pattern.Grass;
            Layer(root, "Base", baseMesh, map.BaseColor * GroundLook.Gain(basePattern), order++, Surface(basePattern));

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
                        var pattern = GroundLook.For(style.Name);
                        Layer(root, $"{style.Name} {threshold:0.00} [{i0 / chunk},{j0 / chunk}]", mesh, color * GroundLook.Gain(pattern), order,
                            Surface(pattern));
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
            // the surface texture is laid in world space, so neighbouring layers and chunks line up
            var uvs = new Vector2[data.Vertices.Count];
            for (var i = 0; i < uvs.Length; i++) uvs[i] = (Vector2)data.Vertices[i] / GroundLook.Span;
            mesh.uv = uvs;
            color.a = 1;
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

        // ---------- light: cast shadows and wind ----------

        /// <summary>
        /// The low sun stands behind the camera, to the south-west: everything standing outdoors lays a flat copy of its
        /// silhouette on the ground, stretched north-east (x += ShadowShear·h, y = ShadowLength·h), so buildings and
        /// trees get weight and the street gets depth. Indoors there is no sun.
        /// </summary>
        public const float ShadowShear = 0.42f, ShadowLength = 0.5f;
        public static readonly Color ShadowColor = new(0.04f, 0.07f, 0.13f, 0.26f);
        const int SortCastShadow = -97; // over the ground and road markings, under the characters' own shadows

        /// <summary>A sprite's vertex laid on the ground as its shadow (the part under the ground point stays put).</summary>
        public static Vector2 ShadowPoint(Vector2 v) =>
            v.y <= 0 ? v : new Vector2(v.x + v.y * ShadowShear, v.y * ShadowLength);

        static bool CastsShadow(string name) =>
            !name.StartsWith("marker-") && !name.StartsWith("item-") && !name.StartsWith("jazda-") && !name.StartsWith("skrytka-")
            && name != "blysk";

        /// <summary>Plants move in the wind: how much (degrees at the top) by prop name, 0 = still.</summary>
        public static float SwayFor(string name)
        {
            if (name.StartsWith("bush") || name.StartsWith("krzak") || name == "paproc") return 2.4f;
            if (name.StartsWith("palm")) return 1.8f;
            if (name.StartsWith("tree") || name.StartsWith("jungle") || name == "sosna" || name == "swierk") return 1.1f;
            if (name == "balony") return 3f;
            return 0;
        }

        /// <summary>The wind at a place and time: slow gusts that roll across the map from the west.</summary>
        public static float Wind(float x, float y, float t)
        {
            var phase = x * 0.31f + y * 0.17f;
            var gust = 0.65f + 0.35f * Mathf.Sin(t * 0.37f - x * 0.05f);
            return gust * (Mathf.Sin(t * 1.4f + phase) * 0.75f + Mathf.Sin(t * 0.61f + phase * 0.5f) * 0.25f);
        }

        readonly List<(Transform t, float amp, Vector2 at)> swaying = new();

        /// <summary>Water surfaces of this map: their ripples drift slowly.</summary>
        static readonly List<Material> water = new();

        void Update()
        {
            var drift = new Vector2(Time.time * 0.035f, Mathf.Sin(Time.time * 0.4f) * 0.03f);
            for (var i = water.Count - 1; i >= 0; i--)
            {
                if (!water[i]) water.RemoveAt(i);
                else water[i].mainTextureOffset = drift;
            }
            if (swaying.Count == 0) return;
            var cam = Camera.main;
            if (!cam) return;
            var c = (Vector2)cam.transform.position;
            var time = Time.time;
            foreach (var (t, amp, at) in swaying)
            {
                // only what the camera can see (it sits south of the view, looking north)
                var dx = at.x - c.x;
                var dy = at.y - c.y;
                if (dx * dx > 900 || dy < -12 || dy > 40) continue;
                t.localRotation = Upright * Quaternion.Euler(0, 0, amp * Wind(at.x, at.y, time));
            }
        }

        /// <summary>How far a cast shadow's quad is pulled in from its sprite's edges (atlas texels).</summary>
        const float ShadowInsetTexels = 6;

        static (Vector2 min, Vector2 max) Bounds(Vector2[] points)
        {
            Vector2 min = points[0], max = points[0];
            foreach (var p in points)
            {
                min = Vector2.Min(min, p);
                max = Vector2.Max(max, p);
            }
            return (min, max);
        }

        sealed class ShadowBatch
        {
            public readonly List<Vector3> Vertices = new();
            public readonly List<Vector2> Uvs = new();
            public readonly List<int> Triangles = new();
        }

        static void Props(WorldView view, Transform parent, WorldMap map, Material groundMaterial)
        {
            var shadows = new Dictionary<(Texture tex, int cx, int cy), ShadowBatch>();
            var spots = AllProps(map);
            var names = new HashSet<string>();
            foreach (var s in spots) names.Add(s.Name);
            var art = view.art = PropArt.Load(names);

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
                if (flat) continue;
                var sway = SwayFor(spot.Name);
                // scattered plants sway a little less and each its own way
                if (sway > 0) view.swaying.Add((go.transform, sway * (spot.Scattered ? 0.8f : 1f), go.transform.localPosition));
                if (map.IsInterior || !CastsShadow(spot.Name)) continue;
                var key = (sprite.texture as Texture, (int)(spot.X / ChunkTiles), (int)(baseY / ChunkTiles));
                if (!shadows.TryGetValue(key, out var batch)) shadows[key] = batch = new ShadowBatch();
                var at = (Vector2)go.transform.localPosition;
                var first = batch.Vertices.Count;
                // the quad pulled in a few texels on every side: far away (small mips) its edges would pick up the
                // neighbours in the atlas and draw faint lines on the ground
                var verts = sprite.vertices;
                var uvs = sprite.uv;
                var (vMin, vMax) = Bounds(verts);
                var (uvMin, uvMax) = Bounds(uvs);
                var inset = ShadowInsetTexels / sprite.pixelsPerUnit;
                var uvInset = new Vector2((uvMax.x - uvMin.x) * inset / Mathf.Max(0.01f, vMax.x - vMin.x),
                    (uvMax.y - uvMin.y) * inset / Mathf.Max(0.01f, vMax.y - vMin.y));
                for (var k = 0; k < verts.Length; k++)
                {
                    var v = verts[k];
                    v.x += v.x <= (vMin.x + vMax.x) / 2 ? inset : -inset;
                    v.y += v.y <= (vMin.y + vMax.y) / 2 ? inset : -inset;
                    var uv = uvs[k];
                    uv.x += uv.x <= (uvMin.x + uvMax.x) / 2 ? uvInset.x : -uvInset.x;
                    uv.y += uv.y <= (uvMin.y + uvMax.y) / 2 ? uvInset.y : -uvInset.y;
                    batch.Vertices.Add(at + ShadowPoint(v));
                    batch.Uvs.Add(uv);
                }
                foreach (var i in sprite.triangles) batch.Triangles.Add(first + i);
            }

            var shadowRoot = new GameObject("Shadows").transform;
            shadowRoot.SetParent(parent, false);
            var materials = new Dictionary<Texture, Material>();
            foreach (var ((tex, cx, cy), batch) in shadows)
            {
                if (!materials.TryGetValue(tex, out var material))
                    materials[tex] = material = new Material(groundMaterial) { name = "Cast shadows", mainTexture = tex };
                var mesh = new Mesh { name = $"Shadows [{cx},{cy}]", indexFormat = IndexFormat.UInt32 };
                mesh.SetVertices(batch.Vertices);
                mesh.SetUVs(0, batch.Uvs);
                mesh.SetTriangles(batch.Triangles, 0);
                var colors = new Color[batch.Vertices.Count];
                Array.Fill(colors, ShadowColor);
                mesh.colors = colors;
                mesh.RecalculateBounds();
                var go = new GameObject(mesh.name, typeof(MeshFilter), typeof(MeshRenderer));
                go.transform.SetParent(shadowRoot, false);
                go.GetComponent<MeshFilter>().sharedMesh = mesh;
                var renderer = go.GetComponent<MeshRenderer>();
                renderer.sharedMaterial = material;
                renderer.sortingOrder = SortCastShadow;
                renderer.shadowCastingMode = ShadowCastingMode.Off;
            }
        }
    }
}
