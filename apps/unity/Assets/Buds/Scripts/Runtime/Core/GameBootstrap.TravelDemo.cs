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
        /// Autopilot (-buds-travel-demo, a paired bud): walks out of the city onto the dunes (the route is worked out on
        /// the way, so crossing over is quick), steps off the road into a nook where someone lies in wait (the ambush
        /// starts a duel on its own; the bud runs away), walks on to Las Palmas, then takes the ferry home. The load
        /// log says whether each map was prepared ahead ("ready") or built on the spot ("now").
        /// </summary>
        async Awaitable TravelDemo(Func<string, Awaitable> shot)
        {
            async Awaitable Walk(Vector2 dir, float seconds)
            {
                player.Input.Override = dir;
                await Awaitable.WaitForSecondsAsync(seconds);
                if (player) player.Input.Override = Vector2.zero;
            }

            if (world.Map.Id != Districts.Start) LoadDistrict(Districts.Start, null);
            // 1. out of the city to the north: the dunes get ready while the bud walks up the road
            var north = world.Map.Exits.Find(e => Districts.FarEnd(e.DistrictId, Districts.Start) == "las-palmas");
            Teleport(north.X0 + 1, 16);
            await Walk(Vector2.up, 5.5f);
            await shot("v1-wydmy.png");

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
                for (var i = 0; i < 40 && !(fightScreen?.IsOpen ?? false); i++) await Awaitable.WaitForSecondsAsync(0.1f);
                if (fightScreen?.IsOpen ?? false)
                {
                    await Awaitable.WaitForSecondsAsync(1.6f);
                    await shot("v4-walka-z-zasadzki.png");
                    await Flee();
                    for (var i = 0; i < 40 && !fightScreen.ShowingResult; i++) await Awaitable.WaitForSecondsAsync(0.1f);
                    await shot("v5-ucieczka.png");
                    CloseFight();
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
            Debug.Log($"[AutoPilot] travel demo ended in {world.Map.Id}");
        }
    }
}
