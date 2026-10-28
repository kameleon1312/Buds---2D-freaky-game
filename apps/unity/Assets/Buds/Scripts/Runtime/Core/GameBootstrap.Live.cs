using System;
using System.Collections.Generic;
using Buds.Api;
using Buds.Characters;
using Buds.UI;
using UnityEngine;

namespace Buds.Core
{
    /// <summary>
    /// Live play (docs/multiplayer.md): other players' buds on the same map, walking, riding and calling out in real
    /// time, and a duel with any of them. One WebSocket (LiveClient) while a paired bud is in the world; it reconnects
    /// on its own after a drop and goes quiet while the app is in the background. Nothing here grants anything; a
    /// broken connection only means the others are not shown, the game itself never waits for it.
    /// </summary>
    public sealed partial class GameBootstrap
    {
        const float LiveRange = 1.6f; // feet to feet, to talk to (challenge) another bud
        const int LiveSheetScale = 6; // other buds' sheets: 96×144 px a frame is plenty at their size on screen
        const int LiveSheetLoads = 3; // downloads at once
        const float LiveSheetRetry = 20f;
        const float LiveReplacedWait = 60f;
        const float LiveUnauthorizedWait = 300f;
        const float LiveTeleport = 4f; // a jump this far (tiles) is told as a join, not a step

        LiveClient live;
        LiveUi liveUi;
        readonly LiveSender liveSender = new();
        readonly Dictionary<string, RemoteBud> remotes = new();
        readonly Dictionary<string, (string version, BudSheet sheet)> liveSheets = new();
        readonly HashSet<string> liveSheetLoading = new();
        readonly Dictionary<string, float> liveSheetFailedAt = new();
        readonly List<string> liveScratch = new();
        BudSheet livePlaceholder;
        RemoteBud nearbyRemote;
        string liveMap; // the map the server has us on
        int liveAttempt;
        float liveRetryAt;
        bool liveConnecting;
        bool liveOff; // the player signed out (or the scene is going): no more tries
        bool livePaused;
        bool liveSheetsDirty;
        bool liveWelcomed;
        int liveGeneration;
        float liveJoinToastAt = -99;
        readonly ChatLog chatLog = new();
        ChatScreen chatScreen;
        float emoteSentAt = -99;
        string MuteKey => $"buds.mute.{session?.Slug ?? "guest"}";

        /// <summary>Live play on: after the world is up, for a paired bud only (guests have no token).</summary>
        void SetUpLive()
        {
            if (session == null || CommandLine.Has("-buds-offline")) return;
            liveUi ??= new LiveUi(ui.FullScreen);
            liveUi.SetVisible(true);
            chatLog.RestoreMuted(PlayerPrefs.GetString(MuteKey, ""));
            if (chatScreen == null)
            {
                chatScreen = new ChatScreen(ui.Root, chatLog, SendChat, SendEmote, MuteBud, UnmuteAll);
                chatLog.Changed += LiveIndicators;
            }
            ui.ShowChatButton(ToggleChat);
            liveOff = false;
            liveRetryAt = 0;
            LiveIndicators();
        }

        /// <summary>Called at the end of LoadDistrict: the old map's buds went with it; the server hears where we are now.</summary>
        void LiveMapChanged()
        {
            ForgetRemotes();
            nearbyRemote = null;
            if (live == null || !liveWelcomed || !player) return;
            var at = (Vector2)player.transform.position;
            live.Send(LiveProtocol.Join(world.Map.Id, at));
            liveMap = world.Map.Id;
            liveSender.Reset();
        }

        /// <summary>Every frame (LateUpdate, so whatever Update returned early on): the inbox, our own state, the names.</summary>
        void LateUpdate()
        {
            if (liveUi == null) return;
            try
            {
                PumpLive();
                PumpLiveSheets();
                liveUi.SetVisible(player && !travelling);
                FightPlates(); // health over the fighters' heads, the blows' numbers (GameBootstrap.Combat)
                liveUi.Tick(Camera.main, HeadOf, HasPlate);
            }
            catch (Exception e)
            {
                // the others not showing for a frame is fine; the game stopping is not
                Debug.LogException(e);
            }
        }

