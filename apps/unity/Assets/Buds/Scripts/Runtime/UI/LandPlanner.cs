using System;
using Buds.Core;
using Buds.Quests;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace Buds.UI
{
    /// <summary>
    /// Placing a building, in the game's own world: the camera rises over the plot and stays there, the HUD gives way, and
    /// the building stands on the ground where it would be. It is dragged with a finger or the mouse (or nudged with the
    /// arrows), always snapped to the cells, turned in quarter turns (R), and "Dopasuj" takes it to the nearest spot where
    /// it fits exactly. Every cell under it says whether it fits; small dots on the ground mark where it would, as turned
    /// now; the cell in front of its door stays free. Nothing is paid until "Postaw". The server checks it all again.
    /// </summary>
    public sealed class LandPlanner
    {
        const float PanelW = 310;
        /// <summary>How far from straight overhead the camera looks while building (degrees).</summary>
        const float BuildTilt = 22;
        static readonly string[] DoorNames = { "południe", "zachód", "północ", "wschód" };

        readonly GameObject root;
        readonly Text title;
        readonly Text about;
        readonly Text status;
        readonly Button confirm;
        readonly Image confirmFace;
        Land land;
        BuildingData kind;
        DistrictsWorld view;
        FollowCamera cam;
        int level;
        int rot;
        Vector2Int centre;
        Vector2Int grab;
        string problem;
        int dotsFor = -1;
        Action<Vector2Int, int> done;
        Action back;
        Action closed;

        public bool IsOpen => root.activeSelf;
        public int Rot => rot;
        public Vector2Int Anchor => Land.AnchorForCentre(kind, centre, rot);
        public string Problem => problem;

        /// <summary>The share of the screen's width the side panel takes (the view centres the plot in the rest).</summary>
        static float PanelShare(RectTransform canvas) => PanelW / Mathf.Max(1, canvas.rect.width);

        public LandPlanner(Transform hudRoot)
        {
            var whole = UiKit.Rect("LandPlanner", hudRoot);
            UiKit.Stretch(whole);
            root = whole.gameObject;

            // everything outside the panel is the world: presses and drags there move the building
            var surface = whole.gameObject.AddComponent<Image>();
            surface.color = Color.clear;
            surface.raycastTarget = true;
            whole.gameObject.AddComponent<WorldSurface>().Planner = this;

            var box = UiKit.OutlinedBox("Side", whole, UiKit.Paper100, UiKit.RadiusM);
            var boxRt = (RectTransform)box.transform.parent;
            boxRt.anchorMin = new Vector2(1, 0);
            boxRt.anchorMax = new Vector2(1, 1);
            boxRt.pivot = new Vector2(1, 0.5f);
            boxRt.sizeDelta = new Vector2(PanelW, -20);
            boxRt.anchoredPosition = new Vector2(-8, 0);
            var panel = (RectTransform)box.transform;
            var inner = PanelW - 32;

            title = UiKit.Label("Title", panel, "", 27, UiKit.Ink, true, TextAnchor.UpperLeft);
            UiKit.Place(title.rectTransform, new Vector2(0, 1), new Vector2(14, -10), new Vector2(inner, 36), new Vector2(0, 1));
            // a phone has less height: the cost alone, and everything a little higher
            var up = UiKit.Mobile ? 46f : 0f;
            about = UiKit.Label("About", panel, "", 16, UiKit.InkSoft, false, TextAnchor.UpperLeft);
            about.supportRichText = true;
            UiKit.Place(about.rectTransform, new Vector2(0, 1), new Vector2(14, -46), new Vector2(inner, 108 - up), new Vector2(0, 1));
            status = UiKit.Label("Status", panel, "", 18, UiKit.Ink, true, TextAnchor.UpperLeft);
            UiKit.Place(status.rectTransform, new Vector2(0, 1), new Vector2(14, -156 + up), new Vector2(inner, 54), new Vector2(0, 1));

            var half = inner / 2 - 4;
            var turn = UiKit.Button("Rotate", panel, "Obróć  [R]", new Vector2(half, 56), Rotate, UiKit.Tone.Rep, 19);
            UiKit.Place((RectTransform)turn.transform, new Vector2(0, 1), new Vector2(14, -214 + up), new Vector2(half, 56), new Vector2(0, 1));
            var fit = UiKit.Button("Fit", panel, "Dopasuj  [F]", new Vector2(half, 56), Fit, UiKit.Tone.Rep, 19);
            UiKit.Place((RectTransform)fit.transform, new Vector2(1, 1), new Vector2(-14, -214 + up), new Vector2(half, 56), new Vector2(1, 1));

            // a row of arrows: one cell at a time, for a thumb that hides what it drags
            var cross = UiKit.Rect("Nudge", panel);
            UiKit.Place(cross, new Vector2(0.5f, 1), new Vector2(0, -280 + up), new Vector2(inner, 54), new Vector2(0.5f, 1));
            var step = inner / 4;
            Arrow(cross, "left", new Vector2(-step * 1.5f, 0), Vector2Int.left);
            Arrow(cross, "up", new Vector2(-step * 0.5f, 0), Vector2Int.down);
            Arrow(cross, "down", new Vector2(step * 0.5f, 0), Vector2Int.up);
            Arrow(cross, "right", new Vector2(step * 1.5f, 0), Vector2Int.right);

            confirm = UiKit.Button("Confirm", panel, "Postaw  [E]", new Vector2(inner, 68), Confirm, UiKit.Tone.Gold, 27);
            UiKit.Place((RectTransform)confirm.transform, new Vector2(0.5f, 0), new Vector2(0, 76), new Vector2(inner, 68), new Vector2(0.5f, 0));
            confirmFace = confirm.transform.Find("Face/Fill")?.GetComponent<Image>();
            var cancel = UiKit.Button("Cancel", panel, "Wróć  [Esc]", new Vector2(inner, 54), Cancel, UiKit.Tone.Rep, 21);
            UiKit.Place((RectTransform)cancel.transform, new Vector2(0.5f, 0), new Vector2(0, 12), new Vector2(inner, 54), new Vector2(0.5f, 0));
            root.SetActive(false);
        }

        void Arrow(RectTransform parent, string word, Vector2 at, Vector2Int by)
        {
            var label = word switch { "up" => "▲", "down" => "▼", "left" => "◀", _ => "▶" };
            var b = UiKit.Button("Nudge " + word, parent, label, new Vector2(56, 52), () => Move(by), UiKit.Tone.Rep, 20);
            UiKit.Place((RectTransform)b.transform, new Vector2(0.5f, 0.5f), at, new Vector2(56, 52));
        }

        // ---------- opening ----------

        public void Open(Land l, string kindId, int budLevel, DistrictsWorld districts, FollowCamera camera,
            Action<Vector2Int, int> onConfirm, Action onBack, Action onClosed)
        {
            land = l;
            kind = l.Rules.Building(kindId);
            level = budLevel;
            view = districts;
            cam = camera;
            done = onConfirm;
            back = onBack;
            closed = onClosed;
            if (kind == null) return;
            root.SetActive(true);
            root.transform.SetAsLastSibling();
            title.text = kind.name;
            about.text = $"Zajmuje <b>{kind.w}×{kind.h}</b> pola. Koszt: <b>{Land.CostText(kind.levels[0])}</b>\n" +
                         (UiKit.Mobile ? "" : "Przeciągnij budynek po działce. Złote pole to wejście: zostaje wolne.");
            rot = 0;
            dotsFor = -1;
            RaiseCamera();
            // it starts where it fits, as near the town hall as possible
            centre = Vector2Int.one * (l.Rules.plotSize / 2);
            foreach (var b in land.State.buildings)
                if (b.kind == Land.Hall) centre = new Vector2Int(b.x, b.y);
            Fit();
        }

        /// <summary>The camera over the plot: all of it in view, in the part of the screen the panel leaves free.</summary>
        void RaiseCamera()
        {
            var canvas = (RectTransform)root.transform.parent;
            var share = PanelShare(canvas);
            var plot = land.Rules.plotSize;
            var aspect = Mathf.Max(0.5f, (float)Screen.width / Mathf.Max(1, Screen.height));
            var half = Mathf.Max(plot / 2f + 2.5f, (plot / 2f + 1) / ((1 - share) * aspect));
            var at = view.PlotCentre(land.Plot);
            at.x += half * aspect * share;
            cam.Overview(at + new Vector3(0, 1, 0), half, BuildTilt);
        }

        public void Hide()
        {
            if (!root.activeSelf) return;
            root.SetActive(false);
            if (view) view.HidePlan();
            if (cam) cam.EndOverview();
            closed?.Invoke();
        }

        void Cancel()
        {
            Hide();
            back?.Invoke();
        }

        void Confirm()
        {
            if (kind == null || problem != null) return;
            var anchor = Anchor;
            Hide();
            done?.Invoke(anchor, rot);
        }

        // ---------- moving ----------

        /// <summary>The middle of the building goes to this cell, kept on the plot.</summary>
        internal void MoveForDemo(Vector2Int cell) => MoveTo(cell);

        void MoveTo(Vector2Int cell)
        {
            var n = land.Rules.plotSize;
            var f = Land.Footprint(kind, 0, 0, rot);
            var half = new Vector2Int(f.width / 2, f.height / 2);
            var moved = new Vector2Int(
                Mathf.Clamp(cell.x, half.x, n - 1 - (f.width - 1 - half.x)),
                Mathf.Clamp(cell.y, half.y, n - 1 - (f.height - 1 - half.y)));
            if (moved == centre) return;
            centre = moved;
            Refresh();
        }

        void Move(Vector2Int by) => MoveTo(centre + by);

        public void Rotate()
        {
            rot = (rot + 1) % 4;
            var keep = centre;
            centre = new Vector2Int(-1, -1);
            MoveTo(keep);
        }

        /// <summary>To the nearest spot where it fits exactly, keeping its turn when that can be had.</summary>
        public void Fit()
        {
            if (land.NearestFit(kind.id, centre, level, rot) is { } best)
            {
                rot = best.rot;
                centre = Land.CentreOf(Land.Footprint(kind, best.anchor.x, best.anchor.y, rot));
            }
            Refresh();
        }

        // ---------- drawing ----------

        void Refresh()
        {
            var anchor = Anchor;
            problem = land.PlanProblem(kind.id, anchor.x, anchor.y, level, rot);
            view.ShowGhost(land, kind, anchor.x, anchor.y, rot, problem == null || problem == "poor");
            view.SetPlanCells(land, kind, anchor.x, anchor.y, rot);
            if (dotsFor != rot)
            {
                dotsFor = rot;
                view.SetPlanDots(land, (x, y) =>
                {
                    var a = Land.AnchorForCentre(kind, new Vector2Int(x, y), rot);
                    var p = land.PlanProblem(kind.id, a.x, a.y, level, rot);
                    return p == null || p == "poor";
                });
            }
            var fits = problem == null;
            status.color = fits ? new Color(0.36f, 0.6f, 0.07f) : UiKit.Alert700;
            status.text = fits ? $"Pasuje idealnie. Drzwi na {DoorNames[rot]}." : Land.ProblemText(problem);
            confirm.interactable = fits;
            if (confirmFace) confirmFace.color = fits ? UiKit.Gold400 : UiKit.Paper300;
        }

        // ---------- input ----------

        /// <summary>The keys while building (from the game's frame).</summary>
        public void Tick(Characters.PlayerInput input)
        {
            if (input.CancelPressed)
            {
                Cancel();
                return;
            }
            if (input.InteractPressed)
            {
                Confirm();
                return;
            }
            var kb = Keyboard.current;
            if (kb == null) return;
            if (kb.rKey.wasPressedThisFrame) Rotate();
            if (kb.fKey.wasPressedThisFrame) Fit();
            if (kb.enterKey.wasPressedThisFrame) Confirm();
            if (kb.leftArrowKey.wasPressedThisFrame || kb.aKey.wasPressedThisFrame) Move(Vector2Int.left);
            if (kb.rightArrowKey.wasPressedThisFrame || kb.dKey.wasPressedThisFrame) Move(Vector2Int.right);
            if (kb.upArrowKey.wasPressedThisFrame || kb.wKey.wasPressedThisFrame) Move(Vector2Int.down);
            if (kb.downArrowKey.wasPressedThisFrame || kb.sKey.wasPressedThisFrame) Move(Vector2Int.up);
        }

        /// <summary>A press or a drag on the world: the point of the ground under it decides the plot's cell.</summary>
        void Pointer(Vector2 screen, bool pressed)
        {
            if (!cam.GroundAt(screen, out var ground)) return;
            var cell = view.LocalCell(land.Plot, ground);
            // a press on the building takes hold of it where it is, so it doesn't jump under the finger
            if (pressed) grab = Land.Footprint(kind, Anchor.x, Anchor.y, rot).Contains(cell) ? centre - cell : Vector2Int.zero;
            MoveTo(cell + grab);
        }

        sealed class WorldSurface : MonoBehaviour, IPointerDownHandler, IDragHandler
        {
            public LandPlanner Planner;
            public void OnPointerDown(PointerEventData e) => Planner.Pointer(e.position, true);
            public void OnDrag(PointerEventData e) => Planner.Pointer(e.position, false);
        }
    }
}
