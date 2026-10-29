using System;
using Buds.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Buds.UI
{
    /// <summary>
    /// Konto i postać (Twój Bud → Profil → Konto): what a player can do with the bud and its data, the way stores
    /// expect from a game with accounts (docs/konto.md): a new name (once a week, the public name rules), every
    /// other device signed out, the bud's data copied out, the privacy policy and the terms, and deleting the bud
    /// for good with its name typed to confirm. The server checks everything; this only asks and shows.
    /// </summary>
    public sealed class AccountScreen
    {
        public sealed class Actions
        {
            public Action<string> Rename;
            public Action SignOutOthers;
            public Action CopyData;
            public Action<string> OpenPage;
            public Action<string> Delete;
        }

        readonly GameObject root;
        readonly InputField nameField;
        readonly Button saveName;
        readonly Text status;
        readonly GameObject dangerBox;
        readonly InputField confirmField;
        readonly Button deleteForGood;
        readonly Text confirmHint;
        readonly Text guestNote;
        Actions actions;
        string budName = "";
        bool busy;

        public bool IsOpen => root.activeSelf;

        public AccountScreen(Transform canvas)
        {
            var dim = UiKit.Panel("Account", canvas, new Color(0.086f, 0.094f, 0.122f, 0.72f));
            dim.raycastTarget = true;
            UiKit.Stretch(dim.rectTransform);
            root = dim.gameObject;
            var group = UiKit.Rect("Group", dim.transform);
            UiKit.Place(group, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(900, 700));
            group.gameObject.AddComponent<FitInParent>();
            var body = UiKit.Window("Window", group, new Vector2(860, 680), "Konto i postać", Hide, out var window, out _);
            UiKit.Place(window, new Vector2(0.5f, 0.5f), Vector2.zero, window.sizeDelta);
            const float W = 796;

            // the name
            var nameLabel = UiKit.Label("NameLabel", body, $"Imię Buda (zmienisz je raz na {RenameDays} dni)", 21, UiKit.Ink, true, TextAnchor.UpperLeft);
            UiKit.Place(nameLabel.rectTransform, new Vector2(0, 1), Vector2.zero, new Vector2(W, 28), new Vector2(0, 1));
            nameField = UiKit.Input("Name", body, new Vector2(520, 66), "Nowe imię", 28);
            nameField.characterLimit = 16;
            UiKit.Place((RectTransform)nameField.transform.parent, new Vector2(0, 1), new Vector2(0, -34), new Vector2(520, 66), new Vector2(0, 1));
            nameField.onValueChanged.AddListener(_ => Refresh());
            saveName = UiKit.Button("SaveName", body, "Zapisz imię", new Vector2(256, 66), () => Run(() => actions.Rename(nameField.text.Trim())), UiKit.Tone.Buds, 26);
            UiKit.Place((RectTransform)saveName.transform, new Vector2(1, 1), new Vector2(0, -34), new Vector2(256, 66), new Vector2(1, 1));

            // devices and data
            var others = UiKit.Button("Others", body, "Wyloguj inne urządzenia", new Vector2(390, 64), () => Run(() => actions.SignOutOthers()), UiKit.Tone.Rep, 23);
            UiKit.Place((RectTransform)others.transform, new Vector2(0, 1), new Vector2(0, -132), new Vector2(390, 64), new Vector2(0, 1));
            var data = UiKit.Button("Data", body, "Moje dane", new Vector2(390, 64), () => Run(() => actions.CopyData()), UiKit.Tone.Rep, 23);
            UiKit.Place((RectTransform)data.transform, new Vector2(1, 1), new Vector2(0, -132), new Vector2(390, 64), new Vector2(1, 1));
            var privacy = UiKit.Button("Privacy", body, "Prywatność", new Vector2(390, 64), () => actions.OpenPage("/prywatnosc"), UiKit.Tone.Rep, 23);
            UiKit.Place((RectTransform)privacy.transform, new Vector2(0, 1), new Vector2(0, -214), new Vector2(390, 64), new Vector2(0, 1));
            var terms = UiKit.Button("Terms", body, "Regulamin", new Vector2(390, 64), () => actions.OpenPage("/regulamin"), UiKit.Tone.Rep, 23);
            UiKit.Place((RectTransform)terms.transform, new Vector2(1, 1), new Vector2(0, -214), new Vector2(390, 64), new Vector2(1, 1));

            guestNote = UiKit.Label("Guest", body, "", 18, UiKit.InkSoft, false, TextAnchor.UpperLeft);
            UiKit.Place(guestNote.rectTransform, new Vector2(0, 1), new Vector2(0, -292), new Vector2(W, 48), new Vector2(0, 1));

            // deleting the bud: a red button opens the box where its name has to be typed
            var delete = UiKit.Button("Delete", body, "Usuń postać", new Vector2(300, 62), ToggleDanger, UiKit.Tone.Alert, 24);
            UiKit.Place((RectTransform)delete.transform, new Vector2(0, 1), new Vector2(0, -344), new Vector2(300, 62), new Vector2(0, 1));
            status = UiKit.Label("Status", body, "", 20, UiKit.InkSoft, true, TextAnchor.MiddleLeft);
            UiKit.Place(status.rectTransform, new Vector2(0, 1), new Vector2(318, -344), new Vector2(W - 318, 62), new Vector2(0, 1));

            var box = UiKit.OutlinedBox("Danger", body, UiKit.Hex("#fde3e5"), UiKit.RadiusM);
            dangerBox = box.transform.parent.gameObject;
            UiKit.Place((RectTransform)dangerBox.transform, new Vector2(0, 1), new Vector2(0, -420), new Vector2(W, 150), new Vector2(0, 1));
            var warn = UiKit.Label("Warn", box.transform,
                "To nieodwracalne: Bud zniknie z poziomem, ekwipunkiem, monetami, gemami i dystryktem. Zakupy nie są zwracane.",
                18, UiKit.Alert700, true, TextAnchor.UpperLeft);
            UiKit.Place(warn.rectTransform, new Vector2(0, 1), new Vector2(16, -10), new Vector2(W - 32, 46), new Vector2(0, 1));
            confirmHint = UiKit.Label("Hint", box.transform, "", 17, UiKit.Ink, false, TextAnchor.UpperLeft);
            UiKit.Place(confirmHint.rectTransform, new Vector2(0, 1), new Vector2(16, -58), new Vector2(W - 32, 24), new Vector2(0, 1));
            confirmField = UiKit.Input("Confirm", box.transform, new Vector2(460, 54), "Imię Buda", 24);
            UiKit.Place((RectTransform)confirmField.transform.parent, new Vector2(0, 0), new Vector2(16, 12), new Vector2(460, 54), new Vector2(0, 0));
            confirmField.onValueChanged.AddListener(_ => Refresh());
            deleteForGood = UiKit.Button("ForGood", box.transform, "Usuń na zawsze", new Vector2(290, 54), () => Run(() => actions.Delete(confirmField.text)), UiKit.Tone.Alert, 22);
            UiKit.Place((RectTransform)deleteForGood.transform, new Vector2(1, 0), new Vector2(-16, 16), new Vector2(290, 54), new Vector2(1, 0));
            dangerBox.SetActive(false);
            root.SetActive(false);
        }

        /// <summary>The week between renames (packages/shared account.ts RENAME_DAYS).</summary>
        public const int RenameDays = 7;

        public void Open(string name, bool guest, Actions acts)
        {
            actions = acts;
            budName = name ?? "";
            busy = false;
            nameField.text = budName;
            confirmField.text = "";
            dangerBox.SetActive(false);
            confirmHint.text = $"Wpisz imię Buda, żeby potwierdzić: {LiveUi.Escape(budName)}";
            guestNote.text = guest
                ? "Grasz bez konta: połącz Buda z kontem (Profil → Połącz z kontem), żeby nie stracić postępów z telefonem."
                : "Konto, hasło i usunięcie konta: strona Buds → Konto.";
            SetStatus("", false);
            Refresh();
            root.SetActive(true);
            root.transform.SetAsLastSibling();
        }

        public void Hide() => root.SetActive(false);

        void ToggleDanger()
        {
            dangerBox.SetActive(!dangerBox.activeSelf);
            confirmField.text = "";
            Refresh();
        }

        void Run(Action work)
        {
            if (busy) return;
            busy = true;
            SetStatus("Chwila…", false);
            Refresh();
            work();
        }

        /// <summary>The server's answer: what happened (or why not), and the buttons free again.</summary>
        public void Done(string message, bool error, string newName = null)
        {
            busy = false;
            if (newName != null)
            {
                budName = newName;
                nameField.SetTextWithoutNotify(newName);
                confirmHint.text = $"Wpisz imię Buda, żeby potwierdzić: {LiveUi.Escape(budName)}";
            }
            SetStatus(message, error);
            Refresh();
        }

        void SetStatus(string text, bool error)
        {
            status.text = text ?? "";
            status.color = error ? UiKit.Alert700 : UiKit.Buds600;
        }

        void Refresh()
        {
            var typed = (nameField.text ?? "").Trim();
            saveName.interactable = !busy && typed.Length >= 2 && typed != budName;
            deleteForGood.interactable = !busy && Confirms(confirmField.text, budName);
        }

        /// <summary>The typed name matches (case and spaces at the ends don't count), like account.ts confirmsName.</summary>
        public static bool Confirms(string typed, string name) =>
            !string.IsNullOrWhiteSpace(typed) &&
            string.Equals(typed.Trim(), (name ?? "").Trim(), StringComparison.CurrentCultureIgnoreCase);
    }

    /// <summary>
    /// Ustawienia (Twój Bud → Profil → Ustawienia): smoothness, graphics, vibrations and the numbers of blows, each a
    /// two-way switch that applies at once and stays on this device (<see cref="GameSettings"/>).
    /// </summary>
    public sealed class SettingsScreen
    {
        readonly GameObject root;
        readonly (Button a, Button b)[] rows = new (Button, Button)[4];

        public bool IsOpen => root.activeSelf;

        public SettingsScreen(Transform canvas)
        {
            var dim = UiKit.Panel("Settings", canvas, new Color(0.086f, 0.094f, 0.122f, 0.72f));
            dim.raycastTarget = true;
            UiKit.Stretch(dim.rectTransform);
            root = dim.gameObject;
            var group = UiKit.Rect("Group", dim.transform);
            UiKit.Place(group, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(860, 560));
            group.gameObject.AddComponent<FitInParent>();
            var body = UiKit.Window("Window", group, new Vector2(820, 530), "Ustawienia", Hide, out var window, out _);
            UiKit.Place(window, new Vector2(0.5f, 0.5f), Vector2.zero, window.sizeDelta);

            var s = GameSettings.Current;
            rows[0] = Row(body, 0, "Płynność", "Najlepiej przy 60 kl/s. 30 oszczędza baterię.", "30 kl/s", "60 kl/s",
                () => s.SetFrameRate(30), () => s.SetFrameRate(60));
            rows[1] = Row(body, 1, "Grafika", "Oszczędna: mniej efektów, dłużej na baterii.", "Oszczędna", "Pełna",
                () => s.SetEconomy(true), () => s.SetEconomy(false));
            rows[2] = Row(body, 2, "Wibracje", "Krótkie drgnięcie, gdy obrywasz.", "Wył.", "Wł.",
                () => s.SetVibration(false), () => s.SetVibration(true));
            rows[3] = Row(body, 3, "Liczby ciosów", "Obrażenia nad głowami w walce.", "Wył.", "Wł.",
                () => s.SetDamageNumbers(false), () => s.SetDamageNumbers(true));
            s.Changed += Refresh;
            root.SetActive(false);
        }

        (Button, Button) Row(Transform body, int i, string title, string note, string left, string right, Action onLeft, Action onRight)
        {
            const float RowH = 90;
            var card = UiKit.OutlinedBox("Row" + i, body, UiKit.Paper300, UiKit.RadiusM);
            UiKit.Place((RectTransform)card.transform.parent, new Vector2(0, 1), new Vector2(0, -i * (RowH + 8)), new Vector2(756, RowH), new Vector2(0, 1));
            var t = UiKit.Label("Title", card.transform, title, 24, UiKit.Ink, true, TextAnchor.UpperLeft);
            UiKit.Place(t.rectTransform, new Vector2(0, 1), new Vector2(18, -10), new Vector2(390, 30), new Vector2(0, 1));
            var n = UiKit.Label("Note", card.transform, note, 15, UiKit.InkSoft, false, TextAnchor.UpperLeft);
            UiKit.Place(n.rectTransform, new Vector2(0, 1), new Vector2(18, -42), new Vector2(370, 42), new Vector2(0, 1));
            n.lineSpacing = 0.9f;
            var a = UiKit.Button("Left", card.transform, left, new Vector2(160, 54), onLeft, UiKit.Tone.Rep, 21);
            UiKit.Place((RectTransform)a.transform, new Vector2(1, 0.5f), new Vector2(-188, 3), new Vector2(160, 54), new Vector2(1, 0.5f));
            var b = UiKit.Button("Right", card.transform, right, new Vector2(160, 54), onRight, UiKit.Tone.Rep, 21);
            UiKit.Place((RectTransform)b.transform, new Vector2(1, 0.5f), new Vector2(-18, 3), new Vector2(160, 54), new Vector2(1, 0.5f));
            return (a, b);
        }

        public void Open()
        {
            Refresh();
            root.SetActive(true);
            root.transform.SetAsLastSibling();
        }

        public void Hide() => root.SetActive(false);

        /// <summary>The chosen side of every switch in lime, the other one in the secondary blue.</summary>
        void Refresh()
        {
            var s = GameSettings.Current;
            Mark(rows[0], s.FrameRate == 30);
            Mark(rows[1], s.Economy);
            Mark(rows[2], !s.Vibration);
            Mark(rows[3], !s.DamageNumbers);
        }

        static void Mark((Button a, Button b) row, bool left)
        {
            Tint(row.a, left);
            Tint(row.b, !left);
        }

        static void Tint(Button button, bool chosen)
        {
            var face = button.transform.Find("Face/Fill")?.GetComponent<Image>();
            var lip = button.transform.Find("Lip")?.GetComponent<Image>();
            if (face) face.color = chosen ? UiKit.Buds400 : UiKit.Paper100;
            if (lip) lip.color = chosen ? UiKit.Buds600 : UiKit.Paper300;
        }
    }
}
