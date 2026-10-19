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
                var res = await api.StartFight(session.Token, enemy.Data.id, enemy.Spot);
                currentFight = res.fight;
                fightingWith = enemy;
                lastReward = null;
                lastPvp = null;
                lastInfluence = null;
                var line = enemy.Data.lines.Length > 0 ? enemy.Data.lines[0] : "";
                fightScreen.Open(res.fight, sheet, enemy.Sheet, line, gear);
            }
            catch (ApiException e)
            {
                ui.ShowDialog(enemy.Data.name, e.Message);
            }
            catch (Exception e)
            {
                // the duel could not be shown: back to the street, never a half-open screen
                Debug.LogException(e);
                if (fightScreen.IsOpen) CloseFight();
                ui.ShowDialog(enemy.Data.name, "Coś przerwało pojedynek. Spróbuj jeszcze raz.");
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
                lastPvp = res.pvp != null && res.pvp.Present ? res.pvp : null;
                lastInfluence = res.influence != null && res.influence.Present ? res.influence : null;
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
                fightScreen.ShowResult(res.fight, res.reward, lastInfluence, lastPvp);
            }
            catch (ApiException e)
            {
                fightScreen.ShowMessage(e.Message);
                fightScreen.SetBusy(false);
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                fightScreen.ShowMessage("Coś się zacięło. Wybierz ruch jeszcze raz.");
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
                // the result first, then the screen's busy state: a flee mid-turn waits for the turn to finish
                var res = await api.Flee(session.Token, currentFight.id);
                currentFight = res.fight;
                lastPvp = res.pvp != null && res.pvp.Present ? res.pvp : null;
                fightScreen.ShowResult(res.fight, res.reward, null, lastPvp);
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

        /// <summary>
        /// A lurker jumped out of its nook on a route: it shows itself, says its line, and a moment later the duel starts
        /// on its own (running away is the usual "Uciekaj"). Guests can't fight on the server: it just scares them off.
        /// </summary>
        async Awaitable SprungOn(EnemyView enemy)
        {
            enemy.Spring();
            enemy.Face(player.transform.position);
            ui.ShowToast($"Zasadzka! {enemy.Data.name} (poz. {enemy.Data.level})", 2.5f);
            if (session == null)
            {
                ui.ShowDialog(enemy.Data.name, $"„{Ambush.Line(enemy.Data)}”\n<i>Z zasadzki atakują tylko połączonego Buda. Uciekaj, póki możesz!</i>");
                enemy.Hide(Ambush.Cooldown);
                return;
            }
            await Awaitable.WaitForSecondsAsync(Ambush.WindUp);
            if (!enemy || !player || fightScreen.IsOpen) return;
            await StartDuel(enemy);
            // the duel didn't start (no connection, still resting): back into the bushes for a while
            if (enemy && !fightScreen.IsOpen) enemy.Hide(Ambush.Cooldown);
        }

        void CloseFight()
        {
            // a lurker the bud ran from (or lost to) hides in its nook again for a while
            if (fightingWith && fightingWith.Data.ambush && currentFight?.status != "won") fightingWith.Hide(Ambush.Cooldown);
            fightScreen.Hide();
            if (currentFight?.enemyId != null && currentFight.enemyId.StartsWith("pvp-"))
            {
                // back to the list of rivals, with the rating as it stands now (no change when fled before a blow)
                if (lastPvp != null)
                {
                    var delta = lastPvp.delta >= 0 ? $"+{lastPvp.delta}" : lastPvp.delta.ToString();
                    ui.ShowToast($"{delta} pkt rankingu · liga {lastPvp.league}", 3f);
                }
                lastPvp = null;
                lastReward = null;
                OpenRivalry(RivalryScreen.TabPvp);
                return;
            }
            var influence = lastInfluence;
            lastInfluence = null;
            if (lastReward == null) return;
            var item = string.IsNullOrEmpty(lastReward.item) ? null : quests.Content.Item(lastReward.item);
            var earned = influence != null && influence.gained > 0 ? $" · +{influence.gained} wpływu" : "";
            if (lastReward.levelUp) ui.ShowToast($"Awans! Poziom {lastReward.level} (+1 punkt)" + MovesNote(CurrentMoves(lastReward.level - 1)), 4f);
            else if (item != null) ui.ShowToast($"Łup: {item.name}. Załóż w Ekwipunku.", 3f);
            else ui.ShowToast($"+{lastReward.xpGained} XP · +{Coins(lastReward.coinsGained)}{earned}", 2.5f);
            OnInfluence(influence, false);
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
            var moments = 0;
            fightScreen.Moment = async name =>
            {
                if (moments++ < 8) await shot($"f-moment-{moments}-{name}.png");
            };
            await StartDuel(target);
            await Awaitable.WaitForSecondsAsync(0.3f);
            await shot("f0b-intro.png");
            await Awaitable.WaitForSecondsAsync(1.0f); // the walk-in and the VS
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
            fightScreen.Moment = null;
            CloseFight();
            Debug.Log($"[AutoPilot] duel with {target.Data.id}: {currentFight?.status}");
        }
    }
}
