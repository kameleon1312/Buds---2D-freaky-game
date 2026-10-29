using System;
using System.Collections.Generic;
using Buds.Api;
using UnityEngine;
using UnityEngine.UI;

namespace Buds.UI
{
    /// <summary>
    /// Signing in with the account (e-mail + password) or opening one right here, then picking which of its buds to
    /// play, or making a new one straight onto the account. GameBootstrap does the talking (Supabase Auth, then the API). The phone turns
    /// upright while it is open (typing an e-mail and a password is easier that way): a tall, narrow window with the
    /// fields at the top, so the keyboard coming up from below never covers them.
    /// </summary>
    public sealed class LoginScreen
    {
        readonly GameObject root;
        readonly RectTransform formPage;
        readonly RectTransform budsPage;
        readonly InputField email;
        readonly InputField password;
        readonly InputField repeat;
        readonly Text intro;
        readonly Text repeatCaption;
        readonly Text error;
        readonly Button signIn;
        readonly Text signInLabel;
        readonly Button switchMode;
        readonly Text switchLabel;
        readonly Text hint;
        readonly RectTransform budList;
        readonly Text budsTitle;
        readonly Text budsError;
        readonly Action<string, string> onSignIn;
        readonly Action<string, string, string> onRegister;
        readonly Action<string> onPick;
        /// <summary>The form opens a new account instead of signing in.</summary>
        bool registering;

        /// <summary>The window: tall and narrow, held upright.</summary>
        const float W = 620;
        const float H = 920;
        const float Field = 520;
        const float BudRow = 88;

        public bool IsOpen => root.activeSelf;

        static Text Caption(Transform page, string text, float y)
        {
            var label = UiKit.Label("Caption", page, text, 22, UiKit.Ink, true, TextAnchor.LowerLeft);
            UiKit.Place(label.rectTransform, new Vector2(0.5f, 1), new Vector2(0, y), new Vector2(Field, 30), new Vector2(0.5f, 1));
            return label;
        }

        static void At(Component c, float y) =>
            UiKit.Place((RectTransform)c.transform, new Vector2(0.5f, 1), new Vector2(0, y), ((RectTransform)c.transform).sizeDelta, new Vector2(0.5f, 1));

        void Open()
        {
            if (!root.activeSelf) UiKit.SetPortrait(true);
            root.SetActive(true);
            root.transform.SetAsLastSibling();
        }

