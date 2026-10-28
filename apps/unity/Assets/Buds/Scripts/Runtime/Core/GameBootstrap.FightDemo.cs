using System;
using Buds.Combat;
using Buds.Quests;
using Buds.UI;
using UnityEngine;

namespace Buds.Core
{
    /// <summary>
    /// Autopilot for the fight (-buds-fight-demo, a paired bud): walks up to an opponent of the city and fights it
    /// with the same buttons a player has (the stick to close in, taps for the basic attack, the abilities and the
    /// ultimate when ready, the guard when low), shooting the moments: the approach, the aim on the ground, the
    /// first blows, a foe's warning, the knockout, the reward. The others (Rewiry, raids, the tutorial, the
    /// wastelands' lurkers) fight through <see cref="FightIt"/> too.
    /// </summary>
    public sealed partial class GameBootstrap
    {
        async Awaitable FightDemo(Func<string, Awaitable> shot)
        {
            for (var i = 0; i < 60 && !CanFight; i++) await Awaitable.WaitForSecondsAsync(0.1f);
            if (!CanFight)
            {
                Debug.Log("[AutoPilot] fight demo: no live fight (offline?)");
                return;
            }
            // -buds-fight-enemy <id> picks the opponent, otherwise the weakest one around
            var wanted = CommandLine.Get("-buds-fight-enemy");
            EnemyView target = null;
            foreach (var e in enemyWorld.Enemies)
                if (e && !e.IsShadow && !e.Data.ambush &&
                    (wanted != null ? e.Data.id == wanted && target == null : target == null || e.Data.level < target.Data.level))
                    target = e;
            if (!target) return;

            // the bud's own buttons first: Twój Bud → Ciosy, a move swapped in and one upgraded
            await OpenPanel();
            panel.SelectTab(BudPanel.TabMoves);
            panel.SelectMoveSlot(2);
            await Awaitable.WaitForSecondsAsync(0.5f);
            await shot("f-ciosy-1.png");
            if (panelData?.Moves?.kit is { Length: 5 } kit)
            {
                var mine = (string[])kit.Clone();
                mine[2] = "podciecie";
                await SaveLoadout(panelData.Moves.weapon, mine);
                await UpgradeMove(mine[1]);
                panel.SelectMoveSlot(1);
                await Awaitable.WaitForSecondsAsync(0.4f);
                await shot("f-ciosy-2.png");
                Debug.Log($"[AutoPilot] loadout {string.Join(",", panelData.Moves.kit)}, error: {panelData.Error ?? "none"}");
            }
            panel.Hide();
            await Awaitable.WaitForSecondsAsync(1.2f); // the live fight takes the new buttons
            var cell = world.Map.Height - 1 - Mathf.FloorToInt(target.transform.position.y + 0.3f);
            Teleport(Mathf.FloorToInt(target.transform.position.x) + 3, cell);
            await Awaitable.WaitForSecondsAsync(0.8f);
            await shot("f0-opponent.png");

            // the reach of an ability, as a finger holding its button sees it
            var me = (Vector2)player.transform.position;
            var aimed = self.Kit[2] ?? self.Kit[1] ?? self.Kit[0];
            demoAimUntil = Time.time + 1;
            combatFx.ShowAim(aimed, me, target.Feet, false);
            await Awaitable.WaitForSecondsAsync(0.15f);
            await shot("f1-aim.png");
            demoAimUntil = -99;
            combatFx.HideAim();

            var outcome = await FightIt(() => !target || target.Down, 45, shot, "f2");
            await Awaitable.WaitForSecondsAsync(0.5f);
            await shot("f4-result.png");
            Debug.Log($"[AutoPilot] fight with {target.Data.id}: {outcome}");
        }

        /// <summary>Waits for a summoned shadow (a rival, a defender) to come out: it, or null when nobody came.</summary>
        async Awaitable<EnemyView> ShadowComes(float seconds)
        {
            for (var t = 0f; t < seconds; t += 0.1f)
            {
                if (enemyWorld)
                    foreach (var e in enemyWorld.Enemies)
                        if (e && e.IsShadow && e.Only == Me)
                        {
                            await Awaitable.WaitForSecondsAsync(SpringWindUp);
                            return e;
                        }
                await Awaitable.WaitForSecondsAsync(0.1f);
            }
            return null;
        }

        /// <summary>brawl.ts SPRING_WINDUP_MS: a shadow or a lurker takes a moment before its first blow.</summary>
        const float SpringWindUp = 0.7f;

        /// <summary>
        /// Fights like a player until <paramref name="done"/> (or the bud drops, or time runs out): closes in with the
        /// stick, presses what is ready. Shoots a few moments as "&lt;prefix&gt;-…". Returns "won", "down" or "time".
        /// </summary>
        async Awaitable<string> FightIt(Func<bool> done, float seconds, Func<string, Awaitable> shot, string prefix)
        {
            var shots = 0;
            var lastHp = self.Hp;
            var end = Time.time + seconds;
            try
            {
                while (Time.time < end && player)
                {
                    if (done()) return "won";
                    if (self.Down(Time.time))
                    {
                        await shot($"{prefix}-ko.png");
                        return "down";
                    }
                    var me = (Vector2)player.transform.position;
                    var foe = BrawlAim.Nearest(me, Targets(), 14, out var at);
                    var now = Time.time;
                    if (foe == null)
                    {
                        player.Input.Override = Vector2.zero;
                        await Awaitable.WaitForSecondsAsync(0.1f);
                        continue;
                    }
                    var d = Vector2.Distance(me, at);
                    var reach = BrawlAim.Reach(self.Kit[0]);
                    // abilities first (the ultimate, then the rest), the guard when it hurts, then the basic attack
                    var pressed = false;
                    foreach (var slot in new[] { BrawlSelf.Ultimate, 1, 2, BrawlSelf.Guard })
                    {
                        var e = self.Kit[slot];
                        if (e == null || !self.CanPress(slot, now)) continue;
                        if (slot == BrawlSelf.Guard && self.Health01 > 0.55f) continue;
                        if (!BrawlAim.Aimless(e) && d > BrawlAim.Reach(e) * 0.9f) continue;
                        if (e.shape == "self" && d > e.radius * 0.85f) continue;
                        Press(slot, null, at);
                        pressed = true;
                        break;
                    }
                    if (!pressed && d <= reach + 0.1f && self.CanPress(BrawlSelf.Basic, now)) Press(BrawlSelf.Basic, null, at);
                    // close in (a ranged weapon keeps a little distance)
                    var keep = Mathf.Max(1.1f, reach * 0.85f);
                    player.Input.Override = d > keep ? (at - me).normalized : Vector2.zero;
                    // the moments worth a picture: a blow landing (its swing, star and number), a blow taken
                    if (shots < 5 && (Time.time - landedAt < 0.06f || self.Hp < lastHp - 8))
                    {
                        await Awaitable.WaitForSecondsAsync(0.04f);
                        await shot($"{prefix}-{++shots}.png");
                    }
                    lastHp = self.Hp;
                    await Awaitable.WaitForSecondsAsync(0.05f);
                }
                return done() ? "won" : "time";
            }
            finally
            {
                if (player) player.Input.Override = null;
            }
        }
    }
}
