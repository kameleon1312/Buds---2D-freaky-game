using System;
using Buds.Quests;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace Buds.UI
{
    /// <summary>
    /// The training mini-game (TimingGame): a marker sweeps the bar, E / Space / the button stops it in the green
    /// zone. After five rounds the score goes to the server (onFinished) and the screen shows what it granted.
    /// </summary>
    public sealed class TrainingScreen
    {
        readonly Func<int, Awaitable<string>> onFinished;
        readonly GameObject root;
        readonly Text title;
        readonly Text hint;
        readonly Text status;
        readonly RectTransform zone;
        readonly RectTransform marker;
        readonly Button action;
        readonly Text actionLabel;
        readonly Image[] pips = new Image[5];
        readonly bool[] results = new bool[5];
        TimingGame game;
        bool busy;
        bool finished;
        float flash;

        public bool IsOpen => root.activeSelf;
        public TimingGame Game => game;
        public bool Finished => finished;

        public TrainingScreen(Transform canvas, Func<int, Awaitable<string>> onFinished)
        {
            this.onFinished = onFinished;
            var dim = UiKit.Panel("Training", canvas, new Color(0.086f, 0.094f, 0.122f, 0.6f));
            dim.raycastTarget = true;
            UiKit.Stretch(dim.rectTransform);
            root = dim.gameObject;
            var group = UiKit.Rect("Group", dim.transform);
            UiKit.Place(group, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(940, 600));
            group.gameObject.AddComponent<FitInParent>();
            var body = UiKit.Window("Window", group, new Vector2(900, 580), "Trening", Close, out var window, out title);
            UiKit.Place(window, new Vector2(0.5f, 0.5f), Vector2.zero, window.sizeDelta);

            hint = UiKit.Label("Hint", body, "", 26, UiKit.Ink, false, TextAnchor.UpperCenter);
            UiKit.Place(hint.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -4), new Vector2(820, 70), new Vector2(0.5f, 1));

            // the bar: dark track, lime zone, gold marker
            var track = UiKit.OutlinedBox("Track", body, UiKit.Surface800, UiKit.RadiusM);
            UiKit.Place((RectTransform)track.transform.parent, new Vector2(0.5f, 1), new Vector2(0, -96), new Vector2(800, 70),
                new Vector2(0.5f, 1));
            var inner = UiKit.Rect("Inner", track.transform);
            UiKit.Stretch(inner, 8);
            zone = UiKit.Shape("Zone", inner, UiKit.Buds400, 6).rectTransform;
            marker = UiKit.Shape("Marker", inner, UiKit.Gold400, 4).rectTransform;
            var markerLine = UiKit.Panel("Line", marker, UiKit.Outline);
            UiKit.Stretch(markerLine.rectTransform, 5, 0, 5, 0);

            for (var i = 0; i < pips.Length; i++)
            {
                var pip = UiKit.OutlinedBox("Pip" + i, body, UiKit.Surface700, 999);
                UiKit.Place((RectTransform)pip.transform.parent, new Vector2(0.5f, 1), new Vector2((i - 2) * 48, -196), new Vector2(34, 34),
                    new Vector2(0.5f, 1));
                pips[i] = pip;
            }
            status = UiKit.Label("Status", body, "", 26, UiKit.Ink, true, TextAnchor.UpperCenter);
            UiKit.Place(status.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -240), new Vector2(820, 150), new Vector2(0.5f, 1));

            action = UiKit.Button("Action", body, "Teraz!  [E]", new Vector2(320, 76), Press, UiKit.Tone.Gold, 32);
            UiKit.Place((RectTransform)action.transform, new Vector2(0.5f, 0), new Vector2(0, 12), new Vector2(320, 76),
                new Vector2(0.5f, 0));
            actionLabel = action.GetComponentInChildren<Text>();
            root.SetActive(false);
        }

        public void Open(TrainingSpotData spot, string skillName, int rounds)
        {
            game = new TimingGame(rounds, Environment.TickCount);
            busy = false;
            finished = false;
            title.text = $"{spot.name} · {skillName}";
            hint.text = $"{spot.hint}\n<size=20><color=#55514a>Zatrzymaj złoty znacznik w zielonym polu.</color></size>";
            actionLabel.text = UiKit.Keys("Teraz!  [E]");
            action.interactable = true;
            status.text = "";
            root.SetActive(true);
            root.transform.SetAsLastSibling();
            Draw();
        }

        public void Close()
        {
            if (busy) return;
            root.SetActive(false);
        }

        /// <summary>Moves the marker and handles the keys (E / Space / Enter press, Esc closes).</summary>
        public void Tick()
        {
            if (!IsOpen || game == null) return;
            if (!busy && !finished) game.Tick(Time.unscaledDeltaTime);
            flash = Mathf.Max(0, flash - Time.unscaledDeltaTime);
            var kb = Keyboard.current;
            if (kb != null)
            {
                if (kb.eKey.wasPressedThisFrame || kb.spaceKey.wasPressedThisFrame || kb.enterKey.wasPressedThisFrame) Press();
                else if (kb.escapeKey.wasPressedThisFrame) Close();
            }
            Draw();
        }

        public void Press()
        {
            if (busy || game == null) return;
            if (finished)
            {
                Close();
                return;
            }
            var hit = game.Press();
            if (game.Round - 1 < results.Length) results[game.Round - 1] = hit;
            flash = 0.35f;
            status.text = hit ? "<color=#5d9a12>Trafione!</color>" : "<color=#bd1c31>Pudło</color>";
            if (game.Done) _ = Finish();
        }

        async Awaitable Finish()
        {
            busy = true;
            action.interactable = false;
            actionLabel.text = "Zapisuję…";
            string text;
            try
            {
                text = await onFinished(game.Score);
            }
            catch (Exception e)
            {
                text = e.Message;
            }
            busy = false;
            finished = true;
            status.text = $"Trafienia: {game.Score} / {game.Rounds}\n<size=22>{text}</size>";
            actionLabel.text = UiKit.Keys("Dalej  [E]");
            action.interactable = true;
        }

        void Draw()
        {
            if (game == null) return;
            zone.anchorMin = new Vector2(game.ZoneMin, 0);
            zone.anchorMax = new Vector2(game.ZoneMax, 1);
            zone.offsetMin = zone.offsetMax = Vector2.zero;
            const float half = 0.009f;
            marker.anchorMin = new Vector2(game.Marker - half, -0.15f);
            marker.anchorMax = new Vector2(game.Marker + half, 1.15f);
            marker.offsetMin = new Vector2(-4, 0);
            marker.offsetMax = new Vector2(4, 0);
            zone.GetComponent<Image>().color = flash > 0 && game.LastHit ? Color.white : UiKit.Buds400;
            for (var i = 0; i < pips.Length; i++)
            {
                pips[i].transform.parent.gameObject.SetActive(i < game.Rounds);
                pips[i].color = i >= game.Round ? UiKit.Surface700 : results[i] ? UiKit.Buds400 : UiKit.Alert500;
            }
        }
    }
}
