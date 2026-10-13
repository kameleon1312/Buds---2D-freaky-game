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
        public readonly Dictionary<string, int> Ranks = new();
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
    /// change); skills (points from levels); the coin shop. Opened from the HUD button or with I / Tab / C.
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

        const int Tabs = 4;

        readonly QuestContent content;
        readonly Action<string> onUpgrade;
        readonly Action<string, string> onEquip;
        readonly Action<string> onBuy;
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
        readonly List<(string id, Image[] pips, Button upgrade, Text bonus)> skillRows = new();

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
            Action<string> onBuy)
        {
            this.content = content;
            this.onUpgrade = onUpgrade;
            this.onEquip = onEquip;
            this.onBuy = onBuy;

            var dim = UiKit.Panel("BudPanel", canvas, new Color(0.086f, 0.094f, 0.122f, 0.72f));
            dim.raycastTarget = true; // blocks taps on the world behind
            UiKit.Stretch(dim.rectTransform);
            root = dim.gameObject;

            var group = UiKit.Rect("Group", dim.transform);
            UiKit.Place(group, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(1180, 820));
            group.gameObject.AddComponent<FitInParent>();
            var body = UiKit.Window("Window", group, new Vector2(1140, 800), "Twój Bud", Hide, out var window, out _);
            UiKit.Place(window, new Vector2(0.5f, 0.5f), Vector2.zero, window.sizeDelta);

            string[] names = { "Profil", "Ekwipunek", "Umiejętności", "Sklep" };
            for (var i = 0; i < Tabs; i++)
            {
                var index = i;
                tabs[i] = UiKit.Button("Tab" + i, body, names[i], new Vector2(256, 60), () => ShowTab(index), UiKit.Tone.Rep, 28);
                UiKit.Place((RectTransform)tabs[i].transform, new Vector2(0, 1), new Vector2(i * 270, 0), new Vector2(256, 60),
                    new Vector2(0, 1));
                pages[i] = UiKit.Rect(names[i], body);
                UiKit.Stretch(pages[i], 0, 0, 0, 78);
            }
            BuildProfile(pages[0]);
            BuildGear(pages[1]);
            BuildSkills(pages[2]);
            BuildShop(pages[3]);
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
            RefreshShop();
        }

        public GearStats Stats => Gear.Stats(content, data.Equipped.Values, data.Ranks);

        public void Refresh(BudPanelData panelData)
        {
            data = panelData;
            RefreshProfile();
            RefreshGear();
            RefreshSkills();
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
            UiKit.Place(statsText.rectTransform, new Vector2(0, 1), new Vector2(330, -150), new Vector2(740, 400), new Vector2(0, 1));
            statsText.lineSpacing = 1.05f;
        }

        void RefreshProfile()
        {
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
            if (data.Guest) sb.Append("\n<i>Grasz jako gość — połącz Buda ze strony, żeby zapisywać postępy.</i>");
            else if (data.Loading) sb.Append("\n<i>Wczytuję dane z serwera…</i>");
            else if (data.Error != null) sb.Append($"\n<color=#bd1c31>{data.Error}</color>");
            statsText.text = sb.ToString();
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
            UiKit.Place(pickerGrid, new Vector2(0, 1), new Vector2(500, -284), new Vector2(576, 184), new Vector2(0, 1));

            var details = UiKit.OutlinedBox("Details", page, UiKit.Paper300, UiKit.RadiusM);
            UiKit.Place((RectTransform)details.transform.parent, new Vector2(0, 1), new Vector2(500, -474), new Vector2(576, 88),
                new Vector2(0, 1));
            gearDetails = UiKit.Label("Text", details.transform, "", 20, UiKit.Ink, false, TextAnchor.MiddleLeft);
            UiKit.Stretch(gearDetails.rectTransform, 16, 4, 190, 4);
            gearAction = UiKit.Button("Action", details.transform, "Załóż", new Vector2(164, 62), GearAction, UiKit.Tone.Gold, 28);
            UiKit.Place((RectTransform)gearAction.transform, new Vector2(1, 0.5f), new Vector2(-14, 2), new Vector2(164, 62),
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
            UiKit.Stretch(label.rectTransform, -10, 0, -10, 0);
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
            bool locked = false)
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
            if (locked)
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
                "Za każdy nowy poziom dostajesz punkt. Ekwipunek może dodać do 2 poziomów (zielone kropki).", 20,
                UiKit.InkSoft, false, TextAnchor.UpperLeft);
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
                var desc = UiKit.Label("Desc", row.transform, skill.description, 17, UiKit.InkSoft, false, TextAnchor.UpperLeft);
                UiKit.Place(desc.rectTransform, new Vector2(0, 1), new Vector2(86, -74), new Vector2(430, 50), new Vector2(0, 1));

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
                var upgrade = UiKit.Button("Upgrade", row.transform, "Ulepsz", new Vector2(132, 50), () => onUpgrade(id), UiKit.Tone.Buds,
                    24);
                UiKit.Place((RectTransform)upgrade.transform, new Vector2(1, 1), new Vector2(-12, -12), new Vector2(132, 50), new Vector2(1, 1));
                skillRows.Add((id, pips, upgrade, bonus));
            }
        }

        void RefreshSkills()
        {
            pointsText.text = data.Guest
                ? "Umiejętności rozwijasz z połączonym Budem"
                : $"Wolne punkty: {data.Available}";
            var stats = Stats;
            foreach (var (id, pips, upgrade, bonusText) in skillRows)
            {
                var rank = data.Ranks.TryGetValue(id, out var r) ? r : 0;
                var bonus = stats.SkillBonus.TryGetValue(id, out var b) ? b : 0;
                for (var p = 0; p < pips.Length; p++)
                    pips[p].color = p < rank ? UiKit.Buds400 : p < rank + bonus ? UiKit.Buds600 : UiKit.Surface700;
                // the extra (gear-only) pips show only when gear fills them
                for (var p = content.skillMaxRank; p < pips.Length; p++)
                    pips[p].transform.parent.gameObject.SetActive(p < rank + bonus);
                bonusText.text = bonus > 0 ? $"+{bonus} z ekwipunku" : "";
                upgrade.interactable = !data.Guest && !data.Loading && data.Available > 0 && rank < content.skillMaxRank;
            }
        }

        // ---------- shop (coins earned in the game; premium = looks only, later) ----------

        void BuildShop(RectTransform page)
        {
            // slot filter: two rows of four
            for (var i = 0; i < content.slots.Length && i < 8; i++)
            {
                var slot = content.slots[i].id;
                var chip = UiKit.Button("Filter " + slot, page, content.slots[i].name, new Vector2(136, 46), () =>
                {
                    shopSlot = slot;
                    selectedShop = null;
                    RefreshShop();
                }, UiKit.Tone.Rep, 20);
                UiKit.Place((RectTransform)chip.transform, new Vector2(0, 1), new Vector2((i % 4) * 146, -(i / 4) * 56), new Vector2(136, 46),
                    new Vector2(0, 1));
                shopFilters.Add((slot, chip));
            }
            shopGrid = UiKit.Rect("Grid", page);
            UiKit.Place(shopGrid, new Vector2(0, 1), new Vector2(0, -122), new Vector2(580, 400), new Vector2(0, 1));
            var premium = UiKit.Label("Premium", page,
                "<b>Wkrótce:</b> stroje premium za prawdziwe pieniądze. Tylko wygląd: nigdy nie dają przewagi.", 18,
                UiKit.InkSoft, false, TextAnchor.LowerLeft);
            UiKit.Place(premium.rectTransform, new Vector2(0, 0), new Vector2(0, 0), new Vector2(570, 44), Vector2.zero);

            var card = UiKit.OutlinedBox("Card", page, UiKit.Paper300, UiKit.RadiusL);
            UiKit.Place((RectTransform)card.transform.parent, new Vector2(0, 1), new Vector2(600, 0), new Vector2(476, 562),
                new Vector2(0, 1));
            var iconBox = UiKit.Shape("IconBox", card.transform, UiKit.Surface800, UiKit.RadiusM);
            UiKit.Place(iconBox.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -18), new Vector2(150, 150), new Vector2(0.5f, 1));
            shopIcon = UiKit.Rect("Icon", iconBox.transform).gameObject.AddComponent<Image>();
            shopIcon.preserveAspect = true;
            shopIcon.raycastTarget = false;
            UiKit.Stretch(shopIcon.rectTransform, 14);
            shopTitle = UiKit.Label("Title", card.transform, "", 30, UiKit.Ink, true, TextAnchor.UpperCenter);
            UiKit.Place(shopTitle.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -180), new Vector2(440, 44), new Vector2(0.5f, 1));
            shopTitle.resizeTextForBestFit = true;
            shopTitle.resizeTextMinSize = 18;
            shopTitle.resizeTextMaxSize = 30;
            shopDetails = UiKit.Label("Details", card.transform, "", 21, UiKit.Ink, false, TextAnchor.UpperCenter);
            UiKit.Place(shopDetails.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -232), new Vector2(430, 200), new Vector2(0.5f, 1));
            shopDetails.lineSpacing = 1.1f;
            shopWallet = UiKit.Label("Wallet", card.transform, "", 21, UiKit.InkSoft, true, TextAnchor.LowerCenter);
            UiKit.Place(shopWallet.rectTransform, new Vector2(0.5f, 0), new Vector2(0, 96), new Vector2(430, 30), new Vector2(0.5f, 0));
            // the one gold action on this screen
            shopBuy = UiKit.Button("Buy", card.transform, "Kup", new Vector2(300, 72), () =>
            {
                if (selectedShop != null) onBuy(selectedShop);
            }, UiKit.Tone.Gold, 30);
            UiKit.Place((RectTransform)shopBuy.transform, new Vector2(0.5f, 0), new Vector2(0, 18), new Vector2(300, 72),
                new Vector2(0.5f, 0));
            shopBuyLabel = shopBuy.GetComponentInChildren<Text>();
        }

        void RefreshShop()
        {
            foreach (var (slot, chip) in shopFilters)
            {
                var face = chip.transform.Find("Face/Fill")?.GetComponent<Image>();
                if (face) face.color = slot == shopSlot ? UiKit.Buds400 : UiKit.Rep400;
            }
            for (var i = shopGrid.childCount - 1; i >= 0; i--) UnityEngine.Object.Destroy(shopGrid.GetChild(i).gameObject);
            var items = new List<ItemData>();
            foreach (var item in content.items)
                if (item.shop && item.available && item.slot == shopSlot) items.Add(item);
            items.Sort((a, b) => a.minLevel != b.minLevel ? a.minLevel.CompareTo(b.minLevel) : a.coins.CompareTo(b.coins));
            selectedShop ??= items.Count > 0 ? items[0].id : null;
            for (var i = 0; i < items.Count && i < 15; i++)
            {
                var item = items[i];
                var at = new Vector2((i % 5) * 116, -(i / 5) * 132);
                var owned = data.Owned.Contains(item.id);
                var locked = item.minLevel > data.Level;
                ItemBox(shopGrid, item, at, 100, item.id == selectedShop, owned, () => SelectShopItem(item.id), locked && !owned);
                var price = UiKit.Label("Price", shopGrid, owned ? "Masz" : item.coins.ToString(), 19,
                    owned ? UiKit.Buds600 : UiKit.Ink, true, TextAnchor.UpperCenter);
                UiKit.Place(price.rectTransform, new Vector2(0, 1), at + new Vector2(0, -102), new Vector2(100, 26), new Vector2(0, 1));
            }

            var selected = selectedShop != null ? content.Item(selectedShop) : null;
            shopWallet.text = data.Guest ? "Grasz jako gość" : $"Masz {Core.GameBootstrap.Coins(data.Coins)}";
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
            shopDetails.text =
                $"<color=#{Hex(r.color)}><b>{r.label}</b></color>  ·  {SlotName(selected.slot)}  ·  od poz. {selected.minLevel}\n<b>{Gear.Describe(content, selected)}</b>{weapon}\n<color=#55514a>{selected.description}</color>";
            var have = data.Owned.Contains(selected.id);
            var tooYoung = selected.minLevel > data.Level;
            shopBuy.gameObject.SetActive(true);
            shopBuyLabel.text = have ? "Już masz" : tooYoung ? $"Od poziomu {selected.minLevel}" : $"Kup za {selected.coins}";
            shopBuy.interactable = !data.Guest && !data.Loading && !have && !tooYoung && data.Coins >= selected.coins;
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
