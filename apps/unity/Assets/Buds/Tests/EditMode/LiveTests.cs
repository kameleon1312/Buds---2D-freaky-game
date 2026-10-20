using System;
using System.IO;
using System.Text.RegularExpressions;
using Buds.Api;
using Buds.Characters;
using Buds.World;
using NUnit.Framework;
using UnityEngine;

namespace Buds.Tests
{
    /// <summary>Live play: the protocol, when the bud's own state is sent, smooth motion of the others, and the server's walk grids.</summary>
    public class LiveTests
    {
        [Test]
        public void TheLiveAddressFollowsTheApi()
        {
            Assert.AreEqual("wss://buds-api.onrender.com/v1/live", LiveProtocol.UrlFor("https://buds-api.onrender.com/").ToString());
            Assert.AreEqual("ws://localhost:4000/v1/live", LiveProtocol.UrlFor("http://localhost:4000").ToString());
        }

        [Test]
        public void MessagesReadAndWriteLikeTheServerExpects()
        {
            var hello = LiveProtocol.Hello("tok", "miasto-ziomkow", new Vector2(10.123f, 20.456f), 3, null);
            StringAssert.Contains("\"t\":\"hello\"", hello);
            StringAssert.Contains("\"x\":10.12", hello);
            StringAssert.Contains("\"r\":\"\"", hello);
            StringAssert.Contains("\"t\":\"move\"", LiveProtocol.Move(Vector2.one, 0, true, "deskorolka", 2));
            StringAssert.Contains("\"e\":\"siema\"", LiveProtocol.Emote("siema"));
            StringAssert.Contains("\"t\":\"me\"", LiveProtocol.Me());
            // never anything that isn't JSON: no NaN, no comma decimals, quotes escaped
            StringAssert.Contains("\"x\":0,", LiveProtocol.Move(new Vector2(float.NaN, -0.001f), 0, false, null, 0));
            StringAssert.Contains("\"y\":-3.5}", LiveProtocol.Join("a", new Vector2(1, -3.5f)));
            StringAssert.Contains("\"e\":\"a\\\"b\\\\c\\u000a\"", LiveProtocol.Emote("a\"b\\c\n"));
            var parsed = JsonUtility.FromJson<LivePlayerDto>(LiveProtocol.Move(new Vector2(1.25f, 2), 3, true, "rower", 1).Replace("\"t\":\"move\",", ""));
            Assert.AreEqual(1.25f, parsed.x);
            Assert.AreEqual("rower", parsed.r);
            Assert.IsTrue(parsed.m);

            var state = LiveProtocol.Parse("{\"t\":\"state\",\"ps\":[{\"id\":\"ala\",\"x\":1.5,\"y\":2,\"f\":3,\"m\":true,\"r\":\"rower\",\"s\":1}]}");
            Assert.AreEqual("state", state.t);
            Assert.AreEqual("ala", state.ps[0].id);
            Assert.AreEqual(3, state.ps[0].f);
            Assert.IsTrue(state.ps[0].m);
            var welcome = LiveProtocol.Parse(
                "{\"t\":\"welcome\",\"you\":\"ja\",\"room\":\"miasto-ziomkow#2\",\"players\":[{\"id\":\"ola\",\"name\":\"Ola\",\"level\":4,\"look\":\"abc\",\"x\":3,\"y\":4,\"f\":0,\"m\":false,\"r\":\"\",\"s\":0}]}");
            Assert.AreEqual("Ola", welcome.players[0].name);
            Assert.AreEqual(4, welcome.players[0].level);
            // anything that isn't a message is nothing, never an exception
            Assert.IsNull(LiveProtocol.Parse(null));
            Assert.IsNull(LiveProtocol.Parse(""));
            Assert.IsNull(LiveProtocol.Parse("{nope"));
            Assert.IsNull(LiveProtocol.Parse("{\"x\":1}"));
            Assert.IsNull(LiveProtocol.Parse(new string('a', 70000)));
        }

        [Test]
        public void FacingSurvivesTheWire()
        {
            foreach (var (facing, right) in new[] { (Facing.Down, false), (Facing.Up, false), (Facing.Side, false), (Facing.Side, true) })
                Assert.AreEqual((facing, right), LiveProtocol.FacingOf(LiveProtocol.FacingCode(facing, right)));
            Assert.AreEqual((Facing.Down, false), LiveProtocol.FacingOf(99), "an unknown code is a bud facing down");
        }

        [Test]
        public void ReconnectingBacksOffAndGivesUpOnlyOnABadToken()
        {
            Assert.AreEqual(1f, LiveProtocol.RetryDelay(0, 0.5f), 0.001f);
            Assert.AreEqual(2f, LiveProtocol.RetryDelay(1, 0.5f), 0.001f);
            Assert.AreEqual(30f, LiveProtocol.RetryDelay(50, 0.5f), 0.001f);
            Assert.That(LiveProtocol.RetryDelay(3, 0), Is.InRange(6.79f, 9.21f));
            Assert.That(LiveProtocol.RetryDelay(3, 1), Is.InRange(6.79f, 9.21f));
            Assert.IsFalse(LiveProtocol.Retryable(LiveProtocol.Unauthorized));
            Assert.IsTrue(LiveProtocol.Retryable(LiveProtocol.Replaced));
            Assert.IsTrue(LiveProtocol.Retryable(0), "a broken connection is tried again");
            Assert.IsTrue(LiveProtocol.Retryable(4007), "a server restart is tried again");
        }

