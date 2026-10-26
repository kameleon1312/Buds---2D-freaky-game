using System;
using Buds.Api;
using Buds.Characters;
using Buds.Quests;
using Buds.UI;
using Buds.World;
using UnityEngine;

namespace Buds.Core
{
    /// <summary>
    /// Dystrykty (docs/dystrykty.md): fenced plots along the wastelands' roads. Every district on the current wasteland
    /// is drawn for everyone (<see cref="DistrictsWorld"/>, from <c>GET /v1/districts/:route</c>, refreshed while the bud is
    /// there). At a plot's gate E: a free plot is bought for coins and named; another bud's district shows its card
    /// with "Napadnij" (a duel against its owner, fortified by the district, from the raid level); the bud's own opens its
    /// window. On its own plot: walk up to a building and press E (collect what it made or the rent, or see its card with
    /// the upgrade), open the skyline button (B) to put up something new: its ghost stands in front of the bud (green
    /// where it fits) until E puts it there. Every change is asked of the server, which works it all out.
    /// </summary>
    public sealed partial class GameBootstrap
    {
        const float LandReach = 1.2f;
        const float GateReach = 1.6f;
        /// <summary>Seconds between fresh looks at the wasteland's districts while the bud is on it.</summary>
        const float DistrictsRefreshSeconds = 30f;

        Land land;
        DistrictsWorld districtsWorld;
        LandScreen landScreen;
        /// <summary>The building kind being placed (null: not placing).</summary>
        string placing;
        bool landBusy;
        int landCoins = -1;
        LandBuildingDto nearbyBuilding;
        PlotData nearbyPlot;
        float districtsRefreshAt;
        /// <summary>How the last raid ended (shown when the duel screen closes), and the district raided.</summary>
        RaidResultDto lastRaid;
        string raidingName;

        void SetUpLand()
        {
            if (quests.Content.land == null) return;
            land ??= new Land(quests.Content.land);
            DistrictsWorld.Art(quests.Content.land);
            if (landScreen != null) return;
            landScreen = new LandScreen(ui.Root)
            {
                OnOpen = () => OpenLandScreen(),
                OnBuild = StartPlacing,
                OnGrow = () => _ = GrowLand(),
                OnSell = (r, n) => _ = SellResource(r, n),
                OnCancelPlacing = StopPlacing,
                OnRename = AskRename,
            };
        }

        /// <summary>Whether the current map has plots (a wasteland).</summary>
        bool HasPlots => world && quests.Content.land != null && quests.Content.land.PlotsOn(world.Map.Id).Length > 0;

        /// <summary>Called when a map is set up: a wasteland's districts are drawn, the bar comes and goes.</summary>
        void LandMapChanged()
        {
            StopPlacing();
            nearbyBuilding = null;
            nearbyPlot = null;
            landScreen?.ShowBar(false);
            if (!HasPlots || land == null) return;
            _ = SetUpDistricts(world);
        }

        /// <summary>
        /// The districts come a couple of frames after the map (loading their art then would lengthen the frame a seam
        /// is crossed in), unless the map has changed meanwhile.
        /// </summary>
        async Awaitable SetUpDistricts(WorldView on)
        {
            await Awaitable.NextFrameAsync();
            await Awaitable.NextFrameAsync();
            if (!on || world != on || districtsWorld) return;
            districtsWorld = DistrictsWorld.Create(world, quests.Content.land, land);
            _ = RefreshDistricts(true);
        }

        /// <summary>The bud's own district (when paired) and everyone's on this wasteland, fresh from the server.</summary>
        async Awaitable RefreshDistricts(bool withOwn)
        {
            if (!districtsWorld) return;
            districtsRefreshAt = Time.time + DistrictsRefreshSeconds;
            var route = districtsWorld.Route;
            try
            {
                if (withOwn && session != null) land.Apply((await api.GetLand(session.Token)).land);
                var res = await api.GetDistricts(route);
                if (!districtsWorld || districtsWorld.Route != route) return;
                districtsWorld.Apply(res);
                AfterLandChange();
            }
            catch (ApiException e)
            {
                Debug.LogWarning($"[Land] districts: {e.Message}");
            }
        }

        void AfterLandChange()
        {
            if (districtsWorld) districtsWorld.Redraw();
            if (land.Has) landScreen?.UpdateBar(land);
            landScreen?.Refresh(land, level, landCoins);
        }

