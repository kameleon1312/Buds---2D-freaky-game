using System;
using System.Collections.Generic;
using Buds.Api;
using Buds.Characters;
using Buds.Quests;
using Buds.UI;
using Buds.World;
using UnityEngine;

namespace Buds.Core
{
    /// <summary>
    /// Rides, energy drinks and training on the map. The ride worn in the "Wierzchowiec" slot carries the bud outdoors
    /// (R or the HUD button gets on and off); drinks start boosts the server keeps and applies (the game shows the
    /// timers and walks faster with Turbo); training stations open a timing mini-game whose score the server turns
    /// into training XP, ranks and special abilities (perks).
    /// </summary>
    public sealed partial class GameBootstrap
    {
        const float TrainingRange = 1.6f;

        TrainingWorld trainingWorld;
        TrainingScreen trainingScreen;
        TrainingSpotData nearbyTraining;
        PropArt rideArt;
        bool riding = true; // get on a worn ride by default
        readonly List<string> perks = new();
        readonly Dictionary<string, int> drinks = new(); // item -> count
        readonly Dictionary<string, float> buffEnds = new(); // buff -> realtimeSinceStartup when it runs out
        readonly Dictionary<string, float> trainingReady = new(); // spot -> realtime when it can be used again
        readonly Dictionary<string, int> trainingXp = new(); // skill -> training XP
        readonly Dictionary<string, int> spentRanks = new(); // skill -> points spent
        float buffTick;

        void SetUpRides()
        {
            trainingScreen ??= new TrainingScreen(ui.Root, FinishTraining);
            if (session != null) _ = LoadConsumables();
        }

        /// <summary>Called after a map is built: its training stations and the ride (outdoors only).</summary>
        void SetUpMapExtras()
        {
            trainingWorld = TrainingWorld.Create(world, quests.Content);
            ApplyRide();
        }

        string MountKind() =>
            equipped.TryGetValue("mount", out var id) && quests.Content.Item(id) is { IsMount: true } ? Rides.KindOf(id) : null;

        /// <summary>Puts the bud on its ride (or off it) and recomputes the walking speed.</summary>
        void ApplyRide()
        {
            if (!player || world == null) return;
            var kind = MountKind();
            var canRide = kind != null && !world.Map.IsInterior;
            if (canRide && riding)
            {
                rideArt ??= LoadRideArt();
                player.SetRide(new BudController.RideLook
                {
                    Kind = kind,
                    Side = rideArt.Get(Rides.SpriteFor(kind, Facing.Side)),
                    Front = rideArt.Get(Rides.SpriteFor(kind, Facing.Down)),
                    Back = rideArt.Get(Rides.SpriteFor(kind, Facing.Up)),
                });
            }
            else if (player.Ride != null) player.SetRide(null);
            ui.SetRideButton(canRide, riding ? "Zsiądź  [R]" : "Wsiądź  [R]", ToggleRide,
                equipped.TryGetValue("mount", out var mountItem) ? mountItem : null);
            ApplySpeed();
        }

        PropArt LoadRideArt()
        {
            var names = new HashSet<string>();
            foreach (var item in quests.Content.items)
                if (item.IsMount)
                    foreach (var n in Rides.SpriteNames(Rides.KindOf(item.id)))
                        names.Add(n);
            return PropArt.Load(names);
        }

        void ApplySpeed()
        {
            if (!player) return;
            var kind = player.Ride?.Kind;
            var mount = kind != null && equipped.TryGetValue("mount", out var id) ? quests.Content.Item(id)?.mountSpeed ?? 0 : 0;
            player.Motor.SpeedMultiplier = Rides.SpeedMultiplier(gear.Speed, mount, Rides.PerkSpeedPercent(perks), BuffActive("turbo"));
        }

        void ToggleRide()
        {
            if (MountKind() == null || world.Map.IsInterior) return;
            riding = !riding;
            ApplyRide();
            var item = quests.Content.Item(equipped["mount"]);
            ui.ShowToast(riding ? $"Jedziesz: {item?.name} (+{item?.mountSpeed}% szybkości)" : "Idziesz pieszo", 2f);
        }

        bool BuffActive(string id) => buffEnds.TryGetValue(id, out var end) && end > Time.realtimeSinceStartup;

        /// <summary>Per frame: the ride key, the boost timers on the HUD, the training mini-game.</summary>
        bool UpdateRidesAndTraining(PlayerInput input)
        {
            if (trainingScreen != null && trainingScreen.IsOpen)
            {
                trainingScreen.Tick();
                return true;
            }
            if (input.RidePressed && !ui.DialogOpen) ToggleRide();
            panel?.Tick();
            if (Time.realtimeSinceStartup >= buffTick)
            {
                buffTick = Time.realtimeSinceStartup + 1;
                var parts = new List<string>();
                var expired = false;
                foreach (var (id, end) in buffEnds)
                {
                    var left = Mathf.CeilToInt(end - Time.realtimeSinceStartup);
                    if (left <= 0)
                    {
                        if (left > -2) expired = true;
                        continue;
                    }
                    parts.Add($"{quests.Content.Buff(id)?.name ?? id} {left / 60}:{left % 60:00}");
                }
                ui.SetBuffLine(parts.Count > 0 ? string.Join("   ", parts) : "");
                if (expired) ApplySpeed();
            }
            return false;
        }

