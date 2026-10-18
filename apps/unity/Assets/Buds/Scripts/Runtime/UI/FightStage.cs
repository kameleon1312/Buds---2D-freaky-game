using System.Collections.Generic;
using Buds.Characters;
using Buds.Core;
using Buds.World;
using UnityEngine;

namespace Buds.UI
{
    /// <summary>
    /// The 3D duel stage: a night street built far from the map (asphalt, kerbs, tenements, lamps with pools of light),
    /// the two fighters standing on it and a film camera that moves with the fight — a dolly in under the VS, a push
    /// towards whoever strikes, a snap zoom and a freeze on a crit, a slow orbit around a knockout. The fighters are the
    /// buds' own sheets, turned towards the camera every frame; they lunge, jump (their shadows stay on the ground),
    /// step back into depth to dodge and fall flat onto the asphalt. World-space sparks, dust and after-images add
    /// weight. FightScreen drives it and draws the HUD and the comic effects over it.
    /// </summary>
    public sealed class FightStage : MonoBehaviour
    {
        /// <summary>Far from every map: nothing of the world is in shot.</summary>
        static readonly Vector3 Origin = new(-4000, -4000, 0);
        public const float Gap = 2.2f; // each fighter's distance from the middle, tiles
        static readonly Color Night = new(0.075f, 0.09f, 0.14f);
        static readonly string[] BackProps = { "kamienica-a", "blok-b", "sklep-kiosk", "kamienica-cegla-a", "garaze", "kamienica-c", "blok-a" };
        static readonly string[] Extras = { "latarnia-gaz", "lamp", "kosz", "hydrant", "auto-a", "przystanek", "graffiti-a", "graffiti-c", "road-dash", "manhole" };

        /// <summary>Where the camera is: what it looks at, how far, from which side and how high, and its lens.</summary>
        public struct Pose
        {
            public Vector3 Look; // stage-local
            public float Distance;
            public float Yaw; // degrees around the vertical axis
            public float Pitch; // degrees from straight down
            public float Fov;

            public static Pose Lerp(Pose a, Pose b, float t) => new()
            {
                Look = Vector3.Lerp(a.Look, b.Look, t),
                Distance = Mathf.Lerp(a.Distance, b.Distance, t),
                Yaw = Mathf.LerpAngle(a.Yaw, b.Yaw, t),
                Pitch = Mathf.Lerp(a.Pitch, b.Pitch, t),
                Fov = Mathf.Lerp(a.Fov, b.Fov, t),
            };
        }

        /// <summary>The neutral shot: both fighters, a little from above, the street behind them.</summary>
        public static Pose Neutral => new() { Look = new Vector3(0, 0.4f, -1.25f), Distance = 9.2f, Yaw = 0, Pitch = 70, Fov = 34 };

        public Camera Cam { get; private set; }
        public StageFighter Bud { get; private set; }
        public StageFighter Enemy { get; private set; }
        /// <summary>The camera eases towards this pose at <see cref="CamSpeed"/> (1/s).</summary>
        public Pose Target = Neutral;
        public float CamSpeed = 6;

        Pose current = Neutral;
        Vector3 shake;
        float shakeLeft;
        float shakeTotal;
        float shakeStrength;
        FollowCamera follow;
        Vector3 savedPos;
        Quaternion savedRot;
        float savedFov;
        Color savedBg;
        CameraClearFlags savedClear;
        readonly List<(Transform t, float phase)> glows = new();
        readonly List<Particle> particles = new();
        /// <summary>The street props, packed once and kept for every duel (the atlas is the costly part).</summary>
        static PropArt art;
        static Sprite disc;
        static Sprite star;
        static Sprite asphalt;
        static Sprite pool;

        sealed class Particle
        {
            public SpriteRenderer Renderer;
            public Vector3 Velocity;
            public float Life;
            public float Age;
            public float Gravity;
            public bool Flat; // lies on the ground (dust) instead of facing the camera
            public float Grow;
            public Color Color;
        }

        // ---------- building ----------

        public static FightStage Create(BudSheet budSheet, BudSheet enemySheet, Sprite budWeapon, Sprite enemyWeapon)
        {
            var go = new GameObject("FightStage");
            go.transform.position = Origin;
            var stage = go.AddComponent<FightStage>();
            stage.Build(budSheet, enemySheet, budWeapon, enemyWeapon);
            return stage;
        }

