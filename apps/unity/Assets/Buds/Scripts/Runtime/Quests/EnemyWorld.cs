using System.Collections.Generic;
using Buds.Api;
using Buds.Characters;
using Buds.World;
using UnityEngine;

namespace Buds.Quests
{
    /// <summary>
    /// One opponent in the world: a bud-generator sprite and a shadow. With the live server it is the server's unit
    /// (walka.md): it walks where the fight moves it (smoothed like another bud), turns, falls on a knockout, stays
    /// hidden while it lurks in its nook and hops out when it springs. Without the server it just stands at its spot.
    /// A shadow (a rival's or a defender's saved fighter, called to the street) is an EnemyView too.
    /// </summary>
    public sealed class EnemyView : MonoBehaviour
    {
        public EnemyData Data { get; private set; }
        public BudSheet Sheet { get; private set; }
        /// <summary>Which of the opponent's spots this is (the turf a fight here counts for).</summary>
        public int Spot { get; private set; }
        /// <summary>The server's id of this unit (brawl.ts: "m-&lt;enemy&gt;-&lt;spot&gt;", a shadow's "s-…").</summary>
        public string UnitId { get; private set; }
        /// <summary>A shadow: fights only this bud; its sheet was downloaded for it (freed with it).</summary>
        public bool IsShadow { get; private set; }
        public string Only { get; private set; }

        SpriteRenderer body;
        BoxCollider2D box;
        Transform visual;
        float phase;
        Vector3 home;
        readonly LiveTrack track = new();
        readonly WalkCycle walk = new(3.4f, 5f, 0.95f, 1.35f, 0.03f);
        Vector2 lastShown;
        int facing;
        bool moving;
        bool ownsSheet;
        float springAt = -99;
        float downAt = -99, upAt = -99;

        /// <summary>Health as the server last said (0 max = never told).</summary>
        public int Hp { get; private set; }
        public int MaxHp { get; private set; }
        public bool Down { get; private set; }
        /// <summary>Hidden in its nook: nothing shows, nothing can be aimed at.</summary>
        public bool Lurking { get; private set; }
        /// <summary>Ran by the server (otherwise a picture standing at its spot).</summary>
        public bool Live { get; private set; }

        public SpriteRenderer Body => body;
        public Transform Visual => visual;
        public bool Available => !Down && !Lurking;
        public Vector2 Feet => transform.position;
        public Vector3 Head => RemoteBud.HeadOf(body, transform);

        public static EnemyView Spawn(EnemyData data, BudSheet sheet, Vector3 feet, Transform parent, int spot = 0)
        {
            var go = new GameObject("Enemy " + data.id);
            go.transform.SetParent(parent, false);
            go.transform.position = feet;
            var view = go.AddComponent<EnemyView>();
            view.Data = data;
            view.Sheet = sheet;
            view.Spot = spot;
            view.UnitId = $"m-{data.id}-{spot}";
            // 2.5D: a shadow on the ground, the body stands up towards the camera
            WorldView.Shadow(go.transform, WorldView.CharacterShadow);
            view.visual = WorldView.StandCharacter(go.transform);
            var bodyGo = new GameObject("Body");
            bodyGo.transform.SetParent(view.visual, false);
            view.body = bodyGo.AddComponent<SpriteRenderer>();
            view.body.sprite = sheet.Get(Facing.Down, 0);
            view.body.sortingOrder = WorldView.SortOrderFor(feet.y);
            CastShadow.Attach(go.transform, view.body, view.visual);
            view.box = go.AddComponent<BoxCollider2D>();
            view.box.size = new Vector2(10f / 16, 5f / 16);
            view.box.offset = new Vector2(0, 2.5f / 16);
            view.phase = (feet.x * 0.31f + feet.y * 0.17f) % 1f;
            view.home = feet;
            view.lastShown = feet;
            view.Lurking = data.ambush;
            if (data.boss) go.transform.localScale = Vector3.one * 1.12f;
            return view;
        }

        /// <summary>A shadow called to the street: the rival's own sheet, its name and level.</summary>
        public static EnemyView SpawnShadow(LiveUnitDto u, BudSheet sheet, bool ownsSheet, Transform parent)
        {
            var data = new EnemyData { id = u.slug ?? u.id, name = u.name, level = u.level, lines = new string[0], spots = new CellData[0] };
            var view = Spawn(data, sheet, new Vector3(u.x, u.y, 0), parent);
            view.UnitId = u.id;
            view.IsShadow = true;
            view.Only = u.only;
            view.ownsSheet = ownsSheet;
            view.Lurking = false;
            // nobody walks through a shadow's legs either, but it never blocks a street
            view.box.enabled = false;
            view.Apply(u, true);
            view.springAt = Time.time;
            return view;
        }

        /// <summary>The rival's own sheet arrived (shadows start with a placeholder).</summary>
        public void SetSheet(BudSheet value, bool owned)
        {
            if (ownsSheet && Sheet != value) Sheet?.Dispose();
            Sheet = value;
            ownsSheet = owned;
        }

        /// <summary>The server's word on this unit: where, facing, walking, health, down, hidden.</summary>
        public void Apply(LiveUnitDto u, bool entity)
        {
            Live = true;
            var at = new Vector2(u.x, u.y);
            track.Add(Time.time, at);
            facing = u.f;
            moving = u.m;
            if (u.mh > 0)
            {
                Hp = u.h;
                MaxHp = u.mh;
            }
            SetDown(entity ? u.down : u.d);
            if (entity)
            {
                var wasLurking = Lurking;
                Lurking = u.lurk;
                if (wasLurking && !Lurking) springAt = Time.time;
            }
        }

