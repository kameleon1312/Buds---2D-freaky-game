using System.Collections.Generic;
using Buds.World;
using UnityEngine;

namespace Buds.Combat
{
    /// <summary>
    /// Flat shapes drawn on the ground for the fight (plain code, EditMode-testable): a disc, a ring, a wedge, a strip
    /// with an arrow head. Meshes in the XY plane with vertex colours: a soft fill and a crisp edge, like the reach
    /// markers of a MOBA, in the design system's colours.
    /// </summary>
    public static class FxShapes
    {
        const int Segments = 48;

        /// <summary>A filled wedge (angle 360 = a disc) with an edge of <paramref name="edge"/> tiles; the fill fades out.</summary>
        public static void Wedge(Mesh mesh, float radius, float angleDeg, float edge, Color fill, Color line, float fillShare = 1)
        {
            var verts = new List<Vector3>();
            var colors = new List<Color>();
            var tris = new List<int>();
            var full = angleDeg >= 359;
            var half = Mathf.Min(angleDeg, 360) * 0.5f * Mathf.Deg2Rad;
            var steps = Mathf.Max(6, Mathf.CeilToInt(Segments * Mathf.Min(angleDeg, 360) / 360f));
            var inner = Mathf.Max(0, radius - edge);
            var fillR = Mathf.Lerp(0, inner, Mathf.Clamp01(fillShare));
            // the fill: a fan from the centre, fading a little towards the rim
            verts.Add(Vector3.zero);
            colors.Add(fill * new Color(1, 1, 1, 0.55f));
            for (var i = 0; i <= steps; i++)
            {
                var a = -half + 2 * half * i / steps + Mathf.PI / 2;
                verts.Add(new Vector3(Mathf.Cos(a) * fillR, Mathf.Sin(a) * fillR, 0));
                colors.Add(fill);
                if (i > 0) tris.AddRange(new[] { 0, verts.Count - 2, verts.Count - 1 });
            }
            // the rim: a band from inner to radius
            var start = verts.Count;
            for (var i = 0; i <= steps; i++)
            {
                var a = -half + 2 * half * i / steps + Mathf.PI / 2;
                var d = new Vector3(Mathf.Cos(a), Mathf.Sin(a), 0);
                verts.Add(d * inner);
                verts.Add(d * radius);
                colors.Add(line);
                colors.Add(line);
                if (i == 0) continue;
                var b = start + i * 2;
                tris.AddRange(new[] { b - 2, b - 1, b, b - 1, b + 1, b });
            }
            // the straight sides of a wedge
            if (!full)
                foreach (var side in new[] { -half, half })
                {
                    var a = side + Mathf.PI / 2;
                    var d = new Vector3(Mathf.Cos(a), Mathf.Sin(a), 0);
                    var n = new Vector3(-d.y, d.x, 0) * (edge * 0.5f);
                    AddQuad(verts, colors, tris, -n, n, d * radius + n, d * radius - n, line);
                }
            Set(mesh, verts, colors, tris);
        }

        /// <summary>A strip from the origin up (+Y) of <paramref name="length"/> × <paramref name="width"/>, with an arrow head.</summary>
        public static void Strip(Mesh mesh, float length, float width, float edge, Color fill, Color line, bool arrow, float fillShare = 1)
        {
            var verts = new List<Vector3>();
            var colors = new List<Color>();
            var tris = new List<int>();
            var w = width / 2;
            var body = arrow ? Mathf.Max(0, length - width * 0.8f) : length;
            var filled = body * Mathf.Clamp01(fillShare);
            AddQuad(verts, colors, tris, new Vector3(-w, 0), new Vector3(w, 0), new Vector3(w, filled), new Vector3(-w, filled), fill);
            // the outline: both sides and the back
            AddQuad(verts, colors, tris, new Vector3(-w, 0), new Vector3(-w + edge, 0), new Vector3(-w + edge, body), new Vector3(-w, body), line);
            AddQuad(verts, colors, tris, new Vector3(w - edge, 0), new Vector3(w, 0), new Vector3(w, body), new Vector3(w - edge, body), line);
            AddQuad(verts, colors, tris, new Vector3(-w, 0), new Vector3(w, 0), new Vector3(w, edge), new Vector3(-w, edge), line);
            if (arrow)
            {
                // a solid head: the way the dash goes
                var i = verts.Count;
                verts.Add(new Vector3(-w * 1.5f, body));
                verts.Add(new Vector3(w * 1.5f, body));
                verts.Add(new Vector3(0, length));
                colors.Add(line);
                colors.Add(line);
                colors.Add(line);
                tris.AddRange(new[] { i, i + 2, i + 1 });
            }
            else AddQuad(verts, colors, tris, new Vector3(-w, body - edge), new Vector3(w, body - edge), new Vector3(w, body), new Vector3(-w, body), line);
            Set(mesh, verts, colors, tris);
        }

