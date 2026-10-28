using System;
using System.Collections.Generic;
using Buds.Combat;
using UnityEngine;
using UnityEngine.UI;

namespace Buds.UI
{
    /// <summary>
    /// What the fight shows over the world (docs/walka.md): a health plate over every fighter that matters (the bud's
    /// own, foes, allies, the opponents of the districts once they fight or are hurt), with the level and, for the
    /// opponents and shadows, the name; and the numbers of every blow, popping up from the head that took it. Pinned to
    /// the world from the camera every frame, under the HUD, never takes a tap.
    /// </summary>
    public sealed class CombatUi
    {
        const float BarWidth = 92;
        const float BarHeight = 14;

        sealed class Plate
        {
            public RectTransform Root;
            public RectTransform Fill;
            public RectTransform Lag;
            public RectTransform Shield;
            public Image FillImage;
            public Text Level;
            public Text Name;
            public float Shown = 1, Lagging = 1;
            public float Target = 1, ShieldShare;
            public bool Seen;
        }

        sealed class Number
        {
            public Text Text;
            public Vector3 World;
            public float Start, Seconds;
            public Vector2 Drift;
            public float Scale;
        }

        readonly RectTransform layer;
        readonly RectTransform knockout;
        readonly Text knockoutTitle;
        readonly Text knockoutLine;
        string knockoutBy = "";
        readonly Dictionary<string, Plate> plates = new();
        readonly List<Number> numbers = new();
        readonly Stack<Text> freeNumbers = new();
        readonly List<string> scratch = new();
        readonly List<Plate> shown = new();

        public CombatUi(Transform fullScreen)
        {
            layer = UiKit.Rect("Fight", fullScreen);
            UiKit.Stretch(layer);
            // over the names (LiveUi is the first child), under every window and button
            layer.SetSiblingIndex(Mathf.Min(1, fullScreen.childCount - 1));

            // knocked out: the word sprayed big in the middle, when the bud gets up under it
            knockout = UiKit.Rect("Knockout", layer);
            UiKit.Place(knockout, new Vector2(0.5f, 0.5f), new Vector2(0, 120), new Vector2(700, 160));
            knockoutTitle = UiKit.Outlined("Title", knockout, "NOKAUT", 72, UiKit.Alert500);
            UiKit.Place(knockoutTitle.rectTransform, new Vector2(0.5f, 1), Vector2.zero, new Vector2(700, 90), new Vector2(0.5f, 1));
            knockoutLine = UiKit.Outlined("Line", knockout, "", 26);
            UiKit.Place(knockoutLine.rectTransform, new Vector2(0.5f, 0), Vector2.zero, new Vector2(700, 60), new Vector2(0.5f, 0));
            knockout.gameObject.SetActive(false);
        }

        /// <summary>The bud was knocked out (by someone, or ""): the big word and the countdown until it gets up.</summary>
        public void ShowKnockout(string by, float seconds)
        {
            knockoutBy = string.IsNullOrEmpty(by) ? "" : LiveUi.Escape(by);
            knockout.gameObject.SetActive(true);
            knockout.SetAsLastSibling();
        }

        public void HideKnockout()
        {
            if (knockout) knockout.gameObject.SetActive(false);
        }

        /// <summary>The countdown (every frame while knocked out).</summary>
        public void TickKnockout(float now, float downUntil)
        {
            if (!knockout || !knockout.gameObject.activeSelf) return;
            var left = downUntil - now;
            if (left <= 0)
            {
                HideKnockout();
                return;
            }
            var by = knockoutBy.Length > 0 ? $"Pokonuje cię: {knockoutBy}.  " : "";
            knockoutLine.text = $"{by}Wstajesz za {Mathf.CeilToInt(left)} s";
            // the word lands with a thump and settles
            var since = 5 - left;
            knockoutTitle.rectTransform.localScale = Vector3.one * (since < 0.2f ? Mathf.Lerp(1.6f, 1, since / 0.2f) : 1);
        }

        /// <summary>Is a plate showing over this fighter now (its name tag moves up over it)?</summary>
        public bool Has(string id) => plates.TryGetValue(id, out var p) && p.Root && p.Root.gameObject.activeSelf;

        public void SetVisible(bool visible)
        {
            if (layer.gameObject.activeSelf != visible) layer.gameObject.SetActive(visible);
        }

