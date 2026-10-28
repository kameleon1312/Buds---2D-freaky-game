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
        /// <summary>
        /// Characters are drawn at this scale of their sheet: a bud stands about as tall as a door, in proportion to the
        /// houses, trees and benches around it.
        /// </summary>
        public const float CharacterScale = 1f;
        /// <summary>A character's ground shadow width (tiles), in step with its size.</summary>
        public const float CharacterShadow = 0.68f;
        /// <summary>How high over a character's feet a marker floats (just above the top of the head).</summary>
        public const float AboveHead = CharacterScale * 0.98f + 0.45f;
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
        const int SortStandTop = 19900;
        /// <summary>
        /// The order at worldY 0, and how many orders a tile of height takes: a map and the one laid next to it (a city and
        /// its wasteland, up to 282 rows from the south edge of one to the north edge of the other) fit between y -170 and
        /// y 320 with a fortieth of a tile between two orders.
        /// </summary>
        const int SortStandZero = 13000;
        public const int SortPerTile = 40;
        /// <summary>Lowest standing sort order: always above the ground (-1000…) and flat decorations (-100…-90).</summary>
        const int SortStandBottom = 0;

        /// <summary>
        /// Sprites lower on screen draw in front; shared by props and actors. Kept between SortStandBottom and
        /// SortStandTop for every row of the map and of the map next to it, so nothing standing ever slips under the
        /// ground or a road marking at the far end.
        /// </summary>
        public static int SortOrderFor(float worldY) =>
            Mathf.Clamp(SortStandZero - Mathf.RoundToInt(worldY * SortPerTile), SortStandBottom, SortStandTop);

        /// <summary>How long the last map took to build, by part (for the autopilot's load log).</summary>
        public static string LastTimings { get; private set; } = "";

        /// <summary>Builds a map in one go, its south-west corner at <paramref name="origin"/> (world units).</summary>
        public static WorldView Create(WorldMap map, List<GroundLayer> ground = null, Vector2 origin = default)
        {
            var view = Begin(map, origin);
            foreach (var _ in view.Build(ground)) { }
            return view;
        }

        /// <summary>
        /// Builds a map a little at a time (about <paramref name="budgetMs"/> of work a frame), so laying the next map down
        /// while the bud walks towards it never stops the game. Null when the view was destroyed on the way.
        /// </summary>
        public static async Awaitable<WorldView> CreateSpread(WorldMap map, List<GroundLayer> ground, Vector2 origin, float budgetMs = 6f)
        {
            var view = Begin(map, origin);
            var clock = System.Diagnostics.Stopwatch.StartNew();
            foreach (var _ in view.Build(ground))
            {
                if (clock.Elapsed.TotalMilliseconds < budgetMs) continue;
                await Awaitable.NextFrameAsync();
                if (!view) return null;
                clock.Restart();
            }
            return view;
        }

        static WorldView Begin(WorldMap map, Vector2 origin)
        {
            var root = new GameObject("World " + map.Id, typeof(Grid));
            root.transform.position = origin;
            var view = root.AddComponent<WorldView>();
            view.Map = map;
            view.origin = origin;
            // a map laid next to the current one never changes the light of the one the bud is on
            if (origin == Vector2.zero) Sunlit = !map.IsInterior;
            return view;
        }

        /// <summary>Where the map was built (world units): ground patterns, wind and depth are laid out from here.</summary>
        Vector2 origin;

        /// <summary>The work of building, in small steps (a step = a few milliseconds).</summary>
        IEnumerable<int> Build(List<GroundLayer> ground)
        {
            var clock = System.Diagnostics.Stopwatch.StartNew();
            Colliders(transform, Map);
            edge = GetComponent<EdgeCollider2D>();
            yield return 0;
            var colliders = clock.ElapsedMilliseconds;
            var material = SpriteMaterial();
            foreach (var step in Ground(transform, Map, material, ground)) yield return step;
            var groundDone = clock.ElapsedMilliseconds;
            foreach (var step in Props(this, transform, Map, material)) yield return step;
            LastTimings = $"colliders {colliders} ms, ground {groundDone - colliders} ms ({(ground != null ? "ready" : "now")}), props {clock.ElapsedMilliseconds - groundDone} ms";
            WorldLife.Attach(this);
        }

        EdgeCollider2D edge;
        Mesh baseMesh;

        /// <summary>Opens the map's outline where the road leads into the map laid next to it (null closes it again).</summary>
        public void OpenEdge(Exit exit)
        {
            if (edge) edge.points = Seams.Outline(Map, exit);
        }

        /// <summary>The base ground's extent (local units): its usual margin, or stopped at the edge a neighbour shares.</summary>
        public void SetBase(Rect r)
        {
            if (!baseMesh) return;
            baseMesh.SetVertices(new List<Vector3>
            {
                new(r.xMin, r.yMin), new(r.xMax, r.yMin), new(r.xMax, r.yMax), new(r.xMin, r.yMax),
            });
            baseMesh.uv = new[]
            {
                (new Vector2(r.xMin, r.yMin) + origin) / GroundLook.Span, (new Vector2(r.xMax, r.yMin) + origin) / GroundLook.Span,
                (new Vector2(r.xMax, r.yMax) + origin) / GroundLook.Span, (new Vector2(r.xMin, r.yMax) + origin) / GroundLook.Span,
            };
            baseMesh.RecalculateBounds();
        }

        /// <summary>Where the life of the map starts from (map-local ground points): trees, flowers, burning barrels.</summary>
        public readonly List<(string kind, Vector2 at)> LifeSpots = new();

        static string LifeKind(string prop) =>
            prop == "beczka-ogien" ? "fire"
            : prop.StartsWith("flowers") || prop == "hibiskus" ? "flower"
            : prop.StartsWith("tree") || prop.StartsWith("palm") || prop.StartsWith("jungle") || prop == "sosna" || prop == "swierk" ? "tree"
            : null;

        /// <summary>The standing props and their height in the map (local), to sort them again after the world moved.</summary>
        readonly List<(SpriteRenderer r, float y)> standing = new();

        /// <summary>
        /// The whole world moved (the bud crossed into the next map, which becomes the origin): standing props take their
        /// depth from where they are now.
        /// </summary>
        public void Resort()
        {
            var y0 = transform.position.y;
            foreach (var (r, y) in standing)
                if (r) r.sortingOrder = SortOrderFor(y0 + y);
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

        IEnumerable<int> Ground(Transform parent, WorldMap map, Material material, List<GroundLayer> plan = null)
        {
            var w = map.Width;
            var h = map.Height;
            var root = new GameObject("Ground").transform;
            root.SetParent(parent, false);
            var order = SortGround;

            var baseShape = new GroundMesh();
            // the base reaches far beyond the map: the tilted camera sees further towards the horizon
            var m = Seams.Margin;
            baseShape.Vertices.AddRange(new[]
            {
                new Vector3(-m.x, -m.y), new Vector3(w + m.z, -m.y), new Vector3(w + m.z, h + m.w), new Vector3(-m.x, h + m.w),
            });
            baseShape.Triangles.AddRange(new[] { 0, 2, 1, 0, 3, 2 });
            // every layer gets its material's surface (GroundLook): grass blades, paving slabs, asphalt grain, ripples…
            // drawn by the ground and water shaders (soft world patches, moving water) when the device has them
            LoadShaders();
            var look = DistrictLook.For(map.Id);
            var surfaces = new Dictionary<GroundLook.Pattern, Material>();
            Material Surface(GroundLook.Pattern pattern)
            {
                if (surfaces.TryGetValue(pattern, out var mat)) return mat;
                var isWater = pattern == GroundLook.Pattern.Water;
                var shader = isWater ? waterShader : groundShader;
                mat = shader ? new Material(shader) : new Material(material);
                mat.name = "Ground " + pattern;
                mat.mainTexture = GroundLook.Texture(pattern);
                if (shader && !isWater)
                {
                    // the district's ground; rooms: hardly any patches, colours as the room was painted
                    mat.SetFloat(MacroId, map.IsInterior ? 0.04f : look.Macro);
                    mat.SetFloat(DesatId, map.IsInterior ? 0.03f : look.Desat);
                }
                if (shader && isWater)
                {
                    // the district's water: calm or lively, clear or murky
                    mat.SetFloat("_WebLow", look.WebLow);
                    mat.SetFloat("_WebHigh", look.WebHigh);
                    mat.SetFloat("_Glint", look.Glint);
                    mat.SetFloat("_Flow", look.Flow);
                    mat.SetFloat("_Sky", look.Sky);
                    mat.SetColor("_Tint", look.WaterTint);
                }
                if (isWater && !shader) water.Add(mat);
                return surfaces[pattern] = mat;
            }
            var basePattern = map.IsInterior ? GroundLook.Pattern.Grain : GroundLook.Pattern.Grass;
            baseMesh = Layer(root, "Base", baseShape, map.BaseColor * GroundLook.Gain(basePattern), order++, Surface(basePattern), origin);
            yield return 0;

            // the layers themselves: worked out ahead (a worker thread, see Prepare) or now
            foreach (var l in plan ?? PlanGround(map))
            {
                Layer(root, l.Name, l.Mesh, l.Color * GroundLook.Gain(l.Pattern), order + l.Band, Surface(l.Pattern), origin);
                yield return 0;
            }
        }

        /// <summary>One layer of ground, worked out from the map: pure maths, safe on a worker thread.</summary>
        public sealed class GroundLayer
        {
            public string Name;
            public GroundMesh Mesh;
            public Color Color;
            public int Band;
            public GroundLook.Pattern Pattern;
        }

        /// <summary>
        /// The smooth ground layers of a map (blurred masks traced into meshes): the slow part of entering a district,
        /// so it can run on a worker thread while the bud walks towards the road out (no Unity objects are touched).
        /// </summary>
        public static List<GroundLayer> PlanGround(WorldMap map)
        {
            var layers = new List<GroundLayer>();
            var w = map.Width;
            var h = map.Height;
            var chunk = ChunkTiles * GroundShapes.SamplesPerTile;
            var nx = w * GroundShapes.SamplesPerTile;
            var ny = h * GroundShapes.SamplesPerTile;
            var band = 0;
            var district = DistrictLook.DistrictOf(map.Id);
            foreach (var style in map.GroundStyles)
            {
                var kinds = new HashSet<string>(style.Kinds);
                var field = GroundShapes.Field((x, y) => kinds.Contains(map.GroundAt(x, y)), w, h, style.Radius);
                var pattern = GroundLook.For(style.Name, style.Kinds, district);
                foreach (var (threshold, color) in style.Bands)
                {
                    for (var j0 = 0; j0 < ny; j0 += chunk)
                    for (var i0 = 0; i0 < nx; i0 += chunk)
                    {
                        var mesh = GroundShapes.Contour(field, threshold, h, i0, j0, Mathf.Min(i0 + chunk, nx),
                            Mathf.Min(j0 + chunk, ny));
                        if (mesh.Triangles.Count == 0) continue;
                        layers.Add(new GroundLayer
                        {
                            Name = $"{style.Name} {threshold:0.00} [{i0 / chunk},{j0 / chunk}]",
                            Mesh = mesh,
                            Color = color,
                            Band = band,
                            Pattern = pattern,
                        });
                    }
                    band++;
                }
            }
            return layers;
        }

        // ---------- getting the next map ready while the bud walks to it ----------

        static string preparedId;
        static WorldMap preparedMap;
        static System.Threading.Tasks.Task<List<GroundLayer>> preparedGround;

        /// <summary>
        /// Starts working out a map's ground on a worker thread (the file is read here, on the main thread). Entering it
        /// later then only builds the meshes: no stop on the road from one city to the next.
        /// </summary>
        public static void Prepare(string mapId)
        {
            if (mapId == preparedId) return;
            try
            {
                var map = MapFormat.Load(mapId);
                preparedId = mapId;
                preparedMap = map;
                preparedGround = System.Threading.Tasks.Task.Run(() => PlanGround(map));
            }
            catch (Exception e)
            {
                Debug.LogWarning($"Could not prepare {mapId}: {e.Message}");
                preparedId = null;
            }
        }

        /// <summary>Whether a map's ground is worked out and waiting (taking it then never waits for the worker).</summary>
        public static bool IsPrepared(string mapId) => mapId == preparedId && preparedGround != null && preparedGround.IsCompleted;

        /// <summary>The bud walked across into a map laid next to the last one: its light (sun or none) is the one now.</summary>
        public static void MakeCurrent(WorldView view) => Sunlit = !view.Map.IsInterior;

        /// <summary>The prepared map and its ground (waiting for the worker if it is still on it), or null.</summary>
        public static (WorldMap map, List<GroundLayer> ground)? TakePrepared(string mapId)
        {
            if (mapId != preparedId || preparedGround == null) return null;
            var task = preparedGround;
            var map = preparedMap;
            preparedId = null;
            preparedMap = null;
            preparedGround = null;
            try
            {
                return (map, task.Result);
            }
            catch (Exception e)
            {
                Debug.LogWarning($"Preparing {mapId} failed: {e.Message}");
                return null;
            }
        }

        static Mesh Layer(Transform parent, string name, GroundMesh data, Color color, int order, Material material, Vector2 origin)
        {
            if (data.Triangles.Count == 0) return null;
            var mesh = new Mesh { name = name, indexFormat = IndexFormat.UInt32 };
            mesh.SetVertices(data.Vertices);
            mesh.SetTriangles(data.Triangles, 0);
            // the surface texture is laid in world space, so neighbouring layers and chunks line up
            var uvs = new Vector2[data.Vertices.Count];
            for (var i = 0; i < uvs.Length; i++) uvs[i] = ((Vector2)data.Vertices[i] + origin) / GroundLook.Span;
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
            return mesh;
        }

        static Shader groundShader, waterShader;
        static bool shadersLoaded;
        static readonly int MacroId = Shader.PropertyToID("_Macro");
        static readonly int DesatId = Shader.PropertyToID("_Desat");

        /// <summary>
        /// The ground and water shaders (Resources/Shaders) and the world's soft patches they share; a device that can't
        /// run them keeps the plain sprite material.
        /// </summary>
        static void LoadShaders()
        {
            if (shadersLoaded) return;
            shadersLoaded = true;
            groundShader = Resources.Load<Shader>("Shaders/BudsGround");
            waterShader = Resources.Load<Shader>("Shaders/BudsWater");
            if (groundShader && !groundShader.isSupported) groundShader = null;
            if (waterShader && !waterShader.isSupported) waterShader = null;
            Shader.SetGlobalTexture("_BudsMacro", GroundLook.Macro());
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
                    occupied.Add(y * (long)map.Width + x);
                    break;
                }
            }
            if (!map.IsInterior)
            {
                EdgeGrowth(map, all, occupied);
                Dressing(map, all, occupied);
            }
            return all;
        }

        /// <summary>What lies on open ground of each material (art/dressing.ts) and how much of it: never a flat colour edge to edge.</summary>
        public static (float chance, string props)? DressingFor(string g) => g switch
        {
            _ when g.StartsWith("grass") || g.StartsWith("lawn") => (0.03f, "grunt-koniczyna|grunt-kwiatki|grunt-koniczyna|grunt-kamyki|grunt-wydeptane"),
            "sand" or "shore" => (0.022f, "grunt-slady|grunt-patyk|grunt-kamyki|grunt-slady"),
            "dirt" or "soil" or "rubble" => (0.035f, "grunt-koleiny|grunt-pekniecia|grunt-kamyki-ciemne|grunt-pekniecia"),
            "gravel" or "path" => (0.018f, "grunt-kamyki|grunt-pekniecia"),
            "asphalt" => (0.015f, "grunt-latka"),
            _ => null,
        };

        /// <summary>The ground's own small details over every open cell of a map, by material (the same every time).</summary>
        static void Dressing(WorldMap map, List<PropSpot> all, HashSet<long> occupied)
        {
            for (var y = 0; y < map.Height; y++)
            for (var x = 0; x < map.Width; x++)
            {
                var key = y * (long)map.Width + x;
                if (map.Solid[y, x] || occupied.Contains(key)) continue;
                if (DressingFor(map.GroundAt(x, y)) is not { } d || MapFormat.Hash(x, y, 53) >= d.chance) continue;
                all.Add(new PropSpot { Name = MapFormat.Pick(d.props.Split('|'), x, y, 59), X = x, Y = y, Scattered = true });
                occupied.Add(key);
            }
            // then the district's own things (mushrooms in the forest, shells on the beach, rubble on the scrapland…)
            var extra = DistrictLook.For(map.Id).Extra;
            if (extra.Length == 0) return;
            for (var y = 0; y < map.Height; y++)
            for (var x = 0; x < map.Width; x++)
            {
                var key = y * (long)map.Width + x;
                if (map.Solid[y, x] || occupied.Contains(key)) continue;
                var g = map.GroundAt(x, y);
                foreach (var (ground, chance, props) in extra)
                {
                    if (ground != g || MapFormat.Hash(x, y, 67) >= chance) continue;
                    all.Add(new PropSpot { Name = MapFormat.Pick(props.Split('|'), x, y, 71), X = x, Y = y, Scattered = true });
                    occupied.Add(key);
                    break;
                }
            }
        }

        /// <summary>Soft ground that grows: grass and lawns.</summary>
        static bool Grows(string g) => g != null && (g.StartsWith("grass") || g.StartsWith("lawn") || g == "weeds");

        /// <summary>Hard ground that grass creeps onto: paths, pavements, squares, gravel, sand.</summary>
        static bool Trodden(string g) =>
            g is "path" or "sidewalk" or "plaza" or "gravel" or "dirt" or "cobble" or "sand" or "concrete" or "soil";

        /// <summary>
        /// Where grass meets a path or a pavement, tufts and weeds grow along the edge (a third of such cells, the same
        /// every time), so materials meet the way they do outside instead of along a clean cut.
        /// </summary>
        static void EdgeGrowth(WorldMap map, List<PropSpot> all, HashSet<long> occupied)
        {
            for (var y = 1; y < map.Height - 1; y++)
            for (var x = 1; x < map.Width - 1; x++)
            {
                var key = y * (long)map.Width + x;
                if (map.Solid[y, x] || occupied.Contains(key) || !Grows(map.GroundAt(x, y))) continue;
                if (!Trodden(map.GroundAt(x + 1, y)) && !Trodden(map.GroundAt(x - 1, y)) && !Trodden(map.GroundAt(x, y + 1)) &&
                    !Trodden(map.GroundAt(x, y - 1)))
                    continue;
                var roll = MapFormat.Hash(x, y, 41);
                if (roll >= 0.34f) continue;
                all.Add(new PropSpot { Name = roll < 0.24f ? "tuft" : roll < 0.3f ? "chwast" : "flowers-c", X = x, Y = y, Scattered = true });
                occupied.Add(key);
            }
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
            // plants are kept in map units: where they are now is the map's position on top (it moves when the bud crosses
            // into the next map); the gusts follow the place the map was built at, so they never jump
            var c = (Vector2)cam.transform.position - (Vector2)transform.position;
            var time = Time.time;
            foreach (var (t, amp, at) in swaying)
            {
                // only what the camera can see (it sits south of the view, looking north)
                var dx = at.x - c.x;
                var dy = at.y - c.y;
                if (dx * dx > 900 || dy < -12 || dy > 40) continue;
                t.localRotation = Upright * Quaternion.Euler(0, 0, amp * Wind(at.x + origin.x, at.y + origin.y, time));
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

        static IEnumerable<int> Props(WorldView view, Transform parent, WorldMap map, Material groundMaterial)
        {
            var shadows = new Dictionary<(Texture tex, int cx, int cy), ShadowBatch>();
            var contacts = new Dictionary<(int cx, int cy), ShadowBatch>();
            var spots = AllProps(map);
            var names = new HashSet<string>();
            foreach (var s in spots) names.Add(s.Name);
            var art = view.art = PropArt.Load(names);

            var root = new GameObject("Props").transform;
            root.SetParent(parent, false);
            yield return 0;
            var count = 0;
            foreach (var spot in spots)
            {
                if (++count % 48 == 0) yield return 0;
                var sprite = art.Get(spot.Name);
                if (!sprite) continue;
                var flat = art.IsFlat(spot.Name);
                var life = LifeKind(spot.Name);
                var baseY = map.Height - 1 - spot.Y; // bottom edge of the cell in world units
                // scattered decorations wander a little inside their cell so they don't look planted in rows
                var jx = spot.Scattered ? (MapFormat.Hash(spot.X, spot.Y, 3) - 0.5f) * 0.5f : 0;
                var jy = spot.Scattered ? MapFormat.Hash(spot.X, spot.Y, 5) * 0.4f : 0;
                var go = new GameObject(spot.Name);
                go.transform.SetParent(root, false);
                go.transform.localPosition = new Vector3(spot.X + 0.5f + jx, baseY + 0.1f + jy, 0);
                if (life != null) view.LifeSpots.Add((life, go.transform.localPosition));
                if (!flat) go.transform.localRotation = Upright; // buildings, trees, lamps stand up; flowers and markings lie flat
                var r = go.AddComponent<SpriteRenderer>();
                r.sprite = sprite;
                r.sortingOrder = flat ? SortDecor : SortOrderFor(view.origin.y + baseY + 0.1f);
                if (flat) continue;
                view.standing.Add((r, baseY + 0.1f));
                var sway = SwayFor(spot.Name);
                // scattered plants sway a little less and each its own way
                if (sway > 0) view.swaying.Add((go.transform, sway * (spot.Scattered ? 0.8f : 1f), go.transform.localPosition));
                if (!CastsShadow(spot.Name)) continue;
                AddContact(contacts, sprite, go.transform.localPosition, (int)(spot.X / ChunkTiles), (int)(baseY / ChunkTiles));
                if (map.IsInterior) continue;
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
                yield return 0;
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
            yield return 0;
            BuildContacts(shadowRoot, contacts, groundMaterial, map.IsInterior);
        }

        // ---------- contact shade: where things meet the ground ----------

        /// <summary>How dark the soft shade right under a standing thing is (rooms: lighter, there is no sun).</summary>
        public static readonly Color ContactColor = new(0.03f, 0.05f, 0.09f, 0.46f);
        static Texture2D contactBlob;

        /// <summary>
        /// A soft oval of shade on the ground under a standing prop, as wide as its base: the cast shadow says where the
        /// sun is, this says the thing stands on the ground (ambient occlusion where it meets it).
        /// </summary>
        static void AddContact(Dictionary<(int, int), ShadowBatch> contacts, Sprite sprite, Vector2 at, int cx, int cy)
        {
            // the width of the drawing near its ground point (its base), not its widest part: a tree's crown is wider than its trunk
            var verts = sprite.vertices;
            var (vMin, vMax) = Bounds(verts);
            var width = Mathf.Clamp((vMax.x - vMin.x) * 0.72f, 0.5f, 6f);
            var depth = Mathf.Clamp(width * 0.32f, 0.28f, 1.1f);
            if (!contacts.TryGetValue((cx, cy), out var batch)) contacts[(cx, cy)] = batch = new ShadowBatch();
            var first = batch.Vertices.Count;
            var c = at + new Vector2(0, depth * 0.18f);
            batch.Vertices.Add(new Vector3(c.x - width / 2, c.y - depth / 2));
            batch.Vertices.Add(new Vector3(c.x + width / 2, c.y - depth / 2));
            batch.Vertices.Add(new Vector3(c.x + width / 2, c.y + depth / 2));
            batch.Vertices.Add(new Vector3(c.x - width / 2, c.y + depth / 2));
            batch.Uvs.Add(new Vector2(0, 0));
            batch.Uvs.Add(new Vector2(1, 0));
            batch.Uvs.Add(new Vector2(1, 1));
            batch.Uvs.Add(new Vector2(0, 1));
            batch.Triangles.AddRange(new[] { first, first + 2, first + 1, first, first + 3, first + 2 });
        }

        static void BuildContacts(Transform root, Dictionary<(int, int), ShadowBatch> contacts, Material groundMaterial, bool interior)
        {
            if (contacts.Count == 0) return;
            contactBlob ??= GroundLook.SoftBlob();
            var material = new Material(groundMaterial) { name = "Contact shade", mainTexture = contactBlob };
            var color = ContactColor;
            if (interior) color.a *= 0.6f;
            foreach (var ((cx, cy), batch) in contacts)
            {
                var mesh = new Mesh { name = $"Contact [{cx},{cy}]", indexFormat = IndexFormat.UInt32 };
                mesh.SetVertices(batch.Vertices);
                mesh.SetUVs(0, batch.Uvs);
                mesh.SetTriangles(batch.Triangles, 0);
                var colors = new Color[batch.Vertices.Count];
                Array.Fill(colors, color);
                mesh.colors = colors;
                mesh.RecalculateBounds();
                var go = new GameObject(mesh.name, typeof(MeshFilter), typeof(MeshRenderer));
                go.transform.SetParent(root, false);
                go.GetComponent<MeshFilter>().sharedMesh = mesh;
                var renderer = go.GetComponent<MeshRenderer>();
                renderer.sharedMaterial = material;
                renderer.sortingOrder = SortCastShadow;
                renderer.shadowCastingMode = ShadowCastingMode.Off;
            }
        }
    }
}