        static void AddQuad(List<Vector3> v, List<Color> c, List<int> t, Vector3 a, Vector3 b, Vector3 cc, Vector3 d, Color color)
        {
            var i = v.Count;
            v.Add(a);
            v.Add(b);
            v.Add(cc);
            v.Add(d);
            for (var k = 0; k < 4; k++) c.Add(color);
            t.AddRange(new[] { i, i + 2, i + 1, i, i + 3, i + 2 });
        }

        static void Set(Mesh mesh, List<Vector3> v, List<Color> c, List<int> t)
        {
            mesh.Clear();
            mesh.SetVertices(v);
            mesh.SetColors(c);
            // both faces: the camera looks down at the ground, never mind the winding
            var both = new List<int>(t.Count * 2);
            both.AddRange(t);
            for (var i = 0; i < t.Count; i += 3) both.AddRange(new[] { t[i], t[i + 2], t[i + 1] });
            mesh.SetTriangles(both, 0);
            mesh.RecalculateBounds();
        }
    }

    /// <summary>
    /// Everything the fight draws in the world (docs/walka.md): the reach of the ability being aimed, the warning of a
    /// foe's slow blow (a red area that fills until it lands), swings, areas and pulses, flying stones, paint and sound,
    /// the comic words and stars of a blow, the dash's after-images, the K.O. stencil. Pooled; it never touches the
    /// fight's rules and nothing here can be clicked. Lives under the world, so a new map clears it.
    /// </summary>
    public sealed class CombatFx : MonoBehaviour
    {
        sealed class Shape
        {
            public GameObject Go;
            public MeshFilter Filter;
            public MeshRenderer Renderer;
            public Mesh Mesh;
        }

        sealed class Flash
        {
            public Shape Shape;
            public float Start, Seconds;
            public System.Action<float> Redraw;
            public Transform Follow;
            /// <summary>Turns while it lasts (degrees a second): a spin's sweep.</summary>
            public float Spin;
        }

        /// <summary>
        /// How a blow looks (every kind its own, docs/walka.md): a jab's quick white snap, a kick's gold sweep with dust,
        /// a bat's wooden arc, a spin's turning sweeps, stones, a sniper's tracer, paint, sound waves, a drop's shock
        /// rings, a board's lime trail, an ultimate's big stamp.
        /// </summary>
        public enum Blow { Fist, Kick, Bat, Spin, Shot, Snipe, Paint, Sound, Shock, Board, Guard, Ultimate }

        public static Blow StyleOf(string ability) => ability switch
        {
            "prosty" or "seria-ciosow" or "sierpowy" or "bomba" => Blow.Fist,
            "kopniak" or "z-polobrotu" or "podciecie" => Blow.Kick,
            "pchniecie" or "szybkie-pchniecie" or "zamach" or "z-gory" => Blow.Bat,
            "mlyniec" or "huragan" => Blow.Spin,
            "strzal" or "precyzyjny-strzal" or "seria" or "grad" => Blow.Shot,
            "snajper" or "celowanie" => Blow.Snipe,
            "psik" or "psik-z-bliska" or "chmura" or "burza-farby" or "tag" => Blow.Paint,
            "diss" or "roast" or "bit" or "basowy-bit" or "freestyle" => Blow.Sound,
            "drop" or "mega-drop" => Blow.Shock,
            "deska" or "ollie" or "kickflip" or "flip-360" or "slizg" or "grind" => Blow.Board,
            "garda" or "kontra" or "zryw" => Blow.Guard,
            _ when ability != null && (ability.StartsWith("ult-") || ability == "specjalny") => Blow.Ultimate,
            _ => Blow.Fist,
        };

        static readonly Color Wood = new(0.77f, 0.54f, 0.32f);
        static readonly Color PaintPink = new(1f, 0.48f, 0.66f);

        public static Color ToneOf(Blow b) => b switch
        {
            Blow.Kick => UI.UiKit.Gold400,
            Blow.Bat => Wood,
            Blow.Spin => UI.UiKit.Buds400,
            Blow.Shot => new Color(0.86f, 0.84f, 0.8f),
            Blow.Snipe => UI.UiKit.Gold400,
            Blow.Paint => PaintPink,
            Blow.Sound => UI.UiKit.Rep400,
            Blow.Shock => UI.UiKit.Gold400,
            Blow.Board => UI.UiKit.Buds400,
            Blow.Guard => UI.UiKit.Rep400,
            Blow.Ultimate => UI.UiKit.Gold400,
            _ => Color.white,
        };

        /// <summary>The comic word a heavy blow of this kind shouts.</summary>
        static string WordOf(Blow b, bool crit) => b switch
        {
            Blow.Fist => crit ? "fx-bam" : "fx-pac",
            Blow.Kick or Blow.Board => "fx-bum",
            Blow.Bat or Blow.Spin => "fx-trzask",
            Blow.Shot or Blow.Snipe => "fx-bam",
            Blow.Paint => "fx-splat",
            Blow.Sound or Blow.Shock or Blow.Ultimate => "fx-bum",
            _ => "fx-pac",
        };

