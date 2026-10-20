using System;
using System.Collections.Generic;
using Buds.Api;
using Buds.Quests;
using Buds.World;
using UnityEngine;

namespace Buds.Core
{
    /// <summary>Quests: talking to NPCs, taking and handing in quests (XP granted by the server), progress saving.</summary>
    public sealed partial class GameBootstrap
    {
        bool handingIn;

        string SaveKey => "buds.quests." + (session?.Slug ?? "guest");

        /// <summary>Completed quests come from the server; failures just mean "none known yet".</summary>
        async Awaitable<string[]> LoadCompleted(PlayerSession s)
        {
            try
            {
                return await api.GetCompletedQuests(s.Token);
            }
            catch (ApiException e)
            {
                Debug.LogWarning($"Could not load completed quests: {e.Message}");
                return Array.Empty<string>();
            }
        }

        void SetUpQuests(string[] completed)
        {
            quests = new QuestLog(QuestContent.Load()) { Level = level };
            if (completed != null)
                foreach (var id in completed)
                    quests.Completed.Add(id);
            // guests keep everything locally; paired buds only keep in-progress steps (completions live on the server)
            quests.Restore(PlayerPrefs.GetString(SaveKey, ""));
            quests.Changed += OnQuestsChanged;
            UpdateTracker();
        }

        void OnQuestsChanged()
        {
            PlayerPrefs.SetString(SaveKey, quests.Save(includeCompleted: session == null));
            PlayerPrefs.Save();
            UpdateTracker();
        }

        void UpdateTracker()
        {
            var list = new List<(string, string)>();
            foreach (var q in quests.Active)
            {
                var objective = quests.Objective(q.id);
                if (q.district != world?.Map.DistrictId) objective += $" ({Districts.NameOf(q.district)})";
                list.Add((q.title, objective));
            }
            ui.SetQuests(list);
        }

        /// <summary>Reach targets and pickups around the player's feet.</summary>
        void CheckQuestProgress(Vector2Int cell)
        {
            if (quests.Reach(world.Map.Id, cell.x, cell.y)) ui.ShowToast("Cel osiągnięty!");
            if (questWorld.CollectNear(player.transform.position) > 0) ui.ShowToast("Zebrano!", 1.4f);
        }

        void TalkTo(NpcView npc)
        {
            var n = npc.Data;
            npc.Face(player.transform.position);
            if (OfferFerry(npc)) return; // a ferryman: the timetable

            var turnIn = quests.TurnInAt(n.id);
            if (turnIn != null)
            {
                _ = HandIn(turnIn, n);
                return;
            }

            var line = quests.TalkTo(n.id);
            if (line != null)
            {
                ui.ShowDialog(n.name, line);
                return;
            }

            var offer = quests.OfferFrom(n.id);
            if (offer != null)
            {
                ui.ShowChoice(n.name, $"{offer.intro}\n<b>Nagroda: {offer.xp} XP</b>", "Przyjmij", "Później", () =>
                {
                    quests.Accept(offer.id);
                    ui.ShowToast($"Nowe zadanie: {offer.title}");
                }, null);
                return;
            }

            foreach (var q in quests.Active)
                if (q.giver == n.id)
                {
                    ui.ShowDialog(n.name, $"Jak idzie z zadaniem „{q.title}”?\n{quests.Objective(q.id)}");
                    return;
                }

            var locked = quests.LockedByLevelAt(n.id);
            if (locked != null)
            {
                ui.ShowDialog(n.name, $"Mam dla ciebie coś ciekawego, ale wróć, gdy będziesz na poziomie {locked.minLevel}.");
                return;
            }
            ui.ShowDialog(n.name, n.lines[UnityEngine.Random.Range(0, n.lines.Length)]);
        }

