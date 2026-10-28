using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;

namespace Buds.Characters
{
    /// <summary>
    /// Keyboard (WASD / arrows, Shift to run, E or Space to interact, M for the map) and touch: on phones a fixed
    /// joystick in the bottom-left corner (the fight's buttons are on the right, like a mobile MOBA) (a touch that starts on it steers; pushed to the rim = running; other
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
        readonly StickTracker stick = new();
        readonly List<TouchSample> samples = new(10);

        /// <summary>
        /// Stick push → walking strength for the fixed stick (EditMode-testable): a light push walks slowly, a full
        /// one walks at normal speed. The stick never runs (that was too fast on a phone).
        /// </summary>
        public static (float strength, bool run) FixedStickPush(float distancePx, float radiusPx)
        {
            var t = distancePx / Mathf.Max(1, radiusPx);
            return (Mathf.Lerp(0.4f, 1f, Mathf.InverseLerp(0.15f, 0.75f, t)), false);
        }



        /// <summary>A walk the fight asks for (into reach of the attacked foe): only while the player gives no direction.</summary>
        public Vector2? Assist { get; set; }

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
                samples.Clear();
                foreach (var t in screen.touches)
                    samples.Add(new TouchSample
                    {
                        Id = t.touchId.ReadValue(),
                        Pressed = t.press.isPressed,
                        Began = t.press.wasPressedThisFrame,
                        Position = t.position.ReadValue(),
                        Start = t.startPosition.ReadValue(),
                    });
                // the stick keeps its finger only while that finger is down this frame (StickTracker)
                stick.Step(samples, StickCenter, StickRadius);
                StickActive = stick.Active;
                StickOrigin = StickCenter;
                if (StickActive)
                {
                    var drag = stick.Position - StickCenter;
                    StickPosition = StickCenter + Vector2.ClampMagnitude(drag, StickRadius);
                    var (strength, run) = FixedStickPush(drag.magnitude, StickRadius);
                    if (drag.magnitude > StickRadius * 0.12f)
                    {
                        move = drag.normalized * strength;
                        Run = Run || run;
                    }
                }
                else StickPosition = StickCenter;
            }
            else if (stick.Active) stick.Release();

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
                // a release this frame never saw (a dropped frame): the finger is up, the stick lets go
                else if (StickActive && !touch.press.isPressed)
                {
                    StickActive = false;
                    move = Vector2.zero;
                }
            }

            // the fight walks the bud into reach of the foe it attacks, while the player isn't steering
            if (Assist.HasValue && move.sqrMagnitude < 0.01f) move = Assist.Value;
            // free movement in every direction, like most RPGs (the facing has its own hysteresis in BudMotor)
            if (Override.HasValue) move = Override.Value;
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

        /// <summary>
        /// Everything let go: the app went to the background (a call, the home button) or the bud stopped listening.
        /// Fingers held then are not steering any more when the game comes back.
        /// </summary>
        public void ReleaseAll()
        {
            stick.Release();
            StickActive = false;
            StickPosition = StickOrigin = StickCenter;
            Move = Vector2.zero;
            Run = false;
        }

        /// <summary>Queues an interaction for the next frame (scripted input).</summary>
        public void PressInteract() => pendingInteract = true;
    }
}