        void Build(BudSheet budSheet, BudSheet enemySheet, Sprite budWeapon, Sprite enemyWeapon)
        {
            disc ??= UiKit.Circle(32);
            star ??= UiKit.Picture("Ui/Fx/fx-star");
            asphalt ??= MakeAsphalt();
            pool ??= MakePool();
            var names = new HashSet<string>(BackProps);
            foreach (var e in Extras) names.Add(e);
            art ??= PropArt.Load(names);

            // the street: asphalt, a pale centre line, a kerb and the pavement in front of the houses
            Flat("Asphalt", asphalt, new Vector3(0, 0.5f, 0), new Vector2(60, 26), new Color(0.82f, 0.84f, 0.92f), -1000);
            Flat("Pavement", WhiteSprite(), new Vector3(0, 6.2f, -0.01f), new Vector2(60, 5),
                new Color(0.32f, 0.33f, 0.38f), -990);
            Flat("Kerb", WhiteSprite(), new Vector3(0, 3.65f, -0.02f), new Vector2(60, 0.22f), new Color(0.55f, 0.56f, 0.6f), -985);
            for (var x = -14f; x <= 14f; x += 3.2f)
                Flat("Dash", WhiteSprite(), new Vector3(x, -2.4f, -0.02f), new Vector2(1.5f, 0.14f), new Color(0.9f, 0.86f, 0.62f, 0.55f), -980);
            // the pools of light the fighters stand in, and the lamps that throw them
            Flat("Light", pool, new Vector3(0, 0.1f, -0.03f), new Vector2(12, 6), new Color(1f, 0.93f, 0.72f, 0.55f), -970);

            // the houses along the pavement, darkened for the night
            var x0 = -16f;
            for (var i = 0; x0 < 16f; i++)
            {
                var name = BackProps[i % BackProps.Length];
                var sprite = art.Get(name);
                if (!sprite) { x0 += 4; continue; }
                var w = sprite.bounds.size.x;
                Stand(name, sprite, new Vector3(x0 + w / 2, 8.2f, 0), new Color(0.5f, 0.55f, 0.72f), 100 + i);
                x0 += w + 0.3f;
            }
            // lamps on the kerb, each with a warm glow
            foreach (var (name, x) in new[] { ("latarnia-gaz", -5.6f), ("lamp", 5.8f) })
            {
                var sprite = art.Get(name);
                if (!sprite) continue;
                var lamp = Stand(name, sprite, new Vector3(x, 4.2f, 0), new Color(0.78f, 0.8f, 0.9f), 400);
                var glow = Billboard("Glow", disc, new Vector3(x, 4.2f, -sprite.bounds.size.y * 0.92f), 1.6f, new Color(1f, 0.85f, 0.45f, 0.35f), 401);
                glows.Add((glow, x));
                Flat("LampPool", pool, new Vector3(x, 3.4f, -0.03f), new Vector2(5, 3), new Color(1f, 0.85f, 0.5f, 0.35f), -975);
                lamp.name = "Lamp";
            }
            // a few things that make it a real street
            foreach (var (name, pos, order) in new[]
                     {
                         ("kosz", new Vector3(-3.4f, 4.6f, 0), 420), ("hydrant", new Vector3(3.2f, 4.5f, 0), 420),
                         ("auto-a", new Vector3(-10.5f, 3.0f, 0), 410), ("przystanek", new Vector3(10.6f, 5.0f, 0), 300),
                     })
            {
                var sprite = art.Get(name);
                if (sprite) Stand(name, sprite, pos, new Color(0.66f, 0.7f, 0.84f), order);
            }

            Bud = new StageFighter(transform, budSheet, new Vector3(-Gap, 0, 0), +1, budWeapon, 1000);
            Enemy = new StageFighter(transform, enemySheet, new Vector3(Gap, 0, 0), -1, enemyWeapon, 1010);

            // take the camera over (FollowCamera rests until the duel ends)
            Cam = Camera.main;
            follow = Cam.GetComponent<FollowCamera>();
            if (follow) follow.enabled = false;
            savedPos = Cam.transform.position;
            savedRot = Cam.transform.rotation;
            savedFov = Cam.fieldOfView;
            savedBg = Cam.backgroundColor;
            savedClear = Cam.clearFlags;
            Cam.clearFlags = CameraClearFlags.SolidColor;
            Cam.backgroundColor = Night;
            current = Target = Neutral;
            ApplyCamera();
        }

