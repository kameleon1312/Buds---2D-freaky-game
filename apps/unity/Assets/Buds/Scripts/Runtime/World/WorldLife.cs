using System.Collections.Generic;
using Buds.Characters;
using UnityEngine;

namespace Buds.World
{
    /// <summary>
    /// The small life of an outdoor map, only around the bud (where the camera looks), different in every district
    /// (<see cref="DistrictLook"/>): leaves falling from the trees and drifting with the same wind the plants sway in
    /// (<see cref="WorldView.Wind"/>), butterflies over the flowers, sparks and smoke over burning barrels, dust kicked up
    /// under the bud's feet, and the shadows of clouds sliding over the ground. All of
    /// it is a few dozen pooled sprites under the map (it moves with the map when the bud crosses into the next one);
    /// the pictures are tools/world/art/life.ts. Nothing here touches the game's rules.
    /// </summary>
    public sealed class WorldLife : MonoBehaviour
    {
        const int MaxLeaves = 18, MaxPuffs = 24, Clouds = 3;
        /// <summary>The part of the map around the bud where life is shown (tiles: sideways, behind, ahead).</summary>
        const float Wide = 15f, Behind = 6f, Ahead = 15f;

        enum Kind { Leaf, Butterfly, Spark, Smoke, Dust }

        sealed class Mote
        {
            public Kind Kind;
            public Transform Root;
            public Transform Visual;
            public SpriteRenderer Sprite;
            /// <summary>Where it is on the ground (map-local units) and how high above it.</summary>
            public Vector2 At;
            public float Height;
            public Vector2 Velocity;
            public float Rise;
            public float Age;
            public float Life;
            public float Seed;
            public Vector2 Home;
        }

        WorldView view;
        DistrictLook look;
        Transform bud;
        float budSearch;
        Vector2 lastFeet;
        float dustWalked;
        readonly List<Mote> motes = new();
        readonly List<(SpriteRenderer sr, Vector2 at, Vector2 size)> clouds = new();
        readonly List<Vector2> trees = new(), flowers = new(), fires = new();
        float nextLeaf, nextFire;
        static PropArt art;
        static Sprite cloudSprite;

        /// <summary>Every picture the life of the world uses (tools/world/art/life.ts).</summary>
        public static readonly string[] Names =
        {
            "zycie-lisc-a", "zycie-lisc-b", "zycie-motyl-a", "zycie-motyl-b", "zycie-motyl-c", "zycie-motyl-d", "zycie-iskra",
            "zycie-dym", "zycie-kurz",
        };

        public static void Attach(WorldView view)
        {
            if (view.Map.IsInterior) return;
            var life = view.gameObject.AddComponent<WorldLife>();
            life.view = view;
            life.look = DistrictLook.For(view.Map.Id);
            foreach (var (name, at) in view.LifeSpots)
            {
                if (name == "fire") life.fires.Add(at);
                else if (name == "flower") life.flowers.Add(at);
                else life.trees.Add(at);
            }
        }

        void Start()
        {
            art ??= PropArt.Load(Names);
            if (!cloudSprite)
            {
                var blob = GroundLook.SoftBlob();
                cloudSprite = Sprite.Create(blob, new Rect(0, 0, blob.width, blob.height), new Vector2(0.5f, 0.5f), blob.width);
            }
            for (var i = 0; i < Clouds; i++)
            {
                var sr = new GameObject("Cloud shadow").AddComponent<SpriteRenderer>();
                sr.transform.SetParent(transform, false);
                sr.sprite = cloudSprite;
                sr.color = new Color(0.05f, 0.08f, 0.16f, look.CloudShade);
                sr.sortingOrder = -95; // over the ground and the cast shadows, under all that stands
                var size = new Vector2(Random.Range(11f, 17f), Random.Range(7f, 10f));
                sr.transform.localScale = new Vector3(size.x, size.y, 1);
                clouds.Add((sr, new Vector2(float.NaN, float.NaN), size));
            }
        }

        /// <summary>The bud's feet in this map's local units (null: no bud, or it is somewhere else).</summary>
        Vector2? Feet()
        {
            if (!bud && Time.time > budSearch)
            {
                budSearch = Time.time + 1f;
                var c = FindFirstObjectByType<BudController>();
                if (c) bud = c.transform;
            }
            if (!bud) return null;
            var local = (Vector2)(bud.position - transform.position);
            var m = view.Map;
            if (local.x < -8 || local.y < -8 || local.x > m.Width + 8 || local.y > m.Height + 8) return null;
            return local;
        }

        bool Near(Vector2 at, Vector2 feet) =>
            Mathf.Abs(at.x - feet.x) < Wide && at.y - feet.y > -Behind && at.y - feet.y < Ahead;