        string TrainingHint(TrainingSpotData spot)
        {
            var skill = Array.Find(quests.Content.skills, s => s.id == spot.skill)?.name ?? spot.skill;
            if (trainingReady.TryGetValue(spot.id, out var at) && at > Time.realtimeSinceStartup)
                return $"{spot.name}: odpocznij jeszcze {Mathf.CeilToInt(at - Time.realtimeSinceStartup)} s";
            return $"Trenuj: {skill} ({spot.name})  [E]";
        }

        void StartTraining(TrainingSpotData spot)
        {
            if (trainingReady.TryGetValue(spot.id, out var at) && at > Time.realtimeSinceStartup)
            {
                ui.ShowToast($"Odpocznij jeszcze {Mathf.CeilToInt(at - Time.realtimeSinceStartup)} s", 2f);
                return;
            }
            var skill = Array.Find(quests.Content.skills, s => s.id == spot.skill)?.name ?? spot.skill;
            activeTraining = spot;
            ui.SetHint(null);
            trainingScreen.Open(spot, skill, quests.Content.trainingMaxScore);
        }

        TrainingSpotData activeTraining;

        /// <summary>Sends the score; returns the line the screen shows (XP, a new rank, unlocked abilities).</summary>
        async Awaitable<string> FinishTraining(int score)
        {
            var spot = activeTraining;
            if (spot == null) return "";
            var content = quests.Content;
            var skillName = Array.Find(content.skills, s => s.id == spot.skill)?.name ?? spot.skill;
            if (session == null)
            {
                trainingReady[spot.id] = Time.realtimeSinceStartup + 10;
                return "Grasz jako gość: połącz Buda ze strony, żeby trening się liczył.";
            }
            try
            {
                var res = await api.Train(session.Token, spot.id, score);
                trainingReady[spot.id] = Time.realtimeSinceStartup + res.cooldown;
                ApplySkills(await api.GetSkills(session.Token));
                var per = content.trainingXpPerRank;
                var text = $"<b>+{res.xpGained} XP treningu</b> · {skillName} {res.trainingXp % per}/{per}";
                if (res.rankUp) text += $"\n<color=#5d9a12><b>{skillName}: ranga {res.rank}!</b></color>";
                foreach (var id in res.perksUnlocked ?? Array.Empty<string>())
                {
                    var perk = content.Perk(id);
                    text += $"\n<color=#d98a0b><b>Nowa umiejętność: {perk?.name ?? id}</b></color>";
                    ui.ShowToast($"Wyjątkowa umiejętność: {perk?.name ?? id}!", 3.5f);
                }
                if (BuffActive("skupienie")) text += "\n<size=18>Skupienie: podwójne XP</size>";
                return text;
            }
            catch (ApiException e)
            {
                if (e.Status == 409) trainingReady[spot.id] = Time.realtimeSinceStartup + 15;
                return $"<color=#bd1c31>{e.Message}</color>";
            }
        }

        // ---------- energy drinks ----------

        async Awaitable LoadConsumables()
        {
            if (session == null) return;
            try
            {
                ApplyConsumables(await api.GetConsumables(session.Token));
            }
            catch (ApiException e)
            {
                Debug.LogWarning($"Could not load drinks: {e.Message}");
            }
        }

        void ApplyConsumables(ConsumablesResponse res)
        {
            drinks.Clear();
            foreach (var i in res.items ?? Array.Empty<OwnedConsumableDto>()) drinks[i.itemId] = i.qty;
            buffEnds.Clear();
            foreach (var b in res.buffs ?? Array.Empty<ActiveBuffDto>())
                buffEnds[b.buff] = Time.realtimeSinceStartup + b.secondsLeft;
            if (panelData != null) FillDrinks(panelData);
            buffTick = 0;
            ApplySpeed();
        }

        void FillDrinks(BudPanelData d)
        {
            d.Drinks.Clear();
            foreach (var (id, n) in drinks) d.Drinks[id] = n;
            d.Buffs.Clear();
            foreach (var (id, end) in buffEnds) d.Buffs[id] = end;
        }

        async Awaitable Drink(string itemId)
        {
            if (session == null || panelData == null || panelData.Loading) return;
            panelData.Loading = true;
            panel.Refresh(panelData);
            try
            {
                ApplyConsumables(await api.UseConsumable(session.Token, itemId));
                panelData.Error = null;
                var item = quests.Content.Item(itemId);
                var buff = item != null ? quests.Content.Buff(item.drink) : null;
                ui.ShowToast($"Wypito: {item?.name}. {buff?.description}", 3f);
            }
            catch (ApiException e)
            {
                panelData.Error = e.Message;
                ui.ShowToast(e.Message, 2.5f);
            }
            panelData.Loading = false;
            if (panel.IsOpen) panel.Refresh(panelData);
        }
        // ---------- autopilot ----------

