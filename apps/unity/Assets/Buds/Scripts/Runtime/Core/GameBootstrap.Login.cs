using System;
using Buds.Api;
using Buds.Characters;
using Buds.UI;
using UnityEngine;

namespace Buds.Core
{
    /// <summary>
    /// Playing with the website account: e-mail + password straight to Supabase Auth (public settings from
    /// GET /v1/auth/config), then the account's buds from the API. Picking one gets this device its own player token
    /// (POST /v1/account/buds/:slug/device), so from then on the game starts like any paired bud. A bud created while
    /// signed in goes onto the account.
    /// </summary>
    public sealed partial class GameBootstrap
    {
        LoginScreen loginScreen;
        /// <summary>The signed-in account's access token while the login screen is in use (never saved).</summary>
        string accountToken;
        string accountEmail;
        bool signingIn;

        async Awaitable OpenLogin()
        {
            HidePairing();
            api = new BudsApi(PlayerSession.ApiBaseUrl);
            loginScreen ??= new LoginScreen(ui.FullScreen, ui.Root, (email, password) => _ = SignIn(email, password), slug => _ = PlayAccountBud(slug),
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
                await ShowAccountBuds();
                return;
            }
            loginScreen.ShowForm();
        }

        async Awaitable SignIn(string email, string password)
        {
            if (signingIn) return;
            if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password))
            {
                loginScreen.SetBusy(false, "Wpisz e-mail i hasło.");
                return;
            }
            signingIn = true;
            loginScreen.SetBusy(true);
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
            finally
            {
                signingIn = false;
            }
        }

        async Awaitable ShowAccountBuds()
        {
            try
            {
                var list = await api.GetAccountBuds(accountToken);
                var buds = list.buds ?? Array.Empty<AccountBudDto>();
                // one bud: play it right away
                if (buds.Length == 1)
                {
                    await PlayAccountBud(buds[0].bud.slug);
                    return;
                }
                loginScreen.ShowBuds(accountEmail, buds);
            }
            catch (ApiException e)
            {
                if (e.Status == 401) accountToken = null;
                loginScreen.ShowForm(e.Message);
            }
        }

        /// <summary>This device gets its own token for the bud; the session is saved like after pairing.</summary>
        async Awaitable PlayAccountBud(string slug)
        {
            if (signingIn) return;
            signingIn = true;
            loginScreen.SetBusy(true);
            try
            {
                var res = await api.DeviceToken(accountToken, slug);
                var device = new PlayerSession(res.token, res.bud.slug);
                device.Save();
                look = res.bud.look;
                var tex = await api.GetSheet(res.bud.slug);
                var completed = await LoadCompleted(device);
                loginScreen.Hide();
                EnterWorld(res.bud.name, res.bud.xp, new BudSheet(tex), device, completed);
                ui.ShowToast($"Zalogowano: {res.bud.name}", 2.5f);
                accountToken = null; // the device token is all the game keeps
            }
            catch (ApiException e)
            {
                loginScreen.SetBusy(false, e.Message);
            }
            finally
            {
                signingIn = false;
            }
        }
    }
}