        [Test]
        public void TheBudsOwnStateIsSentOnChangeAtMostEveryTick()
        {
            var s = new LiveSender();
            Assert.IsTrue(s.ShouldSend(0, Vector2.zero, 0, false, "", 0), "the first one always goes");
            Assert.IsFalse(s.ShouldSend(0.05f, Vector2.one, 0, true, "", 0), "not twice in a tick");
            Assert.IsTrue(s.ShouldSend(0.11f, Vector2.one, 0, true, "", 0));
            Assert.IsFalse(s.ShouldSend(0.3f, Vector2.one, 0, true, "", 0), "nothing changed");
            Assert.IsTrue(s.ShouldSend(0.4f, Vector2.one, 3, true, "", 0), "a turn");
            Assert.IsTrue(s.ShouldSend(0.6f, Vector2.one, 3, true, "rower", 0), "getting on a ride");
            Assert.IsTrue(s.ShouldSend(0.8f, Vector2.one, 3, true, "rower", 1), "a duel starting");
            Assert.IsTrue(s.ShouldSend(2.5f, Vector2.one, 3, true, "rower", 1), "now and then even standing still");
            Assert.AreEqual(Vector2.one, s.LastAt);
            s.Reset();
            Assert.IsTrue(float.IsNaN(s.LastAt.x));
            Assert.IsTrue(s.ShouldSend(2.55f, Vector2.one, 3, true, "rower", 1), "after a reset the next one goes");
        }

        [Test]
        public void OtherBudsMoveSmoothlyAndSnapOnAJump()
        {
            var t = new LiveTrack();
            t.Add(0, Vector2.zero);
            t.Add(0.1f, new Vector2(1, 0));
            t.Add(0.2f, new Vector2(2, 0));
            Assert.AreEqual(0f, t.At(0.1f).x, 0.001f, "shown a little in the past");
            Assert.AreEqual(0.5f, t.At(0.2f).x, 0.001f, "blended between snapshots");
            Assert.AreEqual(2f, t.At(5f).x, 0.001f, "waits at the last one, never guesses ahead");
            t.Add(0.3f, new Vector2(40, 0));
            Assert.AreEqual(40f, t.At(0.3f).x, 0.001f, "a teleport is a snap, not a slide across the map");
            for (var i = 0; i < 100; i++) t.Add(1 + i * 0.1f, new Vector2(40, i * 0.1f));
            Assert.IsFalse(t.Empty);
        }

        [Test]
        public void EveryCallOutHasWords()
        {
            Assert.AreEqual(8, LiveProtocol.Emotes.Length);
            foreach (var (id, text) in LiveProtocol.Emotes)
            {
                Assert.AreEqual(text, LiveProtocol.EmoteText(id));
                Assert.That(text.Length, Is.InRange(2, 14), id);
            }
            Assert.IsNull(LiveProtocol.EmoteText("nieznane"));
        }

        /// <summary>
        /// The server checks every position against packages/shared walk-grids.ts. Wherever the game lets a bud stand,
        /// the server must too, or that bud would freeze on everyone else's screen.
        /// </summary>
        [Test]
        public void TheServersWalkGridsMatchTheMaps()
        {
            var path = Path.GetFullPath(Path.Combine(Application.dataPath, "../../../packages/shared/src/walk-grids.ts"));
            Assert.IsTrue(File.Exists(path), path);
            var text = File.ReadAllText(path);
            var grids = Regex.Matches(text, @"'([a-z0-9-]+)': \{ w: (\d+), h: (\d+), bits: '([A-Za-z0-9+/=]*)' \}");
            Assert.Greater(grids.Count, 10);
            var checkedMaps = 0;
            foreach (Match g in grids)
            {
                var id = g.Groups[1].Value;
                var w = int.Parse(g.Groups[2].Value);
                var h = int.Parse(g.Groups[3].Value);
                var bits = Convert.FromBase64String(g.Groups[4].Value);
                var map = MapFormat.Load(id);
                Assert.AreEqual(map.Width, w, id);
                Assert.AreEqual(map.Height, h, id);
                var mismatches = 0;
                for (var y = 0; y < h; y++)
                for (var x = 0; x < w; x++)
                {
                    var i = y * w + x;
                    var server = (bits[i >> 3] & (1 << (i & 7))) != 0;
                    if (map.IsWalkable(x, y) && !server) mismatches++;
                }
                Assert.AreEqual(0, mismatches, $"{id}: cells the game walks on but the server calls walls (rerun export-maps.ts)");
                checkedMaps++;
            }
            // every district, the island and the wastelands have a grid
            foreach (var d in Districts.All) StringAssert.Contains($"'{d.Id}'", text);
            foreach (var r in Districts.Routes) StringAssert.Contains($"'{r.Id}'", text);
            StringAssert.Contains($"'{Districts.Tutorial}'", text);
            Assert.Greater(checkedMaps, 10);
        }

