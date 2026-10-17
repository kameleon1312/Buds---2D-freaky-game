using System;
using System.Collections.Generic;
using Buds.Quests;
using UnityEngine;
using UnityEngine.UI;

namespace Buds.UI
{
    /// <summary>Everything the Bud panel shows. Filled by GameBootstrap (server data for paired buds).</summary>
    public sealed class BudPanelData
    {
        public string Name;
        public int Level = 1;
        public int Xp;
        public int NextXp = 100;
        public Sprite Portrait;
        public bool Guest;
        public bool Loading;
        public string Error;
        public readonly List<string> Worn = new();
        public readonly List<string> Owned = new();
        /// <summary>Gear by slot (head … held).</summary>
        public readonly Dictionary<string, string> Equipped = new();
        /// <summary>Effective skill ranks: points spent plus training.</summary>
        public readonly Dictionary<string, int> Ranks = new();
        /// <summary>Ranks bought with points, and training XP per skill.</summary>
        public readonly Dictionary<string, int> Spent = new();
        public readonly Dictionary<string, int> TrainingXp = new();
        /// <summary>Special abilities unlocked.</summary>
        public readonly List<string> Perks = new();
        /// <summary>Energy drinks carried (item -> count) and running boosts (buff -> end, in realtimeSinceStartup).</summary>
        public readonly Dictionary<string, int> Drinks = new();
        public readonly Dictionary<string, float> Buffs = new();
        /// <summary>The code to type on the website (Twoje konto → Bud z gry), once asked for.</summary>
        public string LinkCode;
        public int Points;
        public int Available;
        public int Coins;
        public int Gems;
        public int QuestsDone;
        public int QuestsTotal;
        public readonly List<(string name, int level, bool open)> Districts = new();
    }

    /// <summary>
    /// "Twój Bud": profile; gear on a head-to-toe paper doll with the stats it adds (the server validates every
    /// change); skills (points from levels and training, special abilities); energy drinks and their running boosts;
    /// the coin shop. Opened from the HUD button or with I / Tab / C.
    /// </summary>
    public sealed class BudPanel
    {
        static readonly Dictionary<string, (string label, Color color)> Rarity = new()
        {
            ["common"] = ("Zwykły", UiKit.Hex("#a6b0c3")),
            ["uncommon"] = ("Niepospolity", UiKit.Hex("#5cc84a")),
            ["rare"] = ("Rzadki", UiKit.Hex("#3d9bff")),
            ["epic"] = ("Epicki", UiKit.Hex("#b45cff")),
            ["legendary"] = ("Legendarny", UiKit.Hex("#ff9a1f")),
            ["mythic"] = ("Mityczny", UiKit.Hex("#ff3d7a")),
        };

        public const int TabProfile = 0, TabGear = 1, TabSkills = 2, TabDrinks = 3, TabShop = 4;
        const int Tabs = 5;
        /// <summary>The shop filter for energy drinks (they have no slot).</summary>
        const string DrinkFilter = "drink";
        /// <summary>The shop filter for premium items (for gems).</summary>
        const string PremiumFilter = "premium";

        readonly QuestContent content;
        readonly Action<string> onUpgrade;
        readonly Action<string, string> onEquip;
        readonly Action<string> onBuy;
        readonly Action<string> onDrink;
        readonly Action onLink;
        readonly Action onLogout;
        Button logoutButton;
        Text logoutLabel;
        float logoutArmedUntil;
        Button linkButton;
        Text linkText;
        readonly GameObject root;
        readonly RectTransform[] pages = new RectTransform[Tabs];
        readonly Button[] tabs = new Button[Tabs];
        readonly Dictionary<string, Sprite> icons = new();
        int tab;
        BudPanelData data = new();

        // profile
        Image portrait;
        Text nameText;
        Text levelText;
        RectTransform xpFill;
        Text xpText;
        Text statsText;

        // gear
        Image dollPortrait;
        readonly Dictionary<string, (Image frame, Image icon, Text label)> dollSlots = new();
        readonly List<(string id, RectTransform fill, Text value)> statRows = new();
        Text skillBonusText;
        Text pickerTitle;
        RectTransform pickerGrid;
        Text gearDetails;
        Button gearAction;
        Text gearActionLabel;
        string selectedSlot = "feet";
        string selectedGear;

        // skills
        Text pointsText;
        readonly List<(string id, Image[] pips, Button upgrade, Text bonus, RectTransform train, Text perks)> skillRows = new();

        // drinks
        RectTransform drinkGrid;
        Text buffsText;
        Image drinkIcon;
        Text drinkTitle;
        Text drinkDetails;
        Button drinkUse;
        Text drinkUseLabel;
        string selectedDrink;
        float nextTick;

        // shop
        RectTransform shopGrid;
        Image shopIcon;
        Text shopTitle;
        Text shopDetails;
        Button shopBuy;
        Text shopBuyLabel;
        Text shopWallet;
        string selectedShop;
        string shopSlot = "feet";
        readonly List<(string slot, Button chip)> shopFilters = new();

        public bool IsOpen => root.activeSelf;

        public BudPanel(Transform canvas, QuestContent content, Action<string> onUpgrade, Action<string, string> onEquip,
            Action<string> onBuy, Action<string> onDrink, Action onLink, Action onLogout)
        {
            this.onLink = onLink;
            this.onLogout = onLogout;
            this.content = content;
            this.onUpgrade = onUpgrade;
            this.onEquip = onEquip;
            this.onBuy = onBuy;
            this.onDrink = onDrink;

            var dim = UiKit.Panel("BudPanel", canvas, new Color(0.086f, 0.094f, 0.122f, 0.72f));
            dim.raycastTarget = true; // blocks taps on the world behind
            UiKit.Stretch(dim.rectTransform);
            root = dim.gameObject;

            var group = UiKit.Rect("Group", dim.transform);
            UiKit.Place(group, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(1180, 820));
            group.gameObject.AddComponent<FitInParent>();
            var body = UiKit.Window("Window", group, new Vector2(1140, 800), "Twój Bud", Hide, out var window, out _);
            UiKit.Place(window, new Vector2(0.5f, 0.5f), Vector2.zero, window.sizeDelta);

            string[] names = { "Profil", "Ekwipunek", "Umiejętności", "Napoje", "Sklep" };
            for (var i = 0; i < Tabs; i++)
            {
                var index = i;
                tabs[i] = UiKit.Button("Tab" + i, body, names[i], new Vector2(208, 72), () => ShowTab(index), UiKit.Tone.Rep, 30);
                UiKit.Place((RectTransform)tabs[i].transform, new Vector2(0, 1), new Vector2(i * 218, 0), new Vector2(208, 72),
                    new Vector2(0, 1));
                // one line per tab: a long name (Umiejętności) shrinks a little
                var tabText = tabs[i].GetComponentInChildren<Text>();
                tabText.resizeTextForBestFit = true;
                tabText.resizeTextMinSize = 20;
                tabText.resizeTextMaxSize = 30;
                tabText.horizontalOverflow = HorizontalWrapMode.Wrap;
                tabText.verticalOverflow = VerticalWrapMode.Truncate;
                pages[i] = UiKit.Rect(names[i], body);
                UiKit.Stretch(pages[i], 0, 0, 0, 88);
            }
            BuildProfile(pages[0]);
            BuildGear(pages[1]);
            BuildSkills(pages[TabSkills]);
            BuildDrinks(pages[TabDrinks]);
            BuildShop(pages[TabShop]);
            root.SetActive(false);
        }

