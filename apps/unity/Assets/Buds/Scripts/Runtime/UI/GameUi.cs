using System;
using System.Collections.Generic;
using Buds.Characters;
using Buds.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Buds.UI
{
    /// <summary>All on-screen UI: pairing, loading, HUD, dialog box and the touch joystick.</summary>
    public sealed class GameUi
    {
        readonly Canvas canvas;
        GameObject pairScreen;
        Text pairError;
        Button pairButton;
        GameObject loading;
        Text loadingText;
        GameObject hud;
        Text hudName;
        Text hudLevel;
        RectTransform hudXp;
        Text hudXpText;
        GameObject hint;
        Text hintText;
        GameObject dialog;
        Text dialogTitle;
        Text dialogBody;
        Text dialogMore;
        GameObject choiceRow;
        Text acceptLabel;
        Text declineLabel;
        Action onAccept;
        Action onDecline;
        GameObject tracker;
        RectTransform trackerRect;
        Text trackerText;
        Image stickBase;
        Image stickKnob;
        GameObject toast;
        RectTransform toastRect;
        Text toastText;
        float toastUntil;

        public bool DialogOpen => dialog && dialog.activeSelf;
        public Transform Root => canvas.transform;
        GameObject budButton;
        public bool ChoiceOpen => DialogOpen && choiceRow.activeSelf;

        public GameUi()
        {
            canvas = UiKit.CreateCanvas("UI", 10);
            BuildLoading();
            BuildHud();
            BuildDialog();
            BuildTracker();
            BuildStick();
            BuildToast();
        }

        // ---------- pairing ----------

        public void ShowPair(Action<string> onConnect, Action onGuest)
        {
            if (pairScreen) UnityEngine.Object.Destroy(pairScreen);
            HideLoading();

            var bg = UiKit.Panel("Pair", canvas.transform, UiKit.Surface900);
            bg.raycastTarget = true;
            UiKit.Stretch(bg.rectTransform);
            pairScreen = bg.gameObject;

            // fixed-size group, scaled down to fit short landscape screens
            var group = UiKit.Rect("Group", bg.transform);
            Place(group, 0, 0, 640, 1000);
            group.gameObject.AddComponent<FitInParent>();

            var logo = UiKit.Outlined("Logo", group, "Buds", 150, UiKit.Buds400);
            Place(logo.rectTransform, 0, 400, 600, 180);

            var body = UiKit.Window("Card", group, new Vector2(600, 660), "Połącz z grą", null, out var card, out _);
            Place(card, 0, -20, 600, 660);

            var sub = UiKit.Label("Sub", body, "Stwórz Buda na stronie, a potem wpisz kod z jego profilu.", 28, UiKit.InkSoft);
            Place(sub.rectTransform, 0, 200, 520, 90);

            var field = UiKit.Input("Code", body, new Vector2(440, 120), "KOD", 80);
            Place((RectTransform)field.transform.parent, 0, 75, 440, 120);
            field.characterLimit = 6;
            field.contentType = InputField.ContentType.Alphanumeric;
            field.onValidateInput = (_, _, c) => char.IsLetterOrDigit(c) ? char.ToUpperInvariant(c) : '\0';
            field.textComponent.alignment = TextAnchor.MiddleCenter;
            ((Text)field.placeholder).alignment = TextAnchor.MiddleCenter;

            pairError = UiKit.Label("Error", body, "", 26, UiKit.Alert700);
            Place(pairError.rectTransform, 0, -10, 520, 50);

            // the one gold action on this screen; guest play is secondary (rep)
            pairButton = UiKit.Button("Connect", body, "Połącz", new Vector2(440, 100), () => onConnect(field.text));
            Place(pairButton.transform as RectTransform, 0, -100, 440, 100);

            var guest = UiKit.Button("Guest", body, "Graj gościem", new Vector2(440, 84), onGuest, UiKit.Tone.Rep, 34);
            Place(guest.transform as RectTransform, 0, -222, 440, 84);

            if (Debug.isDebugBuild)
            {
                // dev builds: point the game at a local API (e.g. http://192.168.1.10:4000)
                var server = UiKit.Input("Server", group, new Vector2(600, 64), PlayerSession.ApiBaseUrl, 24);
                Place((RectTransform)server.transform.parent, 0, -460, 600, 64);
                server.text = PlayerSession.ApiBaseUrl;
                server.onEndEdit.AddListener(v =>
                {
                    if (v.StartsWith("http")) PlayerSession.ApiBaseUrl = v;
                });
            }
        }

        public void SetPairBusy(bool busy, string error = null)
        {
            if (!pairScreen) return;
            pairButton.interactable = !busy;
            pairButton.GetComponentInChildren<Text>().text = busy ? "Łączę…" : "Połącz";
            pairError.text = error ?? "";
        }

        public void HidePair()
        {
            if (pairScreen) UnityEngine.Object.Destroy(pairScreen);
        }

        // ---------- loading ----------

        void BuildLoading()
        {
            var bg = UiKit.Panel("Loading", canvas.transform, UiKit.Surface900);
            bg.raycastTarget = true;
            UiKit.Stretch(bg.rectTransform);
            loadingText = UiKit.Outlined("Text", bg.transform, "", 56);
            UiKit.Stretch(loadingText.rectTransform, 40);
            loading = bg.gameObject;
            loading.SetActive(false);
        }

        public void ShowLoading(string text)
        {
            loadingText.text = text;
            loading.SetActive(true);
            loading.transform.SetAsLastSibling();
        }

        public void HideLoading() => loading.SetActive(false);

        // ---------- HUD ----------

        void BuildHud()
        {
            // dark plate: level badge, name and the xp bar
            var plate = UiKit.OutlinedBox("Hud", canvas.transform, UiKit.Surface800, UiKit.RadiusL);
            var rt = (RectTransform)plate.transform.parent;
            UiKit.Place(rt, new Vector2(0, 1), new Vector2(24, -24), new Vector2(380, 124), new Vector2(0, 1));

            var badge = UiKit.OutlinedBox("Level", plate.transform, UiKit.Buds400, 999);
            UiKit.Place((RectTransform)badge.transform.parent, new Vector2(0, 0.5f), new Vector2(14, 0), new Vector2(84, 84),
                new Vector2(0, 0.5f));
            hudLevel = UiKit.Outlined("Num", badge.transform, "", 44);
            UiKit.Stretch(hudLevel.rectTransform, 0, 4, 0, 0);

            hudName = UiKit.Outlined("Name", plate.transform, "", 38, null, TextAnchor.MiddleLeft);
            UiKit.Place(hudName.rectTransform, new Vector2(0, 1), new Vector2(112, -8), new Vector2(250, 50), new Vector2(0, 1));

            hudXp = UiKit.Bar("Xp", plate.transform, UiKit.XpFill, out var bar);
            UiKit.Place(bar, Vector2.zero, new Vector2(112, 16), new Vector2(246, 40), Vector2.zero);
            hudXpText = UiKit.Outlined("Value", bar, "", 22);
            UiKit.Stretch(hudXpText.rectTransform, 0, 2, 0, 0);
            hud = rt.gameObject;
            hud.SetActive(false);

            hintText = UiKit.Pill("Hint", canvas.transform, "", UiKit.Buds400, 34, new Vector2(300, 72), out var hrt);
            UiKit.Place(hrt, new Vector2(0.5f, 0), new Vector2(0, 140), hrt.sizeDelta);
            hint = hrt.gameObject;
            hint.SetActive(false);
        }

        public void ShowHud(string name, int level, int xp, int nextXp)
        {
            hudName.text = name;
            hudLevel.text = level.ToString();
            hudXpText.text = $"{xp} / {nextXp} XP";
            hud.SetActive(true);
            Canvas.ForceUpdateCanvases(); // the bar's width is known only after layout
            UiKit.SetBar(hudXp, Progression.Progress(xp));
        }

        public void SetHint(string text)
        {
            hint.SetActive(!string.IsNullOrEmpty(text) && !DialogOpen);
            hintText.text = text ?? "";
        }

        // ---------- dialog ----------

        void BuildDialog()
        {
            var body = UiKit.Window("Dialog", canvas.transform, new Vector2(760, 390), "", CloseDialog, out var rt,
                out dialogTitle);
            UiKit.Place(rt, new Vector2(0.5f, 0), new Vector2(0, 40), rt.sizeDelta, new Vector2(0.5f, 0));
            dialogBody = UiKit.Label("Body", body, "", 29, UiKit.Ink, false, TextAnchor.UpperLeft);
            UiKit.Stretch(dialogBody.rectTransform, 0, 30, 0, 0);
            dialogBody.lineSpacing = 1.1f;
            dialogMore = UiKit.Label("More", body, "dotknij lub E", 22, UiKit.InkSoft, false, TextAnchor.LowerRight);
            UiKit.Stretch(dialogMore.rectTransform);

            // accept (gold, the one call to action) / decline (secondary) for quest offers
            var row = UiKit.Rect("Choices", body);
            row.anchorMin = new Vector2(0, 0);
            row.anchorMax = new Vector2(1, 0);
            row.pivot = new Vector2(0.5f, 0);
            row.sizeDelta = new Vector2(0, 76);
            row.anchoredPosition = new Vector2(0, 4);
            var accept = UiKit.Button("Accept", row, "Przyjmij", new Vector2(250, 72), ChooseAccept, UiKit.Tone.Gold, 32);
            UiKit.Place((RectTransform)accept.transform, new Vector2(1, 0), Vector2.zero, new Vector2(250, 72), new Vector2(1, 0));
            acceptLabel = accept.GetComponentInChildren<Text>();
            var decline = UiKit.Button("Decline", row, "Później", new Vector2(200, 72), ChooseDecline, UiKit.Tone.Rep, 30);
            UiKit.Place((RectTransform)decline.transform, new Vector2(1, 0), new Vector2(-270, 0), new Vector2(200, 72),
                new Vector2(1, 0));
            declineLabel = decline.GetComponentInChildren<Text>();
            choiceRow = row.gameObject;
            choiceRow.SetActive(false);

            dialog = rt.gameObject;
            dialog.SetActive(false);
        }

        public void ShowDialog(string title, string text)
        {
            dialogTitle.text = title;
            dialogBody.text = text;
            choiceRow.SetActive(false);
            dialogMore.gameObject.SetActive(true);
            onAccept = onDecline = null;
            dialog.SetActive(true);
            hint.SetActive(false);
        }

        /// <summary>Dialog with two buttons (E / Enter = accept, Esc / Q = decline, or tap).</summary>
        public void ShowChoice(string title, string text, string accept, string decline, Action accepted, Action declined)
        {
            ShowDialog(title, text);
            acceptLabel.text = accept;
            declineLabel.text = decline;
            onAccept = accepted;
            onDecline = declined;
            choiceRow.SetActive(true);
            dialogMore.gameObject.SetActive(false);
        }

        public void ChooseAccept()
        {
            var a = onAccept;
            HideDialog();
            a?.Invoke();
        }

        public void ChooseDecline()
        {
            var d = onDecline;
            HideDialog();
            d?.Invoke();
        }

        void CloseDialog()
        {
            if (ChoiceOpen) ChooseDecline();
            else HideDialog();
        }

        public void HideDialog()
        {
            dialog.SetActive(false);
            onAccept = onDecline = null;
        }

        /// <summary>"Twój Bud" button under the HUD plate (opens the Bud panel).</summary>
        public void ShowBudButton(Action onClick)
        {
            if (budButton) return;
            var button = UiKit.Button("BudButton", canvas.transform, "Twój Bud  [I]", new Vector2(250, 62), onClick, UiKit.Tone.Rep, 28);
            UiKit.Place((RectTransform)button.transform, new Vector2(0, 1), new Vector2(24, -164), new Vector2(250, 62), new Vector2(0, 1));
            budButton = button.gameObject;
        }

        // ---------- quest tracker (top right) ----------

        void BuildTracker()
        {
            var plate = UiKit.OutlinedBox("Tracker", canvas.transform, UiKit.Surface800, UiKit.RadiusM);
            trackerRect = (RectTransform)plate.transform.parent;
            UiKit.Place(trackerRect, new Vector2(1, 1), new Vector2(-24, -116), new Vector2(400, 120), new Vector2(1, 1)); // below the zone toast
            trackerText = UiKit.Label("Text", plate.transform, "", 25, UiKit.TextOnDark, false, TextAnchor.UpperLeft);
            UiKit.Stretch(trackerText.rectTransform, 18, 12, 18, 12);
            trackerText.lineSpacing = 1.05f;
            tracker = trackerRect.gameObject;
            tracker.SetActive(false);
        }

        /// <summary>Lists active quests: title (lime) and what to do next. Empty list hides the panel.</summary>
        public void SetQuests(IReadOnlyList<(string title, string objective)> quests)
        {
            if (quests.Count == 0)
            {
                tracker.SetActive(false);
                return;
            }
            var sb = new System.Text.StringBuilder();
            for (var i = 0; i < quests.Count && i < 3; i++)
            {
                if (i > 0) sb.Append('\n');
                sb.Append("<b><color=#a3e635>").Append(quests[i].title).Append("</color></b>\n").Append(quests[i].objective);
            }
            if (quests.Count > 3) sb.Append($"\n<color=#a9afbd>+{quests.Count - 3} więcej</color>");
            trackerText.text = sb.ToString();
            tracker.SetActive(true);
            Canvas.ForceUpdateCanvases();
            trackerRect.sizeDelta = new Vector2(400, trackerText.preferredHeight + 28);
        }

        // ---------- toast (district / zone name) ----------

        void BuildToast()
        {
            toastText = UiKit.Pill("Toast", canvas.transform, "", UiKit.Surface800, 34, new Vector2(400, 70), out toastRect);
            // a bit right of centre, so a long toast never covers the HUD plate on the left
            UiKit.Place(toastRect, new Vector2(0.5f, 1), new Vector2(70, -30), toastRect.sizeDelta, new Vector2(0.5f, 1));
            toast = toastRect.gameObject;
            toast.SetActive(false);
        }

        /// <summary>Shows a short banner at the top for a few seconds (entering a district or a zone).</summary>
        public void ShowToast(string text, float seconds = 2.8f)
        {
            toastText.text = text;
            toastRect.sizeDelta = new Vector2(Mathf.Max(240, toastText.preferredWidth + 72), toastRect.sizeDelta.y);
            toast.SetActive(true);
            toastUntil = Time.time + seconds;
        }

        public void Tick()
        {
            if (toast.activeSelf && Time.time > toastUntil) toast.SetActive(false);
        }

        // ---------- joystick ----------

        void BuildStick()
        {
            stickBase = UiKit.Panel("StickBase", canvas.transform, new Color(0.086f, 0.094f, 0.122f, 0.45f));
            stickBase.sprite = UiKit.Circle(64);
            stickBase.rectTransform.sizeDelta = new Vector2(180, 180);
            stickKnob = UiKit.Panel("StickKnob", canvas.transform, new Color(0.965f, 0.949f, 0.914f, 0.85f));
            stickKnob.sprite = UiKit.Circle(32);
            stickKnob.rectTransform.sizeDelta = new Vector2(80, 80);
            foreach (var img in new[] { stickBase, stickKnob })
            {
                img.rectTransform.anchorMin = img.rectTransform.anchorMax = Vector2.zero;
                img.gameObject.SetActive(false);
            }
        }

        public void UpdateStick(PlayerInput input)
        {
            var show = input.StickActive && !DialogOpen;
            stickBase.gameObject.SetActive(show);
            stickKnob.gameObject.SetActive(show);
            if (!show) return;
            var scale = canvas.scaleFactor;
            var origin = input.StickOrigin / scale;
            var offset = Vector2.ClampMagnitude((input.StickPosition - input.StickOrigin) / scale, 70);
            stickBase.rectTransform.anchoredPosition = origin;
            stickKnob.rectTransform.anchoredPosition = origin + offset;
        }

        static void Place(RectTransform rt, float x, float y, float w, float h)
        {
            rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
            rt.sizeDelta = new Vector2(w, h);
            rt.anchoredPosition = new Vector2(x, y);
        }
    }
}
