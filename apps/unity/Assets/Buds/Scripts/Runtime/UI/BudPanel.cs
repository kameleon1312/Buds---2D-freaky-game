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
    /// "Twój Bud": profile, inventory (worn + earned items with rarity frames) and skills (spend points earned
    /// from levels — the server validates every upgrade). Opened from the HUD button or with I / Tab / C.
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

        static readonly Dictionary<string, string> Kinds = new()
        {
            ["outfit"] = "Strój",
            ["headwear"] = "Na głowę",
            ["accessory"] = "Dodatek",
            ["weapon"] = "Broń",
            ["character"] = "Postać",
            ["emote"] = "Emotka",
            ["district"] = "Dzielnica",
        };

        readonly QuestContent content;
        readonly Action<string> onUpgrade;
        readonly GameObject root;
        readonly RectTransform[] pages = new RectTransform[3];
        readonly Button[] tabs = new Button[3];
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

        // inventory
        RectTransform wornRow;
        RectTransform ownedGrid;
        Text ownedEmpty;
        Text itemDetails;

        // skills
        Text pointsText;
        readonly List<(string id, Image[] pips, Button upgrade)> skillRows = new();

        public bool IsOpen => root.activeSelf;

        public BudPanel(Transform canvas, QuestContent content, Action<string> onUpgrade)
        {
            this.content = content;
            this.onUpgrade = onUpgrade;

            var dim = UiKit.Panel("BudPanel", canvas, new Color(0.086f, 0.094f, 0.122f, 0.72f));
            dim.raycastTarget = true; // blocks taps on the world behind
            UiKit.Stretch(dim.rectTransform);
            root = dim.gameObject;

            var group = UiKit.Rect("Group", dim.transform);
            UiKit.Place(group, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(1080, 720));
            group.gameObject.AddComponent<FitInParent>();
            var body = UiKit.Window("Window", group, new Vector2(1040, 700), "Twój Bud", Hide, out var window, out _);
            UiKit.Place(window, new Vector2(0.5f, 0.5f), Vector2.zero, window.sizeDelta);

            string[] names = { "Profil", "Ekwipunek", "Umiejętności" };
            for (var i = 0; i < 3; i++)
            {
                var index = i;
                tabs[i] = UiKit.Button("Tab" + i, body, names[i], new Vector2(250, 60), () => ShowTab(index), UiKit.Tone.Rep, 28);
                UiKit.Place((RectTransform)tabs[i].transform, new Vector2(0, 1), new Vector2(i * 266, 0), new Vector2(250, 60),
                    new Vector2(0, 1));
                pages[i] = UiKit.Rect(names[i], body);
                UiKit.Stretch(pages[i], 0, 0, 0, 78);
            }
            BuildProfile(pages[0]);
            BuildInventory(pages[1]);
            BuildSkills(pages[2]);
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

        public void SelectTab(int index) => ShowTab(Mathf.Clamp(index, 0, 2));

        public void Refresh(BudPanelData panelData)
        {
            data = panelData;
            RefreshProfile();
            RefreshInventory();
            RefreshSkills();
        }

        void ShowTab(int index)
        {
            tab = index;
            for (var i = 0; i < 3; i++)
            {
                pages[i].gameObject.SetActive(i == index);
                // active tab in the confirm colour, the others secondary
                var face = tabs[i].transform.Find("Face/Fill")?.GetComponent<Image>();
                if (face) face.color = i == index ? UiKit.Buds400 : UiKit.Rep400;
            }
        }

        // ---------- profile ----------

        void BuildProfile(RectTransform page)
        {
            var card = UiKit.OutlinedBox("PortraitCard", page, UiKit.Paper300, UiKit.RadiusL);
            UiKit.Place((RectTransform)card.transform.parent, new Vector2(0, 1), Vector2.zero, new Vector2(270, 400), new Vector2(0, 1));
            portrait = UiKit.Rect("Portrait", card.transform).gameObject.AddComponent<Image>();
            portrait.preserveAspect = true;
            portrait.raycastTarget = false;
            UiKit.Stretch(portrait.rectTransform, 16);

            nameText = UiKit.Label("Name", page, "", 50, UiKit.Ink, true, TextAnchor.UpperLeft);
            UiKit.Place(nameText.rectTransform, new Vector2(0, 1), new Vector2(300, 0), new Vector2(580, 66), new Vector2(0, 1));

            var badge = UiKit.OutlinedBox("Level", page, UiKit.Buds400, 999);
            UiKit.Place((RectTransform)badge.transform.parent, new Vector2(0, 1), new Vector2(300, -66), new Vector2(68, 68),
                new Vector2(0, 1));
            levelText = UiKit.Outlined("Num", badge.transform, "", 40);
            UiKit.Stretch(levelText.rectTransform, 0, 4, 0, 0);

            xpFill = UiKit.Bar("Xp", page, UiKit.XpFill, out var bar);
            UiKit.Place(bar, new Vector2(0, 1), new Vector2(384, -78), new Vector2(520, 42), new Vector2(0, 1));
            xpText = UiKit.Outlined("Value", bar, "", 24);
            UiKit.Stretch(xpText.rectTransform, 0, 2, 0, 0);

            statsText = UiKit.Label("Stats", page, "", 23, UiKit.Ink, false, TextAnchor.UpperLeft);
            UiKit.Place(statsText.rectTransform, new Vector2(0, 1), new Vector2(300, -150), new Vector2(660, 320), new Vector2(0, 1));
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

            var sb = new System.Text.StringBuilder();
            sb.Append($"<b>Zadania:</b> {data.QuestsDone} / {data.QuestsTotal}\n");
            sb.Append($"<b>Portfel:</b> {data.Coins} monet · {data.Gems} gemów\n");
            sb.Append($"<b>Punkty umiejętności:</b> {data.Available} wolne z {data.Points}\n");
            sb.Append("<b>Dzielnice:</b>\n");
            foreach (var (name, level, open) in data.Districts)
                sb.Append(open ? $"   <color=#5d9a12>{name}</color> — otwarta\n" : $"   <color=#55514a>{name} — od poziomu {level}</color>\n");
            if (data.Guest) sb.Append("\n<i>Grasz jako gość — połącz Buda ze strony, żeby zapisywać postępy.</i>");
            else if (data.Loading) sb.Append("\n<i>Wczytuję dane z serwera…</i>");
            else if (data.Error != null) sb.Append($"\n<color=#bd1c31>{data.Error}</color>");
            statsText.text = sb.ToString();
        }

        // ---------- inventory ----------

        void BuildInventory(RectTransform page)
        {
            var worn = UiKit.Label("WornTitle", page, "Na sobie", 30, UiKit.Ink, true, TextAnchor.UpperLeft);
            UiKit.Place(worn.rectTransform, new Vector2(0, 1), Vector2.zero, new Vector2(400, 40), new Vector2(0, 1));
            wornRow = UiKit.Rect("Worn", page);
            UiKit.Place(wornRow, new Vector2(0, 1), new Vector2(0, -44), new Vector2(900, 110), new Vector2(0, 1));

            var owned = UiKit.Label("OwnedTitle", page, "Zdobyte", 30, UiKit.Ink, true, TextAnchor.UpperLeft);
            UiKit.Place(owned.rectTransform, new Vector2(0, 1), new Vector2(0, -170), new Vector2(400, 40), new Vector2(0, 1));
            ownedGrid = UiKit.Rect("Owned", page);
            UiKit.Place(ownedGrid, new Vector2(0, 1), new Vector2(0, -214), new Vector2(960, 230), new Vector2(0, 1));
            ownedEmpty = UiKit.Label("Empty", ownedGrid, "Tu pojawią się przedmioty zdobyte w zadaniach i w sklepie.", 24,
                UiKit.InkSoft, false, TextAnchor.UpperLeft);
            UiKit.Stretch(ownedEmpty.rectTransform);

            var details = UiKit.OutlinedBox("Details", page, UiKit.Paper300, UiKit.RadiusM);
            UiKit.Place((RectTransform)details.transform.parent, new Vector2(0, 0), Vector2.zero, new Vector2(900, 64), Vector2.zero);
            itemDetails = UiKit.Label("Text", details.transform, "Wybierz przedmiot, żeby zobaczyć szczegóły.", 24, UiKit.Ink, false,
                TextAnchor.MiddleLeft);
            UiKit.Stretch(itemDetails.rectTransform, 18, 4, 18, 4);
        }

        void RefreshInventory()
        {
            FillSlots(wornRow, data.Worn, 8);
            FillSlots(ownedGrid, data.Owned, 16);
            ownedEmpty.transform.SetAsLastSibling();
            ownedEmpty.gameObject.SetActive(data.Owned.Count == 0);
        }

        void FillSlots(RectTransform parent, List<string> ids, int max)
        {
            for (var i = parent.childCount - 1; i >= 0; i--)
            {
                var child = parent.GetChild(i);
                if (child.name.StartsWith("Slot")) UnityEngine.Object.Destroy(child.gameObject);
            }
            for (var i = 0; i < ids.Count && i < max; i++)
            {
                var id = ids[i];
                var item = content.Item(id);
                var rarity = Rarity.TryGetValue(item?.rarity ?? "common", out var r) ? r : Rarity["common"];

                var slot = UiKit.Rect("Slot " + id, parent);
                UiKit.Place(slot, new Vector2(0, 1), new Vector2((i % 8) * 112, -(i / 8) * 112), new Vector2(100, 100),
                    new Vector2(0, 1));
                var frame = UiKit.OutlinedBox("Frame", slot, rarity.color, UiKit.RadiusM);
                UiKit.Stretch((RectTransform)frame.transform.parent);
                var inner = UiKit.Shape("Inner", frame.transform, UiKit.Surface800, UiKit.RadiusM - 6);
                UiKit.Stretch(inner.rectTransform, 5);
                var icon = UiKit.Rect("Icon", inner.transform).gameObject.AddComponent<Image>();
                icon.sprite = Icon("Items/" + id);
                icon.preserveAspect = true;
                icon.raycastTarget = false;
                UiKit.Stretch(icon.rectTransform, 8);

                frame.raycastTarget = true;
                var button = slot.gameObject.AddComponent<Button>();
                button.targetGraphic = frame;
                button.onClick.AddListener(() =>
                    itemDetails.text = item == null
                        ? id
                        : $"<b>{item.name}</b>  ·  <color=#{ColorUtility.ToHtmlStringRGB(rarity.color * 0.8f)}>{rarity.label}</color>  ·  {(Kinds.TryGetValue(item.kind, out var k) ? k : item.kind)}");
            }
        }

        // ---------- skills ----------

        void BuildSkills(RectTransform page)
        {
            pointsText = UiKit.Label("Points", page, "", 28, UiKit.Ink, true, TextAnchor.UpperLeft);
            UiKit.Place(pointsText.rectTransform, new Vector2(0, 1), Vector2.zero, new Vector2(900, 40), new Vector2(0, 1));
            var note = UiKit.Label("Note", page, "Za każdy nowy poziom dostajesz punkt. Umiejętności zadziałają w walkach i mini-grach.", 20,
                UiKit.InkSoft, false, TextAnchor.UpperLeft);
            UiKit.Place(note.rectTransform, new Vector2(0, 1), new Vector2(0, -40), new Vector2(900, 30), new Vector2(0, 1));

            for (var i = 0; i < content.skills.Length; i++)
            {
                var skill = content.skills[i];
                var row = UiKit.OutlinedBox("Skill " + skill.id, page, UiKit.Paper300, UiKit.RadiusM);
                var rt = (RectTransform)row.transform.parent;
                UiKit.Place(rt, new Vector2(0, 1), new Vector2((i % 2) * 496, -70 - (i / 2) * 130), new Vector2(480, 124),
                    new Vector2(0, 1));
                var icon = UiKit.Rect("Icon", row.transform).gameObject.AddComponent<Image>();
                icon.sprite = Icon("Skills/" + skill.id);
                icon.preserveAspect = true;
                icon.raycastTarget = false;
                UiKit.Place(icon.rectTransform, new Vector2(0, 1), new Vector2(12, -12), new Vector2(64, 64), new Vector2(0, 1));
                var title = UiKit.Label("Name", row.transform, skill.name, 25, UiKit.Ink, true, TextAnchor.UpperLeft);
                UiKit.Place(title.rectTransform, new Vector2(0, 1), new Vector2(86, -8), new Vector2(240, 32), new Vector2(0, 1));
                // long names shrink instead of wrapping onto the rank pips
                title.resizeTextForBestFit = true;
                title.resizeTextMinSize = 16;
                title.resizeTextMaxSize = 25;
                title.horizontalOverflow = HorizontalWrapMode.Wrap;
                title.verticalOverflow = VerticalWrapMode.Truncate;
                var desc = UiKit.Label("Desc", row.transform, skill.description, 16, UiKit.InkSoft, false, TextAnchor.UpperLeft);
                UiKit.Place(desc.rectTransform, new Vector2(0, 1), new Vector2(86, -70), new Vector2(380, 46), new Vector2(0, 1));

                var pips = new Image[content.skillMaxRank];
                for (var p = 0; p < pips.Length; p++)
                {
                    var pip = UiKit.OutlinedBox("Pip" + p, row.transform, UiKit.Surface700, 999);
                    UiKit.Place((RectTransform)pip.transform.parent, new Vector2(0, 1), new Vector2(86 + p * 28, -42), new Vector2(22, 22),
                        new Vector2(0, 1));
                    pips[p] = pip;
                }
                var id = skill.id;
                var upgrade = UiKit.Button("Upgrade", row.transform, "Ulepsz", new Vector2(132, 50), () => onUpgrade(id), UiKit.Tone.Buds,
                    24);
                UiKit.Place((RectTransform)upgrade.transform, new Vector2(1, 1), new Vector2(-12, -12), new Vector2(132, 50), new Vector2(1, 1));
                skillRows.Add((id, pips, upgrade));
            }
        }

        void RefreshSkills()
        {
            pointsText.text = data.Guest
                ? "Umiejętności rozwijasz z połączonym Budem"
                : $"Wolne punkty: {data.Available}";
            foreach (var (id, pips, upgrade) in skillRows)
            {
                var rank = data.Ranks.TryGetValue(id, out var r) ? r : 0;
                for (var p = 0; p < pips.Length; p++) pips[p].color = p < rank ? UiKit.Buds400 : UiKit.Surface700;
                upgrade.interactable = !data.Guest && !data.Loading && data.Available > 0 && rank < pips.Length;
            }
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
