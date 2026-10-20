using System;
using System.Collections.Generic;

namespace Buds.Api
{
    /// <summary>
    /// The chat on this map as the player sees it (EditMode-testable): the last lines, how many came in while the
    /// window was shut, who the player muted (kept on this device, per bud), and a client-side brake that matches the
    /// server's (chat.ts), so a fast typist hears "slow down" before the server has to say it.
    /// </summary>
    public sealed class ChatLog
    {
        /// <summary>chat.ts CHAT_MAX_LENGTH.</summary>
        public const int MaxLength = 80;
        public const int Keep = 40;
        // chat.ts CHAT_BURST, CHAT_WINDOW_SECONDS, CHAT_GAP_SECONDS
        const int Burst = 4;
        const float Window = 8f;
        const float Gap = 0.7f;

        public sealed class Line
        {
            public string Id; // the sender's bud (slug); null for a note from the game
            public string Name;
            public string Text;
            public bool Mine;
        }

        readonly List<Line> lines = new();
        readonly HashSet<string> muted = new();
        readonly List<float> sent = new();

        public IReadOnlyList<Line> Lines => lines;
        public int Unread { get; private set; }
        public int MutedCount => muted.Count;
        /// <summary>Something changed (a line in, a mute): the window redraws.</summary>
        public event Action Changed;

        /// <summary>A line from the room. Muted buds are dropped; false = not shown.</summary>
        public bool Add(string id, string name, string text, bool mine, bool windowOpen)
        {
            if (string.IsNullOrEmpty(text) || (!mine && id != null && muted.Contains(id))) return false;
            lines.Add(new Line { Id = id, Name = name ?? "", Text = text, Mine = mine });
            if (lines.Count > Keep) lines.RemoveAt(0);
            if (!mine && !windowOpen && id != null) Unread++;
            Changed?.Invoke();
            return true;
        }

        /// <summary>A note from the game itself ("Za szybko…", "Brak połączenia").</summary>
        public void Note(string text) => Add(null, "", text, false, true);

        public void MarkRead()
        {
            if (Unread == 0) return;
            Unread = 0;
            Changed?.Invoke();
        }

        public bool IsMuted(string id) => id != null && muted.Contains(id);

        /// <summary>Mutes a bud: its lines go from the log and nothing more of it shows (chat, call-outs).</summary>
        public void Mute(string id)
        {
            if (string.IsNullOrEmpty(id) || !muted.Add(id)) return;
            lines.RemoveAll(l => l.Id == id && !l.Mine);
            Changed?.Invoke();
        }

        public void UnmuteAll()
        {
            if (muted.Count == 0) return;
            muted.Clear();
            Changed?.Invoke();
        }

        /// <summary>The mute list as saved on the device ("a,b,c"), and back.</summary>
        public string SaveMuted() => string.Join(",", muted);

        public void RestoreMuted(string saved)
        {
            muted.Clear();
            foreach (var id in (saved ?? "").Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries))
                if (id.Length <= 60) muted.Add(id.Trim());
        }

        /// <summary>Whether a message may go now (the server's rule); remembers it when it may.</summary>
        public bool TrySend(float time)
        {
            sent.RemoveAll(t => time - t >= Window);
            if (sent.Count >= Burst || (sent.Count > 0 && time - sent[^1] < Gap)) return false;
            sent.Add(time);
            return true;
        }

        /// <summary>What the player typed, ready to send: spaces tidied, cut to the limit; null when it is empty.</summary>
        public static string Prepare(string typed)
        {
            if (string.IsNullOrWhiteSpace(typed)) return null;
            var sb = new System.Text.StringBuilder();
            var space = false;
            foreach (var c in typed.Trim())
            {
                if (char.IsWhiteSpace(c) || char.IsControl(c))
                {
                    space = true;
                    continue;
                }
                if (space && sb.Length > 0) sb.Append(' ');
                space = false;
                sb.Append(c);
            }
            var text = sb.ToString();
            if (text.Length > MaxLength) text = text.Substring(0, MaxLength);
            return text.Length == 0 ? null : text;
        }
    }
}
