using UnityEngine;
using UnityEngine.InputSystem;

namespace Buds.Characters
{
    /// <summary>
    /// Keyboard (WASD / arrows, E or Space to interact) and a floating touch joystick:
    /// touch anywhere and drag to walk; a quick tap interacts.
    /// </summary>
    public sealed class PlayerInput
    {
        const float DeadZonePx = 12f;
        const float TapMaxPx = 10f;

        public Vector2 Move { get; private set; }
        public bool InteractPressed { get; private set; }

        /// <summary>Joystick state for drawing (screen pixels); Active false when not touching.</summary>
        public bool StickActive { get; private set; }
        public Vector2 StickOrigin { get; private set; }
        public Vector2 StickPosition { get; private set; }

        /// <summary>Scripted input for automated runs; overrides devices while set.</summary>
        public Vector2? Override { get; set; }

        /// <summary>When true (a dialog is open), movement input is ignored.</summary>
        public bool Blocked { get; set; }

        float maxDrag;
        bool pendingInteract;

        public void Update()
        {
            InteractPressed = pendingInteract;
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
                    InteractPressed = true;
            }

            var touch = Touchscreen.current?.primaryTouch;
            if (touch != null)
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
                    if (drag.magnitude > DeadZonePx) move = drag.normalized;
                }
                if (touch.press.wasReleasedThisFrame && StickActive)
                {
                    if (maxDrag < TapMaxPx) InteractPressed = true;
                    StickActive = false;
                }
            }

            if (Override.HasValue) move = Override.Value;
            if (Blocked) move = Vector2.zero;
            Move = move.sqrMagnitude > 1 ? move.normalized : move;
        }

        /// <summary>Queues an interaction for the next frame (scripted input).</summary>
        public void PressInteract() => pendingInteract = true;
    }
}
