using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using UnityEngine;

// Field names mirror packages/shared/src/live.ts (the server's messages and what it reads).
// ReSharper disable InconsistentNaming
namespace Buds.Api
{
    /// <summary>A bud as the room sees it (live.ts LivePlayer).</summary>
    [Serializable]
    public sealed class LivePlayerDto
    {
        public string id;
        public string name;
        public int level;
        /// <summary>Changes when the look does: time to fetch a new sheet.</summary>
        public string look;
        public float x;
        public float y;
        /// <summary>0 down, 1 side (left), 2 up, 3 side facing right.</summary>
        public int f;
        public bool m;
        public string r;
        /// <summary>0 nothing, 1 fighting, 2 in a menu, 3 typing.</summary>
        public int s;
        /// <summary>Health in a fight and its maximum (0: not known yet); the crew tag ("" = none).</summary>
        public int hp;
        public int mhp;
        public string team;
    }

    /// <summary>
    /// An opponent, a shadow or a bud in the fight (live.ts LiveEntity and LiveUnitState in one: the server sends the
    /// first when one appears, the second every tick it changed).
    /// </summary>
    [Serializable]
    public sealed class LiveUnitDto
    {
        public string id;
        /// <summary>"mob" or "shadow" (entities only).</summary>
        public string kind;
        /// <summary>The opponent's content id (its sheet in the game).</summary>
        public string enemy;
        /// <summary>The bud whose sheet a shadow wears.</summary>
        public string slug;
        public string name;
        public int level;
        public float x;
        public float y;
        public int f;
        public bool m;
        public int h;
        public int mh;
        public bool boss;
        /// <summary>Hidden in its nook (a lurker).</summary>
        public bool lurk;
        /// <summary>Beaten (in an entity) / down (in a tick's state).</summary>
        public bool down;
        public bool d;
        /// <summary>A shadow fights only this bud.</summary>
        public string only;
    }

    /// <summary>Something that happened in the fight (brawl.ts BrawlEvent): which fields mean something depends on k.</summary>
    [Serializable]
    public sealed class LiveFxDto
    {
        public string k;
        public string u;
        public string v;
        public string a;
        public float x;
        public float y;
        public float x2;
        public float y2;
        public float n;
        public int h;
        public int mh;
        public bool c;
        public bool e;
        public int ms;
        public float r;
        public int q;
        /// <summary>Casts and areas: the shape (melee, arc, proj, line, circle, self, dash, buff, shield; wedge), the wedge angle or strip width.</summary>
        public string s;
        public float w;
    }

    /// <summary>One of the bud's five buttons (brawl.ts KitEntry); an empty id = nothing there yet.</summary>
    [Serializable]
    public sealed class KitEntryDto
    {
        public string id;
        public string name;
        /// <summary>melee, arc, proj, line, circle, self, dash, buff, shield.</summary>
        public string shape;
        public float range;
        public float radius;
        public float angle;
        public float width;
        public int cd;
        public string anim;
        public string icon;
        public int windup;
        /// <summary>Upgrades bought for it (0–3).</summary>
        public int rank;

        public bool Present => !string.IsNullOrEmpty(id);
    }

    /// <summary>Any message from the server: which fields mean something depends on <see cref="t"/>.</summary>
    [Serializable]
    public sealed class LiveIn
    {
        public string t;
        public string you;
        public string room;
        public LivePlayerDto[] players;
        public LivePlayerDto p;
        public string id;
        public LivePlayerDto[] ps;
        public string e;
        public string reason;
        public string name;
        public string text;
        // the fight (walka.md)
        public LiveUnitDto[] es;
        public LiveFxDto[] ev;
        public int hp;
        public int mhp;
        public int sh;
        public int ko;
        public int guard;
        public int stun;
        public KitEntryDto[] kit;
        public int[] cd;
        /// <summary>The bud can fight other buds where it stands now (level and zone).</summary>
        public bool open;
        public string kind;
        public string enemy;
        public FightRewardDto reward;
        public InfluenceDto influence;
        public PvpResultDto pvp;
        public RaidResultDto raid;
        public int coins;
        public int left;
        /// <summary>The bud's own crew tag (in "you").</summary>
        public string team;
    }

    /// <summary>
    /// The live protocol as plain code (EditMode-testable): messages to and from the server, the call-outs, the close
    /// codes, when to try again, and when the bud's own position is worth sending.
    /// </summary>
    public static class LiveProtocol
    {
        public const string Path = "/v1/live";
        public const float TickSeconds = 0.1f;

