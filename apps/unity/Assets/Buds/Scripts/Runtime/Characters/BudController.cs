using Buds.World;
using UnityEngine;

namespace Buds.Characters
{
    /// <summary>Moves the player's bud and plays its 4-direction walk cycle (1, 0, 2, 0).</summary>
    [RequireComponent(typeof(Rigidbody2D), typeof(SpriteRenderer), typeof(BoxCollider2D))]
    public sealed class BudController : MonoBehaviour
    {
        static readonly int[] WalkCycle = { 1, 0, 2, 0 };
        const float FramesPerSecond = 8f;

        public float speed = 4.5f; // tiles per second

        public PlayerInput Input { get; } = new();
        public Facing Facing { get; private set; } = Facing.Down;

        BudSheet sheet;
        Rigidbody2D body;
        SpriteRenderer sprite;
        float animTime;

        public static BudController Spawn(BudSheet sheet, Vector3 position)
        {
            var go = new GameObject("Bud");
            go.transform.position = position;
            var sprite = go.AddComponent<SpriteRenderer>();
            sprite.sortingOrder = WorldView.SortOrderFor(position.y);

            var body = go.AddComponent<Rigidbody2D>();
            body.bodyType = RigidbodyType2D.Dynamic;
            body.gravityScale = 0;
            body.freezeRotation = true;
            body.interpolation = RigidbodyInterpolation2D.Interpolate;
            body.collisionDetectionMode = CollisionDetectionMode2D.Continuous;

            // a small box at the feet, so the bud can walk "behind" tall things
            var box = go.AddComponent<BoxCollider2D>();
            box.size = new Vector2(10f / 16, 5f / 16);
            box.offset = new Vector2(0, 2.5f / 16);

            var bud = go.AddComponent<BudController>();
            bud.sheet = sheet;
            bud.body = body;
            bud.sprite = sprite;
            sprite.sprite = sheet.Get(Facing.Down, 0);
            return bud;
        }

        void Update()
        {
            Input.Update();
            var move = Input.Move;

            if (move.sqrMagnitude > 0.0001f)
            {
                Facing = Mathf.Abs(move.x) > Mathf.Abs(move.y) ? Facing.Side : move.y > 0 ? Facing.Up : Facing.Down;
                sprite.flipX = Facing == Facing.Side && move.x > 0;
                animTime += Time.deltaTime;
                var frame = WalkCycle[(int)(animTime * FramesPerSecond) % WalkCycle.Length];
                sprite.sprite = sheet.Get(Facing, frame);
            }
            else
            {
                animTime = 0;
                sprite.sprite = sheet.Get(Facing, 0);
            }
        }

        void LateUpdate()
        {
            // y-sorted with the props: walking north of a tree puts the bud behind its crown
            sprite.sortingOrder = WorldView.SortOrderFor(transform.position.y);
        }

        void FixedUpdate()
        {
            body.linearVelocity = Input.Move * speed;
        }

        /// <summary>The tile the bud is standing on, in map coordinates (y down).</summary>
        public Vector2Int MapCell(int mapHeight)
        {
            var p = transform.position;
            return new Vector2Int(Mathf.FloorToInt(p.x), mapHeight - 1 - Mathf.FloorToInt(p.y + 0.15f));
        }
    }
}
