using System.Collections.Generic;
using Buds.World;
using UnityEngine;

namespace Buds.Quests
{
    /// <summary>
    /// The caches of the current map: invisible until the bud comes close, then they fade in with a twinkling glint;
    /// searched ones stay where they were, emptied. Logic lives in CacheLog.
    /// </summary>
    public sealed class CacheWorld : MonoBehaviour
    {
        /// <summary>Tiles from the bud's feet to a cache it can search.</summary>
        public const float SearchRange = 1.35f;
        const float FadeSeconds = 0.5f;

        sealed class View
        {
            public CacheData Data;
            public SpriteRenderer Body;
            public SpriteRenderer Glint;
            public BoxCollider2D Box;
            public float Shown; // 0..1 fade-in
        }

        sealed class Spark
        {
            public SpriteRenderer Sprite;
            public Vector3 Velocity;
            public float Age;
        }

        WorldView world;
        CacheLog log;
        PropArt art;
        readonly List<View> views = new();
        readonly List<Spark> sparks = new();

        public static CacheWorld Create(WorldView world, CacheLog log)
        {
            var cw = new GameObject("Caches").AddComponent<CacheWorld>();
            cw.transform.SetParent(world.transform, false);
            cw.world = world;
            cw.log = log;
            var names = new HashSet<string> { "blysk" };
            foreach (var c in log.On(world.Map.Id))
            {
                names.Add("skrytka-" + c.look);
                names.Add("skrytka-" + c.look + "-pusta");
            }
            cw.art = PropArt.Load(names);

            foreach (var c in log.On(world.Map.Id))
            {
                var feet = world.CellCenter(c.x, c.y) + new Vector3(0, -0.35f, 0);
                var go = new GameObject("Cache " + c.id);
                go.transform.SetParent(cw.transform, false);
                go.transform.position = feet;
                var visual = WorldView.Stand(go.transform);
                var body = visual.gameObject.AddComponent<SpriteRenderer>();
                body.sortingOrder = WorldView.SortOrderFor(feet.y);
                var box = go.AddComponent<BoxCollider2D>(); // blocks like an NPC once it can be seen
                box.size = new Vector2(0.7f, 0.35f);
                box.offset = new Vector2(0, 0.17f);

                var glint = new GameObject("Glint").AddComponent<SpriteRenderer>();
                glint.transform.SetParent(visual, false);
                glint.transform.localPosition = new Vector3(0.22f, 0.85f, 0);
                glint.sprite = cw.art.Get("blysk");
                glint.sortingOrder = body.sortingOrder + 1;

                var view = new View { Data = c, Body = body, Glint = glint, Box = box, Shown = log.IsVisible(c) ? 1 : 0 };
                cw.views.Add(view);
            }
            log.Changed += cw.Refresh;
            cw.Refresh();
            return cw;
        }

        void OnDestroy()
        {
            if (log != null) log.Changed -= Refresh;
            art?.Dispose();
        }

        public void Refresh()
        {
            if (!this) return;
            foreach (var v in views)
            {
                var opened = log.Opened.Contains(v.Data.id);
                v.Body.sprite = art.Get("skrytka-" + v.Data.look + (opened ? "-pusta" : ""));
                v.Box.enabled = log.IsVisible(v.Data);
            }
        }

        public Vector3 PositionOf(string id)
        {
            foreach (var v in views)
                if (v.Data.id == id) return v.Body.transform.position;
            return Vector3.zero;
        }

        /// <summary>Gold glints bursting out of a cache that was just emptied.</summary>
        public void Burst(string id)
        {
            var at = PositionOf(id) + new Vector3(0, 0.5f, 0);
            for (var i = 0; i < 7; i++)
            {
                var r = new GameObject("Spark").AddComponent<SpriteRenderer>();
                r.transform.SetParent(transform, false);
                r.transform.position = at;
                r.sprite = art.Get("blysk");
                r.sortingOrder = 20000;
                var a = (i / 7f) * Mathf.PI * 2 + 0.3f;
                sparks.Add(new Spark { Sprite = r, Velocity = new Vector3(Mathf.Cos(a) * 1.6f, 2.2f + Mathf.Sin(a) * 1.2f, 0) });
            }
        }

        void Update()
        {
            var t = Time.time;
            foreach (var v in views)
            {
                var visible = log.IsVisible(v.Data);
                v.Shown = Mathf.MoveTowards(v.Shown, visible ? 1 : 0, Time.deltaTime / FadeSeconds);
                v.Body.color = new Color(1, 1, 1, v.Shown);
                v.Body.transform.localScale = Vector3.one * (0.85f + 0.15f * Mathf.SmoothStep(0, 1, v.Shown));
                // the glint twinkles over noticed caches that are still full
                var full = visible && !log.Opened.Contains(v.Data.id);
                v.Glint.enabled = full;
                if (!full) continue;
                var phase = t * 3.2f + v.Data.x * 0.7f;
                var pulse = 0.5f + 0.5f * Mathf.Sin(phase);
                v.Glint.transform.localScale = Vector3.one * (0.55f + 0.45f * pulse);
                v.Glint.transform.localRotation = Quaternion.Euler(0, 0, Mathf.Sin(phase * 0.5f) * 20);
                v.Glint.color = new Color(1, 1, 1, v.Shown * (0.45f + 0.55f * pulse));
            }

            for (var i = sparks.Count - 1; i >= 0; i--)
            {
                var s = sparks[i];
                s.Age += Time.deltaTime;
                s.Velocity += new Vector3(0, -6f, 0) * Time.deltaTime;
                s.Sprite.transform.position += s.Velocity * Time.deltaTime;
                s.Sprite.transform.localScale = Vector3.one * Mathf.Lerp(0.8f, 0.3f, s.Age / 0.8f);
                s.Sprite.color = new Color(1, 1, 1, 1 - s.Age / 0.8f);
                if (s.Age < 0.8f) continue;
                Destroy(s.Sprite.gameObject);
                sparks.RemoveAt(i);
            }
        }
    }
}
