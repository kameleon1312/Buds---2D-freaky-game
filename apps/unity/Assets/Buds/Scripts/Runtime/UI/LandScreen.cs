using System;
using System.Collections.Generic;
using Buds.Quests;
using UnityEngine;
using UnityEngine.UI;

namespace Buds.UI
{
    /// <summary>
    /// The district's screens: a bar at the top of the screen while the bud is on its plot (the four resources and how
    /// much fits, a skyline button that opens the window, a cancel button while a building is being placed), the window
    /// with four tabs: Budynki (what can be put up, what it costs, why not), Rozbudowa (the next stage over the plot),
    /// Skup (resources sold for coins) and Napady (defence, shield, what is safe, who raided), its name with "Zmień
    /// nazwę", and the naming window (buying a plot and renaming). The windows only say what the player wants; the game
    /// asks the server.
    /// </summary>
    public sealed class LandScreen
    {
        public const int TabBuildings = 0, TabGrow = 1, TabSell = 2, TabRaids = 3;
        const int Tabs = 4;
        const float W = 960, H = 640;

        readonly GameObject bar;
        readonly Text[] amounts = new Text[4];
        readonly Text cap;
        readonly GameObject cancel;
        readonly GameObject root;
        readonly Text title;
        readonly Text status;
        readonly RectTransform list;
        readonly Image[] tabFaces = new Image[Tabs];
        readonly List<GameObject> rows = new();
        static readonly string[] ResourceIds = { "beton", "stal", "energia", "zywnosc" };
        readonly GameObject naming;
        readonly Text namingTitle;
        readonly Text namingText;
        readonly Text namingError;
        readonly Text namingAccept;
        readonly InputField nameField;
        Action<string> named;
        Land land;
        int budLevel;
        int coins;
        int tab;

        public Action<string> OnBuild;
        public Action OnGrow;
        public Action<string, int> OnSell;
        public Action OnCancelPlacing;
        public Action OnOpen;
        public Action OnRename;

        public bool IsOpen => root.activeSelf || naming.activeSelf;
        public bool NamingOpen => naming.activeSelf;
        public int Tab => tab;