        /// <summary>Whether the bud stands on its own plot on this map.</summary>
        bool OnOwnPlot(Vector2Int cell) => land != null && land.Has && world && land.Plot.route == world.Map.Id && land.OnPlot(cell);

        void OpenLandScreen(int tab = LandScreen.TabBuildings)
        {
            if (land == null || !land.Has || OtherScreenOpen()) return;
            StopPlacing();
            landScreen.Open(land, level, landCoins, tab);
            if (landCoins < 0) _ = LoadLandCoins();
        }

        async Awaitable LoadLandCoins()
        {
            try
            {
                landCoins = (await api.GetWallet(session.Token)).coins;
                landScreen.Refresh(land, level, landCoins);
            }
            catch (ApiException)
            {
                // the screen works without the balance; the server checks it anyway
            }
        }

        /// <summary>The district windows take the keys while open (Esc closes them); B opens the district's window.</summary>
        bool UpdateLandScreen(PlayerInput input)
        {
            if (landScreen == null) return false;
            if (landScreen.IsOpen)
            {
                if (input.CancelPressed) landScreen.Hide();
                return true;
            }
            var kb = UnityEngine.InputSystem.Keyboard.current;
            if (kb != null && kb.bKey.wasPressedThisFrame && land != null && land.Has && !OtherScreenOpen()) OpenLandScreen();
            return landScreen.IsOpen;
        }

        // ---------- placing a building ----------

        void StartPlacing(string kind)
        {
            placing = kind;
            landScreen?.SetPlacing(true);
            var name = land.Rules.Building(kind)?.name ?? kind;
            ui.ShowToast($"Podejdź tam, gdzie ma stanąć: {name}", 3f);
        }

        void StopPlacing()
        {
            placing = null;
            landScreen?.SetPlacing(false);
            if (districtsWorld) districtsWorld.ShowGhost(null, default, false);
        }

        /// <summary>The plot-local cell the building being placed would stand on: its door right in front of (north of) the bud.</summary>
        Vector2Int PlacingAnchor(Vector2Int cell)
        {
            var local = land.ToLocal(cell);
            return new Vector2Int(local.x, local.y - 2);
        }

        // ---------- every frame on a wasteland ----------

        /// <summary>
        /// On a wasteland with plots: placing a building, walking up to the own buildings and to plots' gates. True = the
        /// districts took this frame's interaction (the rest of the world's checks wait).
        /// </summary>
        bool UpdateLandWorld(PlayerInput input, Vector2Int cell, Vector2 feet)
        {
            if (!districtsWorld || land == null) return false;
            if (Time.time > districtsRefreshAt) _ = RefreshDistricts(false);
            var onOwn = OnOwnPlot(cell);
            landScreen.ShowBar(onOwn || placing != null);
            if (land.Has) landScreen.UpdateBar(land);
            if (placing != null)
            {
                if (!onOwn)
                {
                    districtsWorld.ShowGhost(null, default, false);
                    ui.SetHint("Wejdź na swoją działkę, żeby budować.");
                    if (input.CancelPressed) StopPlacing();
                    return true;
                }
                var anchor = PlacingAnchor(cell);
                var problem = land.PlacementProblem(placing, anchor.x, anchor.y, level);
                districtsWorld.ShowGhost(placing, anchor, problem == null);
                var name = land.Rules.Building(placing)?.name;
                ui.SetHint(problem == null ? $"Postaw: {name}  [E]" : Land.ProblemText(problem));
                if (input.CancelPressed)
                {
                    StopPlacing();
                    return true;
                }
                if (input.InteractPressed && !ui.DialogOpen)
                {
                    if (problem == null) _ = BuildLand(placing, anchor);
                    else ui.ShowToast(Land.ProblemText(problem), 2.5f);
                }
                return true;
            }

            var now = land.Now;
            nearbyBuilding = onOwn ? districtsWorld.NearOwn(feet, LandReach) : null;
            nearbyPlot = nearbyBuilding == null ? districtsWorld.NearGate(feet, GateReach) : null;
            string hint = null;
            if (nearbyBuilding != null)
            {
                var kind = land.Rules.Building(nearbyBuilding.kind);
                if (land.Building(nearbyBuilding, now))
                    hint = $"{kind.name}: budowa {Land.Countdown(nearbyBuilding.readyAt, now)}";
                else
                {
                    var waiting = land.Pending(nearbyBuilding, now);
                    hint = waiting <= 0
                        ? $"{kind.name} (poz. {nearbyBuilding.level})  [E]"
                        : kind.produces == Land.Rent
                            ? $"{kind.name}: zbierz czynsz, {Coins(waiting)}  [E]"
                            : $"{kind.name}: zbierz {waiting} ({land.Rules.Resource(kind.produces)?.name.ToLowerInvariant()})  [E]";
                }
            }
            else if (nearbyPlot != null) hint = PlotHint(nearbyPlot);
            ui.SetHint(hint);
            if (!input.InteractPressed) return hint != null;
            if (ui.DialogOpen)
            {
                ui.HideDialog();
                return true;
            }
            if (nearbyBuilding != null) UseBuilding(nearbyBuilding, now);
            else if (nearbyPlot != null) UsePlot(nearbyPlot);
            return hint != null;
        }

