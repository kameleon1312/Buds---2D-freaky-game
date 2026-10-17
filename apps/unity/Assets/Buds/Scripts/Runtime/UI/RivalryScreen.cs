using System;
using System.Collections.Generic;
using Buds.Api;
using Buds.Quests;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace Buds.UI
{
    /// <summary>What the Rewiry screen shows; filled tab by tab by GameBootstrap.Rivalry (null = not loaded yet).</summary>
    public sealed class RivalryData
    {
        public bool Guest;
        public int Level = 1;
        public string MySlug;
        public string DistrictName;
        public TurfsResponse Turfs;
        public RivalryMeResponse Me;
        public RankingResponse Ranking;
        public CrewResponse Crew;
        public CrewListResponse Crews;
        public PvpOpponentsResponse Pvp;
        public MarketResponse Market;
        /// <summary>Owned items that may go on the Bazar.</summary>
        public readonly List<string> Sellable = new();
    }

    /// <summary>
    /// "Rewiry" (G or the HUD button): who rules the district's turfs this week and the daily tribute, the week's
    /// ranking and challenges, the crew, duels with other buds and the Bazar. Every action goes to the server; this
    /// screen only shows answers. Paper window and outlined buttons like the Bud panel.
    /// </summary>
    public sealed class RivalryScreen
    {
        public const int TabTurfs = 0, TabRanking = 1, TabCrew = 2, TabPvp = 3, TabMarket = 4;
        const int Tabs = 5;
        const float PageW = 1076;
        const float RowH = 50;
        const float RowGap = 6;

        public readonly struct Actions
        {
            public readonly Action<int> Tab;
            public readonly Action<string> Tribute;
            public readonly Action<string, string> CreateCrew;
            public readonly Action<string> JoinCrew;
            public readonly Action LeaveCrew;
            public readonly Action<string> Challenge;
            public readonly Action<string, int> Sell;
            public readonly Action<string> Buy;
            public readonly Action<string> Cancel;

            public Actions(Action<int> tab, Action<string> tribute, Action<string, string> createCrew, Action<string> joinCrew,
                Action leaveCrew, Action<string> challenge, Action<string, int> sell, Action<string> buy, Action<string> cancel)
            {
                Tab = tab;
                Tribute = tribute;
                CreateCrew = createCrew;
                JoinCrew = joinCrew;
                LeaveCrew = leaveCrew;
                Challenge = challenge;
                Sell = sell;
                Buy = buy;
                Cancel = cancel;
            }
        }

        readonly QuestContent content;
        readonly Actions act;
        readonly GameObject root;
        readonly RectTransform[] pages = new RectTransform[Tabs];
        readonly RectTransform[] lists = new RectTransform[Tabs];
        readonly Text[] heads = new Text[Tabs];
        readonly Button[] tabs = new Button[Tabs];
        readonly Text status;
        int tab;
        RivalryData data = new();

        // crew form
        InputField crewName;
        InputField crewTag;
        GameObject crewForm;
        // market: what to sell
        InputField priceField;
        GameObject sellForm;
        Text sellLabel;
        Image sellIcon;
        int sellIndex;

        public bool IsOpen => root.activeSelf;
        public int Tab => tab;

        public RivalryScreen(Transform canvas, QuestContent content, Actions actions, Action onClose)
        {
            this.content = content;
            act = actions;
            var dim = UiKit.Panel("Rivalry", canvas, new Color(0.086f, 0.094f, 0.122f, 0.72f));
            dim.raycastTarget = true;
            UiKit.Stretch(dim.rectTransform);
            root = dim.gameObject;
            var group = UiKit.Rect("Group", dim.transform);
            UiKit.Place(group, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(1180, 820));
            group.gameObject.AddComponent<FitInParent>();
            var body = UiKit.Window("Window", group, new Vector2(1140, 800), "Rewiry", () => onClose(), out var window, out _);
            UiKit.Place(window, new Vector2(0.5f, 0.5f), Vector2.zero, window.sizeDelta);

            string[] names = { "Rewiry", "Ranking", "Ekipa", "Pojedynki", "Bazar" };
            for (var i = 0; i < Tabs; i++)
            {
                var index = i;
                tabs[i] = UiKit.Button("Tab" + i, body, names[i], new Vector2(208, 72), () => ShowTab(index, true), UiKit.Tone.Rep, 30);
                UiKit.Place((RectTransform)tabs[i].transform, new Vector2(0, 1), new Vector2(i * 218, 0), new Vector2(208, 72),
                    new Vector2(0, 1));
                pages[i] = UiKit.Rect(names[i], body);
                UiKit.Stretch(pages[i], 0, 44, 0, 88);
                heads[i] = UiKit.Label("Head", pages[i], "", 24, UiKit.Ink, false, TextAnchor.UpperLeft);
                UiKit.Place(heads[i].rectTransform, new Vector2(0, 1), Vector2.zero, new Vector2(PageW, 92), new Vector2(0, 1));
                // a scrolling list under the head line (above the form on the crew and market tabs)
                var view = UiKit.Rect("View", pages[i]);
                UiKit.Stretch(view, 0, i is TabCrew or TabMarket ? 88 : 0, 0, 100);
                var hit = view.gameObject.AddComponent<Image>();
                hit.color = Color.clear;
                view.gameObject.AddComponent<RectMask2D>();
                lists[i] = UiKit.Rect("List", view);
                lists[i].anchorMin = new Vector2(0, 1);
                lists[i].anchorMax = Vector2.one;
                lists[i].pivot = new Vector2(0.5f, 1);
                lists[i].offsetMin = lists[i].offsetMax = Vector2.zero;
                var scroll = view.gameObject.AddComponent<ScrollRect>();
                scroll.content = lists[i];
                scroll.viewport = view;
                scroll.horizontal = false;
                scroll.movementType = ScrollRect.MovementType.Clamped;
                scroll.scrollSensitivity = 30;
            }
            BuildCrewForm(pages[TabCrew]);
            BuildSellForm(pages[TabMarket]);
            status = UiKit.Label("Status", body, "", 22, UiKit.InkSoft, false, TextAnchor.LowerLeft);
            UiKit.Place(status.rectTransform, Vector2.zero, Vector2.zero, new Vector2(PageW, 36), Vector2.zero);
            root.SetActive(false);
        }

        public void Show(RivalryData value, int startTab)
        {
            data = value;
            root.SetActive(true);
            root.transform.SetAsLastSibling();
            status.text = "";
            ShowTab(startTab, true);
        }

        public void Hide() => root.SetActive(false);

        /// <summary>New data arrived (or an action finished): redraw the open tab.</summary>
        public void Refresh(RivalryData value)
        {
            data = value;
            if (IsOpen) Draw();
        }

        public void SetStatus(string text, bool error = false)
        {
            status.text = text ?? "";
            status.color = error ? UiKit.Alert700 : UiKit.Buds600;
        }

        /// <summary>Keyboard: 1–5 switch tabs (not while typing in a field).</summary>
        public void Tick()
        {
            var kb = Keyboard.current;
            if (kb == null || !IsOpen) return;
            if ((crewName && crewName.isFocused) || (crewTag && crewTag.isFocused) || (priceField && priceField.isFocused)) return;
            Key[] keys = { Key.Digit1, Key.Digit2, Key.Digit3, Key.Digit4, Key.Digit5 };
            for (var i = 0; i < keys.Length; i++)
                if (kb[keys[i]].wasPressedThisFrame) ShowTab(i, true);
        }

        public void SelectTab(int index) => ShowTab(Mathf.Clamp(index, 0, Tabs - 1), true);

        void ShowTab(int index, bool load)
        {
            tab = index;
            status.text = ""; // a message belongs to the tab it came from
            for (var i = 0; i < Tabs; i++)
            {
                pages[i].gameObject.SetActive(i == index);
                var face = tabs[i].transform.Find("Face/Fill")?.GetComponent<Image>();
                if (face) face.color = i == index ? UiKit.Buds400 : UiKit.Rep400;
            }
            Draw();
            if (load) act.Tab?.Invoke(index);
        }

        void Draw()
        {
            var list = lists[tab];
            // detached first: destroyed objects linger until the end of the frame and would count in the height below
            for (var i = list.childCount - 1; i >= 0; i--)
            {
                var old = list.GetChild(i).gameObject;
                old.transform.SetParent(null, false);
                UnityEngine.Object.Destroy(old);
            }
            if (data.Guest)
            {
                heads[tab].text = "Rywalizacja toczy się połączonym Budem: wpływ, rankingi i handel zapisuje serwer.";
                if (crewForm) crewForm.SetActive(false);
                if (sellForm) sellForm.SetActive(false);
                return;
            }
            switch (tab)
            {
                case TabTurfs:
                    DrawTurfs(list);
                    break;
                case TabRanking:
                    DrawRanking(list);
                    break;
                case TabCrew:
                    DrawCrew(list);
                    break;
                case TabPvp:
                    DrawPvp(list);
                    break;
                default:
                    DrawMarket(list);
                    break;
            }
            // the list is as tall as its rows, so it scrolls exactly that far
            var height = 0f;
            foreach (RectTransform child in list) height = Mathf.Max(height, -child.anchoredPosition.y + child.sizeDelta.y);
            list.sizeDelta = new Vector2(0, height);
            list.anchoredPosition = Vector2.zero;
        }

        // ---------- rows ----------

        /// <summary>One row of a list: a paper box at row <paramref name="i"/> (with an optional offset from the top).</summary>
        static RectTransform Row(RectTransform list, int i, Color fill, float top = 0, float width = PageW - 6, float x = 0)
        {
            var box = UiKit.OutlinedBox("Row" + i, list, fill, UiKit.RadiusS);
            var rt = (RectTransform)box.transform.parent;
            UiKit.Place(rt, new Vector2(0, 1), new Vector2(x, -top - i * (RowH + RowGap)), new Vector2(width, RowH), new Vector2(0, 1));
            return (RectTransform)box.transform;
        }

        static Text Cell(RectTransform row, string text, float x, float width, TextAnchor align = TextAnchor.MiddleLeft, int size = 22,
            Color? color = null)
        {
            var t = UiKit.Label("Cell", row, text, size, color ?? UiKit.Ink, false, align);
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            UiKit.Place(t.rectTransform, new Vector2(0, 0.5f), new Vector2(x, 0), new Vector2(width, RowH), new Vector2(0, 0.5f));
            return t;
        }

        static Button RowButton(RectTransform row, string label, UiKit.Tone tone, Action onClick, float width = 150)
        {
            var b = UiKit.Button("Act", row, label, new Vector2(width, RowH - 12), onClick, tone, 21);
            UiKit.Place((RectTransform)b.transform, new Vector2(1, 0.5f), new Vector2(-8, 3), new Vector2(width, RowH - 12), new Vector2(1, 0.5f));
            return b;
        }

        static Image Icon(RectTransform row, Sprite sprite, float x)
        {
            var img = UiKit.Rect("Icon", row).gameObject.AddComponent<Image>();
            img.sprite = sprite;
            img.enabled = sprite;
            img.preserveAspect = true;
            img.raycastTarget = false;
            UiKit.Place(img.rectTransform, new Vector2(0, 0.5f), new Vector2(x, 0), new Vector2(RowH - 8, RowH - 8), new Vector2(0, 0.5f));
            return img;
        }

        static string Ordinal(int rank) => rank > 0 ? $"#{rank}" : "–";

        string WeekLine(string week, string endsAt) =>
            $"<b>{Rivalry.WeekName(week)}</b> · koniec za {Rivalry.TimeLeft(endsAt, DateTime.UtcNow)}";

        // ---------- turfs ----------

        void DrawTurfs(RectTransform list)
        {
            var t = data.Turfs;
            if (t == null)
            {
                heads[TabTurfs].text = "Wczytuję rewiry…";
                return;
            }
            var me = data.Me;
            heads[TabTurfs].text = WeekLine(t.week, t.endsAt) +
                                   (me != null ? $"  ·  twój wpływ: <b>{me.points}</b> ({Ordinal(me.rank)} w tygodniu)" : "") +
                                   $"\n<size=19>{data.DistrictName} · wpływ za pojedynki, zadania, skrytki i trening. Najwięcej (min. 30) = władza i codzienny haracz.</size>";
            var crown = UiKit.Picture("Ui/korona");
            var turfs = t.turfs ?? Array.Empty<TurfStateDto>();
            for (var i = 0; i < turfs.Length && i < 11; i++)
            {
                var turf = turfs[i];
                var mine = turf.HasOwner && turf.owner.slug == data.MySlug;
                var row = Row(list, i, mine ? UiKit.Hex("#e6f7c4") : UiKit.Paper300);
                Icon(row, mine ? crown : null, 8);
                Cell(row, $"<b>{turf.name}</b>", 54, 300);
                var owner = turf.HasOwner
                    ? $"{turf.owner.name}{(string.IsNullOrEmpty(turf.owner.crewTag) ? "" : $" [{turf.owner.crewTag}]")} · {turf.owner.points}"
                    : "<color=#55514a>wolny</color>";
                Cell(row, owner, 360, 330);
                Cell(row, turf.mine > 0 ? $"ty: {turf.mine} ({Ordinal(turf.rank)})" : "", 690, 200, TextAnchor.MiddleLeft, 20, UiKit.InkSoft);
                if (turf.tributeReady)
                {
                    var id = turf.id;
                    RowButton(row, $"Haracz +{turf.tribute}", UiKit.Tone.Buds, () => act.Tribute(id), 180);
                }
            }
        }

        // ---------- ranking ----------

        void DrawRanking(RectTransform list)
        {
            var r = data.Ranking;
            var me = data.Me;
            if (r == null)
            {
                heads[TabRanking].text = "Wczytuję ranking…";
                return;
            }
            var titles = me != null ? Rivalry.Titles(me.titles) : "";
            heads[TabRanking].text = WeekLine(r.week, r.endsAt) + "  ·  podium tygodnia: 150 / 90 / 60 monet i tytuł na zawsze" +
                                     (titles.Length > 0 ? $"\n<size=20>Twoje tytuły: <b>{titles}</b></size>" : "");
            var buds = r.buds ?? Array.Empty<RankedBudDto>();
            const float half = PageW / 2 - 12;
            var shown = Mathf.Min(buds.Length, 9);
            for (var i = 0; i < shown; i++)
            {
                var b = buds[i];
                var row = Row(list, i, b.slug == data.MySlug ? UiKit.Hex("#e6f7c4") : UiKit.Paper300, 0, half);
                Cell(row, $"<b>{i + 1}.</b>", 10, 40);
                Cell(row, $"<b>{b.name}</b>{(string.IsNullOrEmpty(b.crewTag) ? "" : $" <color=#1b86c9>[{b.crewTag}]</color>")}  <size=18>poz. {b.level}</size>",
                    54, 300);
                Cell(row, $"<b>{b.points}</b>", half - 110, 100, TextAnchor.MiddleRight);
            }
            if (shown == 0)
            {
                var row = Row(list, 0, UiKit.Paper300, 0, half);
                Cell(row, "Nikt jeszcze nie zdobył wpływu. Pierwszy ruch należy do ciebie.", 14, half - 28, TextAnchor.MiddleLeft, 20);
            }
            // the bud's own challenges on the right
            var challenges = me?.challenges ?? Array.Empty<ChallengeStandingDto>();
            var title = UiKit.Label("Challenges", list, "<b>Wyzwania tygodnia</b> (twój wynik i miejsce)", 22, UiKit.Ink, false,
                TextAnchor.MiddleLeft);
            UiKit.Place(title.rectTransform, new Vector2(0, 1), new Vector2(half + 16, 0), new Vector2(half, RowH), new Vector2(0, 1));
            for (var i = 0; i < challenges.Length; i++)
            {
                var c = challenges[i];
                var row = Row(list, i, c.rank == 1 ? UiKit.Hex("#fff0c2") : UiKit.Paper300, RowH + RowGap, half, half + 16);
                Cell(row, c.name, 14, 280);
                Cell(row, $"<b>{c.count}</b>  {Ordinal(c.rank)}", half - 170, 156, TextAnchor.MiddleRight);
            }
            if (me != null)
            {
                var row = Row(list, challenges.Length, UiKit.Paper300, RowH + RowGap, half, half + 16);
                Cell(row, $"Liga pojedynków: <b>{me.league}</b> · {me.rating} pkt", 14, half - 28);
            }
        }

        // ---------- crew ----------

        void BuildCrewForm(RectTransform page)
        {
            var form = UiKit.Rect("CrewForm", page);
            UiKit.Place(form, new Vector2(0, 0), Vector2.zero, new Vector2(PageW, 80), Vector2.zero);
            crewName = UiKit.Input("Name", form, new Vector2(420, 64), "Nazwa ekipy (3–20 znaków)", 24);
            crewName.characterLimit = 20;
            UiKit.Place((RectTransform)crewName.transform.parent, new Vector2(0, 0.5f), Vector2.zero, new Vector2(420, 64), new Vector2(0, 0.5f));
            crewTag = UiKit.Input("Tag", form, new Vector2(160, 64), "TAG", 24);
            crewTag.characterLimit = 4;
            UiKit.Place((RectTransform)crewTag.transform.parent, new Vector2(0, 0.5f), new Vector2(436, 0), new Vector2(160, 64), new Vector2(0, 0.5f));
            var make = UiKit.Button("Create", form, "Załóż ekipę", new Vector2(260, 64), () => act.CreateCrew(crewName.text, crewTag.text),
                UiKit.Tone.Gold, 26);
            UiKit.Place((RectTransform)make.transform, new Vector2(0, 0.5f), new Vector2(612, 0), new Vector2(260, 64), new Vector2(0, 0.5f));
            crewForm = form.gameObject;
        }

        void DrawCrew(RectTransform list)
        {
            var mine = data.Crew;
            if (mine == null)
            {
                heads[TabCrew].text = "Wczytuję ekipę…";
                crewForm.SetActive(false);
                return;
            }
            if (mine.Present)
            {
                crewForm.SetActive(false);
                var c = mine.crew;
                heads[TabCrew].text = $"<b>{c.name}</b> <color=#1b86c9>[{c.tag}]</color>  ·  wpływ ekipy w tym tygodniu: <b>{c.points}</b>  ·  {c.members.Length}/12 osób" +
                                      "\n<size=19>Wpływ każdej osoby liczy się do rankingu ekip. Podaj znajomym tag, żeby dołączyli.</size>";
                const float half = PageW / 2 - 12;
                var members = c.members ?? Array.Empty<CrewMemberDto>();
                for (var i = 0; i < members.Length; i++)
                {
                    var m = members[i];
                    var col = i % 2;
                    var row = Row(list, i / 2, m.slug == data.MySlug ? UiKit.Hex("#e6f7c4") : UiKit.Paper300, 0, half, col * (half + 16));
                    Cell(row, $"<b>{m.name}</b>{(m.role == "leader" ? "  <color=#d98a0b>lider</color>" : "")}  <size=18>poz. {m.level}</size>", 14, 330);
                    Cell(row, $"<b>{m.points}</b>", half - 110, 96, TextAnchor.MiddleRight);
                }
                var leave = Row(list, (members.Length + 1) / 2, UiKit.Paper300, 8);
                Cell(leave, "Opuszczenie ekipy nie zabiera twojego wpływu z rewirów.", 14, 700, TextAnchor.MiddleLeft, 20, UiKit.InkSoft);
                RowButton(leave, "Opuść ekipę", UiKit.Tone.Alert, () => act.LeaveCrew(), 200);
                return;
            }

            var open = data.Level >= Rivalry.MinLevel;
            crewForm.SetActive(open);
            heads[TabCrew].text = open
                ? "Nie masz jeszcze ekipy. Załóż własną (nazwa i tag 2–4 znaki) albo dołącz do jednej z listy.\n<size=19>Do 12 osób; ekipy liczą wspólny wpływ w tygodniowym rankingu.</size>"
                : $"Ekipy otwierają się od poziomu {Rivalry.MinLevel}.";
            var crews = data.Crews?.crews ?? Array.Empty<RankedCrewDto>();
            for (var i = 0; i < crews.Length && i < 8; i++)
            {
                var c = crews[i];
                var row = Row(list, i, UiKit.Paper300);
                Cell(row, $"<b>{c.name}</b> <color=#1b86c9>[{c.tag}]</color>", 14, 420);
                Cell(row, $"{c.members}/12 · wpływ {c.points}", 450, 300, TextAnchor.MiddleLeft, 20, UiKit.InkSoft);
                if (open && c.members < 12)
                {
                    var tag = c.tag;
                    RowButton(row, "Dołącz", UiKit.Tone.Buds, () => act.JoinCrew(tag));
                }
            }
        }

        // ---------- PvP ----------

        void DrawPvp(RectTransform list)
        {
            var p = data.Pvp;
            if (data.Level < Rivalry.MinLevel)
            {
                heads[TabPvp].text = $"Pojedynki z Budami otwierają się od poziomu {Rivalry.MinLevel}.";
                return;
            }
            if (p == null)
            {
                heads[TabPvp].text = "Szukam rywali…";
                return;
            }
            heads[TabPvp].text = $"Liga <b>{p.league}</b> · {p.rating} pkt · wygrane {p.wins}, przegrane {p.losses}" +
                                 "\n<size=19>Rywal walczy swoim sprzętem i umiejętnościami. 5 pierwszych wygranych dziennie płaci monety; ucieczka w trakcie = przegrana.</size>";
            var opponents = p.opponents ?? Array.Empty<PvpOpponentDto>();
            if (opponents.Length == 0)
            {
                var row = Row(list, 0, UiKit.Paper300);
                Cell(row, "Nikogo w twoim zasięgu poziomów. Zajrzyj później.", 14, 900, TextAnchor.MiddleLeft, 20);
            }
            for (var i = 0; i < opponents.Length && i < 8; i++)
            {
                var o = opponents[i];
                var row = Row(list, i, UiKit.Paper300);
                Cell(row, $"<b>{o.name}</b>{(string.IsNullOrEmpty(o.crewTag) ? "" : $" <color=#1b86c9>[{o.crewTag}]</color>")}  <size=18>poz. {o.level}</size>", 14, 380);
                Cell(row, $"{o.league} · {o.rating}", 400, 220, TextAnchor.MiddleLeft, 20);
                Cell(row, string.IsNullOrEmpty(o.weapon) ? "pięści" : o.weapon, 620, 220, TextAnchor.MiddleLeft, 20, UiKit.InkSoft);
                if (o.wait > 0)
                    Cell(row, $"za {Mathf.CeilToInt(o.wait / 60f)} min", PageW - 190, 160, TextAnchor.MiddleRight, 20, UiKit.InkSoft);
                else
                {
                    var slug = o.slug;
                    RowButton(row, "Wyzwij", UiKit.Tone.Buds, () => act.Challenge(slug));
                }
            }
        }

        // ---------- market ----------

        void BuildSellForm(RectTransform page)
        {
            var form = UiKit.Rect("SellForm", page);
            UiKit.Place(form, new Vector2(0, 0), Vector2.zero, new Vector2(PageW, 80), Vector2.zero);
            var prev = ArrowButton("Prev", form, 180, () => StepSell(-1));
            UiKit.Place((RectTransform)prev.transform, new Vector2(0, 0.5f), Vector2.zero, new Vector2(56, 64), new Vector2(0, 0.5f));
            var card = UiKit.OutlinedBox("Item", form, UiKit.Paper300, UiKit.RadiusM);
            UiKit.Place((RectTransform)card.transform.parent, new Vector2(0, 0.5f), new Vector2(66, 0), new Vector2(420, 64), new Vector2(0, 0.5f));
            sellIcon = UiKit.Rect("Icon", card.transform).gameObject.AddComponent<Image>();
            sellIcon.preserveAspect = true;
            sellIcon.raycastTarget = false;
            UiKit.Place(sellIcon.rectTransform, new Vector2(0, 0.5f), new Vector2(6, 0), new Vector2(52, 52), new Vector2(0, 0.5f));
            sellLabel = UiKit.Label("Name", card.transform, "", 22, UiKit.Ink, false, TextAnchor.MiddleLeft);
            UiKit.Stretch(sellLabel.rectTransform, 66, 0, 8, 0);
            var next = ArrowButton("Next", form, 0, () => StepSell(1));
            UiKit.Place((RectTransform)next.transform, new Vector2(0, 0.5f), new Vector2(496, 0), new Vector2(56, 64), new Vector2(0, 0.5f));
            priceField = UiKit.Input("Price", form, new Vector2(170, 64), "cena", 24);
            priceField.contentType = InputField.ContentType.IntegerNumber;
            priceField.characterLimit = 4;
            UiKit.Place((RectTransform)priceField.transform.parent, new Vector2(0, 0.5f), new Vector2(566, 0), new Vector2(170, 64), new Vector2(0, 0.5f));
            var sell = UiKit.Button("Sell", form, "Wystaw", new Vector2(200, 64), Sell, UiKit.Tone.Gold, 26);
            UiKit.Place((RectTransform)sell.transform, new Vector2(0, 0.5f), new Vector2(750, 0), new Vector2(200, 64), new Vector2(0, 0.5f));
            sellForm = form.gameObject;
        }

        /// <summary>A small square button with a drawn arrow (the font has no arrow glyphs).</summary>
        static Button ArrowButton(string name, Transform parent, float angle, Action onClick)
        {
            var b = UiKit.Button(name, parent, "", new Vector2(56, 64), onClick, UiKit.Tone.Rep, 20);
            var icon = UiKit.Rect("Arrow", b.transform.Find("Face") ?? b.transform).gameObject.AddComponent<Image>();
            icon.sprite = UiKit.Arrow;
            icon.color = UiKit.Outline;
            icon.raycastTarget = false;
            UiKit.Place(icon.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0, 3), new Vector2(34, 34));
            icon.rectTransform.localEulerAngles = new Vector3(0, 0, angle);
            return b;
        }

        void StepSell(int dir)
        {
            if (data.Sellable.Count == 0) return;
            sellIndex = (sellIndex + dir + data.Sellable.Count) % data.Sellable.Count;
            DrawSellItem();
        }

        void DrawSellItem()
        {
            if (data.Sellable.Count == 0)
            {
                sellLabel.text = "<size=19>Nic do sprzedania: łupy z pojedynków trafiają tutaj.</size>";
                sellIcon.enabled = false;
                return;
            }
            sellIndex = Mathf.Clamp(sellIndex, 0, data.Sellable.Count - 1);
            var item = content.Item(data.Sellable[sellIndex]);
            sellLabel.text = $"<b>{item?.name ?? data.Sellable[sellIndex]}</b>\n<size=17>sklepowa cena {item?.coins ?? 0} · {sellIndex + 1}/{data.Sellable.Count}</size>";
            sellIcon.sprite = UiKit.Picture("Items/" + data.Sellable[sellIndex]);
            sellIcon.enabled = sellIcon.sprite;
        }

        void Sell()
        {
            if (data.Sellable.Count == 0) return;
            if (!int.TryParse(priceField.text, out var price) || price < Rivalry.MarketMinPrice || price > Rivalry.MarketMaxPrice)
            {
                SetStatus($"Cena od {Rivalry.MarketMinPrice} do {Rivalry.MarketMaxPrice} monet.", true);
                return;
            }
            act.Sell(data.Sellable[Mathf.Clamp(sellIndex, 0, data.Sellable.Count - 1)], price);
        }

        void DrawMarket(RectTransform list)
        {
            var m = data.Market;
            if (data.Level < Rivalry.MinLevel)
            {
                sellForm.SetActive(false);
                heads[TabMarket].text = $"Bazar otwiera się od poziomu {Rivalry.MinLevel}.";
                return;
            }
            if (m == null)
            {
                sellForm.SetActive(false);
                heads[TabMarket].text = "Wczytuję Bazar…";
                return;
            }
            sellForm.SetActive(true);
            DrawSellItem();
            heads[TabMarket].text = $"Masz <b>{Core.GameBootstrap.Coins(m.coins)}</b>  ·  Bazar pobiera 10% od sprzedaży" +
                                    "\n<size=19>Handlujesz łupem i sprzętem z gry; rzeczy premium, napoje i nagrody z zadań nie trafiają na Bazar.</size>";
            var listings = m.listings ?? Array.Empty<ListingDto>();
            if (listings.Length == 0)
            {
                var row = Row(list, 0, UiKit.Paper300);
                Cell(row, "Na Bazarze pusto. Wystaw coś pierwszy.", 14, 900, TextAnchor.MiddleLeft, 20);
            }
            for (var i = 0; i < listings.Length && i < 7; i++)
            {
                var l = listings[i];
                var item = content.Item(l.itemId);
                var row = Row(list, i, l.mine ? UiKit.Hex("#e6f7c4") : UiKit.Paper300);
                Icon(row, UiKit.Picture("Items/" + l.itemId), 6);
                Cell(row, $"<b>{item?.name ?? l.itemId}</b>{(item != null && item.minLevel > data.Level ? $"  <color=#bd1c31><size=18>od poz. {item.minLevel}</size></color>" : "")}", 54, 420);
                Cell(row, l.mine ? "twoja oferta" : $"od {l.seller?.name}", 480, 240, TextAnchor.MiddleLeft, 20, UiKit.InkSoft);
                Cell(row, $"<b>{l.price}</b> monet", 720, 150, TextAnchor.MiddleRight);
                var id = l.id;
                if (l.mine) RowButton(row, "Wycofaj", UiKit.Tone.Alert, () => act.Cancel(id));
                else RowButton(row, "Kup", UiKit.Tone.Buds, () => act.Buy(id));
            }
        }
    }
}