        /// <summary>A side's colour mixed into a blow's own (a foe's blows keep a red edge).</summary>
        public static Color Mix(Color blow, Color side, float share) => Color.Lerp(blow, side, share);

        sealed class Flyer
        {
            public SpriteRenderer Sprite;
            public SpriteRenderer Shadow;
            public Vector2 From, To;
            public float Start, Seconds;
            public string Owner;
            public string Kind;
            public float Spin;
        }

        sealed class Pop
        {
            public SpriteRenderer Sprite;
            public float Start, Seconds, Size, Rise;
            public Vector3 At;
            public bool Spin;
            /// <summary>An after-image: the body's own size, fading, never popping.</summary>
            public bool Ghost;
            public Vector3 Scale;
            public float Alpha;
        }

        Material material;
        readonly List<Shape> freeShapes = new();
        readonly List<Flash> flashes = new();
        readonly List<Flyer> flyers = new();
        readonly List<Pop> pops = new();
        readonly List<SpriteRenderer> freeSprites = new();
        Shape aim, aimRange;

        static readonly Dictionary<string, Sprite> art = new();
        static Sprite dot, softDot;

        public static CombatFx Create(Transform worldRoot)
        {
            var fx = new GameObject("Fight effects").AddComponent<CombatFx>();
            fx.transform.SetParent(worldRoot, false);
            var probe = new GameObject("probe").AddComponent<SpriteRenderer>();
            fx.material = new Material(probe.sharedMaterial) { name = "Fight shapes", mainTexture = Texture2D.whiteTexture };
            Destroy(probe.gameObject);
            return fx;
        }

        // ---------- colours ----------

        public static Color Tone(BrawlLook.Side side) => BrawlLook.Fill(side);

        static Color Alpha(Color c, float a) => new(c.r, c.g, c.b, a);

        // ---------- shapes on the ground ----------

        Shape Take()
        {
            Shape s;
            if (freeShapes.Count > 0)
            {
                s = freeShapes[^1];
                freeShapes.RemoveAt(freeShapes.Count - 1);
                s.Go.SetActive(true);
                return s;
            }
            var go = new GameObject("Shape");
            go.transform.SetParent(transform, false);
            s = new Shape { Go = go, Filter = go.AddComponent<MeshFilter>(), Renderer = go.AddComponent<MeshRenderer>(), Mesh = new Mesh() };
            s.Mesh.MarkDynamic();
            s.Filter.sharedMesh = s.Mesh;
            s.Renderer.sharedMaterial = material;
            s.Renderer.sortingOrder = -91;
            return s;
        }

        void Give(Shape s)
        {
            if (s == null || !s.Go) return;
            s.Go.SetActive(false);
            freeShapes.Add(s);
        }

        /// <summary>Puts a shape at a ground point, turned so its +Y points along <paramref name="dir"/>.</summary>
        static void Place(Shape s, Vector2 at, Vector2 dir, int order = -91)
        {
            var angle = dir.sqrMagnitude > 1e-4f ? Mathf.Atan2(dir.y, dir.x) * Mathf.Rad2Deg - 90 : 0;
            s.Go.transform.SetPositionAndRotation(new Vector3(at.x, at.y, -0.02f), Quaternion.Euler(0, 0, angle));
            s.Renderer.sortingOrder = order;
        }