        /// <summary>
        /// Autopilot (-buds-ride-demo, paired bud): earns coins from caches of the start district, buys a skateboard and
        /// a drink, rides in every facing, drinks Turbo, trains at a station and shows the panel tabs.
        /// </summary>
        async Awaitable RideDemo(Func<string, Awaitable> shot)
        {
            if (world.Map.Id != Districts.Start) LoadDistrict(Districts.Start, null);
            var opened = 0;
            foreach (var c in new List<CacheData>(caches.On(world.Map.Id)))
            {
                if (caches.Opened.Contains(c.id) || c.minLevel > level) continue;
                // E prefers people: skip caches with someone standing next to them
                var near = (Vector2)world.CellCenter(c.x, c.y + 1);
                if (questWorld.NearestNpc(near, 4) || enemyWorld.Nearest(near, 4)) continue;
                Teleport(c.x, c.y + 1);
                await Awaitable.WaitForSecondsAsync(0.4f);
                player.Input.PressInteract();
                for (var i = 0; i < 30 && (openingCache || !caches.Opened.Contains(c.id)); i++)
                    await Awaitable.WaitForSecondsAsync(0.1f);
                await Awaitable.WaitForSecondsAsync(0.6f); // the result dialog
                if (fightScreen != null && fightScreen.IsOpen)
                {
                    await Flee();
                    CloseFight();
                }
                if (ui.DialogOpen) ui.HideDialog();
                await Awaitable.WaitForSecondsAsync(0.2f);
                opened++;
            }

            await Awaitable.WaitForSecondsAsync(1f);
            if (fightScreen != null && fightScreen.IsOpen)
            {
                await Flee();
                CloseFight();
            }
            await OpenPanel();
            await Awaitable.WaitForSecondsAsync(0.3f);
            await Buy("mount-deskorolka");
            await Buy("napoj-turbo");
            await Buy("napoj-skupienie");
            panel.SelectTab(BudPanel.TabShop);
            panel.SelectShopItem("mount-hulajnowa");
            await shot("r1-sklep-wierzchowce.png");
            panel.SelectShopItem("napoj-sila");
            await shot("r1-sklep-napoje.png");
            await Equip("mount", "mount-deskorolka");
            panel.SelectTab(BudPanel.TabGear);
            panel.SelectSlot("mount");
            await shot("r2-ekwipunek-wierzchowiec.png");
            await Drink("napoj-turbo");
            await Drink("napoj-skupienie");
            panel.SelectTab(BudPanel.TabDrinks);
            await shot("r3-napoje.png");
            panel.SelectTab(BudPanel.TabShop);
            panel.SelectShopItem("mount-motocykl-smok");
            await shot("r9-premium.png");
            panel.SelectShopItem("premium-kij-neon");
            await shot("r9-premium-bron.png");
            panel.Hide();

            Teleport(world.Map.SpawnX, world.Map.SpawnY);
            foreach (var (dir, name) in new[] { (Vector2.left, "bok"), (Vector2.down, "przod"), (Vector2.up, "tyl") })
            {
                player.Input.Override = dir;
                await Awaitable.WaitForSecondsAsync(0.5f);
                await shot($"r4-jazda-{name}.png");
                player.Input.Override = Vector2.zero;
            }
            Debug.Log($"[AutoPilot] riding {player.Ride?.Kind}, motor x{player.Motor.SpeedMultiplier}");

            var spot = Array.Find(quests.Content.training, t => t.map == world.Map.Id);
            if (spot != null)
            {
                Teleport(spot.x, spot.y + 1);
                player.Look(Vector2.up);
                await Awaitable.WaitForSecondsAsync(0.5f);
                await shot("r5-stanowisko.png");
                player.Input.PressInteract();
                await Awaitable.WaitForSecondsAsync(0.4f);
                for (var round = 0; round < 5 && trainingScreen.IsOpen && !trainingScreen.Game.Done; round++)
                {
                    await Awaitable.WaitForSecondsAsync(0.3f);
                    var g = trainingScreen.Game;
                    // four hits and one miss
                    g.SetMarker(round == 2 ? (g.ZoneMax + 0.1f > 1 ? g.ZoneMin - 0.1f : g.ZoneMax + 0.1f) : g.ZoneCenter);
                    if (round == 1) await shot("r6-trening.png");
                    trainingScreen.Press();
                }
                for (var i = 0; i < 50 && !trainingScreen.Finished; i++) await Awaitable.WaitForSecondsAsync(0.1f);
                await shot("r7-trening-wynik.png");
                trainingScreen.Press();
            }

            await OpenPanel();
            await Awaitable.WaitForSecondsAsync(0.3f);
            panel.SelectTab(BudPanel.TabSkills);
            await shot("r8-umiejetnosci.png");
            panel.Hide();
            LoadDistrict(Districts.Start, null);
        }
    }
}