        /// <summary>Hands in a finished quest: the server checks it and grants the XP, the game only shows the result.</summary>
        async Awaitable HandIn(QuestData quest, NpcData npc)
        {
            if (handingIn) return;
            if (session == null)
            {
                quests.Complete(quest.id);
                ui.ShowDialog(npc.name, $"{quest.done}\n<i>Grasz jako gość: połącz Buda ze strony, żeby zapisywać XP.</i>");
                return;
            }

            handingIn = true;
            ui.ShowDialog(npc.name, quest.done); // the reward line follows once the server answers (the corner spinner turns meanwhile)
            try
            {
                var res = await api.CompleteQuest(session.Token, quest.id);
                quests.Complete(quest.id);
                SetXp(res.xp);
                var item = string.IsNullOrEmpty(res.item) ? null : quests.Content.Item(res.item);
                var reward = item != null ? $"<b>+{res.xpGained} XP  ·  {item.name}</b>" : $"<b>+{res.xpGained} XP</b>";
                var influence = Rivalry.InfluenceLine(res.influence);
                if (influence != null) reward += $"\n<color=#5d9a12><b>{influence}</b></color>";
                ui.ShowDialog(npc.name, $"{quest.done}\n{reward}");
                OnInfluence(res.influence, false);
                if (res.levelUp) ui.ShowToast($"Awans! Poziom {res.level} (+1 punkt)" + MovesNote(CurrentMoves(res.level - 1)), 4f);
                else if (item != null) ui.ShowToast($"Nowy przedmiot: {item.name}", 3f);
                else ui.ShowToast($"+{res.xpGained} XP");
            }
            catch (ApiException e) when (e.Status == 409 && e.Message.Contains("już wykonane"))
            {
                quests.Complete(quest.id); // done on another device: just sync
                ui.ShowDialog(npc.name, quest.done);
            }
            catch (ApiException e)
            {
                ui.ShowDialog(npc.name, $"Nie udało się zapisać zadania: {e.Message}\nPorozmawiaj ze mną jeszcze raz.");
            }
            finally
            {
                handingIn = false;
            }
        }

        void SetXp(int value)
        {
            xp = value;
            var was = level;
            level = Progression.Level(xp);
            if (level != was) LiveRefreshMe(); // the others see the new level over the bud's head
            ui.ShowHud(budName, level, xp, Progression.NextLevelXp(xp));
            quests.Level = level;
            questWorld.Refresh(); // a new level can unlock quests
        }

        /// <summary>
        /// Autopilot: plays the first two quests — offer, talk steps, hand-in (+XP), collecting, level up.
        /// Usage: Buds.exe -buds-pair CODE -buds-api URL -buds-autoshot dir -buds-quest-demo
        /// </summary>
        async Awaitable QuestDemo(Func<string, Awaitable> shot)
        {
            async Awaitable Press()
            {
                player.Input.PressInteract();
                await Awaitable.WaitForSecondsAsync(0.25f);
            }
            async Awaitable Visit(string npcId)
            {
                var n = quests.Content.Npc(npcId);
                Teleport(n.x, n.y + 1);
                await Awaitable.WaitForSecondsAsync(0.3f);
                await Press();
            }
            async Awaitable WaitForHandIn()
            {
                for (var i = 0; i < 40 && handingIn; i++) await Awaitable.WaitForSecondsAsync(0.1f);
                await Awaitable.WaitForSecondsAsync(0.3f);
            }

            if (world.Map.Id != Districts.Start) LoadDistrict(Districts.Start, null);
            await Visit("wiktor");
            await shot("q1-offer.png");
            await Press(); // accept
            await shot("q2-accepted.png");
            // the map with the quest's target pin, then that pin opened (a chat line still open would keep it shut)
            ui.HideDialog();
            OpenMap();
            await shot("q2b-map.png");
            mapScreen.OpenFirstPinForTest();
            await shot("q2c-map-pin.png");
            mapScreen.Hide();
            await Visit("halina");
            await shot("q3-talk.png");
            await Press();
            await Visit("nowak");
            await Press();
            await Visit("wiktor");
            await WaitForHandIn();
            await shot("q4-handed-in.png");
            await Press();

            await Visit("halina");
            await Press(); // accept the shopping quest
            foreach (var (_, step, spot) in new List<(QuestData, StepData, int)>(quests.Pickups(world.Map.Id)))
            {
                Teleport(step.spots[spot].x, step.spots[spot].y);
                await Awaitable.WaitForSecondsAsync(0.4f);
                if (spot == 0) await shot("q5-collect.png");
            }
            await Visit("halina");
            await WaitForHandIn();
            await shot("q6-level-up.png");
            await Press();

            // the Bud panel: profile, inventory, skills (spend the point from level 2)
            await OpenPanel();
            await Awaitable.WaitForSecondsAsync(0.4f);
            await shot("p1-profil.png");
            panel.SelectTab(1);
            await shot("p2-ekwipunek.png");
            panel.SelectTab(2);
            await UpgradeSkill("flow");
            await shot("p3-umiejetnosci.png");
            panel.Hide();
        }
    }
}
