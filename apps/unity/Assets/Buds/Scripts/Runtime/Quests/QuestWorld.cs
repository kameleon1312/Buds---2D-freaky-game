using System;
using System.Collections.Generic;
using Buds.Characters;
using Buds.World;
using UnityEngine;

namespace Buds.Quests
{
    /// <summary>
    /// One NPC in the world: sprite from the bud generator, a collider, and a quest marker. Quest NPCs stand where
    /// the map says and breathe; side characters (data.wander > 0) stroll about their patch with a proper walk,
    /// stop when the player comes close and turn to them.
    /// </summary>
    public sealed class NpcView : MonoBehaviour
    {
        public NpcData Data { get; private set; }
        BudSheet sheet;
        SpriteRenderer body;
        SpriteRenderer marker;
        float phase;
        NpcWander wander;
        WalkCycle walk;
        Rigidbody2D rb;
        Vector2 velocity;
        Func<Vector2?> playerFeet;
        Func<bool> busy;
        bool talking;

        public static NpcView Spawn(NpcData data, BudSheet sheet, Vector3 feet, Transform parent)
        {
            var go = new GameObject("NPC " + data.id);
            go.transform.SetParent(parent, false);
            go.transform.position = feet;
            var view = go.AddComponent<NpcView>();
            view.Data = data;
            view.sheet = sheet;
            // 2.5D: a shadow on the ground, the body and its marker stand up towards the camera
            WorldView.Shadow(go.transform, WorldView.CharacterShadow);
            var visual = WorldView.StandCharacter(go.transform);
            var bodyGo = new GameObject("Body");
            bodyGo.transform.SetParent(visual, false);
            view.body = bodyGo.AddComponent<SpriteRenderer>();
            view.body.sprite = sheet.Get(Facing.Down, 0);
            view.body.sortingOrder = WorldView.SortOrderFor(feet.y);
            CastShadow.Attach(go.transform, view.body, visual);
            var box = go.AddComponent<BoxCollider2D>(); // same footprint as the player's feet
            box.size = new Vector2(10f / 16, 5f / 16);
            box.offset = new Vector2(0, 2.5f / 16);

            var m = new GameObject("Marker");
            m.transform.SetParent(visual, false);
            view.marker = m.AddComponent<SpriteRenderer>();
            view.marker.sortingOrder = 20000; // always above the world
            view.phase = (data.x * 0.37f + data.y * 0.11f) % 1f;
            return view;
        }

        /// <summary>Lets a side character stroll (called once after Spawn, for data.wander > 0).</summary>
        public void Wander(Func<Vector2, bool> walkable, Func<Vector2?> player, Func<bool> isBusy)
        {
            wander = new NpcWander(transform.position, Data.wander, walkable, StableSeed(Data.id));
            walk = new WalkCycle(NpcWander.Speed, NpcWander.Speed * 1.6f, 0.7f, 0.9f, 0.03f);
            playerFeet = player;
            busy = isBusy;
            rb = gameObject.AddComponent<Rigidbody2D>();
            rb.bodyType = RigidbodyType2D.Kinematic; // moves itself, blocks the player like a person would
            rb.interpolation = RigidbodyInterpolation2D.Interpolate;
        }

        public void SetMarker(Sprite sprite)
        {
            marker.sprite = sprite;
            marker.enabled = sprite;
        }

        /// <summary>Turns towards a point (the player) while talking.</summary>
        public void Face(Vector3 target)
        {
            talking = true;
            Show(target - transform.position, 0);
        }

        /// <summary>The same number for the same id on every run and device (string.GetHashCode may differ).</summary>
        static int StableSeed(string id)
        {
            unchecked
            {
                var h = (int)2166136261;
                foreach (var c in id) h = (h ^ c) * 16777619;
                return h;
            }
        }

        void Show(Vector2 d, int frame)
        {
            var facing = Mathf.Abs(d.x) > Mathf.Abs(d.y) ? Facing.Side : d.y > 0 ? Facing.Up : Facing.Down;
            body.sprite = sheet.Get(facing, frame);
            body.flipX = facing == Facing.Side && d.x > 0;
        }

        void Update()
        {
            // the marker floats above the head; standing NPCs breathe a little so they don't look like statues
            var t = Time.time + phase * 3;
            marker.transform.localPosition = new Vector3(0, WorldView.AboveHead + Mathf.Sin(t * 3f) * 0.08f, 0);
            if (wander == null)
            {
                body.transform.localScale = new Vector3(1, 1 + Mathf.Sin(t * 2f) * 0.012f, 1);
                return;
            }

            var isBusy = busy?.Invoke() ?? false;
            if (!isBusy) talking = false;
            velocity = wander.Tick(Time.deltaTime, transform.position, playerFeet?.Invoke(), isBusy);
            walk.Tick(velocity.magnitude, Time.deltaTime);
            // while talking the NPC keeps facing the player (Face), otherwise where it walks or looks
            if (!talking) Show(walk.Walking ? velocity : wander.Look, walk.Frame);
            body.transform.localPosition = new Vector3(0, walk.Lift, 0);
            var breathe = walk.Walking ? 0 : Mathf.Sin(t * 2f) * 0.012f;
            body.transform.localScale = new Vector3(1 + (1 - walk.Squash) * 0.6f, walk.Squash + breathe, 1);
        }

        void FixedUpdate()
        {
            if (rb && velocity != Vector2.zero) rb.MovePosition(rb.position + velocity * Time.fixedDeltaTime);
        }

        void LateUpdate()
        {
            if (wander != null) body.sortingOrder = WorldView.SortOrderFor(transform.position.y);
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
        /// <summary>The player's feet (null when there is no player yet): strolling NPCs stop for them.</summary>
        public Func<Vector2?> PlayerFeet { get; set; }
        /// <summary>A dialog or a screen is open: everyone stands still.</summary>
        public Func<bool> Busy { get; set; }

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
                var view = NpcView.Spawn(n, BudSheet.Shared(tex), feet, qw.transform);
                if (n.wander > 0) view.Wander(qw.Walkable, () => qw.PlayerFeet?.Invoke(), () => qw.Busy?.Invoke() ?? false);
                qw.npcs.Add(view);
            }
            log.Changed += qw.Refresh;
            qw.Refresh();
            return qw;
        }

        void OnDestroy()
        {
            if (log != null) log.Changed -= Refresh;
            art?.Dispose();
        }

        /// <summary>Can feet stand here (world units)? The whole feet box must be on walkable cells.</summary>
        bool Walkable(Vector2 feet)
        {
            var map = world.Map;
            bool Free(float x, float y) => map.IsWalkable(Mathf.FloorToInt(x), map.Height - 1 - Mathf.FloorToInt(y));
            return Free(feet.x - 0.32f, feet.y) && Free(feet.x + 0.32f, feet.y) && Free(feet.x - 0.32f, feet.y + 0.31f) &&
                   Free(feet.x + 0.32f, feet.y + 0.31f);
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
            if (!flat) go.transform.localRotation = WorldView.Upright;
            return go;
        }

        /// <summary>Picks up items near the player's feet; returns how many were collected.</summary>
        const float HiddenReveal = 3.2f;

        public int CollectNear(Vector2 feet)
        {
            var count = 0;
            foreach (var (go, quest, spot) in pickups.ToArray())
            {
                if (!go) continue;
                // what lies hidden shows itself only from close by
                if (log.CurrentStep(quest) is { hidden: true }) go.SetActive(Vector2.Distance(feet, go.transform.position) < HiddenReveal);
                if (Vector2.Distance(feet, go.transform.position) > PickupRange) continue;
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
