using System;
using Buds.Combat;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Buds.UI
{
    /// <summary>
    /// The fight's buttons, like a mobile MOBA (docs/walka.md): the basic attack big in the bottom-right corner, the two
    /// abilities, the guard and the ultimate in an even arc around it. They are the design system's raised buttons
    /// (an ink ring, a face, a hard lip below, a highlight on top), never the flat translucent disc of the stick.
    ///
    /// Out of a fight nothing shows; with a foe close only the basic attack comes up; once the fight is on the arc
    /// unfolds around it, one button after another, and folds away a while after the last blow.
    ///
    /// A tap fires at the nearest foe; pressing and dragging aims (the reach shows on the ground) and letting go
    /// fires; dragging onto "Anuluj" calls it off. Holding the basic attack keeps attacking. Cooldowns darken a
    /// button like a clock and count down; a button coming back flashes; gold pips show its upgrades. On a computer
    /// the keys sit on the rims (LPM, 1–4). Several fingers at once: the stick on the left, the buttons here.
    /// </summary>
    public sealed class CombatPad
    {
        public enum Mode { Hidden, Ready, Full }

        /// <summary>A button was pressed and is being aimed (−1…1 pull, the button's drag radius = 1).</summary>
        public event Action<int, Vector2> Aiming;
        /// <summary>Let go: fire (true = a tap: the auto-aim picks the target).</summary>
        public event Action<int, Vector2, bool> Fire;
        /// <summary>Let go over "Anuluj", or the finger was lost: nothing fires.</summary>
        public event Action<int> Cancelled;

        /// <summary>How far a finger drags for a full aim (UI units).</summary>
        public const float DragRadius = 120;

        /// <summary>
        /// Where the buttons sit, from the basic attack's centre (UI units, before the computer's smaller scale): an
        /// even arc from the left round to the top, the ultimate further out between the first two.
        /// </summary>
        public static readonly (float angle, float distance, float size)[] Layout =
        {
            (0, 0, 148),
            (186, 138, 92),
            (141, 140, 92),
            (96, 138, 84),
            (164, 244, 100),
        };

        /// <summary>The basic attack's centre from the bottom-right corner.</summary>
        static readonly Vector2 Corner = new(-130, 124);

        sealed class Slot
        {
            public RectTransform Root;
            public RectTransform Body;
            public CanvasGroup Group;
            public Image Face;
            public Image Icon;
            public Image Clock;
            public Text Seconds;
            public Text Lock;
            public Image[] Pips;
            public Image Flash;
            public string IconName = "";
            public int Rank = -1;
            public float ReadyFlashAt = -99;
            public bool WasCooling;
            public float Shown; // 0 folded … 1 out
            public Color FaceColor;
        }

        readonly RectTransform root;
        readonly Slot[] slots = new Slot[BrawlSelf.Slots];
        readonly RectTransform cancel;
        readonly Image cancelFace;
        readonly bool mobile;
        readonly float scale;
        Mode mode = Mode.Hidden;
        float modeAt;

        int held = -1;
        int heldPointer = -1;
        Vector2 heldStart;
        Vector2 pull;
        bool overCancel;
        float heldSince;

        public bool BasicHeld => held == BrawlSelf.Basic;
        public int Held => held;
        public Vector2 Pull => pull;
        public bool OverCancel => overCancel;
        public bool Holding => held >= 0;
        public float HeldFor => held >= 0 ? Time.unscaledTime - heldSince : 0;
        public Mode Current => mode;
        public bool Visible => mode != Mode.Hidden || AnyShown();

        public CombatPad(Transform safeRoot, bool mobile)
        {
            this.mobile = mobile;
            scale = mobile ? 1f : 0.8f;
            root = UiKit.Rect("Fight pad", safeRoot);
            UiKit.Stretch(root);
            for (var i = 0; i < slots.Length; i++) slots[i] = Build(i);

            // where a held aim is called off: over the arc, clear of every button
            cancel = UiKit.Rect("Anuluj", root);
            UiKit.Place(cancel, new Vector2(1, 0), (Corner + new Vector2(-120, 340)) * scale, new Vector2(150, 54), new Vector2(0.5f, 0.5f));
            cancelFace = UiKit.OutlinedBox("Face", cancel, UiKit.Surface800, 27);
            UiKit.Stretch((RectTransform)cancelFace.transform.parent);
            var label = UiKit.Outlined("Text", cancelFace.transform, "Anuluj", 22);
            UiKit.Stretch(label.rectTransform);
            cancel.gameObject.SetActive(false);
        }

        /// <summary>Where a button's centre sits from the bottom-right corner (UI units).</summary>
        public static Vector2 PositionOf(int index, float scale)
        {
            var (angle, distance, _) = Layout[index];
            var a = angle * Mathf.Deg2Rad;
            return (Corner + new Vector2(Mathf.Cos(a), Mathf.Sin(a)) * distance) * scale;
        }

        Slot Build(int index)
        {
            var size = Layout[index].size * scale;
            var basic = index == BrawlSelf.Basic;
            var ult = index == BrawlSelf.Ultimate;
            var r = UiKit.Rect("Slot " + index, root);
            UiKit.Place(r, new Vector2(1, 0), PositionOf(index, scale), new Vector2(size, size));
            var group = r.gameObject.AddComponent<CanvasGroup>();
            var body = UiKit.Rect("Body", r);
            UiKit.Stretch(body);

            // raised like every button of the game: a hard lip below, an even ink ring, the face, a highlight
            var lipColor = basic ? UiKit.Buds600 : ult ? UiKit.Gold600 : UiKit.Outline;
            var faceColor = basic ? UiKit.Buds400 : UiKit.Surface800;
            var ringColor = ult ? UiKit.Gold400 : UiKit.Outline;
            var lip = Disc("Lip", body, lipColor);
            UiKit.Stretch(lip.rectTransform, 0, -UiKit.Lip, 0, UiKit.Lip);
            var lipRing = Disc("Lip ring", lip.transform, UiKit.Outline, 0.06f);
            UiKit.Stretch(lipRing.rectTransform);
            var ring = Disc("Ring", body, ringColor);
            UiKit.Stretch(ring.rectTransform);
            if (ult)
            {
                // the ultimate's gold rim has an ink edge outside too
                var edge = Disc("Edge", body, UiKit.Outline, 0.05f);
                UiKit.Stretch(edge.rectTransform);
            }
            var face = Disc("Face", body, faceColor);
            UiKit.Stretch(face.rectTransform, ult ? size * 0.085f : size * 0.055f);
            face.raycastTarget = true;
            var shine = Disc("Shine", face.transform, new Color(1, 1, 1, basic ? 0.3f : 0.08f));
            shine.rectTransform.anchorMin = new Vector2(0.2f, 0.58f);
            shine.rectTransform.anchorMax = new Vector2(0.8f, 0.93f);
            shine.rectTransform.offsetMin = shine.rectTransform.offsetMax = Vector2.zero;

            var icon = UiKit.Rect("Icon", face.transform).gameObject.AddComponent<Image>();
            icon.preserveAspect = true;
            icon.raycastTarget = false;
            icon.enabled = false; // no ability known yet: no white square
            UiKit.Stretch(icon.rectTransform, size * (basic ? 0.17f : 0.15f));

            var clock = Disc("Cooldown", face.transform, new Color(0.04f, 0.045f, 0.06f, 0.72f));
            clock.type = Image.Type.Filled;
            clock.fillMethod = Image.FillMethod.Radial360;
            clock.fillOrigin = (int)Image.Origin360.Top;
            clock.fillClockwise = false;
            clock.fillAmount = 0;
            UiKit.Stretch(clock.rectTransform);
            var seconds = UiKit.Outlined("Seconds", face.transform, "", Mathf.RoundToInt(size * 0.32f));
            UiKit.Stretch(seconds.rectTransform);
            var lockText = UiKit.Outlined("Lock", face.transform, "", Mathf.RoundToInt(size * 0.19f), UiKit.Gold400);
            UiKit.Stretch(lockText.rectTransform, 2);
            lockText.horizontalOverflow = HorizontalWrapMode.Overflow;
            lockText.lineSpacing = 0.9f;

            // upgrades bought: up to three small gold pips along the bottom of the face, each with an ink edge
            var pips = new Image[3];
            for (var k = 0; k < 3; k++)
            {
                var pip = Disc("Pip", face.transform, UiKit.Outline);
                var pr = pip.rectTransform;
                pr.anchorMin = pr.anchorMax = new Vector2(0.5f, 0);
                pr.sizeDelta = Vector2.one * Mathf.Max(10, size * 0.12f);
                pr.anchoredPosition = new Vector2((k - 1) * size * 0.14f, size * 0.14f);
                var gold = Disc("Gold", pip.transform, UiKit.Gold400);
                UiKit.Stretch(gold.rectTransform, 2);
                pips[k] = pip;
            }

            // a press that came back: a lime ring flashing round the button
            var flash = Disc("Ready", body, UiKit.Buds400, 0.08f);
            UiKit.Stretch(flash.rectTransform, -4);
            flash.color = new Color(1, 1, 1, 0);

            if (!mobile)
            {
                // the key on the rim: a small ink badge at the top-left
                var badge = Disc("Key", body, UiKit.Outline);
                var br = badge.rectTransform;
                br.anchorMin = br.anchorMax = new Vector2(0.14f, 0.86f);
                br.sizeDelta = Vector2.one * (basic ? 40 : 30) * scale * 1.15f;
                var key = UiKit.Label("Text", badge.transform, basic ? "LPM" : index.ToString(), basic ? 12 : 16, UiKit.TextOnDark, true);
                UiKit.Stretch(key.rectTransform);
            }

            var hit = face.gameObject.AddComponent<PadButton>();
            hit.Pad = this;
            hit.Index = index;
            group.alpha = 0;
            group.blocksRaycasts = false;
            return new Slot
            {
                Root = r, Body = body, Group = group, Face = face, Icon = icon, Clock = clock, Seconds = seconds, Lock = lockText,
                Pips = pips, Flash = flash, FaceColor = faceColor,
            };
        }

        /// <summary>
        /// A smooth disc sized by its rect, or a ring <paramref name="ring"/> of the radius thick (the ring sprite: the
        /// line is even all the way round).
        /// </summary>
        static Image Disc(string name, Transform parent, Color color, float ring = 0)
        {
            var img = UiKit.Rect(name, parent).gameObject.AddComponent<Image>();
            const int radius = 96;
            img.sprite = ring > 0 ? UiKit.Ring(radius, radius * ring) : UiKit.Circle(radius);
            img.color = color;
            img.raycastTarget = false;
            return img;
        }

        /// <summary>
        /// What shows: nothing, the basic attack alone (a foe close), or everything (in a fight). The change is
        /// animated: the buttons unfold one after another from the basic attack and fold back into it.
        /// </summary>
        public void SetMode(Mode next)
        {
            if (next == mode) return;
            mode = next;
            modeAt = Time.unscaledTime;
            if (mode != Mode.Full) Release(false);
        }

        public void SetVisible(bool visible)
        {
            if (!visible) SetMode(Mode.Hidden);
        }

        bool AnyShown()
        {
            foreach (var s in slots)
                if (s.Shown > 0.001f)
                    return true;
            return false;
        }

        /// <summary>Buttons as the bud's kit and cooldowns stand now (every frame).</summary>
        public void Tick(BrawlSelf self, float now)
        {
            var t = Time.unscaledTime;
            for (var i = 0; i < slots.Length; i++)
            {
                var s = slots[i];
                var e = self.Kit[i];
                var locked = e == null;
                // shown or folded: the basic attack first and last, the arc unfolding after it
                var wanted = mode == Mode.Full || (mode == Mode.Ready && i == BrawlSelf.Basic) ? 1f : 0f;
                var delay = mode == Mode.Full ? i * 0.045f : 0;
                if (t - modeAt >= delay || wanted < s.Shown)
                    s.Shown = Mathf.MoveTowards(s.Shown, wanted, Time.unscaledDeltaTime * (wanted > s.Shown ? 6.5f : 9f));
                var k = Ease(s.Shown);
                s.Group.alpha = k;
                s.Group.blocksRaycasts = k > 0.6f;
                // out from the basic attack's centre, landing with a small bounce
                s.Root.anchoredPosition = Vector2.LerpUnclamped(PositionOf(BrawlSelf.Basic, scale), PositionOf(i, scale), Back(s.Shown));
                s.Root.localScale = Vector3.one * Mathf.Lerp(0.55f, 1, k);
                if (k <= 0.001f) continue;

                var iconName = locked ? null : e.icon;
                if (iconName != s.IconName)
                {
                    s.IconName = iconName;
                    s.Icon.sprite = iconName == null ? null : UiKit.Picture("Abilities/" + iconName);
                    s.Icon.enabled = s.Icon.sprite;
                }
                var lockLine = locked && i == BrawlSelf.Ultimate ? "od\npoz. 5" : "";
                if (s.Lock.text != lockLine) s.Lock.text = lockLine;
                var rank = locked ? 0 : e.rank;
                if (rank != s.Rank)
                {
                    s.Rank = rank;
                    for (var p = 0; p < s.Pips.Length; p++) s.Pips[p].gameObject.SetActive(p < rank);
                }

                var left = locked ? 0 : self.CooldownLeft(i, now);
                var share = locked ? 0 : self.CooldownShare(i, now);
                var holding = self.Down(now) || self.Stunned(now);
                s.Clock.fillAmount = locked ? 0 : holding ? 1 : share;
                s.Seconds.text = !locked && left > 0.25f && i != BrawlSelf.Basic
                    ? left >= 10 ? Mathf.CeilToInt(left).ToString() : left.ToString("0.0")
                    : "";
                var cooling = left > 0.05f;
                if (s.WasCooling && !cooling) s.ReadyFlashAt = t;
                s.WasCooling = cooling;
                s.Icon.color = locked ? new Color(1, 1, 1, 0.25f) : cooling || holding ? new Color(0.62f, 0.63f, 0.68f, 1) : Color.white;
                // back from the cooldown: a lime ring that swells and fades
                var f = Mathf.Clamp01((t - s.ReadyFlashAt) / 0.4f);
                s.Flash.color = new Color(1, 1, 1, f < 1 ? (1 - f) * 0.9f : 0);
                s.Flash.rectTransform.localScale = Vector3.one * (1 + f * 0.12f);
                // pressed and held: the face sinks onto its lip and lightens
                var pressed = held == i;
                s.Body.anchoredPosition = pressed ? new Vector2(0, -UiKit.Press) : Vector2.zero;
                s.Face.color = pressed ? Color.Lerp(s.FaceColor, Color.white, 0.12f)
                    : locked && i != BrawlSelf.Basic ? Color.Lerp(s.FaceColor, UiKit.Surface900, 0.4f)
                    : s.FaceColor;
            }
            if (held >= 0)
            {
                var showCancel = held != BrawlSelf.Basic && HeldFor > 0.12f;
                if (cancel.gameObject.activeSelf != showCancel) cancel.gameObject.SetActive(showCancel);
                cancelFace.color = overCancel ? UiKit.Alert500 : UiKit.Surface800;
            }
            else if (cancel.gameObject.activeSelf) cancel.gameObject.SetActive(false);
        }

        static float Ease(float x) => 1 - (1 - x) * (1 - x) * (1 - x);

        /// <summary>Ease-out with a small overshoot: the buttons land in place with a bounce.</summary>
        static float Back(float x)
        {
            const float c = 1.4f;
            var y = x - 1;
            return 1 + (c + 1) * y * y * y + c * y * y;
        }

        // ---------- fingers ----------

        internal void Down(int index, PointerEventData e)
        {
            if (held >= 0) return; // one aim at a time; the other fingers steer
            held = index;
            heldPointer = e.pointerId;
            heldStart = e.position;
            heldSince = Time.unscaledTime;
            pull = Vector2.zero;
            overCancel = false;
            Aiming?.Invoke(index, pull);
        }

        internal void Drag(int index, PointerEventData e)
        {
            if (held != index || e.pointerId != heldPointer) return;
            var s = root.lossyScale.x > 0 ? root.lossyScale.x : 1;
            pull = Vector2.ClampMagnitude((e.position - heldStart) / (DragRadius * s), 1.25f);
            overCancel = cancel.gameObject.activeSelf && RectTransformUtility.RectangleContainsScreenPoint(cancel, e.position, null);
            Aiming?.Invoke(index, pull);
        }

        internal void Up(int index, PointerEventData e)
        {
            if (held != index || e.pointerId != heldPointer) return;
            Release(true);
        }

        /// <summary>The held button lets go: fires, or is called off over "Anuluj" (or when <paramref name="fire"/> is false).</summary>
        public void Release(bool fire)
        {
            if (held < 0) return;
            var index = held;
            var tap = pull.magnitude < BrawlAim.TapDrag;
            held = -1;
            heldPointer = -1;
            if (!fire || overCancel) Cancelled?.Invoke(index);
            else Fire?.Invoke(index, pull, tap);
            overCancel = false;
            pull = Vector2.zero;
            cancel.gameObject.SetActive(false);
        }

        /// <summary>The middle of a button on the screen (pixels), for the autopilot's taps.</summary>
        public Vector2 ScreenCenter(int index) =>
            RectTransformUtility.WorldToScreenPoint(null, slots[index].Face.rectTransform.TransformPoint(slots[index].Face.rectTransform.rect.center));

        /// <summary>Is a screen point on one of the buttons showing (a click there is not a click in the world)?</summary>
        public bool Covers(Vector2 screen)
        {
            foreach (var s in slots)
                if (s.Shown > 0.6f && RectTransformUtility.RectangleContainsScreenPoint(s.Root, screen, null)) return true;
            return false;
        }
    }

    /// <summary>One button's finger: down, drag, up (multi-touch through the EventSystem's pointer ids).</summary>
    public sealed class PadButton : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler, IInitializePotentialDragHandler
    {
        internal CombatPad Pad;
        internal int Index;

        public void OnPointerDown(PointerEventData e) => Pad?.Down(Index, e);
        public void OnDrag(PointerEventData e) => Pad?.Drag(Index, e);
        public void OnPointerUp(PointerEventData e) => Pad?.Up(Index, e);
        // aiming starts at the first pixel: no drag threshold
        public void OnInitializePotentialDrag(PointerEventData e) => e.useDragThreshold = false;
    }
}