        /// <summary>
        /// The reach of the ability being aimed (shown while a button is held or the mouse hovers): the ring of its range
        /// around the bud and the shape where it will land, in paper white (red when the spot is out of reach).
        /// </summary>
        public void ShowAim(Api.KitEntryDto e, Vector2 me, Vector2 spot, bool cancel)
        {
            if (e == null)
            {
                HideAim();
                return;
            }
            aim ??= Take();
            aimRange ??= Take();
            var paper = cancel ? UI.UiKit.Alert500 : UI.UiKit.Paper100;
            var fill = Alpha(paper, cancel ? 0.12f : 0.16f);
            var line = Alpha(paper, cancel ? 0.7f : 0.82f);
            var dir = spot - me;
            var range = Mathf.Max(0.6f, e.range);
            switch (e.shape)
            {
                case "circle":
                    FxShapes.Wedge(aimRange.Mesh, range, 360, 0.05f, Alpha(paper, 0.04f), Alpha(paper, 0.45f));
                    Place(aimRange, me, Vector2.up);
                    FxShapes.Wedge(aim.Mesh, Mathf.Max(0.4f, e.radius), 360, 0.07f, fill, line);
                    Place(aim, BrawlAim.Clamp(me, spot, e), Vector2.up, -90);
                    break;
                case "self":
                    FxShapes.Wedge(aim.Mesh, Mathf.Max(0.5f, e.radius), 360, 0.07f, fill, line);
                    Place(aim, me, Vector2.up);
                    aimRange.Go.SetActive(false);
                    break;
                case "line":
                case "proj":
                    FxShapes.Strip(aim.Mesh, range, Mathf.Max(0.45f, e.shape == "line" ? e.width : e.radius * 2), 0.06f, fill, line, e.shape == "proj");
                    Place(aim, me, dir);
                    aimRange.Go.SetActive(false);
                    break;
                case "dash":
                    FxShapes.Strip(aim.Mesh, range, 0.6f, 0.06f, fill, line, true);
                    Place(aim, me, dir);
                    if (e.radius > 1.5f)
                    {
                        FxShapes.Wedge(aimRange.Mesh, e.radius, 360, 0.06f, fill, line);
                        Place(aimRange, me + dir.normalized * Mathf.Min(range, dir.magnitude), Vector2.up, -90);
                        aimRange.Go.SetActive(true);
                    }
                    else aimRange.Go.SetActive(false);
                    break;
                case "melee":
                case "arc":
                    FxShapes.Wedge(aim.Mesh, range, Mathf.Max(30, e.angle), 0.06f, fill, line);
                    Place(aim, me, dir);
                    aimRange.Go.SetActive(false);
                    break;
                default:
                    HideAim();
                    break;
            }
        }

        public void HideAim()
        {
            Give(aim);
            Give(aimRange);
            aim = aimRange = null;
        }

        /// <summary>
        /// A foe's blow is coming (its wind-up): the area it will hit turns red and fills until the blow lands, so a
        /// quick bud can step out of it.
        /// </summary>
        public void Telegraph(string shape, Vector2 from, Vector2 to, float radius, float angle, float width, float range, float seconds, Color tone)
        {
            if (seconds < 0.12f) return;
            var s = Take();
            var dir = to - from;
            System.Action<float> redraw = shape switch
            {
                "circle" => k => FxShapes.Wedge(s.Mesh, radius, 360, 0.07f, Alpha(tone, 0.26f), Alpha(tone, 0.85f), k),
                "self" => k => FxShapes.Wedge(s.Mesh, radius, 360, 0.07f, Alpha(tone, 0.26f), Alpha(tone, 0.85f), k),
                "line" => k => FxShapes.Strip(s.Mesh, range, Mathf.Max(0.5f, width), 0.07f, Alpha(tone, 0.26f), Alpha(tone, 0.85f), false, k),
                "dash" => k => FxShapes.Strip(s.Mesh, range, 0.7f, 0.07f, Alpha(tone, 0.26f), Alpha(tone, 0.85f), true, k),
                _ => k => FxShapes.Wedge(s.Mesh, range, Mathf.Max(30, angle), 0.07f, Alpha(tone, 0.26f), Alpha(tone, 0.85f), k),
            };
            var at = shape == "circle" ? from + Vector2.ClampMagnitude(dir, Mathf.Max(0.5f, range)) : from;
            Place(s, at, dir, -90);
            redraw(0);
            flashes.Add(new Flash { Shape = s, Start = Time.time, Seconds = seconds, Redraw = redraw });
        }

        /// <summary>A swing (melee, arc) or a strip (line) flashing where it hit.</summary>
        public void Swing(string shape, Vector2 from, Vector2 to, float angle, float width, Color tone, Blow blow = Blow.Fist)
        {
            var s = Take();
            var dir = to - from;
            var range = dir.magnitude;
            System.Action<float> redraw;
            var seconds = 0.28f;
            if (shape == "line")
            {
                // a sniper's shot is a thin bright tracer, a beat or a paint wall a wide band, sound a ribbed wave
                var w = blow == Blow.Snipe ? 0.16f : Mathf.Max(0.5f, width);
                redraw = k => FxShapes.Strip(s.Mesh, range, w * (1 + 0.15f * k), blow == Blow.Snipe ? 0.05f : 0.08f,
                    Alpha(blow == Blow.Snipe ? Color.white : tone, (blow == Blow.Snipe ? 0.9f : 0.4f) * (1 - k)), Alpha(tone, 0.95f * (1 - k)), false);
                seconds = blow == Blow.Snipe ? 0.22f : 0.38f;
                if (blow == Blow.Sound)
                    for (var i = 1; i <= 4; i++)
                        Burst(from + dir * (i / 4.5f), Mathf.Max(0.35f, width * 0.45f), tone, null, null, i * 0.05f, 0.3f);
                if (blow == Blow.Paint)
                    Spatter(from + dir * 0.5f, Mathf.Max(0.6f, range * 0.45f), 8);
            }
            else
            {
                // a jab snaps short and narrow, a kick sweeps wide and fat, a bat leaves a thick wooden arc
                var thick = blow switch { Blow.Bat => 0.2f, Blow.Kick => 0.16f, Blow.Board => 0.14f, _ => 0.1f };
                var fill = blow == Blow.Fist ? 0.24f : 0.34f;
                redraw = k => FxShapes.Wedge(s.Mesh, range * (0.85f + 0.2f * k), Mathf.Max(30, angle), thick * (1 - k) + 0.02f,
                    Alpha(Color.Lerp(Color.white, tone, 0.35f), fill * (1 - k)), Alpha(tone, 0.95f * (1 - k)), 0.6f + 0.4f * k);
                seconds = blow == Blow.Fist ? 0.2f : 0.3f;
                if (blow is Blow.Kick or Blow.Board) Dust(to, 4);
                if (blow == Blow.Paint) Spatter(from + dir * 0.65f, range * 0.5f, 6);
            }
            Place(s, from, dir, -90);
            redraw(0);
            flashes.Add(new Flash { Shape = s, Start = Time.time, Seconds = seconds, Redraw = redraw });
        }

