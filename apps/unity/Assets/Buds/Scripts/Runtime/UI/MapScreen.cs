using System;
using System.Collections.Generic;
using Buds.World;
using UnityEngine;
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
    /// yet, with the bud, doors, roads out, place names and quest targets, plus how much is explored and how many
    /// hidden caches were found.
    /// </summary>
    public sealed class MapScreen
    {
        const float MapW = 760;
        const float MapH = 570;
        static Sprite disc;

        readonly GameObject root;
        readonly Text title;
        readonly RawImage picture;
        readonly RectTransform markers;
        readonly Text stats;
        Texture2D texture;

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

            // the map in a dark frame
            var frame = UiKit.OutlinedBox("Frame", body, UiKit.Surface900, UiKit.RadiusM);
            var frameRt = (RectTransform)frame.transform.parent;
            UiKit.Place(frameRt, new Vector2(0, 1), Vector2.zero, new Vector2(MapW + 16, MapH + 16), new Vector2(0, 1));
            picture = new GameObject("Picture", typeof(RectTransform)).AddComponent<RawImage>();
            picture.transform.SetParent(frame.transform, false);
            picture.raycastTarget = false;
            UiKit.Place(picture.rectTransform, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(MapW, MapH));
            markers = UiKit.Rect("Markers", picture.transform);
            UiKit.Stretch(markers);

            // side column: stats and the legend
            var side = UiKit.Rect("Side", body);
            side.anchorMin = new Vector2(0, 0);
            side.anchorMax = new Vector2(1, 1);
            side.offsetMin = new Vector2(MapW + 40, 0);
            side.offsetMax = Vector2.zero;
            stats = UiKit.Label("Stats", side, "", 28, UiKit.Ink, false, TextAnchor.UpperLeft);
            UiKit.Stretch(stats.rectTransform, 0, 264, 0, 0);
            stats.lineSpacing = 1.15f;

            var legend = UiKit.Rect("Legend", side);
            legend.anchorMin = Vector2.zero;
            legend.anchorMax = new Vector2(1, 0);
            legend.pivot = new Vector2(0, 0);
            legend.sizeDelta = new Vector2(0, 210);
            legend.anchoredPosition = new Vector2(0, 44); // above the "close" line
            (string, Color, float)[] keys =
            {
                ("Ty", UiKit.Buds400, 26),
                ("Cel zadania", UiKit.Gold400, 20),
                ("Drzwi", UiKit.Paper100, 16),
                ("Znaleziona skrytka", UiKit.Rep400, 16),
            };
            for (var i = 0; i < keys.Length; i++)
            {
                var (label, color, size) = keys[i];
                var y = 180 - i * 48;
                Dot(legend, new Vector2(22, y), color, size);
                var t = UiKit.Label("Key", legend, label, 24, UiKit.InkSoft, false, TextAnchor.MiddleLeft);
                UiKit.Place(t.rectTransform, Vector2.zero, new Vector2(52, y - 20), new Vector2(240, 40), Vector2.zero);
            }

            var close = UiKit.Label("Close", side, "M lub Esc: zamknij", 22, UiKit.InkSoft, false, TextAnchor.LowerLeft);
            UiKit.Stretch(close.rectTransform, 0, -4, 0, 0);
            close.alignment = TextAnchor.LowerRight;
            root.SetActive(false);
        }

        public void Show(MapScreenData data)
        {
            var map = data.Map;
            var district = Districts.Get(map.Id);
            title.text = "Mapa · " + (district?.Name ?? map.Name);

            if (texture) UnityEngine.Object.Destroy(texture);
            texture = new Texture2D(map.Width, map.Height, TextureFormat.RGBA32, false)
            {
                filterMode = FilterMode.Point,
                wrapMode = TextureWrapMode.Clamp,
            };
            texture.SetPixels32(MapPicture.Pixels(map, data.Fog));
            texture.Apply();
            picture.texture = texture;
            // keep the map's proportions inside the frame
            var scale = Mathf.Min(MapW / map.Width, MapH / map.Height);
            picture.rectTransform.sizeDelta = new Vector2(map.Width * scale, map.Height * scale);

            for (var i = markers.childCount - 1; i >= 0; i--) UnityEngine.Object.Destroy(markers.GetChild(i).gameObject);
            bool Seen(int x, int y) => data.Fog == null || data.Fog.IsSeen(x, y);

            // place names: small zones at their centre, zones holding others along their top edge
            foreach (var z in map.Zones)
            {
                var parent = map.Zones.Exists(o => o != z && o.Area < z.Area && z.Contains(o.X0, o.Y0) && z.Contains(o.X1, o.Y1));
                var cx = (z.X0 + z.X1 + 1) / 2f;
                var cy = parent ? z.Y0 + 1.5f : (z.Y0 + z.Y1 + 1) / 2f;
                if (!Seen((int)cx, (int)cy)) continue;
                Name(map, new Vector2(cx, cy), z.Name, parent ? 20 : 22);
            }
            foreach (var e in map.Exits)
            {
                var name = Districts.Get(e.DistrictId)?.Name ?? e.DistrictId;
                var at = new Vector2((e.X0 + e.X1 + 1) / 2f, (e.Y0 + e.Y1 + 1) / 2f);
                // pull the label inside the frame
                at.x = Mathf.Clamp(at.x, 12, map.Width - 12);
                at.y = Mathf.Clamp(at.y, 3, map.Height - 3);
                Name(map, at, "Do: " + name, 20, UiKit.Gold400);
            }
            foreach (var d in map.Doors)
                if (Seen(d.X, d.Y)) Dot(markers, At(map, new Vector2(d.X + 0.5f, d.Y + 0.5f)), UiKit.Paper100, 16);
            foreach (var c in data.FoundCaches) Dot(markers, At(map, c + new Vector2(0.5f, 0.5f)), UiKit.Rep400, 16);
            foreach (var (cell, _) in data.Targets) Dot(markers, At(map, cell), UiKit.Gold400, 20);
            Dot(markers, At(map, data.Player), UiKit.Buds400, 26);

            var explored = data.Fog != null ? Mathf.RoundToInt(data.Fog.Explored(map) * 100) : 100;
            var sb = new System.Text.StringBuilder();
            sb.Append("<b>Odkryto:</b> ").Append(explored).Append("%\n");
            sb.Append("<b>Skrytki:</b> ").Append(data.CachesFound).Append(" / ").Append(data.CachesTotal).Append('\n');
            sb.Append("<color=#55514a>Skrytki są niewidoczne, dopóki nie podejdziesz blisko. Spryt pomaga je wypatrzyć.</color>");
            if (data.Targets.Count > 0)
            {
                sb.Append("\n\n<b>Cele:</b>");
                foreach (var (_, label) in data.Targets) sb.Append("\n· ").Append(label);
            }
            stats.text = sb.ToString();
            root.SetActive(true);
            root.transform.SetAsLastSibling();
        }

        public void Hide() => root.SetActive(false);

        /// <summary>Map coordinates (y down) to a position on the picture (y up, from its centre).</summary>
        Vector2 At(WorldMap map, Vector2 cell)
        {
            var size = picture.rectTransform.sizeDelta;
            return new Vector2(cell.x / map.Width * size.x - size.x / 2, size.y / 2 - cell.y / map.Height * size.y);
        }

        void Name(WorldMap map, Vector2 cell, string text, int size, Color? color = null)
        {
            var t = UiKit.Outlined("Name", markers, text, size, color);
            UiKit.Place(t.rectTransform, new Vector2(0.5f, 0.5f), At(map, cell), new Vector2(260, 40));
        }

        /// <summary>A round marker with the design-system outline.</summary>
        static void Dot(RectTransform parent, Vector2 at, Color color, float size)
        {
            disc ??= UiKit.Circle(32);
            var outline = UiKit.Panel("Dot", parent, UiKit.Outline);
            outline.sprite = disc;
            UiKit.Place(outline.rectTransform, new Vector2(0.5f, 0.5f), at, new Vector2(size + 8, size + 8));
            if (parent.name == "Legend")
            {
                outline.rectTransform.anchorMin = outline.rectTransform.anchorMax = Vector2.zero;
                outline.rectTransform.anchoredPosition = at;
            }
            var fill = UiKit.Panel("Fill", outline.transform, color);
            fill.sprite = disc;
            UiKit.Place(fill.rectTransform, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(size, size));
        }
    }
}
