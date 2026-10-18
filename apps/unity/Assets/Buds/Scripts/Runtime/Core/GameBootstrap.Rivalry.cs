using System;
using System.Collections.Generic;
using Buds.Api;
using Buds.Characters;
using Buds.Quests;
using Buds.UI;
using Buds.World;
using UnityEngine;
using Keyboard = UnityEngine.InputSystem.Keyboard;

namespace Buds.Core
{
    /// <summary>
    /// Rywalizacja (docs/rywalizacja.md): the Rewiry screen (turfs and tribute, the week's ranking, the crew, duels
    /// with other buds, the Bazar), who rules the turf the bud walks into, and the moments when influence is earned
    /// or a turf is taken. Everything is decided by the server; the game asks and shows.
    /// </summary>
    public sealed partial class GameBootstrap
    {
        RivalryScreen rivalryScreen;
        RivalryData rivalryData;
        /// <summary>The current district's turfs by name (zones and turfs share names), from the last answer.</summary>
        readonly Dictionary<string, TurfStateDto> turfsByName = new();
        string turfsDistrict;
        bool rivalryBusy;
        bool turfsLoading;
        float leaveArmedUntil;
        PvpResultDto lastPvp;
        InfluenceDto lastInfluence;

        void SetUpRivalry()
        {
            rivalryScreen ??= new RivalryScreen(ui.Root, quests.Content, new RivalryScreen.Actions(
                tab => _ = LoadRivalryTab(tab),
                turf => _ = CollectTribute(turf),
                (name, tag) => _ = CreateCrew(name, tag),
                tag => _ = JoinCrew(tag),
                () => _ = LeaveCrew(),
                slug => _ = ChallengeBud(slug),
                (item, price) => _ = Sell(item, price),
                id => _ = BuyListing(id),
                id => _ = CancelListing(id)), () => rivalryScreen.Hide());
            ui.ShowRivalryButton(() => OpenRivalry(RivalryScreen.TabTurfs));
        }

        /// <summary>The district whose turfs count here: a room counts for the street outside, the island for the city.</summary>
        string TurfDistrict()
        {
            var id = world.Map.IsInterior ? world.Map.Outside : world.Map.Id;
            return Districts.Get(id) != null ? id : "miasto-ziomkow";
        }

        /// <summary>Handles G and Esc; true while the screen is open (the world waits).</summary>
        bool UpdateRivalry(PlayerInput input)
        {
            if (rivalryScreen == null) return false;
            if (rivalryScreen.IsOpen)
            {
                rivalryScreen.Tick();
                if (input.CancelPressed) rivalryScreen.Hide();
                return rivalryScreen.IsOpen;
            }
            var kb = Keyboard.current;
            if (kb != null && kb.gKey.wasPressedThisFrame && !ui.DialogOpen) OpenRivalry(RivalryScreen.TabTurfs);
            return rivalryScreen.IsOpen;
        }

        void OpenRivalry(int tab)
        {
            if (rivalryScreen == null || (fightScreen?.IsOpen ?? false)) return;
            panel?.Hide();
            mapScreen?.Hide();
            rivalryData = new RivalryData
            {
                Guest = session == null,
                Level = level,
                MySlug = session?.Slug,
                DistrictName = Districts.NameOf(TurfDistrict()),
            };
            rivalryScreen.Show(rivalryData, tab);
        }

        async Awaitable LoadRivalryTab(int tab)
        {
            if (session == null || rivalryData == null) return;
            var data = rivalryData;
            try
            {
                switch (tab)
                {
                    case RivalryScreen.TabTurfs:
                        data.Turfs = await api.GetTurfs(session.Token, TurfDistrict());
                        data.Me = await api.GetRivalryMe(session.Token);
                        ApplyTurfs(data.Turfs);
                        ApplyMe(data.Me);
                        break;
                    case RivalryScreen.TabRanking:
                        data.Ranking = await api.GetRanking(session.Token);
                        data.Me = await api.GetRivalryMe(session.Token);
                        ApplyMe(data.Me);
                        break;
                    case RivalryScreen.TabCrew:
                        data.Crew = await api.GetMyCrew(session.Token);
                        if (!data.Crew.Present) data.Crews = await api.GetCrews(session.Token);
                        break;
                    case RivalryScreen.TabPvp:
                        if (level >= Rivalry.MinLevel) data.Pvp = await api.GetPvpOpponents(session.Token);
                        break;
                    default:
                        if (level < Rivalry.MinLevel) break;
                        data.Market = await api.GetMarket(session.Token);
                        await LoadSellable(data);
                        break;
                }
            }
            catch (ApiException e)
            {
                rivalryScreen.SetStatus(e.Message, true);
            }
            if (data == rivalryData) rivalryScreen.Refresh(data);
        }