        /// <summary>Puffs of dust kicked up at a spot.</summary>
        public void Dust(Vector2 at, int puffs)
        {
            for (var i = 0; i < puffs; i++)
            {
                var p = at + Random.insideUnitCircle * 0.45f;
                PopSprite(SoftDot(), new Vector3(p.x, p.y, -0.1f), 0.35f + Random.value * 0.25f, 0.5f, 0.3f, new Color(0.85f, 0.8f, 0.7f, 0.75f));
            }
        }

        /// <summary>Drops of paint flying out over an area.</summary>
        void Spatter(Vector2 at, float radius, int drops)
        {
            for (var i = 0; i < drops; i++)
            {
                var p = at + Random.insideUnitCircle * radius;
                PopSprite(Dot(), new Vector3(p.x, p.y, 0), 0.18f + Random.value * 0.16f, 0.55f, 0.2f,
                    Alpha(i % 3 == 0 ? UI.UiKit.Gold400 : PaintPink, 0.95f));
            }
        }

        /// <summary>An area going off: a ring bursting out and a fill that fades (a self area follows its caster).</summary>
        public void Burst(Vector2 at, float radius, Color tone, Transform follow = null, string kind = null, float delay = 0,
            float seconds = 0.42f)
        {
            var s = Take();
            System.Action<float> redraw = k =>
            {
                var r = radius * (0.55f + 0.45f * Mathf.Sqrt(k));
                FxShapes.Wedge(s.Mesh, r, 360, 0.16f * (1 - k) + 0.03f, Alpha(tone, 0.3f * (1 - k)), Alpha(tone, 0.95f * (1 - k)), 1);
            };
            Place(s, at, Vector2.up, -90);
            if (delay > 0) s.Go.SetActive(false);
            else redraw(0);
            flashes.Add(new Flash { Shape = s, Start = Time.time + delay, Seconds = seconds, Redraw = redraw, Follow = follow });
            // what the area is made of: paint, stones, sound
            if (kind == "paint")
                for (var i = 0; i < 7; i++)
                {
                    var p = at + Random.insideUnitCircle * radius * 0.85f;
                    PopSprite(Dot(), new Vector3(p.x, p.y, 0), 0.22f + Random.value * 0.18f, 0.6f, 0.2f, Alpha(i % 2 == 0 ? new Color(1f, 0.48f, 0.66f) : UI.UiKit.Gold400, 0.95f));
                }
            if (kind == "stones")
                for (var i = 0; i < 4; i++)
                {
                    var p = at + Random.insideUnitCircle * radius * 0.8f;
                    Fly("stone", "", p + new Vector2(0, 0.01f), p, 0.28f, 3.2f);
                }
        }

        /// <summary>
        /// An area of a kind of blow: a spin's two sweeps turning round the caster, a drop's shock rings one after
        /// another with dust, sound's ripples, paint's spatter, an ultimate's double ring and its stamp; plain otherwise.
        /// </summary>
        public void Area(Vector2 at, float radius, Color tone, Blow blow, Transform follow = null, string kind = null)
        {
            switch (blow)
            {
                case Blow.Spin:
                    for (var i = 0; i < 2; i++)
                    {
                        var s = Take();
                        var start = i * 180f;
                        System.Action<float> redraw = k => FxShapes.Wedge(s.Mesh, radius * (0.8f + 0.2f * k), 110, 0.18f * (1 - k) + 0.03f,
                            Alpha(tone, 0.28f * (1 - k)), Alpha(tone, 0.95f * (1 - k)), 0.7f);
                        Place(s, at, new Vector2(Mathf.Cos(start * Mathf.Deg2Rad), Mathf.Sin(start * Mathf.Deg2Rad)), -90);
                        redraw(0);
                        flashes.Add(new Flash { Shape = s, Start = Time.time, Seconds = 0.4f, Redraw = redraw, Follow = follow, Spin = -720 });
                    }
                    break;
                case Blow.Shock:
                    for (var i = 0; i < 3; i++) Burst(at, radius * (0.6f + 0.25f * i), tone, follow, null, i * 0.09f, 0.4f);
                    Dust(at, 6);
                    break;
                case Blow.Sound:
                    for (var i = 0; i < 3; i++) Burst(at, radius * (0.5f + 0.25f * i), tone, follow, null, i * 0.07f, 0.36f);
                    break;
                case Blow.Ultimate:
                    Burst(at, radius, tone, follow, kind);
                    Burst(at, radius * 1.15f, Color.white, follow, null, 0.06f, 0.35f);
                    var word = Art("fx-bum");
                    if (word) PopSprite(word, new Vector3(at.x, at.y + 1.2f, -0.5f), 1.6f, 0.7f, 0.3f, Color.white);
                    break;
                default:
                    Burst(at, radius, tone, follow, kind ?? (blow == Blow.Paint ? "paint" : null));
                    break;
            }
        }