        public void Show(BudPanelData panelData)
        {
            root.SetActive(true);
            root.transform.SetAsLastSibling();
            Refresh(panelData);
            ShowTab(tab);
        }

        public void Hide() => root.SetActive(false);

        public void SelectTab(int index) => ShowTab(Mathf.Clamp(index, 0, Tabs - 1));

        /// <summary>Selects a slot on the paper doll (and the first owned item for it).</summary>
        public void SelectSlot(string slot)
        {
            selectedSlot = slot;
            selectedGear = data.Equipped.TryGetValue(slot, out var worn) ? worn : null;
            RefreshGear();
        }

        public void SelectShopItem(string id)
        {
            selectedShop = id;
            var item = content.Item(id);
            if (item != null) shopSlot = item.IsPremiumShop ? PremiumFilter : item.IsDrink ? DrinkFilter : item.slot;
            RefreshShop();
        }

        public void SelectDrink(string id)
        {
            selectedDrink = id;
            RefreshDrinks();
        }

        /// <summary>Counts the boost timers down while the panel is open.</summary>
        public void Tick()
        {
            if (!IsOpen || Time.realtimeSinceStartup < nextTick) return;
            nextTick = Time.realtimeSinceStartup + 1;
            if (logoutArmedUntil > 0 && Time.realtimeSinceStartup > logoutArmedUntil)
            {
                logoutArmedUntil = 0;
                logoutLabel.text = data.Guest ? "Wyjdź do menu" : "Wyloguj się";
            }
            if (tab == TabDrinks) RefreshBuffs();
        }

        public GearStats Stats => Gear.Stats(content, data.Equipped.Values, data.Ranks);

        public void Refresh(BudPanelData panelData)
        {
            data = panelData;
            RefreshProfile();
            RefreshGear();
            RefreshSkills();
            RefreshDrinks();
            RefreshShop();
        }

        void ShowTab(int index)
        {
            tab = index;
            for (var i = 0; i < Tabs; i++)
            {
                pages[i].gameObject.SetActive(i == index);
                // active tab in the confirm colour, the others secondary
                var face = tabs[i].transform.Find("Face/Fill")?.GetComponent<Image>();
                if (face) face.color = i == index ? UiKit.Buds400 : UiKit.Rep400;
            }
        }

        string SlotName(string id) => Array.Find(content.slots, s => s.id == id)?.name ?? id;

        static (string label, Color color) RarityOf(ItemData item) =>
            Rarity.TryGetValue(item?.rarity ?? "common", out var r) ? r : Rarity["common"];

        static string Hex(Color c) => ColorUtility.ToHtmlStringRGB(c * 0.8f);

        // ---------- profile ----------

        void BuildProfile(RectTransform page)
        {
            var card = UiKit.OutlinedBox("PortraitCard", page, UiKit.Paper300, UiKit.RadiusL);
            UiKit.Place((RectTransform)card.transform.parent, new Vector2(0, 1), Vector2.zero, new Vector2(300, 440), new Vector2(0, 1));
            portrait = UiKit.Rect("Portrait", card.transform).gameObject.AddComponent<Image>();
            portrait.preserveAspect = true;
            portrait.raycastTarget = false;
            UiKit.Stretch(portrait.rectTransform, 16);

            nameText = UiKit.Label("Name", page, "", 50, UiKit.Ink, true, TextAnchor.UpperLeft);
            UiKit.Place(nameText.rectTransform, new Vector2(0, 1), new Vector2(330, 0), new Vector2(600, 66), new Vector2(0, 1));

            var badge = UiKit.OutlinedBox("Level", page, UiKit.Buds400, 999);
            UiKit.Place((RectTransform)badge.transform.parent, new Vector2(0, 1), new Vector2(330, -66), new Vector2(68, 68),
                new Vector2(0, 1));
            levelText = UiKit.Outlined("Num", badge.transform, "", 40);
            UiKit.Stretch(levelText.rectTransform, 0, 4, 0, 0);

            xpFill = UiKit.Bar("Xp", page, UiKit.XpFill, out var bar);
            UiKit.Place(bar, new Vector2(0, 1), new Vector2(414, -78), new Vector2(560, 42), new Vector2(0, 1));
            xpText = UiKit.Outlined("Value", bar, "", 24);
            UiKit.Stretch(xpText.rectTransform, 0, 2, 0, 0);

            statsText = UiKit.Label("Stats", page, "", 24, UiKit.Ink, false, TextAnchor.UpperLeft);
            UiKit.Place(statsText.rectTransform, new Vector2(0, 1), new Vector2(330, -150), new Vector2(740, 300), new Vector2(0, 1));
            statsText.lineSpacing = 1.05f;

            // link the bud to an account on the website: a code to type in Twoje konto
            linkButton = UiKit.Button("Link", page, "Połącz z kontem", new Vector2(300, 70), () => onLink(), UiKit.Tone.Buds, 28);
            UiKit.Place((RectTransform)linkButton.transform, new Vector2(0, 1), new Vector2(0, -462), new Vector2(300, 70), new Vector2(0, 1));
            linkText = UiKit.Label("LinkText", page, "", 21, UiKit.Ink, false, TextAnchor.MiddleLeft);
            UiKit.Place(linkText.rectTransform, new Vector2(0, 1), new Vector2(330, -452), new Vector2(480, 96), new Vector2(0, 1));

            // signing out: a second tap within a few seconds confirms (the destructive tone, bottom right)
            logoutButton = UiKit.Button("Logout", page, "Wyloguj się", new Vector2(250, 70), Logout, UiKit.Tone.Alert, 26);
            UiKit.Place((RectTransform)logoutButton.transform, new Vector2(1, 1), new Vector2(0, -462), new Vector2(250, 70), new Vector2(1, 1));
            logoutLabel = logoutButton.GetComponentInChildren<Text>();
        }

        /// <summary>The "Wyloguj się" button, as a tap (the autopilot taps it twice).</summary>
        public void PressLogout() => Logout();

        void Logout()
        {
            if (Time.realtimeSinceStartup > logoutArmedUntil)
            {
                logoutArmedUntil = Time.realtimeSinceStartup + 4;
                logoutLabel.text = "Na pewno?";
                return;
            }
            logoutArmedUntil = 0;
            logoutButton.interactable = false;
            logoutLabel.text = "Wylogowuję…";
            onLogout();
        }

