using System;
using System.Collections.Generic;
using Buds.UI;
using Buds.World;
using UnityEngine;

namespace Buds.Quests
{
    /// <summary>
    /// The districts on a wasteland's plots (packages/shared land.ts), drawn for everyone passing by, in the style of the
    /// land around them (las, tropik, dwor, zlom). A plot is 5×5 sectors: those not cleared yet are wild (the forest, the
    /// palms and dunes, the orchard, the scrap of that wasteland: props over the sector and one collider), a sector being
    /// cleared shows the crew's digger and stumps, cleared ones are paved in the style's paving with a kerb and fenced
    /// along the plot's edge, the gate left open. A free plot is a small clearing by the road with a board for sale; a
    /// bought one has its sign, its buildings (colliders and cast shadows; a building site with a crane while something
    /// new goes up). The bud's own district also shows bubbles over producers worth collecting and the ghost of a
    /// building being placed. Lives under the map (goes with it); the art is loaded per style without an atlas, before
    /// the districts are made; plots are rebuilt one a frame when their land changes.
    /// </summary>
    public sealed class DistrictsWorld : MonoBehaviour
    {
        const float RefreshSeconds = 0.5f;
        /// <summary>A producer shows its bubble once it holds this many units.</summary>
        const int BubbleAt = 5;
        const int PavingSort = -98;
        const int KerbSort = -99;

        sealed class BuildingView
        {
            public GameObject Root;
            public string Sprite;
            public SpriteRenderer Bubble;
            public string BubbleFor;
        }

        sealed class PlotView
        {
            public PlotData Plot;
            public GameObject Root;
            /// <summary>The land's ground, wild sectors, fence and sign (rebuilt when <see cref="Look"/> changes).</summary>
            public GameObject Land;
            public string Look;
            public readonly Dictionary<int, BuildingView> Buildings = new();
            /// <summary>Map cells the land blocks (wild sectors, the fence), map index.</summary>
            public readonly HashSet<int> Solid = new();
        }

        WorldView world;
        LandContent rules;
        Land own;
        string style;
        readonly Dictionary<string, PlotView> plots = new();
        readonly Dictionary<string, DistrictDto> districts = new();
        /// <summary>Map cells under any district's building (map index), for walking.</summary>
        readonly HashSet<int> solid = new();
        readonly Queue<PlotView> rebuild = new();
        double othersOffset;
        GameObject ghost;
        SpriteRenderer ghostBody;
        SpriteRenderer ghostShade;
        float nextRefresh;
        static Sprite white;

        public string Route { get; private set; }

        public static DistrictsWorld Create(WorldView world, LandContent rules, Land own)
        {
            var go = new GameObject("Districts");
            go.transform.SetParent(world.transform, false);
            var dw = go.AddComponent<DistrictsWorld>();
            dw.world = world;
            dw.rules = rules;
            dw.own = own;
            dw.Route = world.Map.Id;
            dw.style = rules.StyleOf(dw.Route);
            dw.Redraw();
            return dw;
        }

        int H => world.Map.Height;
        int W => world.Map.Width;
        int Size => rules.plotSize;
        int Sector => Mathf.Max(1, rules.sector);
        int Sectors => Mathf.Max(1, rules.sectors);

        /// <summary>The world point at the bottom-middle of a map cell (where props stand).</summary>
        Vector3 Ground(float x, float y) => world.transform.position + new Vector3(x + 0.5f, H - 1 - y + 0.1f, 0);

        static double LocalMs => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        // ---------- the art: one style's sprites, loaded once, no atlas (a few dozen big pictures) ----------

        static readonly Dictionary<string, Sprite> sprites = new();
        static readonly HashSet<string> loadedStyles = new();
        static PropArt.Manifest manifest;

        /// <summary>What grows on a wild sector of each style (existing world props), the big ones first.</summary>
        static readonly Dictionary<string, string[]> Wild = new()
        {
            ["las"] = new[] { "sosna", "swierk", "tree-a", "sosna", "tree-b", "bush-a", "krzak-jagody", "paproc" },
            ["tropik"] = new[] { "palm-a", "palm-b", "palm-c", "palm-a", "hibiskus", "bush-b", "rock-a", "paproc" },
            ["dwor"] = new[] { "tree-c", "tree-c", "tree-a", "tree-c", "bush-a", "siano", "bush-b", "bush-a" },
            ["zlom"] = new[] { "zlom", "wrak-a", "drzewo-suche", "zlom", "opony", "smieci", "rock-dark", "opony" },
        };

