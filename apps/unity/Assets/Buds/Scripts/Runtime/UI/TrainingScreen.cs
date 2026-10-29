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
    /// Training at a spot: every skill is a real task in its own scene (TrainingGames.For) — Walka spars in the ring,
    /// Flow raps on stage (every note a word of the verse), Graffiti paints a mural from memory, Surfing rides out of
    /// the shark's way, Przetrwanie runs from a guard dog over barriers and under beams, Spryt follows the ball under a
    /// street hustler's cups. The bud's own sheet plays in every scene; comic words, splashes and a shake answer every
    /// move. Keys and on-screen buttons; after the last round the score goes to the server (onFinished) and the
    /// screen shows what it granted.
    /// </summary>
    public sealed class TrainingScreen
    {
        const float BoardW = 1090;
        const float BoardH = 366;
        const float BoardTop = -52;
        static Sprite disc;

        /// <summary>The spray colours of the mural (MuralGame.Paints).</summary>
        static readonly Color[] Paints =
        {
            UiKit.Buds400, UiKit.Gold400, UiKit.Rep400, UiKit.Alert500, UiKit.XpFill, UiKit.Paper100,
        };

        static readonly Color Bare = UiKit.Hex("#8b9099");

        /// <summary>Verses of the stage: four words, one per note of a phrase.</summary>
        static readonly string[][] Verses =
        {
            new[] { "Wbijam", "na", "bit,", "ziomy" },
            new[] { "Miasto", "Ziomków", "nie", "śpi" },
            new[] { "Każdy", "wers", "to", "cegła" },
            new[] { "Mikrofon", "w", "dłoni,", "lecimy" },
            new[] { "Rewir", "zna", "mój", "flow" },
            new[] { "Z", "bloku", "na", "scenę" },
            new[] { "Rymy", "lecą", "jak", "strzały" },
            new[] { "Głośniej,", "niech", "dudni", "osiedle" },
            new[] { "Flow", "płynie", "jak", "rzeka" },
            new[] { "Cały", "skwer", "śpiewa", "refren" },
        };

        readonly Func<int, Awaitable<string>> onFinished;
        readonly GameObject root;
        readonly Text title;
        readonly Text hint;
        readonly Text status;
        readonly Text result;
        readonly RectTransform board;
        readonly RectTransform controls;
        readonly Button next;
        readonly Text nextLabel;
        readonly List<Image> pips = new();
        readonly List<bool> results = new();
        readonly List<Spark> sparks = new();
        ITrainingGame game;
        /// <summary>The bud's own sheet: it plays the part in every scene.</summary>
        BudSheet budSheet;
        string kind;
        Action draw;
        Action<int> onFeedback;
        RectTransform fxLayer;
        Func<Keyboard, int> keyDown = _ => -1;
        Func<Keyboard, int> keyUp = _ => -1;
        bool busy;
        bool finished;
        /// <summary>The autopilot drives the game (BotTick); the per-frame Tick then leaves it alone.</summary>
        bool botDriven;
        int lastRound;
        int lastScore;
        float shake;

        public bool IsOpen => root.activeSelf;
        public ITrainingGame Game => game;
        public string Kind => kind;
        public bool Finished => finished;

        /// <summary>A comic word, a drop of paint or water, flying and fading on the board.</summary>
        sealed class Spark
        {
            public Image Img;
            public float Age;
            public float Life;
            public Vector2 Velocity;
            public float Spin;
            public bool Word;
        }

        public TrainingScreen(Transform canvas, Func<int, Awaitable<string>> onFinished)
        {
            this.onFinished = onFinished;
            disc ??= UiKit.Circle(32);
            var dim = UiKit.Panel("Training", canvas, new Color(0.086f, 0.094f, 0.122f, 0.6f));
            dim.raycastTarget = true;
            UiKit.Stretch(dim.rectTransform);
            root = dim.gameObject;
            var group = UiKit.Rect("Group", dim.transform);
            UiKit.Place(group, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(1200, 700));
            group.gameObject.AddComponent<FitInParent>();
            var body = UiKit.Window("Window", group, new Vector2(1160, 680), "Trening", Close, out var window, out title);
            UiKit.Place(window, new Vector2(0.5f, 0.5f), Vector2.zero, window.sizeDelta);
            title.resizeTextForBestFit = true;
            title.resizeTextMinSize = 26;
            title.resizeTextMaxSize = title.fontSize;
            title.verticalOverflow = VerticalWrapMode.Truncate;
            title.horizontalOverflow = HorizontalWrapMode.Wrap;

            hint = UiKit.Label("Hint", body, "", 22, UiKit.Ink, false, TextAnchor.UpperCenter);
            UiKit.Place(hint.rectTransform, new Vector2(0.5f, 1), new Vector2(0, 2), new Vector2(BoardW, 52), new Vector2(0.5f, 1));
            // the scene: everything in it is clipped to its frame
            var frame = UiKit.OutlinedBox("Frame", body, UiKit.Surface900, UiKit.RadiusM);
            var frameRt = (RectTransform)frame.transform.parent;
            UiKit.Place(frameRt, new Vector2(0.5f, 1), new Vector2(0, BoardTop), new Vector2(BoardW + 8, BoardH + 8), new Vector2(0.5f, 1));
            board = UiKit.Rect("Board", frame.transform);
            UiKit.Place(board, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(BoardW, BoardH));
            board.gameObject.AddComponent<RectMask2D>();
            // the verdict of the last move, over the scene's top-right corner
            status = UiKit.Outlined("Status", frameRt, "", 28);
            status.alignment = TextAnchor.UpperRight;
            status.horizontalOverflow = HorizontalWrapMode.Overflow;
            UiKit.Place(status.rectTransform, new Vector2(1, 1), new Vector2(-22, -12), new Vector2(620, 44), new Vector2(1, 1));
            result = UiKit.Label("Result", body, "", 30, UiKit.Ink, true, TextAnchor.UpperCenter);
            UiKit.Place(result.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -110), new Vector2(BoardW, 240), new Vector2(0.5f, 1));
            controls = UiKit.Rect("Controls", body);
            UiKit.Place(controls, new Vector2(0.5f, 0), new Vector2(0, 4), new Vector2(BoardW, 84), new Vector2(0.5f, 0));
            next = UiKit.Button("Next", body, "Dalej  [E]", new Vector2(300, 76), Close, UiKit.Tone.Gold, 30);
            UiKit.Place((RectTransform)next.transform, new Vector2(0.5f, 0), new Vector2(0, 8), new Vector2(300, 76), new Vector2(0.5f, 0));
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
            shake = 0;
            results.Clear();
            sparks.Clear();
            onFeedback = null;
            // the spot in the title (long names never wrap it), the skill it trains on the status line until the first verdict
            title.text = spot.name;
            hint.text = $"{spot.hint}\n<size=18><color=#55514a>{HowTo(kind)}</color></size>";
            status.text = $"<color=#a9afbd>Trenujesz:</color> {skillName}";
            result.text = "";
            Clear(board);
            Clear(controls);
            board.parent.parent.gameObject.SetActive(true);
            BuildPips(game.Rounds);
            draw = kind switch
            {
                "boxing" => BuildBoxing((BoxingGame)game),
                "rhythm" => BuildRhythm((RhythmGame)game),
                "mural" => BuildMural((MuralGame)game),
                "shark" => BuildShark((SharkGame)game),
                "runner" => BuildRunner((RunnerGame)game),
                _ => BuildShell((ShellGame)game),
            };
            fxLayer = UiKit.Rect("Fx", board);
            UiKit.Stretch(fxLayer);
            controls.gameObject.SetActive(true);
            next.gameObject.SetActive(false);
            root.SetActive(true);
            root.transform.SetAsLastSibling();
            draw();
        }

        static string HowTo(string kind) => kind switch
        {
            "boxing" => "A / D: unik w lewo / w prawo (od rękawicy), S: garda na prosty, W albo Spacja: cios, gdy rywal się odsłoni.",
            "rhythm" => "A / S / D (albo przyciski), gdy nuta mija linię. Fraza liczy się od 3 z 4 nut; tempo rośnie z rangą Flow.",
            "mural" => "Patrz, zapamiętaj kolory, potem maluj pole po polu: 1–6 kolory, Backspace cofa. Liczy się wierna kopia.",
            "shark" => "A / D albo strzałki (lub przyciski): zjedź z toru płetwy. Fala liczy się, gdy rekin nikogo nie złapie.",
            "runner" => "W: skok przez barierkę, S: ślizg pod belką. Każde zahaczenie przybliża psa.",
            _ => "Śledź kubek z kulką. Gdy cwaniak skończy mieszać: 1 / 2 / 3 / 4 albo dotknij kubka.",
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
            if (!busy) game.Tick(Mathf.Min(Time.unscaledDeltaTime, 0.1f));
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
            var f = game.TakeFeedback();
            if (f != 0)
            {
                status.text = f > 0 ? $"<color=#a3e635>{Good(kind)}</color>" : $"<color=#ff3d50>{Bad(kind)}</color>";
                onFeedback?.Invoke(f);
                if (f < 0) Core.Haptics.Tap(40);
            }
            // a round ended: its pip shows whether it counted
            while (lastRound < game.Round)
            {
                results.Add(game.Score > lastScore);
                lastScore = game.Score;
                lastRound++;
            }
            draw?.Invoke();
            TickSparks(Time.unscaledDeltaTime);
            DrawPips();
            if (game.Done && !busy) _ = Finish();
        }

        static string Good(string kind) => kind switch
        {
            "boxing" => "Czysto!",
            "rhythm" => "W punkt!",
            "mural" => "Wierna kopia!",
            "shark" => "Rekin z niczym!",
            "runner" => "Przeszkoda za tobą!",
            _ => "Jest kulka!",
        };

        static string Bad(string kind) => kind switch
        {
            "boxing" => "Oberwane",
            "rhythm" => "Poza bitem",
            "mural" => "Kolory się nie zgadzają",
            "shark" => "Rekin capnął!",
            "runner" => "Zahaczone, pies bliżej!",
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
            board.parent.parent.gameObject.SetActive(false);
            result.text = $"Wynik: {game.Score} / {game.Rounds}\n<size=22>{text}</size>";
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
            // over the scene's top-left corner
            var frame = board.parent.parent;
            for (var i = 0; i < rounds; i++)
            {
                var pip = UiKit.OutlinedBox("Pip" + i, frame, UiKit.Surface700, 999);
                UiKit.Place((RectTransform)pip.transform.parent, new Vector2(0, 1), new Vector2(22 + i * 40, -16),
                    new Vector2(28, 28), new Vector2(0, 1));
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

        /// <summary>A flat piece of the scene (no outline): sea, sky, ground, a rope.</summary>
        static Image Flat(string name, Transform parent, Color color, Vector2 pos, Vector2 size, Vector2 pivot, float radius = 0)
        {
            var img = radius > 0 ? UiKit.Shape(name, parent, color, radius) : UiKit.Panel(name, parent, color);
            img.raycastTarget = false;
            UiKit.Place(img.rectTransform, Vector2.zero, pos, size, pivot);
            return img;
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

        /// <summary>A picture standing on its bottom edge (characters, props).</summary>
        static Image Standing(string name, Transform parent, Sprite sprite, Vector2 feet, Vector2 size, Color? tint = null)
        {
            var img = Picture(name, parent, sprite, feet, size, tint);
            img.rectTransform.pivot = new Vector2(0.5f, 0);
            img.rectTransform.anchoredPosition = feet;
            return img;
        }

        static Sprite Art(string name) => UiKit.Picture("Ui/Training/" + name);

        /// <summary>An opponent's or a local's sheet from Resources/Enemies (null when missing).</summary>
        static BudSheet SheetOf(string id)
        {
            var tex = Resources.Load<Texture2D>("Enemies/" + id);
            return tex ? BudSheet.Shared(tex) : null;
        }

        Sprite Bud(Facing facing, int frame) => budSheet?.Get(facing, frame);

        static void Move(Graphic g, Vector2 pos) => g.rectTransform.anchoredPosition = pos;

        static float Smooth(float from, float to, float rate, float dt) => Mathf.Lerp(from, to, 1 - Mathf.Exp(-rate * dt));

        static void SetAlpha(Graphic g, float a)
        {
            var c = g.color;
            c.a = a;
            g.color = c;
        }

        /// <summary>A comic word bursting out at a point (Ui/Training/tr-* or Ui/Fx/fx-*).</summary>
        void Word(string picture, Vector2 at, float height, float life = 0.8f)
        {
            var sprite = picture.StartsWith("Ui/") ? UiKit.Picture(picture) : Art(picture);
            if (!sprite || !fxLayer) return;
            var img = Picture("Word", fxLayer, sprite, at, new Vector2(height * sprite.rect.width / sprite.rect.height, height));
            sparks.Add(new Spark { Img = img, Life = life, Word = true, Spin = UnityEngine.Random.Range(-8f, 8f) });
        }

        /// <summary>Drops flying out of a point and falling: water, paint, dust.</summary>
        void Splash(Color color, Vector2 at, int count, float speed = 260, float size = 14)
        {
            if (!fxLayer) return;
            for (var i = 0; i < count; i++)
            {
                var img = Picture("Drop", fxLayer, disc, at, Vector2.one * size * UnityEngine.Random.Range(0.6f, 1.3f), color);
                var dir = UnityEngine.Random.insideUnitCircle.normalized;
                sparks.Add(new Spark
                {
                    Img = img,
                    Life = UnityEngine.Random.Range(0.45f, 0.8f),
                    Velocity = dir * speed * UnityEngine.Random.Range(0.5f, 1f) + Vector2.up * 140,
                });
            }
        }

        void Shake(float amount) => shake = Mathf.Max(shake, amount);

        void TickSparks(float dt)
        {
            for (var i = sparks.Count - 1; i >= 0; i--)
            {
                var s = sparks[i];
                s.Age += dt;
                var t = s.Age / s.Life;
                if (t >= 1 || !s.Img)
                {
                    if (s.Img) UnityEngine.Object.Destroy(s.Img.gameObject);
                    sparks.RemoveAt(i);
                    continue;
                }
                var rt = s.Img.rectTransform;
                if (s.Word)
                {
                    // pops in past its size, settles, then fades
                    var scale = t < 0.15f ? Mathf.Lerp(0.3f, 1.15f, t / 0.15f) : t < 0.25f ? Mathf.Lerp(1.15f, 1, (t - 0.15f) / 0.1f) : 1;
                    rt.localScale = Vector3.one * scale;
                    rt.localEulerAngles = new Vector3(0, 0, s.Spin);
                    SetAlpha(s.Img, t > 0.7f ? 1 - (t - 0.7f) / 0.3f : 1);
                }
                else
                {
                    rt.anchoredPosition += s.Velocity * dt;
                    s.Velocity.y -= 900 * dt;
                    SetAlpha(s.Img, 1 - t * t);
                }
            }
            // the whole scene shakes on a hit, briefly
            shake = Mathf.Max(0, shake - 70 * dt);
            board.anchoredPosition = shake > 0 ? UnityEngine.Random.insideUnitCircle * shake : Vector2.zero;
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

        static bool Any(Keyboard kb, bool pressed, params Key[] keys)
        {
            foreach (var k in keys)
                if (pressed ? kb[k].wasPressedThisFrame : kb[k].wasReleasedThisFrame)
                    return true;
            return false;
        }

        // ---------- Surfing: out of the shark's way ----------

        Action BuildShark(SharkGame g)
        {
            const float laneW = 150;
            const float riderY = 70;
            const float flow = 250; // how fast the water streams past, px/s
            var x0 = (BoardW - laneW * SharkGame.Lanes) / 2;
            float LaneX(float lane) => x0 + laneW * (lane + 0.5f);

            Flat("Sea", board, UiKit.Rep600, Vector2.zero, new Vector2(BoardW, BoardH), Vector2.zero);
            var danger = new Image[SharkGame.Lanes];
            for (var l = 0; l < danger.Length; l++)
                danger[l] = Flat("Danger" + l, board, new Color(1, 0.24f, 0.31f, 0), new Vector2(x0 + laneW * l, 0), new Vector2(laneW, BoardH), Vector2.zero);
            // foam streaks and the beaches with their palms stream past: the board is moving
            var rnd = new System.Random(5);
            var foam = new List<Image>();
            for (var i = 0; i < 18; i++)
                foam.Add(Flat("Foam", board, new Color(1, 1, 1, 0.22f),
                    new Vector2(x0 + (float)rnd.NextDouble() * laneW * SharkGame.Lanes, (float)rnd.NextDouble() * BoardH),
                    new Vector2(8 + (float)rnd.NextDouble() * 10, 40 + (float)rnd.NextDouble() * 70), new Vector2(0.5f, 0.5f), 6));
            var palms = new List<Image>();
            for (var side = 0; side < 2; side++)
            {
                var sx = side == 0 ? 0 : BoardW - x0 + 14;
                Flat("Sand", board, UiKit.Hex("#e9d3a1"), new Vector2(sx, 0), new Vector2(x0 - 14, BoardH), Vector2.zero);
                Flat("Shore", board, new Color(1, 1, 1, 0.85f), new Vector2(side == 0 ? x0 - 20 : BoardW - x0 + 8, 0), new Vector2(12, BoardH), Vector2.zero);
                for (var i = 0; i < 3; i++)
                    palms.Add(Standing("Palm", board, UiKit.Picture("World/palm-" + (char)('a' + (i + side) % 3)),
                        new Vector2(side == 0 ? x0 / 2 - 10 : BoardW - x0 / 2 + 10, i * 160 - 40), new Vector2(130, 160)));
            }
            var fins = new List<Image>();
            var turns = new List<Text>();
            foreach (var s in g.Sharks)
            {
                var fin = Picture("Fin", board, Art("tr-pletwa"), Vector2.zero, new Vector2(150, 118));
                fin.enabled = false;
                var turn = UiKit.Outlined("Turn", fin.transform, "!", 44, UiKit.Alert500);
                UiKit.Place(turn.rectTransform, new Vector2(0.5f, 1), new Vector2(0, 40), new Vector2(60, 50));
                turn.enabled = false;
                fins.Add(fin);
                turns.Add(turn);
            }
            var rider = UiKit.Rect("Rider", board);
            UiKit.Place(rider, Vector2.zero, new Vector2(LaneX(g.Lane), riderY), Vector2.zero);
            Flat("Wake", rider, new Color(1, 1, 1, 0.7f), new Vector2(0, -60), new Vector2(36, 100), new Vector2(0.5f, 0.5f), 18);
            var deck = Picture("Board", rider, Art("tr-deska"), Vector2.zero, new Vector2(56, 150));
            var surfer = Standing("Bud", rider, Bud(Facing.Up, 0), new Vector2(0, -26), new Vector2(96, 144));
            var jaws = Standing("Jaws", board, Art("tr-rekin"), Vector2.zero, new Vector2(240, 230));
            jaws.enabled = false;
            var seen = new int[g.Sharks.Count];
            var riderX = LaneX(g.Lane);
            var jawsT = -1f;

            Control("Lewo  [A]", 0, -170, 300, UiKit.Tone.Rep, 180);
            Control("Prawo  [D]", 1, 170, 300, UiKit.Tone.Rep, 0);
            keyDown = kb => Any(kb, true, Key.A, Key.LeftArrow) ? 0 : Any(kb, true, Key.D, Key.RightArrow) ? 1 : -1;
            keyUp = _ => -1;
            return () =>
            {
                var dt = Time.unscaledDeltaTime;
                foreach (var f in foam)
                {
                    var p = f.rectTransform.anchoredPosition;
                    p.y -= flow * dt;
                    if (p.y < -60) p.y += BoardH + 120;
                    f.rectTransform.anchoredPosition = p;
                }
                foreach (var palm in palms)
                {
                    var p = palm.rectTransform.anchoredPosition;
                    p.y -= flow * 0.8f * dt;
                    if (p.y < -170) p.y += 480;
                    palm.rectTransform.anchoredPosition = p;
                }
                // the rider glides to its lane and leans into the turn
                var before = riderX;
                riderX = Smooth(riderX, LaneX(g.Lane), 16, dt);
                var vx = dt > 0 ? (riderX - before) / dt : 0;
                rider.anchoredPosition = new Vector2(riderX, riderY + Mathf.Sin(Time.unscaledTime * 3) * 4);
                rider.localEulerAngles = new Vector3(0, 0, Mathf.Clamp(-vx * 0.02f, -18, 18));
                foreach (var d in danger) SetAlpha(d, 0);
                for (var i = 0; i < fins.Count; i++)
                {
                    var s = g.Sharks[i];
                    var ahead = s.Time - g.Clock;
                    if (s.State != seen[i])
                    {
                        seen[i] = s.State;
                        if (s.State < 0)
                        {
                            jawsT = 0;
                            Word("tr-champ", new Vector2(riderX, riderY + 210), 120);
                            Splash(Color.white, new Vector2(riderX, riderY + 30), 18);
                            Shake(18);
                        }
                        else Splash(new Color(1, 1, 1, 0.9f), new Vector2(LaneX(s.Lane), riderY + 30), 8, 200, 12);
                    }
                    var visible = s.Lane >= 0 && s.State >= 0 && ahead < SharkGame.Lead && ahead > -0.6f;
                    fins[i].enabled = visible;
                    turns[i].enabled = visible && s.Turned && ahead > 0;
                    if (!visible) continue;
                    var x = LaneX(s.Lane);
                    if (s.Turned && s.From != s.Lane)
                        x = Mathf.Lerp(LaneX(s.From), x, Mathf.SmoothStep(0, 1, (SharkGame.TurnAt - ahead) / 0.3f));
                    Move(fins[i], new Vector2(x, riderY + 30 + ahead / SharkGame.Lead * (BoardH - riderY)));
                    fins[i].color = s.Hunter ? new Color(1, 0.82f, 0.82f) : Color.white;
                    if (s.State == 0 && ahead > 0 && ahead < 1)
                        SetAlpha(danger[s.Lane], Mathf.Max(danger[s.Lane].color.a, 0.24f * (1 - ahead)));
                }
                // a bite: the shark leaps out under the board
                if (jawsT >= 0)
                {
                    jawsT += dt;
                    var t = jawsT / 0.9f;
                    jaws.enabled = t < 1;
                    Move(jaws, new Vector2(riderX, riderY - 90 + Mathf.Sin(Mathf.Min(1, t) * Mathf.PI) * 150));
                    if (t >= 1) jawsT = -1;
                }
                var a = jawsT >= 0 ? 0.45f : 1;
                SetAlpha(surfer, a);
                SetAlpha(deck, a);
            };
        }

        // ---------- Walka: sparring in the ring ----------

        Action BuildBoxing(BoxingGame g)
        {
            var cx = BoardW / 2;
            const float footY = 128;
            Picture("Crowd", board, Art("tr-tlum"), new Vector2(cx, BoardH - 70), new Vector2(1120, 190), UiKit.Surface700);
            Flat("Floor", board, UiKit.Hex("#1f5f8f"), Vector2.zero, new Vector2(BoardW, footY + 20), Vector2.zero);
            Flat("Apron", board, UiKit.Rep600, new Vector2(0, footY + 14), new Vector2(BoardW, 10), Vector2.zero);
            // the back ropes between two corner posts
            Color[] ropes = { UiKit.Alert500, UiKit.Paper100, UiKit.Rep400 };
            for (var i = 0; i < 3; i++)
                Flat("Rope", board, ropes[i], new Vector2(170, footY + 70 + i * 34), new Vector2(BoardW - 340, 8), new Vector2(0, 0.5f), 4);
            Box("PostL", board, UiKit.Surface700, UiKit.RadiusS, new Vector2(170, footY + 10), new Vector2(26, 150), new Vector2(0.5f, 0));
            Box("PostR", board, UiKit.Surface700, UiKit.RadiusS, new Vector2(BoardW - 170, footY + 10), new Vector2(26, 150), new Vector2(0.5f, 0));
            var foeSheet = SheetOf("bokser-z-ringu");
            var foe = Standing("Foe", board, foeSheet?.Get(Facing.Down, 0), new Vector2(cx, footY), new Vector2(170, 255));
            var glove = Art("tr-rekawica");
            // the partner's gloves: fists towards the bud (down), the one on the screen's right mirrored
            var foeL = Picture("FoeGloveL", board, glove, Vector2.zero, new Vector2(86, 70));
            var foeR = Picture("FoeGloveR", board, glove, Vector2.zero, new Vector2(86, 70));
            var target = Picture("Target", board, UiKit.Ring(64, 8), Vector2.zero, new Vector2(96, 96), UiKit.Gold400);
            var warn = UiKit.Outlined("Warn", board, "!", 54, UiKit.Alert500);
            UiKit.Place(warn.rectTransform, Vector2.zero, Vector2.zero, new Vector2(60, 60));
            var foeBar = UiKit.Bar("FoeBar", board, UiKit.Alert500, out var foeBarRoot);
            UiKit.Place(foeBarRoot, Vector2.zero, new Vector2(cx, BoardH - 30), new Vector2(320, 22), new Vector2(0.5f, 0.5f));
            // the bud, seen from behind over its shoulder, its gloves up
            const float meY = -40;
            var meHome = cx - 170;
            var me = UiKit.Rect("Me", board);
            UiKit.Place(me, Vector2.zero, new Vector2(meHome, meY), Vector2.zero);
            Standing("Bud", me, Bud(Facing.Up, 0), Vector2.zero, new Vector2(200, 300));
            var myL = Picture("GloveL", me, glove, Vector2.zero, new Vector2(94, 76));
            var myR = Picture("GloveR", me, glove, Vector2.zero, new Vector2(94, 76));
            var hurt = Flat("Hurt", board, new Color(1, 0.24f, 0.31f, 0), Vector2.zero, new Vector2(BoardW, BoardH), Vector2.zero);
            var seen = new int[g.Moves.Count];
            float meX = 0, foeHurt = 0, hurtFlash = 0;

            Control("Unik", BoxingGame.DodgeLeft, -400, 230, UiKit.Tone.Rep, 180);
            Control("Garda  [S]", BoxingGame.Guard, -140, 250, UiKit.Tone.Rep);
            Control("Unik", BoxingGame.DodgeRight, 125, 230, UiKit.Tone.Rep, 0);
            Control("Cios  [W]", BoxingGame.Punch, 395, 250, UiKit.Tone.Gold);
            keyDown = kb => Any(kb, true, Key.A, Key.LeftArrow) ? BoxingGame.DodgeLeft
                : Any(kb, true, Key.S, Key.DownArrow) ? BoxingGame.Guard
                : Any(kb, true, Key.D, Key.RightArrow) ? BoxingGame.DodgeRight
                : Any(kb, true, Key.W, Key.UpArrow, Key.Space) ? BoxingGame.Punch : -1;
            keyUp = _ => -1;

            void PlaceGlove(Image img, Vector2 pos, float angle, bool mirror, float scale)
            {
                img.rectTransform.anchoredPosition = pos;
                img.rectTransform.localEulerAngles = new Vector3(0, 0, angle);
                img.rectTransform.localScale = new Vector3(mirror ? -scale : scale, scale, 1);
            }

            return () =>
            {
                var dt = Time.unscaledDeltaTime;
                var time = Time.unscaledTime;
                // the bud: dodges sway the whole body, the guard pulls the gloves in front of the face
                var acting = g.ActionLeft > 0 ? g.Action : -1;
                meX = Smooth(meX, acting == BoxingGame.DodgeLeft ? -190 : acting == BoxingGame.DodgeRight ? 190 : 0, 18, dt);
                me.anchoredPosition = new Vector2(meHome + meX, meY + Mathf.Sin(time * 5) * 3);
                me.localEulerAngles = new Vector3(0, 0, -meX * 0.06f);
                if (acting == BoxingGame.Guard)
                {
                    PlaceGlove(myL, new Vector2(-32, 196), 90, false, 1.2f);
                    PlaceGlove(myR, new Vector2(32, 196), 90, true, 1.2f);
                }
                else
                {
                    PlaceGlove(myL, new Vector2(-76, 150), 70, false, 1);
                    // a punch: the right glove flies to the partner's chin
                    var k = acting == BoxingGame.Punch ? Mathf.Sin((1 - g.ActionLeft / BoxingGame.PunchTime) * Mathf.PI) : 0;
                    var chin = new Vector2(cx, footY + 190) - me.anchoredPosition;
                    PlaceGlove(myR, Vector2.Lerp(new Vector2(76, 150), chin, k), Mathf.Lerp(110, 90, k), true, Mathf.Lerp(1, 0.6f, k));
                }
                // the partner: bobs, winds up, drops the guard when it opens up, flinches when hit
                foeHurt = Mathf.Max(0, foeHurt - dt * 3);
                hurtFlash = Mathf.Max(0, hurtFlash - dt * 2.5f);
                var m = g.Coming;
                var bob = Mathf.Sin(time * 4.5f) * 4;
                var lean = 0f;
                Vector2 gl = new(cx - 56, footY + 150), gr = new(cx + 56, footY + 150);
                float sl = 1, sr = 1;
                warn.enabled = false;
                target.enabled = false;
                if (m != null && m.Need != BoxingGame.Punch)
                {
                    var k = Mathf.Clamp01(1 - (m.Time - g.Clock) / m.Windup);
                    warn.enabled = true;
                    warn.rectTransform.localScale = Vector3.one * (1 + 0.25f * Mathf.Sin(time * 20));
                    if (m.Need == BoxingGame.Guard)
                    {
                        // a straight comes right at the bud
                        gr = Vector2.Lerp(gr, new Vector2(cx - 60, footY + 110), k);
                        sr = 1 + k * 1.1f;
                        Move(warn, new Vector2(cx, footY + 270));
                    }
                    else
                    {
                        // a hook swings in from the side the bud must get away from
                        var side = m.Need == BoxingGame.DodgeLeft ? 1 : -1;
                        lean = side * 10 * k;
                        var wind = new Vector2(cx + side * 170, footY + 130);
                        if (side > 0)
                        {
                            gr = Vector2.Lerp(gr, wind, k);
                            sr = 1 + k * 0.7f;
                        }
                        else
                        {
                            gl = Vector2.Lerp(gl, wind, k);
                            sl = 1 + k * 0.7f;
                        }
                        Move(warn, wind + new Vector2(0, 70));
                    }
                }
                else if (m != null)
                {
                    // the guard drops: a gold target on the chin
                    gl = new Vector2(cx - 80, footY + 90);
                    gr = new Vector2(cx + 80, footY + 90);
                    target.enabled = true;
                    Move(target, new Vector2(cx, footY + 190));
                    target.rectTransform.localScale = Vector3.one * (1 + 0.15f * Mathf.Sin(time * 16));
                }
                Move(foe, new Vector2(cx + lean * 3 + foeHurt * 14, footY + bob + foeHurt * 10));
                foe.rectTransform.localEulerAngles = new Vector3(0, 0, -lean + foeHurt * 12);
                foe.color = Color.Lerp(Color.white, new Color(1, 0.55f, 0.55f), foeHurt);
                PlaceGlove(foeL, gl + new Vector2(0, bob), -90, false, sl);
                PlaceGlove(foeR, gr + new Vector2(0, bob), -90, true, sr);
                SetAlpha(hurt, hurtFlash * 0.4f);
                UiKit.SetBar(foeBar, 1 - g.Counters / (float)Mathf.Max(1, g.Openings));
                for (var i = 0; i < seen.Length; i++)
                {
                    var mv = g.Moves[i];
                    if (mv.State == seen[i]) continue;
                    seen[i] = mv.State;
                    if (mv.Need == BoxingGame.Punch)
                    {
                        if (mv.State < 0) continue;
                        Word("Ui/Fx/fx-bam", new Vector2(cx + 150, footY + 170), 110);
                        Splash(UiKit.Gold400, new Vector2(cx, footY + 190), 10);
                        foeHurt = 1;
                        Shake(6);
                    }
                    else if (mv.State > 0)
                        Word(mv.Need == BoxingGame.Guard ? "tr-blok" : "tr-unik",
                            new Vector2(meHome + (mv.Need == BoxingGame.DodgeLeft ? -250 : mv.Need == BoxingGame.DodgeRight ? 250 : 0), 120), 92);
                    else
                    {
                        Word("Ui/Fx/fx-pac", new Vector2(meHome + meX, 150), 130);
                        Shake(16);
                        hurtFlash = 1;
                    }
                }
            };
        }

        // ---------- Graffiti: a mural from memory ----------

        [Serializable]
        sealed class MuralAims
        {
            public MuralAim[] murals;
        }

        [Serializable]
        sealed class MuralAim
        {
            public string id;
            public Vector2[] aims;
        }

        static Dictionary<string, Vector2[]> aimsById;

        /// <summary>Where the can aims on every field of a mural (from the top-left, murals.json by export-art.ts).</summary>
        static Vector2[] AimsOf(string id)
        {
            if (aimsById == null)
            {
                aimsById = new Dictionary<string, Vector2[]>();
                var json = Resources.Load<TextAsset>("Ui/Training/murals");
                if (json)
                    foreach (var m in JsonUtility.FromJson<MuralAims>(json.text).murals)
                        aimsById[m.id] = m.aims;
            }
            return aimsById.TryGetValue(id, out var aims) ? aims : Array.Empty<Vector2>();
        }

        Action BuildMural(MuralGame g)
        {
            const float mw = 480, mh = 240, my = 76;
            const float aimScale = mw / 520;
            var mx = BoardW / 2 - mw / 2;
            // a brick wall over the pavement
            Flat("Wall", board, UiKit.Hex("#5a3f36"), Vector2.zero, new Vector2(BoardW, BoardH), Vector2.zero);
            for (var row = 0; row * 30 < BoardH; row++)
            {
                Flat("Joint", board, UiKit.Hex("#46302a"), new Vector2(0, row * 30), new Vector2(BoardW, 4), Vector2.zero);
                for (var x = row % 2 * 45f; x < BoardW; x += 90)
                    Flat("Joint", board, UiKit.Hex("#46302a"), new Vector2(x, row * 30), new Vector2(4, 30), Vector2.zero);
            }
            Flat("Pavement", board, UiKit.Surface800, Vector2.zero, new Vector2(BoardW, 30), Vector2.zero);
            var mural = UiKit.Rect("Mural", board);
            UiKit.Place(mural, Vector2.zero, new Vector2(mx, my), new Vector2(mw, mh), Vector2.zero);
            // the original, small in the corner, while the copy is judged
            var model = Box("Model", board, UiKit.Paper100, UiKit.RadiusS, new Vector2(BoardW - 18, BoardH - 60), new Vector2(196, 104), new Vector2(1, 1));
            var modelArt = UiKit.Rect("Art", model.GetChild(0));
            UiKit.Stretch(modelArt, 4);
            var modelLabel = UiKit.Outlined("Label", model, "Wzór", 20);
            UiKit.Place(modelLabel.rectTransform, new Vector2(0.5f, 0), new Vector2(0, -26), new Vector2(160, 26));
            var fields = new List<Image>();
            var modelFields = new List<Image>();
            var phase = UiKit.Outlined("Phase", board, "", 34);
            UiKit.Place(phase.rectTransform, Vector2.zero, new Vector2(BoardW / 2, BoardH - 24), new Vector2(500, 40));
            phase.fontSize = 30;
            var clock = UiKit.Bar("Clock", board, UiKit.Gold400, out var clockRoot);
            UiKit.Place(clockRoot, Vector2.zero, new Vector2(BoardW / 2, my - 22), new Vector2(380, 18), new Vector2(0.5f, 0.5f));
            var bud = Standing("Bud", board, Bud(Facing.Up, 0), new Vector2(BoardW / 2, -14), new Vector2(92, 138));
            var can = Picture("Can", board, UiKit.Picture("Items/spray-zwykly"), new Vector2(BoardW / 2, 120), new Vector2(64, 64));
            var mist = Picture("Mist", board, disc, Vector2.zero, new Vector2(54, 54));
            mist.enabled = false;
            var shown = -1;
            var shownCurrent = 0;
            var canPos = new Vector2(BoardW / 2, 120);
            var budX = BoardW / 2;
            var mistT = 0f;
            Vector2[] aims = Array.Empty<Vector2>();
            Vector2 AimAt(int field) => field < aims.Length
                ? new Vector2(mx + aims[field].x * aimScale, my + mh - aims[field].y * aimScale)
                : new Vector2(BoardW / 2, my + mh / 2);

            for (var c = 0; c < MuralGame.Paints; c++)
            {
                var swatch = Control("", c, -440 + c * 128, 112, UiKit.Tone.Rep);
                var face = swatch.transform.Find("Face") ?? swatch.transform;
                var dot = Picture("Paint", face, disc, new Vector2(56, 41), new Vector2(52, 52), Paints[c]);
                dot.gameObject.AddComponent<RoundStroke>().Width = 3;
                var key = UiKit.Outlined("Key", face, (c + 1).ToString(), 18);
                UiKit.Place(key.rectTransform, Vector2.zero, new Vector2(98, 62), new Vector2(24, 24));
            }
            Control("Cofnij", MuralGame.Undo, 400, 190, UiKit.Tone.Alert);
            keyDown = kb =>
            {
                for (var c = 0; c < MuralGame.Paints; c++)
                    if (kb[Key.Digit1 + c].wasPressedThisFrame || kb[Key.Numpad1 + c].wasPressedThisFrame)
                        return c;
                return Any(kb, true, Key.Backspace, Key.Z) ? MuralGame.Undo : -1;
            };
            keyUp = _ => -1;
            onFeedback = f =>
            {
                if (f > 0) Word("tr-jest", new Vector2(BoardW / 2, my + mh / 2), 130, 1.1f);
            };

            return () =>
            {
                var dt = Time.unscaledDeltaTime;
                var time = Time.unscaledTime;
                if (shown != g.Template)
                {
                    // a new mural: its fields stacked in order, on the wall and in the corner
                    shown = g.Template;
                    shownCurrent = 0;
                    Clear(mural);
                    Clear(modelArt);
                    fields.Clear();
                    modelFields.Clear();
                    var id = MuralGame.Templates[shown].id;
                    aims = AimsOf(id);
                    for (var i = 0; i < g.Target.Length; i++)
                    {
                        var sprite = UiKit.Picture($"Ui/Training/Murals/{id}-{i}");
                        var img = Picture("Field" + i, mural, sprite, new Vector2(mw / 2, mh / 2), new Vector2(mw, mh));
                        img.preserveAspect = false;
                        fields.Add(img);
                        var small = UiKit.Rect("Field" + i, modelArt).gameObject.AddComponent<Image>();
                        small.sprite = sprite;
                        small.raycastTarget = false;
                        UiKit.Stretch(small.rectTransform);
                        modelFields.Add(small);
                    }
                }
                var look = g.Phase == MuralGame.Stage.Look;
                var paint = g.Phase == MuralGame.Stage.Paint;
                var reveal = g.Phase == MuralGame.Stage.Reveal;
                for (var i = 0; i < fields.Count; i++)
                {
                    Color c;
                    if (look) c = Paints[g.Target[i]];
                    else if (g.Painted[i] >= 0)
                        // judged: a wrong field blinks between its colour and the right one
                        c = reveal && g.Painted[i] != g.Target[i] && Mathf.Sin(time * 14) > 0 ? Paints[g.Target[i]] : Paints[g.Painted[i]];
                    else c = paint && i == g.Current ? Color.Lerp(Bare, Color.white, 0.3f + 0.3f * Mathf.Sin(time * 8)) : Bare;
                    fields[i].color = c;
                    modelFields[i].color = Paints[g.Target[i]];
                }
                model.gameObject.SetActive(reveal);
                phase.text = look ? "ZAPAMIĘTAJ!" : paint ? "MALUJ!" : g.LastMistakes == 0 ? "" : $"Błędy: {g.LastMistakes}";
                UiKit.SetBar(clock, reveal ? 0 : g.PhaseLeft / Mathf.Max(0.01f, g.PhaseTime));
                // a field sprayed: paint bursts on it
                if (g.Current != shownCurrent)
                {
                    if (g.Current > shownCurrent)
                    {
                        var at = AimAt(g.Current - 1);
                        Splash(Paints[g.Painted[g.Current - 1]], at, 14, 220, 16);
                        mistT = 0.3f;
                        mist.color = Paints[g.Painted[g.Current - 1]];
                    }
                    shownCurrent = g.Current;
                }
                var aim = AimAt(Mathf.Min(paint ? g.Current : Mathf.Max(0, g.Current - 1), fields.Count - 1));
                canPos = Vector2.Lerp(canPos, aim + new Vector2(46, -40), 1 - Mathf.Exp(-14 * dt));
                Move(can, canPos);
                can.rectTransform.localEulerAngles = new Vector3(0, 0, mistT > 0 ? 18 : 0);
                mistT = Mathf.Max(0, mistT - dt);
                mist.enabled = mistT > 0;
                Move(mist, canPos + new Vector2(-34, 22));
                budX = Smooth(budX, Mathf.Clamp(aim.x + 40, 80, BoardW - 80), 6, dt);
                Move(bud, new Vector2(budX, -14));
                bud.sprite = Bud(Facing.Up, Mathf.Abs(budX - (aim.x + 40)) > 8 ? 1 + (int)(time * 6) % 2 : 0);
            };
        }

        // ---------- Spryt: the street hustler's cups ----------

        Action BuildShell(ShellGame g)
        {
            var cx = BoardW / 2;
            const float tableY = 124, spacing = 190;
            float SlotX(int slot) => cx + (slot - (g.Cups - 1) / 2f) * spacing;
            Flat("Sky", board, UiKit.Hex("#3b4256"), Vector2.zero, new Vector2(BoardW, BoardH), Vector2.zero);
            Picture("City", board, Art("tr-miasto"), new Vector2(cx, BoardH - 120), new Vector2(1280, 210), UiKit.Hex("#2a2f40"));
            Flat("Pavement", board, UiKit.Surface800, Vector2.zero, new Vector2(BoardW, 90), Vector2.zero);
            var hustler = Standing("Hustler", board, SheetOf("typ-spod-bloku")?.Get(Facing.Down, 0), new Vector2(cx, tableY - 40), new Vector2(180, 270));
            Box("Crate", board, UiKit.Hex("#c48a52"), UiKit.RadiusS, new Vector2(cx, 14), new Vector2(820, tableY - 14), new Vector2(0.5f, 0));
            Flat("Cloth", board, UiKit.Buds600, new Vector2(cx, tableY - 18), new Vector2(840, 26), new Vector2(0.5f, 0), 8);
            var ball = Picture("Ball", board, Art("tr-kulka"), Vector2.zero, new Vector2(40, 40));
            var cups = new Image[4];
            for (var c = 0; c < cups.Length; c++)
            {
                var cup = Standing("Cup" + c, board, Art("tr-kubek"), Vector2.zero, new Vector2(88, 104));
                cup.raycastTarget = true;
                var id = c;
                cup.gameObject.AddComponent<HoldControl>().Down = () => Press(g.SlotOf[id]);
                cups[c] = cup;
            }
            var picks = new Button[4];
            for (var s = 0; s < picks.Length; s++) picks[s] = Control((s + 1).ToString(), s, 0, 150, UiKit.Tone.Rep);
            keyDown = kb =>
            {
                for (var s = 0; s < 4; s++)
                    if (kb[Key.Digit1 + s].wasPressedThisFrame || kb[Key.Numpad1 + s].wasPressedThisFrame)
                        return s;
                return Any(kb, true, Key.A) ? 0 : Any(kb, true, Key.S) ? 1 : Any(kb, true, Key.D) ? 2 : Any(kb, true, Key.F) ? 3 : -1;
            };
            keyUp = _ => -1;
            onFeedback = f =>
            {
                Word(f > 0 ? "tr-jest" : "tr-pudlo", new Vector2(cx, 290), 110, 1);
                if (f > 0) Splash(UiKit.Gold400, new Vector2(SlotX(g.Picked), tableY + 60), 12);
            };

            return () =>
            {
                var time = Time.unscaledTime;
                var swap = g.Phase == ShellGame.Stage.Shuffle && g.SwapIndex < g.Swaps.Length ? g.Swaps[g.SwapIndex] : (a: -1, b: -1);
                var p = Mathf.SmoothStep(0, 1, g.SwapProgress);
                // the hustler's hands are busy while shuffling
                Move(hustler, new Vector2(cx + (swap.a >= 0 ? Mathf.Sin(time * 18) * 6 : 0), tableY - 40 + Mathf.Sin(time * 3) * 2));
                var revealUp = g.Phase == ShellGame.Stage.Reveal ? Mathf.Min(1, (ShellGame.RevealTime - g.PhaseLeft) * 5) : 0;
                var showUp = g.Phase == ShellGame.Stage.Show ? Mathf.Sin((1 - g.PhaseLeft / ShellGame.ShowTime) * Mathf.PI) : 0;
                var ballUp = false;
                for (var c = 0; c < cups.Length; c++)
                {
                    var on = c < g.Cups;
                    cups[c].gameObject.SetActive(on);
                    if (!on) continue;
                    var slot = g.SlotOf[c];
                    var x = SlotX(slot);
                    var y = tableY;
                    var scale = 1f;
                    if (slot == swap.a)
                    {
                        // one cup arcs over the front, the other slips behind
                        x = Mathf.Lerp(SlotX(swap.a), SlotX(swap.b), p);
                        y -= Mathf.Sin(p * Mathf.PI) * 14;
                        scale = 1 + Mathf.Sin(p * Mathf.PI) * 0.08f;
                    }
                    else if (slot == swap.b)
                    {
                        x = Mathf.Lerp(SlotX(swap.b), SlotX(swap.a), p);
                        y += Mathf.Sin(p * Mathf.PI) * 22;
                        scale = 1 - Mathf.Sin(p * Mathf.PI) * 0.1f;
                    }
                    var lift = c == g.Ball ? showUp * 90 : 0;
                    if (revealUp > 0 && (c == g.Ball || g.Picked >= 0 && c == g.CupAt(g.Picked)))
                        lift = revealUp * 90;
                    if (g.Phase == ShellGame.Stage.Pick) y += Mathf.Abs(Mathf.Sin(time * 3 + c)) * 3;
                    Move(cups[c], new Vector2(x, y + lift));
                    cups[c].rectTransform.localScale = Vector3.one * scale;
                    cups[c].color = g.Phase == ShellGame.Stage.Reveal && g.Picked >= 0 && c == g.CupAt(g.Picked) && !g.LastHit
                        ? new Color(1, 0.7f, 0.7f) : Color.white;
                    if (c == g.Ball)
                    {
                        Move(ball, new Vector2(x, tableY + 18));
                        ballUp = lift > 20;
                    }
                }
                ball.enabled = ballUp;
                for (var s = 0; s < picks.Length; s++)
                {
                    picks[s].gameObject.SetActive(s < g.Cups);
                    ((RectTransform)picks[s].transform).anchoredPosition = new Vector2(SlotX(s) - cx, 0);
                    picks[s].interactable = g.Phase == ShellGame.Stage.Pick;
                }
            };
        }

        // ---------- Flow: on stage ----------

        Action BuildRhythm(RhythmGame g)
        {
            Color[] tones = { UiKit.Buds400, UiKit.Rep400, UiKit.Gold400 };
            string[] keys = { "A", "S", "D" };
            const float stageW = 620, laneW = 130, gap = 14, hitY = 70;
            var hwX = stageW + 30;
            float LaneX(int lane) => hwX + lane * (laneW + gap) + laneW / 2;
            var mid = stageW / 2;
            // the stage: lights, speakers, the bud with the mic, the crowd in front
            Flat("Backdrop", board, UiKit.Hex("#1c1530"), Vector2.zero, new Vector2(stageW + 14, BoardH), Vector2.zero);
            var lights = new List<Image>();
            for (var i = 0; i < 3; i++)
            {
                var beam = Flat("Light", board, new Color(1, 0.95f, 0.7f, 0.08f), new Vector2(110 + i * 200, BoardH + 20), new Vector2(150, 520), new Vector2(0.5f, 1));
                lights.Add(beam);
            }
            Flat("Floor", board, UiKit.Surface700, Vector2.zero, new Vector2(stageW + 14, 48), Vector2.zero);
            Flat("Edge", board, UiKit.Buds400, new Vector2(0, 48), new Vector2(stageW + 14, 4), Vector2.zero);
            var speakers = new[]
            {
                Standing("SpeakerL", board, Art("tr-glosnik"), new Vector2(76, 46), new Vector2(110, 162)),
                Standing("SpeakerR", board, Art("tr-glosnik"), new Vector2(stageW - 76, 46), new Vector2(110, 162)),
            };
            var bud = Standing("Bud", board, Bud(Facing.Down, 0), new Vector2(mid, 46), new Vector2(136, 204));
            var mic = Picture("Mic", board, Art("tr-mikrofon"), new Vector2(mid + 40, 140), new Vector2(34, 82));
            mic.rectTransform.localEulerAngles = new Vector3(0, 0, 28);
            var crowd = Standing("Crowd", board, Art("tr-tlum"), new Vector2(mid, -60), new Vector2(stageW + 120, 150), UiKit.Hex("#0b0c10"));
            var verse = UiKit.Outlined("Verse", board, "", 32);
            UiKit.Place(verse.rectTransform, Vector2.zero, new Vector2(mid, BoardH - 64), new Vector2(stageW - 20, 46));
            // the note highway: three lanes falling to the line
            var laneFlash = new Image[RhythmGame.Lanes];
            for (var l = 0; l < RhythmGame.Lanes; l++)
            {
                Box("Lane" + l, board, UiKit.Surface800, UiKit.RadiusM, new Vector2(hwX + l * (laneW + gap), 8), new Vector2(laneW, BoardH - 16), Vector2.zero);
                Picture("Zone", board, disc, new Vector2(LaneX(l), hitY), new Vector2(76, 76), new Color(tones[l].r, tones[l].g, tones[l].b, 0.3f));
                var key = UiKit.Outlined("Key", board, keys[l], 26, tones[l]);
                UiKit.Place(key.rectTransform, Vector2.zero, new Vector2(LaneX(l), hitY - 52), new Vector2(40, 30));
                laneFlash[l] = Picture("Flash", board, disc, new Vector2(LaneX(l), hitY), new Vector2(88, 88), new Color(1, 1, 1, 0));
            }
            Flat("HitLine", board, UiKit.TextOnDark, new Vector2(hwX - 6, hitY - 3), new Vector2(3 * laneW + 2 * gap + 12, 6), Vector2.zero);
            var noteImages = new List<Image>();
            foreach (var n in g.Notes)
            {
                var img = Picture("Note", board, disc, Vector2.zero, new Vector2(58, 58), tones[n.Lane]);
                // an even ink ring round the note (a round stroke, not four shifted copies)
                img.gameObject.AddComponent<RoundStroke>().Width = 3;
                noteImages.Add(img);
            }
            var verseOffset = UnityEngine.Random.Range(0, Verses.Length);
            for (var l = 0; l < RhythmGame.Lanes; l++)
                Control(keys[l], l, (l - 1) * 260, 240, l == 0 ? UiKit.Tone.Buds : l == 1 ? UiKit.Tone.Rep : UiKit.Tone.Gold);
            keyDown = kb => Any(kb, true, Key.A, Key.LeftArrow, Key.J) ? 0
                : Any(kb, true, Key.S, Key.DownArrow, Key.K) ? 1
                : Any(kb, true, Key.D, Key.RightArrow, Key.L) ? 2 : -1;
            keyUp = _ => -1;
            var lastPressLane = -1;
            var pressFlash = 0f;
            var hype = 0f;
            var shownScore = 0;
            var seen = new int[g.Notes.Count];
            onFeedback = f =>
            {
                if (f < 0) Shake(4);
            };
            return () =>
            {
                var dt = Time.unscaledDeltaTime;
                var time = Time.unscaledTime;
                var phrase = g.Notes[g.Notes.Count - 1].Phrase;
                var lastBeat = -10f;
                for (var i = 0; i < noteImages.Count; i++)
                {
                    var n = g.Notes[i];
                    if (n.State == 0 && n.Phrase < phrase) phrase = n.Phrase;
                    if (n.Time <= g.Clock) lastBeat = Mathf.Max(lastBeat, n.Time);
                    if (n.State != seen[i])
                    {
                        seen[i] = n.State;
                        if (n.State > 0) Splash(tones[n.Lane], new Vector2(LaneX(n.Lane), hitY), 6, 180, 12);
                        hype = Mathf.Clamp01(hype + (n.State > 0 ? 0.2f : -0.3f));
                    }
                    var ahead = n.Time - g.Clock;
                    var img = noteImages[i];
                    var visible = n.State != 1 && ahead < g.Lead && ahead > -0.5f;
                    img.enabled = visible;
                    if (!visible) continue;
                    Move(img, new Vector2(LaneX(n.Lane), hitY + ahead / g.Lead * (BoardH - hitY - 10)));
                    img.color = n.State == -1 ? new Color(0.6f, 0.62f, 0.68f, 0.6f) : tones[n.Lane];
                }
                // the verse: every note of the phrase a word, lit when hit
                var words = Verses[(phrase + verseOffset) % Verses.Length];
                var line = "";
                for (var k = 0; k < RhythmGame.NotesPerPhrase; k++)
                {
                    var n = g.Notes[Mathf.Min(phrase * RhythmGame.NotesPerPhrase + k, g.Notes.Count - 1)];
                    var color = n.State > 0 ? "#ffc93c" : n.State < 0 ? "#6b7080" : "#ffffff";
                    line += $"<color={color}>{words[k]}</color> ";
                }
                verse.text = line.TrimEnd();
                if (g.Score > shownScore)
                {
                    shownScore = g.Score;
                    Word("tr-hype", new Vector2(mid, 200), 100, 0.9f);
                }
                // everything moves on the beat; the crowd jumps as the hype rises
                var pulse = Mathf.Exp(-(g.Clock - lastBeat) * 8);
                foreach (var s in speakers) s.rectTransform.localScale = Vector3.one * (1 + 0.07f * pulse);
                Move(bud, new Vector2(mid, 46 + pulse * 7));
                Move(mic, new Vector2(mid + 40, 140 + pulse * 7));
                hype = Mathf.Max(0, hype - dt * 0.04f);
                Move(crowd, new Vector2(mid, -60 + Mathf.Abs(Mathf.Sin(time * 6)) * hype * 18));
                for (var i = 0; i < lights.Count; i++)
                    lights[i].rectTransform.localEulerAngles = new Vector3(0, 0, Mathf.Sin(time * 0.8f + i * 2) * 18);
                if (g.LastLane >= 0 && (g.LastLane != lastPressLane || pressFlash <= 0))
                {
                    lastPressLane = g.LastLane;
                    pressFlash = 0.15f;
                }
                pressFlash = Mathf.Max(0, pressFlash - dt);
                for (var l = 0; l < RhythmGame.Lanes; l++)
                    laneFlash[l].color = new Color(1, 1, 1, l == lastPressLane ? pressFlash * 2.5f : 0);
            };
        }

        // ---------- Przetrwanie: away from the guard dog ----------

        Action BuildRunner(RunnerGame g)
        {
            const float groundY = 58, runnerX = 320;
            var speed = (BoardW - runnerX - 20) / RunnerGame.Lead;
            Flat("Sky", board, UiKit.Hex("#6d7aa0"), Vector2.zero, new Vector2(BoardW, BoardH), Vector2.zero);
            var skyline = new List<(Image img, float rate)>();
            foreach (var (tint, rate, h) in new[] { ("#55608a", 0.12f, 230f), ("#343c5a", 0.3f, 180f) })
                for (var i = 0; i < 2; i++)
                {
                    var img = Picture("City", board, Art("tr-miasto"), Vector2.zero, new Vector2(1280, h), UiKit.Hex(tint));
                    img.preserveAspect = false;
                    img.rectTransform.pivot = Vector2.zero;
                    img.rectTransform.anchoredPosition = new Vector2(i * 1280, groundY - 4);
                    skyline.Add((img, rate));
                }
            Flat("Ground", board, UiKit.Surface800, Vector2.zero, new Vector2(BoardW, groundY), Vector2.zero);
            Flat("Kerb", board, UiKit.Surface700, new Vector2(0, groundY - 8), new Vector2(BoardW, 8), Vector2.zero);
            var joints = new List<Image>();
            for (var i = 0; i < 15; i++)
                joints.Add(Flat("Joint", board, UiKit.Surface700, new Vector2(i * 80, 0), new Vector2(4, groundY - 12), Vector2.zero));
            var items = new List<Image>();
            foreach (var o in g.Obstacles)
                items.Add(o.Kind == 0
                    ? Standing("Barrier", board, Art("tr-barierka"), Vector2.zero, new Vector2(116, 90))
                    : Standing("Beam", board, Art("tr-belka"), Vector2.zero, new Vector2(220, 121)));
            var dog = Standing("Dog", board, Art("tr-pies-a"), new Vector2(60, groundY - 6), new Vector2(170, 102));
            var runner = Standing("Bud", board, Bud(Facing.Side, 0), new Vector2(runnerX, groundY), new Vector2(100, 150));
            runner.rectTransform.localScale = new Vector3(-1, 1, 1); // side frames face left; the course runs right
            if (!runner.sprite)
            {
                runner.sprite = disc;
                runner.color = UiKit.Buds400;
                runner.enabled = true;
            }
            var seen = new int[g.Obstacles.Count];
            var dogX = 40f;
            var wasUp = false;
            Control("Skok  [W]", 0, -170, 300, UiKit.Tone.Gold, 90);
            Control("Ślizg  [S]", 1, 170, 300, UiKit.Tone.Rep, 270);
            keyDown = kb => Any(kb, true, Key.W, Key.UpArrow, Key.Space) ? 0 : Any(kb, true, Key.S, Key.DownArrow) ? 1 : -1;
            keyUp = _ => -1;
            var dust = UiKit.Hex("#a9afbd");
            return () =>
            {
                var dt = Time.unscaledDeltaTime;
                var moving = !g.Done;
                foreach (var (img, rate) in skyline)
                {
                    var p = img.rectTransform.anchoredPosition;
                    if (moving) p.x -= speed * rate * dt;
                    if (p.x <= -1280) p.x += 2560;
                    img.rectTransform.anchoredPosition = p;
                }
                foreach (var j in joints)
                {
                    var p = j.rectTransform.anchoredPosition;
                    if (moving) p.x -= speed * dt;
                    if (p.x < -10) p.x += 15 * 80;
                    j.rectTransform.anchoredPosition = p;
                }
                var jump = g.JumpLeft > 0 ? Mathf.Sin((1 - g.JumpLeft / RunnerGame.MoveTime) * Mathf.PI) * 100 : 0;
                var slide = g.SlideLeft > 0;
                var rt = runner.rectTransform;
                // sliding: lying back under the beam; running: the walk frames at a run's pace
                rt.localEulerAngles = new Vector3(0, 0, slide ? -72 : 0);
                rt.anchoredPosition = new Vector2(runnerX, groundY + jump) + (slide ? new Vector2(-40, 4) : Vector2.zero);
                if (budSheet != null)
                    runner.sprite = budSheet.Get(Facing.Side, jump > 0 || slide ? 2 : 1 + (int)(g.Clock * 7) % 2);
                var up = jump > 0;
                if (wasUp && !up) Splash(dust, new Vector2(runnerX, groundY + 6), 6, 140, 10);
                wasUp = up;
                var misses = 0;
                for (var i = 0; i < items.Count; i++)
                {
                    var o = g.Obstacles[i];
                    if (o.State < 0) misses++;
                    if (o.State != seen[i])
                    {
                        seen[i] = o.State;
                        if (o.State < 0)
                        {
                            Word("Ui/Fx/fx-lup", new Vector2(runnerX + 60, groundY + 200), 100);
                            Splash(dust, new Vector2(runnerX + 30, groundY + 40), 10);
                            Shake(12);
                        }
                    }
                    var ahead = o.Time - g.Clock;
                    var visible = ahead < RunnerGame.Lead + 0.4f && ahead > -0.8f;
                    items[i].enabled = visible;
                    if (!visible) continue;
                    Move(items[i], new Vector2(runnerX + ahead * speed, o.Kind == 0 ? groundY - 4 : groundY + 86));
                    items[i].color = o.State < 0 ? new Color(1, 0.6f, 0.6f) : Color.white;
                }
                // the dog closes in with every obstacle the bud catches
                dogX = Smooth(dogX, Mathf.Min(runnerX - 120, 40 + misses * 46), 3, dt);
                Move(dog, new Vector2(dogX, groundY - 6 + Mathf.Abs(Mathf.Sin(g.Clock * 9)) * 6));
                dog.sprite = Art((int)(g.Clock * 8) % 2 == 0 ? "tr-pies-a" : "tr-pies-b");
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