        /// <summary>
        /// A fighter's plate: its side (colour), level, name (only opponents and shadows carry one here; buds have
        /// their name tag) and health. Call every frame it should show; plates not touched in a frame hide.
        /// </summary>
        public void Show(string id, BrawlLook.Side side, int level, string name, int hp, int maxHp, int shield = 0)
        {
            var p = PlateFor(id);
            p.Seen = true;
            p.FillImage.color = BrawlLook.Fill(side);
            var lv = level > 0 ? level.ToString() : "";
            if (p.Level.text != lv) p.Level.text = lv;
            var n = string.IsNullOrEmpty(name) ? "" : LiveUi.Escape(name);
            if (p.Name.text != n) p.Name.text = n;
            p.Name.gameObject.SetActive(n.Length > 0);
            var share = maxHp > 0 ? Mathf.Clamp01((float)hp / maxHp) : 1;
            // a heal shows at once, a loss leaves a pale lag that catches up (you see how big the blow was)
            if (share > p.Target) p.Lagging = Mathf.Max(p.Lagging, share);
            p.Target = share;
            p.ShieldShare = maxHp > 0 ? Mathf.Clamp01((float)shield / maxHp) : 0;
        }

        /// <summary>The numbers of a blow over a head: white for blows of the bud, red for blows it took, gold for crits.</summary>
        public void Pop(Vector3 head, string text, Color color, bool big)
        {
            var t = freeNumbers.Count > 0 ? freeNumbers.Pop() : MakeNumber();
            t.gameObject.SetActive(true);
            t.text = text;
            t.color = color;
            t.fontSize = big ? 46 : 34;
            t.rectTransform.SetAsLastSibling();
            numbers.Add(new Number
            {
                Text = t, World = head, Start = Time.time, Seconds = big ? 0.95f : 0.75f,
                Drift = new Vector2(UnityEngine.Random.Range(-28f, 28f), UnityEngine.Random.Range(46f, 64f)),
                Scale = big ? 1.25f : 1,
            });
        }

        /// <summary>Pins plates and numbers to the world; <paramref name="headOf"/> is where a fighter's head is (null = gone).</summary>
        public void Tick(Camera cam, Func<string, Vector3?> headOf)
        {
            if (!layer.gameObject.activeSelf || !cam) return;
            var dt = Time.deltaTime;
            scratch.Clear();
            foreach (var pair in plates)
            {
                var p = pair.Value;
                var head = p.Seen ? headOf(pair.Key) : null;
                p.Seen = false;
                var show = head.HasValue && Place(cam, head.Value, p.Root, 22);
                if (p.Root.gameObject.activeSelf != show) p.Root.gameObject.SetActive(show);
                if (!show)
                {
                    scratch.Add(pair.Key);
                    continue;
                }
                p.Shown = Mathf.MoveTowards(p.Shown, p.Target, dt * 3.5f);
                if (p.Target > p.Shown) p.Shown = p.Target;
                p.Lagging = p.Lagging > p.Shown ? Mathf.MoveTowards(p.Lagging, p.Shown, dt * 0.9f) : p.Shown;
                SetWidth(p.Fill, p.Shown);
                SetWidth(p.Lag, p.Lagging);
                SetWidth(p.Shield, Mathf.Min(1, p.Shown + p.ShieldShare), p.Shown);
            }
            Untangle();
            // plates nobody asked for this frame go away (left the map, stood up fresh, out of the fight)
            foreach (var id in scratch)
                if (plates.TryGetValue(id, out var gone) && gone.Root)
                {
                    UnityEngine.Object.Destroy(gone.Root.gameObject);
                    plates.Remove(id);
                }

            for (var i = numbers.Count - 1; i >= 0; i--)
            {
                var n = numbers[i];
                var k = (Time.time - n.Start) / n.Seconds;
                if (k >= 1 || !Place(cam, n.World, n.Text.rectTransform, 40))
                {
                    n.Text.gameObject.SetActive(false);
                    freeNumbers.Push(n.Text);
                    numbers.RemoveAt(i);
                    continue;
                }
                // up and out, a pop at the start, a fade at the end
                var rise = 1 - (1 - k) * (1 - k);
                n.Text.rectTransform.anchoredPosition += n.Drift * rise;
                var pop = k < 0.14f ? Mathf.Lerp(1.6f, 1, k / 0.14f) : 1;
                n.Text.rectTransform.localScale = Vector3.one * (n.Scale * pop);
                var c = n.Text.color;
                c.a = k > 0.65f ? 1 - (k - 0.65f) / 0.35f : 1;
                n.Text.color = c;
            }
        }

        /// <summary>
        /// Two fighters standing close put their plates on top of each other: the one further back (higher on the
        /// screen) moves up until both read, the nearer one keeps its place over its head.
        /// </summary>
        void Untangle()
        {
            shown.Clear();
            foreach (var p in plates.Values)
                if (p.Root && p.Root.gameObject.activeSelf) shown.Add(p);
            if (shown.Count < 2) return;
            shown.Sort((a, b) => a.Root.anchoredPosition.y.CompareTo(b.Root.anchoredPosition.y));
            var height = BarHeight + 10;
            for (var i = 1; i < shown.Count; i++)
            {
                var rt = shown[i].Root;
                var at = rt.anchoredPosition;
                for (var j = 0; j < i; j++)
                {
                    var below = shown[j].Root.anchoredPosition;
                    // the name over a plate takes room too
                    var room = shown[j].Name.gameObject.activeSelf ? height + 20 : height;
                    if (Mathf.Abs(below.x - at.x) < BarWidth + 26 && at.y - below.y < room) at.y = below.y + room;
                }
                rt.anchoredPosition = at;
            }
        }