        void RefreshProfile()
        {
            // the confirmation runs out on its own
            if (logoutArmedUntil <= 0 || Time.realtimeSinceStartup > logoutArmedUntil)
                logoutLabel.text = data.Guest ? "Wyjdź do menu" : "Wyloguj się";
            portrait.sprite = data.Portrait;
            portrait.enabled = data.Portrait;
            nameText.text = data.Name;
            levelText.text = data.Level.ToString();
            xpText.text = $"{data.Xp} / {data.NextXp} XP";
            Canvas.ForceUpdateCanvases();
            var floor = Core.Progression.XpCurve * (data.Level - 1) * (data.Level - 1);
            UiKit.SetBar(xpFill, data.NextXp > floor ? (data.Xp - floor) / (float)(data.NextXp - floor) : 0);

            var stats = Stats;
            var sb = new System.Text.StringBuilder();
            sb.Append($"<b>Zadania:</b> {data.QuestsDone} / {data.QuestsTotal}\n");
            sb.Append($"<b>Portfel:</b> {Core.GameBootstrap.Coins(data.Coins)} · {data.Gems} gemów\n");
            sb.Append($"<b>Statystyki:</b> Szybkość +{stats.Speed}% · Pancerz {stats.Armor} · Szczęście +{stats.Luck}%\n");
            sb.Append($"<b>Punkty umiejętności:</b> {data.Available} wolne z {data.Points}\n");
            sb.Append("<b>Dzielnice:</b>\n");
            foreach (var (name, level, open) in data.Districts)
                sb.Append(open ? $"   <color=#5d9a12>{name}</color> — otwarta\n" : $"   <color=#55514a>{name} — od poziomu {level}</color>\n");
            if (data.Guest) sb.Append("\n<i>Grasz jako gość: stwórz Buda, żeby zapisywać postępy.</i>");
            else if (data.Loading) sb.Append("\n<i>Wczytuję dane z serwera…</i>");
            else if (data.Error != null) sb.Append($"\n<color=#bd1c31>{data.Error}</color>");
            statsText.text = sb.ToString();

            linkButton.interactable = !data.Guest && !data.Loading;
            linkText.text = data.Guest
                ? "<color=#55514a>Gość nie ma konta. Stwórz Buda w grze, a potem połącz go z kontem na stronie.</color>"
                : data.LinkCode != null
                    ? $"Kod: <b><size=34>{data.LinkCode}</size></b>\nNa stronie Buds otwórz Twoje konto → „Bud z gry” i wpisz ten kod (ważny 10 minut)."
                    : "<color=#55514a>Zapisz Buda na swoim koncie: postępy, ekwipunek i monety przetrwają zmianę telefonu.</color>";
        }

        // ---------- gear: paper doll laid out like the body, stats, picker ----------

        /// <summary>Where each slot's tile sits on the body: (column, row); column 0 left, 1 centre, 2 right.</summary>
        static readonly Dictionary<string, Vector2Int> BodyLayout = new()
        {
            ["head"] = new Vector2Int(1, 0),
            ["face"] = new Vector2Int(1, 1),
            ["accessory"] = new Vector2Int(2, 1),
            ["hands"] = new Vector2Int(0, 2),
            ["torso"] = new Vector2Int(1, 2),
            ["held"] = new Vector2Int(2, 2),
            ["legs"] = new Vector2Int(1, 3),
            ["feet"] = new Vector2Int(1, 4),
            ["mount"] = new Vector2Int(2, 4),
        };

        const float Tile = 84;
        const float RowH = 106;

        void BuildGear(RectTransform page)
        {
            // the bud's silhouette behind the tiles, so every tile sits on its part of the body
            var card = UiKit.OutlinedBox("Doll", page, UiKit.Paper300, UiKit.RadiusL);
            UiKit.Place((RectTransform)card.transform.parent, new Vector2(0, 1), Vector2.zero, new Vector2(470, 540), new Vector2(0, 1));
            dollPortrait = UiKit.Rect("Portrait", card.transform).gameObject.AddComponent<Image>();
            dollPortrait.preserveAspect = true;
            dollPortrait.raycastTarget = false;
            dollPortrait.color = new Color(1, 1, 1, 0.32f);
            UiKit.Place(dollPortrait.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0, -6), new Vector2(360, 540));
            float[] columns = { 40, 193, 346 };
            foreach (var (slot, at) in BodyLayout)
                DollSlot(page, slot, new Vector2(columns[at.x], -8 - at.y * RowH));

            // stats
            var stats = UiKit.OutlinedBox("Stats", page, UiKit.Paper300, UiKit.RadiusM);
            UiKit.Place((RectTransform)stats.transform.parent, new Vector2(0, 1), new Vector2(500, 0), new Vector2(576, 238), new Vector2(0, 1));
            var title = UiKit.Label("Title", stats.transform, "Statystyki", 26, UiKit.Ink, true, TextAnchor.UpperLeft);
            UiKit.Place(title.rectTransform, new Vector2(0, 1), new Vector2(18, -8), new Vector2(300, 34), new Vector2(0, 1));
            for (var i = 0; i < content.stats.Length; i++)
            {
                var s = content.stats[i];
                var y = -46 - i * 38;
                var label = UiKit.Label("Name", stats.transform, s.name, 22, UiKit.Ink, false, TextAnchor.MiddleLeft);
                UiKit.Place(label.rectTransform, new Vector2(0, 1), new Vector2(18, y), new Vector2(140, 32), new Vector2(0, 1));
                var color = s.id switch { "attack" => UiKit.Alert500, "armor" => UiKit.Rep400, "luck" => UiKit.Gold400, _ => UiKit.Buds400 };
                var fill = UiKit.Bar("Bar", stats.transform, color, out var bar);
                UiKit.Place(bar, new Vector2(0, 1), new Vector2(160, y - 2), new Vector2(300, 28), new Vector2(0, 1));
                var value = UiKit.Label("Value", stats.transform, "", 22, UiKit.Ink, true, TextAnchor.MiddleRight);
                UiKit.Place(value.rectTransform, new Vector2(0, 1), new Vector2(470, y), new Vector2(88, 32), new Vector2(0, 1));
                statRows.Add((s.id, fill, value));
            }
            skillBonusText = UiKit.Label("Skills", stats.transform, "", 19, UiKit.InkSoft, false, TextAnchor.UpperLeft);
            UiKit.Place(skillBonusText.rectTransform, new Vector2(0, 1), new Vector2(18, -200), new Vector2(540, 30), new Vector2(0, 1));

            // what can go into the selected slot
            pickerTitle = UiKit.Label("PickerTitle", page, "", 26, UiKit.Ink, true, TextAnchor.UpperLeft);
            UiKit.Place(pickerTitle.rectTransform, new Vector2(0, 1), new Vector2(500, -246), new Vector2(576, 34), new Vector2(0, 1));
            pickerGrid = UiKit.Rect("Picker", page);
            UiKit.Place(pickerGrid, new Vector2(0, 1), new Vector2(500, -280), new Vector2(576, 172), new Vector2(0, 1));

