using Buds.Characters;
using System;
using Buds.Quests;
using Buds.UI;
using UnityEngine;

namespace Buds.Core
{
    public sealed partial class GameBootstrap
    {
        /// <summary>
        /// Autopilot (-buds-plan-demo, a guest will do): Chinatown's places, then a made-up district on Ryżowy Trakt with
        /// turned buildings and its plan from above (fits, in the wild, turned), then the bud on a board in every facing.
        /// Nothing is sent. The real thing against a server: -buds-land-demo.
        /// </summary>
        async Awaitable PlanDemo(Func<string, Awaitable> shot)
        {
            async Awaitable Wait(float s) => await Awaitable.WaitForSecondsAsync(s);
            // Chinatown, walked through
            LoadDistrict("chinatown", null);
            await Wait(2f);
            foreach (var (name, x, y) in new[]
                     {
                         ("ct1-brama", 64, 18), ("ct2-ulica", 64, 34), ("ct3-plac", 64, 73), ("ct4-targ", 100, 60), ("ct5-pagoda", 64, 106),
                         ("ct6-staw", 86, 97), ("ct7-dojo", 24, 68), ("ct8-gaj", 110, 28), ("ct9-magazyny", 150, 70), ("ct10-port", 60, 114),
                     })
            {
                Teleport(x, y);
                await Wait(1f);
                await shot(name + ".png");
            }

            // the wasteland, a made-up district on it with turned buildings, and its plan from above
            LoadDistrict("pustkowie-ryzowe", "dwor-carski");
            for (var t = 0f; t < 8 && !districtsWorld; t += 0.1f) await Wait(0.1f);
            var rules = land.Rules;
            var plot = rules.PlotsOn(world.Map.Id)[0];
            var at = Land.HallSpot(plot.gate, rules.sector, rules.sectors);
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            land.Apply(new LandViewDto
            {
                land = new LandStateDto
                {
                    plot = plot.id,
                    name = "Nowa Dzielnica",
                    sectors = System.Linq.Enumerable.ToArray(System.Linq.Enumerable.Union(Land.StartSectors(plot.gate, rules.sectors), new[] { 6, 7, 8, 11, 12, 13, 16, 17, 18, 21, 22, 23 })),
                    resources = new LandResourcesDto { beton = 9000, stal = 9000, energia = 9000, zywnosc = 9000 },
                    buildings = new[]
                    {
                        new LandBuildingDto { id = 1, kind = Land.Hall, x = at.x, y = at.y, level = 5, readyAt = now, collectedAt = now },
                        new LandBuildingDto { id = 2, kind = "magazyn", x = at.x + 8, y = at.y + 5, rot = 1, level = 1, readyAt = now, collectedAt = now },
                        new LandBuildingDto { id = 3, kind = "szklarnia", x = at.x + 7, y = at.y - 4, rot = 3, level = 1, readyAt = now, collectedAt = now },
                    },
                    nextId = 4,
                    shieldUntil = 0,
                },
                now = now,
                storage = rules.baseStorage,
            }, now);
            if (districtsWorld) districtsWorld.Redraw();
            var spot = land.ToMap(at.x, at.y + 2);
            Teleport(spot.x, spot.y);
            await Wait(2f);
            await shot("plan0-swiat.png");
            OpenMap();
            await Wait(0.3f);
            await shot("mapa1-calosc.png");
            mapScreen.ZoomBy(2.2f, Vector2.zero);
            await Wait(0.3f);
            await shot("mapa2-blizej.png");
            mapScreen.CentreOnBud();
            await Wait(0.3f);
            await shot("mapa3-bud.png");
            mapScreen.Hide();
            LoadDistrict("chinatown", null);
            await Wait(1.5f);
            foreach (var (x, y) in new[] { (64, 18), (64, 40), (64, 70), (100, 60) })
            {
                Teleport(x, y);
                await Wait(0.3f);
            }
            OpenMap();
            await Wait(0.3f);
            await shot("mapa4-chinatown.png");
            mapScreen.CentreOnBud();
            await Wait(0.3f);
            await shot("mapa5-chinatown-blisko.png");
            mapScreen.Hide();
            LoadDistrict("pustkowie-ryzowe", "dwor-carski");
            for (var t = 0f; t < 8 && !districtsWorld; t += 0.1f) await Wait(0.1f);
            districtsWorld.Redraw();
            await Wait(1f);
            spot = land.ToMap(at.x, at.y + 2);
            Teleport(spot.x, spot.y);
            await Wait(0.5f);
            ui.ShowBuilding(true);
            landPlanner.Open(land, "iglica", 20, districtsWorld, Camera.main!.GetComponent<FollowCamera>(), (_, _) => { }, null, () => ui.ShowBuilding(false));
            await Wait(1.5f);
            await shot("plan1.png");
            landPlanner.MoveForDemo(new Vector2Int(3, 3));
            await Wait(0.3f);
            await shot("plan2-dzicz.png");
            landPlanner.Fit();
            landPlanner.Rotate();
            await Wait(0.3f);
            await shot("plan3-obrot.png");
            landPlanner.Hide();
            ui.ShowAnswers("Strażniczka Mei", "Co wraca jak fala?", new[] { "Dług", "Przysługa", "Kłamstwo" }, null);
            await Wait(0.3f);
            await shot("pytanie.png");
            ui.HideDialog();

            // on a board: sideways whichever way it rolls
            rideArt ??= LoadRideArt();
            player.SetRide(new BudController.RideLook
            {
                Kind = "deskorolka",
                Side = rideArt.Get(Rides.SpriteFor("deskorolka", Facing.Side)),
                Front = rideArt.Get(Rides.SpriteFor("deskorolka", Facing.Down)),
                Back = rideArt.Get(Rides.SpriteFor("deskorolka", Facing.Up)),
            });
            foreach (var (name, dir) in new[] { ("deska-dol", Vector2.down), ("deska-gora", Vector2.up), ("deska-bok", Vector2.right) })
            {
                player.Motor.Face(dir, true);
                await Wait(0.3f);
                await shot(name + ".png");
            }
            player.SetRide(null);
        }

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

            // the plan from above: turned, dragged into the wild (red), fitted, then two built, the first one turned
            StartPlacing("szklarnia");
            await Awaitable.WaitForSecondsAsync(0.5f);
            await shot("d8-plan.png");
            landPlanner.MoveForDemo(new Vector2Int(2, 2));
            await Awaitable.WaitForSecondsAsync(0.3f);
            await shot("d8b-plan-zle.png");
            landPlanner.Fit();
            landPlanner.Rotate();
            await Awaitable.WaitForSecondsAsync(0.3f);
            await shot("d8c-plan-obrot.png");
            landPlanner.Hide();
            await BuildLand("szklarnia", new Vector2Int(hallAt.x - 5, hallAt.y + 4), 1);
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
