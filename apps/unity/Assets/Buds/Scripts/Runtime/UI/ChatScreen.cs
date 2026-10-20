using System;
using System.Collections.Generic;
using Buds.Api;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace Buds.UI
{
    /// <summary>
    /// The chat window (the bubble button next to the player plate, or T): what was said on this map, the eight quick
    /// call-outs, and a field for the player's own words (Enter or Wyślij sends; the server cleans them first). A
    /// line from another player tapped twice mutes that player on this device. A dark panel under the plate, so the
    /// street and the bubbles over the buds stay in sight; the world waits while it is open.
    /// </summary>
    public sealed class ChatScreen
    {
        const float Width = 560;
        const float Pad = 12;
        const float HeadH = 40;
        const float EmoteH = 38;
        const float InputH = 52;
        const float Gap = 8;
        const int LineFont = 19;
        const float MuteConfirmSeconds = 4f;

        readonly ChatLog log;
        readonly Action<string> onSend;
        readonly Action<string> onEmote;
        readonly Action<string> onMute;
        readonly GameObject root;
        readonly RectTransform lines;
        readonly Text status;
        readonly GameObject unmuteButton;
        readonly Text unmuteLabel;
        readonly InputField field;
        readonly List<GameObject> rows = new();
        string pendingMute;
        float pendingUntil;
        int focusIn; // frames until the field takes the keyboard (the key that opened the window is not typed in)
        bool dirty;
        bool wasTyping;

        public bool IsOpen => root.activeSelf;
        /// <summary>The field has the keyboard: game keys mean letters now.</summary>
        public bool Typing => IsOpen && field.isFocused;

        public ChatScreen(Transform hudRoot, ChatLog log, Action<string> send, Action<string> emote, Action<string> mute,
            Action unmuteAll)
        {
            this.log = log;
            onSend = send;
            onEmote = emote;
            onMute = mute;
            log.Changed += () => dirty = true;

            // the panel: from under the plate down to the bottom edge, on the left
            var frame = UiKit.Rect("Chat", hudRoot);
            frame.anchorMin = Vector2.zero;
            frame.anchorMax = new Vector2(0, 1);
            frame.pivot = new Vector2(0, 1);
            frame.offsetMin = new Vector2(24, 24);
            frame.offsetMax = new Vector2(24 + Width, -GameUi.UnderPlate);
            var drop = UiKit.Shape("Drop", frame, UiKit.Outline, UiKit.RadiusL).rectTransform;
            UiKit.Stretch(drop, 0, -6, 0, 6);
            var panel = UiKit.OutlinedBox("Panel", frame, new Color(UiKit.Surface800.r, UiKit.Surface800.g, UiKit.Surface800.b, 0.96f),
                UiKit.RadiusL);
            UiKit.Stretch((RectTransform)panel.transform.parent);
            var body = UiKit.Rect("Body", panel.transform);
            UiKit.Stretch(body, Pad);
            // taps on the panel stay on the panel (never reach the street behind it)
            panel.raycastTarget = true;

            // head: title, who is around, "odcisz", close
            var title = UiKit.Outlined("Title", body, "Czat", 26, UiKit.Buds400, TextAnchor.MiddleLeft);
            UiKit.Place(title.rectTransform, new Vector2(0, 1), Vector2.zero, new Vector2(90, HeadH), new Vector2(0, 1));
            status = UiKit.Label("Status", body, "", 17, UiKit.TextOnDarkMuted, false, TextAnchor.MiddleLeft);
            UiKit.Place(status.rectTransform, new Vector2(0, 1), new Vector2(84, 0), new Vector2(230, HeadH), new Vector2(0, 1));
            var unmute = UiKit.Button("Unmute", body, "Odcisz", new Vector2(130, 34), () => unmuteAll?.Invoke(), UiKit.Tone.Rep, 16);
            UiKit.Place((RectTransform)unmute.transform, new Vector2(1, 1), new Vector2(-50, -3), new Vector2(130, 34), new Vector2(1, 1));
            unmuteButton = unmute.gameObject;
            unmuteLabel = unmute.GetComponentInChildren<Text>();
            var close = UiKit.Button("Close", body, "X", new Vector2(40, 36), Hide, UiKit.Tone.Alert, 20);
            UiKit.Place((RectTransform)close.transform, new Vector2(1, 1), new Vector2(0, -2), new Vector2(40, 36), new Vector2(1, 1));

            // the lines: newest at the bottom, older ones slide up and out of sight
            const float emotesBottom = InputH + Gap + 6;
            const float emotesH = EmoteH * 2 + Gap;
            var view = UiKit.Rect("Lines", body);
            UiKit.Stretch(view, 0, emotesBottom + emotesH + Gap, 0, HeadH + Gap);
            view.gameObject.AddComponent<RectMask2D>();
            lines = UiKit.Rect("Stack", view);
            UiKit.Stretch(lines);

            // the quick call-outs: two rows of four
            var emotes = UiKit.Rect("Emotes", body);
            emotes.anchorMin = Vector2.zero;
            emotes.anchorMax = new Vector2(1, 0);
            emotes.pivot = new Vector2(0.5f, 0);
            emotes.offsetMin = new Vector2(0, emotesBottom);
            emotes.offsetMax = new Vector2(0, emotesBottom + emotesH);
            for (var i = 0; i < LiveProtocol.Emotes.Length; i++)
            {
                var (id, text) = LiveProtocol.Emotes[i];
                var b = UiKit.Button("Emote " + id, emotes, text, new Vector2(100, EmoteH - 4), () => onEmote?.Invoke(id), UiKit.Tone.Rep, 17);
                var rt = (RectTransform)b.transform;
                int col = i % 4, row = i / 4;
                rt.anchorMin = new Vector2(col / 4f, row == 0 ? 0.5f : 0);
                rt.anchorMax = new Vector2((col + 1) / 4f, row == 0 ? 1 : 0.5f);
                rt.offsetMin = new Vector2(col == 0 ? 0 : Gap / 2, row == 0 ? Gap / 2 + 4 : 4);
                rt.offsetMax = new Vector2(col == 3 ? 0 : -Gap / 2, row == 0 ? 0 : -Gap / 2);
            }

            // the field and Wyślij
            field = UiKit.Input("Field", body, new Vector2(Width - Pad * 2 - 140, InputH), "Napisz coś…", 21);
            var fieldRt = (RectTransform)field.transform.parent;
            fieldRt.anchorMin = Vector2.zero;
            fieldRt.anchorMax = new Vector2(1, 0);
            fieldRt.pivot = new Vector2(0, 0);
            fieldRt.offsetMin = new Vector2(0, 4);
            fieldRt.offsetMax = new Vector2(-140, 4 + InputH);
            field.characterLimit = ChatLog.MaxLength;
            field.lineType = InputField.LineType.SingleLine;
            field.textComponent.alignment = TextAnchor.MiddleLeft;
            ((Text)field.placeholder).alignment = TextAnchor.MiddleLeft;
            field.onEndEdit.AddListener(_ => EndEdit());
            var sendButton = UiKit.Button("Send", body, "Wyślij", new Vector2(130, InputH), Send, UiKit.Tone.Gold, 22);
            // its lip hangs under it: the face lines up with the field
            UiKit.Place((RectTransform)sendButton.transform, new Vector2(1, 0), new Vector2(0, 10), new Vector2(130, InputH - 6),
                new Vector2(1, 0));

            root = frame.gameObject;
            root.SetActive(false);
        }

        public void Open()
        {
            root.SetActive(true);
            root.transform.SetAsLastSibling();
            log.MarkRead();
            pendingMute = null;
            Redraw();
            // the keyboard goes to the field at once on a PC; on a phone only when the field is tapped
            focusIn = Application.isMobilePlatform ? 0 : 2;
        }

        public void Hide()
        {
            if (!root.activeSelf) return;
            if (field.isFocused) field.DeactivateInputField();
            root.SetActive(false);
            pendingMute = null;
        }

        public void Toggle()
        {
            if (IsOpen) Hide();
            else Open();
        }

        /// <summary>The line under the title: who is around, or that there is no connection.</summary>
        public void SetStatus(bool online, int others)
        {
            status.text = !online ? "Brak połączenia" : others == 0 ? "Nikogo w pobliżu" : $"W pobliżu: {Players(others)}";
        }

        /// <summary>"1 gracz", "3 graczy"… (Polish counts).</summary>
        public static string Players(int n)
        {
            var tens = n % 100 / 10;
            var units = n % 10;
            var word = n == 1 ? "gracz" : tens != 1 && units is >= 2 and <= 4 ? "gracze" : "graczy";
            return $"{n} {word}";
        }

        /// <summary>Called every frame while open: Esc closes (once the field has let go of it), the field takes focus.</summary>
        public void Tick()
        {
            if (!IsOpen) return;
            if (focusIn > 0 && --focusIn == 0)
            {
                field.Select();
                field.ActivateInputField();
            }
            var kb = Keyboard.current;
            // Esc while typing only stops the typing; Esc again closes the window
            if (kb != null && kb.escapeKey.wasPressedThisFrame && !field.isFocused && !wasTyping) Hide();
            wasTyping = field.isFocused;
            if (pendingMute != null && Time.unscaledTime > pendingUntil)
            {
                pendingMute = null;
                dirty = true;
            }
            if (dirty) Redraw();
            if (log.Unread > 0) log.MarkRead();
        }

        void EndEdit()
        {
            var kb = Keyboard.current;
            var enter = kb != null && (kb.enterKey.wasPressedThisFrame || kb.numpadEnterKey.wasPressedThisFrame);
            // a phone's "done" sends; a click somewhere else on a PC only stops the typing
            if (enter || (Application.isMobilePlatform && !field.wasCanceled))
            {
                Send();
                if (!Application.isMobilePlatform && IsOpen) focusIn = 1; // keep typing
            }
        }

        void Send()
        {
            var text = ChatLog.Prepare(field.text);
            field.text = "";
            if (text != null) onSend?.Invoke(text);
        }

        /// <summary>Puts typed words in the field (the autopilot).</summary>
        public void Type(string text) => field.text = text ?? "";

        /// <summary>Sends what is in the field (the autopilot presses Wyślij).</summary>
        public void PressSend() => Send();

        void Redraw()
        {
            dirty = false;
            foreach (var r in rows) UnityEngine.Object.Destroy(r);
            rows.Clear();
            unmuteButton.SetActive(log.MutedCount > 0);
            if (unmuteLabel) unmuteLabel.text = $"Odcisz ({log.MutedCount})";
            var width = Width - Pad * 2 - 4;
            var y = 0f;
            // newest first, stacked upwards from the bottom; what doesn't fit is cut off by the view
            for (var i = log.Lines.Count - 1; i >= 0; i--)
            {
                var line = log.Lines[i];
                var rt = UiKit.Rect("Line", lines);
                rt.anchorMin = rt.anchorMax = rt.pivot = Vector2.zero;
                var text = UiKit.Label("Text", rt, LineText(line), LineFont, UiKit.TextOnDark, false, TextAnchor.UpperLeft);
                text.supportRichText = true;
                var settings = text.GetGenerationSettings(new Vector2(width - 8, 0));
                var h = text.cachedTextGeneratorForLayout.GetPreferredHeight(text.text, settings) / text.pixelsPerUnit + 6;
                rt.sizeDelta = new Vector2(width, h);
                rt.anchoredPosition = new Vector2(0, y);
                UiKit.Stretch(text.rectTransform, 4, 2, 4, 2);
                y += h;
                // someone else's line: tap twice to mute them
                if (line.Id != null && !line.Mine)
                {
                    var hit = rt.gameObject.AddComponent<Image>();
                    hit.color = line.Id == pendingMute ? new Color(UiKit.Alert500.r, UiKit.Alert500.g, UiKit.Alert500.b, 0.25f) : Color.clear;
                    var button = rt.gameObject.AddComponent<Button>();
                    button.transition = Selectable.Transition.None;
                    var id = line.Id;
                    button.onClick.AddListener(() => TapLine(id));
                }
                rows.Add(rt.gameObject);
            }
        }

        string LineText(ChatLog.Line line)
        {
            var words = LiveUi.Escape(line.Text);
            if (line.Id == null) return $"<i><color=#a9afbd>{words}</color></i>";
            if (line.Id == pendingMute) return $"<color=#ff3d50><b>Wyciszyć: {LiveUi.Escape(line.Name)}?</b> Dotknij jeszcze raz.</color>";
            var colour = line.Mine ? "#a3e635" : "#4cc7ff";
            return $"<b><color={colour}>{LiveUi.Escape(line.Name)}:</color></b> {words}";
        }

        void TapLine(string id)
        {
            if (pendingMute == id && Time.unscaledTime <= pendingUntil)
            {
                pendingMute = null;
                onMute?.Invoke(id);
                return;
            }
            pendingMute = id;
            pendingUntil = Time.unscaledTime + MuteConfirmSeconds;
            dirty = true;
        }
    }
}
