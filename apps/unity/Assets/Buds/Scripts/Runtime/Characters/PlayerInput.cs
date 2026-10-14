using UnityEngine;
using UnityEngine.InputSystem;

namespace Buds.Characters
{
    /// <summary>
    /// Keyboard (WASD / arrows, Shift to run, E or Space to interact, M for the map) and touch: on phones a fixed
    /// joystick in the bottom-right corner (a touch that starts on it steers; pushed to the rim = running; other
    /// fingers stay free for buttons). Without a fixed stick, a floating one: touch anywhere and drag, tap interacts.
    /// </summary>
    public sealed class PlayerInput
    {
        const float DeadZonePx = 12f;
        const float TapMaxPx = 10f;
        /// <summary>Stick drag (share of the screen height) for full walking speed, and for running.</summary>
        public const float WalkDrag = 0.06f;
        public const float RunDrag = 0.12f;

        public Vector2 Move { get; private set; }
        /// <summary>Shift held, or the stick pulled far.</summary>
        public bool Run { get; private set; }
        /// <summary>M: open or close the map.</summary>
        public bool MapPressed { get; private set; }
        public bool InteractPressed { get; private set; }
        /// <summary>Escape / Backspace / Q: decline a dialog choice, close a panel.</summary>
        public bool CancelPressed { get; private set; }
        /// <summary>I / Tab / C: open or close the Bud panel.</summary>
        public bool PanelPressed { get; private set; }
        /// <summary>R: get on or off the ride.</summary>
        public bool RidePressed { get; private set; }
        /// <summary>True when this frame's interaction came from a key (not a screen tap, which may hit a UI button).</summary>
        public bool InteractFromKey { get; private set; }

        /// <summary>Joystick state for drawing (screen pixels); Active false when not touching.</summary>
        public bool StickActive { get; private set; }
        public Vector2 StickOrigin { get; private set; }
        public Vector2 StickPosition { get; private set; }

        /// <summary>Fixed joystick (set by the UI each frame): centre and radius in screen pixels.</summary>
        public bool FixedStick { get; set; }
        public Vector2 StickCenter { get; set; }
        public float StickRadius { get; set; } = 100;
        int stickTouch = -1;

        /// <summary>
        /// Stick push → walking strength for the fixed stick (EditMode-testable): a light push walks slowly, a full
        /// one walks at normal speed. The stick never runs (that was too fast on a phone).
        /// </summary>
        public static (float strength, bool run) FixedStickPush(float distancePx, float radiusPx)
        {
            var t = distancePx / Mathf.Max(1, radiusPx);
            return (Mathf.Lerp(0.4f, 1f, Mathf.InverseLerp(0.15f, 0.75f, t)), false);
        }

        /// <summary>The axis wins by this factor before the direction switches (no flicker on a diagonal push).</summary>
        public const float AxisBias = 1.25f;

        /// <summary>
        /// Classic four-way movement: only up, down, left or right, keeping the push's strength. On a diagonal the
        /// current axis stays until the other one clearly wins.
        /// </summary>
        public static Vector2 FourWay(Vector2 v, bool wasHorizontal)
        {
            var ax = Mathf.Abs(v.x);
            var ay = Mathf.Abs(v.y);
            if (ax < 0.01f && ay < 0.01f) return Vector2.zero;
            var horizontal = wasHorizontal ? ax * AxisBias >= ay : ax > ay * AxisBias;
            var strength = Mathf.Min(1, v.magnitude);
            return horizontal ? new Vector2(Mathf.Sign(v.x) * strength, 0) : new Vector2(0, Mathf.Sign(v.y) * strength);
        }

        bool horizontal;

        /// <summary>Scripted input for automated runs; overrides devices while set.</summary>
        public Vector2? Override { get; set; }

        /// <summary>When true (a dialog is open), movement input is ignored.</summary>
        public bool Blocked { get; set; }

        float maxDrag;
        bool pendingInteract;