        // ---------- flying things ----------

        /// <summary>
        /// A shot in flight from one ground point to another (stones, paint, sound): drawn at chest height with a shadow
        /// on the ground. <paramref name="arc"/> lifts it into a lob.
        /// </summary>
        public void Fly(string kind, string owner, Vector2 from, Vector2 to, float seconds, float arc = 0)
        {
            var sprite = TakeSprite();
            sprite.sprite = kind switch
            {
                "paint" => SoftDot(),
                "sound" => Art("ring"),
                _ => Dot(),
            };
            sprite.color = kind switch
            {
                "paint" => new Color(1f, 0.48f, 0.66f),
                "sound" => UI.UiKit.Rep400,
                _ => new Color(0.74f, 0.72f, 0.68f),
            };
            var shadow = TakeSprite();
            shadow.sprite = SoftDot();
            shadow.color = new Color(0, 0, 0, 0.22f);
            flyers.Add(new Flyer
            {
                Sprite = sprite, Shadow = shadow, From = from, To = to, Start = Time.time, Seconds = Mathf.Max(0.05f, seconds),
                Owner = owner, Kind = kind, Spin = arc,
            });
        }

        /// <summary>A shot of this caster hit something: the oldest one still flying stops there.</summary>
        public void Landed(string owner, Vector2 at)
        {
            for (var i = 0; i < flyers.Count; i++)
            {
                if (flyers[i].Owner != owner || string.IsNullOrEmpty(owner)) continue;
                Drop(flyers[i]);
                flyers.RemoveAt(i);
                return;
            }
        }

        void Drop(Flyer f)
        {
            GiveSprite(f.Sprite);
            GiveSprite(f.Shadow);
        }

        // ---------- pops: words, stars, ghosts ----------

        /// <summary>
        /// A blow landed: a star at the point of contact, a comic word on a big or critical one (PAC!, BAM!, TRZASK!,
        /// BUM!), sized by how hard it was.
        /// </summary>
        public void Impact(Vector3 head, int damage, bool crit, int maxHp, Blow blow = Blow.Fist)
        {
            var share = maxHp > 0 ? (float)damage / maxHp : 0.1f;
            // the point of contact: a star in the blow's colour (gold when critical), paint splats for paint
            var at = head + new Vector3(Random.Range(-0.15f, 0.15f), Random.Range(-0.35f, -0.1f), -0.3f);
            var contact = Art(blow == Blow.Paint ? "fx-splat" : "fx-star");
            var color = crit ? UI.UiKit.Gold400 : blow == Blow.Paint ? PaintPink : Color.Lerp(Color.white, ToneOf(blow), 0.45f);
            if (contact) PopSprite(contact, at, 0.42f + share * 1.4f, 0.3f, 0, color, blow != Blow.Paint);
            if (blow == Blow.Sound) Burst(new Vector2(head.x, head.y - 0.9f), 0.55f, UI.UiKit.Rep400, null, null, 0, 0.25f);
            if (!crit && share < 0.12f && blow != Blow.Ultimate) return;
            var word = share > 0.22f && blow is Blow.Fist ? "fx-trzask" : WordOf(blow, crit);
            if (word == "fx-splat") return; // paint's word is its splat
            var picture = Art(word);
            if (picture) PopSprite(picture, head + new Vector3(Random.Range(-0.35f, 0.35f), 0.25f, -0.4f), crit ? 1.15f : 0.9f, 0.55f, 0.25f, Color.white);
        }

        /// <summary>The K.O. stencil over a fallen fighter.</summary>
        public void KnockOut(Vector3 head)
        {
            var picture = Art("fx-ko");
            if (picture) PopSprite(picture, head + new Vector3(0, 0.15f, -0.4f), 1.4f, 1.1f, 0.18f, Color.white);
        }