        Mote Take(Kind kind, string sprite, int max)
        {
            var count = 0;
            Mote free = null;
            foreach (var m in motes)
            {
                if (m.Kind != kind) continue;
                if (m.Root.gameObject.activeSelf) count++;
                else free ??= m;
            }
            if (count >= max) return null;
            if (free == null)
            {
                var root = new GameObject(kind.ToString()).transform;
                root.SetParent(transform, false);
                var visual = WorldView.Stand(root);
                var sr = new GameObject("Sprite").AddComponent<SpriteRenderer>();
                sr.transform.SetParent(visual, false);
                free = new Mote { Kind = kind, Root = root, Visual = sr.transform, Sprite = sr };
                motes.Add(free);
            }
            free.Root.gameObject.SetActive(true);
            free.Sprite.sprite = art.Get(sprite);
            free.Sprite.color = Color.white;
            free.Sprite.flipX = false;
            free.Visual.localRotation = Quaternion.identity;
            free.Visual.localScale = Vector3.one;
            free.Age = 0;
            free.Height = 0;
            free.Rise = 0;
            free.Velocity = Vector2.zero;
            free.Seed = Random.value * 100f;
            return free;
        }

        void Update()
        {
            if (!view || art == null) return;
            var feet = Feet();
            var dt = Mathf.Min(Time.deltaTime, 0.05f);
            var t = Time.time;
            if (feet is { } f)
            {
                SpawnLeaves(f, t);
                KeepButterflies(f);
                SpawnFire(f, t);
                Dust(f, dt);
            }
            foreach (var m in motes)
                if (m.Root.gameObject.activeSelf)
                    Step(m, dt, t, feet);
            Clouds_(feet, dt, t);
        }

        // ---------- spawning ----------

        void SpawnLeaves(Vector2 feet, float t)
        {
            if (t < nextLeaf || trees.Count == 0) return;
            if (look.LeafRate <= 0) return;
            nextLeaf = t + Random.Range(0.18f, 0.45f) / look.LeafRate;
            for (var tries = 0; tries < 6; tries++)
            {
                var tree = trees[Random.Range(0, trees.Count)];
                if (!Near(tree, feet)) continue;
                var m = Take(Kind.Leaf, Random.value < 0.7f ? "zycie-lisc-a" : "zycie-lisc-b", MaxLeaves);
                if (m == null) return;
                m.At = tree + new Vector2(Random.Range(-0.7f, 0.7f), Random.Range(0f, 0.4f));
                m.Height = Random.Range(1.5f, 2.6f);
                m.Rise = -Random.Range(0.35f, 0.55f);
                m.Life = 3.2f;
                m.Visual.localScale = Vector3.one * 1.5f;
                return;
            }
        }

        void KeepButterflies(Vector2 feet)
        {
            if (flowers.Count == 0 || look.Butterflies <= 0) return;
            for (var tries = 0; tries < 3; tries++)
            {
                var home = flowers[Random.Range(0, flowers.Count)];
                if (!Near(home, feet)) continue;
                var pink = Random.value < 0.5f;
                var m = Take(Kind.Butterfly, pink ? "zycie-motyl-c" : "zycie-motyl-a", look.Butterflies);
                if (m == null) return;
                m.Home = home;
                m.At = home;
                m.Life = Random.Range(14f, 24f);
                m.Velocity = new Vector2(pink ? 1 : 0, 0); // remembers its colours (x = 1: pink)
                m.Visual.localScale = Vector3.one * 1.6f;
                return;
            }
        }

        void SpawnFire(Vector2 feet, float t)
        {
            if (t < nextFire || fires.Count == 0) return;
            nextFire = t + 0.12f;
            foreach (var fire in fires)
            {
                if (!Near(fire, feet)) continue;
                if (Random.value < 0.55f)
                {
                    var s = Take(Kind.Spark, "zycie-iskra", MaxPuffs);
                    if (s == null) return;
                    s.At = fire + new Vector2(Random.Range(-0.15f, 0.15f), 0);
                    s.Height = 1.0f;
                    s.Rise = Random.Range(0.8f, 1.5f);
                    s.Velocity = new Vector2(Random.Range(-0.25f, 0.25f), 0);
                    s.Life = Random.Range(0.6f, 1.1f);
                }
                else if (Random.value < 0.35f)
                {
                    var s = Take(Kind.Smoke, "zycie-dym", MaxPuffs);
                    if (s == null) return;
                    s.At = fire;
                    s.Height = 1.1f;
                    s.Rise = Random.Range(0.4f, 0.6f);
                    s.Life = 2.4f;
                }
            }
        }