        public LandScreen(Transform hudRoot)
        {
            // ---------- the bar ----------
            var box = UiKit.OutlinedBox("LandBar", hudRoot, new Color(UiKit.Surface800.r, UiKit.Surface800.g, UiKit.Surface800.b, 0.92f), 24);
            var barRt = (RectTransform)box.transform.parent;
            UiKit.Place(barRt, new Vector2(0.5f, 1), new Vector2(0, -GameUi.UnderPlate - 4), new Vector2(560, 50), new Vector2(0.5f, 1));
            var open = UiKit.Button("Build", box.transform, "", new Vector2(56, 44), () => OnOpen?.Invoke(), UiKit.Tone.Gold, 18);
            UiKit.Place((RectTransform)open.transform, new Vector2(0, 0.5f), new Vector2(4, 2), new Vector2(56, 44), new Vector2(0, 0.5f));
            var hammer = UiKit.Rect("Icon", open.transform.Find("Face") ?? open.transform).gameObject.AddComponent<Image>();
            hammer.sprite = UiKit.Picture("Ui/dzielnica");
            hammer.preserveAspect = true;
            hammer.raycastTarget = false;
            UiKit.Stretch(hammer.rectTransform, 5);
            for (var i = 0; i < 4; i++)
            {
                var x = 74 + i * 112;
                var icon = UiKit.Rect("Res " + ResourceIds[i], box.transform).gameObject.AddComponent<Image>();
                icon.sprite = UiKit.Picture("Ui/zasob-" + ResourceIds[i]);
                icon.preserveAspect = true;
                icon.raycastTarget = false;
                UiKit.Place(icon.rectTransform, new Vector2(0, 0.5f), new Vector2(x, 0), new Vector2(34, 34), new Vector2(0, 0.5f));
                amounts[i] = UiKit.Outlined("Amount", box.transform, "0", 20, null, TextAnchor.MiddleLeft);
                UiKit.Place(amounts[i].rectTransform, new Vector2(0, 0.5f), new Vector2(x + 38, 0), new Vector2(70, 30), new Vector2(0, 0.5f));
            }
            cap = UiKit.Label("Cap", box.transform, "", 15, UiKit.TextOnDarkMuted, false, TextAnchor.MiddleRight);
            UiKit.Place(cap.rectTransform, new Vector2(1, 0.5f), new Vector2(-12, 0), new Vector2(70, 30), new Vector2(1, 0.5f));
            bar = barRt.gameObject;
            var stop = UiKit.Button("CancelPlacing", hudRoot, "Anuluj  [Esc]", new Vector2(190, 50), () => OnCancelPlacing?.Invoke(), UiKit.Tone.Alert, 20);
            UiKit.Place((RectTransform)stop.transform, new Vector2(0.5f, 1), new Vector2(0, -GameUi.UnderPlate - 66), new Vector2(190, 50), new Vector2(0.5f, 1));
            cancel = stop.gameObject;
            cancel.SetActive(false);
            bar.SetActive(false);

            // ---------- the window ----------
            var dim = UiKit.Panel("Land", hudRoot, new Color(0.086f, 0.094f, 0.122f, 0.72f));
            dim.raycastTarget = true;
            UiKit.Stretch(dim.rectTransform);
            root = dim.gameObject;
            var group = UiKit.Rect("Group", dim.transform);
            UiKit.Place(group, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(W + 40, H + 20));
            group.gameObject.AddComponent<FitInParent>();
            var body = UiKit.Window("Window", group, new Vector2(W, H), "Dystrykt", Hide, out var window, out title);
            UiKit.Place(window, new Vector2(0.5f, 0.5f), Vector2.zero, window.sizeDelta);
            string[] names = { "Budynki", "Rozbudowa", "Skup", "Napady" };
            for (var i = 0; i < Tabs; i++)
            {
                var index = i;
                var b = UiKit.Button("Tab " + names[i], body, names[i], new Vector2(168, 52), () => ShowTab(index), UiKit.Tone.Rep, 21);
                UiKit.Place((RectTransform)b.transform, new Vector2(0, 1), new Vector2(i * 178, 0), new Vector2(168, 52), new Vector2(0, 1));
                tabFaces[i] = b.transform.Find("Face/Fill")?.GetComponent<Image>();
            }
            var rename = UiKit.Button("Rename", body, "Zmień nazwę", new Vector2(176, 52), () => OnRename?.Invoke(), UiKit.Tone.Rep, 20);
            UiKit.Place((RectTransform)rename.transform, new Vector2(1, 1), new Vector2(0, 0), new Vector2(176, 52), new Vector2(1, 1));
            // the last word (what happened, or the district's might) along the bottom
            status = UiKit.Label("Status", body, "", 19, UiKit.InkSoft, false, TextAnchor.MiddleRight);
            UiKit.Place(status.rectTransform, new Vector2(1, 0), Vector2.zero, new Vector2(W - 64, 34), new Vector2(1, 0));
            list = UiKit.Rect("List", body);
            UiKit.Stretch(list, 0, 40, 0, 70);
            root.SetActive(false);

            // ---------- naming the district ----------
            var shade = UiKit.Panel("NameDistrict", hudRoot, new Color(0.086f, 0.094f, 0.122f, 0.72f));
            shade.raycastTarget = true;
            UiKit.Stretch(shade.rectTransform);
            naming = shade.gameObject;
            var nameGroup = UiKit.Rect("Group", shade.transform);
            UiKit.Place(nameGroup, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(700, 470));
            nameGroup.gameObject.AddComponent<FitInParent>();
            var card = UiKit.Window("Window", nameGroup, new Vector2(660, 440), "Nazwij dystrykt", CancelNaming, out var nameWindow, out namingTitle);
            UiKit.Place(nameWindow, new Vector2(0.5f, 0.5f), Vector2.zero, nameWindow.sizeDelta);
            namingText = UiKit.Label("Text", card, "", 21, UiKit.Ink, false, TextAnchor.UpperLeft);
            namingText.supportRichText = true;
            UiKit.Place(namingText.rectTransform, new Vector2(0.5f, 1), Vector2.zero, new Vector2(600, 110), new Vector2(0.5f, 1));
            nameField = UiKit.Input("Name", card, new Vector2(560, 76), "Nazwa dystryktu", 32);
            UiKit.Place((RectTransform)nameField.transform.parent, new Vector2(0.5f, 1), new Vector2(0, -118), new Vector2(560, 76), new Vector2(0.5f, 1));
            nameField.characterLimit = 24;
            nameField.lineType = InputField.LineType.SingleLine;
            nameField.onSubmit.AddListener(_ => AcceptName());
            namingError = UiKit.Label("Error", card, "", 19, UiKit.Alert700, true);
            UiKit.Place(namingError.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -202), new Vector2(600, 30), new Vector2(0.5f, 1));
            var accept = UiKit.Button("Accept", card, "Załóż", new Vector2(250, 68), AcceptName, UiKit.Tone.Gold, 28);
            UiKit.Place((RectTransform)accept.transform, new Vector2(1, 0), Vector2.zero, new Vector2(250, 68), new Vector2(1, 0));
            namingAccept = accept.GetComponentInChildren<Text>();
            var back = UiKit.Button("Cancel", card, "Jeszcze nie", new Vector2(200, 68), CancelNaming, UiKit.Tone.Rep, 24);
            UiKit.Place((RectTransform)back.transform, new Vector2(1, 0), new Vector2(-266, 0), new Vector2(200, 68), new Vector2(1, 0));
            naming.SetActive(false);
        }