        /// <summary>The call-outs (live.ts EMOTES): id and the words in the bubble.</summary>
        public static readonly (string Id, string Text)[] Emotes =
        {
            ("siema", "Siema!"), ("gg", "GG!"), ("haha", "Haha!"), ("dzieki", "Dzięki!"),
            ("walka", "Walczymy?"), ("chodz", "Chodź tu!"), ("ekipa", "Do ekipy?"), ("nara", "Nara!"),
        };

        public static string EmoteText(string id)
        {
            foreach (var e in Emotes)
                if (e.Id == id) return e.Text;
            return null;
        }

        // close codes (live.ts LIVE_CLOSE)
        public const int Unauthorized = 4003;
        public const int Replaced = 4004;
        public const int UnknownMap = 4005;

        /// <summary>The live address for an API base: https → wss, http → ws.</summary>
        public static Uri UrlFor(string apiBase)
        {
            var b = (apiBase ?? "").TrimEnd('/');
            if (b.StartsWith("https://", StringComparison.OrdinalIgnoreCase)) b = "wss://" + b.Substring(8);
            else if (b.StartsWith("http://", StringComparison.OrdinalIgnoreCase)) b = "ws://" + b.Substring(7);
            return new Uri(b + Path);
        }

        public static string Hello(string token, string map, Vector2 at, int facing, string ride) =>
            $"{{\"t\":\"hello\",\"token\":{Str(token)},\"map\":{Str(map)},\"x\":{Num(at.x)},\"y\":{Num(at.y)},\"f\":{facing},\"r\":{Str(ride)}}}";

        public static string Move(Vector2 at, int facing, bool moving, string ride, int status, int forced = 0) =>
            $"{{\"t\":\"move\",\"x\":{Num(at.x)},\"y\":{Num(at.y)},\"f\":{facing},\"m\":{(moving ? "true" : "false")},\"r\":{Str(ride)},\"s\":{status},\"q\":{Mathf.Max(0, forced)}}}";

        /// <summary>A button pressed: 0 basic, 1–2 abilities, 3 guard, 4 ultimate, aimed at a spot (and a foe for a tap).</summary>
        public static string Act(int slot, Vector2 aim, string target) =>
            string.IsNullOrEmpty(target)
                ? $"{{\"t\":\"act\",\"a\":{Mathf.Clamp(slot, 0, 4)},\"x\":{Num(aim.x)},\"y\":{Num(aim.y)}}}"
                : $"{{\"t\":\"act\",\"a\":{Mathf.Clamp(slot, 0, 4)},\"x\":{Num(aim.x)},\"y\":{Num(aim.y)},\"tid\":{Str(target)}}}";

        /// <summary>Calls a rival or a district's defender out to the street (a fight the REST API just started).</summary>
        public static string Summon(string fightId) => $"{{\"t\":\"summon\",\"fight\":{Str(fightId)}}}";

        public static string Join(string map, Vector2 at) =>
            $"{{\"t\":\"join\",\"map\":{Str(map)},\"x\":{Num(at.x)},\"y\":{Num(at.y)}}}";

        public static string Emote(string id) => $"{{\"t\":\"emote\",\"e\":{Str(id)}}}";

        /// <summary>The player's own words (the server cleans and cuts them; this only keeps the message small).</summary>
        public static string Chat(string text) =>
            $"{{\"t\":\"chat\",\"text\":{Str(Trim(text, ChatLog.MaxLength * 2))}}}";

        static string Trim(string text, int max) => text == null ? "" : text.Length > max ? text.Substring(0, max) : text;

        public static string Me() => "{\"t\":\"me\"}";

        /// <summary>A coordinate on the wire: two decimals, invariant culture, never NaN (that would not be JSON).</summary>
        static string Num(float v)
        {
            if (float.IsNaN(v) || float.IsInfinity(v)) v = 0;
            var r = Mathf.Round(v * 100) / 100;
            return (r == 0 ? 0 : r).ToString("0.##", CultureInfo.InvariantCulture);
        }

        /// <summary>A JSON string, quotes and control characters escaped.</summary>
        static string Str(string v)
        {
            var sb = new StringBuilder("\"");
            foreach (var c in v ?? "")
            {
                if (c == '"' || c == '\\') sb.Append('\\').Append(c);
                else if (c < ' ') sb.Append("\\u").Append(((int)c).ToString("x4"));
                else sb.Append(c);
            }
            return sb.Append('"').ToString();
        }

