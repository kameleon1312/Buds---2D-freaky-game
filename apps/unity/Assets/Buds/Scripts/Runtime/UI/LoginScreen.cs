using System;
using System.Collections.Generic;
using Buds.Api;
using UnityEngine;
using UnityEngine.UI;

namespace Buds.UI
{
    /// <summary>
    /// Signing in with the website account (e-mail + password) and picking which of its buds to play, or making a new
    /// one straight onto the account. GameBootstrap does the talking (Supabase Auth, then the API). The phone turns
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
        readonly Text error;
        readonly Button signIn;
        readonly Text signInLabel;
        readonly RectTransform budList;
        readonly Text budsTitle;
        readonly Text budsError;
        readonly Action<string, string> onSignIn;
        readonly Action<string> onPick;

        /// <summary>The window: tall and narrow, held upright.</summary>
        const float W = 620;
        const float H = 780;
        const float Field = 520;
        const float BudRow = 88;

        public bool IsOpen => root.activeSelf;

        static void Caption(Transform page, string text, float y)
        {
            var label = UiKit.Label("Caption", page, text, 22, UiKit.Ink, true, TextAnchor.LowerLeft);
            UiKit.Place(label.rectTransform, new Vector2(0.5f, 1), new Vector2(0, y), new Vector2(Field, 30), new Vector2(0.5f, 1));
        }

        void Open()
        {
            if (!root.activeSelf) UiKit.SetPortrait(true);
            root.SetActive(true);
            root.transform.SetAsLastSibling();
        }

        public LoginScreen(Transform canvas, Transform safeRoot, Action<string, string> onSignIn, Action<string> onPick, Action onCreate,
            Action onBack)
        {
            this.onSignIn = onSignIn;
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
            var intro = UiKit.Label("Intro", formPage, "Zaloguj się kontem ze strony Buds: zagrasz swoim Budem na tym telefonie.", 24,
                UiKit.InkSoft, false, TextAnchor.UpperCenter);
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
            error = UiKit.Label("Error", formPage, "", 21, UiKit.Alert700, false, TextAnchor.MiddleCenter);
            UiKit.Place(error.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -346), new Vector2(Field, 60), new Vector2(0.5f, 1));
            // the one gold action
            signIn = UiKit.Button("SignIn", formPage, "Zaloguj się", new Vector2(Field, 92), () => this.onSignIn(email.text.Trim(), password.text),
                UiKit.Tone.Gold, 36);
            UiKit.Place((RectTransform)signIn.transform, new Vector2(0.5f, 1), new Vector2(0, -418), new Vector2(Field, 92), new Vector2(0.5f, 1));
            signInLabel = signIn.GetComponentInChildren<Text>();
            var hint = UiKit.Label("Hint", formPage, "Nie masz konta? Załóż je na stronie Buds (Konto).", 21, UiKit.InkSoft, false,
                TextAnchor.UpperCenter);
            UiKit.Place(hint.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -534), new Vector2(Field, 64), new Vector2(0.5f, 1));

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

            root.SetActive(false);
        }

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
            signInLabel.text = busy ? "Loguję…" : "Zaloguj się";
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
