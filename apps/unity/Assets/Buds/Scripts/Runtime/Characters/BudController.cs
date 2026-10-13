using System;
using Buds.World;
using UnityEngine;

namespace Buds.Characters
{
    /// <summary>
    /// Moves the player's bud (BudMotor: acceleration, running, corner assist) and plays its 4-direction walk cycle
    /// (1, 0, 2, 0) at a pace that follows the real speed, with a little bounce in the step and dust when running.
    /// </summary>
    [RequireComponent(typeof(Rigidbody2D), typeof(BoxCollider2D))]
    public sealed class BudController : MonoBehaviour
    {
        static readonly int[] WalkCycle = { 1, 0, 2, 0 };
        const float FramesPerTile = 1.8f; // walk frames per tile travelled: feet match the ground
        static readonly Vector2 FeetSize = new(10f / 16, 5f / 16);
        static readonly Vector2 FeetOffset = new(0, 2.5f / 16);

        public PlayerInput Input { get; } = new();
        public BudMotor Motor { get; } = new();
        public Facing Facing => Motor.Facing;

        /// <summary>Solid map cells in world coordinates (y up); null = no corner assist.</summary>
        public Func<int, int, bool> Blocked { get; set; }

        BudSheet sheet;
        Rigidbody2D body;
        SpriteRenderer sprite;
        float animTime;
        bool wasMoving;
        float dustTimer;
        Dust dust;

        public static BudController Spawn(BudSheet sheet, Vector3 position)
        {
            var go = new GameObject("Bud");
            go.transform.position = position;

            var body = go.AddComponent<Rigidbody2D>();
            body.bodyType = RigidbodyType2D.Dynamic;
            body.gravityScale = 0;
            body.freezeRotation = true;
            body.interpolation = RigidbodyInterpolation2D.Interpolate;
            body.collisionDetectionMode = CollisionDetectionMode2D.Continuous;

            // a small box at the feet, so the bud can walk "behind" tall things
            var box = go.AddComponent<BoxCollider2D>();
            box.size = FeetSize;
            box.offset = FeetOffset;
            box.edgeRadius = 0.02f; // slightly rounded: glides along walls instead of catching on tile seams

            // the sprite is a child so it can bounce without moving the body
            var art = new GameObject("Sprite");
            art.transform.SetParent(go.transform, false);
            var sprite = art.AddComponent<SpriteRenderer>();
            sprite.sortingOrder = WorldView.SortOrderFor(position.y);
            sprite.sprite = sheet.Get(Facing.Down, 0);

            var bud = go.AddComponent<BudController>();
            bud.sheet = sheet;
            bud.body = body;
            bud.sprite = sprite;
            bud.dust = new Dust(go.transform.parent);
            return bud;
        }

        void Update()
        {
            Input.Update();
            var move = Input.Move;
            var speed = body.linearVelocity.magnitude;
            var moving = move.sqrMagnitude > 0.0001f;

            if (moving) Motor.Face(move, !wasMoving);
            wasMoving = moving;
            sprite.flipX = Motor.Facing == Facing.Side && Motor.FacingRight;

            if (speed > 0.25f)
            {
                animTime += Time.deltaTime * speed * FramesPerTile;
                var step = (int)animTime % WalkCycle.Length;
                var frame = WalkCycle[step];
                sprite.sprite = sheet.Get(Motor.Facing, frame);
                // a soft bounce on the stepping frames, a bit more when running
                var lift = frame == 0 ? 0 : speed > BudMotor.WalkSpeed + 0.5f ? 0.045f : 0.025f;
                sprite.transform.localPosition = new Vector3(0, lift, 0);

                dustTimer -= Time.deltaTime;
                if (Input.Run && speed > BudMotor.WalkSpeed && dustTimer <= 0)
                {
                    dustTimer = 0.11f;
                    dust.Puff(transform.position + new Vector3(UnityEngine.Random.Range(-0.12f, 0.12f), 0.04f, 0));
                }
            }
            else
            {
                animTime = 0;
                sprite.sprite = sheet.Get(Motor.Facing, 0);
                sprite.transform.localPosition = Vector3.zero;
            }
            dust.Tick(Time.deltaTime);
        }

