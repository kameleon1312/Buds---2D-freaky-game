using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.UI;

namespace Buds.UI
{
    /// <summary>
    /// Builds uGUI from code on the Buds design system (tokens.json): dark asphalt screens, paper windows with a
    /// dark title bar, outlined interactive elements, hard lips instead of soft shadows, outlined Rubik type.
    /// Sizes are the design's 1x values multiplied by <see cref="U"/>.
    /// </summary>
    public static class UiKit
    {
        // ---------- tokens ----------
        public static readonly Color Surface900 = Hex("#16181f");
        public static readonly Color Surface800 = Hex("#23262f");
        public static readonly Color Surface700 = Hex("#363a47");
        public static readonly Color Paper100 = Hex("#f6f2e9");
        public static readonly Color Paper300 = Hex("#e4dccb");
        public static readonly Color Ink = Hex("#1a1a1f");
        public static readonly Color InkSoft = Hex("#55514a");
        public static readonly Color Outline = Hex("#121218");
        public static readonly Color TextOnDark = Color.white;
        public static readonly Color TextOnDarkMuted = Hex("#a9afbd");
        public static readonly Color Buds400 = Hex("#a3e635");
        public static readonly Color Buds600 = Hex("#5d9a12");
        public static readonly Color Gold400 = Hex("#ffc93c");
        public static readonly Color Gold600 = Hex("#d98a0b");
        public static readonly Color Rep400 = Hex("#4cc7ff");
        public static readonly Color Rep600 = Hex("#1b86c9");
        public static readonly Color Alert500 = Hex("#ff3d50");
        public static readonly Color Alert700 = Hex("#bd1c31");
        public static readonly Color XpFill = Hex("#b45cff"); // rarity-epic
        public static readonly Color Common = Hex("#a6b0c3");
        static readonly Color DropPanel = new(10 / 255f, 10 / 255f, 14 / 255f, 0.5f);

        /// <summary>Canvas units per 1x design pixel (reference 720×1280, so ×2; the design's 1080 guide is ×3).</summary>
        public const float U = 2f;
        public const float Stroke = 2 * U;
        public const float RadiusS = 6 * U;
        public const float RadiusM = 12 * U;
        public const float RadiusL = 18 * U;
        public const float Lip = 4 * U;
        public const float Drop = 6 * U;
        public const float Press = 3 * U;

        public enum Tone
        {
            Gold, // the one call to action on a screen
            Buds, // confirm / upgrade
            Rep, // secondary
            Alert, // destructive
        }

        static (Color face, Color lip) Colors(Tone tone) =>
            tone switch
            {
                Tone.Gold => (Gold400, Gold600),
                Tone.Buds => (Buds400, Buds600),
                Tone.Rep => (Rep400, Rep600),
                _ => (Alert500, Alert700),
            };

        // ---------- fonts ----------
        static Font display;
        static Font body;

        // static Rubik instances: legacy Text can't drive a variable font's weight axis
        public static Font Display =>
            display ??= Resources.Load<Font>("Fonts/Rubik-Black") ?? Body;
        public static Font Body =>
            body ??= Resources.Load<Font>("Fonts/Rubik-Bold") ?? Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");

        public static Color Hex(string hex) => ColorUtility.TryParseHtmlString(hex, out var c) ? c : Color.magenta;

        /// <summary>Phone/tablet layout: fixed joystick, bigger UI, closer camera. -buds-mobile simulates it on a PC.</summary>
        public static bool Mobile => Application.isMobilePlatform || Core.CommandLine.Has("-buds-mobile");

        /// <summary>Drops keyboard hints on phones: "Mapa  [M]" → "Mapa".</summary>
        public static string Keys(string label) =>
            Mobile && label != null ? System.Text.RegularExpressions.Regex.Replace(label, @"\s*\[[^\]]+\]", "") : label;