        /// <summary>Hidden or out (a lurker going back into its nook).</summary>
        public void SetLurking(bool lurking)
        {
            if (Lurking && !lurking) springAt = Time.time;
            Lurking = lurking;
        }

        /// <summary>Health from a blow's event (the next tick says the same; this one is quicker).</summary>
        public void SetHealth(int hp, int max)
        {
            if (max <= 0) return;
            Hp = hp;
            MaxHp = max;
        }

        /// <summary>Beaten (lies, then fades away until it stands up again at its spot) or back.</summary>
        public void SetDown(bool down)
        {
            if (down == Down) return;
            Down = down;
            if (down) downAt = Time.time;
            else
            {
                upAt = Time.time;
                // stood up at home: no glide from where it fell
                track.Add(Time.time, transform.position);
            }
        }

        /// <summary>How much of the body shows: gone a while after a knockout, back over a moment.</summary>
        float Presence()
        {
            if (Down) return 1 - Mathf.Clamp01((Time.time - downAt - 1.6f) / 0.5f);
            return Mathf.Clamp01((Time.time - upAt) / 0.4f);
        }

        public void Face(Vector3 target)
        {
            var d = target - transform.position;
            facing = Mathf.Abs(d.x) > Mathf.Abs(d.y) ? (d.x > 0 ? 3 : 1) : d.y > 0 ? 2 : 0;
        }

        void Update()
        {
            // a lurker shows nothing at all (no body, no shadow, no collider) until it jumps out; a beaten one fades
            var presence = Presence();
            var shown = !Lurking && presence > 0.01f;
            body.enabled = shown;
            if (box && !IsShadow) box.enabled = shown && !Down;
            foreach (Transform child in transform)
                if (child.name is "Shadow" or "Cast shadow")
                    child.gameObject.SetActive(shown);
            if (!shown) return;

            var at = Live && !track.Empty ? track.At(Time.time) : (Vector2)home;
            var step = (at - lastShown).magnitude;
            var speed = Time.deltaTime > 0 ? step / Time.deltaTime : 0;
            lastShown = at;
            transform.position = new Vector3(at.x, at.y, 0);

            var (f, right) = LiveProtocol.FacingOf(facing);
            walk.Tick(moving && !Down ? Mathf.Max(speed, 0.5f) : speed, Time.deltaTime);
            body.sprite = Sheet.Get(f, Down ? 0 : walk.Frame);
            // the fight's pose owns the body's colour once it fought; before that the view does
            var pose = GetComponent<CombatPose>();
            if (pose) pose.Presence = presence;
            else if (presence < 1 || body.color.a < 1) body.color = new Color(1, 1, 1, presence);
            body.flipX = f == Facing.Side && right;
            body.sortingOrder = WorldView.SortOrderFor(at.y);
            // the hop out of the bushes: up and over in a quarter of a second
            var k = Mathf.Clamp01((Time.time - springAt) / 0.3f);
            var hop = k < 1 ? Mathf.Sin(k * Mathf.PI) * 0.55f : 0;
            // a restless sway while standing: these ones are looking for trouble
            var t = Time.time + phase * 3;
            var sway = walk.Walking || Down ? 1 : 1 + Mathf.Sin(t * 2.6f) * 0.015f;
            body.transform.localPosition = new Vector3(0, walk.Lift + hop, 0);
            body.transform.localScale = new Vector3(2 - sway, sway, 1);
        }

        void OnDestroy()
        {
            if (ownsSheet) Sheet?.Dispose();
        }
    }

    /// <summary>The opponents of the current map, one view per spot, and the shadows called onto it.</summary>
    public sealed class EnemyWorld : MonoBehaviour
    {
        readonly List<EnemyView> enemies = new();
        readonly Dictionary<string, EnemyView> byUnit = new();

        public IReadOnlyList<EnemyView> Enemies => enemies;

        public static EnemyWorld Create(WorldView world, QuestContent content)
        {
            var ew = new GameObject("Enemies").AddComponent<EnemyWorld>();
            ew.transform.SetParent(world.transform, false);
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
                    var view = EnemyView.Spawn(e, sheet, feet, ew.transform, i);
                    ew.enemies.Add(view);
                    ew.byUnit[view.UnitId] = view;
                }
            }
            return ew;
        }

        /// <summary>The view of a server unit, or null.</summary>
        public EnemyView Unit(string id) => id != null && byUnit.TryGetValue(id, out var v) && v ? v : null;

        public void AddShadow(EnemyView view)
        {
            RemoveShadow(view.UnitId);
            enemies.Add(view);
            byUnit[view.UnitId] = view;
        }

        public void RemoveShadow(string id)
        {
            if (!byUnit.TryGetValue(id, out var v) || !v || !v.IsShadow) return;
            enemies.Remove(v);
            byUnit.Remove(id);
            Destroy(v.gameObject);
        }

        /// <summary>The closest opponent standing within <paramref name="range"/> of the bud's feet (to say who it is).</summary>
        public EnemyView Nearest(Vector2 feet, float range)
        {
            EnemyView best = null;
            var bestD = range;
            foreach (var e in enemies)
            {
                if (!e || !e.Available) continue;
                var d = Vector2.Distance(feet, e.transform.position);
                if (d > bestD) continue;
                best = e;
                bestD = d;
            }
            return best;
        }
    }
}