        /// <summary>Gives the camera back to the world, where it was, and removes the stage.</summary>
        public void Close()
        {
            if (Cam)
            {
                Cam.transform.SetPositionAndRotation(savedPos, savedRot);
                Cam.fieldOfView = savedFov;
                Cam.backgroundColor = savedBg;
                Cam.clearFlags = savedClear;
            }
            if (follow)
            {
                follow.enabled = true;
                follow.SnapToTarget();
            }
            Destroy(gameObject);
        }

        static Sprite white;

        static Sprite WhiteSprite()
        {
            if (white) return white;
            var tex = new Texture2D(4, 4) { filterMode = FilterMode.Bilinear };
            var px = new Color32[16];
            for (var i = 0; i < 16; i++) px[i] = new Color32(255, 255, 255, 255);
            tex.SetPixels32(px);
            tex.Apply();
            white = Sprite.Create(tex, new Rect(0, 0, 4, 4), new Vector2(0.5f, 0.5f), 4);
            return white;
        }

        SpriteRenderer Flat(string name, Sprite sprite, Vector3 at, Vector2 size, Color color, int order)
        {
            var go = new GameObject(name);
            go.transform.SetParent(transform, false);
            go.transform.localPosition = at;
            var r = go.AddComponent<SpriteRenderer>();
            r.sprite = sprite;
            r.color = color;
            r.sortingOrder = order;
            if (sprite == asphalt)
            {
                r.drawMode = SpriteDrawMode.Tiled;
                r.size = size;
            }
            else go.transform.localScale = new Vector3(size.x / sprite.bounds.size.x, size.y / sprite.bounds.size.y, 1);
            return r;
        }

        Transform Stand(string name, Sprite sprite, Vector3 at, Color tint, int order)
        {
            var go = new GameObject(name);
            go.transform.SetParent(transform, false);
            go.transform.localPosition = at;
            var r = go.AddComponent<SpriteRenderer>();
            r.sprite = sprite;
            r.color = tint;
            r.sortingOrder = order;
            go.transform.localRotation = Quaternion.LookRotation(Vector3.up, Vector3.back); // upright, facing south
            return go.transform;
        }

        Transform Billboard(string name, Sprite sprite, Vector3 at, float size, Color color, int order)
        {
            var go = new GameObject(name);
            go.transform.SetParent(transform, false);
            go.transform.localPosition = at;
            go.transform.localScale = Vector3.one * (size / sprite.bounds.size.x);
            var r = go.AddComponent<SpriteRenderer>();
            r.sprite = sprite;
            r.color = color;
            r.sortingOrder = order;
            return go.transform;
        }

        // ---------- every frame ----------

        void LateUpdate()
        {
            var dt = Time.unscaledDeltaTime;
            current = Pose.Lerp(current, Target, 1 - Mathf.Exp(-CamSpeed * dt));
            if (shakeLeft > 0)
            {
                shakeLeft = Mathf.Max(0, shakeLeft - dt);
                var s = shakeStrength * (shakeLeft / Mathf.Max(0.001f, shakeTotal));
                shake = new Vector3(Random.Range(-s, s), 0, Random.Range(-s, s) * 0.6f);
            }
            else shake = Vector3.zero;
            ApplyCamera();
            var t = Time.unscaledTime;
            foreach (var (glow, phase) in glows)
                if (glow)
                {
                    glow.rotation = FacingCamera(glow.position);
                    var r = glow.GetComponent<SpriteRenderer>();
                    r.color = new Color(1f, 0.85f, 0.45f, 0.3f + Mathf.Sin(t * 2.3f + phase) * 0.05f);
                }
            Bud?.Apply(this);
            Enemy?.Apply(this);
            for (var i = particles.Count - 1; i >= 0; i--)
            {
                var p = particles[i];
                p.Age += dt;
                if (p.Age >= p.Life || !p.Renderer)
                {
                    if (p.Renderer) Destroy(p.Renderer.gameObject);
                    particles.RemoveAt(i);
                    continue;
                }
                var k = p.Age / p.Life;
                p.Velocity += new Vector3(0, 0, p.Gravity * dt); // +z is down
                var tr = p.Renderer.transform;
                tr.localPosition += p.Velocity * dt;
                if (tr.localPosition.z > 0 && !p.Flat) tr.localPosition = new Vector3(tr.localPosition.x, tr.localPosition.y, 0);
                tr.localScale *= 1 + p.Grow * dt;
                if (!p.Flat) tr.rotation = FacingCamera(tr.position) * Quaternion.Euler(0, 0, k * 200);
                p.Renderer.color = new Color(p.Color.r, p.Color.g, p.Color.b, p.Color.a * (1 - k));
            }
        }