        /// <summary>
        /// Canvas height in UI units (the game is landscape only). Phones get a shorter canvas, so everything is drawn
        /// bigger on their small screens; desktops and tablets keep 720.
        /// </summary>
        public static float CanvasHeight(float screenHeightPx, float dpi, bool mobile)
        {
            if (!mobile) return 720;
            var inches = screenHeightPx / (dpi > 0 ? dpi : 400);
            return inches < 3.2f ? 540 : inches < 4.5f ? 620 : 720;
        }

        // ---------- canvas ----------
        public static Canvas CreateCanvas(string name, int sortOrder)
        {
            var go = new GameObject(name, typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            var canvas = go.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = sortOrder;
            var scaler = go.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            // landscape everywhere: the canvas is a fixed height, its width follows the screen
            var simulated = Mobile && !Application.isMobilePlatform; // -buds-mobile on a PC: a 6" phone
            scaler.referenceResolution = new Vector2(1280,
                CanvasHeight(simulated ? 1080 : Screen.height, simulated ? 420 : Screen.dpi, Mobile));
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 1f;
            scaler.referencePixelsPerUnit = 100;
            EnsureEventSystem();
            return canvas;
        }

        static void EnsureEventSystem()
        {
            if (EventSystem.current) return;
            var es = new GameObject("EventSystem", typeof(EventSystem), typeof(InputSystemUIInputModule));
            UnityEngine.Object.DontDestroyOnLoad(es);
        }

        // ---------- layout helpers ----------
        public static RectTransform Rect(string name, Transform parent)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            return (RectTransform)go.transform;
        }

        public static RectTransform Stretch(RectTransform rt, float inset = 0)
        {
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = new Vector2(inset, inset);
            rt.offsetMax = new Vector2(-inset, -inset);
            return rt;
        }

        /// <summary>Stretch with separate insets (left, bottom, right, top).</summary>
        public static RectTransform Stretch(RectTransform rt, float left, float bottom, float right, float top)
        {
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = new Vector2(left, bottom);
            rt.offsetMax = new Vector2(-right, -top);
            return rt;
        }

        public static void Place(RectTransform rt, Vector2 anchor, Vector2 pos, Vector2 size, Vector2? pivot = null)
        {
            rt.anchorMin = rt.anchorMax = anchor;
            rt.pivot = pivot ?? new Vector2(0.5f, 0.5f);
            rt.sizeDelta = size;
            rt.anchoredPosition = pos;
        }

        // ---------- shapes ----------
        static Sprite white;
        static readonly Dictionary<int, Sprite> rounded = new();

        static Sprite White => white ??= MakeWhite();

        /// <summary>Plain filled rectangle (backgrounds have no outline).</summary>
        public static Image Panel(string name, Transform parent, Color color)
        {
            var img = Rect(name, parent).gameObject.AddComponent<Image>();
            img.sprite = White;
            img.color = color;
            img.raycastTarget = false;
            return img;
        }

        /// <summary>Filled rounded rectangle (9-sliced, so any size keeps crisp corners).</summary>
        public static Image Shape(string name, Transform parent, Color color, float radius)
        {
            var img = Rect(name, parent).gameObject.AddComponent<Image>();
            img.sprite = Rounded(Mathf.Max(1, Mathf.RoundToInt(radius)));
            img.type = Image.Type.Sliced;
            img.color = color;
            img.raycastTarget = false;
            return img;
        }

        /// <summary>Interactive surface: <see cref="Stroke"/> outline around a rounded fill. Returns the fill.</summary>
        public static Image OutlinedBox(string name, Transform parent, Color fill, float radius)
        {
            var outline = Shape(name, parent, Outline, radius);
            var inner = Shape("Fill", outline.transform, fill, radius - Stroke);
            Stretch(inner.rectTransform, Stroke);
            return inner;
        }

