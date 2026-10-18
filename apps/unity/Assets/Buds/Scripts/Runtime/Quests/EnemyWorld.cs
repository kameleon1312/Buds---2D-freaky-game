using System.Collections.Generic;
using Buds.Characters;
using Buds.World;
using UnityEngine;

namespace Buds.Quests
{
    /// <summary>One opponent standing in the world: a bud-generator sprite, a red fist marker, a collider.</summary>
    public sealed class EnemyView : MonoBehaviour
    {
        public EnemyData Data { get; private set; }
        public BudSheet Sheet { get; private set; }
        /// <summary>Which of the opponent's spots this is (the turf a duel here counts for).</summary>
        public int Spot { get; private set; }
        SpriteRenderer body;
        SpriteRenderer marker;
        BoxCollider2D box;
        float phase;
        float hiddenUntil;

        public bool Available => Time.time >= hiddenUntil;

        public static EnemyView Spawn(EnemyData data, BudSheet sheet, Vector3 feet, Transform parent, Sprite markerSprite, int spot = 0)
        {
            var go = new GameObject("Enemy " + data.id);
            go.transform.SetParent(parent, false);
            go.transform.position = feet;
            var view = go.AddComponent<EnemyView>();
            view.Data = data;
            view.Sheet = sheet;
            view.Spot = spot;
            // 2.5D: a shadow on the ground, the body and its marker stand up towards the camera
            WorldView.Shadow(go.transform, 0.9f);
            var visual = WorldView.StandCharacter(go.transform);
            var bodyGo = new GameObject("Body");
            bodyGo.transform.SetParent(visual, false);
            view.body = bodyGo.AddComponent<SpriteRenderer>();
            view.body.sprite = sheet.Get(Facing.Down, 0);
            view.body.sortingOrder = WorldView.SortOrderFor(feet.y);
            CastShadow.Attach(go.transform, view.body, visual);
            view.box = go.AddComponent<BoxCollider2D>();
            view.box.size = new Vector2(10f / 16, 5f / 16);
            view.box.offset = new Vector2(0, 2.5f / 16);
            var m = new GameObject("Marker");
            m.transform.SetParent(visual, false);
            view.marker = m.AddComponent<SpriteRenderer>();
            view.marker.sprite = markerSprite;
            view.marker.sortingOrder = 20000;
            view.phase = (feet.x * 0.31f + feet.y * 0.17f) % 1f;
            if (data.boss) go.transform.localScale = Vector3.one * 1.15f;
            return view;
        }

        /// <summary>Beaten: steps out of the way for a while (the server refuses a rematch until then too).</summary>
        public void Rest(float seconds)
        {
            hiddenUntil = Time.time + seconds;
        }

        public void Face(Vector3 target)
        {
            var d = target - transform.position;
            var facing = Mathf.Abs(d.x) > Mathf.Abs(d.y) ? Facing.Side : d.y > 0 ? Facing.Up : Facing.Down;
            body.sprite = Sheet.Get(facing, 0);
            body.flipX = facing == Facing.Side && d.x > 0;
        }

        void Update()
        {
            var shown = Available;
            body.enabled = shown;
            marker.enabled = shown;
            box.enabled = shown;
            if (!shown) return;
            // a restless sway: these ones are looking for trouble
            var t = Time.time + phase * 3;
            marker.transform.localPosition = new Vector3(0, 1.95f + Mathf.Sin(t * 3.4f) * 0.08f, 0);
            body.transform.localScale = new Vector3(1 + Mathf.Sin(t * 2.6f) * 0.015f, 1 + Mathf.Sin(t * 2.6f + 1) * 0.015f, 1);
        }
    }

    /// <summary>The opponents of the current district, one view per spot.</summary>
    public sealed class EnemyWorld : MonoBehaviour
    {
        readonly List<EnemyView> enemies = new();

        public IReadOnlyList<EnemyView> Enemies => enemies;

        static PropArt markerArt;

        public static EnemyWorld Create(WorldView world, QuestContent content)
        {
            var ew = new GameObject("Enemies").AddComponent<EnemyWorld>();
            ew.transform.SetParent(world.transform, false);
            markerArt ??= PropArt.Load(new HashSet<string> { "marker-fight" }); // loaded once for every map
            var marker = markerArt.Get("marker-fight");
            foreach (var e in content.enemies)
            {
                if (e.district != world.Map.Id) continue;
                var tex = Resources.Load<Texture2D>("Enemies/" + e.id);
                if (!tex)
                {
                    Debug.LogWarning($"Missing Resources/Enemies/{e.id}.png — run tools/world/export-quests.ts");
                    continue;
                }
                var sheet = BudSheet.Shared(tex);
                for (var i = 0; i < e.spots.Length; i++)
                {
                    var feet = world.CellCenter(e.spots[i].x, e.spots[i].y) + new Vector3(0, -0.3f, 0);
                    ew.enemies.Add(EnemyView.Spawn(e, sheet, feet, ew.transform, marker, i));
                }
            }
            return ew;
        }

        /// <summary>The closest opponent ready for a duel within <paramref name="range"/> of the bud's feet.</summary>
        public EnemyView Nearest(Vector2 feet, float range)
        {
            EnemyView best = null;
            var bestD = range;
            foreach (var e in enemies)
            {
                if (!e.Available) continue;
                var d = Vector2.Distance(feet, e.transform.position);
                if (d > bestD) continue;
                best = e;
                bestD = d;
            }
            return best;
        }

        /// <summary>Rests every view of an opponent type after a win.</summary>
        public void Rest(string enemyId, float seconds)
        {
            foreach (var e in enemies)
                if (e.Data.id == enemyId) e.Rest(seconds);
        }
    }
}