            var details = UiKit.OutlinedBox("Details", page, UiKit.Paper300, UiKit.RadiusM);
            UiKit.Place((RectTransform)details.transform.parent, new Vector2(0, 1), new Vector2(500, -458), new Vector2(576, 92),
                new Vector2(0, 1));
            gearDetails = UiKit.Label("Text", details.transform, "", 20, UiKit.Ink, false, TextAnchor.MiddleLeft);
            UiKit.Stretch(gearDetails.rectTransform, 16, 4, 206, 4);
            gearAction = UiKit.Button("Action", details.transform, "Załóż", new Vector2(184, 70), GearAction, UiKit.Tone.Gold, 30);
            UiKit.Place((RectTransform)gearAction.transform, new Vector2(1, 0.5f), new Vector2(-12, 2), new Vector2(184, 70),
                new Vector2(1, 0.5f));
            gearActionLabel = gearAction.GetComponentInChildren<Text>();
        }

        void DollSlot(RectTransform page, string slot, Vector2 at)
        {
            var root = UiKit.Rect("Slot " + slot, page);
            UiKit.Place(root, new Vector2(0, 1), at, new Vector2(Tile, Tile + 20), new Vector2(0, 1));
            var frame = UiKit.OutlinedBox("Frame", root, UiKit.Surface700, UiKit.RadiusM);
            UiKit.Place((RectTransform)frame.transform.parent, new Vector2(0.5f, 1), Vector2.zero, new Vector2(Tile, Tile), new Vector2(0.5f, 1));
            var inner = UiKit.Shape("Inner", frame.transform, UiKit.Surface800, UiKit.RadiusM - 6);
            UiKit.Stretch(inner.rectTransform, 5);
            var icon = UiKit.Rect("Icon", inner.transform).gameObject.AddComponent<Image>();
            icon.preserveAspect = true;
            icon.raycastTarget = false;
            UiKit.Stretch(icon.rectTransform, 7);
            var label = UiKit.Label("Label", root, SlotName(slot), 17, UiKit.InkSoft, true, TextAnchor.LowerCenter);
            UiKit.Stretch(label.rectTransform, -16, 0, -16, 0);
            label.horizontalOverflow = HorizontalWrapMode.Overflow; // "Wierzchowiec" stays on one line
            frame.raycastTarget = true;
            var button = root.gameObject.AddComponent<Button>();
            button.targetGraphic = frame;
            button.onClick.AddListener(() => SelectSlot(slot));
            dollSlots[slot] = (frame, icon, label);
        }

        void RefreshGear()
        {
            dollPortrait.sprite = data.Portrait;
            dollPortrait.enabled = data.Portrait;
            foreach (var (slot, (frame, icon, label)) in dollSlots)
            {
                var worn = data.Equipped.TryGetValue(slot, out var id) ? content.Item(id) : null;
                frame.color = slot == selectedSlot ? UiKit.Buds400 : worn != null ? RarityOf(worn).color : UiKit.Surface700;
                icon.sprite = worn != null ? Icon("Items/" + worn.id) : null;
                icon.enabled = icon.sprite;
                label.color = slot == selectedSlot ? UiKit.Ink : UiKit.InkSoft;
            }

            var stats = Stats;
            foreach (var (id, fill, value) in statRows)
            {
                var s = Array.Find(content.stats, x => x.id == id);
                var v = stats.Stat(id);
                value.text = s.unit == "%" ? $"+{v}%" : v.ToString();
                Canvas.ForceUpdateCanvases();
                UiKit.SetBar(fill, s.max > 0 ? v / (float)s.max : 0);
            }
            var bonuses = new List<string>();
            foreach (var (id, n) in stats.SkillBonus)
                bonuses.Add($"+{n} {Array.Find(content.skills, s => s.id == id)?.name ?? id}");
            skillBonusText.text = bonuses.Count > 0 ? "Umiejętności z ekwipunku: " + string.Join(", ", bonuses) : "Ekwipunek nie dodaje jeszcze umiejętności.";

            // owned items for the selected slot, those the bud is too young for dimmed
            pickerTitle.text = $"{SlotName(selectedSlot)}: twoje przedmioty";
            for (var i = pickerGrid.childCount - 1; i >= 0; i--) UnityEngine.Object.Destroy(pickerGrid.GetChild(i).gameObject);
            var fits = new List<ItemData>();
            foreach (var id in data.Owned)
            {
                var item = content.Item(id);
                if (item != null && item.slot == selectedSlot && !fits.Contains(item)) fits.Add(item);
            }
            fits.Sort((a, b) => a.minLevel.CompareTo(b.minLevel));
            for (var i = 0; i < fits.Count && i < 12; i++)
            {
                var item = fits[i];
                var worn = data.Equipped.TryGetValue(selectedSlot, out var w) && w == item.id;
                ItemBox(pickerGrid, item, new Vector2((i % 6) * 96, -(i / 6) * 92), 84, item.id == selectedGear, worn, () =>
                {
                    selectedGear = item.id;
                    RefreshGear();
                }, item.minLevel > data.Level);
            }
            if (fits.Count == 0)
            {
                var empty = UiKit.Label("Empty", pickerGrid,
                    data.Guest
                        ? "Połącz Buda ze strony, żeby zbierać i zakładać przedmioty."
                        : selectedSlot == "mount"
                            ? "Nie masz jeszcze wierzchowca. Deskorolkę, hulajnowę i rower kupisz w sklepie, a motocykl i quada zdobędziesz w pojedynkach."
                            : "Nic tu jeszcze nie masz. Przedmioty dają pojedynki, zadania, skrytki i sklep.", 21, UiKit.InkSoft, false,
                    TextAnchor.UpperLeft);
                UiKit.Stretch(empty.rectTransform);
            }

            // details and the one action
            var selected = selectedGear != null ? content.Item(selectedGear) : null;
            var wornNow = data.Equipped.TryGetValue(selectedSlot, out var current) ? current : null;
            if (selected == null && wornNow != null) selected = content.Item(wornNow);
            if (selected != null)
            {
                var r = RarityOf(selected);
                var tooYoung = selected.minLevel > data.Level;
                gearDetails.text = $"<b>{selected.name}</b>  ·  <color=#{Hex(r.color)}>{r.label}</color>  ·  poz. {selected.minLevel}\n" +
                                   (tooYoung ? $"<color=#bd1c31>Założysz od poziomu {selected.minLevel}</color>" : Gear.Describe(content, selected));
                var isWorn = wornNow == selected.id;
                gearActionLabel.text = isWorn ? "Zdejmij" : "Załóż";
                gearAction.interactable = !data.Guest && !data.Loading && (isWorn || !tooYoung);
                gearAction.gameObject.SetActive(true);
            }
            else
            {
                gearDetails.text = $"Miejsce: <b>{SlotName(selectedSlot)}</b>. Wybierz przedmiot, żeby zobaczyć, co daje.";
                gearAction.gameObject.SetActive(false);
            }
        }