        /// <summary>Pill progress bar (xp/hp/energy) with a highlight stripe. Returns the fill to resize.</summary>
        public static RectTransform Bar(string name, Transform parent, Color fill, out RectTransform root)
        {
            var track = OutlinedBox(name, parent, Surface800, 10 * U);
            root = (RectTransform)track.transform.parent;
            var mask = Rect("Mask", track.transform);
            Stretch(mask);
            mask.gameObject.AddComponent<RectMask2D>();
            var f = Shape("Fill", mask, fill, 8 * U).rectTransform;
            f.anchorMin = Vector2.zero;
            f.anchorMax = new Vector2(0, 1);
            f.pivot = new Vector2(0, 0.5f);
            f.offsetMin = Vector2.zero;
            f.offsetMax = Vector2.zero;
            var shine = Shape("Shine", f, new Color(1, 1, 1, 0.35f), 2 * U).rectTransform;
            shine.anchorMin = new Vector2(0, 1);
            shine.anchorMax = new Vector2(1, 1);
            shine.pivot = new Vector2(0.5f, 1);
            shine.offsetMin = new Vector2(4 * U, -7 * U);
            shine.offsetMax = new Vector2(-4 * U, -3 * U);
            return f;
        }

        public static void SetBar(RectTransform fill, float value)
        {
            var track = ((RectTransform)fill.parent).rect.width;
            fill.sizeDelta = new Vector2(Mathf.Clamp01(value) * track, 0);
            fill.gameObject.SetActive(value > 0.001f);
        }

        // ---------- text ----------
        public static Text Label(string name, Transform parent, string text, int size, Color color, bool displayFont = false,
            TextAnchor align = TextAnchor.MiddleCenter)
        {
            var rt = Rect(name, parent);
            var t = rt.gameObject.AddComponent<Text>();
            t.font = displayFont ? Display : Body;
            t.text = text;
            t.fontSize = size;
            t.color = color;
            t.alignment = align;
            t.horizontalOverflow = HorizontalWrapMode.Wrap;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.raycastTarget = false;
            return t;
        }

        /// <summary>Game type: white (or coloured) fill, outline stroke and a hard drop below.</summary>
        public static Text Outlined(string name, Transform parent, string text, int size, Color? color = null,
            TextAnchor align = TextAnchor.MiddleCenter)
        {
            var t = Label(name, parent, text, size, color ?? TextOnDark, true, align);
            var drop = t.gameObject.AddComponent<Shadow>();
            drop.effectColor = Outline;
            drop.effectDistance = new Vector2(0, -2 * U);
            var stroke = t.gameObject.AddComponent<UnityEngine.UI.Outline>();
            stroke.effectColor = Outline;
            stroke.effectDistance = new Vector2(Stroke * 0.75f, Stroke * 0.75f);
            return t;
        }

        // ---------- components ----------

        /// <summary>
        /// Button: coloured face with outline, a lip in the darker tone below, a highlight in the top third and an
        /// outlined label. Presses down 3px. The returned button's GameObject is the layout root.
        /// </summary>
        public static Button Button(string name, Transform parent, string text, Vector2 size, Action onClick,
            Tone tone = Tone.Gold, int fontSize = 40)
        {
            text = Keys(text);
            var (faceColor, lipColor) = Colors(tone);
            var root = Rect(name, parent);
            root.sizeDelta = size;

            var hit = root.gameObject.AddComponent<Image>(); // invisible raycast target covering face + lip
            hit.sprite = White;
            hit.color = Color.clear;

            var lip = Shape("Lip", root, lipColor, RadiusM).rectTransform;
            Stretch(lip, 0, -Lip, 0, Lip);

            var faceFill = OutlinedBox("Face", root, faceColor, RadiusM);
            var face = (RectTransform)faceFill.transform.parent;
            Stretch(face);

            var shine = Shape("Shine", face, new Color(1, 1, 1, 0.28f), RadiusS).rectTransform;
            shine.anchorMin = new Vector2(0, 0.7f);
            shine.anchorMax = Vector2.one;
            shine.offsetMin = new Vector2(6 * U, 0);
            shine.offsetMax = new Vector2(-6 * U, -4 * U);

            var label = Outlined("Label", face, text, fontSize);
            Stretch(label.rectTransform, 0, Stroke * 2, 0, 0);

            var button = root.gameObject.AddComponent<UnityEngine.UI.Button>();
            button.transition = Selectable.Transition.None;
            button.targetGraphic = hit;
            button.onClick.AddListener(() => onClick());

            var press = root.gameObject.AddComponent<PressDown>();
            press.Init(button, face, lip, faceFill, faceColor, lipColor);
            return button;
        }