        string PlotHint(PlotData p)
        {
            if (land.Has && land.State.plot == p.id) return $"Twój dystrykt {land.State.name}  [E]";
            var d = districtsWorld.DistrictOn(p.id);
            if (d == null) return $"Działka na sprzedaż · {Coins(p.price)}  [E]";
            return $"Dystrykt {d.name} · {d.owner.name} (poz. {d.owner.level}) · obrona +{d.defence}%  [E]";
        }

        /// <summary>E at a plot's gate: buy it, look at someone's district (and maybe raid it), or open the own one.</summary>
        void UsePlot(PlotData p)
        {
            if (land.Has && land.State.plot == p.id)
            {
                OpenLandScreen();
                return;
            }
            var d = districtsWorld.DistrictOn(p.id);
            if (d == null)
            {
                AskBuyPlot(p);
                return;
            }
            ShowDistrictCard(p, d);
        }

        void AskBuyPlot(PlotData p)
        {
            const string title = "Działka na sprzedaż";
            if (session == null)
            {
                ui.ShowDialog(title, "Działkę kupuje połączony Bud: dystrykt, budynki i surowce trzyma serwer.");
                return;
            }
            if (land.Has)
            {
                ui.ShowDialog(title, $"Masz już dystrykt {land.State.name} ({Districts.NameOf(land.Plot.route)}). Jeden Bud, jedna działka.");
                return;
            }
            if (level < land.Rules.minLevel)
            {
                ui.ShowDialog(title, $"Działki sprzedają od poziomu {land.Rules.minLevel}. Wróć trochę później.");
                return;
            }
            var bonus = land.Rules.Resource(land.Rules.BonusOf(p.route))?.name.ToLowerInvariant();
            var side = land.Rules.stageSides[0];
            ui.ShowChoice(title,
                $"Ogrodzona działka {land.Rules.plotSize}×{land.Rules.plotSize} przy drodze: {Districts.NameOf(p.route)}. Cena: <b>{Coins(p.price)}</b>.\n" +
                $"Dostajesz ratusz, plac {side}×{side} pod pierwsze budynki, trochę betonu i stali, a przez {land.Rules.newShieldHours} h nikt nie napadnie. " +
                $"Dystrykt rośnie z twoim poziomem i surowcami.{(bonus != null ? $"\n<b>Tutaj idzie lepiej: {bonus}.</b>" : "")}",
                "Kupuję", "Jeszcze nie", () => AskPlotName(p), null);
        }

        void AskPlotName(PlotData p) =>
            landScreen.AskName("Nazwij dystrykt",
                "Jak ma się nazywać twój dystrykt? Tę nazwę zobaczy każdy, kto przejdzie obok, i ranking. Zmienisz ją później.",
                "", $"Kup za {Coins(p.price)}", name => _ = BuyPlot(p, name));

        async Awaitable BuyPlot(PlotData p, string name)
        {
            if (landBusy) return;
            landBusy = true;
            try
            {
                var res = await api.BuyPlot(session.Token, p.id, name);
                land.Apply(res.land);
                if (res.coins >= 0) landCoins = res.coins;
                ui.ShowToast($"Dystrykt {land.State.name} jest twój!", 3f);
                landBusy = false;
                await RefreshDistricts(false);
            }
            catch (ApiException e)
            {
                // a name the server won't take: ask again with its reason; anything else in a dialog
                if (e.Status == 400) landScreen.NameRejected(e.Message, n => _ = BuyPlot(p, n));
                else ui.ShowDialog("Działka", e.Message);
                if (e.Status == 409) _ = RefreshDistricts(false);
            }
            finally
            {
                landBusy = false;
            }
        }

