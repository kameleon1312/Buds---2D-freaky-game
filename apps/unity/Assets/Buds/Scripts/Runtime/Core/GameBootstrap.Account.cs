using System;
using Buds.Api;
using Buds.UI;
using UnityEngine;
using UnityEngine.Rendering.Universal;

namespace Buds.Core
{
    /// <summary>
    /// The bud and its data from inside the game (docs/konto.md): Twój Bud → Profil → Konto (a new name, every other
    /// device signed out, the data copied out, the privacy policy and the terms, deleting the bud) and → Ustawienia
    /// (smoothness, graphics, vibrations, numbers). Everything about the bud goes through the server; the settings
    /// stay on this device and apply at once.
    /// </summary>
    public sealed partial class GameBootstrap
    {
        AccountScreen accountScreen;
        SettingsScreen settingsScreen;
        /// <summary>The website (from the server's public settings), for its privacy and terms pages.</summary>
        string siteUrl;

        void OpenAccount()
        {
            accountScreen ??= new AccountScreen(ui.Root);
            accountScreen.Open(budName, session == null, new AccountScreen.Actions
            {
                Rename = name => _ = RenameBud(name),
                SignOutOthers = () => _ = SignOutOthers(),
                CopyData = () => _ = CopyData(),
                OpenPage = path => _ = OpenSitePage(path),
                Delete = typed => _ = DeleteBud(typed),
            });
        }

        void OpenSettings()
        {
            settingsScreen ??= new SettingsScreen(ui.Root);
            settingsScreen.Open();
        }

        /// <summary>A guest has no bud on the server: nothing to rename, sign out or delete there.</summary>
        bool NeedsServer()
        {
            if (session != null) return true;
            accountScreen.Done("Grasz jako gość, bez Buda na serwerze: tu nie ma czego zmieniać.", true);
            return false;
        }

        async Awaitable RenameBud(string name)
        {
            if (!NeedsServer()) return;
            try
            {
                var res = await api.RenameBud(session.Token, name);
                budName = res.bud.name;
                ui.ShowHud(budName, level, xp, Progression.NextLevelXp(xp));
                LiveRefreshMe(); // the others see the new name over the head
                accountScreen.Done("Imię zmienione.", false, budName);
            }
            catch (ApiException e)
            {
                accountScreen.Done(e.Message, true);
            }
        }

        async Awaitable SignOutOthers()
        {
            if (!NeedsServer()) return;
            try
            {
                var res = await api.SignOutOthers(session.Token);
                accountScreen.Done(res.signedOut > 0 ? $"Wylogowano inne urządzenia: {res.signedOut}." : "Żadne inne urządzenie nie było zalogowane.", false);
            }
            catch (ApiException e)
            {
                accountScreen.Done(e.Message, true);
            }
        }

        /// <summary>The bud's data (the server's JSON) to the clipboard: paste it anywhere to keep it.</summary>
        async Awaitable CopyData()
        {
            if (!NeedsServer()) return;
            try
            {
                GUIUtility.systemCopyBuffer = await api.ExportBud(session.Token);
                accountScreen.Done("Skopiowano wszystkie dane Buda do schowka (JSON).", false);
            }
            catch (ApiException e)
            {
                accountScreen.Done(e.Message, true);
            }
        }

        async Awaitable OpenSitePage(string path)
        {
            if (string.IsNullOrEmpty(siteUrl))
            {
                try
                {
                    siteUrl = (await api.GetAuthConfig())?.site;
                }
                catch (ApiException)
                {
                    // the page needs the address: say so below
                }
            }
            if (string.IsNullOrEmpty(siteUrl))
            {
                accountScreen.Done("Nie udało się otworzyć strony. Spróbuj, gdy będzie połączenie.", true);
                return;
            }
            Application.OpenURL(siteUrl.TrimEnd('/') + path);
        }

        /// <summary>
        /// The bud deleted for good (its name typed): the session goes too and the game starts over at the start screen,
        /// like signing out.
        /// </summary>
        async Awaitable DeleteBud(string typed)
        {
            if (!NeedsServer()) return;
            if (!AccountScreen.Confirms(typed, budName))
            {
                accountScreen.Done("Wpisz imię Buda, żeby potwierdzić.", true);
                return;
            }
            try
            {
                await api.DeleteBud(session.Token, typed);
                signedOut = true;
                StopLive();
                PlayerSession.Clear();
                UnityEngine.SceneManagement.SceneManager.LoadScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene().buildIndex);
            }
            catch (ApiException e)
            {
                accountScreen.Done(e.Message, true);
            }
        }

        /// <summary>
        /// Autopilot (-buds-account-demo, a paired bud): Profil, the account window, a new name, the settings with the
        /// lighter graphics, and at last deleting the bud (the game starts over at the start screen).
        /// </summary>
        async Awaitable AccountDemo(Func<string, Awaitable> shot)
        {
            await OpenPanel();
            panel.SelectTab(BudPanel.TabProfile);
            await Awaitable.WaitForSecondsAsync(0.4f);
            await shot("k1-profil.png");
            panel.Hide();
            OpenAccount();
            await Awaitable.WaitForSecondsAsync(0.3f);
            await shot("k2-konto.png");
            var name = budName;
            await RenameBud(name + "ek");
            await Awaitable.WaitForSecondsAsync(0.3f);
            await shot("k3-nowe-imie.png");
            await RenameBud(name); // too soon: the server says so
            await shot("k4-za-wczesnie.png");
            accountScreen.Hide();
            OpenSettings();
            GameSettings.Current.SetEconomy(true);
            await Awaitable.WaitForSecondsAsync(0.4f);
            await shot("k5-ustawienia.png");
            GameSettings.Current.SetEconomy(false);
            settingsScreen.Hide();
            Debug.Log($"[AutoPilot] account demo: name now {budName}");
            OpenAccount();
            await DeleteBud(budName); // the scene starts over; Start takes the last shot
        }

        // ---------- settings ----------

        /// <summary>Applies the device's settings now and whenever they change (called once at start).</summary>
        void SetUpSettings()
        {
            var s = GameSettings.Current;
            s.Changed -= ApplySettings;
            s.Changed += ApplySettings;
            ApplySettings();
        }

        void ApplySettings()
        {
            var s = GameSettings.Current;
            Application.targetFrameRate = s.FrameRate;
            // the lighter look: no screen grade (one full-screen pass less), no small life around the bud
            var cam = Camera.main;
            var data = cam ? cam.GetUniversalAdditionalCameraData() : null;
            if (data) data.renderPostProcessing = !s.Economy;
            if (world)
                foreach (var life in world.GetComponentsInChildren<World.WorldLife>(true))
                    life.enabled = !s.Economy;
        }
    }
}
