using System.Collections.Generic;
using Buds.Characters;
using Buds.World;
using UnityEngine;

namespace Buds.Quests
{
    /// <summary>One NPC standing in the world: sprite from the bud generator, a collider, and a quest marker.</summary>
    public sealed class NpcView : MonoBehaviour
    {
        public NpcData Data { get; private set; }
        BudSheet sheet;
        SpriteRenderer body;
        SpriteRenderer marker;
        float phase;

        public static NpcView Spawn(NpcData data, BudSheet sheet, Vector3 feet, Transform parent)
        {
            var go = new GameObject("NPC " + data.id);
            go.transform.SetParent(parent, false);
            go.transform.position = feet;
            var view = go.AddComponent<NpcView>();
            view.Data = data;
            view.sheet = sheet;
            view.body = go.AddComponent<SpriteRenderer>();
            view.body.sprite = sheet.Get(Facing.Down, 0);
            view.body.sortingOrder = WorldView.SortOrderFor(feet.y);
            var box = go.AddComponent<BoxCollider2D>(); // same footprint as the player's feet
            box.size = new Vector2(10f / 16, 5f / 16);
            box.offset = new Vector2(0, 2.5f / 16);

            var m = new GameObject("Marker");
            m.transform.SetParent(go.transform, false);
            view.marker = m.AddComponent<SpriteRenderer>();
            view.marker.sortingOrder = 20000; // always above the world
            view.phase = (data.x * 0.37f + data.y * 0.11f) % 1f;
            return view;
        }

        public void SetMarker(Sprite sprite)
        {
            marker.sprite = sprite;
            marker.enabled = sprite;
        }

        /// <summary>Turns towards a point (the player) while talking.</summary>
        public void Face(Vector3 target)
        {
            var d = target - transform.position;
            var facing = Mathf.Abs(d.x) > Mathf.Abs(d.y) ? Facing.Side : d.y > 0 ? Facing.Up : Facing.Down;
            body.sprite = sheet.Get(facing, 0);
            body.flipX = facing == Facing.Side && d.x > 0;
        }

        void Update()
        {
            // the marker floats above the head; NPCs breathe a little so they don't look like statues
            var t = Time.time + phase * 3;
            marker.transform.localPosition = new Vector3(0, 1.95f + Mathf.Sin(t * 3f) * 0.08f, 0);
            body.transform.localScale = new Vector3(1, 1 + Mathf.Sin(t * 2f) * 0.012f, 1);
        }
    }

    /// <summary>
    /// The quest layer of the current district: NPC views and their markers, pickups for "collect" steps and a ring
    /// on "reach" targets. Rebuilt from the QuestLog whenever it changes.
    /// </summary>
    public sealed class QuestWorld : MonoBehaviour
    {
        public const float PickupRange = 0.7f;

        WorldView world;
        QuestLog log;
        PropArt art;
        readonly List<NpcView> npcs = new();
        readonly List<(GameObject go, string quest, int spot)> pickups = new();
        readonly List<GameObject> targets = new();

        public IReadOnlyList<NpcView> Npcs => npcs;

        public static QuestWorld Create(WorldView world, QuestLog log)
        {
            var qw = new GameObject("Quests").AddComponent<QuestWorld>();
            qw.transform.SetParent(world.transform, false);
            qw.world = world;
            qw.log = log;
            var names = new HashSet<string> { "marker-quest", "marker-turnin", "marker-progress", "target-ring" };
            foreach (var q in log.Content.quests)
            foreach (var s in q.steps)
                if (s.kind == "collect") names.Add("item-" + s.item);
            qw.art = PropArt.Load(names);

            foreach (var n in log.Content.NpcsIn(world.Map.Id))
            {
                var tex = Resources.Load<Texture2D>("Npcs/" + n.id);
                if (!tex)
                {
                    Debug.LogWarning($"Missing Resources/Npcs/{n.id}.png — run tools/world/export-quests.ts");
                    continue;
                }
                var feet = world.CellCenter(n.x, n.y) + new Vector3(0, -0.3f, 0);
                qw.npcs.Add(NpcView.Spawn(n, new BudSheet(tex), feet, qw.transform));
            }
            log.Changed += qw.Refresh;
            qw.Refresh();
            return qw;
        }

        void OnDestroy()
        {
            if (log != null) log.Changed -= Refresh;
        }

        public void Refresh()
        {
            if (!this) return;
            foreach (var npc in npcs)
            {
                var name = log.MarkerFor(npc.Data.id) switch
                {
                    NpcMarker.Offer => "marker-quest",
                    NpcMarker.TurnIn => "marker-turnin",
                    NpcMarker.Progress => "marker-progress",
                    _ => null,
                };
                npc.SetMarker(name != null ? art.Get(name) : null);
            }

            foreach (var p in pickups) Destroy(p.go);
            pickups.Clear();
            foreach (var (quest, step, spot) in log.Pickups(world.Map.Id))
            {
                var cell = step.spots[spot];
                var go = Sprite("item-" + step.item, world.CellCenter(cell.x, cell.y) + new Vector3(0, -0.35f, 0), false);
                pickups.Add((go, quest.id, spot));
            }

            foreach (var t in targets) Destroy(t);
            targets.Clear();
            foreach (var q in log.Active)
            {
                var step = log.CurrentStep(q.id);
                if (q.district != world.Map.Id || step is not { kind: "reach" }) continue;
                targets.Add(Sprite("target-ring", world.CellCenter(step.x, step.y) + new Vector3(0, -0.4f, 0), true));
            }
        }

        GameObject Sprite(string name, Vector3 position, bool flat)
        {
            var go = new GameObject(name);
            go.transform.SetParent(transform, false);
            go.transform.position = position;
            var r = go.AddComponent<SpriteRenderer>();
            r.sprite = art.Get(name);
            r.sortingOrder = flat ? -90 : WorldView.SortOrderFor(position.y);
            return go;
        }

        /// <summary>Picks up items near the player's feet; returns how many were collected.</summary>
        public int CollectNear(Vector2 feet)
        {
            var count = 0;
            foreach (var (go, quest, spot) in pickups.ToArray())
            {
                if (!go || Vector2.Distance(feet, go.transform.position) > PickupRange) continue;
                count++;
                log.Collect(quest, spot); // triggers Refresh, which rebuilds the list
            }
            return count;
        }

        public NpcView NearestNpc(Vector2 feet, float range)
        {
            NpcView best = null;
            var bestD = range;
            foreach (var n in npcs)
            {
                var d = Vector2.Distance(feet, n.transform.position);
                if (d > bestD) continue;
                best = n;
                bestD = d;
            }
            return best;
        }

        void Update()
        {
            // reach targets pulse so they're easy to spot
            var s = 1 + Mathf.Sin(Time.time * 4) * 0.08f;
            foreach (var t in targets)
                if (t) t.transform.localScale = new Vector3(s, s, 1);
            foreach (var (go, _, _) in pickups)
                if (go) go.transform.localScale = Vector3.one * (1 + Mathf.Sin(Time.time * 5 + go.transform.position.x) * 0.06f);
        }
    }
}