        Vector3? HeadOf(string id)
        {
            if (id == LiveUi.Me) return player ? RemoteBud.HeadOf(PlayerSprite(), player.transform) : null;
            return remotes.TryGetValue(id, out var r) && r ? r.Head : null;
        }

        SpriteRenderer playerSprite;

        SpriteRenderer PlayerSprite()
        {
            if (!playerSprite || !playerSprite.transform.IsChildOf(player.transform))
                playerSprite = player.transform.Find("Visual/Sprite")?.GetComponent<SpriteRenderer>();
            return playerSprite;
        }

        // ---------- the connection ----------

        void PumpLive()
        {
            if (session == null || liveOff) return;
            if (live == null)
            {
                if (!liveConnecting && !livePaused && player && world && Time.unscaledTime >= liveRetryAt) _ = LiveConnect();
                return;
            }
            if (live.State == LiveClient.LiveState.Closed)
            {
                LiveClosed(live.CloseCode);
                return;
            }
            // a bounded batch a frame: a burst after a hiccup never stalls a frame
            for (var n = 0; n < 200 && live != null && live.TryReceive(out var json); n++) HandleLive(LiveProtocol.Parse(json));
            if (live == null || !liveWelcomed || !player || travelling) return;

            var at = (Vector2)player.transform.position;
            if (float.IsNaN(at.x) || float.IsNaN(at.y) || float.IsInfinity(at.x) || float.IsInfinity(at.y)) return;
            if (!float.IsNaN(liveSender.LastAt.x) && (at - liveSender.LastAt).magnitude > LiveTeleport)
            {
                // a jump (stepping out of a wall, a ferry, the autopilot): a new spot, not a sprint
                live.Send(LiveProtocol.Join(world.Map.Id, at));
                liveSender.Reset();
            }
            var facing = LiveProtocol.FacingCode(player.Facing, player.Motor.FacingRight);
            var moving = player.Motor.Velocity.sqrMagnitude > 0.04f;
            var ride = player.Ride?.Kind ?? "";
            var status = LiveStatus();
            if (liveSender.ShouldSend(Time.unscaledTime, at, facing, moving, ride, status))
                live.Send(LiveProtocol.Move(at, facing, moving, ride, status, self.Forced));
        }

        /// <summary>0 out and about, 1 fighting, 2 in a menu or a talk, 3 typing in the chat.</summary>
        int LiveStatus()
        {
            if (InCombat) return 1;
            if (chatScreen?.IsOpen ?? false) return 3;
            return ui.DialogOpen || (panel?.IsOpen ?? false) || (mapScreen?.IsOpen ?? false) || (rivalryScreen?.IsOpen ?? false) ||
                   (trainingScreen?.IsOpen ?? false) || (creatorScreen?.IsOpen ?? false) || (ferryScreen?.IsOpen ?? false) ||
                   (landScreen?.IsOpen ?? false)
                ? 2
                : 0;
        }

        async Awaitable LiveConnect()
        {
            if (liveConnecting || live != null || session == null || liveOff || !player || !world) return;
            liveConnecting = true;
            var generation = ++liveGeneration;
            var client = new LiveClient();
            try
            {
                var at = (Vector2)player.transform.position;
                var map = world.Map.Id;
                var hello = LiveProtocol.Hello(session.Token, map, at, LiveProtocol.FacingCode(player.Facing, player.Motor.FacingRight),
                    player.Ride?.Kind);
                var ok = await client.Connect(LiveProtocol.UrlFor(PlayerSession.ApiBaseUrl), hello);
                // signed out, paused or the scene went away while connecting: this socket is no longer wanted
                if (!this || generation != liveGeneration || liveOff || livePaused)
                {
                    client.Dispose();
                    return;
                }
                if (!ok)
                {
                    client.Dispose();
                    ScheduleLiveRetry();
                    return;
                }
                live = client;
                liveMap = map;
                liveWelcomed = false;
                liveSender.Reset();
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[Live] could not connect: {e.Message}");
                client.Dispose();
                if (this) ScheduleLiveRetry();
            }
            finally
            {
                liveConnecting = false;
            }
        }

        void ScheduleLiveRetry()
        {
            liveRetryAt = Time.unscaledTime + LiveProtocol.RetryDelay(liveAttempt++, UnityEngine.Random.value);
            LiveIndicators();
        }