        /// <summary>Someone's district: who owns it, how strong it is, and "Napadnij" when a raid is possible.</summary>
        void ShowDistrictCard(PlotData p, DistrictDto d)
        {
            var title = $"Dystrykt {d.name}";
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var text = $"Właściciel: <b>{d.owner.name}</b> (poz. {d.owner.level}) · etap {d.stage} · moc {d.power}\n" +
                       $"Obrona dystryktu: <b>+{d.defence}%</b> zdrowia dla obrońcy.";
            string why = null;
            if (session == null) why = "Napadają tylko połączone Budy.";
            else if (level < land.Rules.raidMinLevel) why = $"Napady od poziomu {land.Rules.raidMinLevel}.";
            else if (!land.Has) why = "Najpierw kup działkę: łup musi gdzieś trafić.";
            else if (d.owner.level < land.Rules.raidMinLevel) why = $"Właściciel nie ma jeszcze poziomu {land.Rules.raidMinLevel}: jego dystrykt jest bezpieczny.";
            else if (d.shieldUntil > now) why = $"Pod ochroną jeszcze {Land.Countdown(d.shieldUntil, now)}.";
            if (why != null)
            {
                ui.ShowDialog(title, text + $"\n<i>{why}</i>");
                return;
            }
            ui.ShowChoice(title, text + "\nWygrany napad zabiera część niechronionych surowców. Budynki zostają.",
                "Napadnij", "Odejdź", () => _ = RaidDistrict(p, d), null);
        }

        /// <summary>Raids a district: the owner's picture first (a failed download wastes no try), then the duel.</summary>
        async Awaitable RaidDistrict(PlotData p, DistrictDto d)
        {
            if (landBusy || fightBusy || session == null) return;
            landBusy = true;
            fightBusy = true;
            BudSheet theirs = null;
            try
            {
                ui.ShowToast($"Napad na dystrykt {d.name}…", 2f);
                theirs = new BudSheet(await api.GetSheet(d.owner.slug), true);
                var res = await api.StartRaid(session.Token, p.id);
                ReleasePvpSheet();
                pvpSheet = theirs;
                pvpOnStreet = true;
                currentFight = res.fight;
                fightingWith = null;
                lastReward = null;
                lastPvp = null;
                lastRaid = null;
                lastInfluence = null;
                raidingName = d.name;
                fightScreen.Open(res.fight, sheet, theirs, $"Obrona dystryktu: +{d.defence}%.", gear);
                theirs = null; // the duel owns it now (freed when it closes)
            }
            catch (ApiException e)
            {
                ui.ShowDialog($"Dystrykt {d.name}", e.Message);
            }
            finally
            {
                if (theirs != null && theirs != pvpSheet) theirs.Dispose();
                landBusy = false;
                fightBusy = false;
            }
        }

        /// <summary>E at an own building: collect what it made, or its card with the next level.</summary>
        void UseBuilding(LandBuildingDto b, double now)
        {
            var kind = land.Rules.Building(b.kind);
            if (land.Building(b, now))
            {
                ui.ShowToast($"{kind.name}: jeszcze {Land.Countdown(b.readyAt, now)}", 2f);
                return;
            }
            if (land.Pending(b, now) > 0)
            {
                _ = CollectLand(b.id);
                return;
            }
            var next = land.NextLevel(b);
            var rate = string.IsNullOrEmpty(kind.produces) ? ""
                : kind.produces == Land.Rent
                    ? $"\nCzynsz: {Coins(land.Hourly(b))} na godzinę (do {land.Rules.producerHours} h)."
                    : $"\nRobi {land.Hourly(b)} na godzinę (do {land.Rules.producerHours} h zapasu).";
            if (next == null)
            {
                ui.ShowDialog($"{kind.name} · poziom {b.level}", kind.blurb + rate + "\n<b>To najwyższy poziom.</b>");
                return;
            }
            string why = null;
            if (level < next.player) why = $"Potrzebujesz poziomu {next.player}.";
            else if (b.kind != Land.Hall && b.level + 1 > land.HallLevel) why = "Najpierw ulepsz ratusz.";
            else if (!land.CanAfford(next)) why = "Brakuje surowców.";
            var text = $"{kind.blurb}{rate}\n<b>Poziom {b.level + 1}:</b> {Land.CostText(next)} · {Land.Countdown(now + next.seconds * 1000d, now)}";
            if (why != null)
            {
                ui.ShowDialog($"{kind.name} · poziom {b.level}", text + $"\n<color=#bd1c31><b>{why}</b></color>");
                return;
            }
            var id = b.id;
            ui.ShowChoice($"{kind.name} · poziom {b.level}", text, "Ulepsz", "Zamknij", () => _ = UpgradeLand(id), null);
        }