        void GearAction()
        {
            var wornNow = data.Equipped.TryGetValue(selectedSlot, out var current) ? current : null;
            var target = selectedGear ?? wornNow;
            if (target == null) return;
            onEquip(selectedSlot, wornNow == target ? null : target);
        }

        /// <summary>An item tile with its rarity frame; <paramref name="worn"/> adds a lime bar, <paramref name="locked"/> dims it.</summary>
        void ItemBox(RectTransform parent, ItemData item, Vector2 at, float size, bool selected, bool worn, Action onClick,
            bool locked = false, bool showLevel = true)
        {
            var rarity = RarityOf(item);
            var slot = UiKit.Rect("Item " + item.id, parent);
            UiKit.Place(slot, new Vector2(0, 1), at, new Vector2(size, size), new Vector2(0, 1));
            var frame = UiKit.OutlinedBox("Frame", slot, selected ? UiKit.Buds400 : rarity.color, UiKit.RadiusM);
            UiKit.Stretch((RectTransform)frame.transform.parent);
            var inner = UiKit.Shape("Inner", frame.transform, UiKit.Surface800, UiKit.RadiusM - 6);
            UiKit.Stretch(inner.rectTransform, selected ? 7 : 5);
            var icon = UiKit.Rect("Icon", inner.transform).gameObject.AddComponent<Image>();
            icon.sprite = Icon("Items/" + item.id);
            icon.enabled = icon.sprite;
            icon.preserveAspect = true;
            icon.raycastTarget = false;
            if (locked) icon.color = new Color(1, 1, 1, 0.35f);
            UiKit.Stretch(icon.rectTransform, 7);
            if (worn)
            {
                var tag = UiKit.Shape("Worn", inner.transform, UiKit.Buds400, 4);
                UiKit.Place(tag.rectTransform, new Vector2(0.5f, 0), new Vector2(0, 2), new Vector2(size * 0.5f, 8), new Vector2(0.5f, 0));
            }
            if (locked && showLevel)
            {
                var lvl = UiKit.Outlined("Level", inner.transform, $"poz. {item.minLevel}", 18, UiKit.Gold400);
                UiKit.Stretch(lvl.rectTransform);
            }
            frame.raycastTarget = true;
            var button = slot.gameObject.AddComponent<Button>();
            button.targetGraphic = frame;
            button.onClick.AddListener(() => onClick());
        }

        // ---------- skills ----------

        void BuildSkills(RectTransform page)
        {
            pointsText = UiKit.Label("Points", page, "", 28, UiKit.Ink, true, TextAnchor.UpperLeft);
            UiKit.Place(pointsText.rectTransform, new Vector2(0, 1), Vector2.zero, new Vector2(1000, 40), new Vector2(0, 1));
            var note = UiKit.Label("Note", page,
                "Rangi: z punktów (jasne), z treningu na mapie (niebieskie), z ekwipunku (ciemne). Rangi 3 i 5 dają wyjątkowe umiejętności.",
                17, UiKit.InkSoft, false, TextAnchor.UpperLeft);
            UiKit.Place(note.rectTransform, new Vector2(0, 1), new Vector2(0, -40), new Vector2(1000, 30), new Vector2(0, 1));

            var gearMax = content.skillGearMax > 0 ? content.skillGearMax : 2;
            for (var i = 0; i < content.skills.Length; i++)
            {
                var skill = content.skills[i];
                var row = UiKit.OutlinedBox("Skill " + skill.id, page, UiKit.Paper300, UiKit.RadiusM);
                var rt = (RectTransform)row.transform.parent;
                UiKit.Place(rt, new Vector2(0, 1), new Vector2((i % 2) * 546, -76 - (i / 2) * 150), new Vector2(530, 140),
                    new Vector2(0, 1));
                var icon = UiKit.Rect("Icon", row.transform).gameObject.AddComponent<Image>();
                icon.sprite = Icon("Skills/" + skill.id);
                icon.preserveAspect = true;
                icon.raycastTarget = false;
                UiKit.Place(icon.rectTransform, new Vector2(0, 1), new Vector2(12, -12), new Vector2(64, 64), new Vector2(0, 1));
                var title = UiKit.Label("Name", row.transform, skill.name, 25, UiKit.Ink, true, TextAnchor.UpperLeft);
                UiKit.Place(title.rectTransform, new Vector2(0, 1), new Vector2(86, -8), new Vector2(270, 32), new Vector2(0, 1));
                // long names shrink instead of wrapping onto the rank pips
                title.resizeTextForBestFit = true;
                title.resizeTextMinSize = 16;
                title.resizeTextMaxSize = 25;
                title.horizontalOverflow = HorizontalWrapMode.Wrap;
                title.verticalOverflow = VerticalWrapMode.Truncate;
                var desc = UiKit.Label("Desc", row.transform, skill.description, 16, UiKit.InkSoft, false, TextAnchor.UpperLeft);
                UiKit.Place(desc.rectTransform, new Vector2(0, 1), new Vector2(86, -70), new Vector2(430, 22), new Vector2(0, 1));
                desc.resizeTextForBestFit = true; // long descriptions shrink to one line
                desc.resizeTextMinSize = 11;
                desc.resizeTextMaxSize = 16;
                desc.verticalOverflow = VerticalWrapMode.Truncate;
                var train = UiKit.Bar("Training", row.transform, UiKit.Rep400, out var trainBar);
                UiKit.Place(trainBar, new Vector2(0, 1), new Vector2(12, -96), new Vector2(64, 14), new Vector2(0, 1));
                var perks = UiKit.Label("Perks", row.transform, "", 15, UiKit.InkSoft, false, TextAnchor.UpperLeft);
                UiKit.Place(perks.rectTransform, new Vector2(0, 1), new Vector2(86, -92), new Vector2(436, 44), new Vector2(0, 1));
                perks.lineSpacing = 0.95f;

                var pips = new Image[content.skillMaxRank + gearMax];
                for (var p = 0; p < pips.Length; p++)
                {
                    var pip = UiKit.OutlinedBox("Pip" + p, row.transform, UiKit.Surface700, 999);
                    UiKit.Place((RectTransform)pip.transform.parent, new Vector2(0, 1), new Vector2(86 + p * 28, -44), new Vector2(22, 22),
                        new Vector2(0, 1));
                    pips[p] = pip;
                    if (p >= content.skillMaxRank) pip.transform.parent.localScale = Vector3.one * 0.8f;
                }
                var bonus = UiKit.Label("Bonus", row.transform, "", 18, UiKit.Buds600, true, TextAnchor.UpperLeft);
                UiKit.Place(bonus.rectTransform, new Vector2(0, 1), new Vector2(86 + pips.Length * 28 + 4, -42), new Vector2(120, 26),
                    new Vector2(0, 1));
                var id = skill.id;
                var upgrade = UiKit.Button("Upgrade", row.transform, "Ulepsz", new Vector2(150, 58), () => onUpgrade(id), UiKit.Tone.Buds,
                    27);
                UiKit.Place((RectTransform)upgrade.transform, new Vector2(1, 1), new Vector2(-10, -10), new Vector2(150, 58), new Vector2(1, 1));
                skillRows.Add((id, pips, upgrade, bonus, train, perks));
            }
        }

