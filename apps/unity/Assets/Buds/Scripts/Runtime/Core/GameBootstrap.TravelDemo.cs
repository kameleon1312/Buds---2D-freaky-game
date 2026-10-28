using System;
using Buds.Characters;
using Buds.Quests;
using Buds.World;
using UnityEngine;

namespace Buds.Core
{
    public sealed partial class GameBootstrap
    {
        /// <summary>
        /// Autopilot (-buds-travel-demo, a paired bud): walks out of the city onto the dunes with no loading at all (the
        /// wasteland is laid next to the city while the bud walks up the road, World/Seams), looks back across the seam,
        /// steps off the road into a nook where someone lies in wait (the ambush starts a duel on its own; the bud runs
        /// away), walks on to Las Palmas (a fade: a new city), takes the ferry home, then walks out through each of the
        /// other three roads. The log says how each seam was laid and the longest frame of every walk across.
        /// </summary>
        async Awaitable TravelDemo(Func<string, Awaitable> shot)
        {
            async Awaitable Walk(Vector2 dir, float seconds)
            {
                player.Input.Override = dir;
                await Awaitable.WaitForSecondsAsync(seconds);
                if (player) player.Input.Override = Vector2.zero;
            }

            // walks from well inside the city out through a road onto its wasteland: shots on the way, at the seam and past it
            async Awaitable CrossOut(Exit e, string label)
            {
                var side = Seams.SideOf(e, world.Map) ?? Seams.Side.North;
                var (inward, outward) = side switch
                {
                    Seams.Side.North => (new Vector2Int(0, 1), Vector2.up),
                    Seams.Side.South => (new Vector2Int(0, -1), Vector2.down),
                    Seams.Side.East => (new Vector2Int(-1, 0), Vector2.right),
                    _ => (new Vector2Int(1, 0), Vector2.left),
                };
                var start = new Vector2Int(e.X0 + 1 + inward.x * 28, e.Y0 + 1 + inward.y * 28);
                if (side is Seams.Side.East or Seams.Side.West) start = new Vector2Int(e.X0 + inward.x * 28, e.Y0 + 1);
                Teleport(start.x, start.y);
                for (var i = 0; i < 100 && !(neighbour && neighbour.Map.Id == e.DistrictId); i++) await Awaitable.WaitForSecondsAsync(0.1f);
                Debug.Log($"[Seam] {label}: next map laid {(neighbour ? neighbour.Map.Id : "NOT")}");
                var from = world.Map.Id;
                var longest = 0f;
                player.Input.Override = outward;
                var shotNear = false;
                var skip = 0; // the frames a screenshot takes are the screenshot's, not the game's
                for (var t = 0f; t < 14 && world.Map.Id == from; t += Time.unscaledDeltaTime)
                {
                    if (skip > 0) skip--;
                    else longest = Mathf.Max(longest, Time.unscaledDeltaTime);
                    if (skip == 0 && Time.unscaledDeltaTime > 0.04f)
                        Debug.Log($"[Seam] {label}: slow frame {Time.unscaledDeltaTime * 1000:0} ms {Seams.DistanceTo(e, world.Map, player.transform.position):0.0} tiles before the seam");
                    if (!shotNear && Seams.DistanceTo(e, world.Map, player.transform.position) < 4)
                    {
                        shotNear = true;
                        skip = 3;
                        ScreenCapture.CaptureScreenshot(System.IO.Path.Combine(CommandLine.Get("-buds-autoshot")!, $"{label}-1-at-the-seam.png"));
                    }
                    await Awaitable.NextFrameAsync();
                }
                for (var t = 0f; t < 1.4f; t += Time.unscaledDeltaTime)
                {
                    longest = Mathf.Max(longest, Time.unscaledDeltaTime);
                    if (Time.unscaledDeltaTime > 0.04f) Debug.Log($"[Seam] {label}: slow frame {Time.unscaledDeltaTime * 1000:0} ms {t:0.00} s after crossing");
                    await Awaitable.NextFrameAsync();
                }
                player.Input.Override = Vector2.zero;
                Debug.Log($"[Seam] {label}: {from} -> {world.Map.Id}, longest frame {longest * 1000:0} ms");
                await shot($"{label}-2-across.png");
            }

            if (world.Map.Id != Districts.Start) LoadDistrict(Districts.Start, null);
            // 1. out of the city to the north: the dunes are laid down while the bud walks up the road, no loading
            var north = world.Map.Exits.Find(e => Districts.FarEnd(e.DistrictId, Districts.Start) == "las-palmas");
            await CrossOut(north, "v1-wydmy");
            // and back again for a moment: the city is still right there behind the bud
            await Walk(Vector2.down, 1.6f);
            await shot("v1b-z-powrotem-w-miescie.png");
            Debug.Log($"[Seam] walked back into {world.Map.Id}");
            await Walk(Vector2.up, 1.8f);
            await shot("v1c-znowu-na-wydmach.png");

            // 2. off the road into a nook: the one hiding there jumps out and the duel starts by itself
            var lurker = System.Array.Find(quests.Content.enemies, e => e.district == world.Map.Id && e.ambush);
            if (lurker != null)
            {
                var s = lurker.spots[0];
                var side = s.x < world.Map.Width / 2 ? 1 : -1; // the nook's mouth faces the road
                Teleport(s.x + side * 5, s.y);
                await shot("v2-przy-krzakach.png");
                await Walk(new Vector2(-side, 0), 1.2f);
                await Awaitable.WaitForSecondsAsync(0.2f);
                await shot("v3-zasadzka.png");
                // it jumps out on its own and comes at the bud: a few blows, then running for it down the road
                var view = enemyWorld ? enemyWorld.Unit($"m-{lurker.id}-0") : null;
                for (var i = 0; i < 30 && view && view.Lurking; i++) await Awaitable.WaitForSecondsAsync(0.1f);
                if (view && !view.Lurking)
                {
                    await Awaitable.WaitForSecondsAsync(0.8f);
                    await shot("v4-walka-z-zasadzki.png");
                    await FightIt(() => !view || view.Down, 4, shot, "v4b");
                    player.Input.OverrideRun = true;
                    await Walk(new Vector2(side, 0), 3f);
                    player.Input.OverrideRun = false;
                    await shot("v5-ucieczka.png");
                }
            }

            // 3. on to Las Palmas: up the road to the dunes' north end
            var toPalmas = world.Map.Exits.Find(e => e.DistrictId == "las-palmas");
            if (toPalmas != null)
            {
                Teleport(toPalmas.X0 + 1, 16);
                await Walk(Vector2.up, 5.5f);
                await shot("v6-las-palmas.png");
            }

            // 4. the ferry home from the yacht harbour
            var port = Array.Find(quests.Content.ports, p => p.district == world.Map.Id);
            if (port != null)
            {
                Teleport(port.x, port.y + 1);
                await Awaitable.WaitForSecondsAsync(0.5f);
                var npc = questWorld.NearestNpc(player.transform.position, 3f);
                if (npc) TalkTo(npc);
                await shot("v7-rejsy.png");
                if (ferryScreen?.IsOpen ?? false)
                {
                    await Sail(port, "port-miasto");
                    await shot("v8-port-w-miescie.png");
                }
            }
            // 5. the other three roads out of the city, each walked across its seam
            for (var i = 0; i < 50 && travelling; i++) await Awaitable.WaitForSecondsAsync(0.1f);
            if (ferryScreen?.IsOpen ?? false) ferryScreen.Hide();
            if (ui.DialogOpen) ui.HideDialog();
            if (world.Map.Id != Districts.Start) LoadDistrict(Districts.Start, null);
            foreach (var e in world.Map.Exits.ToArray())
            {
                if (Districts.FarEnd(e.DistrictId, Districts.Start) == "las-palmas" || !Districts.IsRoute(e.DistrictId)) continue;
                if (world.Map.Id != Districts.Start) LoadDistrict(Districts.Start, null);
                await CrossOut(e, "v9-" + e.DistrictId);
            }
            Debug.Log($"[AutoPilot] travel demo ended in {world.Map.Id}");
        }
    }
}