        void AskRename()
        {
            if (!land.Has) return;
            landScreen.AskName("Nowa nazwa", "Jak ma się teraz nazywać twój dystrykt?", land.State.name, "Zmień", n => _ = RenameLand(n));
        }

        // ---------- asking the server ----------

        /// <summary>One request about the district: the answer becomes the land, the message says what happened.</summary>
        async Awaitable LandCall(Func<Awaitable<LandResponse>> call, Func<LandResponse, string> done)
        {
            if (landBusy || session == null) return;
            landBusy = true;
            try
            {
                var res = await call();
                land.Apply(res.land);
                if (res.coins >= 0) landCoins = res.coins;
                AfterLandChange();
                var message = done(res);
                if (!string.IsNullOrEmpty(message)) ui.ShowToast(message, 2.6f);
                landScreen?.SetStatus(message);
            }
            catch (ApiException e)
            {
                ui.ShowToast(e.Message, 3f);
                landScreen?.SetStatus(e.Message, true);
            }
            finally
            {
                landBusy = false;
            }
        }

        async Awaitable BuildLand(string kind, Vector2Int anchor)
        {
            var name = land.Rules.Building(kind)?.name ?? kind;
            await LandCall(() => api.Build(session.Token, kind, anchor.x, anchor.y), _ =>
            {
                StopPlacing();
                return $"Budowa ruszyła: {name}";
            });
        }

        async Awaitable UpgradeLand(int id) =>
            await LandCall(() => api.UpgradeBuilding(session.Token, id), _ => "Ulepszanie ruszyło");

        async Awaitable CollectLand(int id) =>
            await LandCall(() => api.Collect(session.Token, id), GatheredText);

        async Awaitable GrowLand() =>
            await LandCall(() => api.GrowLand(session.Token), _ =>
            {
                var side = land.StageArea(land.State.stage).width;
                return $"Dystrykt rośnie: etap {land.State.stage}, {side}×{side} pól!";
            });

        async Awaitable RenameLand(string name)
        {
            if (landBusy || session == null) return;
            landBusy = true;
            try
            {
                var res = await api.RenameLand(session.Token, name);
                land.Apply(res.land);
                AfterLandChange();
                ui.ShowToast($"Dystrykt {land.State.name}", 2.6f);
            }
            catch (ApiException e)
            {
                if (e.Status == 400) landScreen.NameRejected(e.Message, n => _ = RenameLand(n));
                else ui.ShowToast(e.Message, 3f);
            }
            finally
            {
                landBusy = false;
            }
        }

        async Awaitable SellResource(string resource, int amount) =>
            await LandCall(() => api.SellResource(session.Token, resource, amount), res =>
                res.coins >= 0 ? $"Sprzedane. Masz {Coins(res.coins)}." : "Sprzedane.");

        string GatheredText(LandResponse res)
        {
            var g = res.gathered;
            var parts = new System.Collections.Generic.List<string>();
            if (res.rent > 0) parts.Add($"czynsz {Coins(res.rent)}");
            if ((g == null || g.IsEmpty) && parts.Count == 0) return "Magazyny pełne: sprzedaj coś albo postaw centrum logistyczne.";
            foreach (var r in land.Rules.resources)
            {
                var n = g?.Get(r.id) ?? 0;
                if (n > 0) parts.Add($"+{n} ({r.name.ToLowerInvariant()})");
            }
            return string.Join(", ", parts);
        }
    }
}