        void ApplyCamera()
        {
            if (!Cam) return;
            var rot = Quaternion.AngleAxis(current.Yaw, Vector3.forward) * Quaternion.AngleAxis(-current.Pitch, Vector3.right);
            var look = transform.position + current.Look;
            Cam.transform.SetPositionAndRotation(look - rot * Vector3.forward * current.Distance + shake, rot);
            Cam.fieldOfView = current.Fov;
        }

        /// <summary>A standing thing turned to face the camera, upright (its up is the world's up, -z).</summary>
        public Quaternion FacingCamera(Vector3 worldPos)
        {
            var toThing = worldPos - Cam.transform.position;
            toThing.z = 0;
            if (toThing.sqrMagnitude < 0.0001f) toThing = Vector3.up;
            return Quaternion.LookRotation(toThing.normalized, Vector3.back);
        }

        /// <summary>A point of the stage on the screen (pixels, bottom-left origin).</summary>
        public Vector2 ScreenOf(Vector3 local) => Cam.WorldToScreenPoint(transform.position + local);

        /// <summary>Where a fighter's chest is, height <paramref name="h"/> tiles above its feet, on the screen.</summary>
        public Vector2 ScreenOf(StageFighter f, float h) => ScreenOf(f.Position + new Vector3(0, 0, -h));

        // ---------- camera moves ----------

        public void Frame(Pose pose, float speed)
        {
            Target = pose;
            CamSpeed = speed;
        }

        /// <summary>Jumps the camera to a pose at once (the start of a move).</summary>
        public void Cut(Pose pose)
        {
            current = Target = pose;
            ApplyCamera();
        }

        /// <summary>A shot leaning in towards one side of the fight (the attacker), a little turned.</summary>
        public static Pose Towards(int side, float push = 0.82f, float yaw = 8, float fovDrop = 2)
        {
            var p = Neutral;
            p.Look += new Vector3(side * 0.9f, 0, -0.1f);
            p.Distance *= push;
            p.Yaw = side * yaw;
            p.Fov -= fovDrop;
            return p;
        }

        public void Shake(float seconds, float strength)
        {
            shakeLeft = shakeTotal = seconds;
            shakeStrength = strength;
        }

        // ---------- world effects ----------

        /// <summary>Four-pointed sparks flying out of a blow in 3D, falling under gravity.</summary>
        public void Sparks(Vector3 at, bool crit, Color a, Color b)
        {
            var n = crit ? 14 : 8;
            for (var i = 0; i < n; i++)
            {
                var dir = new Vector3(Random.Range(-1f, 1f), Random.Range(-0.6f, 0.4f), -Random.Range(0.2f, 1.2f)).normalized;
                Spawn(star, at, dir * Random.Range(crit ? 4f : 2.5f, crit ? 7f : 4.5f), crit ? 0.28f : 0.2f, i % 2 == 0 ? a : b,
                    Random.Range(0.3f, 0.5f), 9, false, -0.6f, 3000);
            }
        }

        /// <summary>A puff of dust on the ground (landings, falls, slides).</summary>
        public void Dust(Vector3 at, int puffs = 5, float size = 0.5f)
        {
            for (var i = 0; i < puffs; i++)
            {
                var dir = new Vector3(Random.Range(-1f, 1f), Random.Range(-0.5f, 0.5f), 0).normalized;
                Spawn(disc, at + new Vector3(0, 0, -0.05f), dir * Random.Range(0.6f, 1.6f), size, new Color(0.75f, 0.74f, 0.7f, 0.55f),
                    Random.Range(0.35f, 0.6f), 0, false, 1.4f, 2500);
            }
        }