        /// <summary>A server message, or null for anything that isn't one.</summary>
        public static LiveIn Parse(string json)
        {
            if (string.IsNullOrEmpty(json) || json.Length > 64 * 1024) return null;
            try
            {
                var m = JsonUtility.FromJson<LiveIn>(json);
                return m != null && !string.IsNullOrEmpty(m.t) ? m : null;
            }
            catch (ArgumentException)
            {
                return null;
            }
        }

        /// <summary>Facing on the wire (side frames face left; 3 = mirrored to face right).</summary>
        public static int FacingCode(Characters.Facing facing, bool right) =>
            facing == Characters.Facing.Side ? (right ? 3 : 1) : facing == Characters.Facing.Up ? 2 : 0;

        public static (Characters.Facing facing, bool right) FacingOf(int code) => code switch
        {
            1 => (Characters.Facing.Side, false),
            2 => (Characters.Facing.Up, false),
            3 => (Characters.Facing.Side, true),
            _ => (Characters.Facing.Down, false),
        };

        /// <summary>Seconds to wait before the n-th try to reconnect (1, 2, 4, 8, 15, 30, 30…), a bit of jitter on top.</summary>
        public static float RetryDelay(int attempt, float jitter01)
        {
            float[] steps = { 1, 2, 4, 8, 15, 30 };
            var d = steps[Mathf.Clamp(attempt, 0, steps.Length - 1)];
            return d * (0.85f + 0.3f * Mathf.Clamp01(jitter01));
        }

        /// <summary>Close codes after which trying again would only fail again (the token is gone).</summary>
        public static bool Retryable(int code) => code != Unauthorized;
    }

    /// <summary>
    /// Decides when the bud's own state is worth a message: on any real change, at most every tick, and now and then
    /// even when standing still (so a bud that stopped is never shown walking in place).
    /// </summary>
    public sealed class LiveSender
    {
        public const float Idle = 1.5f;

        Vector2 lastAt = new(float.NaN, float.NaN);
        int lastFacing = -1;
        bool lastMoving;
        string lastRide = "";
        int lastStatus = -1;
        float lastSent = -99;

        /// <summary>True: send now (and remember it as sent).</summary>
        public bool ShouldSend(float time, Vector2 at, int facing, bool moving, string ride, int status)
        {
            if (time - lastSent < LiveProtocol.TickSeconds) return false;
            ride ??= "";
            var changed = float.IsNaN(lastAt.x) || (at - lastAt).sqrMagnitude > 0.0004f || facing != lastFacing ||
                          moving != lastMoving || ride != lastRide || status != lastStatus;
            if (!changed && time - lastSent < Idle) return false;
            lastAt = at;
            lastFacing = facing;
            lastMoving = moving;
            lastRide = ride;
            lastStatus = status;
            lastSent = time;
            return true;
        }

        /// <summary>The last position sent, to notice a jump (a teleport is sent as a join, not a move).</summary>
        public Vector2 LastAt => lastAt;

        public void Reset()
        {
            lastAt = new Vector2(float.NaN, float.NaN);
            lastFacing = -1;
            lastStatus = -1;
            lastSent = -99;
        }
    }

    /// <summary>
    /// Smooth motion for another bud from the room's snapshots (EditMode-testable): positions are shown a little in the
    /// past (<see cref="Delay"/>) and blended between the two snapshots around that moment; a long gap or a jump snaps.
    /// </summary>
    public sealed class LiveTrack
    {
        public const float Delay = 0.15f;
        public const float SnapDistance = 4f;

        readonly List<(float time, Vector2 at)> points = new();

        public void Add(float time, Vector2 at)
        {
            if (points.Count > 0 && (at - points[^1].at).magnitude > SnapDistance) points.Clear();
            points.Add((time, at));
            if (points.Count > 24) points.RemoveAt(0);
        }

        public bool Empty => points.Count == 0;

        /// <summary>Where to draw the bud at <paramref name="time"/>.</summary>
        public Vector2 At(float time)
        {
            if (points.Count == 0) return Vector2.zero;
            var t = time - Delay;
            if (t <= points[0].time) return points[0].at;
            for (var i = 1; i < points.Count; i++)
            {
                if (t > points[i].time) continue;
                var (t0, a) = points[i - 1];
                var (t1, b) = points[i];
                return Vector2.Lerp(a, b, t1 > t0 ? (t - t0) / (t1 - t0) : 1);
            }
            return points[^1].at; // waiting for the next snapshot: stay at the last one (no guessing ahead)
        }
    }
}