        void LiveClosed(int code)
        {
            live?.Dispose();
            live = null;
            liveWelcomed = false;
            ForgetRemotes();
            ForgetFight();
            if (!LiveProtocol.Retryable(code))
            {
                // the server doesn't know the token: trying again at once would only fail again, but a hiccup on its
                // side must not keep the others away until the game restarts
                liveRetryAt = Time.unscaledTime + LiveUnauthorizedWait;
                LiveIndicators();
                return;
            }
            if (code == LiveProtocol.Replaced)
            {
                // the same bud came in on another device: give it the stage, look back in a minute
                ui.ShowToast("Ten Bud gra teraz na innym urządzeniu.", 3.5f);
                liveRetryAt = Time.unscaledTime + LiveReplacedWait;
                LiveIndicators();
                return;
            }
            ScheduleLiveRetry();
        }

        /// <summary>Closes the connection for good (signing out, the scene going away).</summary>
        void StopLive()
        {
            liveOff = true;
            liveGeneration++;
            live?.Dispose();
            live = null;
            liveWelcomed = false;
            ForgetRemotes();
            foreach (var entry in liveSheets.Values) entry.sheet?.Dispose();
            liveSheets.Clear();
        }

        /// <summary>The app went to the background: say goodbye (the others see the bud leave); back again: reconnect.</summary>
        void LivePause(bool paused)
        {
            livePaused = paused;
            if (paused)
            {
                liveGeneration++;
                live?.Dispose();
                live = null;
                liveWelcomed = false;
                ForgetRemotes();
                LiveIndicators();
            }
            else
            {
                liveAttempt = 0;
                liveRetryAt = 0;
            }
        }

        void OnDestroy()
        {
            StopLive();
            liveUi?.Dispose();
            liveUi = null;
        }

        // ---------- what the room says ----------

        void HandleLive(LiveIn m)
        {
            if (m == null) return;
            switch (m.t)
            {
                case "welcome":
                    liveWelcomed = true;
                    liveAttempt = 0;
                    ForgetRemotes();
                    ForgetFight(); // a new room: its fight comes with it ("ents", "you")
                    if (m.players != null)
                        foreach (var p in m.players) Arrive(p, false);
                    DropUnusedSheets();
                    // the bud walked on while the server was still saying hello: tell it where we are now
                    if (world && world.Map.Id != MapOfRoom(m.room) && player)
                    {
                        live.Send(LiveProtocol.Join(world.Map.Id, player.transform.position));
                        liveMap = world.Map.Id;
                    }
                    else liveMap = MapOfRoom(m.room);
                    liveSender.Reset();
                    break;
                case "join":
                    Arrive(m.p, true);
                    break;
                case "leave":
                    if (!string.IsNullOrEmpty(m.id)) Leave(m.id);
                    break;
                case "state":
                    if (m.ps == null) break;
                    foreach (var p in m.ps)
                    {
                        if (p == null || string.IsNullOrEmpty(p.id) || !Finite(p.x, p.y)) continue;
                        if (!remotes.TryGetValue(p.id, out var r) || !r) continue; // not introduced yet: its join is on the way
                        var oldStatus = r.Data.s;
                        r.Push(p);
                        if (oldStatus != p.s) liveUi.SetTag(p.id, r.Data.name, r.Data.level, p.s);
                    }
                    break;
                case "emote":
                    if (!string.IsNullOrEmpty(m.id) && remotes.TryGetValue(m.id, out var caller) && caller &&
                        !chatLog.IsMuted(m.id) && LiveProtocol.EmoteText(m.e) is { } said)
                    {
                        liveUi.Say(m.id, said);
                        chatLog.Add(m.id, caller.Name, said, false, chatScreen?.IsOpen ?? false);
                    }
                    break;
                case "chat":
                    HeardChat(m);
                    break;
                case "slow":
                    chatLog.Note("Za szybko. Poczekaj chwilę.");
                    break;
                case "bye":
                    if (!string.IsNullOrEmpty(m.reason)) Debug.Log($"[Live] bye: {m.reason}");
                    break;
                default:
                    HandleFight(m);
                    break;
            }
            LiveIndicators();
        }

