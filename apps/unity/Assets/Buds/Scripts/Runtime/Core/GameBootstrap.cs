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
            // a store build logs only warnings and errors (no per-frame chatter, nothing a player shouldn't see)
            if (!Debug.isDebugBuild) Debug.unityLogger.filterLogType = LogType.Warning;
            SetUpSettings(); // the player's smoothness and graphics (GameBootstrap.Account)
            // before a world is loaded the camera only shows behind the UI (notch side): keep it dark, not green
            if (Camera.main) Camera.main.backgroundColor = UiKit.Surface900;
            // landscape only, either way round (also set in the player settings)
            Screen.autorotateToPortrait = false;
            Screen.autorotateToPortraitUpsideDown = false;
            Screen.autorotateToLandscapeLeft = true;
            Screen.autorotateToLandscapeRight = true;
            if (Application.isMobilePlatform) Screen.orientation = ScreenOrientation.AutoRotation;
            ui = new GameUi();
            // the action button and the dialog act like E
            ui.Tapped += () =>
            {
                if (player) player.Input.PressInteract();
            };
            api = new BudsApi(PlayerSession.ApiBaseUrl);

            // signed out a moment ago: back at the start screen, whatever the command line said
            if (signedOut)
            {
                ShowPairing();
                if (CommandLine.Get("-buds-autoshot") is { } outShots)
                {
                    await Awaitable.WaitForSecondsAsync(0.8f);
                    ScreenCapture.CaptureScreenshot(Path.Combine(outShots, "o3-wylogowany.png"));
                    await Awaitable.WaitForSecondsAsync(0.5f);
                    Debug.Log($"[AutoPilot] signed out, saved session: {(PlayerSession.Load() == null ? "none" : "still there")}");
                    Application.Quit();
                }
                return;
            }

            // automated check of the corner spinner: a request that never answers (pass an unreachable -buds-api)
            if (CommandLine.Has("-buds-net-demo") && CommandLine.Get("-buds-autoshot") is { } netShots)
            {
                ShowPairing();
                _ = api.GetLookOptions();
                await Awaitable.WaitForSecondsAsync(1.2f);
                ScreenCapture.CaptureScreenshot(Path.Combine(netShots, "n1-spinner.png"));
                await Awaitable.WaitForSecondsAsync(0.4f);
                Application.Quit();
                return;
            }

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
                    // and the account sign-in window (nothing is sent)
                    await OpenLogin();
                    await Awaitable.WaitForSecondsAsync(0.6f);
                    ScreenCapture.CaptureScreenshot(Path.Combine(shots, "00-login.png"));
                    await Awaitable.WaitForSecondsAsync(0.4f);
                    loginScreen.Hide();
                }
                StartAsGuest();
                return;
            }

            // automated run of the account sign-in: wrong password, then the right one
            if (CommandLine.Has("-buds-login-demo") && CommandLine.Get("-buds-autoshot") is { } loginShots)
            {
                _ = LoginDemo(loginShots);
                return;
            }

            // automated run of the in-game creator: makes a new bud, then the autopilot takes over
            if (CommandLine.Has("-buds-create-demo") && CommandLine.Get("-buds-autoshot") is { } createShots)
            {
                _ = CreatorDemo(createShots);
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
                EnterWorld(bud.name, bud.xp, new BudSheet(sheet, true), session, await LoadCompleted(session));
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
            ui.ShowPair(code => _ = Connect(code), StartAsGuest, () => _ = OpenCreator(), () => _ = OpenLogin());
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
                EnterWorld(res.bud.name, res.bud.xp, new BudSheet(sheet, true), paired, completed);
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
            SetUpRides();
            SetUpCaches();
            SetUpMap();
            SetUpFights();
            SetUpRivalry();
            SetUpLand();
            // dev/test: start in another district (-buds-district las-palmas)
            // new buds start on the tutorial island; -buds-district <id> starts elsewhere (dev/test)
            LoadDistrict(CommandLine.Get("-buds-district") ?? StartMap(), null);
            ui.HideLoading();
            SetUpLive(); // other players on the same map (paired buds only)

            var shots = CommandLine.Get("-buds-autoshot");
            if (shots != null) _ = AutoPilot(shots);
        }

        /// <summary>
        /// Builds a district or a room from its map file. Arriving from another district puts you next to the road
        /// back, leaving a room puts you in front of its door, entering a room just inside the doormat.
        /// </summary>
        void LoadDistrict(string districtId, string fromDistrict)
        {
            DropNeighbour(); // the map laid next to this one goes with it
            if (world)
            {
                // into one of this district's rooms: the district waits, switched off, for the bud to come back out
                // (building a city again takes over a second; switching it back on takes nothing)
                var room = world.Map.Doors.Exists(d => d.Target == districtId);
                if (room && !world.Map.IsInterior)
                {
                    ClearMapPeople();
                    if (parkedWorld) Destroy(parkedWorld.gameObject);
                    parkedWorld = world;
                    parkedWorld.gameObject.SetActive(false);
                }
                else Destroy(world.gameObject);
                world = null;
            }
            // a district left for good (not its own room, not back to it): its parked copy goes
            if (parkedWorld && parkedWorld.Map.Id != districtId && !parkedWorld.Map.Doors.Exists(d => d.Target == districtId))
            {
                Destroy(parkedWorld.gameObject);
                parkedWorld = null;
            }
            if (player) Destroy(player.gameObject);
            // a wasteland entered from a city: that city's end is the seamless one (World/Seams)
            seamFrom = Districts.IsRoute(districtId) && fromDistrict != null && !Districts.IsRoute(fromDistrict) ? fromDistrict : null;

            var clock = System.Diagnostics.Stopwatch.StartNew();
            WorldMap map;
            long parsed;
            if (parkedWorld && parkedWorld.Map.Id == districtId)
            {
                // back out of a room: the district is still there, just switched off
                world = parkedWorld;
                parkedWorld = null;
                world.gameObject.SetActive(true);
                WorldView.MakeCurrent(world);
                map = world.Map;
                parsed = 0;
                EnterMap(map);
            }
            else
            {
                // the map the bud walked towards was worked out ahead on a worker thread (PrepareAhead)
                var ready = WorldView.TakePrepared(districtId);
                map = ready?.map ?? MapFormat.Load(districtId);
                parsed = clock.ElapsedMilliseconds;
                EnterMap(map);
                world = WorldView.Create(map, ready?.ground);
            }
            var built = clock.ElapsedMilliseconds;
            var at = arriveAt.HasValue ? NearestFree(map, arriveAt.Value)
                : fromDistrict != null ? map.ArrivalFrom(fromDistrict) : new Vector2Int(map.SpawnX, map.SpawnY);
            arriveAt = null;
            player = BudController.Spawn(sheet, world.CellCenter(at.x, at.y) + new Vector3(0, -0.3f, 0));
            player.Blocked = WalkBlocked;
            SetUpMapPeople();
            var people = clock.ElapsedMilliseconds;
            // walking into a room you face into it; stepping out of one you face the street
            if (map.IsInterior) player.Look(Vector2.up);
            else if (map.Doors.Exists(d => d.Target == fromDistrict)) player.Look(Vector2.down);

            var cam = Camera.main!.GetComponent<FollowCamera>();
            cam.target = player.transform;
            UpdateCameraBounds();
            cam.SnapToTarget();
            // what the old map loaded (its prop textures, sheets) goes back to the system
            Resources.UnloadUnusedAssets();
            if (CommandLine.Has("-buds-autoshot"))
                Debug.Log($"[Load] {map.Id}: parse {parsed} ms, world {built - parsed} ms, people {people - built} ms, total {clock.ElapsedMilliseconds} ms ({WorldView.LastTimings})");
            if (CommandLine.Has("-buds-autoshot"))
                Debug.Log($"[Mem] {map.Id}: {UnityEngine.Profiling.Profiler.GetTotalAllocatedMemoryLong() / (1024 * 1024)} MB allocated, " +
                          $"{UnityEngine.Profiling.Profiler.GetAllocatedMemoryForGraphicsDriver() / (1024 * 1024)} MB graphics");
            AnnounceMap(at);
        }

        /// <summary>The district the bud stepped out of into one of its rooms, switched off until it comes back out.</summary>
        WorldView parkedWorld;

        /// <summary>
        /// The map's own people and places (quest NPCs, caches, opponents, training stations), the camera's limits and the
        /// district's light: everything that belongs to the map the bud is on now. Also run when the bud walks across a
        /// seam into the map laid next to it.
        /// </summary>
        void SetUpMapPeople(float gradeSeconds = 0)
        {
            var map = world.Map;
            questWorld = QuestWorld.Create(world, quests);
            cacheWorld = CacheWorld.Create(world, caches);
            SetUpMapFight(); // the map's opponents and the fight's effects
            UpdateTracker();
            // strolling NPCs stop for the player and stand still while anyone talks or a screen is open
            questWorld.PlayerFeet = () => player ? (Vector2?)player.transform.position : null;
            questWorld.Busy = () => ui.DialogOpen || (mapScreen?.IsOpen ?? false) || (rivalryScreen?.IsOpen ?? false);
            SetUpMapExtras(); // training stations, the ride and the walking speed
            UpdateCameraBounds();
            Camera.main!.backgroundColor = map.BaseColor;
            WorldGrade.Apply(Camera.main, map, gradeSeconds); // the district's light (World/WorldGrade)
            LandMapChanged(); // a wasteland's plots: everyone's districts
        }

        /// <summary>The name of the place on the banner, the turfs' rulers, the room of the others on this map.</summary>
        void AnnounceMap(Vector2Int at)
        {
            var map = world.Map;
            atExit = map.ExitAt(at.x, at.y);
            atZone = map.ZoneAt(at.x, at.y);
            ui.ShowToast(map.IsInterior || atZone == null || atZone.Name == map.Name ? map.Name : $"{map.Name} · {atZone.Name}");
            // who rules the turfs here this week (the zone banner, the tribute dot on the Rewiry button)
            _ = RefreshTurfs();
            LiveMapChanged(); // the others on the old map go, the room of this one comes
        }

        void Update()
        {
            creatorScreen?.Tick();
            if (!player) return;
            ui.Tick();
            if (travelling) return;
            var input = player.Input;
            var windowOpen = ui.DialogOpen || (panel?.IsOpen ?? false) || (mapScreen?.IsOpen ?? false) ||
                             (trainingScreen?.IsOpen ?? false) || (rivalryScreen?.IsOpen ?? false) ||
                             (creatorScreen?.IsOpen ?? false) || (ferryScreen?.IsOpen ?? false) || (chatScreen?.IsOpen ?? false) ||
                             (landScreen?.IsOpen ?? false) || (landPlanner?.IsOpen ?? false);
            // knocked out, stunned or flung by a blow: the fight holds the bud (walka.md)
            input.Blocked = windowOpen || CombatLocked;
            // the fight's buttons, the aim, the mouse: every frame, the world never stops for a fight
            UpdateCombat(input, windowOpen || ui.ChoiceOpen);
            if (creatorScreen?.IsOpen ?? false) return; // the look editor is open over the world
            if (UpdateChat()) return; // typing: every key is a letter, the world waits
            if (UpdateLandScreen(input)) return;
            if (UpdateRidesAndTraining(input)) return;
            ui.UpdateStick(input);

            if (UpdateFerry(input)) return;
            if (UpdateMapScreen(input)) return;
            if (UpdatePanel(input)) return;
            if (UpdateRivalry(input)) return;

            // quest offers wait for a choice: E / Enter accepts, Esc / Q declines, or tap a button
            if (ui.ChoiceOpen)
            {
                if (input.InteractPressed && input.InteractFromKey) ui.ChooseAccept();
                else if (input.CancelPressed) ui.ChooseDecline();
                return;
            }

            var cell = player.MapCell(world.Map.Height);
            if (UpdateSeam(cell)) return; // walked across into the map laid next to this one
            PrepareAhead(cell);
            CheckZone(cell);
            if (CheckExit(cell)) return;
            CheckQuestProgress(cell);
            Explore(cell);

            // what the bud can interact with: a person first, then a cache, a door, a sign (opponents are fought with the
            // fight's buttons; only a guest, who can't fight on the server, walks up to the tutorial's dummy with E)
            var feet = (Vector2)player.transform.position;
            // the districts on a wasteland: plots' gates, the own buildings and the building being placed come first
            if (UpdateLandWorld(input, cell, feet)) return;
            var (mx, my) = FeetOnMap();
            nearbyNpc = questWorld.NearestNpc(feet, InteractRange);
            nearbyEnemy = nearbyNpc || session != null ? null : enemyWorld.Nearest(feet, InteractRange);
            nearbyCache = nearbyNpc || nearbyEnemy ? null : caches.Nearest(world.Map.Id, mx, my, CacheWorld.SearchRange);
            nearbyTraining = nearbyNpc || nearbyEnemy || nearbyCache != null ? null : trainingWorld.Nearest(feet, TrainingRange);
            nearbyDoor = nearbyNpc || nearbyEnemy || nearbyCache != null || nearbyTraining != null ? null : FindNearbyDoor(feet);
            nearby = nearbyNpc || nearbyEnemy || nearbyCache != null || nearbyTraining != null || nearbyDoor != null ? null : FindNearbySign();
            // another player's bud last: it may stand anywhere, it never hides a door or a person
            nearbyRemote = nearbyNpc || nearbyEnemy || nearbyCache != null || nearbyTraining != null || nearbyDoor != null || nearby != null
                ? null
                : NearestRemote(feet);
            ui.SetHint(nearbyNpc ? $"Rozmawiaj: {nearbyNpc.Data.name}  [E]"
                : nearbyEnemy ? $"Ćwicz: {nearbyEnemy.Data.name}  [E]"
                : nearbyCache != null ? "Przeszukaj  [E]"
                : nearbyTraining != null ? TrainingHint(nearbyTraining)
                : nearbyDoor != null ? $"Wejdź: {nearbyDoor.Name}  [E]"
                : nearby != null ? "Czytaj  [E]"
                : nearbyRemote ? RemoteHint(nearbyRemote)
                : null);
            if (!ui.DialogOpen && CheckDoorPush(input, cell)) return;

            if (!input.InteractPressed) return;
            if (ui.DialogOpen) ui.HideDialog();
            else if (nearbyNpc) TalkTo(nearbyNpc);
            else if (nearbyEnemy) FightOffline();
            else if (nearbyCache != null) _ = OpenCache(nearbyCache);
            else if (nearbyTraining != null) StartTraining(nearbyTraining);
            else if (nearbyDoor != null) EnterDoor(nearbyDoor);
            else if (nearby != null) ui.ShowDialog(nearby.Title, nearby.Text);
            else if (nearbyRemote) MeetRemote(nearbyRemote);
        }

        void CheckZone(Vector2Int cell)
        {
            var zone = world.Map.ZoneAt(cell.x, cell.y);
            if (zone == atZone) return;
            atZone = zone;
            if (zone != null) ui.ShowToast(ZoneLine(zone));
        }

        /// <summary>Walking onto a road out of the map travels to that district, or says why you can't yet.</summary>
        bool CheckExit(Vector2Int cell)
        {
            var exit = world.Map.ExitAt(cell.x, cell.y);
            if (exit == atExit) return false;
            atExit = exit;
            if (exit == null) return false;
            if (TutorialExitBlocked()) return false;
            // a road laid seamless: the bud just walks on into the next map (UpdateSeam), no fade
            if (IsSeamExit(exit)) return false;
            if (world.Map.IsInterior)
            {
                // the doormat: back out to the street
                _ = Travel(exit.DistrictId, world.Map.Id);
                return true;
            }
            // a road out of the city onto a wasteland: open when the city at its far end is
            if (Districts.IsRoute(exit.DistrictId))
            {
                var far = Districts.Get(Districts.FarEnd(exit.DistrictId, world.Map.Id) ?? "");
                if (far == null || RouteOpen(exit.DistrictId, world.Map.Id))
                {
                    _ = Travel(exit.DistrictId, world.Map.Id);
                    return true;
                }
                var why = level >= far.UnlockLevel ? PassReason(far) : Districts.ClosedReason(far, level);
                ui.ShowDialog(Districts.NameOf(exit.DistrictId), $"Ta droga prowadzi do: {far.Name}.\n{why}");
                return false;
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

        float nextPrepare;

        /// <summary>
        /// Walking towards a road out: the map at its end gets worked out ahead on a worker thread, so crossing over is
        /// quick (one map at a time, the nearest road within PrepareReach tiles; rooms are small anyway).
        /// </summary>
        void PrepareAhead(Vector2Int cell)
        {
            if (Time.unscaledTime < nextPrepare || world.Map.IsInterior) return;
            nextPrepare = Time.unscaledTime + 0.5f;
            Exit best = null;
            var bestD = PrepareReach;
            foreach (var e in world.Map.Exits)
            {
                if (IsSeamExit(e)) continue; // laid next to this map by UpdateSeam, never prepared twice
                var dx = Mathf.Max(e.X0 - cell.x, 0, cell.x - e.X1);
                var dy = Mathf.Max(e.Y0 - cell.y, 0, cell.y - e.Y1);
                var d = Mathf.Sqrt(dx * dx + dy * dy);
                if (d >= bestD) continue;
                bestD = d;
                best = e;
            }
            if (best != null) WorldView.Prepare(best.DistrictId);
        }

        /// <summary>How near a road out (tiles) the bud is when the next map starts getting ready.</summary>
        const float PrepareReach = 26f;

        /// <summary>The walkable cell nearest to (x, y), the cell itself excluded (someone stands there: the ferryman).</summary>
        static Vector2Int NearestFree(WorldMap map, Vector2Int c)
        {
            for (var r = 1; r < 8; r++)
            for (var dy = -r; dy <= r; dy++)
            for (var dx = -r; dx <= r; dx++)
                if (Mathf.Max(Mathf.Abs(dx), Mathf.Abs(dy)) == r && map.IsWalkable(c.x + dx, c.y + dy))
                    return new Vector2Int(c.x + dx, c.y + dy);
            return new Vector2Int(map.SpawnX, map.SpawnY);
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
        /// Autopilot (-buds-life-demo): a strip of frames of the bud walking and running (to judge the steps), then a
        /// strolling local filmed a few seconds apart, and once more when the bud walks up to it.
        /// </summary>
        async Awaitable LifeDemo(string dir)
        {
            if (world.Map.Id != Districts.Start) LoadDistrict(Districts.Start, null);
            async Awaitable Strip(string name, bool run)
            {
                var start = world.Map.Zones.Find(z => z.Name == "Rynek") ?? world.Map.Zones[0];
                Teleport(start.X0 + 2, (start.Y0 + start.Y1) / 2);
                await Awaitable.WaitForSecondsAsync(0.5f);
                player.Input.OverrideRun = run;
                player.Input.Override = Vector2.right;
                await Awaitable.WaitForSecondsAsync(0.4f); // up to speed
                for (var i = 0; i < 10; i++)
                {
                    ScreenCapture.CaptureScreenshot(Path.Combine(dir, $"{name}-{i:00}.png"));
                    await Awaitable.WaitForSecondsAsync(0.05f);
                }
                player.Input.Override = Vector2.zero;
                player.Input.OverrideRun = false;
                await Awaitable.WaitForSecondsAsync(0.25f);
                ScreenCapture.CaptureScreenshot(Path.Combine(dir, $"{name}-stop.png"));
                await Awaitable.WaitForSecondsAsync(0.3f);
            }
            await Strip("walk", false);
            await Strip("run", true);

            NpcView local = null;
            foreach (var n in questWorld.Npcs)
                if (n.Data.wander > 0) { local = n; break; }
            if (local == null) return;
            Teleport(local.Data.x, local.Data.y + 5);
            for (var i = 0; i < 3; i++)
            {
                await Awaitable.WaitForSecondsAsync(i == 0 ? 0.5f : 3.5f);
                ScreenCapture.CaptureScreenshot(Path.Combine(dir, $"life-{i}.png"));
                Debug.Log($"[AutoPilot] life-{i}: {local.Data.id} at {local.transform.position}");
            }
            // walk up to it: it stops and turns to the bud
            var to = (Vector2)(local.transform.position - player.transform.position);
            player.Input.Override = to.normalized;
            for (var t = 0f; t < 3 && Vector2.Distance(player.transform.position, local.transform.position) > 1.6f; t += Time.deltaTime)
                await Awaitable.NextFrameAsync();
            player.Input.Override = Vector2.zero;
            await Awaitable.WaitForSecondsAsync(0.6f);
            ScreenCapture.CaptureScreenshot(Path.Combine(dir, "life-3-near.png"));
            Debug.Log($"[AutoPilot] life-3: {local.Data.id} at {local.transform.position}");
            await Awaitable.WaitForSecondsAsync(0.3f);
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
                if (CommandLine.Has("-buds-plan-demo")) await PlanDemo(Shot);
                if (CommandLine.Has("-buds-land-demo") && session != null)
                {
                    await LandDemo(Shot);
                    Application.Quit();
                    return;
                }
                if (CommandLine.Has("-buds-live-demo") && session != null)
                {
                    await LiveDemo(Shot); // two clients in step: nothing else runs
                    Application.Quit();
                    return;
                }
                // the quest log: unfolded by its button, then folded away again
                ui.SetQuestsOpen(true);
                await Shot("01b-quests-open.png");
                ui.SetQuestsOpen(false);
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
                    // phones: tap the action button and the dialog like a finger would
                    if (UiKit.Mobile) Debug.Log($"[AutoPilot] tap action button → {ui.TapForTest(false) ?? "nothing"}");
                    else input.PressInteract();
                    await Shot("04-dialog.png");
                    if (UiKit.Mobile) Debug.Log($"[AutoPilot] tap dialog → {ui.TapForTest(true) ?? "nothing"}, open {ui.DialogOpen}");
                    else input.PressInteract();
                    await Awaitable.WaitForSecondsAsync(0.2f);
                    if (UiKit.Mobile) Debug.Log($"[AutoPilot] dialog closed by tap: {!ui.DialogOpen}");
                }

                if (CommandLine.Has("-buds-panel-demo")) await PanelDemo(Shot);
                if (CommandLine.Has("-buds-look-demo") && session != null) await LookDemo(Shot);
                if (CommandLine.Has("-buds-logout-demo"))
                {
                    await LogoutDemo(Shot);
                    return; // the scene reloads; nothing after this runs
                }
                if (CommandLine.Has("-buds-account-demo") && session != null)
                {
                    await AccountDemo(Shot);
                    return; // the bud is gone and the scene starts over
                }
                if (CommandLine.Has("-buds-tutorial-demo")) await TutorialDemo(Shot);
                if (CommandLine.Has("-buds-quest-demo")) await QuestDemo(Shot);
                if (CommandLine.Has("-buds-life-demo")) await LifeDemo(dir);
                if (CommandLine.Has("-buds-training-demo")) await TrainingDemo(Shot);

                // tour: every zone of every district (or just the current one without -buds-tour)
                var districts = CommandLine.Has("-buds-tour") ? Districts.All : new[] { Districts.Get(world.Map.Id) };
                foreach (var district in districts)
                {
                    if (district == null) continue; // the tutorial island isn't a district
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
                if (CommandLine.Has("-buds-ride-demo") && session != null) await RideDemo(Shot);
                if (CommandLine.Has("-buds-travel-demo") && session != null) await TravelDemo(Shot);
                if (CommandLine.Has("-buds-rivalry-demo") && session != null)
                {
                    if (world.Map.Id != Districts.Start) LoadDistrict(Districts.Start, null);
                    await RivalryDemo(Shot);
                }
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