        /// <summary>Text field on paper: paper-300 fill with outline.</summary>
        public static InputField Input(string name, Transform parent, Vector2 size, string placeholder, int fontSize)
        {
            var fill = OutlinedBox(name, parent, Paper300, RadiusM);
            ((RectTransform)fill.transform.parent).sizeDelta = size;
            var text = Label("Text", fill.transform, "", fontSize, Ink, true);
            Stretch(text.rectTransform, 8 * U);
            text.supportRichText = false;
            var hint = Label("Placeholder", fill.transform, placeholder, fontSize, InkSoft, true);
            hint.color = new Color(InkSoft.r, InkSoft.g, InkSoft.b, 0.45f);
            Stretch(hint.rectTransform, 8 * U);
            fill.raycastTarget = true;
            var field = fill.gameObject.AddComponent<InputField>();
            field.textComponent = text;
            field.placeholder = hint;
            field.targetGraphic = fill;
            field.caretColor = Ink;
            field.customCaretColor = true;
            field.caretWidth = 3;
            return field;
        }

        /// <summary>
        /// Window: paper body with an outline and a hard drop, a dark title bar with an outlined title and an
        /// optional red round close button in the corner. Returns the body content rect; <paramref name="root"/>
        /// is the element to position.
        /// </summary>
        public static RectTransform Window(string name, Transform parent, Vector2 size, string title, Action onClose,
            out RectTransform root, out Text titleText, bool dark = false)
        {
            const float headH = 64 * U * 0.75f; // 48px head at 1x
            root = Rect(name, parent);
            root.sizeDelta = size;

            var drop = Shape("Drop", root, DropPanel, RadiusL).rectTransform;
            Stretch(drop, 0, -Drop, 0, Drop);

            var frame = OutlinedBox("Frame", root, Surface700, RadiusL);
            Stretch((RectTransform)frame.transform.parent);

            // body: paper from below the head line to the bottom; square top edge under the head
            var bodyColor = dark ? Surface800 : Paper100;
            var body = Shape("Body", frame.transform, bodyColor, RadiusL - Stroke).rectTransform;
            Stretch(body, 0, 0, 0, headH);
            var square = Panel("BodyTop", body, bodyColor).rectTransform;
            square.anchorMin = new Vector2(0, 1);
            square.anchorMax = Vector2.one;
            square.pivot = new Vector2(0.5f, 1);
            square.offsetMin = new Vector2(0, -RadiusL);
            square.offsetMax = Vector2.zero;
            var line = Panel("HeadLine", frame.transform, Outline).rectTransform;
            line.anchorMin = new Vector2(0, 1);
            line.anchorMax = Vector2.one;
            line.pivot = new Vector2(0.5f, 1);
            line.offsetMin = new Vector2(0, -headH);
            line.offsetMax = new Vector2(0, -headH + Stroke);

            titleText = Outlined("Title", frame.transform, title, 24 * (int)U);
            var tr = titleText.rectTransform;
            tr.anchorMin = new Vector2(0, 1);
            tr.anchorMax = Vector2.one;
            tr.pivot = new Vector2(0.5f, 1);
            tr.offsetMin = new Vector2(48 * U, -headH + Stroke);
            tr.offsetMax = new Vector2(-48 * U, 0);

            if (onClose != null) CloseButton(root, onClose);

            var content = Rect("Content", body);
            Stretch(content, 16 * U);
            return content;
        }

