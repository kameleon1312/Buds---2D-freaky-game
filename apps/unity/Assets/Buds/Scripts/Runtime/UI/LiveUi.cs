using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Buds.UI
{
    /// <summary>
    /// What live play adds over the world: a name over every other bud (with its level, and "w walce", "w menu" or
    /// "pisze…"), and speech bubbles for call-outs and chat lines (theirs and the player's own). Pinned to the world
    /// from the camera every frame; it sits under the HUD and never takes a tap.
    /// </summary>
    public sealed class LiveUi
    {
        public const string Me = "me";
        const int NameFont = 20;
        const float BubbleMaxWidth = 300;

        sealed class Tag
        {
            public RectTransform Root;
            public Text Name;
            public RectTransform Bubble;
            public Text BubbleText;
            public float BubbleUntil;
            public bool ShowName;
        }

        readonly RectTransform layer;
        readonly Dictionary<string, Tag> tags = new();
        readonly List<string> scratch = new();

        public LiveUi(Transform fullScreen)
        {
            // one full-screen layer under everything else on the canvas
            layer = UiKit.Rect("Live", fullScreen);
            UiKit.Stretch(layer);
            layer.SetAsFirstSibling();
        }

        /// <summary>Hidden while the world is (a window over everything, travelling).</summary>
        public void SetVisible(bool visible)
        {
            if (layer.gameObject.activeSelf != visible) layer.gameObject.SetActive(visible);
        }

        /// <summary>Creates or updates a bud's name tag (<see cref="Me"/> is the player: a bubble, no name).</summary>
        public void SetTag(string id, string name, int level, int status)
        {
            var tag = TagFor(id);
            tag.ShowName = id != Me;
            if (!tag.ShowName) return;
            tag.Name.text = TagLine(name, level, status);
        }

        /// <summary>"Ala  poz. 4  w walce": the name as typed (no rich text sneaks in), the level, what it's busy with.</summary>
        public static string TagLine(string name, int level, int status)
        {
            var line = $"{Escape(name)}  <color=#a3e635>poz. {level}</color>";
            return status switch
            {
                1 => line + "  <color=#ff3d50>w walce</color>",
                2 => line + "  <color=#a9afbd>w menu</color>",
                3 => line + "  <color=#a9afbd>pisze…</color>",
                _ => line,
            };
        }

        public void RemoveTag(string id)
        {
            if (!tags.TryGetValue(id, out var tag)) return;
            if (tag.Root) UnityEngine.Object.Destroy(tag.Root.gameObject);
            tags.Remove(id);
        }

        /// <summary>Every remote tag goes (a new map, offline); the player's own bubble stays.</summary>
        public void ClearRemote()
        {
            scratch.Clear();
            foreach (var id in tags.Keys)
                if (id != Me) scratch.Add(id);
            foreach (var id in scratch) RemoveTag(id);
        }

        /// <summary>How long a bubble stays: long enough to read it.</summary>
        public static float BubbleSeconds(string text) => Mathf.Clamp(2.2f + (text?.Length ?? 0) * 0.06f, 2.6f, 7f);

        /// <summary>Words over a bud's head for a few seconds (one line, or a few for a longer chat line).</summary>
        public void Say(string id, string text)
        {
            if (string.IsNullOrEmpty(text)) return;
            var tag = TagFor(id);
            tag.BubbleText.text = Escape(text);
            // one line as wide as the words, or wrapped at the widest bubble
            tag.BubbleText.horizontalOverflow = HorizontalWrapMode.Overflow;
            var oneLine = tag.BubbleText.preferredWidth + 36;
            var width = Mathf.Clamp(oneLine, 90, BubbleMaxWidth);
            tag.BubbleText.horizontalOverflow = HorizontalWrapMode.Wrap;
            var settings = tag.BubbleText.GetGenerationSettings(new Vector2(width - 20, 0));
            var height = tag.BubbleText.cachedTextGeneratorForLayout.GetPreferredHeight(tag.BubbleText.text, settings) /
                         tag.BubbleText.pixelsPerUnit;
            tag.Bubble.sizeDelta = new Vector2(width, Mathf.Max(52, height + 22));
            tag.Bubble.gameObject.SetActive(true);
            tag.BubbleUntil = Time.time + BubbleSeconds(text);
            tag.Root.SetAsLastSibling(); // the newest words on top
        }

        /// <summary>Pins every tag over its bud (<paramref name="headOf"/>: the point over the head, null = not here).</summary>
        public void Tick(Camera cam, Func<string, Vector3?> headOf, Func<string, bool> hasPlate = null)
        {
            if (!layer.gameObject.activeSelf) return;
            foreach (var pair in tags)
            {
                var tag = pair.Value;
                if (!tag.Root) continue;
                var bubbleOn = tag.Bubble.gameObject.activeSelf && Time.time < tag.BubbleUntil;
                if (tag.Bubble.gameObject.activeSelf && !bubbleOn) tag.Bubble.gameObject.SetActive(false);
                var head = cam ? headOf(pair.Key) : null;
                var show = head.HasValue && (tag.ShowName || bubbleOn);
                Vector3 screen = default;
                if (show)
                {
                    screen = cam.WorldToScreenPoint(head.Value);
                    show = screen.z > 0 && screen.x > -200 && screen.x < Screen.width + 200 && screen.y > -100 &&
                           screen.y < Screen.height + 200;
                }
                if (tag.Root.gameObject.activeSelf != show) tag.Root.gameObject.SetActive(show);
                if (!show) continue;
                if (RectTransformUtility.ScreenPointToLocalPointInRectangle(layer, screen, null, out var local))
                    tag.Root.anchoredPosition = local;
                tag.Name.gameObject.SetActive(tag.ShowName);
                // a fighter's health plate sits right over the head: the name and the bubble move up over it
                var lift = hasPlate != null && hasPlate(pair.Key) ? 30 : 0;
                tag.Name.rectTransform.anchoredPosition = new Vector2(0, lift);
                // the bubble sits over the name (or right over the head for the player)
                tag.Bubble.anchoredPosition = new Vector2(0, (tag.ShowName ? 34 : 6) + lift);
            }
        }

        Tag TagFor(string id)
        {
            if (tags.TryGetValue(id, out var tag) && tag.Root) return tag;
            var root = UiKit.Rect("Tag " + id, layer);
            root.anchorMin = root.anchorMax = new Vector2(0.5f, 0.5f);
            root.sizeDelta = Vector2.zero;
            var name = UiKit.Outlined("Name", root, "", NameFont);
            name.horizontalOverflow = HorizontalWrapMode.Overflow;
            name.supportRichText = true;
            UiKit.Place(name.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0, 0), new Vector2(360, 28), new Vector2(0.5f, 0));

            // the speech bubble: paper with an outline, a hard drop and a little tail pointing down at the bud
            var bubble = UiKit.Rect("Bubble", root);
            UiKit.Place(bubble, new Vector2(0.5f, 0.5f), new Vector2(0, 34), new Vector2(140, 52), new Vector2(0.5f, 0));
            var drop = UiKit.Shape("Drop", bubble, UiKit.Outline, UiKit.RadiusM).rectTransform;
            UiKit.Stretch(drop, 0, -4, 0, 4);
            var tail = UiKit.OutlinedBox("Tail", bubble, UiKit.Paper100, 2);
            var tailRt = (RectTransform)tail.transform.parent;
            UiKit.Place(tailRt, new Vector2(0.5f, 0), new Vector2(0, 4), new Vector2(18, 18), new Vector2(0.5f, 0.5f));
            tailRt.localEulerAngles = new Vector3(0, 0, 45);
            var face = UiKit.OutlinedBox("Face", bubble, UiKit.Paper100, UiKit.RadiusM);
            UiKit.Stretch((RectTransform)face.transform.parent);
            var text = UiKit.Label("Text", face.transform, "", 22, UiKit.Ink, true);
            text.lineSpacing = 0.95f;
            UiKit.Stretch(text.rectTransform, 10, 4, 10, 2);
            bubble.gameObject.SetActive(false);

            tag = new Tag { Root = root, Name = name, Bubble = bubble, BubbleText = text, ShowName = id != Me };
            tags[id] = tag;
            root.gameObject.SetActive(false);
            return tag;
        }

        /// <summary>Text is shown as it is: rich-text tags typed into it are not drawn as tags.</summary>
        public static string Escape(string s) => (s ?? "").Replace("<", "<​");

        /// <summary>Removes everything (signing out, the scene going away).</summary>
        public void Dispose()
        {
            tags.Clear();
            if (layer) UnityEngine.Object.Destroy(layer.gameObject);
        }
    }
}
