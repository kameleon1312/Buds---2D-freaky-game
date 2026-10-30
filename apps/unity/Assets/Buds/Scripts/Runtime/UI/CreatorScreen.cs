using System;
using System.Collections.Generic;
using Buds.Api;
using Buds.Characters;
using UnityEngine;
using UnityEngine.UI;

namespace Buds.UI
{
    /// <summary>
    /// "Stwórz Buda" in the game, so a phone needs no website: gender, mood and skin, then hair, top, legs and shoes —
    /// each from its gender's standard catalog, each with its colours — and a name. The look is drawn by the server
    /// (packages/shared, never ported to C#): a preview sheet is fetched a moment after every change.
    /// </summary>
    public sealed class CreatorScreen
    {
        const float PreviewDelay = 0.3f;
        static readonly string[] Tabs = { "Postać", "Włosy", "Twarz", "Góra", "Nogi", "Buty", "Dodatki" };

        readonly Func<BudLookDto, Awaitable<Texture2D>> preview;
        readonly Action<string, BudLookDto> onCreate;
        readonly Action onBack;
        readonly GameObject root;
        readonly Image portrait;
        readonly Text status;
        readonly RectTransform options;
        readonly Button[] tabButtons = new Button[Tabs.Length];
        readonly InputField nameField;
        readonly Button createButton;
        readonly Text error;
        static Sprite disc;
        LookOptionsDto data;
        ScrollRect optionsScroll;
        int tab;
        Facing facing = Facing.Down;
        BudSheet sheet;
        float changedAt = -1;
        bool loading;
        System.Random random = new();

        public BudLookDto Look { get; private set; } = new()
        {
            gender = "on", mood = "radosny", skin = 1, hair = "krotkie", hairColor = 1, outfit = "bluza", outfitColor = 0,
            pants = "jeansy", pantsColor = 0, shoes = "trampki", shoesColor = 0,
        };

        public bool IsOpen => root.activeSelf;
        Text titleText;
        Text nameLabel;
        Text backLabel;
        Action<BudLookDto> editSave;
        Action editCancel;