        /// <summary>What stays of a sector being cleared (stumps, tyres), scattered behind the crew.</summary>
        static string Stump(string s) => s == "zlom" ? "opony" : "pien";

        static IEnumerable<string> NamesFor(LandContent rules, string s)
        {
            yield return "dz-budowa";
            yield return "dz-budowa-duza";
            yield return "dz-na-sprzedaz";
            yield return "dz-palik";
            foreach (var part in new[] { "ratusz-1", "ratusz-2", "ratusz-3", "tablica", "wycinka", "plot-post", "plot-h", "plot-v" })
                yield return $"dz-{s}-{part}";
            foreach (var b in rules.buildings ?? Array.Empty<BuildingData>())
                if (b.id != Land.Hall)
                    yield return $"dz-{s}-{b.id}";
            foreach (var n in Wild.TryGetValue(s, out var w) ? w : Wild["las"]) yield return n;
            yield return Stump(s);
        }

        /// <summary>
        /// Loads a style's pictures a little at a time (Resources.LoadAsync), so stepping onto a wasteland never waits for
        /// them in one frame; already loaded ones are kept for the next visit.
        /// </summary>
        public static async Awaitable Preload(LandContent rules, string s)
        {
            if (loadedStyles.Contains(s)) return;
            manifest ??= PropArt.LoadManifest();
            foreach (var name in NamesFor(rules, s))
            {
                if (sprites.ContainsKey(name)) continue;
                var entry = Array.Find(manifest.props, e => e.name == name);
                if (entry == null) continue;
                var req = Resources.LoadAsync<Texture2D>("World/" + name);
                while (!req.isDone) await Awaitable.NextFrameAsync();
                if (req.asset is not Texture2D tex || sprites.ContainsKey(name)) continue;
                tex.wrapMode = TextureWrapMode.Clamp;
                sprites[name] = Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(entry.pivotX, entry.pivotY),
                    manifest.ppu, 0, SpriteMeshType.FullRect);
            }
            loadedStyles.Add(s);
        }

        static Sprite Art(string name) => name != null && sprites.TryGetValue(name, out var s) ? s : null;

        // ---------- the server's word ----------

        /// <summary>The districts the server says stand on this wasteland (everyone's, the bud's own included).</summary>
        public void Apply(DistrictsResponse res)
        {
            districts.Clear();
            foreach (var d in res?.districts ?? Array.Empty<DistrictDto>())
            {
                d.buildings ??= Array.Empty<LandBuildingDto>();
                d.sectors ??= Array.Empty<int>();
                d.clearing ??= new LandClearingDto();
                if (!string.IsNullOrEmpty(d.plot)) districts[d.plot] = d;
            }
            if (res != null) othersOffset = res.now - LocalMs;
            Redraw();
        }

        /// <summary>The public view of the district on a plot (null: for sale).</summary>
        public DistrictDto DistrictOn(string plot) => districts.TryGetValue(plot, out var d) ? d : null;

        bool IsOwn(PlotData p) => own != null && own.Has && own.State.plot == p.id;

        /// <summary>Everything again from the latest word: the bud's own district from its land, the others from the list.</summary>
        public void Redraw()
        {
            foreach (var p in rules.PlotsOn(Route))
            {
                if (!plots.TryGetValue(p.id, out var view) || !view.Root)
                {
                    var root = new GameObject($"Plot {p.id}");
                    root.transform.SetParent(transform, false);
                    plots[p.id] = view = new PlotView { Plot = p, Root = root };
                }
                Draw(view);
            }
            RebuildSolid();
        }

        /// <summary>What a plot's land is now: who holds it, its cleared sectors, the one in work.</summary>
        (bool owned, int[] sectors, int inWork, LandBuildingDto[] buildings, double now) StateOf(PlotData p)
        {
            if (IsOwn(p))
            {
                var now = own.Now;
                return (true, Cleared(own.State.sectors, own.State.clearing, now), own.InWork, own.State.buildings, now);
            }
            var d = DistrictOn(p.id);
            var then = LocalMs + othersOffset;
            if (d == null) return (false, Land.StartSectors(p.gate, Sectors), -1, Array.Empty<LandBuildingDto>(), then);
            return (true, Cleared(d.sectors, d.clearing, then), Land.SectorInWork(d.clearing, then), d.buildings, then);
        }

