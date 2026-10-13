using System;
using System.Collections.Generic;
using Buds.Api;
using Buds.Characters;
using Buds.Quests;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace Buds.UI
{
    /// <summary>
    /// The duel screen: the bud (left) and the opponent (right) side on, health bars, the four moves of the bud's
    /// weapon and a way out. The server decides every turn; this plays what happened — each move with its own motion:
    /// a jab is a quick punch, a hook an arc, a kick a hop and a turn, a swing a wide arc of the weapon, a thrust a
    /// stab, a spin a full turn, a shot a flying stone, spray a cloud, a shout rings of sound, a kickflip the board in
    /// the air — and every hit flashes, shakes and shows its damage.
    /// </summary>
    public sealed class FightScreen
    {
        const float StageW = 1076;
        const float StageH = 380;
        const float FighterW = 156;
        const float FighterH = 234;
        static Sprite disc;

        /// <summary>A sample icon per weapon kind, for opponents (who carry no catalog item).</summary>
        static readonly Dictionary<string, string> KindIcon = new()
        {
            ["kij"] = "kij-hejnal",
            ["procarka"] = "proca-sportowa",
            ["spray"] = "spray-zwykly",
            ["mikrofon"] = "megafon",
            ["deska"] = "deska-fala",
        };

        sealed class FighterView
        {
            public RectTransform Root;
            public Image Body;
            public RectTransform WeaponRt;
            public Image Weapon;
            public BudSheet Sheet;
            public string Name;
            public Vector2 Home;
            public int Dir; // +1 faces right (the bud), -1 left
            public RectTransform HpFill;
            public Text HpText;
            public Text NameText;
            public Text StatusText;
            public int Hp;
            public int MaxHp;
            public float WeaponRest = 25;
        }

        readonly QuestContent content;
        readonly Func<string, Awaitable> onMove;
        readonly Action onFlee;
        readonly Action onClose;
        readonly GameObject root;
        readonly Text title;
        readonly RectTransform stage;
        readonly RectTransform fx;
        readonly Text log;
        readonly Text info;
        readonly Button[] moveButtons = new Button[4];
        readonly Text[] moveLabels = new Text[4];
        readonly Button fleeButton;
        readonly GameObject result;
        readonly Text resultTitle;
        readonly Text resultBody;
        readonly Image resultIcon;
        readonly Dictionary<string, Sprite> icons = new();
        FighterView bud;
        FighterView enemy;
        string[] moves = Array.Empty<string>();
        bool busy;

        public bool IsOpen => root.activeSelf;
        public bool ShowingResult => result.activeSelf;

        public FightScreen(Transform canvas, QuestContent content, Func<string, Awaitable> onMove, Action onFlee, Action onClose)
        {
            this.content = content;
            this.onMove = onMove;
            this.onFlee = onFlee;
            this.onClose = onClose;
            disc ??= UiKit.Circle(32);

            var dim = UiKit.Panel("Fight", canvas, new Color(0.086f, 0.094f, 0.122f, 0.82f));
            dim.raycastTarget = true;
            UiKit.Stretch(dim.rectTransform);
            root = dim.gameObject;
            var group = UiKit.Rect("Group", dim.transform);
            UiKit.Place(group, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(1180, 820));
            group.gameObject.AddComponent<FitInParent>();
            var body = UiKit.Window("Window", group, new Vector2(1140, 800), "Pojedynek", null, out var window, out title);
            UiKit.Place(window, new Vector2(0.5f, 0.5f), Vector2.zero, window.sizeDelta);

            // the arena: night sky over asphalt
            var arena = UiKit.OutlinedBox("Arena", body, UiKit.Surface800, UiKit.RadiusM);
            var arenaRt = (RectTransform)arena.transform.parent;
            UiKit.Place(arenaRt, new Vector2(0, 1), Vector2.zero, new Vector2(StageW, StageH), new Vector2(0, 1));
            var ground = UiKit.Shape("Ground", arena.transform, UiKit.Surface700, UiKit.RadiusM - 4);
            UiKit.Place(ground.rectTransform, new Vector2(0.5f, 0), new Vector2(0, 6), new Vector2(StageW - 12, 84), new Vector2(0.5f, 0));
            var line = UiKit.Panel("Line", arena.transform, UiKit.Outline);
            UiKit.Place(line.rectTransform, new Vector2(0.5f, 0), new Vector2(0, 88), new Vector2(StageW - 12, 3), new Vector2(0.5f, 0));
            stage = UiKit.Rect("Stage", arena.transform);
            UiKit.Stretch(stage);
            fx = UiKit.Rect("Fx", arena.transform);
            UiKit.Stretch(fx);

            log = UiKit.Label("Log", body, "", 28, UiKit.Ink, true, TextAnchor.MiddleCenter);
            UiKit.Place(log.rectTransform, new Vector2(0, 1), new Vector2(0, -StageH - 8), new Vector2(StageW, 44), new Vector2(0, 1));

            for (var i = 0; i < 4; i++)
            {
                var index = i;
                moveButtons[i] = UiKit.Button("Move" + i, body, "", new Vector2(256, 84), () => Choose(index), UiKit.Tone.Buds, 28);
                UiKit.Place((RectTransform)moveButtons[i].transform, new Vector2(0, 1), new Vector2(i * 273, -StageH - 64),
                    new Vector2(256, 84), new Vector2(0, 1));
                moveLabels[i] = moveButtons[i].GetComponentInChildren<Text>();
            }
            info = UiKit.Label("Info", body, "", 20, UiKit.InkSoft, false, TextAnchor.UpperLeft);
            UiKit.Place(info.rectTransform, new Vector2(0, 0), new Vector2(0, 4), new Vector2(800, 64), Vector2.zero);
            fleeButton = UiKit.Button("Flee", body, "Uciekaj  [Esc]", new Vector2(240, 62), () => onFlee(), UiKit.Tone.Rep, 24);
            UiKit.Place((RectTransform)fleeButton.transform, new Vector2(1, 0), new Vector2(0, 8), new Vector2(240, 62), new Vector2(1, 0));

            // result card over the arena
            var card = UiKit.Window("Result", arena.transform, new Vector2(560, 330), "", null, out var cardRt, out resultTitle);
            UiKit.Place(cardRt, new Vector2(0.5f, 0.5f), new Vector2(0, 10), cardRt.sizeDelta);
            resultIcon = UiKit.Rect("Icon", card).gameObject.AddComponent<Image>();
            resultIcon.preserveAspect = true;
            UiKit.Place(resultIcon.rectTransform, new Vector2(0, 1), new Vector2(0, -6), new Vector2(110, 110), new Vector2(0, 1));
            resultBody = UiKit.Label("Body", card, "", 25, UiKit.Ink, false, TextAnchor.UpperLeft);
            UiKit.Stretch(resultBody.rectTransform, 126, 70, 0, 0);
            var next = UiKit.Button("Next", card, "Dalej  [E]", new Vector2(220, 64), () => onClose(), UiKit.Tone.Gold, 28);
            UiKit.Place((RectTransform)next.transform, new Vector2(1, 0), Vector2.zero, new Vector2(220, 64), new Vector2(1, 0));
            result = cardRt.gameObject;
            result.SetActive(false);
            root.SetActive(false);
        }

        // ---------- open / state ----------

        public void Open(FightDto fight, BudSheet budSheet, BudSheet enemySheet, string line)
        {
            for (var i = stage.childCount - 1; i >= 0; i--) UnityEngine.Object.Destroy(stage.GetChild(i).gameObject);
            for (var i = fx.childCount - 1; i >= 0; i--) UnityEngine.Object.Destroy(fx.GetChild(i).gameObject);
            title.text = $"Pojedynek · {fight.enemy.name}";
            bud = Fighter(fight.bud, budSheet, new Vector2(StageW * 0.27f, 54), +1, fight.bud.weaponItem);
            enemy = Fighter(fight.enemy, enemySheet, new Vector2(StageW * 0.73f, 54), -1,
                KindIcon.TryGetValue(fight.enemy.weapon ?? "", out var icon) ? icon : null);
            moves = fight.bud.moves ?? Array.Empty<string>();
            for (var i = 0; i < 4; i++)
            {
                var has = i < moves.Length;
                moveButtons[i].gameObject.SetActive(has);
                if (!has) continue;
                var m = content.Move(moves[i]);
                moveLabels[i].text = $"{m?.name ?? moves[i]}  [{i + 1}]";
            }
            var weapon = string.IsNullOrEmpty(fight.bud.weaponItem) ? null : content.Item(fight.bud.weaponItem);
            info.text = $"Broń: <b>{weapon?.name ?? "pięści"}</b>  ·  Atak {fight.bud.attack}  ·  Pancerz {fight.bud.armor}  ·  Szybkość {fight.bud.speed}\n" +
                        $"Rywal: poziom {fight.enemy.level}, {WeaponName(fight.enemy.weapon)}";
            log.text = $"„{line}”";
            result.SetActive(false);
            SetBusy(false);
            root.SetActive(true);
            root.transform.SetAsLastSibling();
            RefreshFighter(bud, fight.bud);
            RefreshFighter(enemy, fight.enemy);
        }

        public void Hide() => root.SetActive(false);

        public void SetBusy(bool value)
        {
            busy = value;
            foreach (var b in moveButtons) b.interactable = !value;
            fleeButton.interactable = !value;
        }

        public void ShowMessage(string text) => log.text = text;

        /// <summary>Keyboard: 1–4 moves, Esc runs away, E closes the result.</summary>
        public void Tick()
        {
            var kb = Keyboard.current;
            if (kb == null || !IsOpen) return;
            if (ShowingResult)
            {
                if (kb.eKey.wasPressedThisFrame || kb.enterKey.wasPressedThisFrame || kb.spaceKey.wasPressedThisFrame) onClose();
                return;
            }
            if (busy) return;
            Key[] keys = { Key.Digit1, Key.Digit2, Key.Digit3, Key.Digit4 };
            for (var i = 0; i < keys.Length; i++)
                if (kb[keys[i]].wasPressedThisFrame) Choose(i);
            if (kb.escapeKey.wasPressedThisFrame) onFlee();
        }

        void Choose(int index)
        {
            if (busy || index >= moves.Length) return;
            _ = onMove(moves[index]);
        }

        public string MoveAt(int index) => index < moves.Length ? moves[index] : null;

        // ---------- turns ----------

        /// <summary>Plays the events of one turn, then shows the state the server sent.</summary>
        public async Awaitable PlayTurn(FightResponse res)
        {
            foreach (var e in res.events ?? Array.Empty<TurnEventDto>())
            {
                if (!IsOpen) return;
                await PlayEvent(e);
                await Wait(0.12f);
            }
            if (!IsOpen) return;
            RefreshFighter(bud, res.fight.bud);
            RefreshFighter(enemy, res.fight.enemy);
        }

        public void ShowResult(FightDto fight, FightRewardDto reward, string error = null)
        {
            Sprite icon = null;
            switch (fight.status)
            {
                case "won":
                    resultTitle.text = "Wygrana!";
                    var sb = new System.Text.StringBuilder($"<b>+{reward.xpGained} XP</b>   <b>+{Core.GameBootstrap.Coins(reward.coinsGained)}</b>");
                    if (reward.levelUp) sb.Append($"\n<color=#5d9a12><b>Awans! Poziom {reward.level}</b></color>");
                    var item = string.IsNullOrEmpty(reward.item) ? null : content.Item(reward.item);
                    if (item != null)
                    {
                        sb.Append($"\nŁup: <b>{item.name}</b>\n<size=20>{Gear.Describe(content, item)}</size>");
                        icon = Icon("Items/" + item.id);
                    }
                    else sb.Append("\nTym razem bez łupu.");
                    resultBody.text = sb.ToString();
                    break;
                case "lost":
                    resultTitle.text = "Przegrana";
                    resultBody.text = $"{fight.enemy.name} był(a) tym razem lepszy.\nLepszy ekwipunek i kilka poziomów zrobią różnicę.";
                    break;
                default:
                    resultTitle.text = "Ucieczka";
                    resultBody.text = "Czasem lepiej się wycofać. Bez nagrody, bez straty.";
                    break;
            }
            if (error != null) resultBody.text += $"\n<color=#bd1c31>{error}</color>";
            resultIcon.sprite = icon;
            resultIcon.enabled = icon;
            resultBody.rectTransform.offsetMin = new Vector2(icon ? 126 : 0, 70);
            result.SetActive(true);
            result.transform.SetAsLastSibling();
            SetBusy(true);
        }

        async Awaitable PlayEvent(TurnEventDto e)
        {
            var me = e.actor == "bud" ? bud : enemy;
            var other = e.actor == "bud" ? enemy : bud;
            var move = content.Move(e.move);
            var anim = move?.anim ?? "jab";
            var name = move?.name ?? e.move;
            log.text = $"{(e.actor == "bud" ? "Ty" : me.Name)}: <b>{name}</b>";
            var hits = e.hits ?? Array.Empty<HitDto>();
            var finalHp = e.actor == "bud" ? e.enemyHp : e.budHp;

            switch (anim)
            {
                case "guard":
                    await Guard(me);
                    break;
                case "dodge":
                    await Dodge(me);
                    break;
                case "aim":
                    await Aim(me, other);
                    break;
                case "shoot":
                    foreach (var h in hits)
                    {
                        await Shoot(me, other);
                        await React(other, h);
                    }
                    break;
                case "spray":
                    await Spray(me, other);
                    foreach (var h in hits) await React(other, h);
                    break;
                case "shout":
                    await Shout(me, other);
                    foreach (var h in hits) await React(other, h);
                    break;
                default:
                    // close combat: wind up, strike, take the hit, step back
                    await Strike(me, anim);
                    foreach (var h in hits) await React(other, h);
                    await Return(me);
                    break;
            }

            if (hits.Length > 0) SetHp(other, finalHp);
            switch (e.effect)
            {
                case "guard":
                    Popup(me, "Garda", UiKit.Rep400, 30);
                    break;
                case "dodge":
                    Popup(me, "Ślizg", UiKit.Rep400, 30);
                    break;
                case "aim":
                    Popup(me, "Celuje…", UiKit.Gold400, 30);
                    break;
                case "blind":
                    Popup(other, "Oślepiony!", UiKit.Alert500, 30, 60);
                    break;
                case "weaken":
                    Popup(other, "Osłabiony!", UiKit.Alert500, 30, 60);
                    break;
            }
            await Wait(0.18f);
        }

        // ---------- fighters ----------

        FighterView Fighter(FighterDto data, BudSheet sheet, Vector2 home, int dir, string weaponIcon)
        {
            var v = new FighterView { Sheet = sheet, Name = data.name, Home = home, Dir = dir, Hp = data.hp, MaxHp = data.maxHp };
            v.Root = UiKit.Rect("Fighter", stage);
            v.Root.anchorMin = v.Root.anchorMax = Vector2.zero;
            v.Root.pivot = new Vector2(0.5f, 0);
            v.Root.sizeDelta = new Vector2(FighterW, FighterH);
            v.Root.anchoredPosition = home;
            // side frames face left; the bud is mirrored to face the opponent
            v.Root.localScale = new Vector3(-dir, 1, 1);
            v.Body = v.Root.gameObject.AddComponent<Image>();
            v.Body.sprite = sheet.Get(Facing.Side, 0);
            v.Body.preserveAspect = true;
            v.Body.raycastTarget = false;

            var sprite = weaponIcon != null ? Icon("Items/" + weaponIcon) : null;
            v.WeaponRt = UiKit.Rect("Weapon", v.Root);
            v.WeaponRt.anchorMin = v.WeaponRt.anchorMax = new Vector2(0.5f, 0);
            // the icons' handles sit at their bottom-left: that's where the hand holds them
            v.WeaponRt.pivot = new Vector2(0.19f, 0.13f);
            v.WeaponRt.sizeDelta = new Vector2(96, 96);
            v.WeaponRt.anchoredPosition = new Vector2(-34, 104);
            v.Weapon = v.WeaponRt.gameObject.AddComponent<Image>();
            v.Weapon.sprite = sprite;
            v.Weapon.enabled = sprite;
            v.Weapon.raycastTarget = false;
            v.WeaponRt.localEulerAngles = new Vector3(0, 0, 90 + v.WeaponRest); // held up, pointing at the rival
            v.WeaponRt.localScale = new Vector3(-1, 1, 1);

            // name, level, health above the head
            var plate = UiKit.Rect("Plate", stage);
            plate.anchorMin = plate.anchorMax = Vector2.zero;
            plate.pivot = new Vector2(0.5f, 0);
            plate.sizeDelta = new Vector2(320, 90);
            plate.anchoredPosition = home + new Vector2(0, FighterH - 6);
            v.NameText = UiKit.Outlined("Name", plate, "", 22);
            v.NameText.horizontalOverflow = HorizontalWrapMode.Overflow;
            UiKit.Place(v.NameText.rectTransform, new Vector2(0.5f, 1), Vector2.zero, new Vector2(320, 34), new Vector2(0.5f, 1));
            v.HpFill = UiKit.Bar("Hp", plate, dir > 0 ? UiKit.Buds400 : UiKit.Alert500, out var bar);
            UiKit.Place(bar, new Vector2(0.5f, 1), new Vector2(0, -36), new Vector2(280, 30), new Vector2(0.5f, 1));
            v.HpText = UiKit.Outlined("Value", bar, "", 20);
            UiKit.Stretch(v.HpText.rectTransform, 0, 2, 0, 0);
            v.StatusText = UiKit.Outlined("Status", plate, "", 18, UiKit.Gold400);
            UiKit.Place(v.StatusText.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -70), new Vector2(320, 24), new Vector2(0.5f, 1));
            v.NameText.text = $"{data.name}  ·  poz. {data.level}";
            return v;
        }

        void RefreshFighter(FighterView v, FighterDto data)
        {
            v.MaxHp = data.maxHp;
            SetHp(v, data.hp);
            var s = new List<string>();
            if (data.status != null)
            {
                if (data.status.blind > 0) s.Add("oślepiony");
                if (data.status.weaken > 0) s.Add("osłabiony");
                if (data.status.aim) s.Add("celuje");
            }
            v.StatusText.text = string.Join(" · ", s);
        }

        void SetHp(FighterView v, int hp)
        {
            v.Hp = Mathf.Max(0, hp);
            v.HpText.text = $"{v.Hp} / {v.MaxHp}";
            Canvas.ForceUpdateCanvases();
            UiKit.SetBar(v.HpFill, v.MaxHp > 0 ? v.Hp / (float)v.MaxHp : 0);
            if (v.Hp == 0) v.Body.color = new Color(1, 1, 1, 0.55f);
        }

        // ---------- motions ----------

        static async Awaitable Wait(float seconds)
        {
            for (var t = 0f; t < seconds; t += Time.unscaledDeltaTime) await Awaitable.NextFrameAsync();
        }

        static async Awaitable Tween(float seconds, Action<float> step)
        {
            for (var t = 0f; t < seconds; t += Time.unscaledDeltaTime)
            {
                step(Mathf.Clamp01(t / seconds));
                await Awaitable.NextFrameAsync();
            }
            step(1);
        }

        static float Ease(float t) => 1 - (1 - t) * (1 - t);

        /// <summary>The close-combat moves: each its own path and pose up to the moment of contact.</summary>
        async Awaitable Strike(FighterView me, string anim)
        {
            var d = me.Dir;
            var from = me.Home;
            me.Body.sprite = me.Sheet.Get(Facing.Side, 1);
            switch (anim)
            {
                case "jab": // short and straight
                    await Tween(0.1f, t => me.Root.anchoredPosition = from + new Vector2(d * 90 * Ease(t), 0));
                    break;
                case "hook": // an arc from the side, the body turning into it
                    await Tween(0.16f, t =>
                    {
                        me.Root.anchoredPosition = from + new Vector2(d * 110 * Ease(t), Mathf.Sin(t * Mathf.PI) * 24);
                        me.Root.localEulerAngles = new Vector3(0, 0, -d * 14 * Mathf.Sin(t * Mathf.PI));
                    });
                    break;
                case "kick": // a hop and a lean back, the leg goes first
                    me.Body.sprite = me.Sheet.Get(Facing.Side, 2);
                    await Tween(0.2f, t =>
                    {
                        me.Root.anchoredPosition = from + new Vector2(d * 140 * Ease(t), Mathf.Sin(t * Mathf.PI) * 40);
                        me.Root.localEulerAngles = new Vector3(0, 0, d * 22 * t);
                    });
                    break;
                case "thrust": // the weapon levels out and stabs forward
                    me.WeaponRt.localEulerAngles = new Vector3(0, 0, 90);
                    await Tween(0.12f, t => me.Root.anchoredPosition = from + new Vector2(d * 170 * Ease(t), 0));
                    break;
                case "swing": // raised high, then a wide arc down onto the rival
                    await Tween(0.14f, t => me.WeaponRt.localEulerAngles = new Vector3(0, 0, Mathf.Lerp(90 + me.WeaponRest, 170, t)));
                    await Tween(0.16f, t =>
                    {
                        me.Root.anchoredPosition = from + new Vector2(d * 120 * Ease(t), 0);
                        me.WeaponRt.localEulerAngles = new Vector3(0, 0, Mathf.Lerp(170, -10, Ease(t)));
                    });
                    break;
                case "spin": // a full turn with the weapon out
                    me.WeaponRt.localEulerAngles = new Vector3(0, 0, 90);
                    await Tween(0.36f, t =>
                    {
                        me.Root.anchoredPosition = from + new Vector2(d * 140 * t, Mathf.Sin(t * Mathf.PI) * 16);
                        me.Root.localEulerAngles = new Vector3(0, 0, -d * 360 * Ease(t));
                    });
                    me.Root.localEulerAngles = Vector3.zero;
                    break;
                case "flip": // the board flips up in the air and comes down on the rival
                    await Tween(0.32f, t =>
                    {
                        me.Root.anchoredPosition = from + new Vector2(d * 130 * t, Mathf.Sin(t * Mathf.PI) * 70);
                        me.WeaponRt.localEulerAngles = new Vector3(0, 0, 90 + 720 * t);
                    });
                    break;
                default:
                    await Tween(0.12f, t => me.Root.anchoredPosition = from + new Vector2(d * 90 * Ease(t), 0));
                    break;
            }
        }

        async Awaitable Return(FighterView me)
        {
            var at = me.Root.anchoredPosition;
            var rot = me.Root.localEulerAngles.z;
            var weapon = me.WeaponRt.localEulerAngles.z;
            await Tween(0.18f, t =>
            {
                me.Root.anchoredPosition = Vector2.Lerp(at, me.Home, Ease(t));
                me.Root.localEulerAngles = new Vector3(0, 0, Mathf.LerpAngle(rot, 0, t));
                me.WeaponRt.localEulerAngles = new Vector3(0, 0, Mathf.LerpAngle(weapon, 90 + me.WeaponRest, t));
            });
            me.Body.sprite = me.Sheet.Get(Facing.Side, 0);
        }

        async Awaitable Guard(FighterView me)
        {
            var shield = Fx("Shield", UiKit.Rep400, new Vector2(180, 180), Center(me) + new Vector2(me.Dir * 40, 0));
            shield.color = new Color(UiKit.Rep400.r, UiKit.Rep400.g, UiKit.Rep400.b, 0.45f);
            await Tween(0.3f, t =>
            {
                me.Root.localScale = new Vector3(-me.Dir * (1 - 0.06f * Mathf.Sin(t * Mathf.PI)), 1 - 0.06f * Mathf.Sin(t * Mathf.PI), 1);
                shield.rectTransform.localScale = Vector3.one * (0.6f + 0.4f * Ease(t));
            });
            await Fade(shield, 0.25f);
        }

        async Awaitable Dodge(FighterView me)
        {
            await Tween(0.14f, t => me.Root.anchoredPosition = me.Home + new Vector2(-me.Dir * 70 * Ease(t), 0));
            await Tween(0.16f, t => me.Root.anchoredPosition = me.Home + new Vector2(-me.Dir * 70 * (1 - t), 0));
        }

        async Awaitable Aim(FighterView me, FighterView target)
        {
            var mark = Fx("Aim", UiKit.Gold400, new Vector2(70, 70), Center(target));
            await Tween(0.4f, t =>
            {
                mark.rectTransform.localScale = Vector3.one * (1.6f - 0.6f * Ease(t));
                me.Root.localEulerAngles = new Vector3(0, 0, -me.Dir * 6 * t);
            });
            me.Root.localEulerAngles = Vector3.zero;
            await Fade(mark, 0.2f);
        }

        async Awaitable Shoot(FighterView me, FighterView target)
        {
            var from = Hand(me);
            var to = Center(target);
            var stone = Fx("Stone", UiKit.Surface700, new Vector2(22, 22), from);
            // pull back a little, let go
            await Tween(0.08f, t => me.Root.anchoredPosition = me.Home + new Vector2(-me.Dir * 14 * t, 0));
            await Tween(0.2f, t =>
            {
                stone.rectTransform.anchoredPosition = Vector2.Lerp(from, to, t) + new Vector2(0, Mathf.Sin(t * Mathf.PI) * 40);
                me.Root.anchoredPosition = me.Home + new Vector2(-me.Dir * 14 * (1 - t), 0);
            });
            UnityEngine.Object.Destroy(stone.gameObject);
        }

        async Awaitable Spray(FighterView me, FighterView target)
        {
            var from = Hand(me);
            var to = Center(target);
            Color[] colors = { UiKit.Buds400, UiKit.Rep400, UiKit.XpFill, UiKit.Gold400 };
            var puffs = new List<Image>();
            for (var i = 0; i < 9; i++)
                puffs.Add(Fx("Paint", colors[i % colors.Length], new Vector2(26, 26), from));
            var offsets = new List<Vector2>();
            for (var i = 0; i < puffs.Count; i++) offsets.Add(new Vector2(UnityEngine.Random.Range(-40, 40), UnityEngine.Random.Range(-50, 50)));
            await Tween(0.3f, t =>
            {
                for (var i = 0; i < puffs.Count; i++)
                {
                    var k = Mathf.Clamp01(t * 1.3f - i * 0.04f);
                    puffs[i].rectTransform.anchoredPosition = Vector2.Lerp(from, to + offsets[i], Ease(k));
                    puffs[i].rectTransform.localScale = Vector3.one * (0.5f + 1.6f * k);
                    var c = puffs[i].color;
                    c.a = 0.9f * (1 - k * 0.6f);
                    puffs[i].color = c;
                }
            });
            foreach (var p in puffs) _ = Fade(p, 0.3f);
        }

        async Awaitable Shout(FighterView me, FighterView target)
        {
            var from = Hand(me);
            var to = Center(target);
            var rings = new List<Image>();
            for (var i = 0; i < 3; i++)
            {
                var ring = Fx("Ring", UiKit.TextOnDark, new Vector2(60, 60), from);
                var outline = ring.gameObject.AddComponent<UnityEngine.UI.Outline>();
                outline.effectColor = UiKit.Outline;
                ring.color = new Color(1, 1, 1, 0.0f);
                rings.Add(ring);
            }
            await Tween(0.36f, t =>
            {
                me.Root.localScale = new Vector3(-me.Dir * (1 + 0.1f * Mathf.Sin(t * Mathf.PI)), 1 + 0.1f * Mathf.Sin(t * Mathf.PI), 1);
                for (var i = 0; i < rings.Count; i++)
                {
                    var k = Mathf.Clamp01(t * 1.6f - i * 0.25f);
                    rings[i].rectTransform.anchoredPosition = Vector2.Lerp(from, to, k);
                    rings[i].rectTransform.localScale = Vector3.one * (0.4f + 1.4f * k);
                    rings[i].color = new Color(1, 1, 1, k > 0 && k < 1 ? 0.55f * (1 - k) + 0.2f : 0);
                }
            });
            foreach (var r in rings) UnityEngine.Object.Destroy(r.gameObject);
        }

        /// <summary>How the target takes a hit (flash, shake, damage) or a miss (a hop aside).</summary>
        async Awaitable React(FighterView target, HitDto hit)
        {
            if (!hit.hit)
            {
                Popup(target, "Pudło", UiKit.TextOnDarkMuted, 30);
                await Tween(0.16f, t => target.Root.anchoredPosition = target.Home + new Vector2(-target.Dir * 30 * Mathf.Sin(t * Mathf.PI), 0));
                return;
            }
            Popup(target, hit.crit ? $"KRYTYK! {hit.damage}" : hit.damage.ToString(), hit.crit ? UiKit.Gold400 : UiKit.TextOnDark,
                hit.crit ? 46 : 38);
            SetHp(target, target.Hp - hit.damage);
            var strength = hit.crit ? 16f : 9f;
            await Tween(0.2f, t =>
            {
                target.Body.color = Color.Lerp(new Color(1, 0.45f, 0.45f, 1), Color.white, t);
                var shake = (1 - t) * strength;
                target.Root.anchoredPosition = target.Home +
                                              new Vector2(-target.Dir * 18 * (1 - t) + UnityEngine.Random.Range(-shake, shake), UnityEngine.Random.Range(-shake, shake) * 0.4f);
            });
            if (target.Hp > 0) target.Body.color = Color.white;
        }

        void Popup(FighterView over, string text, Color color, int size, float lift = 0)
        {
            var label = UiKit.Outlined("Popup", fx, text, size, color);
            label.horizontalOverflow = HorizontalWrapMode.Overflow;
            var rt = label.rectTransform;
            rt.anchorMin = rt.anchorMax = Vector2.zero;
            rt.sizeDelta = new Vector2(300, 60);
            var start = over.Home + new Vector2(0, FighterH * 0.8f + lift);
            rt.anchoredPosition = start;
            _ = Float(label, start);
        }

        static async Awaitable Float(Text label, Vector2 start)
        {
            await Tween(0.8f, t =>
            {
                if (!label) return;
                label.rectTransform.anchoredPosition = start + new Vector2(0, 70 * Ease(t));
                var c = label.color;
                c.a = t < 0.6f ? 1 : 1 - (t - 0.6f) / 0.4f;
                label.color = c;
            });
            if (label) UnityEngine.Object.Destroy(label.gameObject);
        }

        Image Fx(string name, Color color, Vector2 size, Vector2 at)
        {
            var img = UiKit.Panel(name, fx, color);
            img.sprite = disc;
            img.rectTransform.anchorMin = img.rectTransform.anchorMax = Vector2.zero;
            img.rectTransform.sizeDelta = size;
            img.rectTransform.anchoredPosition = at;
            return img;
        }

        static async Awaitable Fade(Image img, float seconds)
        {
            var from = img ? img.color.a : 0;
            await Tween(seconds, t =>
            {
                if (!img) return;
                var c = img.color;
                c.a = from * (1 - t);
                img.color = c;
            });
            if (img) UnityEngine.Object.Destroy(img.gameObject);
        }

        static Vector2 Center(FighterView v) => v.Home + new Vector2(0, FighterH * 0.55f);

        static Vector2 Hand(FighterView v) => v.Root.anchoredPosition + new Vector2(v.Dir * 50, 110);

        static string WeaponName(string kind) => kind switch
        {
            "kij" => "kij",
            "procarka" => "proca",
            "spray" => "spray",
            "mikrofon" => "mikrofon",
            "deska" => "deska",
            _ => "pięści",
        };

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
