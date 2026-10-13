using System;
using System.IO;
using Buds.Api;
using Buds.Characters;
using Buds.UI;
using Buds.World;
using UnityEngine;

namespace Buds.Core
{
    /// <summary>
    /// Entry point (the only object in the Main scene besides the camera).
    /// Flow: saved session → load bud → world; otherwise pairing screen (code from the website) or guest play.
    /// </summary>
    [DefaultExecutionOrder(100)] // after BudController has read input this frame
    public sealed class GameBootstrap : MonoBehaviour
    {
        const float InteractRange = 1.75f; // tiles, feet to sign centre

        GameUi ui;
        BudsApi api;
        WorldView world;
        BudController player;
        Sign nearby;
        int level = 1;
        Exit atExit;

        async void Start()
        {
            Application.targetFrameRate = 60;
            ui = new GameUi();
            api = new BudsApi(PlayerSession.ApiBaseUrl);

            var pairCode = CommandLine.Get("-buds-pair");
            if (pairCode != null)
            {
                await Connect(pairCode);
                return;
            }
            if (CommandLine.Has("-buds-guest"))
            {
                var shots = CommandLine.Get("-buds-autoshot");
                if (shots != null)
                {
                    // smoke run also captures the pairing screen before entering as a guest
                    Directory.CreateDirectory(shots);
                    ShowPairing("Przykładowy błąd: zły kod.");
                    await Awaitable.WaitForSecondsAsync(0.6f);
                    ScreenCapture.CaptureScreenshot(Path.Combine(shots, "00-pair.png"));
                    await Awaitable.WaitForSecondsAsync(0.4f);
                }
                StartAsGuest();
                return;
            }

            var session = PlayerSession.Load();
            if (session == null)
            {
                ShowPairing();
                return;
            }

            ui.ShowLoading("Wczytuję twojego Buda…");
            try
            {
                var bud = await api.GetMe(session.Token);
                var sheet = await api.GetSheet(bud.slug);
                EnterWorld(bud.name, bud.xp, new BudSheet(sheet));
            }
            catch (ApiException e) when (e.Status == 401)
            {
                PlayerSession.Clear();
                ShowPairing(e.Message);
            }
            catch (ApiException e)
            {
                ShowPairing(e.Message);
            }
        }

        bool pairingVisible;

        void ShowPairing(string error = null)
        {
            ui.ShowPair(code => _ = Connect(code), StartAsGuest);
            pairingVisible = true;
            if (error != null) ui.SetPairBusy(false, error);
        }

        void HidePairing()
        {
            ui.HidePair();
            pairingVisible = false;
        }

        async Awaitable Connect(string code)
        {
            code = (code ?? "").Trim().ToUpperInvariant();
            if (!pairingVisible) ShowPairing();
            if (code.Length != 6)
            {
                ui.SetPairBusy(false, "Kod ma 6 znaków.");
                return;
            }

            ui.SetPairBusy(true);
            api = new BudsApi(PlayerSession.ApiBaseUrl);
            try
            {
                var res = await api.Pair(code);
                new PlayerSession(res.token, res.bud.slug).Save();
                var sheet = await api.GetSheet(res.bud.slug);
                HidePairing();
                EnterWorld(res.bud.name, res.bud.xp, new BudSheet(sheet));
            }
            catch (ApiException e)
            {
                ui.SetPairBusy(false, e.Message);
            }
        }

        void StartAsGuest()
        {
            HidePairing();
            var sheet = Resources.Load<Texture2D>("Sheets/guest");
            if (!sheet)
            {
                Debug.LogError("Missing Resources/Sheets/guest.png");
                return;
            }
            EnterWorld("Gość", 0, new BudSheet(sheet));
        }