        /// <summary>Puffs of dust behind the bud's feet on sand, dirt and paths (one every ~0.45 tile walked).</summary>
        void Dust(Vector2 feet, float dt)
        {
            var moved = Vector2.Distance(feet, lastFeet);
            lastFeet = feet;
            if (moved > 1f || moved < 0.001f) return; // a jump (a seam crossing, a teleport) or standing still
            var speed = moved / Mathf.Max(dt, 0.001f);
            if (speed < 2.5f) return;
            dustWalked += moved;
            if (dustWalked < 0.45f) return;
            dustWalked = 0;
            var map = view.Map;
            var x = Mathf.FloorToInt(feet.x);
            var y = map.Height - 1 - Mathf.FloorToInt(feet.y);
            if (x < 0 || y < 0 || x >= map.Width || y >= map.Height) return;
            var g = map.GroundAt(x, y);
            var dusty = g == "sand" || g == "dirt" || g == "path" || g == "gravel" || g == "soil" || g == "rubble" || g == "shore" ||
                        (look.DustEverywhere && (g == "asphalt" || g == "concrete"));
            if (!dusty) return;
            var m = Take(Kind.Dust, "zycie-kurz", MaxPuffs);
            if (m == null) return;
            m.At = feet + new Vector2(Random.Range(-0.2f, 0.2f), 0.05f);
            m.Height = 0.05f;
            m.Rise = 0.25f;
            m.Life = 0.55f;
        }

        // ---------- moving ----------

        void Step(Mote m, float dt, float t, Vector2? feet)
        {
            m.Age += dt;
            if (m.Age > m.Life || (feet is { } ff && !Near(m.At, ff) ))
            {
                m.Root.gameObject.SetActive(false);
                return;
            }
            var wind = WorldView.Wind(m.At.x, m.At.y, t);
            switch (m.Kind)
            {
                case Kind.Leaf:
                    if (m.Height > 0)
                    {
                        m.Height = Mathf.Max(0, m.Height + m.Rise * dt);
                        m.At += new Vector2(0.45f + wind * 0.5f + Mathf.Sin(t * 2.4f + m.Seed) * 0.35f, 0) * dt;
                        m.Visual.localRotation = Quaternion.Euler(0, 0, Mathf.Sin(t * 3.1f + m.Seed) * 40f);
                    }
                    else m.Sprite.color = new Color(1, 1, 1, Mathf.Clamp01((m.Life - m.Age) / 1.2f)); // on the ground, fading
                    break;
                case Kind.Butterfly:
                {
                    // a looping wander round its flower, up and down a little, wings flapping
                    var k = t * 0.9f + m.Seed;
                    m.At = m.Home + new Vector2(Mathf.Sin(k) * 1.1f + Mathf.Sin(k * 2.3f) * 0.3f, Mathf.Sin(k * 1.3f) * 0.6f);
                    m.Height = 0.55f + Mathf.Sin(k * 2.1f) * 0.25f;
                    var open = Mathf.Sin(t * 22f + m.Seed) > 0;
                    var pink = m.Velocity.x > 0.5f;
                    m.Sprite.sprite = art.Get(pink ? open ? "zycie-motyl-c" : "zycie-motyl-d" : open ? "zycie-motyl-a" : "zycie-motyl-b");
                    var fade = Mathf.Clamp01(Mathf.Min(m.Age, m.Life - m.Age));
                    m.Sprite.color = new Color(1, 1, 1, fade);
                    break;
                }
                case Kind.Spark:
                    m.Height += m.Rise * dt;
                    m.At += m.Velocity * dt + new Vector2(wind * 0.2f * dt, 0);
                    m.Sprite.color = new Color(1, 1, 1, 1 - m.Age / m.Life);
                    break;
                case Kind.Smoke:
                case Kind.Dust:
                {
                    m.Height += m.Rise * dt;
                    m.At += new Vector2((0.2f + wind * 0.3f) * dt, 0);
                    var p = m.Age / m.Life;
                    var size = m.Kind == Kind.Smoke ? 0.7f + p * 1.3f : 0.45f + p * 0.7f;
                    m.Visual.localScale = Vector3.one * size;
                    m.Sprite.color = new Color(1, 1, 1, (m.Kind == Kind.Smoke ? 0.55f : 0.7f) * (1 - p));
                    break;
                }
            }
            Place(m);
        }

        /// <summary>Puts a mote where it is: its ground point, sorted by it, the picture lifted by its height.</summary>
        void Place(Mote m)
        {
            m.Root.localPosition = new Vector3(m.At.x, m.At.y, 0);
            m.Visual.parent.localPosition = Vector3.zero;
            m.Visual.localPosition = new Vector3(0, m.Height, 0);
            m.Sprite.sortingOrder = WorldView.SortOrderFor(m.Root.position.y) + 2;
        }

        // ---------- cloud shadows ----------

        void Clouds_(Vector2? feet, float dt, float t)
        {
            for (var i = 0; i < clouds.Count; i++)
            {
                var (sr, at, size) = clouds[i];
                if (feet is not { } f)
                {
                    sr.enabled = false;
                    continue;
                }
                sr.enabled = true;
                // the clouds drift north-east with the wind, slowly; one that has gone by comes in again from the south-west
                if (float.IsNaN(at.x) || at.x - f.x > Wide + size.x || at.y - f.y > Ahead + size.y)
                    at = f + new Vector2(Random.Range(-Wide - size.x, Wide * 0.4f), Random.Range(-Behind - size.y, Ahead * 0.5f));
                at += new Vector2(0.55f, 0.32f) * dt;
                sr.transform.localPosition = new Vector3(at.x, at.y, 0);
                clouds[i] = (sr, at, size);
            }
        }
    }
}