        /// <summary>"miasto-ziomkow#2" → "miasto-ziomkow" (a second copy of a full room is the same map).</summary>
        static string MapOfRoom(string room)
        {
            if (string.IsNullOrEmpty(room)) return "";
            var hash = room.IndexOf('#');
            return hash < 0 ? room : room.Substring(0, hash);
        }

        static bool Finite(float x, float y) => !float.IsNaN(x) && !float.IsNaN(y) && !float.IsInfinity(x) && !float.IsInfinity(y);

        /// <summary>A bud in the room: shown (or, already here, updated: a new name, level, look or a jump).</summary>
        void Arrive(LivePlayerDto p, bool announce)
        {
            if (p == null || string.IsNullOrEmpty(p.id) || p.id == session?.Slug || !Finite(p.x, p.y) || !world) return;
            p.r ??= "";
            if (remotes.TryGetValue(p.id, out var r) && r)
            {
                r.SetInfo(p);
                r.Push(p);
            }
            else
            {
                livePlaceholder ??= BudSheet.Shared(Resources.Load<Texture2D>("Sheets/guest"));
                r = RemoteBud.Spawn(p, livePlaceholder, world.transform, RideSprite);
                remotes[p.id] = r;
                if (liveSheets.TryGetValue(p.id, out var cached) && cached.version == (p.look ?? "")) r.SetSheet(cached.sheet, false);
                if (announce && Time.unscaledTime - liveJoinToastAt > 8 && !ui.DialogOpen)
                {
                    liveJoinToastAt = Time.unscaledTime;
                    ui.ShowToast($"W okolicy: {p.name} (poz. {p.level})", 2.2f);
                }
            }
            liveUi.SetTag(p.id, p.name, p.level, p.s);
            liveSheetsDirty = true;
        }

        void Leave(string id)
        {
            if (remotes.TryGetValue(id, out var r) && r) Destroy(r.gameObject);
            remotes.Remove(id);
            liveUi?.RemoveTag(id);
            if (nearbyRemote && nearbyRemote.Data?.id == id) nearbyRemote = null;
            // they went: their picture goes too (the next time they come it is downloaded again)
            if (liveSheets.TryGetValue(id, out var entry) && !liveSheetLoading.Contains(id))
            {
                entry.sheet?.Dispose();
                liveSheets.Remove(id);
            }
        }

        /// <summary>Every other bud off the screen (a new map, a new room, offline). Their sheets stay for a while.</summary>
        void ForgetRemotes()
        {
            foreach (var r in remotes.Values)
                if (r) Destroy(r.gameObject);
            remotes.Clear();
            liveUi?.ClearRemote();
            nearbyRemote = null;
        }

        /// <summary>Sheets of buds not in this room any more are freed (called with every new room).</summary>
        void DropUnusedSheets()
        {
            liveScratch.Clear();
            foreach (var id in liveSheets.Keys)
                if (!remotes.ContainsKey(id) && !liveSheetLoading.Contains(id)) liveScratch.Add(id);
            foreach (var id in liveScratch)
            {
                liveSheets[id].sheet?.Dispose();
                liveSheets.Remove(id);
            }
        }

        Sprite RideSprite(string kind, Facing facing)
        {
            if (string.IsNullOrEmpty(kind)) return null;
            rideArt ??= LoadRideArt();
            return rideArt.Get(Rides.SpriteFor(kind, facing));
        }

        // ---------- the others' pictures ----------

        void PumpLiveSheets()
        {
            if (!liveSheetsDirty || liveSheetLoading.Count >= LiveSheetLoads) return;
            liveSheetsDirty = false;
            foreach (var pair in remotes)
            {
                var r = pair.Value;
                if (!r) continue;
                var want = r.Data.look ?? "";
                if (liveSheets.TryGetValue(pair.Key, out var have) && have.version == want)
                {
                    r.SetSheet(have.sheet, false);
                    continue;
                }
                if (liveSheetLoading.Contains(pair.Key)) continue;
                if (liveSheetFailedAt.TryGetValue(pair.Key, out var failed) && Time.unscaledTime - failed < LiveSheetRetry)
                {
                    liveSheetsDirty = true; // look again later
                    continue;
                }
                if (liveSheetLoading.Count >= LiveSheetLoads)
                {
                    liveSheetsDirty = true;
                    break;
                }
                _ = LoadLiveSheet(pair.Key, want, have.sheet != null);
            }
        }