        int[] Cleared(int[] sectors, LandClearingDto clearing, double now)
        {
            var list = new List<int>(sectors ?? Array.Empty<int>());
            if (clearing != null && clearing.readyAt > 0 && clearing.readyAt <= now && !list.Contains(clearing.sector)) list.Add(clearing.sector);
            list.Sort();
            return list.ToArray();
        }

        void Draw(PlotView view)
        {
            var p = view.Plot;
            var (owned, sectors, inWork, buildings, now) = StateOf(p);
            var look = $"{owned}|{string.Join(",", sectors)}|{inWork}";
            if (view.Look != look)
            {
                view.Look = look;
                if (!rebuild.Contains(view)) rebuild.Enqueue(view);
            }
            var mine = IsOwn(p);
            var seen = new HashSet<int>();
            foreach (var b in buildings)
            {
                seen.Add(b.id);
                if (!view.Buildings.TryGetValue(b.id, out var bv) || !bv.Root)
                {
                    var root = new GameObject($"{b.kind} #{b.id}");
                    root.transform.SetParent(view.Root.transform, false);
                    view.Buildings[b.id] = bv = new BuildingView { Root = root };
                }
                Place(view, bv, b, now, mine);
            }
            var gone = new List<int>();
            foreach (var id in view.Buildings.Keys)
                if (!seen.Contains(id))
                    gone.Add(id);
            foreach (var id in gone)
            {
                if (view.Buildings[id].Root) Destroy(view.Buildings[id].Root);
                view.Buildings.Remove(id);
            }
        }

        void RebuildSolid()
        {
            solid.Clear();
            foreach (var view in plots.Values)
            {
                foreach (var c in view.Solid) solid.Add(c);
                var p = view.Plot;
                var (_, _, _, buildings, _) = StateOf(p);
                foreach (var b in buildings)
                {
                    var kind = rules.Building(b.kind);
                    if (kind == null) continue;
                    var f = new RectInt(b.x - (kind.w - 1) / 2, b.y - kind.h + 1, kind.w, kind.h);
                    for (var y = f.yMin; y < f.yMax; y++)
                    for (var x = f.xMin; x < f.xMax; x++)
                        solid.Add((p.y + y) * W + p.x + x);
                }
            }
        }

        // ---------- the land: ground, wild sectors, the crew, the fence, the sign ----------

        /// <summary>Makes a plot's land again (one plot a frame, from <see cref="Update"/>).</summary>
        void BuildLand(PlotView view)
        {
            if (!view.Root) return;
            if (view.Land) Destroy(view.Land);
            view.Land = new GameObject("Land");
            view.Land.transform.SetParent(view.Root.transform, false);
            view.Solid.Clear();
            var p = view.Plot;
            var (owned, sectors, inWork, _, _) = StateOf(p);
            var cleared = new HashSet<int>(sectors);
            var n = Sectors;
            for (var s = 0; s < n * n; s++)
            {
                var sx = s % n;
                var sy = s / n;
                var x0 = sx * Sector;
                var y0 = sy * Sector;
                if (cleared.Contains(s))
                {
                    // a bought district is paved; a plot for sale is a bare clearing
                    if (owned) Pave(view, p.x + x0, p.y + y0, Sector, Sector);
                    continue;
                }
                if (s == inWork) Crew(view, p, s, x0, y0);
                else WildSector(view, p, s, x0, y0);
                BlockSector(view, p, x0, y0);
            }
            if (owned) Fence(view, p, cleared);
            // the corners of the plot are marked with survey stakes, so a plot reads as one even overgrown
            foreach (var (cx, cy) in new[] { (-1, -1), (Size, -1), (-1, Size), (Size, Size) })
                Prop(view.Land.transform, "dz-palik", p.x + cx, p.y + cy, shadow: false);
            var sign = SignCell(p);
            Prop(view.Land.transform, owned ? $"dz-{style}-tablica" : "dz-na-sprzedaz", sign.x, sign.y);
        }