        public CreatorScreen(Transform canvas, Func<BudLookDto, Awaitable<Texture2D>> preview, Action<string, BudLookDto> onCreate,
            Action onBack)
        {
            this.preview = preview;
            this.onCreate = onCreate;
            this.onBack = onBack;
            disc ??= UiKit.Circle(32);

            var bg = UiKit.Panel("Creator", canvas, UiKit.Surface900);
            bg.raycastTarget = true;
            UiKit.Stretch(bg.rectTransform);
            root = bg.gameObject;
            var group = UiKit.Rect("Group", bg.transform);
            UiKit.Place(group, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(1180, 820));
            group.gameObject.AddComponent<FitInParent>();
            var body = UiKit.Window("Window", group, new Vector2(1140, 800), "Stwórz Buda", null, out var window, out titleText);
            UiKit.Place(window, new Vector2(0.5f, 0.5f), Vector2.zero, window.sizeDelta);

            // the preview
            var stage = UiKit.OutlinedBox("Stage", body, UiKit.Paper300, UiKit.RadiusL);
            UiKit.Place((RectTransform)stage.transform.parent, new Vector2(0, 1), Vector2.zero, new Vector2(380, 496), new Vector2(0, 1));
            portrait = UiKit.Rect("Portrait", stage.transform).gameObject.AddComponent<Image>();
            portrait.preserveAspect = true;
            portrait.raycastTarget = false;
            UiKit.Stretch(portrait.rectTransform, 24);
            status = UiKit.Label("Status", stage.transform, "", 22, UiKit.InkSoft, false, TextAnchor.LowerCenter);
            UiKit.Stretch(status.rectTransform, 8);
            var turn = UiKit.Button("Turn", body, "Obróć", new Vector2(182, 62), Turn, UiKit.Tone.Rep, 26);
            UiKit.Place((RectTransform)turn.transform, new Vector2(0, 1), new Vector2(0, -508), new Vector2(182, 62), new Vector2(0, 1));
            var dice = UiKit.Button("Random", body, "Losuj", new Vector2(182, 62), Randomize, UiKit.Tone.Rep, 26);
            UiKit.Place((RectTransform)dice.transform, new Vector2(0, 1), new Vector2(198, -508), new Vector2(182, 62), new Vector2(0, 1));

            // part tabs and their options
            for (var i = 0; i < Tabs.Length; i++)
            {
                var index = i;
                tabButtons[i] = UiKit.Button("Tab" + i, body, Tabs[i], new Vector2(92, 56), () => ShowTab(index), UiKit.Tone.Rep, 19);
                UiKit.Place((RectTransform)tabButtons[i].transform, new Vector2(0, 1), new Vector2(404 + i * 97, 0), new Vector2(92, 56),
                    new Vector2(0, 1));
            }
            // the options scroll: the catalogs have grown past what fits at once
            var optionsView = UiKit.Rect("OptionsView", body);
            UiKit.Place(optionsView, new Vector2(0, 1), new Vector2(404, -72), new Vector2(672, 440), new Vector2(0, 1));
            optionsView.gameObject.AddComponent<RectMask2D>();
            var hit = optionsView.gameObject.AddComponent<Image>();
            hit.color = Color.clear;
            options = UiKit.Rect("Options", optionsView);
            UiKit.Place(options, new Vector2(0, 1), Vector2.zero, new Vector2(672, 440), new Vector2(0, 1));
            optionsScroll = optionsView.gameObject.AddComponent<ScrollRect>();
            optionsScroll.content = options;
            optionsScroll.horizontal = false;
            optionsScroll.movementType = ScrollRect.MovementType.Clamped;
            optionsScroll.scrollSensitivity = 30;

            // name and the one gold action
            var nameLabel = UiKit.Label("NameLabel", body, "Imię", 22, UiKit.InkSoft, true, TextAnchor.LowerLeft);
            UiKit.Place(nameLabel.rectTransform, new Vector2(0, 1), new Vector2(404, -516), new Vector2(300, 30), new Vector2(0, 1));
            this.nameLabel = nameLabel;
            nameField = UiKit.Input("Name", body, new Vector2(360, 76), "np. Zuzia", 34);
            UiKit.Place((RectTransform)nameField.transform.parent, new Vector2(0, 1), new Vector2(404, -550), new Vector2(360, 76), new Vector2(0, 1));
            nameField.characterLimit = 16;
            createButton = UiKit.Button("Create", body, "Stwórz Buda", new Vector2(296, 80), Create, UiKit.Tone.Gold, 32);
            UiKit.Place((RectTransform)createButton.transform, new Vector2(1, 1), new Vector2(0, -548), new Vector2(296, 80), new Vector2(1, 1));
            error = UiKit.Label("Error", body, "", 22, UiKit.Alert700, false, TextAnchor.UpperLeft);
            UiKit.Place(error.rectTransform, new Vector2(0, 1), new Vector2(404, -632), new Vector2(672, 30), new Vector2(0, 1));
            var back = UiKit.Button("Back", body, "Mam kod ze strony", new Vector2(380, 48), Back, UiKit.Tone.Rep, 22);
            backLabel = back.GetComponentInChildren<Text>();
            UiKit.Place((RectTransform)back.transform, new Vector2(0, 0), Vector2.zero, new Vector2(380, 48), Vector2.zero);
            root.SetActive(false);
        }

        /// <summary>The look editor of an existing bud: its look to start from, no name field, "Zapisz wygląd".</summary>
        public void ShowEdit(LookOptionsDto options, BudLookDto current, Action<BudLookDto> save, Action cancel)
        {
            editSave = save;
            editCancel = cancel;
            Look = current.Clone();
            titleText.text = "Zmień wygląd";
            nameLabel.gameObject.SetActive(false);
            nameField.transform.parent.gameObject.SetActive(false);
            backLabel.text = UiKit.Keys("Anuluj");
            Open(options);
        }

        public void Show(LookOptionsDto options)
        {
            editSave = null;
            editCancel = null;
            titleText.text = "Stwórz Buda";
            nameLabel.gameObject.SetActive(true);
            nameField.transform.parent.gameObject.SetActive(true);
            backLabel.text = "Mam kod ze strony";
            Open(options);
        }

        public bool Editing => editSave != null;

        void Back()
        {
            if (Editing) editCancel?.Invoke();
            else onBack();
        }

        void Open(LookOptionsDto options)
        {
            data = options;
            root.SetActive(true);
            root.transform.SetAsLastSibling();
            error.text = "";
            SetBusy(false);
            ShowTab(0);
            Changed();
        }

        public void Hide() => root.SetActive(false);

        public void SetBusy(bool busy, string message = null)
        {
            createButton.interactable = !busy;
            createButton.GetComponentInChildren<Text>().text = Editing ? busy ? "Zapisuję…" : "Zapisz wygląd" : busy ? "Tworzę…" : "Stwórz Buda";
            if (message != null) error.text = message;
        }

        public string Name
        {
            get => nameField.text;
            set => nameField.text = value;
        }

        /// <summary>Called every frame: fetches the preview once the player stops changing things.</summary>
        public void Tick()
        {
            if (!IsOpen || changedAt < 0 || loading || Time.unscaledTime - changedAt < PreviewDelay) return;
            changedAt = -1;
            _ = LoadPreview(Look.Clone());
        }

