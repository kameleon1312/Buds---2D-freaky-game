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
    /// Ferries: the ferryman in every city's harbour sails the bud to another harbour for a small fare. The server
    /// checks the destination's level and takes the fare (POST /v1/buds/me/ferry); the bud lands next to the ferryman
    /// over there.
    /// </summary>
    public sealed partial class GameBootstrap
    {
        FerryScreen ferryScreen;
        /// <summary>Where the next map is entered (a harbour), instead of the road from the last map.</summary>
        Vector2Int? arriveAt;

        /// <summary>Talking to a ferryman opens the timetable (true), anyone else talks as usual.</summary>
        bool OfferFerry(NpcView npc)
        {
            var port = quests.Content.PortOfNpc(npc.Data.id);
            if (port == null) return false;
            if (session == null)
            {
                ui.ShowDialog(npc.Data.name, "Bilet kupisz połączonym Budem: monety zapisuje serwer.");
                return true;
            }
            ferryScreen ??= new FerryScreen(ui.Root);
            var trips = new List<FerryScreen.Trip>();
            foreach (var p in quests.Content.ports)
            {
                if (p.district == port.district) continue;
                var d = Districts.Get(p.district);
                var open = Districts.CanEnter(p.district, level);
                trips.Add(new FerryScreen.Trip
                {
                    PortId = p.id,
                    Label = $"{Districts.NameOf(p.district)} · {Coins(p.fare)}",
                    Detail = open ? p.name : $"Od poziomu {d?.UnlockLevel} (masz {level})",
                    Open = open,
                });
            }
            ferryScreen.Open("Rejsy", $"<b>{port.name}</b> · {npc.Data.name}: „{npc.Data.lines[0]}”", trips,
                to => _ = Sail(port, to));
            return true;
        }

        async Awaitable Sail(PortData from, string toId)
        {
            var to = quests.Content.Port(toId);
            if (to == null) return;
            // the harbour over there gets worked out while the ticket is bought
            WorldView.Prepare(to.district);
            try
            {
                var res = await api.Ferry(session.Token, from.id, to.id);
                if (panelData != null) panelData.Coins = res.coins;
                ferryScreen.Hide();
                ui.ShowToast($"Płyniesz do: {Districts.NameOf(to.district)} (−{Coins(res.fare)}, masz {res.coins})", 3f);
                arriveAt = ShoreNextTo(to);
                await Travel(to.district, null);
            }
            catch (ApiException e)
            {
                ferryScreen.Fail(e.Message);
            }
        }

        /// <summary>The cell beside the ferryman where the bud steps off (worked out on the map when it loads).</summary>
        static Vector2Int ShoreNextTo(PortData p) => new(p.x, p.y);

        /// <summary>Esc closes the timetable; while it's open the world waits.</summary>
        bool UpdateFerry(PlayerInput input)
        {
            if (ferryScreen == null || !ferryScreen.IsOpen) return false;
            if (input.CancelPressed) ferryScreen.Hide();
            return true;
        }
    }
}
