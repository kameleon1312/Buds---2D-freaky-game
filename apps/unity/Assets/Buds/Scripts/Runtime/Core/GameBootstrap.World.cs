using System;
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
    /// Exploring: doors into buildings (with a fade), hidden caches (coins and XP granted by the server), the fog of
    /// war and the map screen.
    /// </summary>
    public sealed partial class GameBootstrap
    {
        const float DoorRange = 1.0f; // feet to the centre of the cell in front of a door
        const float DoorPushSeconds = 0.12f; // walking into a door this long goes in

        CacheLog caches;
        CacheWorld cacheWorld;
        MapScreen mapScreen;
        WorldMap districtMap; // the district the bud is in (the outside of a room)
        Exploration fog;
        string fogMapId;
        bool fogDirty;
        float fogSavedAt;
        Vector2Int lastCell = new(-1, -1);
        Door nearbyDoor;
        CacheData nearbyCache;
        float doorPush;
        bool travelling;
        bool openingCache;
        int sprytRank;

        string GuestCachesKey => "buds.caches.guest";
        string FogKey(string mapId) => $"buds.fog.{session?.Slug ?? "guest"}.{mapId}";

        // ---------- set-up ----------

        void SetUpCaches()
        {
            caches = new CacheLog(quests.Content);
            if (session == null) caches.Restore(PlayerPrefs.GetString(GuestCachesKey, ""));
            else _ = SyncCaches();
        }

        /// <summary>
        /// Opened caches, trained skills and worn gear come from the server; until then everything looks unopened and the
        /// bud walks at its base speed.
        /// </summary>
        async Awaitable SyncCaches()
        {
            try
            {
                foreach (var id in await api.GetOpenedCaches(session.Token)) caches.Open(id);
                ApplySkills(await api.GetSkills(session.Token));
                ApplyEquipment(await api.GetEquipment(session.Token));
            }
            catch (ApiException e)
            {
                Debug.LogWarning($"Could not load caches: {e.Message}");
            }
        }

        void SetUpMap()
        {
            mapScreen ??= new MapScreen(ui.Root, () => mapScreen.Hide());
            ui.ShowMapButton(OpenMap);
        }

        /// <summary>Called by LoadDistrict: keeps the district (and its fog) when walking into one of its rooms.</summary>
        void EnterMap(WorldMap map)
        {
            if (!map.IsInterior) districtMap = map;
            else if (districtMap == null || districtMap.Id != map.Outside) districtMap = MapFormat.Load(map.Outside);
            if (fogMapId == districtMap.Id) return;
            SaveFog();
            fog = Exploration.Load(districtMap.Width, districtMap.Height, PlayerPrefs.GetString(FogKey(districtMap.Id), ""));
            fogMapId = districtMap.Id;
            lastCell = new Vector2Int(-1, -1);
        }

        void SaveFog()
        {
            if (fog == null || fogMapId == null || !fogDirty) return;
            PlayerPrefs.SetString(FogKey(fogMapId), fog.Save());
            PlayerPrefs.Save();
            fogDirty = false;
            fogSavedAt = Time.time;
        }

        void OnApplicationPause(bool paused)
        {
            if (paused) SaveFog();
        }

        void OnApplicationQuit() => SaveFog();

        // ---------- every frame ----------

        /// <summary>Uncovers the map around the bud and notices caches nearby.</summary>
        void Explore(Vector2Int cell)
        {
            var map = world.Map;
            if (!map.IsInterior && cell != lastCell && fog != null)
            {
                lastCell = cell;
                if (fog.Reveal(cell.x, cell.y)) fogDirty = true;
                if (fogDirty && Time.time - fogSavedAt > 5) SaveFog();
            }

            var (x, y) = FeetOnMap();
            if (caches.Reveal(map.Id, x, y, CacheLog.RevealRadius(sprytRank)).Count > 0)
                ui.ShowToast("Coś tu błyszczy…", 1.8f);
        }

        /// <summary>The bud's feet in map coordinates (x right, y down, continuous).</summary>
        (float x, float y) FeetOnMap()
        {
            var p = player.transform.position;
            return (p.x, world.Map.Height - p.y);
        }

        Door FindNearbyDoor(Vector2 feet)
        {
            foreach (var d in world.Map.Doors)
                if (Vector2.Distance(feet, world.CellCenter(d.Front.x, d.Front.y)) <= DoorRange) return d;
            return null;
        }

        /// <summary>Walking up into a door for a moment goes in (no button needed).</summary>
        bool CheckDoorPush(PlayerInput input, Vector2Int cell)
        {
            var door = world.Map.DoorInFront(cell.x, cell.y);
            if (door == null || input.Move.y < 0.6f || Mathf.Abs(input.Move.x) > 0.5f)
            {
                doorPush = 0;
                return false;
            }
            doorPush += Time.deltaTime;
            if (doorPush < DoorPushSeconds) return false;
            doorPush = 0;
            EnterDoor(door);
            return true;
        }

        void EnterDoor(Door door) => _ = Travel(door.Target, world.Map.Id);

        /// <summary>Fades out, builds the other map, fades in. Input waits until the new map is on screen.</summary>
        async Awaitable Travel(string mapId, string from)
        {
            if (travelling) return;
            travelling = true;
            player.Input.Blocked = true;
            ui.SetHint(null);
            await ui.FadeTo(1, 0.16f);
            LoadDistrict(mapId, from);
            player.Input.Blocked = true;
            await ui.FadeTo(0, 0.22f);
            travelling = false;
        }

        // ---------- caches ----------

        async Awaitable OpenCache(CacheData cache)
        {
            if (openingCache) return;
            if (level < cache.minLevel)
            {
                ui.ShowDialog("Skrytka", $"Coś tu jest, ale nie dasz rady tego otworzyć. Wróć na poziomie {cache.minLevel}.");
                return;
            }
            openingCache = true;
            ui.ShowDialog("Skrytka", "Przeszukujesz…");
            await Awaitable.WaitForSecondsAsync(0.35f);
            try
            {
                if (session == null)
                {
                    caches.Open(cache.id);
                    PlayerPrefs.SetString(GuestCachesKey, caches.Save());
                    PlayerPrefs.Save();
                    cacheWorld.Burst(cache.id);
                    ui.ShowDialog("Skrytka", $"{cache.text}\n<i>Grasz jako gość: połącz Buda ze strony, żeby zbierać monety i XP.</i>");
                    return;
                }
                var res = await api.OpenCache(session.Token, cache.id);
                caches.Open(cache.id);
                if (cacheWorld) cacheWorld.Burst(cache.id);
                SetXp(res.xp);
                ui.ShowDialog("Skrytka", $"{cache.text}\n<b>+{Coins(res.coinsGained)}  ·  +{res.xpGained} XP</b>");
                if (res.levelUp) ui.ShowToast($"Awans! Poziom {res.level} (+1 punkt)", 3.5f);
                else ui.ShowToast($"+{Coins(res.coinsGained)} (masz {res.coins})", 2.4f);
            }
            catch (ApiException e) when (e.Status == 409 && e.Message.Contains("pusta"))
            {
                caches.Open(cache.id); // emptied on another device
                ui.ShowDialog("Skrytka", "Pusto. Ktoś (ty?) był tu przed tobą.");
            }
            catch (ApiException e)
            {
                ui.ShowDialog("Skrytka", $"Nie udało się zapisać znaleziska: {e.Message}\nSpróbuj jeszcze raz.");
            }
            finally
            {
                openingCache = false;
            }
        }

        /// <summary>"1 moneta", "3 monety", "25 monet".</summary>
        public static string Coins(int n)
        {
            var tens = n % 100 / 10;
            var units = n % 10;
            var word = n == 1 ? "moneta" : tens != 1 && units is >= 2 and <= 4 ? "monety" : "monet";
            return $"{n} {word}";
        }

        // ---------- map screen ----------

        /// <summary>Handles the map keys; returns true while the map is open (the world waits).</summary>
        bool UpdateMapScreen(PlayerInput input)
        {
            if (mapScreen == null) return false;
            if (mapScreen.IsOpen)
            {
                if (input.MapPressed || input.CancelPressed) mapScreen.Hide();
                return mapScreen.IsOpen;
            }
            if (input.MapPressed && !ui.DialogOpen) OpenMap();
            return mapScreen.IsOpen;
        }

        void OpenMap()
        {
            if (!player || ui.DialogOpen || (panel?.IsOpen ?? false)) return;
            var map = districtMap ?? world.Map;
            var data = new MapScreenData { Map = map, Fog = fog };
            if (world.Map.IsInterior)
            {
                // inside a room the bud is shown at its door
                var door = map.Doors.Find(d => d.Target == world.Map.Id);
                data.Player = door != null ? new Vector2(door.X + 0.5f, door.Y + 0.5f) : new Vector2(map.SpawnX, map.SpawnY);
            }
            else
            {
                var (x, y) = FeetOnMap();
                data.Player = new Vector2(x, y - 0.3f);
            }

            foreach (var q in quests.Active)
            {
                var target = quests.Target(q.id);
                if (target is not { } t || t.district != map.Id) continue;
                data.Targets.Add((new Vector2(t.x + 0.5f, t.y + 0.5f), $"{q.title}: {quests.Objective(q.id)}"));
            }
            foreach (var c in caches.On(map.Id))
                if (caches.Opened.Contains(c.id)) data.FoundCaches.Add(new Vector2Int(c.x, c.y));
            (data.CachesFound, data.CachesTotal) = caches.CountIn(map.Id);
            SaveFog();
            mapScreen.Show(data);
        }

        // ---------- autopilot ----------

        /// <summary>Autopilot: buys and wears gear with the coins from the tour, shows the doll, the stats and the shop.</summary>
        async Awaitable GearDemo(Func<string, Awaitable> shot)
        {
            await OpenPanel();
            await Awaitable.WaitForSecondsAsync(0.4f);
            panel.SelectTab(3);
            panel.SelectShopItem("buty-trampki");
            await shot("g1-sklep.png");
            await Buy("buty-trampki");
            await Buy("spodnie-dresy");
            await shot("g2-kupiono.png");
            await Equip("feet", "buty-trampki");
            await Equip("legs", "spodnie-dresy");
            panel.SelectTab(1);
            panel.SelectSlot("feet");
            await shot("g3-ekwipunek.png");
            panel.Hide();
            Debug.Log($"[AutoPilot] gear speed +{gear.Speed}%, motor x{player.Motor.SpeedMultiplier}");
        }

        /// <summary>Tour step: every door of the current district — walk in, look around, find a cache, walk out.</summary>
        async Awaitable VisitRooms(Func<string, Awaitable> shot)
        {
            var district = world.Map;
            foreach (var door in new List<Door>(district.Doors))
            {
                if (world.Map.Id != district.Id) LoadDistrict(district.Id, null);
                Teleport(door.Front.x, door.Front.y);
                player.Input.Override = Vector2.up; // push into the door
                for (var i = 0; i < 30 && world.Map.Id == district.Id; i++) await Awaitable.WaitForSecondsAsync(0.1f);
                player.Input.Override = Vector2.zero;
                await Awaitable.WaitForSecondsAsync(0.4f);
                await shot($"{district.Id}-room-{world.Map.Id}.png");

                foreach (var c in new List<CacheData>(caches.On(world.Map.Id)))
                {
                    Teleport(c.x, c.y + 1);
                    await Awaitable.WaitForSecondsAsync(0.6f);
                    await shot($"{world.Map.Id}-cache-seen.png");
                    player.Input.PressInteract();
                    for (var i = 0; i < 30 && (openingCache || !caches.Opened.Contains(c.id)); i++)
                        await Awaitable.WaitForSecondsAsync(0.1f);
                    await shot($"{world.Map.Id}-cache-open.png");
                    player.Input.PressInteract();
                    await Awaitable.WaitForSecondsAsync(0.2f);
                }

                // out through the doormat
                Teleport(world.Map.SpawnX, world.Map.SpawnY);
                player.Input.Override = Vector2.down;
                for (var i = 0; i < 30 && world.Map.IsInterior; i++) await Awaitable.WaitForSecondsAsync(0.1f);
                if (player) player.Input.Override = Vector2.zero;
                await Awaitable.WaitForSecondsAsync(0.5f);
            }
            if (district.Doors.Count > 0) await shot($"{district.Id}-back-outside.png");
        }
    }
}