        async Awaitable LoadPreview(BudLookDto look)
        {
            loading = true;
            status.text = "…";
            try
            {
                var old = sheet;
                sheet = new BudSheet(await preview(look), true);
                old?.Dispose(); // every preview is a new download: the last one goes
                ShowFrame();
                status.text = "";
            }
            catch (ApiException e)
            {
                status.text = e.Message;
            }
            finally
            {
                loading = false;
            }
        }

        void ShowFrame()
        {
            if (sheet == null) return;
            portrait.sprite = sheet.Get(facing, 0);
            portrait.rectTransform.localScale = Vector3.one;
        }

        void Turn()
        {
            facing = facing == Facing.Down ? Facing.Side : facing == Facing.Side ? Facing.Up : Facing.Down;
            ShowFrame();
        }

        public void SelectTab(int index) => ShowTab(Mathf.Clamp(index, 0, Tabs.Length - 1));

        void Changed()
        {
            changedAt = Time.unscaledTime;
            ShowTab(tab); // selections changed: redraw the chips
        }

        /// <summary>Every part from the gender's catalog, at random (the same idea as randomLook in packages/shared).</summary>
        public void Randomize()
        {
            if (data == null) return;
            var g = data.For(Look.gender);
            T Pick<T>(T[] list) => list[random.Next(list.Length)];
            Look = new BudLookDto
            {
                gender = Look.gender,
                mood = Pick(g.moods).id,
                skin = random.Next(data.skins.Length),
                hair = Pick(g.hair.styles).id,
                hairColor = random.Next(5),
                outfit = Pick(g.top.styles).id,
                outfitColor = random.Next(g.top.colors.Length),
                pants = Pick(g.legs.styles).id,
                pantsColor = random.Next(g.legs.colors.Length),
                shoes = Pick(g.shoes.styles).id,
                shoesColor = random.Next(g.shoes.colors.Length),
                eyes = random.Next(Math.Max(1, data.eyes?.Length ?? 1)),
                mark = g.marks != null && random.Next(10) >= 6 ? Pick(g.marks).id : "brak",
                glasses = data.glasses != null && random.Next(4) == 0 ? Pick(data.glasses).id : "brak",
                print = data.prints != null && random.Next(2) == 0 ? Pick(data.prints).id : "gladka",
                accessory = data.accessories != null && random.Next(2) == 0 ? Pick(data.accessories).id : "brak",
                accent = data.accents != null ? random.Next(data.accents.Length) : -1,
            };
            Changed();
        }

        /// <summary>Sets one part (used by the chips and by automated runs).</summary>
        public void Set(Action<BudLookDto> change)
        {
            var look = Look.Clone();
            change(look);
            Look = look;
            Changed();
        }

        void Create()
        {
            if (Editing)
            {
                error.text = "";
                editSave(Look.Clone());
                return;
            }
            var name = (nameField.text ?? "").Trim();
            if (name.Length < 2)
            {
                error.text = "Imię musi mieć co najmniej 2 znaki.";
                return;
            }
            error.text = "";
            onCreate(name, Look.Clone());
        }

        // ---------- tabs ----------