        /// <summary>A wild sector: the style's growth spread over its cells (the same every time for this plot and sector).</summary>
        void WildSector(PlotView view, PlotData p, int s, int x0, int y0)
        {
            var names = Wild.TryGetValue(style, out var w) ? w : Wild["las"];
            var rnd = new System.Random(p.id.GetHashCode() * 31 + s * 7919);
            // a loose grid of spots so the sector reads as dense growth without props standing in each other
            for (var gy = 0; gy < 3; gy++)
            for (var gx = 0; gx < 3; gx++)
            {
                if (rnd.NextDouble() < 0.18) continue;
                var big = rnd.NextDouble() < 0.6;
                var name = big ? names[rnd.Next(0, 4)] : names[4 + rnd.Next(0, names.Length - 4)];
                var x = x0 + 0.4f + gx * 1.6f + (float)rnd.NextDouble() * 1.1f;
                var y = y0 + 0.6f + gy * 1.6f + (float)rnd.NextDouble() * 1.0f;
                Prop(view.Land.transform, name, p.x + x - 0.5f, p.y + y, shadow: false);
            }
        }

        /// <summary>A sector the crew is clearing: stumps behind, the digger and a pile at its front.</summary>
        void Crew(PlotView view, PlotData p, int s, int x0, int y0)
        {
            var rnd = new System.Random(p.id.GetHashCode() * 17 + s);
            for (var i = 0; i < 5; i++)
                Prop(view.Land.transform, Stump(style), p.x + x0 + 0.3f + (float)rnd.NextDouble() * 3.8f, p.y + y0 + 0.4f + (float)rnd.NextDouble() * 2.6f,
                    shadow: false);
            Prop(view.Land.transform, $"dz-{style}-wycinka", p.x + x0 + 2, p.y + y0 + Sector - 1);
        }

        /// <summary>One collider over a sector that can't be walked (wild or being cleared), and its cells for walking.</summary>
        void BlockSector(PlotView view, PlotData p, int x0, int y0)
        {
            var box = view.Land.AddComponent<BoxCollider2D>();
            box.size = new Vector2(Sector, Sector);
            box.offset = (Vector2)(world.transform.position - view.Land.transform.position) +
                         new Vector2(p.x + x0 + Sector / 2f, H - (p.y + y0) - Sector / 2f);
            for (var y = 0; y < Sector; y++)
            for (var x = 0; x < Sector; x++)
                view.Solid.Add((p.y + y0 + y) * W + p.x + x0 + x);
        }

        /// <summary>
        /// The fence along the plot's edge where the district reaches it (the cleared sectors' outer cells), the gate open:
        /// posts on every fence cell, rails to the east and north neighbours, a collider per cell.
        /// </summary>
        void Fence(PlotView view, PlotData p, HashSet<int> cleared)
        {
            var last = Size - 1;
            var gate = new HashSet<Vector2Int>(Land.GateCells(p.gate, Size));
            var cells = new HashSet<Vector2Int>();
            for (var i = 0; i < Size; i++)
                foreach (var c in new[] { new Vector2Int(i, 0), new Vector2Int(i, last), new Vector2Int(0, i), new Vector2Int(last, i) })
                    if (!gate.Contains(c) && cleared.Contains(Land.SectorOf(c.x, c.y, Sector, Sectors)))
                        cells.Add(c);
            foreach (var c in cells)
            {
                Prop(view.Land.transform, $"dz-{style}-plot-post", p.x + c.x, p.y + c.y);
                if (cells.Contains(c + Vector2Int.right)) Prop(view.Land.transform, $"dz-{style}-plot-h", p.x + c.x, p.y + c.y);
                if (cells.Contains(c + Vector2Int.down)) Prop(view.Land.transform, $"dz-{style}-plot-v", p.x + c.x, p.y + c.y);
                var box = view.Land.AddComponent<BoxCollider2D>();
                box.size = Vector2.one;
                box.offset = (Vector2)(world.transform.position - view.Land.transform.position) +
                             new Vector2(p.x + c.x + 0.5f, H - (p.y + c.y) - 0.5f);
                view.Solid.Add((p.y + c.y) * W + p.x + c.x);
            }
        }

        /// <summary>A standing prop at a map cell (fractions allowed), y-sorted, with a cast shadow when asked.</summary>
        void Prop(Transform parent, string name, float x, float y, bool shadow = true)
        {
            var sprite = Art(name);
            if (!sprite) return;
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.position = Ground(x, y);
            var holder = WorldView.Stand(go.transform, "Visual");
            var sr = new GameObject("Sprite").AddComponent<SpriteRenderer>();
            sr.transform.SetParent(holder, false);
            sr.sprite = sprite;
            sr.sortingOrder = WorldView.SortOrderFor(go.transform.position.y);
            if (shadow) CastShadow.Attach(go.transform, sr, holder);
        }