        // ---------- naming ----------

        /// <summary>
        /// Asks for the district's name (when founding it, or renaming): <paramref name="done"/> gets the tidied name,
        /// only once it is one the server can take (3–24 letters, digits, spaces, . ' -); the server still filters words.
        /// </summary>
        public void AskName(string heading, string text, string initial, string accept, Action<string> done)
        {
            Hide();
            namingTitle.text = heading;
            namingText.text = text;
            namingAccept.text = accept;
            namingError.text = "";
            nameField.text = initial ?? "";
            named = done;
            naming.SetActive(true);
            naming.transform.SetAsLastSibling();
            nameField.ActivateInputField();
        }

        /// <summary>The server turned the name down: the window stays open with its words.</summary>
        public void NameRejected(string why, Action<string> retry)
        {
            named = retry;
            namingError.text = why;
            naming.SetActive(true);
            naming.transform.SetAsLastSibling();
        }

        void AcceptName()
        {
            if (!naming.activeSelf) return;
            var name = Land.CleanName(nameField.text);
            if (name == null)
            {
                namingError.text = "Od 3 do 24 znaków: litery, cyfry, spacje i . ' -";
                return;
            }
            var done = named;
            named = null;
            naming.SetActive(false);
            done?.Invoke(name);
        }

        // the autopilot (-buds-land-demo) types and accepts like a player
        internal void SetNameForDemo(string text) => nameField.text = text;
        internal void AcceptNameForDemo() => AcceptName();

        public void CancelNaming()
        {
            named = null;
            if (nameField.isFocused) nameField.DeactivateInputField();
            naming.SetActive(false);
        }

        // ---------- the bar ----------

        public void ShowBar(bool on)
        {
            bar.SetActive(on);
            if (!on)
            {
                cancel.SetActive(false);
                Hide();
            }
        }

        public void SetPlacing(bool on) => cancel.SetActive(on);

        /// <summary>The bar's numbers: what the land holds of each resource and how much fits.</summary>
        public void UpdateBar(Land l)
        {
            if (!l.Has) return;
            var store = l.Storage(l.Now);
            for (var i = 0; i < 4; i++)
            {
                var have = l.State.resources.Get(ResourceIds[i]);
                amounts[i].text = have.ToString();
                amounts[i].color = have >= store ? UiKit.Gold400 : UiKit.TextOnDark;
            }
            cap.text = $"/ {store}";
        }

        // ---------- the window ----------

        public void Open(Land l, int level, int coinBalance, int startTab = TabBuildings)
        {
            land = l;
            budLevel = level;
            coins = coinBalance;
            title.text = Title(l);
            root.SetActive(true);
            root.transform.SetAsLastSibling();
            ShowTab(startTab);
        }

        static string Title(Land l) =>
            string.IsNullOrEmpty(l.State?.name) ? "Dystrykt" : $"{l.State.name} · {World.Districts.NameOf(l.Plot.route)}";

        /// <summary>The server answered: the open tab shows the new state.</summary>
        public void Refresh(Land l, int level, int coinBalance)
        {
            land = l;
            budLevel = level;
            if (coinBalance >= 0) coins = coinBalance;
            if (!root.activeSelf || !l.Has) return;
            title.text = Title(l);
            ShowTab(tab);
        }

