using System;
using System.Collections.Generic;
using Buds.UI;
using Buds.World;
using UnityEngine;

namespace Buds.Quests
{
    /// <summary>
    /// The districts on a wasteland's plots (packages/shared land.ts), drawn for everyone passing by: a free plot has a
    /// board for sale at its gate; a bought one has its district's paving over the stage's square (and a walk in from
    /// the gate), its buildings with colliders and cast shadows, a building site with a crane while something new goes
    /// up, and a sign with the district's colours at the gate. The bud's own district also shows bubbles over producers
    /// worth collecting and the ghost of a building being placed. Lives under the map (goes with it); redrawn whenever
    /// the server answers.
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
            public string Look;
            public readonly Dictionary<int, BuildingView> Buildings = new();
        }

        WorldView world;
        LandContent rules;
        Land own;
        PropArt art;
        readonly Dictionary<string, PlotView> plots = new();
        readonly Dictionary<string, DistrictDto> districts = new();
        /// <summary>Map cells under any district's building (map index), for walking.</summary>
        readonly HashSet<int> solid = new();
        double othersOffset;
        GameObject ghost;
        SpriteRenderer ghostBody;
        SpriteRenderer ghostShade;
        float nextRefresh;
        static Sprite white;
        static Sprite paving;
        static Sprite kerb;

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
            dw.art = Art(rules);
            dw.Redraw();
            return dw;
        }

        static PropArt sharedArt;

        /// <summary>
        /// The districts' buildings and signs in one small atlas, packed once and shared by every wasteland (loaded when
        /// the game starts, so crossing onto a wasteland never waits for it).
        /// </summary>
        public static PropArt Art(LandContent rules)
        {
            if (sharedArt != null) return sharedArt;
            var names = new HashSet<string> { "dz-budowa", "dz-budowa-duza", "dz-ratusz-1", "dz-ratusz-2", "dz-ratusz-3", "dz-tablica", "dz-na-sprzedaz" };
            foreach (var b in rules.buildings)
                if (b.id != Land.Hall)
                    names.Add("dz-" + b.id);
            return sharedArt = PropArt.Load(names);
        }

        int H => world.Map.Height;
        int Size => rules.plotSize;

        /// <summary>The world point at the bottom-middle of a map cell (where props stand).</summary>
        Vector3 Ground(int x, int y) => world.transform.position + new Vector3(x + 0.5f, H - 1 - y + 0.1f, 0);

        static double LocalMs => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        /// <summary>The districts the server says stand on this wasteland (everyone's, the bud's own included).</summary>
        public void Apply(DistrictsResponse res)
        {
            districts.Clear();
            foreach (var d in res?.districts ?? Array.Empty<DistrictDto>())
            {
                d.buildings ??= Array.Empty<LandBuildingDto>();
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
            solid.Clear();
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
        }

        void Draw(PlotView view)
        {
            var p = view.Plot;
            var mine = IsOwn(p);
            var other = mine ? null : DistrictOn(p.id);
            var stage = mine ? own.State.stage : other?.stage ?? 0;
            var buildings = mine ? own.State.buildings : other?.buildings ?? Array.Empty<LandBuildingDto>();
            var look = stage == 0 ? "free" : $"stage {stage}";
            if (view.Look != look)
            {
                // the ground and the sign change only with the stage (or a sale)
                foreach (var b in view.Buildings.Values)
                    if (b.Root)
                        Destroy(b.Root);
                view.Buildings.Clear();
                for (var i = view.Root.transform.childCount - 1; i >= 0; i--) Destroy(view.Root.transform.GetChild(i).gameObject);
                view.Look = look;
                if (stage > 0) DrawPaving(view, stage);
                DrawSign(view, stage > 0 ? "dz-tablica" : "dz-na-sprzedaz");
            }
            var now = mine ? own.Now : LocalMs + othersOffset;
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
                var kind = rules.Building(b.kind);
                if (kind == null) continue;
                var f = new RectInt(b.x - (kind.w - 1) / 2, b.y - kind.h + 1, kind.w, kind.h);
                for (var y = f.yMin; y < f.yMax; y++)
                for (var x = f.xMin; x < f.xMax; x++)
                    solid.Add((p.y + y) * world.Map.Width + p.x + x);
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

        // ---------- the ground and the sign ----------

        /// <summary>Light paving over the stage's square with a darker kerb, and a paved walk in from the gate.</summary>
        void DrawPaving(PlotView view, int stage)
        {
            MakeSprites();
            var p = view.Plot;
            var area = Land.StageArea(rules, stage);
            Slab(view, "Kerb", kerb, p.x + area.xMin - 0.15f, p.y + area.yMin - 0.15f, area.width + 0.3f, area.height + 0.3f, KerbSort);
            Slab(view, "Paving", paving, p.x + area.xMin, p.y + area.yMin, area.width, area.height, PavingSort);
            // the walk from the gate to the square, three cells wide
            var c = (Size - 1) / 2;
            var last = Size - 1;
            switch (p.gate)
            {
                case "n":
                    Slab(view, "Walk", paving, p.x + c - 1, p.y, 3, area.yMin, PavingSort);
                    break;
                case "s":
                    Slab(view, "Walk", paving, p.x + c - 1, p.y + area.yMax, 3, last + 1 - area.yMax, PavingSort);
                    break;
                case "w":
                    Slab(view, "Walk", paving, p.x, p.y + c - 1, area.xMin, 3, PavingSort);
                    break;
                default:
                    Slab(view, "Walk", paving, p.x + area.xMax, p.y + c - 1, last + 1 - area.xMax, 3, PavingSort);
                    break;
            }
        }

        /// <summary>A tiled flat sprite covering map cells from (x, y) (top-left, map coordinates) w × h cells.</summary>
        void Slab(PlotView view, string name, Sprite sprite, float x, float y, float w, float h, int sort)
        {
            if (w <= 0 || h <= 0) return;
            var sr = new GameObject(name).AddComponent<SpriteRenderer>();
            sr.transform.SetParent(view.Root.transform, false);
            sr.sprite = sprite;
            sr.drawMode = SpriteDrawMode.Tiled;
            sr.size = new Vector2(w, h);
            sr.sortingOrder = sort;
            sr.transform.position = world.transform.position + new Vector3(x + w / 2f, H - y - h / 2f, 0);
        }

        /// <summary>The sign beside the gate, just inside the fence.</summary>
        void DrawSign(PlotView view, string prop)
        {
            var at = SignCell(view.Plot);
            var go = new GameObject("Sign");
            go.transform.SetParent(view.Root.transform, false);
            go.transform.position = Ground(at.x, at.y);
            var holder = WorldView.Stand(go.transform, "Visual");
            var sr = new GameObject("Sprite").AddComponent<SpriteRenderer>();
            sr.transform.SetParent(holder, false);
            sr.sprite = art.Get(prop);
            sr.sortingOrder = WorldView.SortOrderFor(go.transform.position.y);
            if (sr.sprite) CastShadow.Attach(go.transform, sr, holder);
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

        static void MakeSprites()
        {
            if (paving) return;
            // 64 px = one cell: four light slabs with thin joints and a faint grain
            const int s = 64;
            var tex = new Texture2D(s, s, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Repeat, filterMode = FilterMode.Bilinear };
            var slab = new Color32(0xdf, 0xe3, 0xe8, 0xff);
            var joint = new Color32(0xb9, 0xc0, 0xc9, 0xff);
            var rnd = new System.Random(7);
            for (var y = 0; y < s; y++)
            for (var x = 0; x < s; x++)
            {
                var j = x % 32 < 2 || y % 32 < 2;
                var c = j ? joint : slab;
                var g = rnd.Next(-5, 6);
                tex.SetPixel(x, y, new Color32((byte)(c.r + g), (byte)(c.g + g), (byte)(c.b + g), 255));
            }
            tex.Apply();
            paving = Sprite.Create(tex, new Rect(0, 0, s, s), new Vector2(0.5f, 0.5f), s, 0, SpriteMeshType.FullRect);
            var k = new Texture2D(4, 4, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Repeat };
            var pixels = new Color32[16];
            for (var i = 0; i < 16; i++) pixels[i] = new Color32(0x86, 0x8c, 0x97, 0xff);
            k.SetPixels32(pixels);
            k.Apply();
            kerb = Sprite.Create(k, new Rect(0, 0, 4, 4), new Vector2(0.5f, 0.5f), 4, 0, SpriteMeshType.FullRect);
        }

        // ---------- buildings ----------

        void Place(PlotView view, BuildingView v, LandBuildingDto b, double now, bool mine)
        {
            var kind = rules.Building(b.kind);
            if (kind == null) return;
            var sprite = Land.SpriteFor(b, now);
            var at = Ground(view.Plot.x + b.x, view.Plot.y + b.y);
            v.Root.transform.position = at;
            if (v.Sprite != sprite)
            {
                // a new look (finished building, the town hall grown): body, collider and shadow made again
                for (var i = v.Root.transform.childCount - 1; i >= 0; i--) Destroy(v.Root.transform.GetChild(i).gameObject);
                foreach (var c in v.Root.GetComponents<Collider2D>()) Destroy(c);
                var s = art.Get(sprite);
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
            if (Time.time < nextRefresh) return;
            nextRefresh = Time.time + RefreshSeconds;
            // finished buildings change their look, producers fill up
            foreach (var view in plots.Values)
                if (view.Root)
                    Draw(view);
        }

        // ---------- what the bud walks up to ----------

        /// <summary>Whether a map cell is under a building of any district.</summary>
        public bool Blocks(int x, int y) => solid.Contains(y * world.Map.Width + x);

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
            ghostBody.sprite = art.Get("dz-" + kind.id) ?? art.Get("dz-budowa");
            ghostBody.color = fits ? new Color(0.75f, 1f, 0.75f, 0.7f) : new Color(1f, 0.55f, 0.55f, 0.6f);
            ghostBody.sortingOrder = WorldView.SortOrderFor(ghost.transform.position.y) + 1;
            ghostShade.color = fits ? new Color(0.64f, 0.9f, 0.21f, 0.35f) : new Color(1f, 0.24f, 0.31f, 0.35f);
            ghostShade.transform.localScale = new Vector3(kind.w, kind.h, 1);
            ghostShade.transform.localPosition = new Vector3(0, kind.h / 2f - 0.1f, 0);
        }
    }
}