        /// <summary>After-images of a dash: copies of the body left along the way, fading.</summary>
        public void Ghosts(SpriteRenderer body, Vector2 from, Vector2 to, Color tone)
        {
            if (!body || !body.sprite) return;
            for (var i = 0; i < 3; i++)
            {
                var k = (i + 0.5f) / 3f;
                var g = TakeSprite();
                g.sprite = body.sprite;
                g.flipX = body.flipX;
                var alpha = 0.5f - i * 0.12f;
                g.color = Alpha(Color.Lerp(Color.white, tone, 0.5f), alpha);
                var p = Vector2.Lerp(from, to, k);
                pops.Add(new Pop
                {
                    Sprite = g, Start = Time.time, Seconds = 0.28f - i * 0.04f, At = new Vector3(p.x, p.y, 0),
                    Ghost = true, Scale = body.transform.lossyScale, Alpha = alpha,
                });
                g.transform.rotation = WorldView.Upright;
                g.sortingOrder = WorldView.SortOrderFor(p.y) - 1;
            }
        }

        void PopSprite(Sprite s, Vector3 at, float size, float seconds, float rise, Color color, bool spin = false)
        {
            var r = TakeSprite();
            r.sprite = s;
            r.color = color;
            r.flipX = false;
            pops.Add(new Pop { Sprite = r, Start = Time.time, Seconds = seconds, Size = size, At = at, Rise = rise, Spin = spin });
            r.sortingOrder = 20001;
            r.transform.rotation = WorldView.Upright;
        }

        // ---------- the frame ----------

        void LateUpdate()
        {
            var t = Time.time;
            for (var i = flashes.Count - 1; i >= 0; i--)
            {
                var f = flashes[i];
                if (t < f.Start) continue;
                if (!f.Shape.Go.activeSelf) f.Shape.Go.SetActive(true);
                var k = Mathf.Clamp01((t - f.Start) / f.Seconds);
                if (f.Follow) f.Shape.Go.transform.position = new Vector3(f.Follow.position.x, f.Follow.position.y, -0.02f);
                if (f.Spin != 0) f.Shape.Go.transform.Rotate(0, 0, f.Spin * Time.deltaTime);
                f.Redraw?.Invoke(k);
                if (k < 1) continue;
                Give(f.Shape);
                flashes.RemoveAt(i);
            }
            for (var i = flyers.Count - 1; i >= 0; i--)
            {
                var f = flyers[i];
                var k = Mathf.Clamp01((t - f.Start) / f.Seconds);
                var p = Vector2.Lerp(f.From, f.To, k);
                var lift = 0.55f + (f.Spin > 0 ? Mathf.Sin(k * Mathf.PI) * f.Spin * 0.2f : 0);
                if (f.Spin > 2) lift = Mathf.Lerp(f.Spin, 0.05f, k); // falling from the sky
                // the shot stands up like everything else: its height goes along the tilted "up"
                var up = WorldView.Upright * Vector3.up;
                f.Sprite.transform.position = new Vector3(p.x, p.y, 0) + up * lift;
                f.Sprite.transform.rotation = WorldView.Upright * Quaternion.Euler(0, 0, f.Kind == "stone" ? t * 720 : 0);
                var size = f.Kind switch { "sound" => 0.35f + k * 0.45f, "paint" => 0.34f, _ => 0.22f };
                f.Sprite.transform.localScale = Vector3.one * size;
                f.Sprite.sortingOrder = WorldView.SortOrderFor(p.y) + 2;
                if (f.Kind == "sound") f.Sprite.color = Alpha(UI.UiKit.Rep400, 1 - k * 0.6f);
                f.Shadow.transform.SetPositionAndRotation(new Vector3(p.x, p.y, -0.01f), Quaternion.identity);
                f.Shadow.transform.localScale = new Vector3(size * 1.1f, size * 0.55f, 1);
                f.Shadow.sortingOrder = -92;
                if (k < 1) continue;
                Drop(f);
                flyers.RemoveAt(i);
            }
            for (var i = pops.Count - 1; i >= 0; i--)
            {
                var p = pops[i];
                var k = (t - p.Start) / p.Seconds;
                if (k < 0) continue;
                if (k >= 1)
                {
                    GiveSprite(p.Sprite);
                    pops.RemoveAt(i);
                    continue;
                }
                if (p.Ghost)
                {
                    p.Sprite.transform.localScale = p.Scale;
                    p.Sprite.transform.position = p.At;
                    var g = p.Sprite.color;
                    g.a = p.Alpha * (1 - k);
                    p.Sprite.color = g;
                    continue;
                }
                // a punchy pop: overshoot in, hold, shrink and fade out
                var scale = k < 0.18f ? Mathf.Lerp(0.4f, 1.15f, k / 0.18f) : k < 0.3f ? Mathf.Lerp(1.15f, 1, (k - 0.18f) / 0.12f) : 1;
                var s = p.Sprite;
                var w = s.sprite ? s.sprite.bounds.size.x : 1;
                var unit = p.Size / Mathf.Max(0.01f, w);
                s.transform.localScale = Vector3.one * (unit * scale * (k > 0.75f ? Mathf.Lerp(1, 0.85f, (k - 0.75f) / 0.25f) : 1));
                var up = WorldView.Upright * Vector3.up;
                s.transform.position = p.At + up * (p.Rise * k);
                if (p.Spin) s.transform.rotation = WorldView.Upright * Quaternion.Euler(0, 0, k * 90);
                var c = s.color;
                c.a = k > 0.7f ? Mathf.Lerp(c.a, 0, (k - 0.7f) / 0.3f) : c.a;
                s.color = c;
            }
        }