        /// <summary>Closes whatever is open (the window or the naming).</summary>
        public void Hide()
        {
            root.SetActive(false);
            if (naming != null && naming.activeSelf) CancelNaming();
        }

        public void SetStatus(string text, bool bad = false)
        {
            status.text = text ?? "";
            status.color = bad ? UiKit.Alert700 : UiKit.InkSoft;
        }

        public void ShowTab(int index)
        {
            tab = Mathf.Clamp(index, 0, Tabs - 1);
            for (var i = 0; i < Tabs; i++)
                if (tabFaces[i]) tabFaces[i].color = i == tab ? UiKit.Buds400 : UiKit.Rep400;
            foreach (var r in rows) UnityEngine.Object.Destroy(r);
            rows.Clear();
            if (land == null || !land.Has) return;
            SetStatus($"Moc: {land.Power} · obrona +{land.Defence}%");
            switch (tab)
            {
                case TabBuildings:
                    var i = 0;
                    foreach (var kind in land.Rules.buildings)
                    {
                        if (kind.id == Land.Hall) continue; // the town hall is upgraded where it stands
                        BuildingRow(kind, i++);
                    }
                    break;
                case TabGrow:
                    GrowRows();
                    break;
                case TabSell:
                    SellRows();
                    break;
                default:
                    RaidRows();
                    break;
            }
        }

        /// <summary>A card in the list: full width, or one of two columns (<paramref name="column"/> 0 or 1).</summary>
        RectTransform Row(int index, float height, Color fill, int column = -1) => RowAt(index * (height + 10), height, fill, column);

        /// <summary>A card <paramref name="top"/> units down the list (for rows of different heights).</summary>
        RectTransform RowAt(float top, float height, Color fill, int column = -1)
        {
            var card = UiKit.OutlinedBox("Row", list, fill, UiKit.RadiusM);
            var rt = (RectTransform)card.transform.parent;
            var width = column < 0 ? W - 64 : (W - 64 - 12) / 2f;
            var x = column <= 0 ? 0 : width + 12;
            UiKit.Place(rt, new Vector2(0, 1), new Vector2(x, -top), new Vector2(width, height), new Vector2(0, 1));
            rows.Add(rt.gameObject);
            return (RectTransform)card.transform;
        }

        void BuildingRow(BuildingData kind, int index)
        {
            var have = land.Count(kind.id);
            var limit = land.Limit(kind);
            var first = kind.levels[0];
            string why = null;
            if (have >= limit) why = limit == 0 ? "Najpierw ulepsz ratusz." : $"Masz {have}/{limit}. Więcej po ulepszeniu ratusza.";
            else if (budLevel < first.player) why = $"Od poziomu {first.player}.";
            else if (!land.CanAfford(first)) why = "Brakuje surowców.";
            // two columns, three rows: every kind on one screen
            var card = Row(index / 2, 104, why == null ? UiKit.Paper300 : UiKit.Paper100, index % 2);
            var icon = UiKit.Rect("Icon", card).gameObject.AddComponent<Image>();
            icon.sprite = UiKit.Picture(string.IsNullOrEmpty(kind.produces) ? "Ui/dzielnica" : "Ui/zasob-" + kind.produces);
            icon.preserveAspect = true;
            icon.raycastTarget = false;
            UiKit.Place(icon.rectTransform, new Vector2(0, 0.5f), new Vector2(12, 0), new Vector2(50, 50), new Vector2(0, 0.5f));
            var name = UiKit.Label("Name", card, $"{kind.name}  <size=16><color=#55514a>{have}/{limit}</color></size>", 22, UiKit.Ink, true, TextAnchor.MiddleLeft);
            name.supportRichText = true;
            UiKit.Place(name.rectTransform, new Vector2(0, 1), new Vector2(72, -8), new Vector2(340, 30), new Vector2(0, 1));
            var line = string.IsNullOrEmpty(kind.produces)
                ? kind.blurb
                : kind.produces == Land.Rent
                    ? $"czynsz {Core.GameBootstrap.Coins(first.value)} na godzinę · {Land.CostText(first)}"
                    : $"{first.value} na godzinę · {Land.CostText(first)}";
            var detail = UiKit.Label("Detail", card, why ?? (string.IsNullOrEmpty(kind.produces) ? $"{Land.CostText(first)} · {kind.blurb}" : line), 16,
                why == null ? UiKit.InkSoft : UiKit.Alert700, false, TextAnchor.UpperLeft);
            UiKit.Place(detail.rectTransform, new Vector2(0, 1), new Vector2(72, -40), new Vector2(why == null ? 214 : 340, 56), new Vector2(0, 1));
            if (why == null)
            {
                var id = kind.id;
                var go = UiKit.Button("Build", card, "Postaw", new Vector2(120, 52), () =>
                {
                    Hide();
                    OnBuild?.Invoke(id);
                }, UiKit.Tone.Gold, 22);
                UiKit.Place((RectTransform)go.transform, new Vector2(1, 0), new Vector2(-12, 14), new Vector2(120, 52), new Vector2(1, 0));
            }
        }