        /// <summary>Owned, unworn items the Bazar takes (the server checks again).</summary>
        async Awaitable LoadSellable(RivalryData data)
        {
            var items = await api.GetItems(session.Token);
            var worn = (await api.GetEquipment(session.Token)).slots?.ToDictionary() ?? new Dictionary<string, string>();
            var rewards = new HashSet<string>();
            foreach (var q in quests.Content.quests)
                if (!string.IsNullOrEmpty(q.rewardItem)) rewards.Add(q.rewardItem);
            data.Sellable.Clear();
            foreach (var i in items)
                if (!worn.ContainsValue(i.itemId) && Rivalry.Tradeable(quests.Content.Item(i.itemId), rewards))
                    data.Sellable.Add(i.itemId);
        }

        // ---------- turfs, the zone banner, influence ----------

        /// <summary>Loads who rules the district's turfs (on arrival and after influence changed them).</summary>
        async Awaitable RefreshTurfs()
        {
            if (session == null || turfsLoading || world == null) return;
            turfsLoading = true;
            try
            {
                ApplyTurfs(await api.GetTurfs(session.Token, TurfDistrict()));
                ApplyMe(await api.GetRivalryMe(session.Token));
            }
            catch (ApiException e)
            {
                Debug.LogWarning($"Could not load turfs: {e.Message}");
            }
            finally
            {
                turfsLoading = false;
            }
        }

        void ApplyTurfs(TurfsResponse res)
        {
            turfsByName.Clear();
            turfsDistrict = TurfDistrict();
            foreach (var t in res?.turfs ?? Array.Empty<TurfStateDto>()) turfsByName[t.name] = t;
        }

        void ApplyMe(RivalryMeResponse me)
        {
            var ready = false;
            foreach (var r in me?.ruled ?? Array.Empty<RuledTurfDto>()) ready |= r.tributeReady;
            ui.SetRivalryBadge(ready);
        }

        /// <summary>The banner when walking into a zone: its name and, on a turf, who rules it this week.</summary>
        string ZoneLine(Zone zone)
        {
            if (zone == null) return null;
            if (session != null && !world.Map.IsInterior && turfsDistrict == world.Map.Id &&
                turfsByName.TryGetValue(zone.Name, out var turf))
                return Rivalry.RulerLine(turf, session.Slug);
            return zone.Name;
        }

        /// <summary>
        /// Influence just earned: a taken turf gets the sprayed stamp, otherwise a short line (unless the caller
        /// already shows it). The turf list is refreshed from the server afterwards.
        /// </summary>
        void OnInfluence(InfluenceDto influence, bool toast = true)
        {
            if (influence == null || !influence.Present) return;
            if (influence.captured) _ = ui.ShowCapture(influence.name);
            else if (toast) ui.ShowToast(Rivalry.InfluenceLine(influence), 2.6f);
            _ = RefreshTurfs();
        }

        // ---------- actions ----------

        async Awaitable CollectTribute(string turf)
        {
            if (rivalryBusy || session == null) return;
            rivalryBusy = true;
            try
            {
                var res = await api.CollectTribute(session.Token, turf);
                rivalryScreen.SetStatus($"Haracz zebrany: +{Coins(res.gained)} (masz {res.coins}).");
                if (panelData != null) panelData.Coins = res.coins;
            }
            catch (ApiException e)
            {
                rivalryScreen.SetStatus(e.Message, true);
            }
            finally
            {
                rivalryBusy = false;
            }
            await LoadRivalryTab(RivalryScreen.TabTurfs);
        }

        async Awaitable CreateCrew(string name, string tag)
        {
            if (rivalryBusy || session == null) return;
            name = (name ?? "").Trim();
            tag = (tag ?? "").Trim();
            if (name.Length < 3 || tag.Length < 2)
            {
                rivalryScreen.SetStatus("Nazwa ekipy ma 3–20 znaków, tag 2–4 litery lub cyfry.", true);
                return;
            }
            await CrewAction(() => api.CreateCrew(session.Token, name, tag), c => $"Ekipa {c.name} [{c.tag}] założona. Jesteś liderem.");
        }

        async Awaitable JoinCrew(string tag) =>
            await CrewAction(() => api.JoinCrew(session.Token, tag), c => $"Witaj w ekipie {c.name} [{c.tag}]!");

        async Awaitable LeaveCrew()
        {
            // a second tap within a few seconds confirms: leaving is the one action here that can't be undone
            if (Time.realtimeSinceStartup > leaveArmedUntil)
            {
                leaveArmedUntil = Time.realtimeSinceStartup + 4;
                rivalryScreen.SetStatus("Na pewno? Naciśnij „Opuść ekipę” jeszcze raz.", true);
                return;
            }
            leaveArmedUntil = 0;
            await CrewAction(() => api.LeaveCrew(session.Token), _ => "Ekipa opuszczona.");
        }

        async Awaitable CrewAction(Func<Awaitable<CrewResponse>> call, Func<CrewDto, string> done)
        {
            if (rivalryBusy || session == null) return;
            rivalryBusy = true;
            try
            {
                var res = await call();
                rivalryScreen.SetStatus(done(res.crew));
            }
            catch (ApiException e)
            {
                rivalryScreen.SetStatus(e.Message, true);
            }
            finally
            {
                rivalryBusy = false;
            }
            await LoadRivalryTab(RivalryScreen.TabCrew);
        }

