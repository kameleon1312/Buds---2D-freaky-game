using System;
using System.Collections.Generic;
using Buds.Characters;
using Buds.Core;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Buds.UI
{
    /// <summary>
    /// All on-screen UI: pairing, loading, HUD, dialog box and the touch joystick. Landscape layout: the player plate
    /// and the quests top left, the buttons (Twój Bud, Mapa, the ride) top right, the action button bottom left and,
    /// on phones, the joystick bottom right. Everything sits inside the screen's safe area (notches, rounded corners).
    /// </summary>
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
        RectTransform hintRect;
        Text hintText;
        GameObject dialog;
        RectTransform dialogRect;
        RectTransform dialogContent;
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
        /// <summary>The safe area of the screen: every screen and panel is built in here.</summary>
        public Transform Root => safe;
        /// <summary>The whole screen (behind the safe area): for full-screen backgrounds.</summary>
        public Transform FullScreen => canvas.transform;
        readonly RectTransform safe;
        /// <summary>The action button or the dialog was tapped (acts like E).</summary>
        public event Action Tapped;
        GameObject budButton;
        GameObject mapButton;
        Image fade;
        public bool ChoiceOpen => DialogOpen && choiceRow.activeSelf;

        public GameUi()
        {
            canvas = UiKit.CreateCanvas("UI", 10);
            // talking to the server shows as a small ring in the corner, never as text over the screen
            NetSpinner.Create();
            safe = UiKit.Rect("Safe", canvas.transform);
            UiKit.Stretch(safe);
            safe.gameObject.AddComponent<SafeArea>();
            BuildLoading();
            BuildHud();
            BuildDialog();
            BuildTracker();
            BuildStick();
            BuildToast();
            BuildFade();
        }

        // ---------- pairing ----------

        public void ShowPair(Action<string> onConnect, Action onGuest, Action onCreate, Action onLogin)
        {
            if (pairScreen) UnityEngine.Object.Destroy(pairScreen);
            HideLoading();

            // the dark background covers the whole screen (notch side too); the content stays in the safe area
            var bg = UiKit.Panel("Pair", canvas.transform, UiKit.Surface900);
            bg.raycastTarget = true;
            UiKit.Stretch(bg.rectTransform);
            pairScreen = bg.gameObject;
            var area = UiKit.Rect("Safe", bg.transform);
            UiKit.Stretch(area);
            area.gameObject.AddComponent<SafeArea>();

            // landscape: the logo and a word about the game on the left, the card on the right; scaled to fit
            var group = UiKit.Rect("Group", area);
            Place(group, 0, 0, 1180, 620);
            group.gameObject.AddComponent<FitInParent>();

            var logo = UiKit.Outlined("Logo", group, "Buds", 170, UiKit.Buds400);
            Place(logo.rectTransform, -300, 110, 520, 200);

            var sub = UiKit.Label("Sub", group,
                "Nowy? Stwórz swojego Buda tutaj.\nMasz konto na stronie? Zaloguj się i graj swoim Budem.", 26, UiKit.TextOnDarkMuted);
            Place(sub.rectTransform, -300, -20, 520, 90);
            var login = UiKit.Button("Login", group, "Zaloguj się na konto", new Vector2(460, 80), onLogin, UiKit.Tone.Buds, 32);
            Place(login.transform as RectTransform, -300, -120, 460, 80);

            var body = UiKit.Window("Card", group, new Vector2(600, 600), "Witaj w Buds", null, out var card, out _);
            Place(card, 280, 0, 600, 600);

            // the one gold action: a new bud, right here on the phone
            var create = UiKit.Button("Create", body, "Stwórz nowego Buda", new Vector2(460, 96), onCreate, UiKit.Tone.Gold, 36);
            Place(create.transform as RectTransform, 0, 186, 460, 96);

            var or = UiKit.Label("Or", body, "albo połącz kodem", 22, UiKit.InkSoft, true);
            Place(or.rectTransform, 0, 112, 460, 30);

            var field = UiKit.Input("Code", body, new Vector2(440, 100), "KOD", 66);
            Place((RectTransform)field.transform.parent, 0, 40, 440, 100);
            field.characterLimit = 6;
            field.contentType = InputField.ContentType.Alphanumeric;
            field.onValidateInput = (_, _, c) => char.IsLetterOrDigit(c) ? char.ToUpperInvariant(c) : '\0';
            field.textComponent.alignment = TextAnchor.MiddleCenter;
            ((Text)field.placeholder).alignment = TextAnchor.MiddleCenter;

            pairError = UiKit.Label("Error", body, "", 24, UiKit.Alert700);
            Place(pairError.rectTransform, 0, -32, 520, 40);

            pairButton = UiKit.Button("Connect", body, "Połącz", new Vector2(440, 80), () => onConnect(field.text), UiKit.Tone.Buds, 32);
            Place(pairButton.transform as RectTransform, 0, -94, 440, 80);

            var guest = UiKit.Button("Guest", body, "Graj gościem", new Vector2(440, 70), onGuest, UiKit.Tone.Rep, 30);
            Place(guest.transform as RectTransform, 0, -186, 440, 70);

            if (Debug.isDebugBuild)
            {
                // dev builds: point the game at a local API (e.g. http://192.168.1.10:4000)
                var server = UiKit.Input("Server", group, new Vector2(500, 64), PlayerSession.ApiBaseUrl, 24);
                Place((RectTransform)server.transform.parent, -300, -262, 500, 56);
                var serverLabel = UiKit.Label("ServerLabel", group, "Serwer (wersja testowa)", 19, UiKit.TextOnDarkMuted, true);
                Place(serverLabel.rectTransform, -300, -218, 500, 28);
                server.text = PlayerSession.ApiBaseUrl;
                server.onEndEdit.AddListener(v =>
                {
                    // only an actual change is remembered: closing the keyboard on the shown address must not pin it
                    if (v.Trim().TrimEnd('/') == PlayerSession.ApiBaseUrl) return;
                    if (v.Trim().StartsWith("http")) PlayerSession.ApiBaseUrl = v;
                    else if (v.Trim().Length == 0)
                    {
                        // cleared: forget the typed address and use the default again
                        PlayerSession.ApiBaseUrl = "";
                        server.text = PlayerSession.ApiBaseUrl;
                    }
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
            var plate = UiKit.OutlinedBox("Hud", Root, UiKit.Surface800, UiKit.RadiusL);
            var rt = (RectTransform)plate.transform.parent;
            UiKit.Place(rt, new Vector2(0, 1), new Vector2(24, -24), new Vector2(PlateW, PlateH), new Vector2(0, 1));

            var badge = UiKit.OutlinedBox("Level", plate.transform, UiKit.Buds400, 999);
            UiKit.Place((RectTransform)badge.transform.parent, new Vector2(0, 0.5f), new Vector2(10, 0), new Vector2(60, 60),
                new Vector2(0, 0.5f));
            hudLevel = UiKit.Outlined("Num", badge.transform, "", 32);
            UiKit.Stretch(hudLevel.rectTransform, 0, 3, 0, 0);

            hudName = UiKit.Outlined("Name", plate.transform, "", 26, null, TextAnchor.MiddleLeft);
            hudName.horizontalOverflow = HorizontalWrapMode.Overflow;
            UiKit.Place(hudName.rectTransform, new Vector2(0, 1), new Vector2(80, -6), new Vector2(PlateW - 94, 36), new Vector2(0, 1));

            hudXp = UiKit.Bar("Xp", plate.transform, UiKit.XpFill, out var bar);
            UiKit.Place(bar, Vector2.zero, new Vector2(80, 10), new Vector2(PlateW - 94, 28), Vector2.zero);
            hudXpText = UiKit.Outlined("Value", bar, "", 16);
            UiKit.Stretch(hudXpText.rectTransform, 0, 1, 0, 0);
            hud = rt.gameObject;
            BuildQuestButton(rt);
            hud.SetActive(false);

            // the action button: what E does right now (talk, fight, search…); tapping it does the same
            hintText = UiKit.Pill("Hint", Root, "", UiKit.Buds400, UiKit.Mobile ? 36 : 34, new Vector2(300, UiKit.Mobile ? 92 : 72), out var hrt);
            if (UiKit.Mobile) UiKit.Place(hrt, Vector2.zero, new Vector2(28, 28), hrt.sizeDelta, Vector2.zero);
            else UiKit.Place(hrt, new Vector2(0.5f, 0), new Vector2(0, 40), hrt.sizeDelta);
            var tap = hrt.gameObject.AddComponent<Button>();
            tap.targetGraphic = hrt.GetComponentInChildren<Image>();
            tap.targetGraphic.raycastTarget = true; // UI shapes ignore touches by default
            tap.onClick.AddListener(() => Tapped?.Invoke());
            hint = hrt.gameObject;
            hintRect = hrt;
            hint.SetActive(false);
        }

        public void ShowHud(string name, int level, int xp, int nextXp)
        {
            // long names shrink to fit the plate instead of running past it
            hudName.text = name;
            hudName.fontSize = name.Length > 14 ? 20 : 26;
            hudLevel.text = level.ToString();
            hudXpText.text = $"{xp} / {nextXp} XP";
            hud.SetActive(true);
            Canvas.ForceUpdateCanvases(); // the bar's width is known only after layout
            UiKit.SetBar(hudXp, Progression.Progress(xp));
        }

        public void SetHint(string text)
        {
            hint.SetActive(!string.IsNullOrEmpty(text) && !DialogOpen);
            text = UiKit.Keys(text);
            if (hintText.text == (text ?? "")) return;
            hintText.text = text ?? "";
            // one line, as wide as the text
            hintRect.sizeDelta = new Vector2(Mathf.Max(300, hintText.preferredWidth + 72), hintRect.sizeDelta.y);
        }

        // ---------- dialog ----------

        void BuildDialog()
        {
            var body = UiKit.Window("Dialog", Root, new Vector2(860, 320), "", CloseDialog, out var rt,
                out dialogTitle);
            UiKit.Place(rt, new Vector2(0.5f, 0), new Vector2(0, 24), rt.sizeDelta, new Vector2(0.5f, 0));
            // tapping the dialog moves on, like E (the buttons on it come first)
            var tapArea = UiKit.Panel("Tap", rt, new Color(0, 0, 0, 0));
            tapArea.raycastTarget = true;
            UiKit.Stretch(tapArea.rectTransform);
            tapArea.transform.SetAsFirstSibling();
            var tapButton = tapArea.gameObject.AddComponent<Button>();
            tapButton.transition = Selectable.Transition.None;
            tapButton.onClick.AddListener(() =>
            {
                if (!ChoiceOpen) Tapped?.Invoke();
            });
            dialogBody = UiKit.Label("Body", body, "", DialogFont, UiKit.Ink, false, TextAnchor.UpperLeft);
            UiKit.Stretch(dialogBody.rectTransform, 0, MoreRow, 0, 0);
            dialogBody.lineSpacing = 1.1f;
            // a very long text shrinks a little rather than running under the buttons
            dialogBody.resizeTextForBestFit = true;
            dialogBody.resizeTextMinSize = DialogFontMin;
            dialogBody.resizeTextMaxSize = DialogFont;
            dialogMore = UiKit.Label("More", body, UiKit.Mobile ? "dotknij, aby dalej" : "dotknij lub E", 22, UiKit.InkSoft, false,
                TextAnchor.LowerRight);
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
            dialogRect = rt;
            dialogContent = body;
            dialog.SetActive(false);
        }

        const int DialogFont = 28;
        const int DialogFontMin = 20;
        const float DialogMinHeight = 320;
        /// <summary>Room under the text for the "tap to go on" line, and for the row of choice buttons.</summary>
        const float MoreRow = 30;
        const float ChoiceRow = 76 + 14;

        /// <summary>
        /// Sizes the dialog to its text: the text gets the whole width and ends above the bottom row (the hint or the
        /// buttons), and the window grows up to the screen height, so nothing is ever hidden behind the buttons.
        /// </summary>
        void LayoutDialog(bool choice)
        {
            var bottom = choice ? ChoiceRow : MoreRow;
            var body = dialogBody.rectTransform;
            body.offsetMin = new Vector2(body.offsetMin.x, bottom);
            // the window's frame (head, padding) around the content
            var chrome = dialogRect.sizeDelta.y - dialogContent.rect.height;
            var width = dialogContent.rect.width;
            var settings = dialogBody.GetGenerationSettings(new Vector2(width, 0));
            settings.resizeTextForBestFit = false;
            settings.fontSize = DialogFont;
            var textHeight = dialogBody.cachedTextGeneratorForLayout.GetPreferredHeight(dialogBody.text, settings) /
                             dialogBody.pixelsPerUnit;
            var max = Mathf.Max(DialogMinHeight, ((RectTransform)Root).rect.height - 48);
            var height = Mathf.Clamp(textHeight + bottom + chrome + 8, DialogMinHeight, max);
            dialogRect.sizeDelta = new Vector2(dialogRect.sizeDelta.x, height);
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
            LayoutDialog(false);
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
            LayoutDialog(true);
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

        // the top-right column of picture buttons, top to bottom: Twój Bud, Mapa, the ride
        const float ButtonH = 66; // the old row height: the toast still sits below it
        const float IconSize = 92;
        const float IconStep = IconSize + 44; // button + caption + gap
        /// <summary>The second button column (Rewiry) sits this far left of the first; captions are wider than buttons.</summary>
        const float SecondColumn = IconSize + 72;
        const float BudW = 230, MapW = 180, RideW = 210, Gap = 14;
        /// <summary>Right edge of the left column (player plate, quests) in UI units.</summary>
        const float PlateW = 270;
        const float PlateH = 84;
        const float QuestButton = 72;
        /// <summary>Right edge of the top-left group (the plate and the quest button).</summary>
        const float LeftColumn = 24 + PlateW + 12 + QuestButton;

        /// <summary>Puts a picture button into the right column (row 0 at the top).</summary>
        static void RightColumn(Button button, int row)
        {
            UiKit.Place((RectTransform)button.transform, new Vector2(1, 1), new Vector2(-28, -24 - row * IconStep),
                new Vector2(IconSize, IconSize), new Vector2(1, 1));
            button.transform.SetAsFirstSibling(); // under panels opened later
        }

        /// <summary>"Twój Bud": the bud's head, top right (opens the Bud panel).</summary>
        public void ShowBudButton(Action onClick)
        {
            if (budButton) return;
            var button = UiKit.IconButton("BudButton", Root, UiKit.Picture("Ui/bud"), "Twój Bud  [I]", IconSize, onClick, out _, out _);
            RightColumn(button, 0);
            budButton = button.gameObject;
        }

        /// <summary>"Mapa": the treasure map, under "Twój Bud" (opens the map screen).</summary>
        public void ShowMapButton(Action onClick)
        {
            if (mapButton) return;
            var button = UiKit.IconButton("MapButton", Root, UiKit.Picture("Ui/mapa"), "Mapa  [M]", IconSize, onClick, out _, out _);
            RightColumn(button, 1);
            mapButton = button.gameObject;
        }

        GameObject rivalryButton;
        GameObject rivalryBadge;

        /// <summary>
        /// "Rewiry": the spray can with a crown, left of "Twój Bud" (the column under it ends above the phone joystick).
        /// A gold dot on it says a tribute is waiting.
        /// </summary>
        public void ShowRivalryButton(Action onClick)
        {
            if (rivalryButton) return;
            var button = UiKit.IconButton("RivalryButton", Root, UiKit.Picture("Ui/rewiry"), "Rewiry  [G]", IconSize, onClick, out _, out _);
            UiKit.Place((RectTransform)button.transform, new Vector2(1, 1), new Vector2(-28 - SecondColumn, -24),
                new Vector2(IconSize, IconSize), new Vector2(1, 1));
            button.transform.SetAsFirstSibling();
            var badge = UiKit.OutlinedBox("Badge", button.transform, UiKit.Gold400, 14);
            var badgeRt = (RectTransform)badge.transform.parent;
            UiKit.Place(badgeRt, Vector2.one, new Vector2(8, 8), new Vector2(28, 28), new Vector2(1, 1));
            rivalryBadge = badgeRt.gameObject;
            rivalryBadge.SetActive(false);
            rivalryButton = button.gameObject;
        }

        public void SetRivalryBadge(bool on)
        {
            if (rivalryBadge) rivalryBadge.SetActive(on);
        }

        GameObject stamp;
        Image stampArt;
        Text stampCaption;
        int stampToken;

        /// <summary>
        /// A turf taken: "TWÓJ REWIR" is sprayed across the middle of the screen with the turf's name under it, holds,
        /// and fades. It never blocks a tap.
        /// </summary>
        public async Awaitable ShowCapture(string turfName)
        {
            if (!stamp)
            {
                var rt = UiKit.Rect("Capture", Root);
                UiKit.Place(rt, new Vector2(0.5f, 0.5f), new Vector2(0, 90), new Vector2(560, 420));
                stampArt = UiKit.Rect("Art", rt).gameObject.AddComponent<Image>();
                stampArt.sprite = UiKit.Picture("Ui/Fx/fx-rewir");
                stampArt.preserveAspect = true;
                stampArt.raycastTarget = false;
                stampArt.type = Image.Type.Filled;
                stampArt.fillMethod = Image.FillMethod.Horizontal;
                UiKit.Place(stampArt.rectTransform, new Vector2(0.5f, 1), Vector2.zero, new Vector2(560, 330), new Vector2(0.5f, 1));
                stampCaption = UiKit.Outlined("Name", rt, "", 40, UiKit.Buds400);
                stampCaption.horizontalOverflow = HorizontalWrapMode.Overflow;
                UiKit.Place(stampCaption.rectTransform, new Vector2(0.5f, 0), new Vector2(0, 20), new Vector2(560, 60), new Vector2(0.5f, 0));
                stamp = rt.gameObject;
            }
            var token = ++stampToken;
            stamp.SetActive(true);
            stamp.transform.SetAsLastSibling();
            stampCaption.text = turfName;
            stampArt.color = Color.white;
            stampCaption.color = UiKit.Buds400;
            stamp.transform.localEulerAngles = new Vector3(0, 0, UnityEngine.Random.Range(-5f, 3f));
            // sprayed on left to right, a beat, then gone
            for (var t = 0f; t < 0.5f; t += Time.unscaledDeltaTime)
            {
                if (token != stampToken) return;
                stampArt.fillAmount = 1 - (1 - t / 0.5f) * (1 - t / 0.5f);
                stampCaption.color = new Color(UiKit.Buds400.r, UiKit.Buds400.g, UiKit.Buds400.b, Mathf.Clamp01(t / 0.5f));
                await Awaitable.NextFrameAsync();
            }
            stampArt.fillAmount = 1;
            await Awaitable.WaitForSecondsAsync(1.6f);
            for (var t = 0f; t < 0.4f; t += Time.unscaledDeltaTime)
            {
                if (token != stampToken) return;
                var a = 1 - t / 0.4f;
                stampArt.color = new Color(1, 1, 1, a);
                stampCaption.color = new Color(UiKit.Buds400.r, UiKit.Buds400.g, UiKit.Buds400.b, a);
                await Awaitable.NextFrameAsync();
            }
            if (token == stampToken) stamp.SetActive(false);
        }

        GameObject rideButton;
        Text rideLabel;
        Image rideIcon;
        Text buffLine;

        /// <summary>The worn ride's picture under the map ("Wsiądź / Zsiądź [R]"), while the bud is outdoors.</summary>
        public void SetRideButton(bool visible, string label, Action onClick, string mountItem = null)
        {
            if (!rideButton && visible)
            {
                var button = UiKit.IconButton("RideButton", Root, null, label, IconSize, onClick, out rideIcon, out rideLabel);
                RightColumn(button, 2);
                rideButton = button.gameObject;
            }
            if (!rideButton) return;
            rideButton.SetActive(visible);
            rideLabel.text = UiKit.Keys(label);
            if (mountItem != null) rideIcon.sprite = UiKit.Picture("Items/" + mountItem);
        }

        /// <summary>Running boosts of energy drinks under the HUD buttons ("" hides it).</summary>
        public void SetBuffLine(string text)
        {
            if (!buffLine)
            {
                // left of both button columns, right aligned
                buffLine = UiKit.Outlined("Buffs", Root, "", 24, UiKit.Gold400);
                buffLine.alignment = TextAnchor.UpperRight;
                UiKit.Place(buffLine.rectTransform, new Vector2(1, 1), new Vector2(-28 - SecondColumn - IconSize - 24, -30), new Vector2(560, 34),
                    new Vector2(1, 1));
                buffLine.transform.SetAsFirstSibling();
            }
            buffLine.text = text ?? "";
            buffLine.gameObject.SetActive(!string.IsNullOrEmpty(text));
        }

        // ---------- fade (walking through doors and between districts) ----------

        void BuildFade()
        {
            fade = UiKit.Panel("Fade", canvas.transform, new Color(UiKit.Surface900.r, UiKit.Surface900.g, UiKit.Surface900.b, 0));
            UiKit.Stretch(fade.rectTransform);
            fade.raycastTarget = false;
            fade.gameObject.SetActive(false);
        }

        /// <summary>Fades the screen to (1) or from (0) dark over a few frames.</summary>
        public async Awaitable FadeTo(float alpha, float seconds)
        {
            fade.gameObject.SetActive(true);
            fade.transform.SetAsLastSibling();
            var from = fade.color.a;
            for (var t = 0f; t < seconds; t += Time.unscaledDeltaTime)
            {
                SetFade(Mathf.Lerp(from, alpha, Mathf.SmoothStep(0, 1, t / seconds)));
                await Awaitable.NextFrameAsync();
            }
            SetFade(alpha);
            if (alpha <= 0) fade.gameObject.SetActive(false);
        }

        void SetFade(float a)
        {
            var c = fade.color;
            c.a = a;
            fade.color = c;
        }

        // ---------- quest log (top left, folds under the player plate) ----------

        void BuildTracker()
        {
            // the quests: top left, under the player plate
            var plate = UiKit.OutlinedBox("Tracker", Root, UiKit.Surface800, UiKit.RadiusM);
            trackerRect = (RectTransform)plate.transform.parent;
            UiKit.Place(trackerRect, new Vector2(0, 1), new Vector2(24, -24 - PlateH - 14), new Vector2(LeftColumn - 24, 120), new Vector2(0, 1));
            trackerText = UiKit.Label("Text", plate.transform, "", 23, UiKit.TextOnDark, false, TextAnchor.UpperLeft);
            UiKit.Stretch(trackerText.rectTransform, 18, 12, 18, 12);
            trackerText.lineSpacing = 1.05f;
            tracker = trackerRect.gameObject;
            tracker.SetActive(false);
        }

        GameObject questCount;
        Text questCountText;
        Image questButtonFace;
        int questTotal;
        bool questsOpen;

        /// <summary>Whether the quest list is unfolded (tests and the autopilot).</summary>
        public bool QuestsOpen => questsOpen;

        /// <summary>
        /// The quest log button right of the player plate: a job sheet with a question mark and, in its top-right
        /// corner, a red count of active quests. A tap (or J) unfolds the list under the plate and folds it again.
        /// </summary>
        void BuildQuestButton(RectTransform plate)
        {
            var button = UiKit.Button("QuestButton", plate, "", new Vector2(QuestButton, QuestButton), ToggleQuests, UiKit.Tone.Rep, 20);
            UiKit.Place((RectTransform)button.transform, new Vector2(0, 1), new Vector2(PlateW + 12, -(PlateH - QuestButton) / 2),
                new Vector2(QuestButton, QuestButton), new Vector2(0, 1));
            var face = button.transform.Find("Face") ?? button.transform;
            questButtonFace = face.Find("Fill")?.GetComponent<Image>();
            var icon = UiKit.Rect("Icon", face).gameObject.AddComponent<Image>();
            icon.sprite = UiKit.Picture("Ui/zadania");
            icon.preserveAspect = true;
            icon.raycastTarget = false;
            UiKit.Stretch(icon.rectTransform, 9);

            var badge = UiKit.OutlinedBox("Count", button.transform, UiKit.Alert500, 15);
            var badgeRt = (RectTransform)badge.transform.parent;
            UiKit.Place(badgeRt, Vector2.one, new Vector2(10, 10), new Vector2(32, 32), new Vector2(1, 1));
            questCountText = UiKit.Outlined("Num", badge.transform, "", 18);
            foreach (var effect in questCountText.GetComponents<Shadow>())
                if (effect.GetType() == typeof(Shadow)) UnityEngine.Object.Destroy(effect);
            UiKit.Stretch(questCountText.rectTransform, 0, 1, 0, 0);
            questCount = badgeRt.gameObject;
            questCount.SetActive(false);
        }

        public void ToggleQuests() => SetQuestsOpen(!questsOpen);

        public void SetQuestsOpen(bool open)
        {
            questsOpen = open;
            tracker.SetActive(open);
            // the button stays lit while the list is out
            if (questButtonFace) questButtonFace.color = open ? UiKit.Buds400 : UiKit.Rep400;
            if (open) FitTracker();
        }

        void FitTracker()
        {
            Canvas.ForceUpdateCanvases();
            trackerRect.sizeDelta = new Vector2(LeftColumn - 24, trackerText.preferredHeight + 28);
        }

        /// <summary>Lists active quests (title in lime and what to do next) in the folding log; the button shows how many.</summary>
        public void SetQuests(IReadOnlyList<(string title, string objective)> quests)
        {
            questTotal = quests.Count;
            questCount.SetActive(questTotal > 0);
            questCountText.text = questTotal > 9 ? "9+" : questTotal.ToString();
            if (quests.Count == 0)
            {
                trackerText.text = "<color=#a9afbd>Brak aktywnych zadań. Szukaj postaci z wykrzyknikiem.</color>";
                if (questsOpen) FitTracker();
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
            if (questsOpen) FitTracker();
        }

        // ---------- toast (district / zone name) ----------

        void BuildToast()
        {
            // a slim banner at the top: it tells where you are without covering the game
            toastText = UiKit.Pill("Toast", Root, "", new Color(UiKit.Surface800.r, UiKit.Surface800.g, UiKit.Surface800.b, 0.85f), 20,
                new Vector2(240, 40), out toastRect);
            UiKit.Place(toastRect, new Vector2(0.5f, 1), new Vector2(0, -16), toastRect.sizeDelta, new Vector2(0.5f, 1));
            toastText.horizontalOverflow = HorizontalWrapMode.Overflow; // always one line
            toast = toastRect.gameObject;
            toast.SetActive(false);
        }

        /// <summary>Shows a short banner at the top for a few seconds (entering a district or a zone).</summary>
        public void ShowToast(string text, float seconds = 2.8f)
        {
            toastText.text = UiKit.Keys(text);
            var width = Mathf.Max(160, toastText.preferredWidth + 44);
            toastRect.sizeDelta = new Vector2(width, toastRect.sizeDelta.y);
            // centred, but never over the player plate and the quests on the left
            var screen = ((RectTransform)Root).rect.width;
            toastRect.anchoredPosition = new Vector2(Mathf.Max(0, LeftColumn + 16 + width / 2 - screen / 2), toastRect.anchoredPosition.y);
            toast.SetActive(true);
            toastUntil = Time.time + seconds;
        }

        public void Tick()
        {
            if (toast.activeSelf && Time.time > toastUntil) toast.SetActive(false);
            var kb = UnityEngine.InputSystem.Keyboard.current;
            var typing = EventSystem.current && EventSystem.current.currentSelectedGameObject &&
                         EventSystem.current.currentSelectedGameObject.GetComponent<InputField>();
            if (kb != null && hud.activeSelf && !typing && kb.jKey.wasPressedThisFrame) ToggleQuests();
        }

        // ---------- joystick ----------

        /// <summary>The fixed joystick on phones: centre from the bottom-right corner and radius, in UI units.</summary>
        const float StickInset = 112;
        const float StickR = 78;
        const float KnobTravel = 54;

        void BuildStick()
        {
            stickBase = UiKit.Panel("StickBase", Root, new Color(0.086f, 0.094f, 0.122f, 0.45f));
            stickBase.sprite = UiKit.Circle(64);
            stickBase.rectTransform.sizeDelta = UiKit.Mobile ? new Vector2(StickR * 2, StickR * 2) : new Vector2(180, 180);
            stickKnob = UiKit.Panel("StickKnob", Root, new Color(0.965f, 0.949f, 0.914f, 0.85f));
            stickKnob.sprite = UiKit.Circle(32);
            stickKnob.rectTransform.sizeDelta = UiKit.Mobile ? new Vector2(70, 70) : new Vector2(80, 80);
            foreach (var img in new[] { stickBase, stickKnob })
            {
                var anchor = UiKit.Mobile ? new Vector2(1, 0) : Vector2.zero;
                img.rectTransform.anchorMin = img.rectTransform.anchorMax = anchor;
                img.raycastTarget = false;
                img.gameObject.SetActive(false);
            }
        }

        public void UpdateStick(PlayerInput input)
        {
            if (UiKit.Mobile)
            {
                UpdateFixedStick(input);
                return;
            }
            var show = input.StickActive && !DialogOpen;
            stickBase.gameObject.SetActive(show);
            stickKnob.gameObject.SetActive(show);
            if (!show) return;
            var scale = canvas.scaleFactor;
            var origin = input.StickOrigin / scale;
            var offset = Vector2.ClampMagnitude((input.StickPosition - input.StickOrigin) / scale, 70);
            stickBase.rectTransform.anchoredPosition = origin;
            stickKnob.rectTransform.anchoredPosition = origin + offset;
            // the knob turns gold while running
            stickKnob.color = input.Run ? new Color(1f, 0.79f, 0.24f, 0.9f) : new Color(0.965f, 0.949f, 0.914f, 0.85f);
        }

        /// <summary>Phones: the stick always sits bottom right; the input reads its centre and radius from here.</summary>
        void UpdateFixedStick(PlayerInput input)
        {
            var show = hud.activeSelf && !DialogOpen;
            stickBase.gameObject.SetActive(show);
            stickKnob.gameObject.SetActive(show);
            // always the fixed stick on phones: the floating one would turn every tap (even on X) into an action
            input.FixedStick = true;
            if (!show) return;
            var home = new Vector2(-StickInset, StickInset);
            stickBase.rectTransform.anchoredPosition = home;
            var scale = canvas.scaleFactor;
            input.StickCenter = stickBase.rectTransform.position; // overlay canvas: world position = screen pixels
            input.StickRadius = StickR * scale;
            var offset = input.StickActive
                ? Vector2.ClampMagnitude((input.StickPosition - input.StickCenter) / scale, KnobTravel)
                : Vector2.zero;
            stickKnob.rectTransform.anchoredPosition = home + offset;
            stickBase.color = new Color(0.086f, 0.094f, 0.122f, input.StickActive ? 0.6f : 0.4f);
            stickKnob.color = input.Run ? new Color(1f, 0.79f, 0.24f, 0.95f) : new Color(0.965f, 0.949f, 0.914f, input.StickActive ? 0.95f : 0.7f);
        }

        /// <summary>
        /// Autopilot: taps the screen where the action button (or the dialog) is, through the UI hit test a finger
        /// goes through. Returns what was hit, or null when nothing takes the tap.
        /// </summary>
        public string TapForTest(bool dialogArea, bool closeButton = false)
        {
            var target = closeButton ? (RectTransform)dialog.transform.Find("Close")
                : dialogArea ? (RectTransform)dialog.transform : hintRect;
            var at = RectTransformUtility.WorldToScreenPoint(null, target.TransformPoint(target.rect.center));
            var data = new PointerEventData(EventSystem.current) { position = at };
            var hits = new List<RaycastResult>();
            EventSystem.current.RaycastAll(data, hits);
            foreach (var hit in hits)
            {
                var handler = ExecuteEvents.GetEventHandler<IPointerClickHandler>(hit.gameObject);
                if (!handler) continue;
                ExecuteEvents.Execute(handler, data, ExecuteEvents.pointerClickHandler);
                return handler.name;
            }
            return null;
        }

        static void Place(RectTransform rt, float x, float y, float w, float h)
        {
            rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
            rt.sizeDelta = new Vector2(w, h);
            rt.anchoredPosition = new Vector2(x, y);
        }
    }
}