        /// <summary>The stage now and what the next one asks for, with the button when everything is there.</summary>
        void GrowRows()
        {
            var side = land.Rules.stageSides[Mathf.Clamp(land.State.stage, 1, land.Rules.stageSides.Length) - 1];
            var header = Row(0, 64, UiKit.Paper100);
            var now = UiKit.Label("Text", header,
                $"Etap {land.State.stage} z {land.Rules.stages.Length}: dystrykt zajmuje {side}×{side} pól działki {land.Rules.plotSize}×{land.Rules.plotSize}.", 19,
                UiKit.Ink, false, TextAnchor.MiddleLeft);
            UiKit.Stretch(now.rectTransform, 16, 0, 16, 0);
            var next = land.NextStage;
            if (next == null)
            {
                var full = RowAt(74, 64, UiKit.Paper300);
                var done = UiKit.Label("Text", full, "Dystrykt zajmuje całą działkę. Rośnie dalej w górę: ulepszaj budynki.", 19, UiKit.Ink, false, TextAnchor.MiddleLeft);
                UiKit.Stretch(done.rectTransform, 16, 0, 16, 0);
                return;
            }
            var nextSide = land.Rules.stageSides[Mathf.Min(land.State.stage, land.Rules.stageSides.Length - 1)];
            var problem = land.GrowProblem(budLevel, coins);
            var card = RowAt(74, 150, problem == null ? UiKit.Paper300 : UiKit.Paper100);
            var title = UiKit.Label("Name", card, $"Etap {land.State.stage + 1}: {nextSide}×{nextSide} pól", 24, UiKit.Ink, true, TextAnchor.MiddleLeft);
            UiKit.Place(title.rectTransform, new Vector2(0, 1), new Vector2(18, -10), new Vector2(600, 34), new Vector2(0, 1));
            var lines = $"Koszt: {Land.CostText(next, next.coins)}\nPoziom Buda {next.level} · ratusz poziom {next.hall}";
            if (problem != null)
                lines += $"\n<color=#bd1c31><b>{(problem == "poor" ? "Brakuje surowców albo monet." : Land.ProblemText(problem))}</b></color>";
            var detail = UiKit.Label("Detail", card, lines, 18, UiKit.InkSoft, false, TextAnchor.UpperLeft);
            detail.supportRichText = true;
            UiKit.Place(detail.rectTransform, new Vector2(0, 1), new Vector2(18, -48), new Vector2(640, 96), new Vector2(0, 1));
            if (problem != null) return;
            var go = UiKit.Button("Grow", card, "Rozbuduj", new Vector2(180, 56), () => OnGrow?.Invoke(), UiKit.Tone.Gold, 24);
            UiKit.Place((RectTransform)go.transform, new Vector2(1, 0.5f), new Vector2(-14, 3), new Vector2(180, 56), new Vector2(1, 0.5f));
        }

