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
        /// buys it under a name, looks at the window's four tabs, shows a building's ghost, puts up a vertical farm and a
        /// solar farm, walks to the forest at the district's edge and has a piece cleared (the crew at work), renames the
        /// district, then walks to someone else's district, looks at its card and raids it when it can (the duel played to
        /// the end). Logs what the server answered.
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
            Debug.Log($"[Land] own district: '{land.State?.name}' on {land.State?.plot}, sectors {land.State?.sectors?.Length}, rank {land.Rank}");
            if (!land.Has)
            {
                Debug.LogError("[Land] no district bought");
                return;
            }
            await Until(() => districtsWorld.Ready, 5);

            // in the district: the town hall behind the gate, the bar, the window
            var hallAt = Land.HallSpot(land.Plot.gate, land.Rules.sector, land.Rules.sectors);
            var hall = land.ToMap(hallAt.x, hallAt.y + 3);
            Teleport(hall.x, hall.y);
            await Awaitable.WaitForSecondsAsync(1.2f);
            await shot("d4-dystrykt.png");
            OpenLandScreen();
            await shot("d5-budynki.png");
            landScreen.ShowTab(LandScreen.TabTerrain);
            await shot("d6-teren.png");
            landScreen.ShowTab(LandScreen.TabRaids);
            await shot("d7-napady.png");
            landScreen.Hide();

            // a building's ghost in front of the bud (on this small start it doesn't fit there yet), then two built
            StartPlacing("szklarnia");
            var spot = land.ToMap(hallAt.x - 5, hallAt.y + 5);
            Teleport(spot.x, spot.y);
            await Awaitable.WaitForSecondsAsync(0.6f);
            await shot("d8-podglad.png");
            StopPlacing();
            await BuildLand("szklarnia", new Vector2Int(hallAt.x - 5, hallAt.y + 4));
            await BuildLand("farma-solarna", new Vector2Int(hallAt.x + 5, hallAt.y + 4));

            // the forest at the district's edge: the hint, the offer, the crew
            var edge = land.ToMap(hallAt.x - 7, hallAt.y + 2);
            Teleport(edge.x, edge.y);
            await Awaitable.WaitForSecondsAsync(0.8f);
            await shot("d9-las.png");
            if (nearbySector >= 0)
            {
                AskClear(nearbySector);
                await Until(() => ui.ChoiceOpen || ui.DialogOpen, 3);
                await shot("d10-wycinka.png");
                if (ui.ChoiceOpen) ui.ChooseAccept();
                else ui.HideDialog();
                await Until(() => !landBusy && land.InWork >= 0, 10);
                await Until(() => districtsWorld.Ready, 5);
            }
            Debug.Log($"[Land] clearing: sector {land.InWork}, next {land.NextClearing?.coins} coins");
            await RenameLand("Nowa Huta");
            Debug.Log($"[Land] after building: {land.State.buildings.Length} buildings, '{land.State.name}', concrete {land.State.resources.beton}, rank {land.Rank}");
            var front = land.ToMap(hallAt.x, hallAt.y + 4);
            Teleport(front.x, front.y);
            await Awaitable.WaitForSecondsAsync(1.6f);
            await shot("d11-po-budowie.png");

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
            await shot("d12-sasiad.png");
            UsePlot(theirs);
            await Until(() => ui.DialogOpen, 3);
            await shot("d13-karta.png");
            Debug.Log($"[Land] neighbour '{d.name}' ({d.rank}) of {d.owner.name} (level {d.owner.level}), defence {d.defence}%, raid offered: {ui.ChoiceOpen}");
            if (!ui.ChoiceOpen)
            {
                ui.HideDialog();
                return;
            }
            ui.ChooseAccept();
            var defender = await ShadowComes(10);
            if (!defender)
            {
                Debug.Log("[Land] the raid was turned down (rest after a try, or a shield)");
                if (ui.DialogOpen) ui.HideDialog();
                await OtherStyles(shot, Until, Outside);
                return;
            }
            await shot("d14-napad.png");
            var outcome = await FightIt(() => !defender || defender.Down, 60, shot, "d15-walka");
            await Awaitable.WaitForSecondsAsync(1.2f);
            await shot("d15-wynik.png");
            Debug.Log($"[Land] raid {outcome}");
            await Awaitable.WaitForSecondsAsync(1.5f);
            await shot("d16-po-napadzie.png");
            await OtherStyles(shot, Until, Outside);
        }

        /// <summary>The plots of the other wastelands: tropical on the dunes, the manor road, the scrapland.</summary>
        async Awaitable OtherStyles(Func<string, Awaitable> shot, Func<Func<bool>, float, Awaitable> until, Func<PlotData, Vector2Int> outside)
        {
            foreach (var (route, from, file) in new[]
                     {
                         ("pustkowie-wydmy", "las-palmas", "d17-tropik.png"),
                         ("pustkowie-gosciniec", "dwor-carski", "d18-dwor.png"),
                         ("pustkowie-nieuzytki", "los-karkos", "d19-zlom.png"),
                     })
            {
                LoadDistrict(route, from);
                await until(() => districtsWorld && districtsWorld.Route == route && districtsWorld.Ready, 15);
                await Awaitable.WaitForSecondsAsync(1f);
                var p = quests.Content.land.PlotsOn(route)[0];
                // inside the gate, on the plot's small clearing, the wild land around
                var inside = Land.GateCells(p.gate, land.Rules.plotSize)[1];
                var step = p.gate switch { "s" => new Vector2Int(0, -2), "n" => new Vector2Int(0, 2), "e" => new Vector2Int(-2, 0), _ => new Vector2Int(2, 0) };
                Teleport(p.x + inside.x + step.x, p.y + inside.y + step.y);
                await Awaitable.WaitForSecondsAsync(1.2f);
                await shot(file);
            }
        }
    }
}
