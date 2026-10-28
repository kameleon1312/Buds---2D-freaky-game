using System;
using Buds.World;
using UnityEngine;

namespace Buds.Core
{
    public sealed partial class GameBootstrap
    {
        /// <summary>
        /// Autopilot (-buds-live-demo a|b, two paired buds started together in the city): both wait for each other;
        /// "a" walks a loop and calls out, "b" watches it move (shots), calls back, opens the call-out bar, walks up to
        /// "a" and opens its card (the challenge answers with the server's word), then both leave a room and come
        /// back, and "a" travels into a room and out (the other sees it go and return). Logs what each one saw.
        /// </summary>
        async Awaitable LiveDemo(Func<string, Awaitable> shot)
        {
            var role = CommandLine.Get("-buds-live-demo") == "b" ? "b" : "a";
            async Awaitable Walk(Vector2 dir, float seconds)
            {
                player.Input.Override = dir;
                await Awaitable.WaitForSecondsAsync(seconds);
                if (player) player.Input.Override = Vector2.zero;
            }

            if (world.Map.Id != Districts.Start) LoadDistrict(Districts.Start, null);
            Teleport(world.Map.SpawnX + (role == "a" ? 2 : -2), world.Map.SpawnY);
            for (var i = 0; i < 300 && remotes.Count == 0; i++) await Awaitable.WaitForSecondsAsync(0.1f);
            Debug.Log($"[Live] {role}: connected {live != null && liveWelcomed}, sees {remotes.Count} bud(s)");
            if (remotes.Count == 0) return;
            await Awaitable.WaitForSecondsAsync(1.5f); // the other one's sheet arrives
            await shot($"l-{role}-1-together.png");

            if (role == "a")
            {
                await Walk(Vector2.right, 1.2f);
                await Walk(Vector2.up, 1.0f);
                SendEmote("siema");
                await shot($"l-{role}-2-siema.png");
                await Walk(Vector2.left, 1.2f);
                await Walk(Vector2.down, 1.0f);
                await Awaitable.WaitForSecondsAsync(3f); // "b" comes over and calls out
                await shot($"l-{role}-3-visited.png");
                Debug.Log($"[Live] a: unread {chatLog.Unread}");
                ToggleChat();
                chatScreen.Type("Tak, chodźmy!");
                chatScreen.PressSend();
                await shot($"l-{role}-4-chat.png");
                foreach (var l in chatLog.Lines) Debug.Log($"[Live] a chat: {l.Name}: {l.Text}");
                chatScreen.Hide();
            }
            else
            {
                foreach (var r in remotes.Values) Debug.Log($"[Live] b: {r.Name} at {r.transform.position}");
                await Awaitable.WaitForSecondsAsync(1.0f);
                await shot($"l-{role}-2-a-walks.png");
                foreach (var r in remotes.Values) Debug.Log($"[Live] b: {r.Name} at {r.transform.position}");
                await Awaitable.WaitForSecondsAsync(1.2f);
                await shot($"l-{role}-3-a-says.png");
                SendEmote("gg");
                // the chat: own words, cleaned by the server (the swear word comes back starred, the link hidden)
                ToggleChat();
                await Awaitable.WaitForSecondsAsync(0.3f);
                chatScreen.Type("Siema Czarek, kurwa jak tu fajnie! Wbijaj na www.zla-strona.pl");
                chatScreen.PressSend();
                await Awaitable.WaitForSecondsAsync(1.6f);
                chatScreen.Type("Idziemy na rynek?");
                chatScreen.PressSend();
                await shot($"l-{role}-4-chat.png");
                foreach (var l in chatLog.Lines) Debug.Log($"[Live] b chat: {l.Name}: {l.Text}");
                chatScreen.Hide();
                await Awaitable.WaitForSecondsAsync(2.4f);
                // walk up to "a" and press E: its card
                Characters.RemoteBud target = null;
                foreach (var r in remotes.Values)
                    if (r) target = r;
                if (target)
                {
                    var p = target.transform.position;
                    player.Teleport(new Vector3(p.x - 1.1f, p.y, 0));
                    Camera.main!.GetComponent<FollowCamera>().SnapToTarget();
                    await Awaitable.WaitForSecondsAsync(0.4f);
                    Debug.Log($"[Live] b: hint near a → {(nearbyRemote ? RemoteHint(nearbyRemote) : "none")}");
                    player.Input.PressInteract();
                    await shot($"l-{role}-5-card.png");
                    if (ui.ChoiceOpen)
                    {
                        ui.ChooseAccept();
                        await Awaitable.WaitForSecondsAsync(0.6f);
                        await shot($"l-{role}-6-greeting.png");
                        if (ui.DialogOpen) ui.HideDialog();
                    }
                }
            }

            // a trip into a room and back: the other one sees the bud leave and come back
            var door = world.Map.Doors.Count > 0 ? world.Map.Doors[0] : null;
            if (role == "a" && door != null)
            {
                await Travel(door.Target, world.Map.Id);
                await Awaitable.WaitForSecondsAsync(2f);
                Debug.Log($"[Live] a: in {world.Map.Id}, sees {remotes.Count}");
                await Travel(Districts.Start, world.Map.Id);
                await Awaitable.WaitForSecondsAsync(2.5f);
                Debug.Log($"[Live] a: back in {world.Map.Id}, sees {remotes.Count}");
            }
            else
            {
                var saw = remotes.Count;
                var lowest = saw;
                for (var t = 0f; t < 6; t += 0.2f)
                {
                    await Awaitable.WaitForSecondsAsync(0.2f);
                    lowest = Mathf.Min(lowest, remotes.Count);
                }
                Debug.Log($"[Live] b: saw {saw}, fewest {lowest} while a was inside, now {remotes.Count}");
            }
            await shot($"l-{role}-7-end.png");
            Debug.Log($"[Live] {role}: done, sees {remotes.Count}, connected {live != null && liveWelcomed}");
        }
    }
}