        void ShowTab(int index)
        {
            tab = index;
            for (var i = 0; i < tabButtons.Length; i++)
            {
                var face = tabButtons[i].transform.Find("Face/Fill")?.GetComponent<Image>();
                if (face) face.color = i == index ? UiKit.Buds400 : UiKit.Rep400;
            }
            for (var i = options.childCount - 1; i >= 0; i--) UnityEngine.Object.Destroy(options.GetChild(i).gameObject);
            if (data == null) return;
            var g = data.For(Look.gender);
            if (g == null) return;
            var y = 0f;
            var same = index == shownTab;
            switch (index)
            {
                case 0:
                    y = Chips("Kim jest", data.genders, Look.gender, id => Set(l => SwitchGender(l, id)), y, 2);
                    y = Chips("Nastrój", g.moods, Look.mood, id => Set(l => l.mood = id), y, 3);
                    y = Swatches("Karnacja", data.skins, Look.skin, i => Set(l => l.skin = i), y);
                    break;
                case 1:
                    y = Swatches("Kolor włosów", g.hair.colors, Look.hairColor, i => Set(l => l.hairColor = i), y);
                    y = Chips("Fryzura", g.hair.styles, Look.hair, id => Set(l => l.hair = id), y, 4);
                    break;
                case 2:
                    if (data.eyes != null) y = Swatches("Kolor oczu", data.eyes, Look.eyes, i => Set(l => l.eyes = i), y);
                    if (g.marks != null) y = Chips("Cecha", g.marks, Look.mark, id => Set(l => l.mark = id), y, 4);
                    if (data.glasses != null) y = Chips("Okulary", data.glasses, Look.glasses, id => Set(l => l.glasses = id), y, 3);
                    break;
                case 3:
                    y = Swatches("Kolor góry", g.top.colors, Look.outfitColor, i => Set(l => l.outfitColor = i), y);
                    y = Chips("Góra", g.top.styles, Look.outfit, id => Set(l => l.outfit = id), y, 3);
                    if (data.prints != null) y = Chips("Nadruk", data.prints, Look.print, id => Set(l => l.print = id), y, 4);
                    break;
                case 4:
                    y = Swatches("Kolor", g.legs.colors, Look.pantsColor, i => Set(l => l.pantsColor = i), y);
                    y = Chips("Nogi", g.legs.styles, Look.pants, id => Set(l => l.pants = id), y, 3);
                    break;
                case 5:
                    y = Swatches("Kolor butów", g.shoes.colors, Look.shoesColor, i => Set(l => l.shoesColor = i), y);
                    y = Chips("Buty", g.shoes.styles, Look.shoes, id => Set(l => l.shoes = id), y, 3);
                    break;
                case 6:
                    if (data.accents != null)
                        y = Swatches("Kolor dodatków i czapki", data.accents, Look.accent, i => Set(l => l.accent = i), y);
                    if (data.accessories != null)
                        y = Chips("Dodatek", data.accessories, Look.accessory, id => Set(l => l.accessory = id), y, 3);
                    break;
            }
            // as tall as what was laid out; another tab starts from its top, a change in this one stays where it was
            options.sizeDelta = new Vector2(672, Mathf.Max(440, -y));
            if (!same) options.anchoredPosition = Vector2.zero;
            shownTab = index;
        }

        /// <summary>The other gender's catalog: keep every part it has, otherwise take its first pick.</summary>
        void SwitchGender(BudLookDto look, string gender)
        {
            look.gender = gender;
            var g = data.For(gender);
            if (g == null) return;
            string Keep(OptionDto[] list, string v) => Array.Exists(list, o => o.id == v) ? v : list[0].id;
            look.hair = Keep(g.hair.styles, look.hair);
            look.outfit = Keep(g.top.styles, look.outfit);
            look.pants = Keep(g.legs.styles, look.pants);
            look.shoes = Keep(g.shoes.styles, look.shoes);
            if (g.marks != null) look.mark = Keep(g.marks, look.mark);
        }

        float Chips(string title, OptionDto[] items, string selected, Action<string> pick, float y, int columns)
        {
            Title(title, y);
            y -= 36;
            var w = (672 - (columns - 1) * 10) / columns;
            for (var i = 0; i < items.Length; i++)
            {
                var item = items[i];
                var chip = UiKit.Button("Chip " + item.id, options, item.label, new Vector2(w, 54), () => pick(item.id),
                    UiKit.Tone.Rep, 22);
                UiKit.Place((RectTransform)chip.transform, new Vector2(0, 1), new Vector2((i % columns) * (w + 10), y - (i / columns) * 64),
                    new Vector2(w, 54), new Vector2(0, 1));
                var face = chip.transform.Find("Face/Fill")?.GetComponent<Image>();
                if (face && item.id == selected) face.color = UiKit.Buds400;
            }
            return y - ((items.Length + columns - 1) / columns) * 64 - 10;
        }

        int shownTab = -1;

        float Swatches(string title, string[] colors, int selected, Action<int> pick, float y)
        {
            Title(title, y);
            y -= 38;
            for (var i = 0; i < colors.Length; i++)
            {
                var index = i;
                var color = UiKit.Hex(colors[i]);
                var at = new Vector2((i % 9) * 72, y - (i / 9) * 70);
                var ring = UiKit.Panel("Swatch", options, i == selected ? UiKit.Buds600 : UiKit.Outline);
                ring.sprite = disc;
                UiKit.Place(ring.rectTransform, new Vector2(0, 1), at, new Vector2(60, 60), new Vector2(0, 1));
                var fill = UiKit.Panel("Fill", ring.transform, color);
                fill.sprite = disc;
                UiKit.Place(fill.rectTransform, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(i == selected ? 44 : 52, i == selected ? 44 : 52));
                ring.raycastTarget = true;
                var button = ring.gameObject.AddComponent<Button>();
                button.targetGraphic = ring;
                button.onClick.AddListener(() => pick(index));
            }
            return y - ((colors.Length + 8) / 9) * 70 - 8;
        }

        void Title(string text, float y)
        {
            var t = UiKit.Label("Title", options, text, 22, UiKit.InkSoft, true, TextAnchor.LowerLeft);
            UiKit.Place(t.rectTransform, new Vector2(0, 1), new Vector2(0, y), new Vector2(672, 30), new Vector2(0, 1));
        }
    }
}
