using System;
using System.Collections.Generic;
using Buds.World;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Buds.UI
{
    /// <summary>Everything the map screen shows. Filled by GameBootstrap.</summary>
    public sealed class MapScreenData
    {
        public WorldMap Map;
        public Exploration Fog;
        /// <summary>The bud, in map coordinates (x right, y down, continuous).</summary>
        public Vector2 Player;
        public readonly List<(Vector2 cell, string label)> Targets = new();
        public readonly List<Vector2Int> FoundCaches = new();
        public int CachesFound;
        public int CachesTotal;
    }

    /// <summary>
    /// "Mapa" (M or the HUD button): the district drawn from its own ground colours, dark where the bud hasn't been
    /// yet. On it: the bud, doors, found caches, numbered pins for quest targets (tap one to read it) and place names
    /// laid out so they never overlap (MapLabels). The picture is the land in detail (roofs, crowns, ground, MapPicture.Detailed)
    /// under a soft fog that lifts where the bud has been; it zooms from the whole map to single streets (wheel, pinch,
    /// + and -) and is dragged about (MapView). Beside it, in fixed sections one under another: how much is explored, how
    /// many places were found, the legend and the numbered list of targets.
    /// </summary>
    public sealed class MapScreen
    {
        const float MapW = 760;
        const float MapH = 570;
        const float PinSize = 34;
        const int MaxTargetRows = 4;
        static Sprite disc;

        readonly GameObject root;
        readonly Text title;
        readonly RawImage picture;
        readonly RawImage fogImage;
        readonly Text placesLine;
        const int DetailScale = 8;
        string detailFor;
        Texture2D fogTexture;
        MapScreenData shown;
        MapView view;
        /// <summary>The zoom the markers were last laid out for: between layouts they just follow the picture.</summary>
        float laidOutZoom = 1;
        float layOutAt = -1;
        float pinchFrom;
        readonly RectTransform markers;
        readonly RectTransform pins;
        readonly Text explored;
        readonly Text cachesLine;
        readonly Text targetsTitle;
        readonly RectTransform targetRows;
        readonly RectTransform bubble;
        readonly Text bubbleText;
        Texture2D texture;
        readonly List<(Vector2 at, string label)> shownTargets = new();
        int openPin = -1;

        public bool IsOpen => root.activeSelf;

        public MapScreen(Transform canvas, Action onClose)
        {
            var dim = UiKit.Panel("MapScreen", canvas, new Color(0.086f, 0.094f, 0.122f, 0.72f));
            dim.raycastTarget = true;
            UiKit.Stretch(dim.rectTransform);
            root = dim.gameObject;

            var group = UiKit.Rect("Group", dim.transform);
            UiKit.Place(group, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(1180, 820));
            group.gameObject.AddComponent<FitInParent>();
            var body = UiKit.Window("Window", group, new Vector2(1140, 800), "Mapa", onClose, out var window, out title);
            UiKit.Place(window, new Vector2(0.5f, 0.5f), Vector2.zero, window.sizeDelta);

            // the map in a dark frame; tapping the map (not a pin) closes an open target
            var frame = UiKit.OutlinedBox("Frame", body, UiKit.Surface900, UiKit.RadiusM);
            var frameRt = (RectTransform)frame.transform.parent;
            UiKit.Place(frameRt, new Vector2(0, 1), Vector2.zero, new Vector2(MapW + 16, MapH + 16), new Vector2(0, 1));
            frame.raycastTarget = true;
            frame.gameObject.AddComponent<Button>().onClick.AddListener(() => OpenPin(-1));
            frame.gameObject.AddComponent<MapSurface>().Screen = this;
            var viewport = UiKit.Rect("Viewport", frame.transform);
            UiKit.Place(viewport, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(MapW, MapH));
            viewport.gameObject.AddComponent<RectMask2D>();
            picture = new GameObject("Picture", typeof(RectTransform)).AddComponent<RawImage>();
            picture.transform.SetParent(viewport, false);
            picture.raycastTarget = false;
            UiKit.Place(picture.rectTransform, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(MapW, MapH));
            fogImage = new GameObject("Fog", typeof(RectTransform)).AddComponent<RawImage>();
            fogImage.transform.SetParent(picture.transform, false);
            fogImage.raycastTarget = false;
            UiKit.Stretch(fogImage.rectTransform);
            markers = UiKit.Rect("Markers", picture.transform);
            UiKit.Stretch(markers);
            pins = UiKit.Rect("Pins", picture.transform);
            UiKit.Stretch(pins);

            // the open target: a dark bubble next to its pin
            var bubbleBox = UiKit.OutlinedBox("Bubble", picture.transform, UiKit.Surface800, UiKit.RadiusS);
            bubble = (RectTransform)bubbleBox.transform.parent;
            bubbleText = UiKit.Label("Text", bubbleBox.transform, "", 20, UiKit.TextOnDark, false, TextAnchor.MiddleLeft);
            UiKit.Stretch(bubbleText.rectTransform, 14, 8, 14, 8);
            bubble.gameObject.SetActive(false);

            // zoom: over the map's corner, out of the way of the pins
            var pad = UiKit.Rect("Zoom", frame.transform);
            UiKit.Place(pad, new Vector2(1, 1), new Vector2(-10, -10), new Vector2(64, 204), new Vector2(1, 1));
            void ZoomButton(string name, string text, float y, Action act)
            {
                var b = UiKit.Button(name, pad, text, new Vector2(62, 60), act, UiKit.Tone.Rep, 28);
                UiKit.Place((RectTransform)b.transform, new Vector2(0.5f, 1), new Vector2(0, y), new Vector2(62, 60), new Vector2(0.5f, 1));
            }
            ZoomButton("ZoomIn", "+", 0, () => ZoomBy(1.6f, Vector2.zero));
            ZoomButton("ZoomOut", "-", -68, () => ZoomBy(1 / 1.6f, Vector2.zero));
            ZoomButton("OnMe", "Ja", -136, CentreOnBud);

            // ---------- side column: fixed sections from the top ----------
            var side = UiKit.Rect("Side", body);
            side.anchorMin = new Vector2(0, 0);
            side.anchorMax = new Vector2(1, 1);
            side.offsetMin = new Vector2(MapW + 40, 0);
            side.offsetMax = Vector2.zero;
            var y = 0f;
            Text Row(string name, int size, Color color, bool bold, float height)
            {
                var t = UiKit.Label(name, side, "", size, color, bold, TextAnchor.UpperLeft);
                Top(t.rectTransform, y, height);
                y += height;
                return t;
            }
            explored = Row("Explored", 26, UiKit.Ink, true, 36);
            cachesLine = Row("Caches", 26, UiKit.Ink, true, 36);
            placesLine = Row("Places", 26, UiKit.Ink, true, 36);
            y += 18;

            (string, Color, float)[] keys =
            {
                ("Ty", UiKit.Buds400, 22),
                ("Cel zadania", UiKit.Gold400, 22),
                ("Drzwi", UiKit.Paper100, 14),
                ("Znaleziona skrytka", UiKit.Rep400, 14),
            };
            foreach (var (label, color, size) in keys)
            {
                var row = UiKit.Rect("Key", side);
                Top(row, y, 34);
                Dot(row, new Vector2(17, 0), color, size, new Vector2(0, 0.5f));
                var t = UiKit.Label("Text", row, label, 21, UiKit.InkSoft, false, TextAnchor.MiddleLeft);
                UiKit.Stretch(t.rectTransform, 44, 0, 0, 0);
                y += 34;
            }
            y += 14;

            targetsTitle = Row("TargetsTitle", 23, UiKit.Ink, true, 32);
            targetRows = UiKit.Rect("Targets", side);
            Top(targetRows, y, MaxTargetRows * 56 + 30);

            var close = UiKit.Label("Close", side, UiKit.Mobile ? "Dwa palce: przybliż i oddal" : "Kółko: przybliż · przeciągnij mapę · M: zamknij", 18, UiKit.InkSoft, false,
                TextAnchor.LowerRight);
            UiKit.Stretch(close.rectTransform, 0, -4, 0, 0);
            root.SetActive(false);
        }

        /// <summary>A rect pinned to the top of its parent, `y` down from the top, full width.</summary>
        static void Top(RectTransform rt, float y, float height)
        {
            rt.anchorMin = new Vector2(0, 1);
            rt.anchorMax = new Vector2(1, 1);
            rt.pivot = new Vector2(0.5f, 1);
            rt.offsetMin = new Vector2(0, -y - height);
            rt.offsetMax = new Vector2(0, -y);
        }

        public void Show(MapScreenData data)
        {
            var map = data.Map;
            var district = Districts.Get(map.Id);
            title.text = "Mapa · " + (district?.Name ?? map.Name);

            // the land in detail is drawn once per map; only the fog over it changes
            if (detailFor != map.Id)
            {
                if (texture) UnityEngine.Object.Destroy(texture);
                texture = new Texture2D(map.Width * DetailScale, map.Height * DetailScale, TextureFormat.RGBA32, true)
                {
                    filterMode = FilterMode.Trilinear,
                    wrapMode = TextureWrapMode.Clamp,
                };
                var entries = Manifest();
                texture.SetPixels32(MapPicture.Detailed(map, DetailScale, name => entries.TryGetValue(name, out var e) && !e.flat ? e.foot ?? new[] { 1, 1 } : null));
                texture.Apply(true);
                picture.texture = texture;
                detailFor = map.Id;
                // keep the map's proportions inside the frame
                var scale = Mathf.Min(MapW / map.Width, MapH / map.Height);
                view = new MapView(new Vector2(MapW, MapH), new Vector2(map.Width * scale, map.Height * scale));
            }
            if (fogTexture) UnityEngine.Object.Destroy(fogTexture);
            fogTexture = new Texture2D(map.Width, map.Height, TextureFormat.RGBA32, false)
            {
                filterMode = FilterMode.Bilinear,
                wrapMode = TextureWrapMode.Clamp,
            };
            fogTexture.SetPixels32(MapPicture.FogPixels(map.Width, map.Height, data.Fog));
            fogTexture.Apply();
            fogImage.texture = fogTexture;
            shown = data;
            ApplyView();
            LayOut();

            // side column
            var percent = data.Fog != null ? Mathf.RoundToInt(data.Fog.Explored(map) * 100) : 100;
            var places = MapPicture.Places(map, data.Fog);
            explored.text = $"Odkryto: {percent}%";
            placesLine.text = $"Miejsca: {places.seen} / {places.total}";
            cachesLine.text = $"Skrytki: {data.CachesFound} / {data.CachesTotal}";
            targetsTitle.text = data.Targets.Count == 0 ? "Brak celów w tej dzielnicy" : $"Cele zadań ({data.Targets.Count})";
            Clear(targetRows);
            for (var i = 0; i < data.Targets.Count && i < MaxTargetRows; i++) TargetRow(i, data.Targets[i].label);
            if (data.Targets.Count > MaxTargetRows)
            {
                var more = UiKit.Label("More", targetRows, $"+{data.Targets.Count - MaxTargetRows}: dotknij pinezki na mapie", 18,
                    UiKit.InkSoft, false, TextAnchor.UpperLeft);
                Top(more.rectTransform, MaxTargetRows * 56, 30);
            }

            OpenPin(-1);
            root.SetActive(true);
            root.transform.SetAsLastSibling();
        }

        static Dictionary<string, PropArt.Entry> manifest;

        static Dictionary<string, PropArt.Entry> Manifest()
        {
            if (manifest != null) return manifest;
            manifest = new Dictionary<string, PropArt.Entry>();
            foreach (var e in PropArt.LoadManifest().props) manifest[e.name] = e;
            return manifest;
        }

        // ---------- zoom and drag ----------

        void ApplyView()
        {
            picture.rectTransform.sizeDelta = view.PictureSize;
            picture.rectTransform.anchoredPosition = view.Pan;
            // between two layouts the markers' spots follow the picture's growth
            var follow = view.Zoom / laidOutZoom;
            markers.localScale = pins.localScale = new Vector3(follow, follow, 1);
        }

        internal void ZoomBy(float factor, Vector2 point)
        {
            if (view == null) return;
            view.ZoomAt(factor, point);
            ApplyView();
            layOutAt = Time.unscaledTime + 0.12f;
        }

        internal void DragBy(Vector2 by)
        {
            if (view == null) return;
            view.PanBy(by);
            ApplyView();
        }

        /// <summary>The bud's place in the middle of the frame, a street's worth of detail around it.</summary>
        public void CentreOnBud()
        {
            if (view == null || shown == null) return;
            if (view.Zoom < 3) view.ZoomAt(3 / view.Zoom, Vector2.zero);
            var map = shown.Map;
            var fit = view.PictureSize / view.Zoom;
            view.CentreOn(new Vector2(shown.Player.x / map.Width * fit.x - fit.x / 2, fit.y / 2 - shown.Player.y / map.Height * fit.y));
            ApplyView();
            layOutAt = Time.unscaledTime;
        }

        /// <summary>Every frame while open: two fingers, the + and - keys, and laying the markers out once the zoom settles.</summary>
        public void Tick()
        {
            var touch = UnityEngine.InputSystem.Touchscreen.current;
            if (touch != null)
            {
                var a = touch.touches[0];
                var b = touch.touches[1];
                if (a.press.isPressed && b.press.isPressed)
                {
                    var gap = Vector2.Distance(a.position.ReadValue(), b.position.ReadValue());
                    if (pinchFrom > 0 && gap > 0) ZoomBy(gap / pinchFrom, Vector2.zero);
                    pinchFrom = gap;
                }
                else pinchFrom = 0;
            }
            var kb = UnityEngine.InputSystem.Keyboard.current;
            if (kb != null)
            {
                if (kb.equalsKey.wasPressedThisFrame || kb.numpadPlusKey.wasPressedThisFrame) ZoomBy(1.6f, Vector2.zero);
                if (kb.minusKey.wasPressedThisFrame || kb.numpadMinusKey.wasPressedThisFrame) ZoomBy(1 / 1.6f, Vector2.zero);
            }
            if (layOutAt >= 0 && Time.unscaledTime >= layOutAt)
            {
                layOutAt = -1;
                LayOut();
            }
        }

        /// <summary>Takes the frame's drags and the mouse wheel.</summary>
        sealed class MapSurface : MonoBehaviour, IDragHandler, IScrollHandler
        {
            public MapScreen Screen;

            public void OnDrag(PointerEventData e)
            {
                // two fingers are a pinch, not a drag
                if (UnityEngine.InputSystem.Touchscreen.current is { } t && t.touches[1].press.isPressed) return;
                var canvas = GetComponentInParent<Canvas>();
                Screen.DragBy(e.delta / (canvas ? canvas.scaleFactor : 1));
            }

            public void OnScroll(PointerEventData e)
            {
                var rt = (RectTransform)transform;
                var factor = e.scrollDelta.y > 0 ? 1.25f : e.scrollDelta.y < 0 ? 1 / 1.25f : 1;
                if (RectTransformUtility.ScreenPointToLocalPointInRectangle(rt, e.position, e.enterEventCamera, out var point))
                    Screen.ZoomBy(factor, point - rt.rect.center);
            }
        }

        /// <summary>Doors, caches, the bud, pins and names at the current zoom.</summary>
        void LayOut()
        {
            var data = shown;
            if (data == null) return;
            var map = data.Map;
            laidOutZoom = view.Zoom;
            markers.localScale = pins.localScale = Vector3.one;
            var open = openPin;
            Clear(markers);
            Clear(pins);
            bool Seen(int x, int y) => data.Fog == null || data.Fog.IsSeen(x, y);

            // markers first: names are laid out around them
            var obstacles = new List<Rect>();
            foreach (var d in map.Doors)
                if (Seen(d.X, d.Y)) Dot(markers, At(map, new Vector2(d.X + 0.5f, d.Y + 0.5f)), UiKit.Paper100, 14);
            foreach (var c in data.FoundCaches)
            {
                var at = At(map, c + new Vector2(0.5f, 0.5f));
                Dot(markers, at, UiKit.Rep400, 14);
                obstacles.Add(MapLabels.RectAt(at, new Vector2(22, 22)));
            }
            var player = At(map, data.Player);
            Dot(markers, player, UiKit.Buds400, 24);
            obstacles.Add(MapLabels.RectAt(player, new Vector2(34, 34)));

            shownTargets.Clear();
            for (var i = 0; i < data.Targets.Count; i++)
            {
                var (cell, label) = data.Targets[i];
                var at = At(map, cell);
                shownTargets.Add((at, label));
                Pin(i, at);
                obstacles.Add(MapLabels.RectAt(at, new Vector2(PinSize + 6, PinSize + 6)));
            }

            PlaceNames(map, data, obstacles, Seen);
            OpenPin(open);
        }

        public void Hide() => root.SetActive(false);

        /// <summary>Autopilot: opens the first target's description, as a tap on its pin would.</summary>
        public void OpenFirstPinForTest() => OpenPin(0);

        /// <summary>Exits (gold) first, then places from the biggest down, then "wkrótce" plots; what doesn't fit is left out.</summary>
        void PlaceNames(WorldMap map, MapScreenData data, List<Rect> obstacles, Func<int, int, bool> seen)
        {
            var texts = new List<Text>();
            var labels = new List<MapLabels.Label>();
            void Add(Vector2 cell, string text, int size, Color color, int priority)
            {
                var t = UiKit.Outlined("Name", markers, text, size, color);
                t.horizontalOverflow = HorizontalWrapMode.Overflow;
                var w = t.preferredWidth + 8;
                var h = size + 8;
                texts.Add(t);
                labels.Add(new MapLabels.Label { Anchor = At(map, cell), Size = new Vector2(w, h), Priority = priority });
            }

            foreach (var e in map.Exits)
            {
                var name = Districts.NameOf(e.DistrictId);
                Add(new Vector2((e.X0 + e.X1 + 1) / 2f, (e.Y0 + e.Y1 + 1) / 2f), "Do: " + name, 19, UiKit.Gold400, 3000);
            }
            foreach (var z in map.Zones)
            {
                var parent = map.Zones.Exists(o => o != z && o.Area < z.Area && z.Contains(o.X0, o.Y0) && z.Contains(o.X1, o.Y1));
                var cx = (z.X0 + z.X1 + 1) / 2f;
                var cy = parent ? z.Y0 + 1.5f : (z.Y0 + z.Y1 + 1) / 2f;
                if (!seen((int)cx, (int)cy)) continue;
                Add(new Vector2(cx, cy), z.Name, parent ? 18 : 20, UiKit.TextOnDark, 1000 + Mathf.Min(999, z.Area / 10));
            }
            foreach (var p in map.Plots)
            {
                var at = new Vector2((p.X0 + p.X1 + 1) / 2f, (p.Y0 + p.Y1 + 1) / 2f);
                if (seen((int)at.x, (int)at.y)) Add(at, "wkrótce", 15, UiKit.TextOnDarkMuted, 0);
            }

            var size = view.PictureSize;
            var bounds = new Rect(-size.x / 2 + 4, -size.y / 2 + 4, size.x - 8, size.y - 8);
            var spots = MapLabels.Place(labels, bounds, obstacles);
            for (var i = 0; i < texts.Count; i++)
            {
                if (spots[i] is { } at) UiKit.Place(texts[i].rectTransform, new Vector2(0.5f, 0.5f), at, labels[i].Size);
                else UnityEngine.Object.Destroy(texts[i].gameObject);
            }
        }

        /// <summary>A numbered gold pin; tapping it opens (or closes) its target's description.</summary>
        void Pin(int index, Vector2 at)
        {
            disc ??= UiKit.Circle(32);
            var outline = UiKit.Panel("Pin " + (index + 1), pins, UiKit.Outline);
            outline.sprite = disc;
            outline.raycastTarget = true;
            UiKit.Place(outline.rectTransform, new Vector2(0.5f, 0.5f), at, new Vector2(PinSize + 6, PinSize + 6));
            var fill = UiKit.Panel("Fill", outline.transform, UiKit.Gold400);
            fill.sprite = disc;
            UiKit.Place(fill.rectTransform, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(PinSize, PinSize));
            var number = UiKit.Label("Number", outline.transform, (index + 1).ToString(), 20, UiKit.Ink, true);
            UiKit.Stretch(number.rectTransform);
            outline.gameObject.AddComponent<Button>().onClick.AddListener(() => OpenPin(openPin == index ? -1 : index));
        }

        /// <summary>The numbered row in the side column; tapping it shows that pin's description on the map.</summary>
        void TargetRow(int index, string label)
        {
            var row = UiKit.Rect("Target " + (index + 1), targetRows);
            Top(row, index * 56, 52);
            var hit = row.gameObject.AddComponent<Image>();
            hit.color = new Color(0, 0, 0, 0);
            row.gameObject.AddComponent<Button>().onClick.AddListener(() => OpenPin(openPin == index ? -1 : index));
            disc ??= UiKit.Circle(32);
            var badge = UiKit.Panel("Badge", row, UiKit.Outline);
            badge.sprite = disc;
            UiKit.Place(badge.rectTransform, new Vector2(0, 1), new Vector2(15, -15), new Vector2(30, 30));
            var fill = UiKit.Panel("Fill", badge.transform, UiKit.Gold400);
            fill.sprite = disc;
            UiKit.Place(fill.rectTransform, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(24, 24));
            var number = UiKit.Label("Number", badge.transform, (index + 1).ToString(), 16, UiKit.Ink, true);
            UiKit.Stretch(number.rectTransform);
            var text = UiKit.Label("Text", row, label, 18, UiKit.InkSoft, false, TextAnchor.UpperLeft);
            UiKit.Stretch(text.rectTransform, 40, 0, 0, 0);
            text.verticalOverflow = VerticalWrapMode.Truncate;
        }

        /// <summary>Shows target `index`'s description in a bubble beside its pin (-1: none).</summary>
        void OpenPin(int index)
        {
            openPin = index;
            if (index < 0 || index >= shownTargets.Count)
            {
                openPin = -1;
                bubble.gameObject.SetActive(false);
                return;
            }
            var (at, label) = shownTargets[index];
            // zoomed in, the pin comes into the frame first
            if (view.Zoom > 1)
            {
                view.CentreOn(at / view.Zoom);
                ApplyView();
            }
            bubbleText.text = $"<b>{index + 1}.</b> {label}";
            const float w = 340;
            var settings = bubbleText.GetGenerationSettings(new Vector2(w - 28, 0));
            var h = Mathf.Max(48, bubbleText.cachedTextGeneratorForLayout.GetPreferredHeight(bubbleText.text, settings) /
                bubbleText.pixelsPerUnit + 18);
            // beside the pin, on the side with more room, kept inside the picture
            var size = view.PictureSize;
            var x = at.x + (at.x < 0 ? PinSize / 2 + 10 + w / 2 : -(PinSize / 2 + 10 + w / 2));
            x = Mathf.Clamp(x, -size.x / 2 + w / 2 + 4, size.x / 2 - w / 2 - 4);
            var y = Mathf.Clamp(at.y, -size.y / 2 + h / 2 + 4, size.y / 2 - h / 2 - 4);
            UiKit.Place(bubble, new Vector2(0.5f, 0.5f), new Vector2(x, y), new Vector2(w, h));
            bubble.gameObject.SetActive(true);
            bubble.SetAsLastSibling();
        }

        static void Clear(RectTransform parent)
        {
            for (var i = parent.childCount - 1; i >= 0; i--) UnityEngine.Object.Destroy(parent.GetChild(i).gameObject);
        }

        /// <summary>Map coordinates (y down) to a position on the picture (y up, from its centre).</summary>
        Vector2 At(WorldMap map, Vector2 cell)
        {
            var size = view.PictureSize;
            return new Vector2(cell.x / map.Width * size.x - size.x / 2, size.y / 2 - cell.y / map.Height * size.y);
        }

        /// <summary>A round marker with the design-system outline; `anchor` is where in the parent `at` counts from.</summary>
        static void Dot(RectTransform parent, Vector2 at, Color color, float size, Vector2? anchor = null)
        {
            disc ??= UiKit.Circle(32);
            var outline = UiKit.Panel("Dot", parent, UiKit.Outline);
            outline.sprite = disc;
            var a = anchor ?? new Vector2(0.5f, 0.5f);
            UiKit.Place(outline.rectTransform, a, at, new Vector2(size + 8, size + 8));
            var fill = UiKit.Panel("Fill", outline.transform, color);
            fill.sprite = disc;
            UiKit.Place(fill.rectTransform, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(size, size));
        }
    }
}
