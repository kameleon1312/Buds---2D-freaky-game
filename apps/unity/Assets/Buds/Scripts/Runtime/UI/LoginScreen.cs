using System;
using System.Collections.Generic;
using Buds.Api;
using UnityEngine;
using UnityEngine.UI;

namespace Buds.UI
{
    /// <summary>
    /// Signing in with the website account (e-mail + password) and picking which of its buds to play, or making a new
    /// one straight onto the account. GameBootstrap does the talking (Supabase Auth, then the API).
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

        public bool IsOpen => root.activeSelf;

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
            UiKit.Place(group, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(760, 620));
            group.gameObject.AddComponent<FitInParent>();
            var body = UiKit.Window("Window", group, new Vector2(720, 600), "Twoje konto", onBack, out var window, out _);
            UiKit.Place(window, new Vector2(0.5f, 0.5f), Vector2.zero, window.sizeDelta);

            // ---------- e-mail + password ----------
            formPage = UiKit.Rect("Form", body);
            UiKit.Stretch(formPage);
            var intro = UiKit.Label("Intro", formPage, "Zaloguj się kontem ze strony Buds: zagrasz swoim Budem na tym telefonie.", 23,
                UiKit.InkSoft, false, TextAnchor.UpperCenter);
            UiKit.Place(intro.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -4), new Vector2(600, 64), new Vector2(0.5f, 1));
            email = UiKit.Input("Email", formPage, new Vector2(560, 84), "e-mail", 32);
            UiKit.Place((RectTransform)email.transform.parent, new Vector2(0.5f, 1), new Vector2(0, -84), new Vector2(560, 84),
                new Vector2(0.5f, 1));
            email.contentType = InputField.ContentType.EmailAddress;
            password = UiKit.Input("Password", formPage, new Vector2(560, 84), "hasło", 32);
            UiKit.Place((RectTransform)password.transform.parent, new Vector2(0.5f, 1), new Vector2(0, -188), new Vector2(560, 84),
                new Vector2(0.5f, 1));
            password.contentType = InputField.ContentType.Password;
            password.inputType = InputField.InputType.Password;
            error = UiKit.Label("Error", formPage, "", 22, UiKit.Alert700, false, TextAnchor.MiddleCenter);
            UiKit.Place(error.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -282), new Vector2(600, 56), new Vector2(0.5f, 1));
            // the one gold action
            signIn = UiKit.Button("SignIn", formPage, "Zaloguj się", new Vector2(440, 88), () => this.onSignIn(email.text.Trim(), password.text),
                UiKit.Tone.Gold, 36);
            UiKit.Place((RectTransform)signIn.transform, new Vector2(0.5f, 0), new Vector2(0, 44), new Vector2(440, 88), new Vector2(0.5f, 0));
            signInLabel = signIn.GetComponentInChildren<Text>();
            var hint = UiKit.Label("Hint", formPage, "Nie masz konta? Załóż je na stronie Buds (Konto).", 19, UiKit.InkSoft, false,
                TextAnchor.LowerCenter);
            UiKit.Place(hint.rectTransform, new Vector2(0.5f, 0), new Vector2(0, 0), new Vector2(600, 32), new Vector2(0.5f, 0));

            // ---------- the account's buds ----------
            budsPage = UiKit.Rect("Buds", body);
            UiKit.Stretch(budsPage);
            budsTitle = UiKit.Label("Title", budsPage, "", 26, UiKit.Ink, true, TextAnchor.UpperCenter);
            UiKit.Place(budsTitle.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -4), new Vector2(600, 40), new Vector2(0.5f, 1));
            budList = UiKit.Rect("List", budsPage);
            UiKit.Place(budList, new Vector2(0.5f, 1), new Vector2(0, -56), new Vector2(560, 330), new Vector2(0.5f, 1));
            budsError = UiKit.Label("Error", budsPage, "", 21, UiKit.Alert700, false, TextAnchor.MiddleCenter);
            UiKit.Place(budsError.rectTransform, new Vector2(0.5f, 0), new Vector2(0, 104), new Vector2(600, 30), new Vector2(0.5f, 0));
            var create = UiKit.Button("Create", budsPage, "Stwórz nowego Buda na koncie", new Vector2(500, 76), () => onCreate(), UiKit.Tone.Rep, 28);
            UiKit.Place((RectTransform)create.transform, new Vector2(0.5f, 0), new Vector2(0, 16), new Vector2(500, 76), new Vector2(0.5f, 0));

            root.SetActive(false);
        }

        public void ShowForm(string message = null)
        {
            root.SetActive(true);
            root.transform.SetAsLastSibling();
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
        }

        /// <summary>The account's buds as big buttons (name · level); tapping one plays it.</summary>
        public void ShowBuds(string accountEmail, IReadOnlyList<AccountBudDto> buds)
        {
            root.SetActive(true);
            root.transform.SetAsLastSibling();
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
                var button = UiKit.Button("Bud " + slug, budList, $"{b.bud.name}  ·  poziom {Math.Max(1, b.level)}", new Vector2(540, 60),
                    () => onPick(slug), UiKit.Tone.Buds, 28);
                UiKit.Place((RectTransform)button.transform, new Vector2(0.5f, 1), new Vector2(0, -i * 66), new Vector2(540, 60),
                    new Vector2(0.5f, 1));
            }
        }

        public void Hide() => root.SetActive(false);
    }
}
