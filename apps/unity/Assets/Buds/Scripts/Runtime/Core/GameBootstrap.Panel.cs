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
    /// The Bud panel: profile, gear, skills and the coin shop. Server data for paired buds, local data for guests.
    /// Worn gear works in the world right away: speed for the motor, skill ranks (Spryt finds caches from further).
    /// </summary>
    public sealed partial class GameBootstrap
    {
        BudPanel panel;
        BudPanelData panelData;
        BudLookDto look;
        readonly Dictionary<string, string> equipped = new(); // slot -> item
        readonly Dictionary<string, int> trainedRanks = new();
        GearStats gear = new();

        void SetUpPanel()
        {
            panel ??= new BudPanel(ui.Root, quests.Content, id => _ = UpgradeSkill(id), (slot, id) => _ = Equip(slot, id),
                id => _ = Buy(id), id => _ = Drink(id));
            ui.ShowBudButton(() => _ = OpenPanel());
        }

        /// <summary>Handles the panel keys; returns true while the panel is open (the world is paused for input).</summary>
        bool UpdatePanel(PlayerInput input)
        {
            if (panel == null) return false;
            if (panel.IsOpen)
            {
                if (input.PanelPressed || input.CancelPressed) panel.Hide();
                return panel.IsOpen;
            }
            if (input.PanelPressed && !ui.DialogOpen) _ = OpenPanel();
            return panel.IsOpen;
        }

        async Awaitable OpenPanel()
        {
            panelData = LocalPanelData();
            panelData.Loading = session != null;
            panel.Show(panelData);
            if (session == null) return;
            try
            {
                var items = await api.GetItems(session.Token);
                var skills = await api.GetSkills(session.Token);
                var wallet = await api.GetWallet(session.Token);
                var equipment = await api.GetEquipment(session.Token);
                var consumables = await api.GetConsumables(session.Token);
                foreach (var i in items) panelData.Owned.Add(i.itemId);
                ApplySkills(skills);
                ApplyEquipment(equipment);
                ApplyConsumables(consumables);
                panelData.Coins = wallet.coins;
                panelData.Gems = wallet.gems;
            }
            catch (ApiException e)
            {
                panelData.Error = e.Message;
            }
            panelData.Loading = false;
            if (panel.IsOpen) panel.Refresh(panelData);
        }

        BudPanelData LocalPanelData()
        {
            var d = new BudPanelData
            {
                Name = budName,
                Level = level,
                Xp = xp,
                NextXp = Progression.NextLevelXp(xp),
                Portrait = sheet.Get(Facing.Down, 0),
                Guest = session == null,
                QuestsDone = quests.Completed.Count,
                QuestsTotal = quests.Content.quests.Length,
                Points = Math.Max(0, level - 1),
            };
            // worn looks come from the look: outfit, plus headwear when the "hair" is a cap or headphones
            if (look != null)
            {
                d.Worn.Add("outfit-" + look.outfit);
                if (look.hair is "czapka" or "daszek" or "sluchawki") d.Worn.Add("headwear-" + look.hair);
            }
            foreach (var (slot, id) in equipped) d.Equipped[slot] = id;
            foreach (var (id, rank) in trainedRanks) d.Ranks[id] = rank;
            foreach (var (id, rank) in spentRanks) d.Spent[id] = rank;
            foreach (var (id, txp) in trainingXp) d.TrainingXp[id] = txp;
            d.Perks.AddRange(perks);
            FillDrinks(d);
            foreach (var district in Districts.All)
                d.Districts.Add((district.Name, district.UnlockLevel, Districts.CanEnter(district.Id, level)));
            return d;
        }

        void ApplySkills(SkillsResponse skills)
        {
            // ranks that count are the spent points plus the ranks earned by training
            trainedRanks.Clear();
            spentRanks.Clear();
            trainingXp.Clear();
            foreach (var s in skills.skills ?? Array.Empty<SkillRankDto>())
            {
                trainedRanks[s.id] = s.Effective;
                spentRanks[s.id] = s.rank;
                trainingXp[s.id] = s.trainingXp;
            }
            perks.Clear();
            perks.AddRange(skills.perks ?? Array.Empty<string>());
            if (panelData != null)
            {
                panelData.Points = skills.points;
                panelData.Available = skills.available;
                panelData.Ranks.Clear();
                foreach (var (id, rank) in trainedRanks) panelData.Ranks[id] = rank;
                panelData.Spent.Clear();
                foreach (var (id, rank) in spentRanks) panelData.Spent[id] = rank;
                panelData.TrainingXp.Clear();
                foreach (var (id, txp) in trainingXp) panelData.TrainingXp[id] = txp;
                panelData.Perks.Clear();
                panelData.Perks.AddRange(perks);
            }
            ApplyGear();
        }

        void ApplyEquipment(EquipmentResponse equipment)
        {
            equipped.Clear();
            foreach (var (slot, id) in equipment.slots?.ToDictionary() ?? new Dictionary<string, string>()) equipped[slot] = id;
            if (panelData != null)
            {
                panelData.Equipped.Clear();
                foreach (var (slot, id) in equipped) panelData.Equipped[slot] = id;
            }
            ApplyGear();
        }

        /// <summary>Recomputes what the gear adds and puts it to work: walking speed and the cache reveal radius.</summary>
        void ApplyGear()
        {
            gear = Gear.Stats(quests.Content, equipped.Values, trainedRanks);
            sprytRank = gear.SkillRank("spryt"); // caches show up from further away
            ApplyRide(); // the ride may have changed; speed = gear × ride × perks × Turbo
        }

        async Awaitable UpgradeSkill(string skillId)
        {
            if (session == null || panelData == null || panelData.Loading) return;
            panelData.Loading = true;
            panel.Refresh(panelData);
            try
            {
                ApplySkills(await api.UpgradeSkill(session.Token, skillId));
                panelData.Error = null;
                ui.ShowToast("Umiejętność ulepszona!");
            }
            catch (ApiException e)
            {
                panelData.Error = e.Message;
            }
            panelData.Loading = false;
            if (panel.IsOpen) panel.Refresh(panelData);
        }

        /// <summary>Wears an item or empties a slot; the server checks ownership and the slot.</summary>
        async Awaitable Equip(string slot, string itemId)
        {
            if (session == null || panelData == null || panelData.Loading) return;
            panelData.Loading = true;
            panel.Refresh(panelData);
            try
            {
                ApplyEquipment(await api.Equip(session.Token, slot, itemId));
                panelData.Error = null;
                var item = itemId != null ? quests.Content.Item(itemId) : null;
                ui.ShowToast(item != null ? $"Założono: {item.name}" : "Zdjęto przedmiot", 2f);
            }
            catch (ApiException e)
            {
                panelData.Error = e.Message;
                ui.ShowToast(e.Message, 2.5f);
            }
            panelData.Loading = false;
            if (panel.IsOpen) panel.Refresh(panelData);
        }

        /// <summary>Buys gear for coins; the server checks the price and the wallet, then the item is ready to wear.</summary>
        async Awaitable Buy(string itemId)
        {
            if (session == null || panelData == null || panelData.Loading) return;
            panelData.Loading = true;
            panel.Refresh(panelData);
            try
            {
                var item = quests.Content.Item(itemId);
                var res = item is { IsPremiumShop: true }
                    ? await api.BuyPremium(session.Token, itemId)
                    : await api.Buy(session.Token, itemId);
                panelData.Coins = res.coins;
                if (item is { IsPremiumShop: true }) panelData.Gems = res.gems;
                if (item is { IsDrink: true })
                {
                    drinks[itemId] = (drinks.TryGetValue(itemId, out var n) ? n : 0) + 1;
                    FillDrinks(panelData);
                }
                else if (!panelData.Owned.Contains(itemId)) panelData.Owned.Add(itemId);
                panelData.Error = null;
                ui.ShowToast(item is { IsDrink: true } ? $"Kupiono: {item.name}. Wypijesz w zakładce Napoje."
                    : item is { IsMount: true } ? $"Kupiono: {item.name}. Załóż w Ekwipunku (Wierzchowiec)."
                    : $"Kupiono: {item?.name ?? itemId}. Załóż w Ekwipunku.", 2.8f);
            }
            catch (ApiException e)
            {
                panelData.Error = e.Message;
                ui.ShowToast(e.Message, 2.5f);
            }
            panelData.Loading = false;
            if (panel.IsOpen) panel.Refresh(panelData);
        }
    }
}