        /// <summary>Red round close button in a window's top-right corner (inside the title bar, never off screen), with an X.</summary>
        public static Button CloseButton(Transform window, Action onClose)
        {
            var size = 36 * U;
            var root = Rect("Close", window);
            Place(root, Vector2.one, new Vector2(-6 * U, -6 * U), new Vector2(size, size), Vector2.one);
            var hit = root.gameObject.AddComponent<Image>();
            hit.sprite = White;
            hit.color = Color.clear;
            var lip = Shape("Lip", root, Alert700, size / 2).rectTransform;
            Stretch(lip, 0, -Lip, 0, Lip);
            var fill = OutlinedBox("Face", root, Alert500, size / 2);
            var face = (RectTransform)fill.transform.parent;
            Stretch(face);
            // both outlines first, then both white strokes, so the cross has no seam in the middle
            foreach (var (color, inset) in new[] { (Outline, 0f), (TextOnDark, Stroke) })
            foreach (var angle in new[] { 45f, -45f })
            {
                var b = Shape("X", face, color, 2 * U).rectTransform;
                var w = size * 0.55f - 2 * inset;
                Place(b, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(w, 5 * U + 2 * Stroke - 2 * inset));
                b.localRotation = Quaternion.Euler(0, 0, angle);
            }
            var button = root.gameObject.AddComponent<UnityEngine.UI.Button>();
            button.transition = Selectable.Transition.None;
            button.targetGraphic = hit;
            button.onClick.AddListener(() => onClose());
            root.gameObject.AddComponent<PressDown>().Init(button, face, lip, fill, Alert500, Alert700);
            return button;
        }

        /// <summary>Small status pill: dark surface, outline, outlined label (hints, tags).</summary>
        public static Text Pill(string name, Transform parent, string text, Color fill, int fontSize, Vector2 size,
            out RectTransform root)
        {
            var box = OutlinedBox(name, parent, fill, size.y / 2);
            root = (RectTransform)box.transform.parent;
            root.sizeDelta = size;
            var label = Outlined("Label", box.transform, text, fontSize);
            Stretch(label.rectTransform, 12 * U, Stroke, 12 * U, 0);
            return label;
        }

        // ---------- sprites ----------
        static Sprite MakeWhite()
        {
            var tex = new Texture2D(1, 1) { filterMode = FilterMode.Point };
            tex.SetPixel(0, 0, Color.white);
            tex.Apply();
            return Sprite.Create(tex, new UnityEngine.Rect(0, 0, 1, 1), new Vector2(0.5f, 0.5f));
        }

        /// <summary>White rounded-rect sprite with anti-aliased corners and a 9-slice border of the radius.</summary>
        static Sprite Rounded(int radius)
        {
            radius = Mathf.Min(radius, 128); // larger radii (pills) clamp; the slice keeps them round at any height ≤ 256
            if (rounded.TryGetValue(radius, out var cached)) return cached;
            var size = radius * 2 + 2;
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false)
            {
                filterMode = FilterMode.Bilinear,
                wrapMode = TextureWrapMode.Clamp,
            };
            var pixels = new Color32[size * size];
            var half = size / 2f;
            for (var y = 0; y < size; y++)
            for (var x = 0; x < size; x++)
            {
                // signed distance to a rounded rect filling the texture
                var qx = Mathf.Abs(x + 0.5f - half) - (half - radius);
                var qy = Mathf.Abs(y + 0.5f - half) - (half - radius);
                var outside = new Vector2(Mathf.Max(qx, 0), Mathf.Max(qy, 0)).magnitude;
                var d = outside + Mathf.Min(Mathf.Max(qx, qy), 0) - radius;
                var a = Mathf.Clamp01(0.5f - d);
                pixels[y * size + x] = new Color32(255, 255, 255, (byte)(a * 255));
            }
            tex.SetPixels32(pixels);
            tex.Apply();
            var sprite = Sprite.Create(tex, new UnityEngine.Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100, 0,
                SpriteMeshType.FullRect, new Vector4(radius + 1, radius + 1, radius + 1, radius + 1));
            rounded[radius] = sprite;
            return sprite;
        }