        /// <summary>The style's paving over map cells from (x, y) (top-left) w × h, with its kerb a little wider underneath.</summary>
        void Pave(PlotView view, int x, int y, int w, int h)
        {
            var (paving, kerb) = Paving(style);
            Slab(view.Land.transform, "Kerb", kerb, x - 0.12f, y - 0.12f, w + 0.24f, h + 0.24f, KerbSort);
            Slab(view.Land.transform, "Paving", paving, x, y, w, h, PavingSort);
        }

        /// <summary>A tiled flat sprite covering map cells from (x, y) (top-left, map coordinates) w × h cells.</summary>
        void Slab(Transform parent, string name, Sprite sprite, float x, float y, float w, float h, int sort)
        {
            if (w <= 0 || h <= 0) return;
            var sr = new GameObject(name).AddComponent<SpriteRenderer>();
            sr.transform.SetParent(parent, false);
            sr.sprite = sprite;
            sr.drawMode = SpriteDrawMode.Tiled;
            sr.size = new Vector2(w, h);
            sr.sortingOrder = sort;
            sr.transform.position = world.transform.position + new Vector3(x + w / 2f, H - y - h / 2f, 0);
        }

        /// <summary>The map cell of a plot's sign: inside the fence, two cells beside the middle of the gate.</summary>
        Vector2Int SignCell(PlotData p)
        {
            var c = (Size - 1) / 2;
            var last = Size - 1;
            var local = p.gate switch
            {
                "n" => new Vector2Int(c + 2, 1),
                "s" => new Vector2Int(c + 2, last - 1),
                "w" => new Vector2Int(1, c + 2),
                _ => new Vector2Int(last - 1, c + 2),
            };
            return new Vector2Int(p.x + local.x, p.y + local.y);
        }

        static readonly Dictionary<string, (Sprite paving, Sprite kerb)> pavings = new();