        /// <summary>The district's defence, its shield, what is safe from raids and who raided it lately.</summary>
        void RaidRows()
        {
            var now = land.Now;
            const float head = 112;
            var header = RowAt(0, head, UiKit.Paper100);
            var shield = land.Shielded(now)
                ? $"Tarcza: jeszcze {Land.Countdown(land.State.shieldUntil, now)}. Nikt teraz nie napadnie."
                : "Bez tarczy: inni mogą napadać.";
            var text = UiKit.Label("Text", header,
                $"Obrona dystryktu: <b>+{land.Defence}%</b> zdrowia dla ciebie w obronie (rośnie z mocą).\n{shield}\n" +
                $"Bezpieczne zawsze: {land.Protected} każdego surowca (więcej z centrum logistycznym). Napady od poziomu {land.Rules.raidMinLevel}.",
                17, UiKit.Ink, false, TextAnchor.MiddleLeft);
            text.supportRichText = true;
            UiKit.Stretch(text.rectTransform, 16, 0, 16, 0);
            var raids = land.State.raids;
            if (raids.Length == 0)
            {
                var none = RowAt(head + 10, 56, UiKit.Paper300);
                var t = UiKit.Label("Text", none, "Nikt jeszcze nie napadł na twój dystrykt.", 19, UiKit.InkSoft, false, TextAnchor.MiddleLeft);
                UiKit.Stretch(t.rectTransform, 16, 0, 16, 0);
                return;
            }
            for (var i = 0; i < Mathf.Min(raids.Length, 3); i++)
            {
                var r = raids[i];
                var card = RowAt(head + 10 + i * 64, 54, r.won ? UiKit.Paper100 : UiKit.Paper300);
                var ago = Land.Countdown(now, r.at);
                var line = r.won
                    ? $"<b>{r.by}</b> napadł(a) i zabrał(a): {Land.LootText(r.loot)?.Replace("+", "") ?? "nic"}"
                    : $"<b>{r.by}</b> napadł(a), ale obrona wytrzymała.";
                var t = UiKit.Label("Text", card, $"{line}  <size=15><color=#55514a>{ago} temu</color></size>", 18, UiKit.Ink, false, TextAnchor.MiddleLeft);
                t.supportRichText = true;
                UiKit.Stretch(t.rectTransform, 16, 0, 16, 0);
            }
        }

        void SellRows()
        {
            var header = Row(0, 48, UiKit.Paper100);
            var label = UiKit.Label("Text", header, $"Skup płaci za każde {land.Rules.sellBatch} sztuk. Masz {Core.GameBootstrap.Coins(Mathf.Max(0, coins))}.", 19, UiKit.Ink, false, TextAnchor.MiddleLeft);
            UiKit.Stretch(label.rectTransform, 16, 0, 16, 0);
            var i = 1;
            foreach (var r in land.Rules.resources)
            {
                var have = land.State.resources.Get(r.id);
                var card = Row(i++, 66, UiKit.Paper300);
                var icon = UiKit.Rect("Icon", card).gameObject.AddComponent<Image>();
                icon.sprite = UiKit.Picture("Ui/zasob-" + r.id);
                icon.preserveAspect = true;
                icon.raycastTarget = false;
                UiKit.Place(icon.rectTransform, new Vector2(0, 0.5f), new Vector2(14, 0), new Vector2(48, 48), new Vector2(0, 0.5f));
                var name = UiKit.Label("Name", card, $"{r.name}: {have}  <size=17><color=#55514a>· {r.price} za {land.Rules.sellBatch}</color></size>", 22, UiKit.Ink, true, TextAnchor.MiddleLeft);
                name.supportRichText = true;
                UiKit.Place(name.rectTransform, new Vector2(0, 0.5f), new Vector2(74, 0), new Vector2(420, 34), new Vector2(0, 0.5f));
                var id = r.id;
                var batch = land.Rules.sellBatch;
                if (have >= batch)
                {
                    var one = UiKit.Button("Sell", card, $"Sprzedaj {batch}", new Vector2(170, 50), () => OnSell?.Invoke(id, batch), UiKit.Tone.Rep, 20);
                    UiKit.Place((RectTransform)one.transform, new Vector2(1, 0.5f), new Vector2(-196, 3), new Vector2(170, 50), new Vector2(1, 0.5f));
                    var all = have / batch * batch;
                    var every = UiKit.Button("SellAll", card, $"Wszystko ({all})", new Vector2(176, 50), () => OnSell?.Invoke(id, all), UiKit.Tone.Gold, 20);
                    UiKit.Place((RectTransform)every.transform, new Vector2(1, 0.5f), new Vector2(-12, 3), new Vector2(176, 50), new Vector2(1, 0.5f));
                }
            }
        }
    }
}