        async Awaitable LoadLiveSheet(string id, string version, bool changed)
        {
            liveSheetLoading.Add(id);
            Texture2D tex = null;
            try
            {
                tex = await api.GetSheet(id, changed, LiveSheetScale);
                if (!this || liveOff)
                {
                    if (tex) Destroy(tex);
                    return;
                }
                var fresh = new BudSheet(tex, true);
                tex = null; // the sheet owns (or already freed) it now
                var old = liveSheets.TryGetValue(id, out var had) ? had.sheet : null;
                if (remotes.TryGetValue(id, out var r) && r)
                {
                    liveSheets[id] = (version, fresh);
                    r.SetSheet(fresh, false);
                }
                else
                {
                    // gone while it downloaded
                    fresh.Dispose();
                    liveSheets.Remove(id);
                }
                if (old != null && old != fresh) old.Dispose();
                liveSheetFailedAt.Remove(id);
            }
            catch (Exception e)
            {
                if (tex) Destroy(tex);
                liveSheetFailedAt[id] = Time.unscaledTime;
                Debug.LogWarning($"[Live] no sheet for {id}: {e.Message}");
            }
            finally
            {
                liveSheetLoading.Remove(id);
                liveSheetsDirty = true;
            }
        }

        // ---------- what the player does ----------

        void SendEmote(string id)
        {
            if (LiveProtocol.EmoteText(id) is not { } text) return;
            // the server lets one call-out through every 1.5 s: a faster one is not shown here either
            if (Time.unscaledTime - emoteSentAt < 1.5f)
            {
                chatLog.Note("Za szybko. Poczekaj chwilę.");
                return;
            }
            emoteSentAt = Time.unscaledTime;
            // the player sees their own bubble at once, connected or not
            liveUi?.Say(LiveUi.Me, text);
            chatLog.Add(session?.Slug, budName, text, true, chatScreen?.IsOpen ?? false);
            if (LiveOnline) live.Send(LiveProtocol.Emote(id));
        }

        // ---------- the chat ----------

        bool LiveOnline => live != null && liveWelcomed;

        /// <summary>The red count on the chat button and the line in the chat window follow the connection.</summary>
        void LiveIndicators()
        {
            ui.SetChatBadge(chatLog.Unread, LiveOnline);
            chatScreen?.SetStatus(LiveOnline, remotes.Count);
        }

        /// <summary>The player's own words: sent when there is a connection and they are not typed too fast.</summary>
        void SendChat(string typed)
        {
            var text = ChatLog.Prepare(typed);
            if (text == null) return;
            if (!LiveOnline)
            {
                chatLog.Note("Brak połączenia. Wiadomość nie poszła.");
                return;
            }
            if (!chatLog.TrySend(Time.unscaledTime))
            {
                chatLog.Note("Za szybko. Poczekaj chwilę.");
                return;
            }
            // the words show (cleaned) when the server sends them back, as everyone else sees them
            live.Send(LiveProtocol.Chat(text));
        }

        /// <summary>A chat line from the room (ours comes back too, cleaned): in the log and over the speaker's head.</summary>
        void HeardChat(LiveIn m)
        {
            if (string.IsNullOrEmpty(m.id) || string.IsNullOrEmpty(m.text)) return;
            var mine = m.id == session?.Slug;
            if (!mine && chatLog.IsMuted(m.id)) return;
            var text = m.text.Length > ChatLog.MaxLength * 2 ? m.text.Substring(0, ChatLog.MaxLength * 2) : m.text;
            chatLog.Add(m.id, mine ? budName : m.name, text, mine, chatScreen?.IsOpen ?? false);
            if (mine) liveUi.Say(LiveUi.Me, text);
            else if (remotes.ContainsKey(m.id)) liveUi.Say(m.id, text);
        }

        /// <summary>A line tapped twice: that bud's words and call-outs stop showing on this device.</summary>
        void MuteBud(string id)
        {
            var name = id;
            foreach (var l in chatLog.Lines)
                if (l.Id == id)
                    name = l.Name;
            chatLog.Mute(id);
            PlayerPrefs.SetString(MuteKey, chatLog.SaveMuted());
            PlayerPrefs.Save();
            chatLog.Note($"Wyciszono: {name}. Odcisz u góry okna.");
        }