        /// <summary>Paint from a spray hit: blobs that splash out and drop.</summary>
        public void Paint(Vector3 at, Color color)
        {
            for (var i = 0; i < 10; i++)
            {
                var dir = new Vector3(Random.Range(-1f, 1f), Random.Range(-0.4f, 0.4f), -Random.Range(0f, 1f)).normalized;
                Spawn(disc, at, dir * Random.Range(1.5f, 3.5f), Random.Range(0.12f, 0.26f), color, Random.Range(0.4f, 0.7f), 8, false, 0, 3000);
            }
        }

        /// <summary>A world-space sprite that faces the camera and travels (projectiles, rings).</summary>
        public SpriteRenderer Prop(Sprite sprite, Vector3 at, float size, Color color, int order = 2800)
        {
            var go = new GameObject("Prop");
            go.transform.SetParent(transform, false);
            go.transform.localPosition = at;
            go.transform.localScale = Vector3.one * (size / Mathf.Max(0.001f, sprite.bounds.size.x));
            var r = go.AddComponent<SpriteRenderer>();
            r.sprite = sprite;
            r.color = color;
            r.sortingOrder = order;
            go.transform.rotation = FacingCamera(go.transform.position);
            return r;
        }

        /// <summary>A fading copy of a fighter where it just was: speed you can see.</summary>
        public void Ghost(StageFighter f)
        {
            var go = new GameObject("Ghost");
            go.transform.SetParent(transform, false);
            go.transform.SetPositionAndRotation(f.Visual.position, f.Visual.rotation);
            go.transform.localScale = f.Visual.lossyScale;
            var r = go.AddComponent<SpriteRenderer>();
            r.sprite = f.Body.sprite;
            r.sortingOrder = f.Body.sortingOrder - 2;
            particles.Add(new Particle
            {
                Renderer = r, Velocity = Vector3.zero, Life = 0.22f, Gravity = 0, Flat = true, Grow = 0,
                Color = new Color(1, 1, 1, 0.38f),
            });
        }

        void Spawn(Sprite sprite, Vector3 at, Vector3 velocity, float size, Color color, float life, float gravity, bool flat, float grow, int order)
        {
            if (!sprite) return;
            var go = new GameObject("Particle");
            go.transform.SetParent(transform, false);
            go.transform.localPosition = at;
            go.transform.localScale = Vector3.one * (size / sprite.bounds.size.x);
            var r = go.AddComponent<SpriteRenderer>();
            r.sprite = sprite;
            r.color = color;
            r.sortingOrder = order;
            if (flat) go.transform.localRotation = Quaternion.identity;
            particles.Add(new Particle { Renderer = r, Velocity = velocity, Life = life, Gravity = gravity, Flat = flat, Grow = grow, Color = color });
        }

        // ---------- textures ----------