        /// <summary>
        /// The style's paving, 64 px a cell: pale stone slabs with mossy joints (las), warm sandstone tiles (tropik), red
        /// clinker in a running bond (dwor), big dark concrete slabs with bolts (zlom); a kerb of the style's stone.
        /// </summary>
        static (Sprite, Sprite) Paving(string s)
        {
            if (pavings.TryGetValue(s, out var made)) return made;
            const int size = 64;
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Repeat, filterMode = FilterMode.Bilinear };
            Color32 face, joint, kerbColor;
            switch (s)
            {
                case "tropik":
                    face = new Color32(0xf0, 0xdc, 0xb4, 0xff);
                    joint = new Color32(0xd2, 0xb8, 0x88, 0xff);
                    kerbColor = new Color32(0xc9, 0xa9, 0x74, 0xff);
                    break;
                case "dwor":
                    face = new Color32(0xc8, 0x6e, 0x52, 0xff);
                    joint = new Color32(0xe6, 0xd6, 0xbc, 0xff);
                    kerbColor = new Color32(0x8f, 0x86, 0x78, 0xff);
                    break;
                case "zlom":
                    face = new Color32(0x86, 0x8b, 0x93, 0xff);
                    joint = new Color32(0x5c, 0x60, 0x68, 0xff);
                    kerbColor = new Color32(0x4a, 0x4f, 0x5a, 0xff);
                    break;
                default:
                    face = new Color32(0xdc, 0xdd, 0xd4, 0xff);
                    joint = new Color32(0x9c, 0xb8, 0x82, 0xff);
                    kerbColor = new Color32(0x8a, 0x8f, 0x86, 0xff);
                    break;
            }
            var rnd = new System.Random(s.Length * 7 + 3);
            for (var y = 0; y < size; y++)
            for (var x = 0; x < size; x++)
            {
                bool j;
                switch (s)
                {
                    case "dwor":
                        // bricks 32×16 px, every other row shifted half a brick
                        j = y % 16 < 2 || (x + (y / 16 % 2) * 16) % 32 < 2;
                        break;
                    case "tropik":
                        // tiles 32×32 px, offset rows, softer joints
                        j = y % 32 < 2 || (x + (y / 32 % 2) * 16) % 32 < 2;
                        break;
                    case "zlom":
                        j = x % 64 < 2 || y % 64 < 2;
                        if (!j && (x % 64 is 8 or 56) && (y % 64 is 8 or 56)) j = true; // bolts
                        break;
                    default:
                        j = x % 32 < 2 || y % 32 < 2;
                        break;
                }
                var c = j ? joint : face;
                var g = rnd.Next(-6, 7);
                tex.SetPixel(x, y, new Color32((byte)Mathf.Clamp(c.r + g, 0, 255), (byte)Mathf.Clamp(c.g + g, 0, 255), (byte)Mathf.Clamp(c.b + g, 0, 255), 255));
            }
            tex.Apply();
            var paving = Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), size, 0, SpriteMeshType.FullRect);
            var k = new Texture2D(4, 4, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Repeat };
            var pixels = new Color32[16];
            for (var i = 0; i < 16; i++) pixels[i] = kerbColor;
            k.SetPixels32(pixels);
            k.Apply();
            var kerb = Sprite.Create(k, new Rect(0, 0, 4, 4), new Vector2(0.5f, 0.5f), 4, 0, SpriteMeshType.FullRect);
            pavings[s] = (paving, kerb);
            return (paving, kerb);
        }

        // ---------- buildings ----------

        void Place(PlotView view, BuildingView v, LandBuildingDto b, double now, bool mine)
        {
            var kind = rules.Building(b.kind);
            if (kind == null) return;
            var sprite = Land.SpriteFor(b, now, style, kind);
            var at = Ground(view.Plot.x + b.x, view.Plot.y + b.y);
            v.Root.transform.position = at;
            if (v.Sprite != sprite)
            {
                // a new look (finished building, the town hall grown): body, collider and shadow made again
                for (var i = v.Root.transform.childCount - 1; i >= 0; i--) Destroy(v.Root.transform.GetChild(i).gameObject);
                foreach (var c in v.Root.GetComponents<Collider2D>()) Destroy(c);
                var s = Art(sprite);
                var holder = WorldView.Stand(v.Root.transform, "Visual");
                var body = new GameObject("Sprite").AddComponent<SpriteRenderer>();
                body.transform.SetParent(holder, false);
                body.sprite = s;
                body.sortingOrder = WorldView.SortOrderFor(at.y);
                if (s) CastShadow.Attach(v.Root.transform, body, holder);
                // the footprint is solid (the cells, not the drawing)
                var box = v.Root.AddComponent<BoxCollider2D>();
                box.size = new Vector2(kind.w, kind.h);
                box.offset = new Vector2(0, kind.h / 2f - 0.1f);
                v.Sprite = sprite;
                v.Bubble = null;
                v.BubbleFor = null;
            }
            if (mine) UpdateBubble(v, b, kind, now);
        }

        /// <summary>A bubble with the resource (or the rent) over a producer worth collecting from, bobbing gently.</summary>
        void UpdateBubble(BuildingView v, LandBuildingDto b, BuildingData kind, double now)
        {
            var show = !string.IsNullOrEmpty(kind.produces) && own.Pending(b, now) >= BubbleAt;
            if (!show)
            {
                if (v.Bubble) v.Bubble.gameObject.SetActive(false);
                return;
            }
            if (!v.Bubble || v.BubbleFor != kind.produces)
            {
                if (v.Bubble) Destroy(v.Bubble.gameObject);
                var holder = WorldView.Stand(v.Root.transform, "Bubble");
                var go = new GameObject("Icon");
                go.transform.SetParent(holder, false);
                go.transform.localScale = Vector3.one * 0.6f;
                v.Bubble = go.AddComponent<SpriteRenderer>();
                v.Bubble.sprite = UiKit.Picture("Ui/zasob-" + kind.produces);
                v.Bubble.sortingOrder = 20000;
                v.BubbleFor = kind.produces;
            }
            v.Bubble.gameObject.SetActive(true);
            v.Bubble.transform.localPosition = new Vector3(0, kind.h + 1.3f + Mathf.Sin(Time.time * 2.2f + b.id) * 0.12f, 0);
        }

        void Update()
        {
            // one plot's land a frame, so a wasteland's districts never make one long frame
            if (rebuild.Count > 0)
            {
                BuildLand(rebuild.Dequeue());
                RebuildSolid();
            }
            if (Time.time < nextRefresh) return;
            nextRefresh = Time.time + RefreshSeconds;
            // finished buildings change their look, producers fill up, a crew finishes
            foreach (var view in plots.Values)
                if (view.Root)
                    Draw(view);
        }

        /// <summary>Whether every plot's land has been made (the demo waits for it).</summary>
        public bool Ready => rebuild.Count == 0;

        // ---------- what the bud walks up to ----------

        /// <summary>Whether a map cell is blocked by a district: a building, a wild sector, the fence.</summary>
        public bool Blocks(int x, int y) => solid.Contains(y * W + x);

        /// <summary>The plot whose gate (or sign) is next to a point (feet in world units), or null.</summary>
        public PlotData NearGate(Vector2 feet, float reach)
        {
            PlotData best = null;
            var bestD = reach;
            foreach (var p in rules.PlotsOn(Route))
            {
                var outside = Land.OutsideGate(p.gate, Size);
                foreach (var cell in new[] { SignCell(p), new Vector2Int(p.x + outside.x, p.y + outside.y) })
                {
                    var d = Vector2.Distance(feet, world.CellCenter(cell.x, cell.y));
                    if (d >= bestD) continue;
                    bestD = d;
                    best = p;
                }
            }
            return best;
        }

        /// <summary>The bud's own building whose door or walls are next to a point (feet in world units), or null.</summary>
        public LandBuildingDto NearOwn(Vector2 feet, float reach)
        {
            if (own == null || !own.Has || own.Plot.route != Route) return null;
            LandBuildingDto best = null;
            var bestD = reach;
            var origin = (Vector2)world.transform.position;
            foreach (var b in own.State.buildings)
            {
                var kind = rules.Building(b.kind);
                if (kind == null) continue;
                // distance from the feet to the footprint's rectangle (world units)
                var minX = origin.x + own.Plot.x + b.x - (kind.w - 1) / 2f;
                var maxX = minX + kind.w;
                var minY = origin.y + H - 1 - (own.Plot.y + b.y);
                var maxY = minY + kind.h;
                var dx = Mathf.Max(minX - feet.x, 0, feet.x - maxX);
                var dy = Mathf.Max(minY - feet.y, 0, feet.y - maxY);
                var d = Mathf.Sqrt(dx * dx + dy * dy);
                if (d >= bestD) continue;
                bestD = d;
                best = b;
            }
            return best;
        }

        // ---------- placing a building ----------

        /// <summary>The ghost of a building at a plot-local cell of the bud's own plot (green: it fits); null kind hides it.</summary>
        public void ShowGhost(string kindId, Vector2Int anchor, bool fits)
        {
            var kind = kindId != null ? rules.Building(kindId) : null;
            if (kind == null || own == null || !own.Has)
            {
                if (ghost) ghost.SetActive(false);
                return;
            }
            if (!ghost)
            {
                ghost = new GameObject("Ghost");
                ghost.transform.SetParent(transform, false);
                white ??= Sprite.Create(Texture2D.whiteTexture, new Rect(0, 0, 4, 4), new Vector2(0.5f, 0.5f), 4);
                ghostShade = new GameObject("Footprint").AddComponent<SpriteRenderer>();
                ghostShade.transform.SetParent(ghost.transform, false);
                ghostShade.sprite = white;
                ghostShade.sortingOrder = -94;
                var stand = WorldView.Stand(ghost.transform);
                ghostBody = new GameObject("Sprite").AddComponent<SpriteRenderer>();
                ghostBody.transform.SetParent(stand, false);
            }
            ghost.SetActive(true);
            var map = own.ToMap(anchor.x, anchor.y);
            ghost.transform.position = Ground(map.x, map.y);
            var look = kind.id == Land.Hall ? $"dz-{style}-ratusz-1" : $"dz-{style}-{kind.id}";
            ghostBody.sprite = Art(look) ?? Art("dz-budowa");
            ghostBody.color = fits ? new Color(0.75f, 1f, 0.75f, 0.7f) : new Color(1f, 0.55f, 0.55f, 0.6f);
            ghostBody.sortingOrder = WorldView.SortOrderFor(ghost.transform.position.y) + 1;
            ghostShade.color = fits ? new Color(0.64f, 0.9f, 0.21f, 0.35f) : new Color(1f, 0.24f, 0.31f, 0.35f);
            ghostShade.transform.localScale = new Vector3(kind.w, kind.h, 1);
            ghostShade.transform.localPosition = new Vector3(0, kind.h / 2f - 0.1f, 0);
        }
    }
}