        /// <summary>Challenges another bud: their sheet first (so a failed download wastes no rematch time), then the duel.</summary>
        async Awaitable ChallengeBud(string slug)
        {
            if (rivalryBusy || fightBusy || session == null) return;
            rivalryBusy = true;
            fightBusy = true;
            try
            {
                rivalryScreen.SetStatus("Rywal wchodzi na plac…");
                var theirs = new BudSheet(await api.GetSheet(slug), true);
                var res = await api.StartPvp(session.Token, slug);
                rivalryScreen.Hide();
                currentFight = res.fight;
                fightingWith = null;
                lastReward = null;
                lastPvp = null;
                lastInfluence = null;
                fightScreen.Open(res.fight, sheet, theirs, "Pokaż, co potrafisz.", gear);
            }
            catch (ApiException e)
            {
                rivalryScreen.SetStatus(e.Message, true);
                _ = LoadRivalryTab(RivalryScreen.TabPvp);
            }
            finally
            {
                rivalryBusy = false;
                fightBusy = false;
            }
        }

        async Awaitable Sell(string itemId, int price)
        {
            await MarketAction(() => api.Sell(session.Token, itemId, price),
                () => $"Wystawione: {quests.Content.Item(itemId)?.name ?? itemId} za {Coins(price)} (dostaniesz {Rivalry.Payout(price)}).");
        }

        async Awaitable BuyListing(string id)
        {
            var name = Array.Find(rivalryData?.Market?.listings ?? Array.Empty<ListingDto>(), l => l.id == id) is { } l
                ? quests.Content.Item(l.itemId)?.name ?? l.itemId
                : "przedmiot";
            await MarketAction(() => api.BuyListing(session.Token, id), () => $"Kupione: {name}. Załóż w Ekwipunku (Twój Bud).");
        }

        async Awaitable CancelListing(string id) =>
            await MarketAction(() => api.CancelListing(session.Token, id), () => "Oferta wycofana, przedmiot wrócił do ciebie.");

        async Awaitable MarketAction(Func<Awaitable<MarketResponse>> call, Func<string> done)
        {
            if (rivalryBusy || session == null || rivalryData == null) return;
            rivalryBusy = true;
            try
            {
                rivalryData.Market = await call();
                if (panelData != null) panelData.Coins = rivalryData.Market.coins;
                await LoadSellable(rivalryData);
                rivalryScreen.SetStatus(done());
            }
            catch (ApiException e)
            {
                rivalryScreen.SetStatus(e.Message, true);
            }
            finally
            {
                rivalryBusy = false;
            }
            rivalryScreen.Refresh(rivalryData);
        }

        /// <summary>Autopilot: every tab of the Rewiry screen, a tribute if one is waiting, and a duel with another bud.</summary>
        async Awaitable RivalryDemo(Func<string, Awaitable> shot)
        {
            await RefreshTurfs();
            OpenRivalry(RivalryScreen.TabTurfs);
            await Awaitable.WaitForSecondsAsync(2.5f);
            await shot("r0-turfs.png");
            foreach (var t in rivalryData.Turfs?.turfs ?? Array.Empty<TurfStateDto>())
                if (t.tributeReady)
                {
                    await CollectTribute(t.id);
                    await Awaitable.WaitForSecondsAsync(1.5f);
                    await shot("r0b-tribute.png");
                    break;
                }
            string[] names = { "r1-ranking.png", "r2-crew.png", "r3-pvp.png", "r4-market.png" };
            for (var tab = 1; tab < 5; tab++)
            {
                rivalryScreen.SelectTab(tab);
                await Awaitable.WaitForSecondsAsync(2.5f);
                await shot(names[tab - 1]);
            }
            // a duel with the first bud in reach, played to the end
            var opponent = Array.Find(rivalryData.Pvp?.opponents ?? Array.Empty<PvpOpponentDto>(), o => o.wait == 0);
            if (opponent != null)
            {
                await ChallengeBud(opponent.slug);
                await Awaitable.WaitForSecondsAsync(1.6f);
                await shot("r5-pvp-start.png");
                for (var turn = 0; turn < 30 && currentFight is { status: "active" }; turn++)
                    await FightMove(fightScreen.MoveAt(turn % 3 == 2 ? 0 : 1) ?? fightScreen.MoveAt(0));
                await Awaitable.WaitForSecondsAsync(0.4f);
                await shot("r6-pvp-result.png");
                CloseFight();
                await Awaitable.WaitForSecondsAsync(1.5f);
                await shot("r7-after.png");
            }
            rivalryScreen.Hide();
            // the stamp of a taken turf, as the player sees it
            _ = ui.ShowCapture(world.Map.Zones.Count > 0 ? world.Map.Zones[0].Name : "Rynek");
            await Awaitable.WaitForSecondsAsync(0.9f);
            await shot("r8-capture.png");
            Debug.Log($"[AutoPilot] rivalry demo done, pvp {(opponent != null ? currentFight?.status : "none")}");
        }
    }
}