        /// <summary>Night asphalt: dark grey with fine speckles, tiled over the street.</summary>
        static Sprite MakeAsphalt()
        {
            const int s = 64;
            var tex = new Texture2D(s, s, TextureFormat.RGBA32, true) { filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Repeat };
            var rng = new System.Random(7);
            var px = new Color32[s * s];
            for (var i = 0; i < px.Length; i++)
            {
                var v = 46 + rng.Next(0, 12);
                if (rng.Next(0, 23) == 0) v += 26; // light grit
                px[i] = new Color32((byte)v, (byte)(v + 2), (byte)(v + 8), 255);
            }
            tex.SetPixels32(px);
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, s, s), new Vector2(0.5f, 0.5f), s / 2f, 0, SpriteMeshType.FullRect);
        }

        /// <summary>A soft oval of light (white, tinted warm), brightest in the middle.</summary>
        static Sprite MakePool()
        {
            const int w = 128, h = 64;
            var tex = new Texture2D(w, h, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp };
            var px = new Color32[w * h];
            for (var y = 0; y < h; y++)
            for (var x = 0; x < w; x++)
            {
                var dx = (x + 0.5f) / w * 2 - 1;
                var dy = (y + 0.5f) / h * 2 - 1;
                var a = Mathf.Clamp01(1 - (dx * dx + dy * dy));
                px[y * w + x] = new Color32(255, 255, 255, (byte)(a * a * 255));
            }
            tex.SetPixels32(px);
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, w, h), new Vector2(0.5f, 0.5f), w);
        }
    }

    /// <summary>
    /// One fighter on the stage: the bud's sheet on a camera-facing card, its weapon in hand, a shadow on the ground.
    /// FightScreen animates the numbers (step, height, lean, squash, lying) and the stage applies them every frame.
    /// </summary>
    public sealed class StageFighter
    {
        public readonly Transform Root;
        public readonly Transform Visual;
        public readonly SpriteRenderer Body;
        public readonly Transform Weapon;
        public readonly SpriteRenderer WeaponSprite;
        public readonly SpriteRenderer Shadow;
        public readonly BudSheet Sheet;
        public readonly Vector3 Home;
        /// <summary>+1 faces right (the bud), -1 left.</summary>
        public readonly int Dir;

        /// <summary>Along the street (towards the rival is +Dir), into depth (+ = further away), height above the ground.</summary>
        public float X, Depth, Height;
        public float Lean; // degrees, + leans back
        public float SquashX = 1, SquashY = 1;
        /// <summary>0 standing … 1 lying flat on the asphalt, head away from the rival.</summary>
        public float Lying;
        public float WeaponAngle;
        /// <summary>Held up, pointing at the rival (the icon turned from up-right to up-left).</summary>
        public const float RestAngle = 90;
        /// <summary>Level, straight at the rival.</summary>
        public const float LevelAngle = 135;
        public Color Tint = Color.white;
        public float Alpha = 1;
        public int Frame;

        public Vector3 Position => Home + new Vector3(X * Dir, Depth, -Height);

        const float Scale = WorldView.CharacterScale * 1.25f;

        public StageFighter(Transform stage, BudSheet sheet, Vector3 home, int dir, Sprite weapon, int order)
        {
            Sheet = sheet;
            Home = home;
            Dir = dir;
            Root = new GameObject(dir > 0 ? "Bud" : "Rival").transform;
            Root.SetParent(stage, false);
            Root.localPosition = home;
            Shadow = WorldView.Shadow(Root, 1.4f);
            Shadow.sortingOrder = -960;
            Visual = new GameObject("Visual").transform;
            Visual.SetParent(Root, false);
            Body = Visual.gameObject.AddComponent<SpriteRenderer>();
            Body.sprite = sheet.Get(Facing.Side, 0);
            Body.sortingOrder = order;
            var w = new GameObject("Weapon");
            w.transform.SetParent(Visual, false);
            Weapon = w.transform;
            // the hand, about two thirds up the body, a little in front of it
            Weapon.localPosition = new Vector3(-0.26f, 0.5f, 0);
            // the icons point up and right from their handle; in the card "forward" (the rival) is to the left
            Weapon.localScale = new Vector3(0.64f, 0.64f, 1);
            WeaponSprite = w.AddComponent<SpriteRenderer>();
            WeaponSprite.sprite = weapon;
            WeaponSprite.enabled = weapon;
            WeaponSprite.sortingOrder = order + 1;
            WeaponAngle = RestAngle;
        }

        public void Apply(FightStage stage)
        {
            Root.localPosition = Position;
            // the shadow stays on the ground and shrinks as the fighter rises
            Shadow.transform.position = new Vector3(Root.position.x, Root.position.y, -0.02f + stage.transform.position.z);
            var lift = Mathf.Clamp01(1 - Height / 2.5f);
            Shadow.transform.localScale = new Vector3(lift, lift, 1) * (1 + Lying * 0.6f);
            var standing = stage.FacingCamera(Visual.position) * Quaternion.AngleAxis(-Lean * Dir, Vector3.forward);
            // lying: the card lies on the asphalt, face up, the head away from the rival
            var flat = Quaternion.LookRotation(Vector3.forward, new Vector3(-Dir, 0, 0));
            Visual.rotation = Quaternion.Slerp(standing, flat, Lying);
            // side frames face left: the bud is mirrored to face its rival
            Visual.localScale = new Vector3(-Dir * Scale * SquashX, Scale * SquashY, 1);
            Body.sprite = Sheet.Get(Facing.Side, Mathf.Clamp(Frame, 0, 2));
            Body.color = new Color(Tint.r, Tint.g, Tint.b, Alpha);
            Weapon.localEulerAngles = new Vector3(0, 0, WeaponAngle);
            WeaponSprite.color = new Color(1, 1, 1, Alpha);
        }
    }
}
