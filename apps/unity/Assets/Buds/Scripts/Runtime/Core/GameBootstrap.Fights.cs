using System;
using Buds.Api;
using Buds.Characters;
using Buds.Quests;
using Buds.UI;
using UnityEngine;

namespace Buds.Core
{
    /// <summary>
    /// Duels: walk up to an opponent, take the challenge, pick moves. The server resolves every turn and grants XP,
    /// coins and loot on a win; the game plays the events and rests the beaten opponent for a while.
    /// </summary>
    public sealed partial class GameBootstrap
    {
        const float RematchSeconds = 45; // REMATCH_SECONDS in packages/shared combat.ts

        EnemyWorld enemyWorld;
        FightScreen fightScreen;
        FightDto currentFight;
        EnemyView fightingWith;
        FightRewardDto lastReward;
        EnemyView nearbyEnemy;
        bool fightBusy;

        void SetUpFights()
        {
            fightScreen ??= new FightScreen(ui.Root, quests.Content, FightMove, () => _ = Flee(), CloseFight);
        }

        /// <summary>Called every frame while the duel screen is open; true = the world waits.</summary>
        bool UpdateFight()
        {
            if (fightScreen == null || !fightScreen.IsOpen) return false;
            fightScreen.Tick();
            return true;
        }

        void Challenge(EnemyView enemy)
        {
            var e = enemy.Data;
            enemy.Face(player.transform.position);
            if (PracticeAsGuest(enemy)) return;
            var line = e.lines.Length > 0 ? e.lines[UnityEngine.Random.Range(0, e.lines.Length)] : "Walczymy?";
            if (session == null)
            {
                ui.ShowDialog(e.name, $"„{line}”\n<i>Pojedynki toczysz połączonym Budem: XP i łup zapisuje serwer.</i>");
                return;
            }
            var danger = e.level > level + 2 ? "\n<color=#bd1c31><b>Uwaga: dużo silniejszy od ciebie.</b></color>" : "";
            ui.ShowChoice(e.name, $"„{line}”\n<b>Poziom {e.level}{(e.boss ? " · BOSS" : "")}</b>{danger}", "Walcz", "Odpuść",
                () => _ = StartDuel(enemy), null);
        }

        async Awaitable StartDuel(EnemyView enemy)
        {
            if (fightBusy) return;
            fightBusy = true;
            try
            {
                var res = await api.StartFight(session.Token, enemy.Data.id);
                currentFight = res.fight;
                fightingWith = enemy;
                lastReward = null;
                var line = enemy.Data.lines.Length > 0 ? enemy.Data.lines[0] : "";
                fightScreen.Open(res.fight, sheet, enemy.Sheet, line);
            }
            catch (ApiException e)
            {
                ui.ShowDialog(enemy.Data.name, e.Message);
            }
            finally
            {
                fightBusy = false;
            }
        }

        async Awaitable FightMove(string move)
        {
            if (fightBusy || currentFight == null) return;
            fightBusy = true;
            fightScreen.SetBusy(true);
            try
            {
                var res = await api.FightMove(session.Token, currentFight.id, move);
                await fightScreen.PlayTurn(res);
                currentFight = res.fight;
                if (res.fight.status == "active")
                {
                    fightScreen.SetBusy(false);
                    return;
                }
                if (res.fight.status == "won")
                {
                    lastReward = res.reward;
                    SetXp(res.reward.xp);
                    if (!string.IsNullOrEmpty(res.reward.drink)) _ = LoadConsumables();
                    if (fightingWith)
                    {
                        enemyWorld.Rest(fightingWith.Data.id, RematchSeconds);
                        if (quests.Duel(fightingWith.Data.id)) ui.ShowToast("Cel zadania osiągnięty!", 2.5f);
                    }
                }
                fightScreen.ShowResult(res.fight, res.reward);
            }
            catch (ApiException e)
            {
                fightScreen.ShowMessage(e.Message);
                fightScreen.SetBusy(false);
            }
            finally
            {
                fightBusy = false;
            }
        }

        async Awaitable Flee()
        {
            if (fightBusy || currentFight == null) return;
            fightBusy = true;
            try
            {
                var res = await api.Flee(session.Token, currentFight.id);
                currentFight = res.fight;
                fightScreen.ShowResult(res.fight, res.reward);
            }
            catch (ApiException e)
            {
                fightScreen.ShowMessage(e.Message);
            }
            finally
            {
                fightBusy = false;
            }
        }

        void CloseFight()
        {
            fightScreen.Hide();
            if (lastReward == null) return;
            var item = string.IsNullOrEmpty(lastReward.item) ? null : quests.Content.Item(lastReward.item);
            if (lastReward.levelUp) ui.ShowToast($"Awans! Poziom {lastReward.level} (+1 punkt)", 3.5f);
            else if (item != null) ui.ShowToast($"Łup: {item.name}. Załóż w Ekwipunku.", 3f);
            else ui.ShowToast($"+{lastReward.xpGained} XP · +{Coins(lastReward.coinsGained)}", 2.5f);
            lastReward = null;
        }

        /// <summary>Autopilot: challenges the nearest weak opponent and fights to the end, with screenshots.</summary>
        async Awaitable FightDemo(Func<string, Awaitable> shot)
        {
            // -buds-fight-enemy <id> picks the opponent, otherwise the weakest one around
            var wanted = CommandLine.Get("-buds-fight-enemy");
            EnemyView target = null;
            foreach (var e in enemyWorld.Enemies)
                if (wanted != null ? e.Data.id == wanted && target == null : target == null || e.Data.level < target.Data.level)
                    target = e;
            if (target == null) return;
            var cell = world.Map.Height - 1 - Mathf.FloorToInt(target.transform.position.y + 0.3f);
            Teleport(Mathf.FloorToInt(target.transform.position.x), cell + 1);
            await Awaitable.WaitForSecondsAsync(0.5f);
            await shot("f0-opponent.png");
            await StartDuel(target);
            await Awaitable.WaitForSecondsAsync(0.4f);
            await shot("f1-start.png");
            for (var turn = 0; turn < 30 && currentFight is { status: "active" }; turn++)
            {
                // strongest move first, the second one now and then
                var move = fightScreen.MoveAt(turn % 3 == 2 ? 0 : 1) ?? fightScreen.MoveAt(0);
                var playing = FightMove(move);
                if (turn == 0)
                {
                    await Awaitable.WaitForSecondsAsync(0.32f);
                    await shot("f2-mid-move.png");
                }
                await playing;
                if (turn == 0) await shot("f3-after-turn.png");
            }
            await Awaitable.WaitForSecondsAsync(0.4f);
            await shot("f4-result.png");
            CloseFight();
            Debug.Log($"[AutoPilot] duel with {target.Data.id}: {currentFight?.status}");
        }
    }
}