        [Test]
        public void ChatLinesAreSentSmallAndTidy()
        {
            StringAssert.Contains("\"t\":\"chat\"", LiveProtocol.Chat("hej"));
            StringAssert.Contains("\"text\":\"a \\\"b\\\"\"", LiveProtocol.Chat("a \"b\""));
            Assert.Less(LiveProtocol.Chat(new string('x', 5000)).Length, 400, "never a huge message");
            Assert.AreEqual("hej ty", ChatLog.Prepare("  hej \n\t ty  "));
            Assert.IsNull(ChatLog.Prepare("   "));
            Assert.IsNull(ChatLog.Prepare(null));
            Assert.AreEqual(ChatLog.MaxLength, ChatLog.Prepare(new string('a', 300)).Length);
            var welcome = LiveProtocol.Parse("{\"t\":\"chat\",\"id\":\"ala\",\"name\":\"Ala\",\"text\":\"Siema ***\"}");
            Assert.AreEqual("Ala", welcome.name);
            Assert.AreEqual("Siema ***", welcome.text);
        }

        [Test]
        public void TheChatLogCountsUnreadKeepsTheLastLinesAndMutes()
        {
            var log = new ChatLog();
            var changes = 0;
            log.Changed += () => changes++;
            Assert.IsTrue(log.Add("ala", "Ala", "siema", false, false));
            log.Add("ja", "Ja", "hej", true, false);
            Assert.AreEqual(1, log.Unread, "own lines are never unread");
            log.Add("ola", "Ola", "co tam", false, true);
            Assert.AreEqual(1, log.Unread, "lines read in the open window");
            log.MarkRead();
            Assert.AreEqual(0, log.Unread);
            log.Note("Za szybko.");
            Assert.AreEqual(0, log.Unread, "the game's notes don't count");
            Assert.IsNull(log.Lines[^1].Id);

            log.Mute("ala");
            Assert.IsTrue(log.IsMuted("ala"));
            Assert.IsFalse(log.Add("ala", "Ala", "halo?", false, false), "a muted bud is not heard");
            Assert.IsFalse(System.Linq.Enumerable.Any(log.Lines, l => l.Id == "ala"), "and its old lines go");
            var saved = log.SaveMuted();
            var other = new ChatLog();
            other.RestoreMuted(saved);
            Assert.IsTrue(other.IsMuted("ala"), "the mute list survives a restart");
            other.RestoreMuted(null);
            Assert.AreEqual(0, other.MutedCount);
            log.UnmuteAll();
            Assert.IsTrue(log.Add("ala", "Ala", "jestem", false, false));
            Assert.Greater(changes, 5);

            for (var i = 0; i < 100; i++) log.Add("ola", "Ola", $"linia {i}", false, true);
            Assert.AreEqual(ChatLog.Keep, log.Lines.Count);
            Assert.AreEqual("linia 99", log.Lines[^1].Text);
        }

        [Test]
        public void TypingTooFastIsStoppedBeforeTheServerHasTo()
        {
            var log = new ChatLog();
            Assert.IsTrue(log.TrySend(0));
            Assert.IsFalse(log.TrySend(0.3f), "two at once");
            Assert.IsTrue(log.TrySend(1));
            Assert.IsTrue(log.TrySend(2));
            Assert.IsTrue(log.TrySend(3));
            Assert.IsFalse(log.TrySend(4), "four in a few seconds is the most");
            Assert.IsTrue(log.TrySend(9), "a moment later it goes again");
        }

        [Test]
        public void NamesSayWhatTheBudIsBusyWith()
        {
            StringAssert.Contains("pisze…", UI.LiveUi.TagLine("Ala", 3, 3));
            StringAssert.Contains("w walce", UI.LiveUi.TagLine("Ala", 3, 1));
            StringAssert.DoesNotContain("<b>", UI.LiveUi.TagLine("<b>Ala", 3, 0), "a name can't carry rich text");
            Assert.AreEqual("1 gracz", UI.ChatScreen.Players(1));
            Assert.AreEqual("3 gracze", UI.ChatScreen.Players(3));
            Assert.AreEqual("5 graczy", UI.ChatScreen.Players(5));
            Assert.AreEqual("12 graczy", UI.ChatScreen.Players(12));
            Assert.AreEqual("22 gracze", UI.ChatScreen.Players(22));
            Assert.That(UI.LiveUi.BubbleSeconds("GG!"), Is.InRange(2.5f, 3f));
            Assert.That(UI.LiveUi.BubbleSeconds(new string('a', 80)), Is.InRange(6f, 7f), "a long line stays longer");
        }
    }
}
