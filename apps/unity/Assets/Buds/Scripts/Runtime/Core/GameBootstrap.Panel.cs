using System;
using Buds.Api;
using Buds.Characters;
using Buds.UI;
using Buds.World;
using UnityEngine;

namespace Buds.Core
{
    /// <summary>The Bud panel: profile, inventory and skills. Server data for paired buds, local data for guests.</summary>
    public sealed partial class GameBootstrap
    {
        BudPanel panel;
        BudPanelData panelData;
        BudLookDto look;

        void SetUpPanel()
        {
            panel ??= new BudPanel(ui.Root, quests.Content, id => _ = UpgradeSkill(id));
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
                foreach (var i in items) panelData.Owned.Add(i.itemId);
                ApplySkills(skills);
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
            // worn items come from the look: outfit, plus headwear when the "hair" is a cap or headphones
            if (look != null)
            {
                d.Worn.Add("outfit-" + look.outfit);
                if (look.hair is "czapka" or "daszek" or "sluchawki") d.Worn.Add("headwear-" + look.hair);
            }
            foreach (var district in Districts.All)
                d.Districts.Add((district.Name, district.UnlockLevel, Districts.CanEnter(district.Id, level)));
            return d;
        }

        void ApplySkills(SkillsResponse skills)
        {
            panelData.Points = skills.points;
            panelData.Available = skills.available;
            panelData.Ranks.Clear();
            foreach (var s in skills.skills ?? Array.Empty<SkillRankDto>()) panelData.Ranks[s.id] = s.rank;
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
    }
}
