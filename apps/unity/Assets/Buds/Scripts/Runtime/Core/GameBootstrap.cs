using System;
using System.IO;
using Buds.Api;
using Buds.Characters;
using Buds.Quests;
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
    public sealed partial class GameBootstrap : MonoBehaviour
    {
        const float InteractRange = 1.75f; // tiles, feet to sign centre

        GameUi ui;
        BudsApi api;
        WorldView world;
        BudController player;
        Sign nearby;
        int level = 1;
        Exit atExit;
        Zone atZone;
        BudSheet sheet;
        PlayerSession session; // null in guest mode
        string budName;
        int xp;
        QuestLog quests;
        QuestWorld questWorld;
        NpcView nearbyNpc;

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
                look = bud.look;
                var sheet = await api.GetSheet(bud.slug);
                EnterWorld(bud.name, bud.xp, new BudSheet(sheet), session, await LoadCompleted(session));
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
                look = res.bud.look;
                var paired = new PlayerSession(res.token, res.bud.slug);
                paired.Save();
                var sheet = await api.GetSheet(res.bud.slug);
                var completed = await LoadCompleted(paired);
                HidePairing();
                EnterWorld(res.bud.name, res.bud.xp, new BudSheet(sheet), paired, completed);
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
            // matches tools/export-guest-sheet.ts
            look = new BudLookDto { gender = "on", mood = "radosny", hair = "krotkie", outfit = "bluza" };
            EnterWorld("Gość", 0, new BudSheet(sheet), null, null);
        }

        void EnterWorld(string name, int budXp, BudSheet budSheet, PlayerSession budSession, string[] completed)
        {
            sheet = budSheet;
            session = budSession;
            budName = name;
            xp = budXp;
            level = Progression.Level(xp);
            ui.ShowHud(name, level, xp, Progression.NextLevelXp(xp));
            SetUpQuests(completed);
            SetUpPanel();
            SetUpCaches();
            SetUpMap();
            SetUpFights();
            // dev/test: start in another district (-buds-district las-palmas)
            LoadDistrict(CommandLine.Get("-buds-district") ?? Districts.Start, null);
            ui.HideLoading();

            var shots = CommandLine.Get("-buds-autoshot");
            if (shots != null) _ = AutoPilot(shots);
        }

        /// <summary>
        /// Builds a district or a room from its map file. Arriving from another district puts you next to the road
        /// back, leaving a room puts you in front of its door, entering a room just inside the doormat.
        /// </summary>
        void LoadDistrict(string districtId, string fromDistrict)
        {
            if (world) Destroy(world.gameObject);
            if (player) Destroy(player.gameObject);

            var map = MapFormat.Load(districtId);
            EnterMap(map);
            world = WorldView.Create(map);
            questWorld = QuestWorld.Create(world, quests);
            cacheWorld = CacheWorld.Create(world, caches);
            enemyWorld = EnemyWorld.Create(world, quests.Content);
            UpdateTracker();
            var at = fromDistrict != null ? map.ArrivalFrom(fromDistrict) : new Vector2Int(map.SpawnX, map.SpawnY);
            player = BudController.Spawn(sheet, world.CellCenter(at.x, at.y) + new Vector3(0, -0.3f, 0));
            player.Blocked = (x, y) => !map.IsWalkable(x, map.Height - 1 - y);
            player.Motor.SpeedMultiplier = 1 + gear.Speed / 100f;
            // walking into a room you face into it; stepping out of one you face the street
            if (map.IsInterior) player.Look(Vector2.up);
            else if (map.Doors.Exists(d => d.Target == fromDistrict)) player.Look(Vector2.down);

            var cam = Camera.main!.GetComponent<FollowCamera>();
            cam.target = player.transform;
            // rooms: a little room above the map so the whole back wall shows; around them, the map's dark base
            cam.bounds = new Rect(0, 0, map.Width, map.Height + (map.IsInterior ? 1.6f : 0));
            Camera.main.backgroundColor = map.BaseColor;
            cam.SnapToTarget();

            atExit = map.ExitAt(at.x, at.y);
            atZone = map.ZoneAt(at.x, at.y);
            ui.ShowToast(map.IsInterior || atZone == null ? map.Name : $"{map.Name} · {atZone.Name}");
        }

        void Update()
        {
            if (!player) return;
            ui.Tick();
            if (travelling) return;
            var input = player.Input;
            input.Blocked = ui.DialogOpen || (panel?.IsOpen ?? false) || (mapScreen?.IsOpen ?? false) ||
                            (fightScreen?.IsOpen ?? false);
            if (UpdateFight()) return;
            ui.UpdateStick(input);

            if (UpdateMapScreen(input)) return;
            if (UpdatePanel(input)) return;

            // quest offers wait for a choice: E / Enter accepts, Esc / Q declines, or tap a button
            if (ui.ChoiceOpen)
            {
                if (input.InteractPressed && input.InteractFromKey) ui.ChooseAccept();
                else if (input.CancelPressed) ui.ChooseDecline();
                return;
            }

            var cell = player.MapCell(world.Map.Height);
            CheckZone(cell);
            if (CheckExit(cell)) return;
            CheckQuestProgress(cell);
            Explore(cell);

            // what the bud can interact with: a person first, then an opponent, a cache, a door, a sign
            var feet = (Vector2)player.transform.position;
            var (mx, my) = FeetOnMap();
            nearbyNpc = questWorld.NearestNpc(feet, InteractRange);
            nearbyEnemy = nearbyNpc ? null : enemyWorld.Nearest(feet, InteractRange);
            nearbyCache = nearbyNpc || nearbyEnemy ? null : caches.Nearest(world.Map.Id, mx, my, CacheWorld.SearchRange);
            nearbyDoor = nearbyNpc || nearbyEnemy || nearbyCache != null ? null : FindNearbyDoor(feet);
            nearby = nearbyNpc || nearbyEnemy || nearbyCache != null || nearbyDoor != null ? null : FindNearbySign();
            ui.SetHint(nearbyNpc ? $"Rozmawiaj: {nearbyNpc.Data.name}  [E]"
                : nearbyEnemy ? $"Walcz: {nearbyEnemy.Data.name} (poz. {nearbyEnemy.Data.level})  [E]"
                : nearbyCache != null ? "Przeszukaj  [E]"
                : nearbyDoor != null ? $"Wejdź: {nearbyDoor.Name}  [E]"
                : nearby != null ? "Czytaj  [E]"
                : null);
            if (!ui.DialogOpen && CheckDoorPush(input, cell)) return;

            if (!input.InteractPressed) return;
            if (ui.DialogOpen) ui.HideDialog();
            else if (nearbyNpc) TalkTo(nearbyNpc);
            else if (nearbyEnemy) Challenge(nearbyEnemy);
            else if (nearbyCache != null) _ = OpenCache(nearbyCache);
            else if (nearbyDoor != null) EnterDoor(nearbyDoor);
            else if (nearby != null) ui.ShowDialog(nearby.Title, nearby.Text);
        }

        void CheckZone(Vector2Int cell)
        {
            var zone = world.Map.ZoneAt(cell.x, cell.y);
            if (zone == atZone) return;
            atZone = zone;
            if (zone != null) ui.ShowToast(zone.Name);
        }

        /// <summary>Walking onto a road out of the map travels to that district, or says why you can't yet.</summary>
        bool CheckExit(Vector2Int cell)
        {
            var exit = world.Map.ExitAt(cell.x, cell.y);
            if (exit == atExit) return false;
            atExit = exit;
            if (exit == null) return false;
            if (world.Map.IsInterior)
            {
                // the doormat: back out to the street
                _ = Travel(exit.DistrictId, world.Map.Id);
                return true;
            }
            var district = Districts.Get(exit.DistrictId);
            if (district == null) return false;
            // development builds skip the level gate so every district can be walked through
            if (Districts.CanEnter(district.Id, level) || (Debug.isDebugBuild && district.Open))
            {
                _ = Travel(district.Id, world.Map.Id);
                return true;
            }
            ui.ShowDialog(district.Name, Districts.ClosedReason(district, level));
            return false;
        }

        /// <summary>Puts the bud on the nearest walkable cell to (x, y) — used by the autopilot tour.</summary>
        void Teleport(int x, int y)
        {
            var map = world.Map;
            for (var r = 0; r < 20; r++)
            for (var dy = -r; dy <= r; dy++)
            for (var dx = -r; dx <= r; dx++)
            {
                if (Mathf.Max(Mathf.Abs(dx), Mathf.Abs(dy)) != r || !map.IsWalkable(x + dx, y + dy)) continue;
                player.Teleport(world.CellCenter(x + dx, y + dy) + new Vector3(0, -0.3f, 0));
                Camera.main!.GetComponent<FollowCamera>().SnapToTarget();
                return;
            }
        }

        static string Slug(string name)
        {
            var chars = name.ToLowerInvariant().Normalize(System.Text.NormalizationForm.FormD).ToCharArray();
            var sb = new System.Text.StringBuilder();
            foreach (var c in chars)
            {
                if (c is >= 'a' and <= 'z' or >= '0' and <= '9') sb.Append(c);
                else if (c == 'ł') sb.Append('l');
                else if (c == ' ' || c == '-') sb.Append('-');
            }
            return sb.ToString();
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
                // the bud is recreated on every district load, so always steer the current one
                player.Input.Override = dir2;
                await Awaitable.WaitForSecondsAsync(seconds);
                if (player) player.Input.Override = Vector2.zero;
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
                await Walk(Vector2.right, 0.8f);
                await Shot("02-walk.png");
                // running: the shot is taken mid-run, with the dust
                player.Input.OverrideRun = true;
                player.Input.Override = Vector2.left;
                await Shot("02-run.png");
                player.Input.Override = Vector2.zero;
                player.Input.OverrideRun = false;
                OpenMap();
                await Shot("02-map.png");
                mapScreen.Hide();
                var map = world.Map;
                if (map.Signs.Count > 0)
                {
                    var sign = map.Signs[0];
                    Teleport(sign.X, sign.Y + 1);
                    await Shot("03-near-sign.png");
                    input.PressInteract();
                    await Shot("04-dialog.png");
                    input.PressInteract();
                }

                if (CommandLine.Has("-buds-quest-demo")) await QuestDemo(Shot);

                // tour: every zone of every district (or just the current one without -buds-tour)
                var districts = CommandLine.Has("-buds-tour") ? Districts.All : new[] { Districts.Get(map.Id) };
                foreach (var district in districts)
                {
                    if (world.Map.Id != district.Id) LoadDistrict(district.Id, null);
                    await Shot($"{district.Id}-00-spawn.png");
                    var n = 1;
                    foreach (var zone in world.Map.Zones)
                    {
                        Teleport((zone.X0 + zone.X1) / 2, (zone.Y0 + zone.Y1) / 2);
                        await Shot($"{district.Id}-{n++:00}-{Slug(zone.Name)}.png");
                    }
                    if (CommandLine.Has("-buds-tour"))
                    {
                        await VisitRooms(Shot);
                        OpenMap();
                        await Shot($"{district.Id}-map.png");
                        mapScreen.Hide();
                    }
                }

                if (CommandLine.Has("-buds-gear-demo") && session != null) await GearDemo(Shot);
                if (CommandLine.Has("-buds-fight-demo") && session != null)
                {
                    if (world.Map.Id != Districts.Start) LoadDistrict(Districts.Start, null);
                    await FightDemo(Shot);
                }

                // travel: walk north out of the start district (development builds skip the level gate)
                if (CommandLine.Has("-buds-tour"))
                {
                    LoadDistrict(Districts.Start, null);
                    var north = world.Map.Exits.Find(e => e.Y0 == 0);
                    Teleport(north.X0 + 1, 3);
                    await Walk(Vector2.up, 1.5f);
                    await Shot($"travel-arrived-in-{world.Map.Id}.png");
                }
            }
            catch (Exception e)
            {
                Debug.LogException(e);
            }
            Application.Quit();
        }
    }
}