        void RefreshSkills()
        {
            pointsText.text = data.Guest
                ? "Umiejętności rozwijasz z połączonym Budem"
                : $"Wolne punkty: {data.Available}";
            var stats = Stats;
            Canvas.ForceUpdateCanvases();
            foreach (var (id, pips, upgrade, bonusText, train, perksText) in skillRows)
            {
                var rank = data.Ranks.TryGetValue(id, out var r) ? r : 0; // spent + trained
                var spent = data.Spent.TryGetValue(id, out var sp) ? Math.Min(sp, rank) : rank;
                var bonus = stats.SkillBonus.TryGetValue(id, out var b) ? b : 0;
                for (var p = 0; p < pips.Length; p++)
                    pips[p].color = p < spent ? UiKit.Buds400 : p < rank ? UiKit.Rep400 : p < rank + bonus ? UiKit.Buds600 : UiKit.Surface700;
                // the extra (gear-only) pips show only when gear fills them
                for (var p = content.skillMaxRank; p < pips.Length; p++)
                    pips[p].transform.parent.gameObject.SetActive(p < rank + bonus);
                bonusText.text = bonus > 0 ? $"+{bonus} z ekwipunku" : "";
                upgrade.interactable = !data.Guest && !data.Loading && data.Available > 0 && rank < content.skillMaxRank;

                // training towards the next rank, and the two special abilities of the skill
                var txp = data.TrainingXp.TryGetValue(id, out var t) ? t : 0;
                var per = content.trainingXpPerRank;
                UiKit.SetBar(train, rank >= content.skillMaxRank ? 1 : (txp % per) / (float)per);
                var parts = new List<string>();
                foreach (var perk in content.perks)
                {
                    if (perk.skill != id) continue;
                    parts.Add(data.Perks.Contains(perk.id) || rank >= perk.rank
                        ? $"<color=#5d9a12><b>{perk.name}</b></color>: {perk.description}"
                        : $"<color=#8a857c>{perk.name} (ranga {perk.rank})</color>");
                }
                var where = rank >= content.skillMaxRank ? "Mistrzostwo!" : $"Trening {txp % per}/{per} XP";
                perksText.text = $"{where}  ·  {string.Join("  ·  ", parts)}";
            }
        }

        // ---------- shop (coins earned in the game; premium = looks only, later) ----------

        // shop layout (page is 1076 × 552): categories | items (4 per row) | the selected item
        const float PageH = 552;
        const float CategoryW = 200, CategoryStep = 62;
        const int ShopCols = 4;
        const float ShopTile = 96, ShopStepX = 112, ShopStepY = 124;
        const float GridX = CategoryW + 18;
        const float CardX = GridX + ShopCols * ShopStepX + 10;
        const float CardW = 1076 - CardX;

