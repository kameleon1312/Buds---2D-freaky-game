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
    /// Making a bud in the game (no website needed) and the tutorial island every new bud starts on: its pier opens
    /// once the final tutorial quest is handed in, and the bud sails to Miasto Ziomków.
    /// </summary>
    public sealed partial class GameBootstrap
    {
        CreatorScreen creatorScreen;
        bool creating;

        async Awaitable OpenCreator()
        {
            HidePairing();
            ui.ShowLoading("Otwieram kreator…");
            api = new BudsApi(PlayerSession.ApiBaseUrl);
            try
            {
                var options = await api.GetLookOptions();
                creatorScreen ??= new CreatorScreen(ui.Root, l => api.PreviewSheet(l), (name, l) => _ = CreateBud(name, l), () =>
                {
                    creatorScreen.Hide();
                    ShowPairing();
                });
                ui.HideLoading();
                creatorScreen.Show(options);
            }
            catch (ApiException e)
            {
                ui.HideLoading();
                ShowPairing(e.Message);
            }
        }

        /// <summary>The server creates the bud and hands back its token: this phone is linked right away.</summary>
        async Awaitable CreateBud(string name, BudLookDto chosen)
        {
            if (creating) return;
            creating = true;
            creatorScreen.SetBusy(true);
            try
            {
                var res = await api.CreateBud(name, chosen);
                var created = new PlayerSession(res.token, res.bud.slug);
                created.Save();
                look = res.bud.look;
                var tex = await api.GetSheet(res.bud.slug);
                creatorScreen.Hide();
                EnterWorld(res.bud.name, res.bud.xp, new BudSheet(tex), created, Array.Empty<string>());
                ui.ShowToast($"Witaj, {res.bud.name}!", 3f);
            }
            catch (ApiException e)
            {
                creatorScreen.SetBusy(false, e.Message);
            }
            finally
            {
                creating = false;
            }
        }

        /// <summary>Where a bud starts: the island until its tutorial is done, then Miasto Ziomków.</summary>
        string StartMap() =>
            quests.TutorialDone(Districts.Tutorial, Districts.TutorialFinalQuest) ? Districts.Start : Districts.Tutorial;

        /// <summary>The pier: the boat waits for the captain's word (the final tutorial quest).</summary>
        bool TutorialExitBlocked()
        {
            if (world.Map.Id != Districts.Tutorial || quests.Completed.Contains(Districts.TutorialFinalQuest)) return false;
            ui.ShowDialog("Sternik Józek", "Łódź odpłynie, gdy Kapitan Bosman da zgodę. Dokończ zadania na wyspie.");
            return true;
        }

        /// <summary>A guest can't fight on the server: the training dummy counts as practised.</summary>
        bool PracticeAsGuest(EnemyView enemy)
        {
            if (session != null || enemy.Data.district != Districts.Tutorial) return false;
            if (quests.Duel(enemy.Data.id))
                ui.ShowDialog("Trenerka Ewa", "Ćwiczysz na sucho, bo grasz jako gość. Zaliczam! Prawdziwe pojedynki toczy połączony Bud.");
            else ui.ShowDialog(enemy.Data.name, "Manekin stoi spokojnie. Weź zadanie od Trenerki Ewy.");
            enemyWorld.Rest(enemy.Data.id, 5);
            return true;
        }

        // ---------- autopilot ----------

        /// <summary>Autopilot: the creator — every tab, a few changes, then a new bud named "Autko".</summary>
        async Awaitable CreatorDemo(string dir)
        {
            System.IO.Directory.CreateDirectory(dir);
            async Awaitable Shot(string file)
            {
                await Awaitable.WaitForSecondsAsync(0.9f);
                ScreenCapture.CaptureScreenshot(System.IO.Path.Combine(dir, file));
                await Awaitable.WaitForSecondsAsync(0.3f);
            }
            ShowPairing();
            await Shot("c0-welcome.png");
            await OpenCreator();
            await Shot("c1-postac.png");
            creatorScreen.Set(l =>
            {
                l.gender = "ona";
                l.hair = "kitki";
                l.hairColor = 4;
                l.outfit = "sukienka";
                l.outfitColor = 10;
                l.pants = "legginsy";
                l.pantsColor = 1;
                l.shoes = "kozaki";
                l.shoesColor = 6;
            });
            creatorScreen.SelectTab(1);
            await Shot("c2-wlosy.png");
            creatorScreen.SelectTab(3);
            await Shot("c3-nogi.png");
            creatorScreen.SelectTab(4);
            await Shot("c4-buty.png");
            creatorScreen.Name = "Autko";
            await CreateBud("Autko", creatorScreen.Look.Clone());
            await Shot("c5-island.png");
        }

        /// <summary>Autopilot: the whole tutorial — every quest on the island, the duel, the boat to the city.</summary>
        async Awaitable TutorialDemo(Func<string, Awaitable> shot)
        {
            if (world.Map.Id != Districts.Tutorial) LoadDistrict(Districts.Tutorial, null);
            async Awaitable Press()
            {
                player.Input.PressInteract();
                await Awaitable.WaitForSecondsAsync(0.3f);
            }
            async Awaitable Visit(string npcId)
            {
                var n = quests.Content.Npc(npcId);
                Teleport(n.x, n.y + 1);
                await Awaitable.WaitForSecondsAsync(0.3f);
                await Press();
            }
            async Awaitable HandIn(string npcId)
            {
                await Visit(npcId);
                for (var i = 0; i < 40 && handingIn; i++) await Awaitable.WaitForSecondsAsync(0.1f);
                await Awaitable.WaitForSecondsAsync(0.3f);
            }

            await Visit("bosman");
            await shot("t1-offer.png");
            await Press(); // accept
            Teleport(18, 17); // the lighthouse hill
            await Awaitable.WaitForSecondsAsync(0.8f);
            await shot("t2-hill.png");
            await HandIn("bosman");
            await Press();

            await Visit("rybak-staszek");
            await Press();
            foreach (var (_, step, spot) in new List<(QuestData, StepData, int)>(quests.Pickups(world.Map.Id)))
            {
                Teleport(step.spots[spot].x, step.spots[spot].y);
                await Awaitable.WaitForSecondsAsync(0.4f);
            }
            await HandIn("rybak-staszek");
            await Press();

            await Visit("trenerka-ewa");
            await Press();
            await shot("t3-trening.png");
            // the dummy
            var dummy = enemyWorld.Nearest(world.CellCenter(53, 42), 3);
            if (dummy != null)
            {
                if (session == null) PracticeAsGuest(dummy);
                else
                {
                    await StartDuel(dummy);
                    await Awaitable.WaitForSecondsAsync(0.4f);
                    for (var turn = 0; turn < 20 && currentFight is { status: "active" }; turn++)
                    {
                        await FightMove(fightScreen.MoveAt(turn % 2 == 0 ? 2 : 1) ?? fightScreen.MoveAt(0));
                        if (turn == 0) await shot("t4-duel.png");
                    }
                    await shot("t5-duel-won.png");
                    CloseFight();
                }
                await Press();
            }
            await HandIn("trenerka-ewa");
            await Press();

            await Visit("bosman");
            await Press(); // the final quest
            await Visit("sternik-jozek");
            await Press();
            await HandIn("bosman");
            await shot("t6-farewell.png");
            await Press();

            // the boat (close whatever the captain said first)
            for (var i = 0; i < 10 && ui.DialogOpen; i++)
            {
                ui.HideDialog();
                await Awaitable.WaitForSecondsAsync(0.2f);
            }
            Teleport(world.Map.Width - 3, 32);
            player.Input.Override = Vector2.right;
            for (var i = 0; i < 40 && world.Map.Id == Districts.Tutorial; i++) await Awaitable.WaitForSecondsAsync(0.1f);
            if (player) player.Input.Override = Vector2.zero;
            await Awaitable.WaitForSecondsAsync(0.6f);
            await shot("t7-miasto.png");
            Debug.Log($"[AutoPilot] tutorial done: {quests.Completed.Contains(Districts.TutorialFinalQuest)}, now in {world.Map.Id}");
        }
    }
}