        public LoginScreen(Transform canvas, Transform safeRoot, Action<string, string> onSignIn, Action<string, string, string> onRegister,
            Action<string> onPick, Action onCreate, Action onBack)
        {
            this.onSignIn = onSignIn;
            this.onRegister = onRegister;
            this.onPick = onPick;
            // full-screen dark background, the window in the safe area
            var bg = UiKit.Panel("Login", canvas, UiKit.Surface900);
            bg.raycastTarget = true;
            UiKit.Stretch(bg.rectTransform);
            root = bg.gameObject;
            var area = UiKit.Rect("Safe", bg.transform);
            UiKit.Stretch(area);
            area.gameObject.AddComponent<SafeArea>();
            var group = UiKit.Rect("Group", area);
            UiKit.Place(group, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(W + 40, H + 40));
            group.gameObject.AddComponent<FitInParent>();
            var body = UiKit.Window("Window", group, new Vector2(W, H), "Twoje konto", onBack, out var window, out _);
            UiKit.Place(window, new Vector2(0.5f, 0.5f), Vector2.zero, window.sizeDelta);

            // ---------- e-mail + password ----------
            formPage = UiKit.Rect("Form", body);
            UiKit.Stretch(formPage);
            intro = UiKit.Label("Intro", formPage, "", 24, UiKit.InkSoft, false, TextAnchor.UpperCenter);
            UiKit.Place(intro.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -4), new Vector2(Field, 66), new Vector2(0.5f, 1));
            // labelled fields at the top, the error line under them, then the button: nothing hides behind the keyboard
            Caption(formPage, "E-mail", -86);
            email = UiKit.Input("Email", formPage, new Vector2(Field, 84), "ty@przyklad.pl", 30);
            UiKit.Place((RectTransform)email.transform.parent, new Vector2(0.5f, 1), new Vector2(0, -118), new Vector2(Field, 84),
                new Vector2(0.5f, 1));
            email.contentType = InputField.ContentType.EmailAddress;
            Caption(formPage, "Hasło", -220);
            password = UiKit.Input("Password", formPage, new Vector2(Field, 84), "hasło", 30);
            UiKit.Place((RectTransform)password.transform.parent, new Vector2(0.5f, 1), new Vector2(0, -252), new Vector2(Field, 84),
                new Vector2(0.5f, 1));
            password.contentType = InputField.ContentType.Password;
            password.inputType = InputField.InputType.Password;
            // a new account: the password twice
            repeatCaption = Caption(formPage, "Powtórz hasło", -354);
            repeat = UiKit.Input("Repeat", formPage, new Vector2(Field, 84), "hasło jeszcze raz", 30);
            UiKit.Place((RectTransform)repeat.transform.parent, new Vector2(0.5f, 1), new Vector2(0, -386), new Vector2(Field, 84),
                new Vector2(0.5f, 1));
            repeat.contentType = InputField.ContentType.Password;
            repeat.inputType = InputField.InputType.Password;
            error = UiKit.Label("Error", formPage, "", 21, UiKit.Alert700, false, TextAnchor.MiddleCenter);
            UiKit.Place(error.rectTransform, Vector2.zero, Vector2.zero, new Vector2(Field, 56), new Vector2(0.5f, 1));
            // the one gold action: signs in, or opens the account
            signIn = UiKit.Button("SignIn", formPage, "Zaloguj się", new Vector2(Field, 92), Submit, UiKit.Tone.Gold, 36);
            ((RectTransform)signIn.transform).sizeDelta = new Vector2(Field, 92);
            signInLabel = signIn.GetComponentInChildren<Text>();
            switchMode = UiKit.Button("Switch", formPage, "", new Vector2(Field, 72), () => SetMode(!registering), UiKit.Tone.Rep, 26);
            ((RectTransform)switchMode.transform).sizeDelta = new Vector2(Field, 72);
            switchLabel = switchMode.GetComponentInChildren<Text>();
            hint = UiKit.Label("Hint", formPage, "", 19, UiKit.InkSoft, false, TextAnchor.UpperCenter);
            ((RectTransform)hint.transform).sizeDelta = new Vector2(Field, 56);

            // ---------- the account's buds ----------
            budsPage = UiKit.Rect("Buds", body);
            UiKit.Stretch(budsPage);
            budsTitle = UiKit.Label("Title", budsPage, "", 28, UiKit.Ink, true, TextAnchor.UpperCenter);
            UiKit.Place(budsTitle.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -4), new Vector2(Field, 80), new Vector2(0.5f, 1));
            budList = UiKit.Rect("List", budsPage);
            UiKit.Place(budList, new Vector2(0.5f, 1), new Vector2(0, -96), new Vector2(Field, 5 * BudRow), new Vector2(0.5f, 1));
            budsError = UiKit.Label("Error", budsPage, "", 21, UiKit.Alert700, false, TextAnchor.MiddleCenter);
            UiKit.Place(budsError.rectTransform, new Vector2(0.5f, 0), new Vector2(0, 112), new Vector2(Field, 40), new Vector2(0.5f, 0));
            var create = UiKit.Button("Create", budsPage, "Stwórz nowego Buda na koncie", new Vector2(Field, 84), () => onCreate(), UiKit.Tone.Rep, 28);
            UiKit.Place((RectTransform)create.transform, new Vector2(0.5f, 0), new Vector2(0, 16), new Vector2(Field, 84), new Vector2(0.5f, 0));