        public void Update()
        {
            InteractPressed = pendingInteract;
            InteractFromKey = pendingInteract;
            CancelPressed = false;
            PanelPressed = false;
            MapPressed = false;
            RidePressed = false;
            Run = false;
            pendingInteract = false;
            var move = Vector2.zero;

            var kb = Keyboard.current;
            if (kb != null)
            {
                if (kb.aKey.isPressed || kb.leftArrowKey.isPressed) move.x -= 1;
                if (kb.dKey.isPressed || kb.rightArrowKey.isPressed) move.x += 1;
                if (kb.wKey.isPressed || kb.upArrowKey.isPressed) move.y += 1;
                if (kb.sKey.isPressed || kb.downArrowKey.isPressed) move.y -= 1;
                if (kb.eKey.wasPressedThisFrame || kb.spaceKey.wasPressedThisFrame || kb.enterKey.wasPressedThisFrame)
                    InteractPressed = InteractFromKey = true;
                if (kb.escapeKey.wasPressedThisFrame || kb.backspaceKey.wasPressedThisFrame || kb.qKey.wasPressedThisFrame)
                    CancelPressed = true;
                if (kb.iKey.wasPressedThisFrame || kb.tabKey.wasPressedThisFrame || kb.cKey.wasPressedThisFrame)
                    PanelPressed = true;
                if (kb.mKey.wasPressedThisFrame) MapPressed = true;
                if (kb.rKey.wasPressedThisFrame) RidePressed = true;
                Run = kb.leftShiftKey.isPressed || kb.rightShiftKey.isPressed;
            }

            var screen = Touchscreen.current;
            if (screen != null && FixedStick)
            {
                foreach (var t in screen.touches)
                {
                    var id = t.touchId.ReadValue();
                    var pos = t.position.ReadValue();
                    // a finger that lands on the stick (or close to it) takes it over
                    if (stickTouch < 0 && t.press.wasPressedThisFrame && Vector2.Distance(pos, StickCenter) <= StickRadius * 1.5f)
                        stickTouch = id;
                    if (id != stickTouch) continue;
                    if (!t.press.isPressed)
                    {
                        stickTouch = -1;
                        continue;
                    }
                    var drag = pos - StickCenter;
                    StickOrigin = StickCenter;
                    StickPosition = StickCenter + Vector2.ClampMagnitude(drag, StickRadius);
                    var (strength, run) = FixedStickPush(drag.magnitude, StickRadius);
                    if (drag.magnitude > StickRadius * 0.12f)
                    {
                        move = drag.normalized * strength;
                        Run = Run || run;
                    }
                }
                StickActive = stickTouch >= 0;
                if (!StickActive) StickPosition = StickOrigin = StickCenter;
            }

            var touch = screen?.primaryTouch;
            if (touch != null && !FixedStick)
            {
                if (touch.press.wasPressedThisFrame)
                {
                    StickActive = true;
                    StickOrigin = touch.position.ReadValue();
                    maxDrag = 0;
                }
                if (StickActive)
                {
                    StickPosition = touch.position.ReadValue();
                    var drag = StickPosition - StickOrigin;
                    maxDrag = Mathf.Max(maxDrag, drag.magnitude);
                    if (drag.magnitude > DeadZonePx)
                    {
                        move = drag.normalized * StickStrength(drag.magnitude, Screen.height);
                        Run = drag.magnitude >= RunDrag * Screen.height;
                    }
                }
                if (touch.press.wasReleasedThisFrame && StickActive)
                {
                    if (maxDrag < TapMaxPx) InteractPressed = true;
                    StickActive = false;
                }
            }

            // up, down, left, right only (scripted runs steer the same way)
            if (Override.HasValue) move = Override.Value;
            move = FourWay(move, horizontal);
            if (move.sqrMagnitude > 0) horizontal = move.x != 0;
            if (OverrideRun) Run = true;
            if (Blocked)
            {
                move = Vector2.zero;
                Run = false;
            }
            Move = move.sqrMagnitude > 1 ? move.normalized : move;
        }

        /// <summary>Scripted running for automated runs.</summary>
        public bool OverrideRun { get; set; }

        /// <summary>How hard the stick is pushed (0.35..1) for a drag of <paramref name="px"/> pixels.</summary>
        public static float StickStrength(float px, float screenHeight)
        {
            var full = WalkDrag * screenHeight;
            return Mathf.Lerp(0.35f, 1f, Mathf.InverseLerp(DeadZonePx, Mathf.Max(DeadZonePx + 1, full), px));
        }

        /// <summary>Queues an interaction for the next frame (scripted input).</summary>
        public void PressInteract() => pendingInteract = true;
    }
}