        // ---------- pools and pictures ----------

        SpriteRenderer TakeSprite()
        {
            if (freeSprites.Count > 0)
            {
                var s = freeSprites[^1];
                freeSprites.RemoveAt(freeSprites.Count - 1);
                s.gameObject.SetActive(true);
                s.transform.localScale = Vector3.one;
                return s;
            }
            var go = new GameObject("Fx");
            go.transform.SetParent(transform, false);
            return go.AddComponent<SpriteRenderer>();
        }

        void GiveSprite(SpriteRenderer s)
        {
            if (!s) return;
            s.gameObject.SetActive(false);
            freeSprites.Add(s);
        }

        /// <summary>Everything off at once (a new map, the bud knocked out of the room).</summary>
        public void Clear()
        {
            HideAim();
            foreach (var f in flashes) Give(f.Shape);
            flashes.Clear();
            foreach (var f in flyers) Drop(f);
            flyers.Clear();
            foreach (var p in pops) GiveSprite(p.Sprite);
            pops.Clear();
        }

        /// <summary>A picture from Resources/Ui/Fx (1 px per unit there; the pops scale it to a world size).</summary>
        static Sprite Art(string name)
        {
            if (art.TryGetValue(name, out var s)) return s;
            if (name == "ring") return art[name] = MakeRing();
            var tex = Resources.Load<Texture2D>("Ui/Fx/" + name);
            s = tex ? Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f), tex.width) : null;
            art[name] = s;
            return s;
        }

        /// <summary>A small ball with an ink outline (a stone, a drop of paint).</summary>
        static Sprite Dot() => dot ??= MakeDot(true);

        static Sprite SoftDot() => softDot ??= MakeDot(false);

        static Sprite MakeDot(bool outlined)
        {
            const int size = 64;
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp };
            var px = new Color32[size * size];
            for (var y = 0; y < size; y++)
            for (var x = 0; x < size; x++)
            {
                var d = Vector2.Distance(new Vector2(x + 0.5f, y + 0.5f), new Vector2(size / 2f, size / 2f)) / (size / 2f);
                Color c;
                if (outlined)
                {
                    var a = Mathf.Clamp01((1 - d) * 24);
                    // the ink rim, a lit top-left: the same cel look as the props
                    var rim = d > 0.8f;
                    var light = !rim && x < size * 0.5f && y > size * 0.5f && d < 0.55f;
                    c = rim ? new Color(0.07f, 0.07f, 0.09f, a) : light ? new Color(1, 1, 1, a) : new Color(0.86f, 0.86f, 0.86f, a);
                }
                else c = new Color(1, 1, 1, Mathf.Clamp01(1 - d) * Mathf.Clamp01(1 - d) * 1.6f);
                px[y * size + x] = c;
            }
            tex.SetPixels32(px);
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), size);
        }

        /// <summary>Sound: an open ring the colour of the rep accent.</summary>
        static Sprite MakeRing()
        {
            const int size = 96;
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp };
            var px = new Color32[size * size];
            for (var y = 0; y < size; y++)
            for (var x = 0; x < size; x++)
            {
                var v = new Vector2(x + 0.5f - size / 2f, y + 0.5f - size / 2f);
                var d = v.magnitude / (size / 2f);
                var a = Mathf.Clamp01(1 - Mathf.Abs(d - 0.78f) / 0.11f);
                // open at the back: a sound wave, not a donut
                if (v.x < -size * 0.12f) a *= Mathf.Clamp01((v.x + size * 0.38f) / (size * 0.26f));
                px[y * size + x] = new Color32(255, 255, 255, (byte)(a * 255));
            }
            tex.SetPixels32(px);
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), size);
        }

        void OnDestroy()
        {
            foreach (var s in freeShapes)
                if (s.Mesh) Destroy(s.Mesh);
            foreach (var f in flashes)
                if (f.Shape.Mesh) Destroy(f.Shape.Mesh);
            if (aim?.Mesh) Destroy(aim.Mesh);
            if (aimRange?.Mesh) Destroy(aimRange.Mesh);
            if (material) Destroy(material);
        }
    }
}
