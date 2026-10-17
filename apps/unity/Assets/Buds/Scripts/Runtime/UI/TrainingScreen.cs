using System;
using System.Collections.Generic;
using Buds.Characters;
using Buds.Quests;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace Buds.UI
{
    /// <summary>
    /// Training at a spot: every skill has its own mini-game (TrainingGames.For) — Walka beats out combos, Flow keeps
    /// the beat on three lanes, Graffiti sprays a stencil, Surfing balances the board on a wave, Przetrwanie jumps and
    /// slides through an obstacle course, Spryt stops the marker in the zone (focus). Keys and on-screen buttons;
    /// after the last round the score goes to the server (onFinished) and the screen shows what it granted.
    /// </summary>
    public sealed class TrainingScreen
    {
        const float BoardW = 800;
        const float BoardH = 236;
        const float StatusY = -350;
        static Sprite disc;

        readonly Func<int, Awaitable<string>> onFinished;
        readonly GameObject root;
        readonly Text title;
        readonly Text hint;
        readonly Text status;
        readonly RectTransform board;
        readonly RectTransform controls;
        readonly Button next;
        readonly Text nextLabel;
        readonly List<Image> pips = new();
        readonly List<bool> results = new();
        ITrainingGame game;
        /// <summary>The bud's own sheet: it runs the course and rides the board.</summary>
        BudSheet budSheet;
        string kind;
        Action draw;
        Func<Keyboard, int> keyDown = _ => -1;
        Func<Keyboard, int> keyUp = _ => -1;
        bool busy;
        bool finished;
        /// <summary>The autopilot drives the game (BotTick); the per-frame Tick then leaves it alone.</summary>
        bool botDriven;
        int lastRound;
        int lastScore;
        float flash;

        public bool IsOpen => root.activeSelf;
        public ITrainingGame Game => game;
        public string Kind => kind;
        public bool Finished => finished;

        public TrainingScreen(Transform canvas, Func<int, Awaitable<string>> onFinished)
        {
            this.onFinished = onFinished;
            disc ??= UiKit.Circle(32);
            var dim = UiKit.Panel("Training", canvas, new Color(0.086f, 0.094f, 0.122f, 0.6f));
            dim.raycastTarget = true;
            UiKit.Stretch(dim.rectTransform);
            root = dim.gameObject;
            var group = UiKit.Rect("Group", dim.transform);
            UiKit.Place(group, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(940, 660));
            group.gameObject.AddComponent<FitInParent>();
            var body = UiKit.Window("Window", group, new Vector2(900, 640), "Trening", Close, out var window, out title);
            UiKit.Place(window, new Vector2(0.5f, 0.5f), Vector2.zero, window.sizeDelta);
            title.resizeTextForBestFit = true;
            title.resizeTextMinSize = 26;
            title.resizeTextMaxSize = title.fontSize;
            title.verticalOverflow = VerticalWrapMode.Truncate;
            title.horizontalOverflow = HorizontalWrapMode.Wrap;

            hint = UiKit.Label("Hint", body, "", 24, UiKit.Ink, false, TextAnchor.UpperCenter);
            UiKit.Place(hint.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -2), new Vector2(820, 64), new Vector2(0.5f, 1));
            board = UiKit.Rect("Board", body);
            UiKit.Place(board, new Vector2(0.5f, 1), new Vector2(0, -68), new Vector2(BoardW, BoardH), new Vector2(0.5f, 1));
            status = UiKit.Label("Status", body, "", 25, UiKit.Ink, true, TextAnchor.UpperCenter);
            PlaceStatus(false);
            controls = UiKit.Rect("Controls", body);
            UiKit.Place(controls, new Vector2(0.5f, 0), new Vector2(0, 8), new Vector2(820, 84), new Vector2(0.5f, 0));
            next = UiKit.Button("Next", body, "Dalej  [E]", new Vector2(300, 76), Close, UiKit.Tone.Gold, 30);
            UiKit.Place((RectTransform)next.transform, new Vector2(0.5f, 0), new Vector2(0, 12), new Vector2(300, 76), new Vector2(0.5f, 0));
            nextLabel = next.GetComponentInChildren<Text>();
            root.SetActive(false);
        }

        public void Open(TrainingSpotData spot, string skillName, int rounds, BudSheet sheet = null, int rank = 0)
        {
            budSheet = sheet;
            kind = TrainingGames.KindFor(spot.skill);
            game = TrainingGames.For(spot.skill, rounds, Environment.TickCount, rank);
            busy = false;
            finished = false;
            botDriven = false;
            lastRound = 0;
            lastScore = 0;
            results.Clear();
            // the spot in the title (long names never wrap it), the skill it trains on the status line until the first verdict
            title.text = spot.name;
            hint.text = $"{spot.hint}\n<size=19><color=#55514a>{HowTo(kind)}</color></size>";
            status.text = $"<color=#55514a>Trenujesz:</color> {skillName}";
            Clear(board);
            Clear(controls);
            board.gameObject.SetActive(true);
            PlaceStatus(false);
            BuildPips(game.Rounds);
            draw = kind switch
            {
                "combo" => BuildCombo((ComboGame)game),
                "rhythm" => BuildRhythm((RhythmGame)game),
                "stencil" => BuildStencil((StencilGame)game),
                "balance" => BuildBalance((BalanceGame)game),
                "runner" => BuildRunner((RunnerGame)game),
                _ => BuildTiming((TimingGame)game),
            };
            controls.gameObject.SetActive(true);
            next.gameObject.SetActive(false);
            root.SetActive(true);
            root.transform.SetAsLastSibling();
            draw();
        }

        /// <summary>A one-line verdict under the pips while playing; the whole result where the board was after.</summary>
        void PlaceStatus(bool result)
        {
            UiKit.Place(status.rectTransform, new Vector2(0.5f, 1), new Vector2(0, result ? -96 : StatusY),
                new Vector2(820, result ? 230 : 40), new Vector2(0.5f, 1));
            status.fontSize = result ? 30 : 25;
        }

        static string HowTo(string kind) => kind switch
        {
            "combo" => "Strzałki albo WASD w kolejności z kafelków, zanim skończy się czas.",
            "rhythm" => "A / S / D (albo przyciski), gdy nuta mija linię. Fraza liczy się od 3 z 4 nut; tempo rośnie z rangą Flow.",
            "stencil" => "Trzymaj Spację (albo przycisk) nad otworami, puść nad maską. Liczy się czysta robota.",
            "balance" => "A / D (albo przyciski) popychają deskę. Trzymaj ją w zielonym polu do końca fali.",
            "runner" => "W: skok nad płotkiem, S: ślizg pod belką. Obie przeszkody rundy muszą przejść czysto.",
            _ => "E, Spacja albo przycisk zatrzymuje złoty znacznik. Celuj w zielone pole.",
        };

        public void Close()
        {
            if (busy) return;
            root.SetActive(false);
        }

        /// <summary>Runs the game a frame and handles the keys; Esc closes, E / Enter goes on after the result.</summary>
        public void Tick()
        {
            if (!IsOpen || game == null || botDriven) return;
            var kb = Keyboard.current;
            if (finished)
            {
                if (kb != null && (kb.eKey.wasPressedThisFrame || kb.enterKey.wasPressedThisFrame || kb.spaceKey.wasPressedThisFrame))
                    Close();
                return;
            }
            if (kb != null && !busy)
            {
                if (kb.escapeKey.wasPressedThisFrame)
                {
                    Close();
                    return;
                }
                var down = keyDown(kb);
                if (down >= 0) Press(down);
                var up = keyUp(kb);
                if (up >= 0) game.Release(up);
            }
            if (!busy) game.Tick(Time.unscaledDeltaTime);
            Step();
        }

        /// <summary>The autopilot plays a frame perfectly (screenshots of every mini-game).</summary>
        public void BotTick(float dt)
        {
            if (!IsOpen || game == null || finished || busy) return;
            botDriven = true;
            game.Bot(dt);
            Step();
        }

        public void Press(int action)
        {
            if (busy || game == null || finished || game.Done) return;
            game.Press(action);
        }

        void Step()
        {
            flash = Mathf.Max(0, flash - Time.unscaledDeltaTime);
            var f = game.TakeFeedback();
            if (f != 0)
            {
                flash = 0.35f;
                status.text = f > 0 ? $"<color=#5d9a12>{Good(kind)}</color>" : $"<color=#bd1c31>{Bad(kind)}</color>";
            }
            // a round ended: its pip shows whether it counted
            while (lastRound < game.Round)
            {
                results.Add(game.Score > lastScore);
                lastScore = game.Score;
                lastRound++;
            }
            draw?.Invoke();
            DrawPips();
            if (game.Done && !busy) _ = Finish();
        }

        static string Good(string kind) => kind switch
        {
            "combo" => "Kombo!",
            "rhythm" => "W punkt!",
            "stencil" => "Czysto!",
            "balance" => "Utrzymane!",
            "runner" => "Przeszkoda za tobą!",
            _ => "Trafione!",
        };

        static string Bad(string kind) => kind switch
        {
            "combo" => "Rozbite kombo",
            "rhythm" => "Poza bitem",
            "stencil" => "Za dużo farby albo za mało",
            "balance" => "Do wody!",
            "runner" => "Zahaczone",
            _ => "Pudło",
        };

        async Awaitable Finish()
        {
            busy = true;
            controls.gameObject.SetActive(false);
            next.gameObject.SetActive(true);
            next.interactable = false;
            nextLabel.text = "Zapisuję…";
            string text;
            try
            {
                text = await onFinished(game.Score);
            }
            catch (Exception e)
            {
                text = e.Message;
            }
            busy = false;
            finished = true;
            board.gameObject.SetActive(false);
            PlaceStatus(true);
            status.text = $"Wynik: {game.Score} / {game.Rounds}\n<size=22>{text}</size>";
            nextLabel.text = UiKit.Keys("Dalej  [E]");
            next.interactable = true;
        }

        // ---------- shared bits ----------

        static void Clear(RectTransform rt)
        {
            for (var i = rt.childCount - 1; i >= 0; i--)
            {
                var child = rt.GetChild(i).gameObject;
                child.transform.SetParent(null, false);
                UnityEngine.Object.Destroy(child);
            }
        }

        void BuildPips(int rounds)
        {
            foreach (var p in pips)
                if (p) UnityEngine.Object.Destroy(p.transform.parent.gameObject);
            pips.Clear();
            for (var i = 0; i < rounds; i++)
            {
                var pip = UiKit.OutlinedBox("Pip" + i, board.parent, UiKit.Surface700, 999);
                UiKit.Place((RectTransform)pip.transform.parent, new Vector2(0.5f, 1), new Vector2((i - (rounds - 1) / 2f) * 48, -312),
                    new Vector2(34, 34), new Vector2(0.5f, 1));
                pips.Add(pip);
            }
        }

        void DrawPips()
        {
            for (var i = 0; i < pips.Count; i++)
                pips[i].color = i >= results.Count ? (i == results.Count ? UiKit.Paper300 : UiKit.Surface700)
                    : results[i] ? UiKit.Buds400 : UiKit.Alert500;
        }

        static RectTransform Box(string name, Transform parent, Color color, float radius, Vector2 pos, Vector2 size, Vector2 pivot)
        {
            var box = UiKit.OutlinedBox(name, parent, color, radius);
            var rt = (RectTransform)box.transform.parent;
            UiKit.Place(rt, Vector2.zero, pos, size, pivot);
            return rt;
        }

        static Image Picture(string name, Transform parent, Sprite sprite, Vector2 pos, Vector2 size, Color? tint = null)
        {
            var img = UiKit.Rect(name, parent).gameObject.AddComponent<Image>();
            img.sprite = sprite;
            img.color = tint ?? Color.white;
            img.preserveAspect = true;
            img.raycastTarget = false;
            img.enabled = sprite;
            UiKit.Place(img.rectTransform, Vector2.zero, pos, size, new Vector2(0.5f, 0.5f));
            return img;
        }

        /// <summary>An on-screen control that acts on touch down (and up, for held actions), like a key.</summary>
        Button Control(string label, int action, float x, float width, UiKit.Tone tone, float arrowAngle = float.NaN)
        {
            var b = UiKit.Button("Control" + action, controls, label, new Vector2(width, 76), () => { }, tone, 26);
            UiKit.Place((RectTransform)b.transform, new Vector2(0.5f, 0.5f), new Vector2(x, 0), new Vector2(width, 76));
            var hold = b.gameObject.AddComponent<HoldControl>();
            hold.Down = () => Press(action);
            hold.Up = () => game?.Release(action);
            if (!float.IsNaN(arrowAngle))
            {
                // an arrow alone in the middle, or before the label
                var face = b.transform.Find("Face") ?? b.transform;
                var alone = string.IsNullOrEmpty(label);
                var icon = Picture("Arrow", face, UiKit.Arrow, new Vector2(alone ? width / 2 : 40, 41), new Vector2(40, 40), UiKit.Outline);
                icon.rectTransform.localEulerAngles = new Vector3(0, 0, arrowAngle);
                var text = b.GetComponentInChildren<Text>();
                if (text && !alone) text.rectTransform.offsetMin = new Vector2(text.rectTransform.offsetMin.x + 44, text.rectTransform.offsetMin.y);
            }
            return b;
        }

        static float ArrowAngle(int dir) => dir switch
        {
            0 => 180,
            1 => 90,
            3 => 270,
            _ => 0,
        };

        static bool Any(Keyboard kb, bool pressed, params Key[] keys)
        {
            foreach (var k in keys)
                if (pressed ? kb[k].wasPressedThisFrame : kb[k].wasReleasedThisFrame)
                    return true;
            return false;
        }

        // ---------- Spryt: stop the marker (focus) ----------

        Action BuildTiming(TimingGame g)
        {
            var track = Box("Track", board, UiKit.Surface800, UiKit.RadiusM, new Vector2(0, BoardH / 2), new Vector2(BoardW, 80), new Vector2(0, 0.5f));
            var inner = UiKit.Rect("Inner", track.GetChild(0));
            UiKit.Stretch(inner, 8);
            var zone = UiKit.Shape("Zone", inner, UiKit.Buds400, 6);
            var marker = UiKit.Shape("Marker", inner, UiKit.Gold400, 4).rectTransform;
            UiKit.Stretch(UiKit.Panel("Line", marker, UiKit.Outline).rectTransform, 5, 0, 5, 0);
            Control("Teraz!  [E]", 0, 0, 320, UiKit.Tone.Gold);
            keyDown = kb => Any(kb, true, Key.E, Key.Space, Key.Enter) ? 0 : -1;
            keyUp = _ => -1;
            return () =>
            {
                zone.rectTransform.anchorMin = new Vector2(g.ZoneMin, 0);
                zone.rectTransform.anchorMax = new Vector2(g.ZoneMax, 1);
                zone.rectTransform.offsetMin = zone.rectTransform.offsetMax = Vector2.zero;
                zone.color = flash > 0 && g.LastHit ? Color.white : UiKit.Buds400;
                marker.anchorMin = new Vector2(g.Marker - 0.009f, -0.15f);
                marker.anchorMax = new Vector2(g.Marker + 0.009f, 1.15f);
                marker.offsetMin = new Vector2(-4, 0);
                marker.offsetMax = new Vector2(4, 0);
            };
        }

        // ---------- Walka: combos ----------

        Action BuildCombo(ComboGame g)
        {
            var tiles = UiKit.Rect("Tiles", board);
            UiKit.Stretch(tiles);
            var timer = UiKit.Bar("Timer", board, UiKit.Rep400, out var timerRoot);
            UiKit.Place(timerRoot, new Vector2(0.5f, 0), new Vector2(0, 20), new Vector2(640, 26), new Vector2(0.5f, 0));
            var timerImage = timer.GetComponent<Image>();
            int[] shown = null;
            var tileImages = new List<(Image fill, Image icon)>();
            for (var d = 0; d < 4; d++) Control("", d, (d - 1.5f) * 150, 136, UiKit.Tone.Rep, ArrowAngle(d));
            keyDown = kb => Any(kb, true, Key.LeftArrow, Key.A) ? 0
                : Any(kb, true, Key.UpArrow, Key.W) ? 1
                : Any(kb, true, Key.RightArrow, Key.D) ? 2
                : Any(kb, true, Key.DownArrow, Key.S) ? 3 : -1;
            keyUp = _ => -1;
            return () =>
            {
                if (shown != g.Sequence)
                {
                    // a new combo: lay out its tiles
                    shown = g.Sequence;
                    Clear(tiles);
                    tileImages.Clear();
                    const float size = 112;
                    const float step = 132;
                    for (var i = 0; i < shown.Length; i++)
                    {
                        var x = BoardW / 2 + (i - (shown.Length - 1) / 2f) * step;
                        var tile = Box("Tile" + i, tiles, UiKit.Paper300, UiKit.RadiusM, new Vector2(x, 150), new Vector2(size, size), new Vector2(0.5f, 0.5f));
                        var fill = tile.GetChild(0).GetComponent<Image>();
                        var icon = Picture("Arrow", tile, UiKit.Arrow, new Vector2(size / 2, size / 2), new Vector2(64, 64), UiKit.Outline);
                        icon.rectTransform.localEulerAngles = new Vector3(0, 0, ArrowAngle(shown[i]));
                        tileImages.Add((fill, icon));
                    }
                }
                for (var i = 0; i < tileImages.Count; i++)
                    tileImages[i].fill.color = i < g.Position ? UiKit.Buds400 : i == g.Position && g.Pause <= 0 ? UiKit.Gold400 : UiKit.Paper300;
                var left = g.TimeLimit > 0 ? g.TimeLeft / g.TimeLimit : 0;
                UiKit.SetBar(timer, g.Pause > 0 ? 0 : left);
                timerImage.color = left < 0.3f ? UiKit.Alert500 : UiKit.Rep400;
            };
        }

        // ---------- Flow: rhythm ----------

        Action BuildRhythm(RhythmGame g)
        {
            Color[] tones = { UiKit.Buds400, UiKit.Rep400, UiKit.Gold400 };
            string[] keys = { "A", "S", "D" };
            const float laneH = 66;
            const float gap = 12;
            const float hitX = 110;
            var top = BoardH - 20;
            var laneFlash = new Image[RhythmGame.Lanes];
            for (var l = 0; l < RhythmGame.Lanes; l++)
            {
                var y = top - l * (laneH + gap) - laneH / 2;
                var lane = Box("Lane" + l, board, UiKit.Surface800, UiKit.RadiusM, new Vector2(0, y), new Vector2(BoardW, laneH), new Vector2(0, 0.5f));
                var key = UiKit.Outlined("Key", lane, keys[l], 28, tones[l]);
                UiKit.Place(key.rectTransform, new Vector2(0, 0.5f), new Vector2(18, 0), new Vector2(40, laneH), new Vector2(0, 0.5f));
                laneFlash[l] = Picture("Flash", lane.GetChild(0), disc, Vector2.zero, new Vector2(laneH - 6, laneH - 6), new Color(1, 1, 1, 0));
                laneFlash[l].rectTransform.anchorMin = laneFlash[l].rectTransform.anchorMax = new Vector2(0, 0.5f);
                laneFlash[l].rectTransform.anchoredPosition = new Vector2(hitX - 2, 0);
            }
            var line = UiKit.Panel("HitLine", board, UiKit.TextOnDark);
            UiKit.Place(line.rectTransform, Vector2.zero, new Vector2(hitX, top - (3 * laneH + 2 * gap) / 2),
                new Vector2(6, 3 * laneH + 2 * gap + 8), new Vector2(0.5f, 0.5f));
            var noteImages = new List<Image>();
            foreach (var n in g.Notes)
            {
                var img = Picture("Note", board, disc, Vector2.zero, new Vector2(48, 48), tones[n.Lane]);
                var ring = img.gameObject.AddComponent<Outline>();
                ring.effectColor = UiKit.Outline;
                ring.effectDistance = new Vector2(3, 3);
                noteImages.Add(img);
            }
            for (var l = 0; l < RhythmGame.Lanes; l++)
                Control(keys[l], l, (l - 1) * 240, 220, l == 0 ? UiKit.Tone.Buds : l == 1 ? UiKit.Tone.Rep : UiKit.Tone.Gold);
            keyDown = kb => Any(kb, true, Key.A, Key.LeftArrow, Key.J) ? 0
                : Any(kb, true, Key.S, Key.DownArrow, Key.K) ? 1
                : Any(kb, true, Key.D, Key.RightArrow, Key.L) ? 2 : -1;
            keyUp = _ => -1;
            var lastPressLane = -1;
            var pressFlash = 0f;
            return () =>
            {
                for (var i = 0; i < noteImages.Count; i++)
                {
                    var n = g.Notes[i];
                    var ahead = n.Time - g.Clock;
                    var img = noteImages[i];
                    var visible = n.State != 1 && ahead < g.Lead && ahead > -0.5f;
                    img.enabled = visible;
                    if (!visible) continue;
                    var y = top - n.Lane * (laneH + gap) - laneH / 2;
                    img.rectTransform.anchoredPosition = new Vector2(hitX + ahead / g.Lead * (BoardW - hitX - 30), y);
                    img.color = n.State == -1 ? new Color(0.6f, 0.62f, 0.68f, 0.6f) : tones[n.Lane];
                }
                if (g.LastLane >= 0 && (g.LastLane != lastPressLane || pressFlash <= 0))
                {
                    lastPressLane = g.LastLane;
                    pressFlash = 0.15f;
                }
                pressFlash = Mathf.Max(0, pressFlash - Time.unscaledDeltaTime);
                for (var l = 0; l < RhythmGame.Lanes; l++)
                    laneFlash[l].color = new Color(1, 1, 1, l == lastPressLane ? pressFlash * 2.5f : 0);
            };
        }

        // ---------- Graffiti: stencil ----------

        Action BuildStencil(StencilGame g)
        {
            // the wall, the stencil's openings (paper), the paint that landed, the can above
            var wall = Box("Wall", board, UiKit.Surface700, UiKit.RadiusM, new Vector2(0, 90), new Vector2(BoardW, 130), new Vector2(0, 0.5f));
            var inner = UiKit.Rect("Inner", wall.GetChild(0));
            UiKit.Stretch(inner, 10);
            var holes = UiKit.Rect("Holes", inner);
            UiKit.Stretch(holes);
            var paint = new Image[StencilGame.Bins];
            for (var i = 0; i < paint.Length; i++)
            {
                paint[i] = UiKit.Panel("Paint" + i, inner, UiKit.Buds400);
                paint[i].rectTransform.anchorMin = new Vector2(i / (float)StencilGame.Bins, 0.08f);
                paint[i].rectTransform.anchorMax = new Vector2((i + 1) / (float)StencilGame.Bins, 0.92f);
                paint[i].rectTransform.offsetMin = paint[i].rectTransform.offsetMax = Vector2.zero;
                paint[i].raycastTarget = false;
            }
            var can = Picture("Can", board, UiKit.Picture("Items/spray-zwykly"), new Vector2(0, 205), new Vector2(76, 76));
            var mist = Picture("Mist", board, disc, new Vector2(0, 150), new Vector2(46, 46), new Color(UiKit.Buds400.r, UiKit.Buds400.g, UiKit.Buds400.b, 0.55f));
            Control("Psikaj  [Spacja]", 0, 0, 380, UiKit.Tone.Buds);
            keyDown = kb => Any(kb, true, Key.Space, Key.E) ? 0 : -1;
            keyUp = kb => Any(kb, false, Key.Space, Key.E) ? 0 : -1;
            var shownRound = -1;
            return () =>
            {
                if (shownRound != g.Round || g.Pause > 0 && holes.childCount == 0)
                {
                    shownRound = g.Round;
                    Clear(holes);
                    foreach (var (a, b) in g.Openings)
                    {
                        var hole = UiKit.Shape("Hole", holes, UiKit.Paper100, UiKit.RadiusS).rectTransform;
                        hole.anchorMin = new Vector2(a, 0.08f);
                        hole.anchorMax = new Vector2(b, 0.92f);
                        hole.offsetMin = hole.offsetMax = Vector2.zero;
                    }
                }
                for (var i = 0; i < paint.Length; i++)
                {
                    var on = g.Painted[i];
                    paint[i].enabled = on;
                    if (on) paint[i].color = g.InOpening((i + 0.5f) / StencilGame.Bins) ? UiKit.Buds400 : UiKit.Alert500;
                }
                var x = 10 + g.Marker * (BoardW - 20);
                can.rectTransform.anchoredPosition = new Vector2(x, 205);
                mist.rectTransform.anchoredPosition = new Vector2(x, 150);
                mist.enabled = g.Holding;
                can.rectTransform.localEulerAngles = new Vector3(0, 0, g.Holding ? -12 : 0);
            };
        }

        // ---------- Surfing: balance ----------

        Action BuildBalance(BalanceGame g)
        {
            var sea = Box("Sea", board, UiKit.Rep600, UiKit.RadiusM, new Vector2(0, 66), new Vector2(BoardW, 90), new Vector2(0, 0.5f));
            var crest = UiKit.Shape("Crest", sea.GetChild(0), UiKit.Rep400, UiKit.RadiusM);
            UiKit.Stretch(crest.rectTransform, 6, 40, 6, 6);
            var rider = UiKit.Rect("Rider", board);
            UiKit.Place(rider, Vector2.zero, new Vector2(BoardW / 2, 100), new Vector2(10, 10));
            // the board icon stands upright: turned flat onto the wave
            var deck = Picture("Board", rider, UiKit.Picture("Items/deska-fala"), Vector2.zero, new Vector2(150, 150));
            deck.rectTransform.anchorMin = deck.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
            deck.rectTransform.anchoredPosition = Vector2.zero;
            deck.rectTransform.localEulerAngles = new Vector3(0, 0, 90);
            var surfer = Picture("Bud", rider, budSheet?.Get(Facing.Down, 0), Vector2.zero, new Vector2(84, 126));
            surfer.rectTransform.anchorMin = surfer.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
            surfer.rectTransform.pivot = new Vector2(0.5f, 0);
            surfer.rectTransform.anchoredPosition = new Vector2(0, 6);
            // the meter: steady band in the middle, the needle where the board leans
            var meter = Box("Meter", board, UiKit.Alert500, UiKit.RadiusS, new Vector2(BoardW / 2, 222), new Vector2(560, 26), new Vector2(0.5f, 0.5f));
            var band = UiKit.Shape("Band", meter.GetChild(0), UiKit.Buds400, 4).rectTransform;
            band.anchorMin = new Vector2(0.5f - BalanceGame.Band / 2, 0);
            band.anchorMax = new Vector2(0.5f + BalanceGame.Band / 2, 1);
            band.offsetMin = band.offsetMax = Vector2.zero;
            var needle = UiKit.Shape("Needle", meter, UiKit.Gold400, 3).rectTransform;
            var wave = UiKit.Bar("Wave", board, UiKit.TextOnDark, out var waveRoot);
            UiKit.Place(waveRoot, new Vector2(0, 0), new Vector2(BoardW / 2, 6), new Vector2(400, 14), new Vector2(0.5f, 0));
            Control("Lewo  [A]", 0, -160, 280, UiKit.Tone.Rep, 180);
            Control("Prawo  [D]", 1, 160, 280, UiKit.Tone.Rep, 0);
            keyDown = kb => Any(kb, true, Key.A, Key.LeftArrow) ? 0 : Any(kb, true, Key.D, Key.RightArrow) ? 1 : -1;
            keyUp = _ => -1;
            return () =>
            {
                var t = g.Tilt;
                // the whole rider leans with the board and drifts the way it leans; in the water it fades
                rider.localEulerAngles = new Vector3(0, 0, -t * 32);
                rider.anchoredPosition = new Vector2(BoardW / 2 + t * 70, 100 + Mathf.Sin(Time.unscaledTime * 3) * 4);
                var a = g.Pause > 0 ? 0.55f : 1f;
                deck.color = new Color(1, 1, 1, a);
                surfer.color = new Color(1, 1, 1, a);
                needle.anchorMin = needle.anchorMax = new Vector2(0.5f + t * 0.5f, 0.5f);
                needle.sizeDelta = new Vector2(12, 44);
                UiKit.SetBar(wave, g.WaveTime / BalanceGame.WaveLength);
                crest.rectTransform.offsetMax = new Vector2(-6 + Mathf.Sin(Time.unscaledTime * 2.2f) * 20, -6);
            };
        }

        // ---------- Przetrwanie: obstacle course ----------

        Action BuildRunner(RunnerGame g)
        {
            const float groundY = 40;
            const float runnerX = 150;
            var track = Box("Track", board, UiKit.Surface800, UiKit.RadiusM, Vector2.zero, new Vector2(BoardW, BoardH - 10), Vector2.zero);
            // the ground fills the track's rounded bottom, a pale line marks the running lane
            var ground = UiKit.Shape("Ground", track.GetChild(0), UiKit.Surface700, UiKit.RadiusM - UiKit.Stroke);
            ground.rectTransform.anchorMin = Vector2.zero;
            ground.rectTransform.anchorMax = new Vector2(1, 0);
            ground.rectTransform.pivot = new Vector2(0.5f, 0);
            ground.rectTransform.offsetMin = Vector2.zero;
            ground.rectTransform.offsetMax = new Vector2(0, groundY - 6);
            var lane = UiKit.Panel("Lane", track.GetChild(0), UiKit.TextOnDarkMuted);
            lane.rectTransform.anchorMin = Vector2.zero;
            lane.rectTransform.anchorMax = new Vector2(1, 0);
            lane.rectTransform.pivot = new Vector2(0.5f, 0);
            lane.rectTransform.offsetMin = new Vector2(0, groundY - 8);
            lane.rectTransform.offsetMax = new Vector2(0, groundY - 5);
            var runner = Picture("Bud", board, budSheet?.Get(Facing.Side, 0), new Vector2(runnerX, groundY), new Vector2(84, 126));
            runner.rectTransform.pivot = new Vector2(0.5f, 0);
            runner.rectTransform.localScale = new Vector3(-1, 1, 1); // side frames face left; the course runs right
            if (!runner.sprite)
            {
                runner.sprite = disc;
                runner.color = UiKit.Buds400;
                runner.enabled = true;
            }
            var items = new List<RectTransform>();
            foreach (var o in g.Obstacles)
                items.Add(o.Kind == 0
                    ? Box("Hurdle", board, UiKit.Gold400, UiKit.RadiusS, Vector2.zero, new Vector2(26, 52), new Vector2(0.5f, 0))
                    : Box("Beam", board, UiKit.Rep400, UiKit.RadiusS, Vector2.zero, new Vector2(110, 24), new Vector2(0.5f, 0)));
            Control("Skok  [W]", 0, -160, 280, UiKit.Tone.Gold, 90);
            Control("Ślizg  [S]", 1, 160, 280, UiKit.Tone.Rep, 270);
            keyDown = kb => Any(kb, true, Key.W, Key.UpArrow, Key.Space) ? 0 : Any(kb, true, Key.S, Key.DownArrow) ? 1 : -1;
            keyUp = _ => -1;
            return () =>
            {
                var jump = g.JumpLeft > 0 ? Mathf.Sin((1 - g.JumpLeft / RunnerGame.MoveTime) * Mathf.PI) * 92 : 0;
                var slide = g.SlideLeft > 0;
                var rt = runner.rectTransform;
                rt.anchoredPosition = new Vector2(runnerX, groundY + jump);
                // sliding: lying back under the beam; running: the walk frames at a run's pace
                rt.localEulerAngles = new Vector3(0, 0, slide ? -72 : 0);
                rt.anchoredPosition += slide ? new Vector2(-34, 4) : Vector2.zero;
                if (budSheet != null)
                    runner.sprite = budSheet.Get(Facing.Side, jump > 0 || slide ? 2 : 1 + (int)(g.Clock * 7) % 2);
                for (var i = 0; i < items.Count; i++)
                {
                    var o = g.Obstacles[i];
                    var ahead = o.Time - g.Clock;
                    var item = items[i];
                    var visible = ahead < RunnerGame.Lead && ahead > -0.6f;
                    item.gameObject.SetActive(visible);
                    if (!visible) continue;
                    var x = runnerX + ahead / RunnerGame.Lead * (BoardW - runnerX - 20);
                    item.anchoredPosition = new Vector2(x, o.Kind == 0 ? groundY : groundY + 70);
                    var fill = item.GetChild(0).GetComponent<Image>();
                    fill.color = o.State == -1 ? UiKit.Alert500 : o.State == 1 ? new Color(1, 1, 1, 0.5f) : o.Kind == 0 ? UiKit.Gold400 : UiKit.Rep400;
                }
            };
        }
    }

    /// <summary>Touch on a training control: down and up like a key (the stencil needs holding).</summary>
    public sealed class HoldControl : MonoBehaviour, IPointerDownHandler, IPointerUpHandler
    {
        public Action Down;
        public Action Up;

        public void OnPointerDown(PointerEventData e) => Down?.Invoke();
        public void OnPointerUp(PointerEventData e) => Up?.Invoke();
    }
}
