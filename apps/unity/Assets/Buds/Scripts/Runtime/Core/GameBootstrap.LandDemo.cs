using System;
using Buds.Quests;
using Buds.UI;
using UnityEngine;

namespace Buds.Core
{
    public sealed partial class GameBootstrap
    {
        /// <summary>
        /// Autopilot (-buds-land-demo, a paired bud with coins for a plot): onto Leśne Ostępy, to the gate of a free plot,
        /// buys it under a name, looks at the window's four tabs, puts up a vertical farm where the bud stands (the ghost
        /// first) and a solar farm, renames the district, then walks to someone else's district, looks at its card and
        /// raids it when it can (the duel played to the end). Logs what the server answered.
        /// </summary>
        async Awaitable LandDemo(Func<string, Awaitable> shot)
        {
            async Awaitable Until(Func<bool> done, float seconds)
            {
                for (var t = 0f; t < seconds && !done(); t += 0.1f) await Awaitable.WaitForSecondsAsync(0.1f);
            }
            Vector2Int Outside(PlotData p)
            {
                var o = Land.OutsideGate(p.gate, land.Rules.plotSize);
                return new Vector2Int(p.x + o.x, p.y + o.y);
            }

            LoadDistrict("pustkowie-ostepy", "miasto-ziomkow");
            await Until(() => districtsWorld && session != null, 10);
            await RefreshDistricts(true);
            var plots = quests.Content.land.PlotsOn(world.Map.Id);
            Debug.Log($"[Land] {plots.Length} plots on {world.Map.Id}, own: {(land.Has ? land.State.plot : "none")}");

            // a free plot: its board, the offer, the name
            var free = Array.Find(plots, p => districtsWorld.DistrictOn(p.id) == null);
            if (!land.Has && free != null)
            {
                var at = Outside(free);
                Teleport(at.x, at.y + (free.gate == "s" ? 1 : 0));
                await Awaitable.WaitForSecondsAsync(1f);
                await shot("d1-dzialka.png");
                UsePlot(free);
                await Until(() => ui.ChoiceOpen, 3);
                await shot("d2-oferta.png");
                ui.ChooseAccept();
                await Until(() => landScreen.NamingOpen, 3);
                landScreen.SetNameForDemo("Zielone   Tarasy ");
                await shot("d3-nazwa.png");
                landScreen.AcceptNameForDemo();
                await Until(() => land.Has && !landBusy, 10);
            }
            Debug.Log($"[Land] own district: '{land.State?.name}' on {land.State?.plot}, stage {land.State?.stage}");
            if (!land.Has)
            {
                Debug.LogError("[Land] no district bought");
                return;
            }

            // in the district: the town hall on its square, the bar, the window
            var hall = land.ToMap(land.Rules.hallX, land.Rules.hallY + 3);
            Teleport(hall.x, hall.y);
            await Awaitable.WaitForSecondsAsync(1.2f);
            await shot("d4-dystrykt.png");
            OpenLandScreen();
            await shot("d5-budynki.png");
            landScreen.ShowTab(LandScreen.TabGrow);
            await shot("d6-rozbudowa.png");
            landScreen.ShowTab(LandScreen.TabRaids);
            await shot("d7-napady.png");
            landScreen.Hide();

            // a vertical farm: the ghost in front of the bud, then E
            StartPlacing("szklarnia");
            var spot = land.ToMap(8, 11);
            Teleport(spot.x, spot.y);
            await Awaitable.WaitForSecondsAsync(0.6f);
            await shot("d8-podglad.png");
            player.Input.PressInteract();
            await Until(() => placing == null && !landBusy, 10);
            await BuildLand("farma-solarna", new Vector2Int(14, 9));
            await RenameLand("Nowa Huta");
            Debug.Log($"[Land] after building: {land.State.buildings.Length} buildings, '{land.State.name}', concrete {land.State.resources.beton}");
            var front = land.ToMap(land.Rules.hallX, land.Rules.hallY + 5);
            Teleport(front.x, front.y);
            await Awaitable.WaitForSecondsAsync(1.2f);
            await shot("d9-po-budowie.png");

            // someone else's district: its gate, its card, a raid when it can be raided
            var theirs = Array.Find(plots, p => p.id != land.State.plot && districtsWorld.DistrictOn(p.id) != null);
            if (theirs == null)
            {
                Debug.Log("[Land] nobody else has a district here");
                return;
            }
            var d = districtsWorld.DistrictOn(theirs.id);
            var gate = Outside(theirs);
            Teleport(gate.x, gate.y + (theirs.gate == "s" ? 1 : 0));
            await Awaitable.WaitForSecondsAsync(1.2f);
            await shot("d10-sasiad.png");
            UsePlot(theirs);
            await Until(() => ui.DialogOpen, 3);
            await shot("d11-karta.png");
            Debug.Log($"[Land] neighbour '{d.name}' of {d.owner.name} (level {d.owner.level}), defence {d.defence}%, raid offered: {ui.ChoiceOpen}");
            if (!ui.ChoiceOpen)
            {
                ui.HideDialog();
                return;
            }
            ui.ChooseAccept();
            await Until(() => fightScreen.IsOpen, 10);
            await Awaitable.WaitForSecondsAsync(1.6f);
            await shot("d12-napad.png");
            for (var turn = 0; turn < 40 && currentFight is { status: "active" }; turn++)
                await FightMove(fightScreen.MoveAt(turn % 3 == 2 ? 0 : 1) ?? fightScreen.MoveAt(0));
            await Awaitable.WaitForSecondsAsync(0.4f);
            await shot("d13-wynik.png");
            Debug.Log($"[Land] raid {currentFight?.status}, loot: {Land.LootText(lastRaid?.loot) ?? "none"}");
            CloseFight();
            await Awaitable.WaitForSecondsAsync(1.5f);
            await shot("d14-po-napadzie.png");
        }
    }
}