        void LateUpdate()
        {
            // y-sorted with the props: walking north of a tree puts the bud behind its crown
            sprite.sortingOrder = WorldView.SortOrderFor(transform.position.y);
        }

        void FixedUpdate()
        {
            var move = Input.Move;
            if (Blocked != null)
                move = BudMotor.AroundCorners(move, (Vector2)transform.position + FeetOffset, FeetSize / 2, Blocked);
            body.linearVelocity = Motor.Step(move, Input.Run, Time.fixedDeltaTime, body.linearVelocity);
        }

        void OnDestroy() => dust?.Clear();

        public void Teleport(Vector3 position)
        {
            transform.position = position;
            body.position = position;
            body.linearVelocity = Vector2.zero;
            Motor.Stop();
        }

        /// <summary>Faces a direction without moving (arriving through a door, talking).</summary>
        public void Look(Vector2 dir)
        {
            Motor.Face(dir, true);
            sprite.flipX = Motor.Facing == Facing.Side && Motor.FacingRight;
            sprite.sprite = sheet.Get(Motor.Facing, 0);
        }

        /// <summary>The tile the bud is standing on, in map coordinates (y down).</summary>
        public Vector2Int MapCell(int mapHeight)
        {
            var p = transform.position;
            return new Vector2Int(Mathf.FloorToInt(p.x), mapHeight - 1 - Mathf.FloorToInt(p.y + 0.15f));
        }

        /// <summary>Little dust clouds kicked up when running: a small pool of fading circles.</summary>
        sealed class Dust
        {
            const int Size = 8;
            const float Life = 0.45f;
            static Sprite circle;
            readonly SpriteRenderer[] puffs = new SpriteRenderer[Size];
            readonly float[] age = new float[Size];
            int next;

            public Dust(Transform parent)
            {
                circle ??= MakeCircle();
                for (var i = 0; i < Size; i++)
                {
                    var go = new GameObject("Dust");
                    go.transform.SetParent(parent, false);
                    puffs[i] = go.AddComponent<SpriteRenderer>();
                    puffs[i].sprite = circle;
                    puffs[i].sortingOrder = -95; // over the ground, under every character
                    go.SetActive(false);
                    age[i] = Life;
                }
            }

            public void Puff(Vector3 at)
            {
                var p = puffs[next];
                if (!p) return;
                p.transform.position = at;
                p.gameObject.SetActive(true);
                age[next] = 0;
                next = (next + 1) % Size;
            }

            public void Tick(float dt)
            {
                for (var i = 0; i < Size; i++)
                {
                    if (age[i] >= Life || !puffs[i]) continue;
                    age[i] += dt;
                    var t = Mathf.Clamp01(age[i] / Life);
                    puffs[i].transform.localScale = Vector3.one * (0.18f + t * 0.22f);
                    puffs[i].transform.position += new Vector3(0, dt * 0.25f, 0);
                    puffs[i].color = new Color(0.86f, 0.8f, 0.7f, 0.7f * (1 - t));
                    if (age[i] >= Life) puffs[i].gameObject.SetActive(false);
                }
            }

            public void Clear()
            {
                foreach (var p in puffs)
                    if (p) Destroy(p.gameObject);
            }

            static Sprite MakeCircle()
            {
                const int n = 32;
                var tex = new Texture2D(n, n, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear };
                for (var y = 0; y < n; y++)
                for (var x = 0; x < n; x++)
                {
                    var d = Vector2.Distance(new Vector2(x + 0.5f, y + 0.5f), new Vector2(n / 2f, n / 2f)) / (n / 2f);
                    tex.SetPixel(x, y, new Color(1, 1, 1, Mathf.Clamp01((1 - d) * 3)));
                }
                tex.Apply();
                return Sprite.Create(tex, new Rect(0, 0, n, n), new Vector2(0.5f, 0.5f), n);
            }
        }
    }
}