        void BuildShop(RectTransform page)
        {
            // categories: every slot (rides too), the drinks and premium, top to bottom; the list scrolls
            var filters = new List<(string id, string name)>();
            foreach (var s in content.slots) filters.Add((s.id, s.name));
            filters.Add((DrinkFilter, "Napoje"));
            filters.Add((PremiumFilter, "Premium"));
            var listBox = UiKit.OutlinedBox("Categories", page, UiKit.Paper300, UiKit.RadiusM);
            listBox.raycastTarget = true; // the list is dragged to scroll
            var listRt = (RectTransform)listBox.transform.parent;
            UiKit.Place(listRt, new Vector2(0, 1), Vector2.zero, new Vector2(CategoryW, PageH), new Vector2(0, 1));
            var viewport = UiKit.Rect("Viewport", listBox.transform);
            UiKit.Stretch(viewport, 10);
            viewport.gameObject.AddComponent<RectMask2D>();
            var list = UiKit.Rect("List", viewport);
            list.anchorMin = new Vector2(0, 1);
            list.anchorMax = Vector2.one;
            list.pivot = new Vector2(0.5f, 1);
            list.sizeDelta = new Vector2(0, filters.Count * CategoryStep);
            list.anchoredPosition = Vector2.zero;
            var scroll = listBox.gameObject.AddComponent<ScrollRect>();
            scroll.viewport = viewport;
            scroll.content = list;
            scroll.horizontal = false;
            scroll.movementType = ScrollRect.MovementType.Clamped;
            scroll.scrollSensitivity = 30;
            for (var i = 0; i < filters.Count; i++)
            {
                var slot = filters[i].id;
                var chip = UiKit.Button("Filter " + slot, list, filters[i].name, new Vector2(CategoryW - 24, CategoryStep - 8), () =>
                {
                    shopSlot = slot;
                    selectedShop = null;
                    RefreshShop();
                }, slot == PremiumFilter ? UiKit.Tone.Gold : UiKit.Tone.Rep, 24);
                var chipText = chip.GetComponentInChildren<Text>();
                chipText.resizeTextForBestFit = true;
                chipText.resizeTextMinSize = 16;
                chipText.resizeTextMaxSize = 24;
                UiKit.Place((RectTransform)chip.transform, new Vector2(0.5f, 1), new Vector2(0, -i * CategoryStep), new Vector2(CategoryW - 24, CategoryStep - 8),
                    new Vector2(0.5f, 1));
                shopFilters.Add((slot, chip));
            }

            shopGrid = UiKit.Rect("Grid", page);
            UiKit.Place(shopGrid, new Vector2(0, 1), new Vector2(GridX, 0), new Vector2(ShopCols * ShopStepX, PageH - 56), new Vector2(0, 1));
            var premium = UiKit.Label("Premium", page,
                "<b>Premium:</b> unikatowe wierzchowce i bronie za gemy. Wyjątkowy wygląd, ta sama moc co przedmioty z gry.", 17,
                UiKit.InkSoft, false, TextAnchor.LowerLeft);
            UiKit.Place(premium.rectTransform, new Vector2(0, 0), new Vector2(GridX, 0), new Vector2(ShopCols * ShopStepX, 48), Vector2.zero);

            var card = UiKit.OutlinedBox("Card", page, UiKit.Paper300, UiKit.RadiusL);
            UiKit.Place((RectTransform)card.transform.parent, new Vector2(0, 1), new Vector2(CardX, 0), new Vector2(CardW, PageH),
                new Vector2(0, 1));
            var iconBox = UiKit.Shape("IconBox", card.transform, UiKit.Surface800, UiKit.RadiusM);
            UiKit.Place(iconBox.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -18), new Vector2(150, 150), new Vector2(0.5f, 1));
            shopIcon = UiKit.Rect("Icon", iconBox.transform).gameObject.AddComponent<Image>();
            shopIcon.preserveAspect = true;
            shopIcon.raycastTarget = false;
            UiKit.Stretch(shopIcon.rectTransform, 14);
            shopTitle = UiKit.Label("Title", card.transform, "", 30, UiKit.Ink, true, TextAnchor.UpperCenter);
            UiKit.Place(shopTitle.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -180), new Vector2(CardW - 30, 44), new Vector2(0.5f, 1));
            shopTitle.resizeTextForBestFit = true;
            shopTitle.resizeTextMinSize = 18;
            shopTitle.resizeTextMaxSize = 30;
            shopDetails = UiKit.Label("Details", card.transform, "", 21, UiKit.Ink, false, TextAnchor.UpperCenter);
            UiKit.Place(shopDetails.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -230), new Vector2(CardW - 30, 200), new Vector2(0.5f, 1));
            shopDetails.lineSpacing = 1.1f;
            shopWallet = UiKit.Label("Wallet", card.transform, "", 21, UiKit.InkSoft, true, TextAnchor.LowerCenter);
            UiKit.Place(shopWallet.rectTransform, new Vector2(0.5f, 0), new Vector2(0, 96), new Vector2(CardW - 20, 30), new Vector2(0.5f, 0));
            shopWallet.resizeTextForBestFit = true;
            shopWallet.resizeTextMinSize = 14;
            shopWallet.resizeTextMaxSize = 21;
            // the one gold action on this screen
            shopBuy = UiKit.Button("Buy", card.transform, "Kup", new Vector2(CardW - 60, 72), () =>
            {
                if (selectedShop != null) onBuy(selectedShop);
            }, UiKit.Tone.Gold, 30);
            UiKit.Place((RectTransform)shopBuy.transform, new Vector2(0.5f, 0), new Vector2(0, 18), new Vector2(CardW - 60, 72),
                new Vector2(0.5f, 0));
            var buyText = shopBuyLabel = shopBuy.GetComponentInChildren<Text>();
            buyText.resizeTextForBestFit = true;
            buyText.resizeTextMinSize = 18;
            buyText.resizeTextMaxSize = 30;
        }

        void RefreshShop()
        {
            foreach (var (slot, chip) in shopFilters)
            {
                var face = chip.transform.Find("Face/Fill")?.GetComponent<Image>();
                if (face) face.color = slot == shopSlot ? UiKit.Buds400 : slot == PremiumFilter ? UiKit.Gold400 : UiKit.Rep400;
            }
            for (var i = shopGrid.childCount - 1; i >= 0; i--) UnityEngine.Object.Destroy(shopGrid.GetChild(i).gameObject);
            var items = new List<ItemData>();
            foreach (var item in content.items)
                if (shopSlot == PremiumFilter ? item.IsPremiumShop
                    : item.shop && item.available && (shopSlot == DrinkFilter ? item.IsDrink : item.slot == shopSlot && !item.IsDrink))
                    items.Add(item);
            items.Sort((a, b) => a.minLevel != b.minLevel ? a.minLevel.CompareTo(b.minLevel) : (a.coins + a.gems).CompareTo(b.coins + b.gems));
            selectedShop ??= items.Count > 0 ? items[0].id : null;
            for (var i = 0; i < items.Count && i < ShopCols * 4; i++)
            {
                var item = items[i];
                var at = new Vector2((i % ShopCols) * ShopStepX, -(i / ShopCols) * ShopStepY);
                var owned = !item.IsDrink && data.Owned.Contains(item.id);
                var locked = item.minLevel > data.Level;
                ItemBox(shopGrid, item, at, ShopTile, item.id == selectedShop, owned, () => SelectShopItem(item.id), locked && !owned);
                // premium prices are gems (gold), the rest coins
                var price = UiKit.Label("Price", shopGrid, owned ? "Masz" : item.IsPremiumShop ? item.gems.ToString() : item.coins.ToString(), 19,
                    owned ? UiKit.Buds600 : item.IsPremiumShop ? UiKit.Gold600 : UiKit.Ink, true, TextAnchor.UpperCenter);
                UiKit.Place(price.rectTransform, new Vector2(0, 1), at + new Vector2(0, -ShopTile - 2), new Vector2(ShopTile, 26), new Vector2(0, 1));
            }

            var selected = selectedShop != null ? content.Item(selectedShop) : null;
            shopWallet.text = data.Guest ? "Grasz jako gość"
                : shopSlot == PremiumFilter ? $"Masz {data.Gems} gemów · gemy kupisz wkrótce"
                : $"Masz {Core.GameBootstrap.Coins(data.Coins)}";
            if (selected == null)
            {
                shopTitle.text = "Sklep";
                shopDetails.text = "";
                shopIcon.enabled = false;
                shopBuy.gameObject.SetActive(false);
                return;
            }
            var r = RarityOf(selected);
            shopIcon.sprite = Icon("Items/" + selected.id);
            shopIcon.enabled = shopIcon.sprite;
            shopTitle.text = selected.name;
            var weapon = string.IsNullOrEmpty(selected.weapon) ? "" : $"\nRuchy: {MovesText(selected.weapon)}";
            var twin = string.IsNullOrEmpty(selected.twin) ? null : content.Item(selected.twin);
            var power = twin != null ? $"\n<size=18>Moc jak: {twin.name} (do zdobycia w grze)</size>" : "";
            var where = selected.IsDrink
                ? $"Napój  ·  masz {(data.Drinks.TryGetValue(selected.id, out var q) ? q : 0)}"
                : $"{SlotName(selected.slot)}  ·  od poz. {selected.minLevel}";
            shopDetails.text =
                $"<color=#{Hex(r.color)}><b>{r.label}</b></color>  ·  {where}\n<b>{Gear.Describe(content, selected)}</b>{weapon}{power}\n<color=#55514a>{selected.description}</color>";
            var have = !selected.IsDrink && data.Owned.Contains(selected.id);
            var tooYoung = selected.minLevel > data.Level;
            shopBuy.gameObject.SetActive(true);
            var gems = selected.IsPremiumShop;
            shopBuyLabel.text = have ? "Już masz" : tooYoung ? $"Od poziomu {selected.minLevel}"
                : gems ? $"Kup za {selected.gems} gemów" : $"Kup za {selected.coins}";
            shopBuy.interactable = !data.Guest && !data.Loading && !have && !tooYoung &&
                                   (gems ? data.Gems >= selected.gems : data.Coins >= selected.coins);
        }

        // ---------- energy drinks ----------

        void BuildDrinks(RectTransform page)
        {
            var title = UiKit.Label("Title", page, "Twoje napoje", 28, UiKit.Ink, true, TextAnchor.UpperLeft);
            UiKit.Place(title.rectTransform, new Vector2(0, 1), Vector2.zero, new Vector2(580, 40), new Vector2(0, 1));
            drinkGrid = UiKit.Rect("Grid", page);
            UiKit.Place(drinkGrid, new Vector2(0, 1), new Vector2(0, -48), new Vector2(580, 260), new Vector2(0, 1));

            var boxes = UiKit.OutlinedBox("Buffs", page, UiKit.Paper300, UiKit.RadiusM);
            UiKit.Place((RectTransform)boxes.transform.parent, new Vector2(0, 1), new Vector2(0, -316), new Vector2(580, 236),
                new Vector2(0, 1));
            var head = UiKit.Label("Head", boxes.transform, "Działa teraz", 24, UiKit.Ink, true, TextAnchor.UpperLeft);
            UiKit.Place(head.rectTransform, new Vector2(0, 1), new Vector2(18, -10), new Vector2(540, 32), new Vector2(0, 1));
            buffsText = UiKit.Label("List", boxes.transform, "", 20, UiKit.Ink, false, TextAnchor.UpperLeft);
            UiKit.Place(buffsText.rectTransform, new Vector2(0, 1), new Vector2(18, -48), new Vector2(540, 184), new Vector2(0, 1));
            buffsText.lineSpacing = 1.1f;

            var card = UiKit.OutlinedBox("Card", page, UiKit.Paper300, UiKit.RadiusL);
            UiKit.Place((RectTransform)card.transform.parent, new Vector2(0, 1), new Vector2(600, 0), new Vector2(476, 552),
                new Vector2(0, 1));
            var iconBox = UiKit.Shape("IconBox", card.transform, UiKit.Surface800, UiKit.RadiusM);
            UiKit.Place(iconBox.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -18), new Vector2(150, 150), new Vector2(0.5f, 1));
            drinkIcon = UiKit.Rect("Icon", iconBox.transform).gameObject.AddComponent<Image>();
            drinkIcon.preserveAspect = true;
            drinkIcon.raycastTarget = false;
            UiKit.Stretch(drinkIcon.rectTransform, 14);
            drinkTitle = UiKit.Label("Title", card.transform, "", 30, UiKit.Ink, true, TextAnchor.UpperCenter);
            UiKit.Place(drinkTitle.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -180), new Vector2(440, 44), new Vector2(0.5f, 1));
            drinkDetails = UiKit.Label("Details", card.transform, "", 21, UiKit.Ink, false, TextAnchor.UpperCenter);
            UiKit.Place(drinkDetails.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -232), new Vector2(430, 220), new Vector2(0.5f, 1));
            drinkDetails.lineSpacing = 1.1f;
            drinkUse = UiKit.Button("Drink", card.transform, "Wypij", new Vector2(300, 72), () =>
            {
                if (selectedDrink != null) onDrink(selectedDrink);
            }, UiKit.Tone.Gold, 30);
            UiKit.Place((RectTransform)drinkUse.transform, new Vector2(0.5f, 0), new Vector2(0, 18), new Vector2(300, 72),
                new Vector2(0.5f, 0));
            drinkUseLabel = drinkUse.GetComponentInChildren<Text>();
        }

        void RefreshDrinks()
        {
            for (var i = drinkGrid.childCount - 1; i >= 0; i--) UnityEngine.Object.Destroy(drinkGrid.GetChild(i).gameObject);
            var all = new List<ItemData>();
            foreach (var item in content.items)
                if (item.IsDrink) all.Add(item);
            if (selectedDrink == null || !data.Drinks.ContainsKey(selectedDrink))
                foreach (var item in all)
                    if (data.Drinks.TryGetValue(item.id, out var n) && n > 0)
                    {
                        selectedDrink = item.id;
                        break;
                    }
            selectedDrink ??= all.Count > 0 ? all[0].id : null;
            for (var i = 0; i < all.Count; i++)
            {
                var item = all[i];
                var count = data.Drinks.TryGetValue(item.id, out var n) ? n : 0;
                var at = new Vector2((i % 5) * 116, -(i / 5) * 132);
                ItemBox(drinkGrid, item, at, 100, item.id == selectedDrink, false, () => SelectDrink(item.id), count == 0, false);
                var label = UiKit.Label("Count", drinkGrid, count > 0 ? $"× {count}" : "brak", 19, count > 0 ? UiKit.Ink : UiKit.InkSoft,
                    true, TextAnchor.UpperCenter);
                UiKit.Place(label.rectTransform, new Vector2(0, 1), at + new Vector2(0, -102), new Vector2(100, 26), new Vector2(0, 1));
            }
            RefreshBuffs();

            var selected = selectedDrink != null ? content.Item(selectedDrink) : null;
            if (selected == null)
            {
                drinkTitle.text = "Napoje";
                drinkDetails.text = "";
                drinkIcon.enabled = false;
                drinkUse.gameObject.SetActive(false);
                return;
            }
            var have = data.Drinks.TryGetValue(selected.id, out var qty) ? qty : 0;
            drinkIcon.sprite = Icon("Items/" + selected.id);
            drinkIcon.enabled = drinkIcon.sprite;
            drinkTitle.text = selected.name;
            drinkDetails.text = $"<b>{Gear.Describe(content, selected)}</b>\n<color=#55514a>{selected.description}</color>\n\nMasz: <b>{have}</b>" +
                                (have == 0 ? "\n<color=#55514a>Kupisz w sklepie albo zdobędziesz w pojedynkach.</color>" : "");
            drinkUse.gameObject.SetActive(true);
            drinkUseLabel.text = have > 0 ? "Wypij" : "Brak";
            drinkUse.interactable = !data.Guest && !data.Loading && have > 0;
        }

        void RefreshBuffs()
        {
            var lines = new List<string>();
            var now = Time.realtimeSinceStartup;
            foreach (var (id, ends) in data.Buffs)
            {
                var left = Mathf.CeilToInt(ends - now);
                if (left <= 0) continue;
                var buff = content.Buff(id);
                lines.Add($"<b>{buff?.name ?? id}</b>  {left / 60}:{left % 60:00}  <color=#55514a>{buff?.description}</color>");
            }
            foreach (var id in data.Perks)
            {
                var perk = content.Perk(id);
                if (perk != null) lines.Add($"<color=#5d9a12><b>{perk.name}</b></color>  <color=#55514a>{perk.description}</color>");
            }
            buffsText.text = lines.Count > 0
                ? string.Join("\n", lines)
                : data.Guest ? "Połącz Buda ze strony, żeby pić napoje." : "Nic nie działa. Wypij napój albo wytrenuj umiejętność do rangi 3.";
        }

        string MovesText(string weapon)
        {
            var names = new List<string>();
            foreach (var id in content.MovesFor(weapon))
                if (id != "garda") names.Add(content.Move(id)?.name ?? id);
            return string.Join(", ", names);
        }

        Sprite Icon(string path)
        {
            if (icons.TryGetValue(path, out var cached)) return cached;
            var tex = Resources.Load<Texture2D>(path);
            var sprite = tex ? Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f), 100) : null;
            icons[path] = sprite;
            return sprite;
        }
    }
}
