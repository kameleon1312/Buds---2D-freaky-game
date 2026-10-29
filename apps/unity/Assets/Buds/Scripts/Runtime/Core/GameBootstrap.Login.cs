using System;
using System.IO;
using Buds.Api;
using Buds.Characters;
using Buds.UI;
using UnityEngine;

namespace Buds.Core
{
    /// <summary>
    /// Playing with the account: e-mail + password straight to Supabase Auth (public settings from
    /// GET /v1/auth/config), then the account's buds from the API. A new account is opened on the game's server
    /// (POST /v1/auth/signup, ready at once) and signed into right away. Picking one gets this device its own player token
    /// (POST /v1/account/buds/:slug/device), so from then on the game starts like any paired bud. A bud created while
    /// signed in goes onto the account.
    /// </summary>
    public sealed partial class GameBootstrap
    {
        const string LoginFailed = "Coś poszło nie tak. Spróbuj jeszcze raz.";

        LoginScreen loginScreen;
        /// <summary>The signed-in account's access token while the login screen is in use (never saved).</summary>
        string accountToken;
        string accountEmail;
        /// <summary>A sign-in or bud pick is in flight: further taps are ignored until it ends.</summary>
        bool signingIn;

        async Awaitable OpenLogin()
        {
            HidePairing();
            api = new BudsApi(PlayerSession.ApiBaseUrl);
            loginScreen ??= new LoginScreen(ui.FullScreen, ui.Root, (email, password) => _ = SignIn(email, password),
                (email, password, repeat) => _ = Register(email, password, repeat), slug => _ = PickAccountBud(slug),
                () =>
                {
                    loginScreen.Hide();
                    _ = OpenCreator();
                }, () =>
                {
                    loginScreen.Hide();
                    accountToken = null;
                    ShowPairing();
                });
            if (accountToken != null)
            {
                signingIn = true;
                try
                {
                    await ShowAccountBuds();
                }
                finally
                {
                    signingIn = false;
                }
                return;
            }
            loginScreen.ShowForm();
        }

        /// <summary>Opens a new account (checked here first, then by the server), then signs straight into it.</summary>
        async Awaitable Register(string email, string password, string repeat)
        {
            if (signingIn) return;
            email = email?.Trim().ToLowerInvariant();
            var problem = AccountForm.Problem(email, password, repeat);
            if (problem != null)
            {
                loginScreen.SetBusy(false, problem);
                return;
            }
            signingIn = true;
            loginScreen.SetBusy(true);
            _ = WakeUpNote();
            try
            {
                await api.SignUp(email, password);
            }
            catch (ApiException e)
            {
                loginScreen.SetBusy(false, e.Message);
                signingIn = false;
                return;
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                loginScreen.SetBusy(false, LoginFailed);
                signingIn = false;
                return;
            }
            signingIn = false;
            await SignIn(email, password);
        }

        async Awaitable SignIn(string email, string password)
        {
            if (signingIn) return;
            email = email?.Trim();
            if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password))
            {
                loginScreen.SetBusy(false, "Wpisz e-mail i hasło.");
                return;
            }
            signingIn = true;
            loginScreen.SetBusy(true);
            _ = WakeUpNote();
            try
            {
                var config = await api.GetAuthConfig();
                if (!config.enabled)
                {
                    loginScreen.SetBusy(false, "Logowanie na konto nie jest jeszcze włączone na tym serwerze.");
                    return;
                }
                var signedIn = await BudsApi.SignIn(config, email, password);
                accountToken = signedIn.access_token;
                accountEmail = signedIn.user?.email ?? email;
                await ShowAccountBuds();
            }
            catch (ApiException e)
            {
                loginScreen.SetBusy(false, e.Message);
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                loginScreen.SetBusy(false, LoginFailed);
            }
            finally
            {
                signingIn = false;
            }
        }

        /// <summary>Lists the account's buds; with exactly one the game goes straight in. Runs inside a sign-in.</summary>
        async Awaitable ShowAccountBuds()
        {
            try
            {
                var list = await api.GetAccountBuds(accountToken);
                var buds = list?.buds ?? Array.Empty<AccountBudDto>();
                if (buds.Length == 1 && buds[0]?.bud != null)
                {
                    await EnterAccountBud(buds[0].bud.slug);
                    return;
                }
                loginScreen.ShowBuds(accountEmail, buds);
            }
            catch (ApiException e)
            {
                if (e.Status == 401)
                {
                    accountToken = null;
                    loginScreen.ShowForm("Sesja wygasła. Zaloguj się jeszcze raz.");
                }
                else loginScreen.SetBusy(false, e.Message);
            }
        }

        /// <summary>A sleeping server (free hosting) can take up to a minute to answer: say so instead of looking stuck.</summary>
        async Awaitable WakeUpNote()
        {
            await Awaitable.WaitForSecondsAsync(5f);
            // no text over the form: the corner spinner keeps turning; only after a long wait a short note under the fields
            await Awaitable.WaitForSecondsAsync(10f);
            if (signingIn && loginScreen.IsOpen) loginScreen.ShowWaiting("Serwer się budzi, chwila…");
        }

        /// <summary>A bud tapped on the account's list.</summary>
        async Awaitable PickAccountBud(string slug)
        {
            if (signingIn) return;
            signingIn = true;
            loginScreen.SetBusy(true);
            _ = WakeUpNote();
            try
            {
                await EnterAccountBud(slug);
            }
            catch (ApiException e)
            {
                loginScreen.SetBusy(false, e.Message);
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                loginScreen.SetBusy(false, LoginFailed);
            }
            finally
            {
                signingIn = false;
            }
        }

        /// <summary>This device gets its own token for the bud; the session is saved like after pairing.</summary>
        async Awaitable EnterAccountBud(string slug)
        {
            var res = await api.DeviceToken(accountToken, slug);
            var device = new PlayerSession(res.token, res.bud.slug);
            device.Save();
            look = res.bud.look;
            var tex = await api.GetSheet(res.bud.slug);
            var completed = await LoadCompleted(device);
            loginScreen.Hide();
            EnterWorld(res.bud.name, res.bud.xp, new BudSheet(tex, true), device, completed);
            ui.ShowToast($"Zalogowano: {res.bud.name}", 2.5f);
            accountToken = null; // the device token is all the game keeps
        }

        /// <summary>
        /// Usage: Buds.exe -buds-api URL -buds-login-demo -buds-login-email E -buds-login-password P -buds-autoshot dir.
        /// Shoots the form, a wrong password, then signs in for real (one bud: straight into the world; more: the list).
        /// </summary>
        async Awaitable LoginDemo(string shots)
        {
            Directory.CreateDirectory(shots);
            var email = CommandLine.Get("-buds-login-email") ?? "";
            var password = CommandLine.Get("-buds-login-password") ?? "";
            async Awaitable Shot(string name, float wait = 0.6f)
            {
                await Awaitable.WaitForSecondsAsync(wait);
                ScreenCapture.CaptureScreenshot(Path.Combine(shots, name));
                await Awaitable.WaitForSecondsAsync(0.3f);
            }
            await OpenLogin();
            loginScreen.SetMode(true);
            await Register("zly-adres", "krotkie", "inne");
            await Shot("l0-register.png");
            loginScreen.SetMode(false);
            await Shot("l1-form.png");
            await SignIn(email, password + "-zle");
            await Shot("l2-wrong-password.png");
            await SignIn(email, password);
            await Shot(loginScreen.IsOpen ? "l3-bud-list.png" : "l3-world.png", 2.5f);
            Debug.Log($"[Buds] login demo: {(loginScreen.IsOpen ? "list" : "world")}");
        }
    }
}