        /// <summary>Filled disc sprite for the joystick.</summary>
        public static Sprite Circle(int radius)
        {
            var size = radius * 2;
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear };
            var pixels = new Color32[size * size];
            for (var y = 0; y < size; y++)
            for (var x = 0; x < size; x++)
            {
                var d = Vector2.Distance(new Vector2(x + 0.5f, y + 0.5f), new Vector2(radius, radius));
                var a = Mathf.Clamp01(radius - d);
                pixels[y * size + x] = new Color32(255, 255, 255, (byte)(a * 255));
            }
            tex.SetPixels32(pixels);
            tex.Apply();
            return Sprite.Create(tex, new UnityEngine.Rect(0, 0, size, size), new Vector2(0.5f, 0.5f));
        }
    }

    /// <summary>Design-system press: the face drops 3px onto its lip; disabled buttons turn grey.</summary>
    public sealed class PressDown : MonoBehaviour, IPointerDownHandler, IPointerUpHandler, IPointerExitHandler
    {
        Selectable target;
        RectTransform face;
        RectTransform lip;
        Image fill;
        Image lipImage;
        Color faceColor;
        Color lipColor;
        bool down;
        bool wasInteractable = true;

        public void Init(Selectable selectable, RectTransform faceRect, RectTransform lipRect, Image faceFill, Color faceTone,
            Color lipTone)
        {
            target = selectable;
            face = faceRect;
            lip = lipRect;
            fill = faceFill;
            lipImage = lipRect.GetComponent<Image>();
            faceColor = faceTone;
            lipColor = lipTone;
        }

        public void OnPointerDown(PointerEventData e) => Set(target.interactable);
        public void OnPointerUp(PointerEventData e) => Set(false);
        public void OnPointerExit(PointerEventData e) => Set(false);

        void Set(bool pressed)
        {
            if (down == pressed || !face) return;
            down = pressed;
            var shift = pressed ? UiKit.Press : 0;
            face.offsetMin = new Vector2(0, -shift);
            face.offsetMax = new Vector2(0, -shift);
            lipImage.color = pressed ? UiKit.Outline : lipColor;
            lip.offsetMin = new Vector2(0, pressed ? -UiKit.Press - UiKit.U : -UiKit.Lip);
        }

        void LateUpdate()
        {
            if (!target || target.interactable == wasInteractable) return;
            wasInteractable = target.interactable;
            fill.color = wasInteractable ? faceColor : UiKit.Common;
            lipImage.color = wasInteractable ? lipColor : UiKit.Surface700;
        }
    }

    /// <summary>Scales a fixed-size group down so it always fits its parent (landscape desktop vs portrait phone).</summary>
    /// <summary>Keeps a full-screen rect inside Screen.safeArea (notches and rounded corners in landscape).</summary>
    public sealed class SafeArea : MonoBehaviour
    {
        Rect applied;
        Vector2Int size;

        void Update()
        {
            var area = Screen.safeArea;
            if (area == applied && size.x == Screen.width && size.y == Screen.height) return;
            applied = area;
            size = new Vector2Int(Screen.width, Screen.height);
            var rt = (RectTransform)transform;
            if (Screen.width <= 0 || Screen.height <= 0) return;
            rt.anchorMin = new Vector2(area.xMin / Screen.width, area.yMin / Screen.height);
            rt.anchorMax = new Vector2(area.xMax / Screen.width, area.yMax / Screen.height);
            rt.offsetMin = rt.offsetMax = Vector2.zero;
        }
    }

    public sealed class FitInParent : MonoBehaviour
    {
        void LateUpdate()
        {
            var rt = (RectTransform)transform;
            var parent = ((RectTransform)rt.parent).rect;
            var size = rt.sizeDelta;
            var scale = Mathf.Min(1f, parent.width / size.x, parent.height / size.y);
            rt.localScale = new Vector3(scale, scale, 1);
        }
    }
}