        void UnmuteAll()
        {
            chatLog.UnmuteAll();
            PlayerPrefs.SetString(MuteKey, "");
            PlayerPrefs.Save();
            chatLog.Note("Wszyscy znów słyszani.");
        }

        /// <summary>The chat button (or T): opens the window unless something else is on the screen.</summary>
        void ToggleChat()
        {
            if (chatScreen == null) return;
            if (chatScreen.IsOpen)
            {
                chatScreen.Hide();
                return;
            }
            if (OtherScreenOpen()) return;
            ui.SetQuestsOpen(false); // the window takes the place under the plate
            chatScreen.Open();
            LiveIndicators();
        }

        bool OtherScreenOpen() =>
            ui.DialogOpen || (panel?.IsOpen ?? false) || (mapScreen?.IsOpen ?? false) ||
            (trainingScreen?.IsOpen ?? false) || (rivalryScreen?.IsOpen ?? false) || (creatorScreen?.IsOpen ?? false) ||
            (ferryScreen?.IsOpen ?? false) || (landScreen?.IsOpen ?? false) || (chatScreen?.IsOpen ?? false) || travelling;

        /// <summary>Per frame from Update: T opens the chat; while it is open the world waits (keys are letters now).</summary>
        bool UpdateChat()
        {
            if (chatScreen == null) return false;
            if (chatScreen.IsOpen)
            {
                chatScreen.Tick();
                return chatScreen.IsOpen;
            }
            var kb = UnityEngine.InputSystem.Keyboard.current;
            if (kb != null && kb.tKey.wasPressedThisFrame && !OtherScreenOpen()) ToggleChat();
            return chatScreen.IsOpen;
        }

        /// <summary>The name, level or look changed: the room re-reads it from the server.</summary>
        void LiveRefreshMe()
        {
            if (live != null && liveWelcomed) live.Send(LiveProtocol.Me());
        }

        /// <summary>The nearest other bud within reach of the player's feet (null = none, or a duel is on).</summary>
        RemoteBud NearestRemote(Vector2 feet)
        {
            RemoteBud best = null;
            var bestD = LiveRange;
            foreach (var r in remotes.Values)
            {
                if (!r) continue;
                var d = Vector2.Distance(feet, r.transform.position);
                if (d >= bestD) continue;
                bestD = d;
                best = r;
            }
            return best;
        }

        string RemoteHint(RemoteBud r) => $"Gracz: {r.Name} (poz. {r.Data.level})  [E]";

        /// <summary>Walking up to another bud and pressing E: their card (level, whether you can fight) and a greeting.</summary>
        void MeetRemote(RemoteBud r)
        {
            var p = r.Data;
            var slug = p.id;
            var name = p.name;
            var busy = p.s == 1 ? "\n<color=#bd1c31><b>Teraz walczy.</b></color>" : "";
            var danger = p.level > level + 2 ? "\n<color=#bd1c31><b>Uwaga: dużo silniejszy gracz.</b></color>" : "";
            var side = SideOf(slug);
            var fight = side == Combat.BrawlLook.Side.Ally
                ? "\nZ twojej ekipy: walczycie ramię w ramię."
                : p.level >= 6 && level >= 6
                    ? "\nPoza strefami bezpiecznymi możecie się bić: nokaut liczy się do ligi Rewirów."
                    : "\nWalki między Budami od poziomu 6, poza strefami bezpiecznymi.";
            ui.ShowChoice(name, $"<b>Poziom {p.level}</b>{busy}{danger}{fight}", "Siema!", "Zamknij", () => SendEmote("siema"), null);
        }

        /// <summary>
        /// A rival or a district's defender the REST API just put up for a fight comes out to the street, next to the
        /// bud (live.ts "summon"): the fight is right here, with the same buttons.
        /// </summary>
        void Summon(string fightId)
        {
            if (string.IsNullOrEmpty(fightId)) return;
            if (live == null || !liveWelcomed)
            {
                ui.ShowDialog("Walka", "Walka toczy się na żywo: poczekaj na połączenie z serwerem i spróbuj jeszcze raz.");
                return;
            }
            chatScreen?.Hide();
            live.Send(LiveProtocol.Summon(fightId));
            lastCombatAt = Time.time;
        }
    }
}