            SetMode(false); // everything it touches exists by now
            root.SetActive(false);
        }

        void Submit()
        {
            if (registering) onRegister(email.text.Trim(), password.text, repeat.text);
            else onSignIn(email.text.Trim(), password.text);
        }

        /// <summary>Signing in, or opening a new account: the second password field, the wording and the layout follow.</summary>
        public void SetMode(bool register)
        {
            registering = register;
            intro.text = register
                ? "Załóż konto: twoje Budy, postępy i monety przetrwają zmianę telefonu."
                : "Zaloguj się kontem Buds: zagrasz swoim Budem na tym telefonie.";
            repeatCaption.gameObject.SetActive(register);
            repeat.transform.parent.gameObject.SetActive(register);
            // the consent line under the fields, then the error line, the gold button and the way to the other mode
            hint.gameObject.SetActive(register);
            UiKit.Place(hint.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -476), new Vector2(Field, 50), new Vector2(0.5f, 1));
            var y = register ? -528f : -346f;
            UiKit.Place(error.rectTransform, new Vector2(0.5f, 1), new Vector2(0, y), new Vector2(Field, 44), new Vector2(0.5f, 1));
            At(signIn, y - 48);
            At(switchMode, y - 156);
            switchLabel.text = register ? "Mam już konto: zaloguj się" : "Nie masz konta? Załóż je";
            hint.text = register ? "Zakładając konto, akceptujesz zasady prywatności Buds (strona Buds → Prywatność)." : "";
            error.text = "";
            SetBusy(false);
        }

        public bool Registering => registering;

        public void ShowForm(string message = null)
        {
            Open();
            formPage.gameObject.SetActive(true);
            budsPage.gameObject.SetActive(false);
            SetBusy(false, message);
        }

        public void SetBusy(bool busy, string message = null)
        {
            signIn.interactable = !busy;
            switchMode.interactable = !busy;
            signInLabel.text = registering ? busy ? "Zakładam…" : "Załóż konto" : busy ? "Loguję…" : "Zaloguj się";
            error.text = message ?? "";
            budsError.text = message ?? "";
            error.color = budsError.color = UiKit.Alert700;
        }

        /// <summary>A calm note while the button stays busy (not an error), e.g. while the server wakes up.</summary>
        public void ShowWaiting(string note)
        {
            error.text = budsError.text = note;
            error.color = budsError.color = UiKit.InkSoft;
        }

        /// <summary>The account's buds as big buttons (name · level); tapping one plays it.</summary>
        public void ShowBuds(string accountEmail, IReadOnlyList<AccountBudDto> buds)
        {
            Open();
            formPage.gameObject.SetActive(false);
            budsPage.gameObject.SetActive(true);
            budsError.text = "";
            for (var i = budList.childCount - 1; i >= 0; i--) UnityEngine.Object.Destroy(budList.GetChild(i).gameObject);
            budsTitle.text = buds.Count == 0
                ? $"{accountEmail}: na koncie nie ma jeszcze Buda"
                : buds.Count == 1 ? "Twój Bud" : "Którym Budem grasz?";
            for (var i = 0; i < buds.Count && i < 5; i++)
            {
                var b = buds[i];
                var slug = b.bud.slug;
                var button = UiKit.Button("Bud " + slug, budList, $"{b.bud.name}  ·  poziom {Math.Max(1, b.level)}", new Vector2(Field, BudRow - 14),
                    () => onPick(slug), UiKit.Tone.Buds, 30);
                UiKit.Place((RectTransform)button.transform, new Vector2(0.5f, 1), new Vector2(0, -i * BudRow), new Vector2(Field, BudRow - 14),
                    new Vector2(0.5f, 1));
            }
        }

        /// <summary>Closes the screen and turns the phone back to landscape for the game.</summary>
        public void Hide()
        {
            if (root.activeSelf) UiKit.SetPortrait(false);
            root.SetActive(false);
        }
    }
}