        bool Place(Camera cam, Vector3 world, RectTransform rt, float lift)
        {
            var screen = cam.WorldToScreenPoint(world);
            if (screen.z <= 0 || screen.x < -120 || screen.x > Screen.width + 120 || screen.y < -80 || screen.y > Screen.height + 120)
                return false;
            if (!RectTransformUtility.ScreenPointToLocalPointInRectangle(layer, screen, null, out var local)) return false;
            rt.anchoredPosition = local + new Vector2(0, lift);
            return true;
        }

        static void SetWidth(RectTransform fill, float share, float from = 0)
        {
            var w = ((RectTransform)fill.parent).rect.width;
            fill.offsetMin = new Vector2(w * Mathf.Clamp01(from), 0);
            fill.offsetMax = new Vector2(-w * (1 - Mathf.Clamp01(share)), 0);
            fill.gameObject.SetActive(share - from > 0.002f);
        }

        Plate PlateFor(string id)
        {
            if (plates.TryGetValue(id, out var p) && p.Root) return p;
            var root = UiKit.Rect("Plate " + id, layer);
            root.anchorMin = root.anchorMax = new Vector2(0.5f, 0.5f);
            root.sizeDelta = new Vector2(BarWidth + 30, BarHeight + 8);

            // the bar: an ink frame, a dark track, a pale lag, the health, the shield over it
            var frame = UiKit.Shape("Frame", root, UiKit.Outline, 5);
            UiKit.Place(frame.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(12, 0), new Vector2(BarWidth, BarHeight));
            var track = UiKit.Shape("Track", frame.transform, UiKit.Surface800, 3);
            UiKit.Stretch(track.rectTransform, 2.5f);
            var lag = UiKit.Shape("Lag", track.transform, new Color(1, 1, 1, 0.75f), 2).rectTransform;
            UiKit.Stretch(lag);
            var fill = UiKit.Shape("Fill", track.transform, UiKit.Buds400, 2);
            UiKit.Stretch(fill.rectTransform);
            var shine = UiKit.Shape("Shine", fill.transform, new Color(1, 1, 1, 0.28f), 1).rectTransform;
            shine.anchorMin = new Vector2(0, 0.55f);
            shine.anchorMax = new Vector2(1, 0.9f);
            shine.offsetMin = new Vector2(2, 0);
            shine.offsetMax = new Vector2(-2, 0);
            var shield = UiKit.Shape("Shield", track.transform, new Color(0.96f, 0.95f, 0.91f, 0.95f), 2).rectTransform;
            UiKit.Stretch(shield);
            // the level in a round badge at the bar's left end
            var badge = UiKit.Shape("Badge", root, UiKit.Outline, 11);
            UiKit.Place(badge.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(-BarWidth / 2 - 4, 0), new Vector2(24, 24));
            var badgeFill = UiKit.Shape("Face", badge.transform, UiKit.Surface700, 9);
            UiKit.Stretch(badgeFill.rectTransform, 2.5f);
            var level = UiKit.Label("Level", badge.transform, "", 14, UiKit.TextOnDark, true);
            UiKit.Stretch(level.rectTransform);
            var name = UiKit.Outlined("Name", root, "", 17);
            name.horizontalOverflow = HorizontalWrapMode.Overflow;
            UiKit.Place(name.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(6, BarHeight / 2 + 2), new Vector2(240, 22), new Vector2(0.5f, 0));
            p = new Plate { Root = root, Fill = fill.rectTransform, Lag = lag, Shield = shield, FillImage = fill, Level = level, Name = name };
            plates[id] = p;
            Canvas.ForceUpdateCanvases();
            return p;
        }

        Text MakeNumber()
        {
            var t = UiKit.Outlined("Number", layer, "", 30);
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            t.rectTransform.anchorMin = t.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
            t.rectTransform.sizeDelta = new Vector2(160, 48);
            return t;
        }

        /// <summary>Every plate and number off (a new map).</summary>
        public void Clear()
        {
            foreach (var p in plates.Values)
                if (p.Root) UnityEngine.Object.Destroy(p.Root.gameObject);
            plates.Clear();
            foreach (var n in numbers)
            {
                n.Text.gameObject.SetActive(false);
                freeNumbers.Push(n.Text);
            }
            numbers.Clear();
        }
    }
}