        void EnterWorld(string name, int xp, BudSheet sheet)
        {
            if (world) Destroy(world.gameObject);
            if (player) Destroy(player.gameObject);

            world = WorldView.Create(Village.Build());
            var map = world.Map;
            player = BudController.Spawn(sheet, world.CellCenter(map.SpawnX, map.SpawnY) + new Vector3(0, -0.3f, 0));

            var cam = Camera.main!.GetComponent<FollowCamera>();
            cam.target = player.transform;
            cam.bounds = new Rect(0, 0, map.Width, map.Height);
            cam.SnapToTarget();

            ui.HideLoading();
            level = Progression.Level(xp);
            ui.ShowHud(name, level, xp, Progression.NextLevelXp(xp));

            var shots = CommandLine.Get("-buds-autoshot");
            if (shots != null) _ = AutoPilot(shots);
        }

        void Update()
        {
            if (!player) return;
            var input = player.Input;
            input.Blocked = ui.DialogOpen;
            ui.UpdateStick(input);

            CheckExit();
            nearby = FindNearbySign();
            ui.SetHint(nearby != null ? "Czytaj  [E]" : null);

            if (!input.InteractPressed) return;
            if (ui.DialogOpen) ui.HideDialog();
            else if (nearby != null) ui.ShowDialog(nearby.Title, nearby.Text);
        }

        /// <summary>Walking onto a road out of the map tells you where it leads (travel comes with the next district).</summary>
        void CheckExit()
        {
            var cell = player.MapCell(world.Map.Height);
            Exit exit = null;
            foreach (var e in world.Map.Exits)
                if (e.Contains(cell.x, cell.y)) exit = e;
            if (exit == atExit) return;
            atExit = exit;
            if (exit == null) return;
            var district = Districts.Get(exit.DistrictId);
            if (district != null && !Districts.CanEnter(district.Id, level))
                ui.ShowDialog(district.Name, Districts.ClosedReason(district, level));
        }

        Sign FindNearbySign()
        {
            var feet = (Vector2)player.transform.position;
            foreach (var sign in world.Map.Signs)
            {
                if (Vector2.Distance(feet, world.CellCenter(sign.X, sign.Y)) <= InteractRange) return sign;
            }
            return null;
        }

        /// <summary>
        /// Automated smoke run for CI/dev: walks around, opens the sign, saves screenshots, quits.
        /// Usage: Buds.exe -buds-guest -buds-autoshot C:\path\to\dir
        /// </summary>
        async Awaitable AutoPilot(string dir)
        {
            Directory.CreateDirectory(dir);
            var input = player.Input;
            async Awaitable Walk(Vector2 dir2, float seconds)
            {
                input.Override = dir2;
                await Awaitable.WaitForSecondsAsync(seconds);
                input.Override = Vector2.zero;
            }
            async Awaitable Shot(string file)
            {
                await Awaitable.WaitForSecondsAsync(0.4f);
                ScreenCapture.CaptureScreenshot(Path.Combine(dir, file));
                await Awaitable.WaitForSecondsAsync(0.4f);
                Debug.Log($"[AutoPilot] {file} at {player.transform.position}");
            }

            try
            {
                await Shot("01-spawn.png");
                await Walk(Vector2.right, 0.55f);
                await Shot("02-walk-right.png");
                await Walk(Vector2.up, 0.9f);
                await Walk(Vector2.left, 0.9f);
                await Shot("03-near-sign.png");
                input.PressInteract();
                await Shot("04-dialog.png");
                input.PressInteract();
                await Walk(Vector2.down, 2.5f);
                await Shot("05-south.png");
                await Walk(Vector2.right, 6f);
                await Shot("06-east-collision.png");
                await Walk(Vector2.left, 6f);
                await Walk(Vector2.up, 6f);
                await Walk(Vector2.left, 4f);
                await Walk(Vector2.right, 1.4f);
                await Walk(Vector2.down, 2.2f);
                await Shot("07-houses.png");
            }
            catch (Exception e)
            {
                Debug.LogException(e);
            }
            Application.Quit();
        }
    }
}
