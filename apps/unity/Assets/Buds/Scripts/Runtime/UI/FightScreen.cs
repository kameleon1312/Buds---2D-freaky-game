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
    /// The duel, fought on a 3D night street (FightStage) under a fighting-game HUD: the two plates with health at the
    /// top, the moves of the bud's weapon at the bottom, the result card in the middle. The server decides every turn;
    /// this plays what happened. Every move has its own motion in 3D — a jab is a quick lunge, a hook an arc with the body
    /// turning, a kick a hop with a lean, a swing a wide arc of the weapon, a thrust a stab, a spin a full turn, a shot a
    /// stone flying in an arc, spray a cloud of paint, a shout rings of sound, a kickflip the board in the air — and the
    /// camera moves with it: it pushes towards the blow, snaps in and freezes a beat on a crit, orbits a knockout. The
    /// comic street effects (Resources/Ui/Fx) sit on a layer over the stage, pinned to the fighters and kept fully on
    /// the screen: PAC!/ŁUP!/BAM!/TRZASK!, focus lines and halftone, the VS sticker, the WALCZ! tape, the sprayed K.O.
    /// and the WYGRANA! tag.
    /// </summary>
    public sealed class FightScreen
    {
        static Sprite disc;
        static Sprite ring;

        /// <summary>A sample icon per weapon kind, for opponents (who carry no catalog item).</summary>
        static readonly Dictionary<string, string> KindIcon = new()
        {
            ["kij"] = "kij-hejnal",
            ["procarka"] = "proca-sportowa",
            ["spray"] = "spray-zwykly",
            ["mikrofon"] = "megafon",
            ["deska"] = "deska-fala",
        };

        /// <summary>A fighter's plate on the HUD.</summary>
        sealed class Plate
        {
            public Text Name;
            public RectTransform HpFill;
            public RectTransform HpGhost;
            public Image HpImage;
            public Color HpColor;
            public Text HpText;
            public Text Status;
            public int Hp;
            public int MaxHp;
            public int TrailToken;
            /// <summary>The fighter's weapon and stats, shown under the bar with any status effects.</summary>
            public string Stats = "";
        }

        readonly QuestContent content;
        readonly Func<string, Awaitable> onMove;
        readonly Action onFlee;
        readonly Action onClose;
        readonly GameObject root;
        readonly RectTransform fx;
        readonly Text log;
        readonly Text round;
        /// <summary>Four moves from the weapon plus up to two special moves from skill perks.</summary>
        const int MaxMoves = 6;
        readonly Button[] moveButtons = new Button[MaxMoves];
        readonly Text[] moveLabels = new Text[MaxMoves];
        readonly RectTransform movesRow;
        readonly Button fleeButton;
        readonly GameObject result;
        readonly Text resultTitle;
        readonly Text resultBody;
        readonly Image resultIcon;
        readonly Plate budPlate;
        readonly Plate enemyPlate;
        readonly List<GameObject> hiddenHud = new();
        FightStage stage;
        string[] moves = Array.Empty<string>();
        bool busy;
        bool pvp;
        bool introPlaying;
        int idleToken;
        /// <summary>The bud's hits in a row (a miss or a hit taken ends it).</summary>
        int streak;
        /// <summary>The WYGRANA! tag of a won duel; it steps aside when the result card comes up.</summary>
        Image winTag;
        /// <summary>1 = normal speed; a crit slows the world down for a moment.</summary>
        float timeScale = 1;

        public bool IsOpen => root.activeSelf;
        public bool ShowingResult => result.activeSelf;
        /// <summary>Autopilot only: called at a crit ("crit") and once the K.O. is sprayed ("ko"), for screenshots.</summary>
        public Func<string, Awaitable> Moment;

        public FightScreen(Transform canvas, QuestContent content, Func<string, Awaitable> onMove, Action onFlee, Action onClose)
        {
            this.content = content;
            this.onMove = onMove;
            this.onFlee = onFlee;
            this.onClose = onClose;
            disc ??= UiKit.Circle(32);
            ring ??= MakeRing(64);

            // a clear layer over the 3D stage: it takes the taps so nothing reaches the world behind
            var cover = UiKit.Panel("Fight", canvas, new Color(0, 0, 0, 0));
            cover.raycastTarget = true;
            UiKit.Stretch(cover.rectTransform);
            root = cover.gameObject;

            // a soft dark band behind the plates and behind the moves, so the HUD reads over any part of the street
            var top = UiKit.Panel("TopShade", cover.transform, new Color(0.04f, 0.05f, 0.08f, 0.55f));
            UiKit.Place(top.rectTransform, new Vector2(0.5f, 1), Vector2.zero, new Vector2(4000, 140), new Vector2(0.5f, 1));
            var bottom = UiKit.Panel("BottomShade", cover.transform, new Color(0.04f, 0.05f, 0.08f, 0.6f));
            UiKit.Place(bottom.rectTransform, new Vector2(0.5f, 0), Vector2.zero, new Vector2(4000, 128), new Vector2(0.5f, 0));

            fx = UiKit.Rect("Fx", cover.transform);
            UiKit.Stretch(fx);

            budPlate = BuildPlate(cover.transform, true);
            enemyPlate = BuildPlate(cover.transform, false);
            round = UiKit.Outlined("Round", cover.transform, "", 30, UiKit.Gold400);
            UiKit.Place(round.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -14), new Vector2(260, 40), new Vector2(0.5f, 1));
            log = UiKit.Outlined("Log", cover.transform, "", 28, UiKit.TextOnDark);
            log.horizontalOverflow = HorizontalWrapMode.Overflow;
            UiKit.Place(log.rectTransform, new Vector2(0.5f, 0), new Vector2(0, 136), new Vector2(900, 40), new Vector2(0.5f, 0));

            movesRow = UiKit.Rect("Moves", cover.transform);
            movesRow.anchorMin = new Vector2(0, 0);
            movesRow.anchorMax = new Vector2(1, 0);
            movesRow.pivot = new Vector2(0.5f, 0);
            movesRow.offsetMin = new Vector2(20, 22);
            movesRow.offsetMax = new Vector2(-250, 112);
            for (var i = 0; i < MaxMoves; i++)
            {
                var index = i;
                moveButtons[i] = UiKit.Button("Move" + i, movesRow, "", new Vector2(200, 86), () => Choose(index),
                    i >= 4 ? UiKit.Tone.Gold : UiKit.Tone.Buds, 26);
                moveLabels[i] = moveButtons[i].GetComponentInChildren<Text>();
            }
            fleeButton = UiKit.Button("Flee", cover.transform, "Uciekaj  [Esc]", new Vector2(210, 70), () => onFlee(), UiKit.Tone.Rep, 24);
            UiKit.Place((RectTransform)fleeButton.transform, new Vector2(1, 0), new Vector2(-20, 30), new Vector2(210, 70), new Vector2(1, 0));

            // the result card in the middle of the screen
            var card = UiKit.Window("Result", cover.transform, new Vector2(660, 330), "", null, out var cardRt, out resultTitle);
            UiKit.Place(cardRt, new Vector2(0.5f, 0.5f), new Vector2(0, -10), cardRt.sizeDelta);
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

        Plate BuildPlate(Transform parent, bool left)
        {
            var p = new Plate();
            var anchor = left ? new Vector2(0, 1) : new Vector2(1, 1);
            var box = UiKit.OutlinedBox(left ? "BudPlate" : "RivalPlate", parent, UiKit.Surface800, UiKit.RadiusM);
            var rt = (RectTransform)box.transform.parent;
            UiKit.Place(rt, anchor, new Vector2(left ? 20 : -20, -14), new Vector2(420, 112), anchor);
            p.Name = UiKit.Outlined("Name", box.transform, "", 24, UiKit.TextOnDark, left ? TextAnchor.MiddleLeft : TextAnchor.MiddleRight);
            p.Name.horizontalOverflow = HorizontalWrapMode.Overflow;
            UiKit.Place(p.Name.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -6), new Vector2(392, 32), new Vector2(0.5f, 1));
            p.HpColor = left ? UiKit.Buds400 : UiKit.Alert500;
            p.HpFill = UiKit.Bar("Hp", box.transform, p.HpColor, out var bar);
            UiKit.Place(bar, new Vector2(0.5f, 1), new Vector2(0, -42), new Vector2(392, 32), new Vector2(0.5f, 1));
            p.HpImage = p.HpFill.GetComponent<Image>();
            // what was just lost stays as a pale trail behind the bar for a moment
            var ghost = UiKit.Panel("Trail", p.HpFill.parent, new Color(1, 1, 1, 0.7f)).rectTransform;
            ghost.anchorMin = p.HpFill.anchorMin;
            ghost.anchorMax = p.HpFill.anchorMax;
            ghost.pivot = p.HpFill.pivot;
            ghost.anchoredPosition = Vector2.zero;
            ghost.SetSiblingIndex(p.HpFill.GetSiblingIndex());
            p.HpGhost = ghost;
            p.HpText = UiKit.Outlined("Value", bar, "", 19);
            UiKit.Stretch(p.HpText.rectTransform, 0, 2, 0, 0);
            p.Status = UiKit.Label("Status", box.transform, "", 16, UiKit.TextOnDarkMuted, true, left ? TextAnchor.MiddleLeft : TextAnchor.MiddleRight);
            UiKit.Place(p.Status.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -78), new Vector2(392, 26), new Vector2(0.5f, 1));
            p.Status.resizeTextForBestFit = true;
            p.Status.resizeTextMinSize = 11;
            p.Status.resizeTextMaxSize = 16;
            p.Status.verticalOverflow = VerticalWrapMode.Truncate;
            return p;
        }

        // ---------- open / state ----------

        public void Open(FightDto fight, BudSheet budSheet, BudSheet enemySheet, string line, GearStats gear = null)
        {
            for (var i = fx.childCount - 1; i >= 0; i--) UnityEngine.Object.Destroy(fx.GetChild(i).gameObject);
            if (stage) stage.Close();
            pvp = fight.enemyId != null && fight.enemyId.StartsWith("pvp-");
            var enemyWeapon = !string.IsNullOrEmpty(fight.enemy.weaponItem) ? fight.enemy.weaponItem
                : KindIcon.TryGetValue(fight.enemy.weapon ?? "", out var icon) ? icon : null;
            stage = FightStage.Create(budSheet, enemySheet, WeaponSprite(fight.bud.weaponItem), WeaponSprite(enemyWeapon));

            budPlate.Name.text = $"{fight.bud.name}  ·  poz. {fight.bud.level}";
            enemyPlate.Name.text = pvp ? $"{fight.enemy.name}  ·  poz. {fight.enemy.level}  ·  Bud" : $"{fight.enemy.name}  ·  poz. {fight.enemy.level}";
            budPlate.HpGhost.sizeDelta = enemyPlate.HpGhost.sizeDelta = Vector2.zero;

            moves = fight.bud.moves ?? Array.Empty<string>();
            LayOutMoves();
            var weapon = string.IsNullOrEmpty(fight.bud.weaponItem) ? null : content.Item(fight.bud.weaponItem);
            // under each bar: what the fighter brings (and, for the bud, what of it comes from gear)
            budPlate.Stats = $"{weapon?.name ?? "pięści"} · Atak {fight.bud.attack}{FromGear(gear?.Attack)} · Pancerz {fight.bud.armor}{FromGear(gear?.Armor)} · Szybk. {fight.bud.speed}{FromGear(gear?.Speed)}";
            enemyPlate.Stats = $"{WeaponName(fight.enemy.weapon)} · Atak {fight.enemy.attack} · Pancerz {fight.enemy.armor}" +
                               (pvp ? " · liczy się do rankingu" : "");
            log.text = $"„{line}”";
            round.text = "RUNDA 1";
            streak = 0;
            timeScale = 1;
            result.SetActive(false);
            HideWorldHud();
            root.SetActive(true);
            root.transform.SetAsLastSibling();
            RefreshFighter(budPlate, fight.bud);
            RefreshFighter(enemyPlate, fight.enemy);
            busy = false;
            _ = Intro();
            _ = Idle(++idleToken);
        }

        /// <summary>The world's own HUD (plate, quests, buttons, hint) steps aside for the duel's.</summary>
        void HideWorldHud()
        {
            hiddenHud.Clear();
            var parent = root.transform.parent;
            for (var i = 0; i < parent.childCount; i++)
            {
                var child = parent.GetChild(i).gameObject;
                if (child == root || !child.activeSelf) continue;
                child.SetActive(false);
                hiddenHud.Add(child);
            }
        }

        /// <summary>Four wide buttons, or six narrower ones when perks add special moves.</summary>
        void LayOutMoves()
        {
            var count = Mathf.Min(moves.Length, MaxMoves);
            Canvas.ForceUpdateCanvases();
            var width = Mathf.Max(600, movesRow.rect.width);
            var gap = 12f;
            var w = Mathf.Min(count <= 4 ? 230 : 170, (width - gap * (count - 1)) / Mathf.Max(1, count));
            var total = w * count + gap * (count - 1);
            for (var i = 0; i < MaxMoves; i++)
            {
                var has = i < count;
                moveButtons[i].gameObject.SetActive(has);
                if (!has) continue;
                var rt = (RectTransform)moveButtons[i].transform;
                UiKit.Place(rt, new Vector2(0.5f, 0), new Vector2(-total / 2 + w / 2 + i * (w + gap), 0), new Vector2(w, 86), new Vector2(0.5f, 0));
                var m = content.Move(moves[i]);
                var big = count <= 4 ? 26 : 21;
                var sub = count <= 4 ? 17 : 15;
                moveLabels[i].text = UiKit.Keys($"{m?.name ?? moves[i]}  [{i + 1}]") + $"\n<size={sub}>{MoveLine(m)}</size>";
                moveLabels[i].fontSize = big;
                moveLabels[i].lineSpacing = 0.9f;
                moveLabels[i].resizeTextForBestFit = true;
                moveLabels[i].resizeTextMinSize = 14;
                moveLabels[i].resizeTextMaxSize = big;
            }
        }

        /// <summary>" (+3 ze sprzętu)" after a duel stat, so the player sees what the worn items add.</summary>
        static string FromGear(int? n) => n is > 0 ? $" <color=#a3e635>(+{n} ze sprzętu)</color>" : "";

        /// <summary>The line under a move's name: damage and accuracy, or what it does.</summary>
        static string MoveLine(MoveData m)
        {
            if (m == null) return "";
            if (m.damage && m.power is { Length: 2 })
                return $"{m.power[0]}–{m.power[1]}{(m.hits > 1 ? $" ×{m.hits}" : "")} obr. · {m.accuracy}%";
            return m.effect switch
            {
                "guard" => "połowa obrażeń",
                "dodge" => "unik",
                "aim" => "następny cios mocniej",
                "blind" => "oślepia",
                "weaken" => "osłabia",
                _ => "",
            };
        }

        public void Hide()
        {
            idleToken++;
            if (stage) stage.Close();
            stage = null;
            root.SetActive(false);
            foreach (var go in hiddenHud)
                if (go) go.SetActive(true);
            hiddenHud.Clear();
        }

        public void SetBusy(bool value)
        {
            busy = value;
            var open = !value && !introPlaying;
            foreach (var b in moveButtons) b.interactable = open;
            fleeButton.interactable = open;
        }

        public void ShowMessage(string text) => log.text = text;

        /// <summary>Keyboard: 1–6 moves, Esc runs away, E closes the result.</summary>
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
            Key[] keys = { Key.Digit1, Key.Digit2, Key.Digit3, Key.Digit4, Key.Digit5, Key.Digit6 };
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
            while (introPlaying && IsOpen) await Awaitable.NextFrameAsync();
            round.text = $"RUNDA {Mathf.Max(1, res.fight.turn)}";
            foreach (var e in res.events ?? Array.Empty<TurnEventDto>())
            {
                if (!IsOpen) return;
                await PlayEvent(e);
                await Wait(0.12f);
            }
            if (!IsOpen) return;
            RefreshFighter(budPlate, res.fight.bud);
            RefreshFighter(enemyPlate, res.fight.enemy);
            if (res.fight.status == "won") await KnockOut(stage.Enemy, stage.Bud, true);
            else if (res.fight.status == "lost") await KnockOut(stage.Bud, stage.Enemy, false);
            else stage.Frame(FightStage.Neutral, 3);
        }

        public void ShowResult(FightDto fight, FightRewardDto reward, InfluenceDto influence = null, PvpResultDto rating = null,
            string error = null)
        {
            Sprite icon = null;
            if (winTag)
            {
                _ = FadeArt(winTag, 0.2f, 1.1f);
                winTag = null;
            }
            if (rating != null && rating.Present)
            {
                // against another bud: the rating and the day's paid wins, no XP or loot
                var points = rating.delta >= 0 ? $"+{rating.delta}" : rating.delta.ToString();
                var line = $"<b>{points} pkt rankingu</b> · {rating.rating} pkt · liga {rating.league}";
                switch (fight.status)
                {
                    case "won":
                        resultTitle.text = "Wygrana!";
                        resultBody.text = line + (reward != null && reward.coinsGained > 0
                            ? $"\n<b>+{Core.GameBootstrap.Coins(reward.coinsGained)}</b>\n<size=21>Płatne wygrane dziś: jeszcze {rating.paidLeft}</size>"
                            : "\n<size=21>Płatne wygrane na dziś wykorzystane: grasz o ranking.</size>");
                        icon = UiKit.Picture("Ui/korona");
                        break;
                    case "lost":
                        resultTitle.text = "Przegrana";
                        resultBody.text = $"Tym razem górą: {fight.enemy.name}.\n" + line;
                        break;
                    default:
                        resultTitle.text = "Ucieczka";
                        resultBody.text = "Ucieczka w trakcie liczy się jak przegrana.\n" + line;
                        break;
                }
                Finish(icon, error);
                return;
            }
            switch (fight.status)
            {
                case "won":
                    resultTitle.text = "Wygrana!";
                    var sb = new System.Text.StringBuilder($"<b>+{reward.xpGained} XP</b>   <b>+{Core.GameBootstrap.Coins(reward.coinsGained)}</b>");
                    if (influence != null && influence.Present && influence.gained > 0)
                        sb.Append($"   <color=#5d9a12><b>+{influence.gained} wpływu</b></color>");
                    if (reward.levelUp) sb.Append($"\n<color=#5d9a12><b>Awans! Poziom {reward.level}</b></color>");
                    var item = string.IsNullOrEmpty(reward.item) ? null : content.Item(reward.item);
                    if (item != null)
                    {
                        sb.Append($"\nŁup: <b>{item.name}</b>\n<size=20>{Gear.Describe(content, item)}</size>");
                        icon = UiKit.Picture("Items/" + item.id);
                    }
                    else sb.Append("\nTym razem bez łupu.");
                    var drink = string.IsNullOrEmpty(reward.drink) ? null : content.Item(reward.drink);
                    if (drink != null)
                    {
                        sb.Append($"\n+ <b>{drink.name}</b>");
                        icon ??= UiKit.Picture("Items/" + drink.id);
                    }
                    resultBody.text = sb.ToString();
                    break;
                case "lost":
                    resultTitle.text = "Przegrana";
                    resultBody.text = $"Tym razem górą: {fight.enemy.name}.\nLepszy ekwipunek i kilka poziomów zrobią różnicę.";
                    break;
                default:
                    resultTitle.text = "Ucieczka";
                    resultBody.text = "Czasem lepiej się wycofać. Bez nagrody, bez straty.";
                    break;
            }
            Finish(icon, error);
        }

        void Finish(Sprite icon, string error)
        {
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
            var me = e.actor == "bud" ? stage.Bud : stage.Enemy;
            var other = e.actor == "bud" ? stage.Enemy : stage.Bud;
            var otherPlate = e.actor == "bud" ? enemyPlate : budPlate;
            var move = content.Move(e.move);
            var anim = move?.anim ?? "jab";
            var name = move?.name ?? e.move;
            log.text = $"{(e.actor == "bud" ? "Ty" : StripLevel(enemyPlate.Name.text))}: <b>{name}</b>";
            var hits = e.hits ?? Array.Empty<HitDto>();
            var finalHp = e.actor == "bud" ? e.enemyHp : e.budHp;

            // the camera leans in towards where the blow will land
            stage.Frame(FightStage.Towards(Math.Sign(other.Home.x), 0.8f, 9, 3), 7);
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
                        await React(other, otherPlate, h, anim);
                    }
                    break;
                case "spray":
                    await Spray(me, other);
                    foreach (var h in hits) await React(other, otherPlate, h, anim);
                    break;
                case "shout":
                    await Shout(me, other);
                    foreach (var h in hits) await React(other, otherPlate, h, anim);
                    break;
                default:
                    // close combat: wind up, strike, take the hit, step back
                    await Strike(me, anim);
                    foreach (var h in hits) await React(other, otherPlate, h, anim);
                    await Return(me);
                    break;
            }

            if (hits.Length > 0) SetHp(otherPlate, finalHp);
            foreach (var h in hits)
            {
                if (e.actor == "bud") streak = h.hit ? streak + 1 : 0;
                else if (h.hit) streak = 0;
            }
            if (e.actor == "bud" && hits.Length > 0 && streak >= 2)
                Popup(stage.Bud, $"Seria ×{streak}!", UiKit.Gold400, 32, 0.6f);
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
                    Popup(other, "Oślepiony!", UiKit.Alert500, 30, 0.4f);
                    break;
                case "weaken":
                    Popup(other, "Osłabiony!", UiKit.Alert500, 30, 0.4f);
                    break;
            }
            // Drugi oddech: a fighter about to fall gets a third of its health back
            if (e.secondWind != null && !string.IsNullOrEmpty(e.secondWind.who))
            {
                var saved = e.secondWind.who == "bud" ? stage.Bud : stage.Enemy;
                SetHp(e.secondWind.who == "bud" ? budPlate : enemyPlate, e.secondWind.who == "bud" ? e.budHp : e.enemyHp);
                saved.Tint = Color.white;
                Popup(saved, $"Drugi oddech! +{e.secondWind.hp}", UiKit.Buds400, 30, 0.4f);
                log.text = $"{(e.secondWind.who == "bud" ? "Ty" : StripLevel(enemyPlate.Name.text))}: <b>Drugi oddech!</b>";
                stage.Dust(saved.Position, 8, 0.7f);
                await Wait(0.35f);
            }
            await Wait(0.15f);
        }

        static string StripLevel(string plateName)
        {
            var i = plateName.IndexOf("  ·", StringComparison.Ordinal);
            return i > 0 ? plateName.Substring(0, i) : plateName;
        }

        void RefreshFighter(Plate p, FighterDto data)
        {
            p.MaxHp = data.maxHp;
            SetHp(p, data.hp);
            var s = new List<string>();
            if (data.status != null)
            {
                if (data.status.blind > 0) s.Add("oślepiony");
                if (data.status.weaken > 0) s.Add("osłabiony");
                if (data.status.aim) s.Add("celuje");
            }
            p.Status.text = s.Count > 0 ? $"<color=#ffc93c>{string.Join(" · ", s)}</color>  ·  {p.Stats}" : p.Stats;
        }

        void SetHp(Plate p, int hp)
        {
            p.Hp = Mathf.Max(0, hp);
            p.HpText.text = $"{p.Hp} / {p.MaxHp}";
            Canvas.ForceUpdateCanvases();
            var before = p.HpFill.gameObject.activeSelf ? p.HpFill.sizeDelta.x : 0;
            UiKit.SetBar(p.HpFill, p.MaxHp > 0 ? p.Hp / (float)p.MaxHp : 0);
            var after = p.HpFill.gameObject.activeSelf ? p.HpFill.sizeDelta.x : 0;
            // the trail never shrinks below the bar; it catches up a moment after a loss
            if (after >= p.HpGhost.sizeDelta.x || !IsOpen) p.HpGhost.sizeDelta = new Vector2(after, 0);
            else _ = Trail(p, Mathf.Max(before, p.HpGhost.sizeDelta.x), after);
        }

        async Awaitable Trail(Plate p, float from, float to)
        {
            var token = ++p.TrailToken;
            p.HpGhost.sizeDelta = new Vector2(from, 0);
            await Wait(0.35f);
            await Tween(0.35f, t =>
            {
                if (token == p.TrailToken && p.HpGhost) p.HpGhost.sizeDelta = new Vector2(Mathf.Lerp(from, to, Ease(t)), 0);
            });
        }

        // ---------- timing ----------

        async Awaitable Wait(float seconds)
        {
            for (var t = 0f; t < seconds; t += Time.unscaledDeltaTime * timeScale) await Awaitable.NextFrameAsync();
        }

        async Awaitable Tween(float seconds, Action<float> step)
        {
            for (var t = 0f; t < seconds; t += Time.unscaledDeltaTime * timeScale)
            {
                step(Mathf.Clamp01(t / seconds));
                await Awaitable.NextFrameAsync();
            }
            step(1);
        }

        static float Ease(float t) => 1 - (1 - t) * (1 - t);

        // ---------- motions on the stage ----------

        /// <summary>The close-combat moves: each its own path and pose up to the moment of contact.</summary>
        async Awaitable Strike(StageFighter me, string anim)
        {
            me.Frame = 1;
            switch (anim)
            {
                case "jab": // short and straight
                    await Tween(0.11f, t => me.X = 1.15f * Ease(t));
                    break;
                case "hook": // an arc from the side, the body turning into it
                    await Tween(0.17f, t =>
                    {
                        me.X = 1.35f * Ease(t);
                        me.Height = Mathf.Sin(t * Mathf.PI) * 0.2f;
                        me.Depth = -Mathf.Sin(t * Mathf.PI) * 0.35f; // swings in from the camera's side
                        me.Lean = -14 * Mathf.Sin(t * Mathf.PI);
                    });
                    break;
                case "kick": // a hop and a lean back, the leg goes first
                    me.Frame = 2;
                    stage.Ghost(me);
                    await Tween(0.21f, t =>
                    {
                        me.X = 1.6f * Ease(t);
                        me.Height = Mathf.Sin(t * Mathf.PI) * 0.55f;
                        me.Lean = 22 * t;
                        if (t > 0.5f && t < 0.56f) stage.Ghost(me);
                    });
                    break;
                case "thrust": // the weapon levels out and stabs forward
                    me.WeaponAngle = StageFighter.LevelAngle;
                    stage.Ghost(me);
                    await Tween(0.12f, t => me.X = 1.85f * Ease(t));
                    break;
                case "swing": // raised high, then a wide arc down onto the rival
                    await Tween(0.14f, t => me.WeaponAngle = Mathf.Lerp(StageFighter.RestAngle, 45, t));
                    await Tween(0.16f, t =>
                    {
                        me.X = 1.3f * Ease(t);
                        me.WeaponAngle = Mathf.Lerp(45, 180, Ease(t));
                    });
                    break;
                case "spin": // a full turn with the weapon out
                    me.WeaponAngle = StageFighter.LevelAngle;
                    await Tween(0.36f, t =>
                    {
                        me.X = 1.5f * t;
                        me.Height = Mathf.Sin(t * Mathf.PI) * 0.15f;
                        me.Lean = -360 * Ease(t);
                        if (Mathf.Repeat(t, 0.25f) < 0.03f) stage.Ghost(me);
                    });
                    me.Lean = 0;
                    break;
                case "flip": // the board flips up in the air and comes down on the rival
                    await Tween(0.32f, t =>
                    {
                        me.X = 1.4f * t;
                        me.Height = Mathf.Sin(t * Mathf.PI) * 0.95f;
                        me.WeaponAngle = StageFighter.RestAngle + 720 * t;
                    });
                    stage.Dust(me.Position, 5, 0.45f);
                    break;
                default:
                    await Tween(0.12f, t => me.X = 1.1f * Ease(t));
                    break;
            }
        }

        async Awaitable Return(StageFighter me)
        {
            var x = me.X;
            var h = me.Height;
            var d = me.Depth;
            var lean = me.Lean;
            var weapon = me.WeaponAngle;
            await Tween(0.2f, t =>
            {
                var k = Ease(t);
                me.X = Mathf.Lerp(x, 0, k);
                me.Height = Mathf.Lerp(h, 0, k);
                me.Depth = Mathf.Lerp(d, 0, k);
                me.Lean = Mathf.LerpAngle(lean, 0, k);
                me.WeaponAngle = Mathf.LerpAngle(weapon, StageFighter.RestAngle, k);
            });
            me.Frame = 0;
        }

        Vector3 Chest(StageFighter f) => f.Position + new Vector3(0, 0, -1.25f);
        Vector3 Hand(StageFighter f) => f.Position + new Vector3(f.Dir * 0.5f, -0.1f, -1.15f);

        async Awaitable Guard(StageFighter me)
        {
            var shield = stage.Prop(disc, Chest(me) + new Vector3(me.Dir * 0.55f, -0.15f, 0), 2.1f,
                new Color(UiKit.Rep400.r, UiKit.Rep400.g, UiKit.Rep400.b, 0.42f));
            await Tween(0.32f, t =>
            {
                var k = Mathf.Sin(t * Mathf.PI);
                me.SquashX = 1 - 0.06f * k;
                me.SquashY = 1 - 0.07f * k;
                me.X = -0.15f * k;
                if (shield) shield.transform.localScale = Vector3.one * (0.6f + 0.4f * Ease(t)) * 2.1f / shield.sprite.bounds.size.x;
            });
            me.SquashX = me.SquashY = 1;
            await FadeProp(shield, 0.25f);
        }

        async Awaitable Dodge(StageFighter me)
        {
            // a real step aside: back and into the depth of the street, then back to the mark
            stage.Ghost(me);
            await Tween(0.15f, t =>
            {
                me.X = -0.55f * Ease(t);
                me.Depth = 1.0f * Ease(t);
            });
            await Tween(0.17f, t =>
            {
                me.X = -0.55f * (1 - t);
                me.Depth = 1.0f * (1 - t);
            });
            stage.Dust(me.Position, 3, 0.35f);
        }

        async Awaitable Aim(StageFighter me, StageFighter target)
        {
            var mark = stage.Prop(ring, Chest(target), 1.4f, UiKit.Gold400);
            await Tween(0.42f, t =>
            {
                if (mark) mark.transform.localScale = Vector3.one * (1.7f - 0.7f * Ease(t)) * 1.4f / ring.bounds.size.x;
                me.Lean = 6 * t;
            });
            me.Lean = 0;
            await FadeProp(mark, 0.2f);
        }

        async Awaitable Shoot(StageFighter me, StageFighter target)
        {
            var from = Hand(me);
            var to = Chest(target);
            var stone = stage.Prop(disc, from, 0.22f, UiKit.Surface700);
            // pull back a little, let go
            await Tween(0.08f, t => me.X = -0.15f * t);
            await Tween(0.22f, t =>
            {
                if (stone) stone.transform.localPosition = Vector3.Lerp(from, to, t) + new Vector3(0, 0, -Mathf.Sin(t * Mathf.PI) * 0.6f);
                me.X = -0.15f * (1 - t);
            });
            if (stone) UnityEngine.Object.Destroy(stone.gameObject);
        }

        async Awaitable Spray(StageFighter me, StageFighter target)
        {
            var from = Hand(me);
            var to = Chest(target);
            Color[] colors = { UiKit.Buds400, UiKit.Rep400, UiKit.XpFill, UiKit.Gold400 };
            var puffs = new List<(SpriteRenderer r, Vector3 off)>();
            for (var i = 0; i < 10; i++)
                puffs.Add((stage.Prop(disc, from, 0.3f, colors[i % colors.Length]),
                    new Vector3(UnityEngine.Random.Range(-0.3f, 0.3f), UnityEngine.Random.Range(-0.4f, 0.4f), UnityEngine.Random.Range(-0.4f, 0.4f))));
            await Tween(0.32f, t =>
            {
                for (var i = 0; i < puffs.Count; i++)
                {
                    var (r, off) = puffs[i];
                    if (!r) continue;
                    var k = Mathf.Clamp01(t * 1.3f - i * 0.04f);
                    r.transform.localPosition = Vector3.Lerp(from, to + off, Ease(k));
                    r.transform.localScale = Vector3.one * (0.3f + 1.4f * k) * 0.3f / disc.bounds.size.x;
                    var c = r.color;
                    c.a = 0.9f * (1 - k * 0.6f);
                    r.color = c;
                }
            });
            foreach (var (r, _) in puffs) _ = FadeProp(r, 0.3f);
        }

        async Awaitable Shout(StageFighter me, StageFighter target)
        {
            var from = Hand(me);
            var to = Chest(target);
            var rings = new List<SpriteRenderer>();
            for (var i = 0; i < 3; i++) rings.Add(stage.Prop(ring, from, 0.6f, new Color(1, 1, 1, 0)));
            await Tween(0.38f, t =>
            {
                var k0 = Mathf.Sin(t * Mathf.PI);
                me.SquashX = 1 + 0.1f * k0;
                me.SquashY = 1 + 0.1f * k0;
                for (var i = 0; i < rings.Count; i++)
                {
                    var r = rings[i];
                    if (!r) continue;
                    var k = Mathf.Clamp01(t * 1.6f - i * 0.25f);
                    r.transform.localPosition = Vector3.Lerp(from, to, k);
                    r.transform.localScale = Vector3.one * (0.4f + 1.6f * k) * 0.6f / ring.bounds.size.x;
                    r.color = new Color(1, 1, 1, k > 0 && k < 1 ? 0.75f * (1 - k) + 0.2f : 0);
                }
            });
            me.SquashX = me.SquashY = 1;
            foreach (var r in rings)
                if (r) UnityEngine.Object.Destroy(r.gameObject);
        }

        /// <summary>How the target takes a hit (sound burst, sparks, flash, knockback) or a miss (a step aside).</summary>
        async Awaitable React(StageFighter target, Plate plate, HitDto hit, string anim)
        {
            if (!hit.hit)
            {
                Popup(target, "Pudło", UiKit.TextOnDarkMuted, 30);
                await Tween(0.18f, t =>
                {
                    target.Depth = Mathf.Sin(t * Mathf.PI) * 0.6f;
                    target.X = -Mathf.Sin(t * Mathf.PI) * 0.2f;
                });
                return;
            }
            var chest = Chest(target) + new Vector3(target.Dir * 0.35f, -0.2f, 0);
            stage.Sparks(chest, hit.crit, UiKit.Gold400, UiKit.TextOnDark);
            if (anim == "spray")
            {
                Color[] paint = { UiKit.Buds400, UiKit.Rep400, UiKit.Gold400 };
                stage.Paint(chest, paint[UnityEngine.Random.Range(0, paint.Length)]);
            }
            // the sound of it, on the side of the blow, kept on the screen
            _ = Impact(BurstFor(anim, hit.crit), stage.ScreenOf(target, 1.55f), target.Dir, hit.crit ? 0.5f : 0.42f);
            if (hit.crit)
            {
                // a snap zoom onto the blow, the world slows down, focus lines and halftone flare, then a shake
                stage.Cut(FightStage.Towards(Math.Sign(target.Home.x), 0.62f, 14, 9));
                _ = Focus(UiKit.Gold400);
                timeScale = 0.25f;
                await Wait(0.06f);
                if (Moment != null) await Moment("crit");
                timeScale = 1;
                stage.Shake(0.3f, 0.22f);
            }
            else stage.Shake(0.14f, 0.07f);
            Popup(target, hit.crit ? $"KRYTYK! {hit.damage}" : hit.damage.ToString(), hit.crit ? UiKit.Gold400 : UiKit.TextOnDark,
                hit.crit ? 46 : 38, 0.15f, -0.9f);
            SetHp(plate, plate.Hp - hit.damage);
            var strength = hit.crit ? 0.5f : 0.3f;
            await Tween(0.22f, t =>
            {
                target.Tint = Color.Lerp(new Color(1, 0.45f, 0.45f, 1), Color.white, t);
                target.X = -strength * (1 - t) * Mathf.Sin((1 - t) * Mathf.PI * 0.5f);
                target.Lean = 10 * (1 - t);
            });
            target.Tint = Color.white;
            target.Lean = 0;
            target.X = 0;
            if (hit.crit) stage.Frame(FightStage.Towards(Math.Sign(target.Home.x), 0.8f, 9, 3), 4);
        }

        /// <summary>The fighters walk in from the edges while the camera dollies in under a VS sticker, then WALCZ! tape.</summary>
        async Awaitable Intro()
        {
            introPlaying = true;
            SetBusy(busy);
            // wide and from the side, then into the neutral shot
            var wide = FightStage.Neutral;
            wide.Distance = 15;
            wide.Yaw = -28;
            wide.Pitch = 62;
            wide.Fov = 38;
            stage.Cut(wide);
            stage.Frame(FightStage.Neutral, 2.4f);
            stage.Bud.X = stage.Enemy.X = -3.4f;
            var vs = Art("fx-vs", Vector2.zero, 0.78f, -4);
            await Tween(0.7f, t =>
            {
                var k = Ease(t);
                foreach (var f in new[] { stage.Bud, stage.Enemy })
                {
                    f.X = Mathf.Lerp(-3.4f, 0, k);
                    f.Height = Mathf.Abs(Mathf.Sin(t * Mathf.PI * 4)) * 0.08f;
                    f.Frame = (int)(t * 8) % 2 == 0 ? 1 : 2;
                }
                if (vs)
                {
                    // dropped from above the camera: big, turned, then flat on the screen
                    var s = t < 0.7f ? Mathf.Lerp(2.4f, 0.92f, Ease(t / 0.7f)) : Mathf.Lerp(0.92f, 1, (t - 0.7f) / 0.3f);
                    vs.rectTransform.localScale = Vector3.one * s;
                    vs.rectTransform.localEulerAngles = new Vector3(0, 0, Mathf.Lerp(-22, -4, Ease(t)));
                }
            });
            foreach (var f in new[] { stage.Bud, stage.Enemy })
            {
                f.Frame = 0;
                f.Height = 0;
                stage.Dust(f.Position, 3, 0.35f);
            }
            stage.Shake(0.12f, 0.06f);
            await Wait(0.35f);
            _ = FadeArt(vs, 0.18f, 0.85f);
            // a strip of WALCZ! tape, torn off and stuck on
            var go = Art("fx-walcz", new Vector2(0, 30), 0.62f, 3);
            await Tween(0.14f, t =>
            {
                if (go) go.rectTransform.localScale = new Vector3(Mathf.Lerp(0.2f, 1, Ease(t)), Mathf.Lerp(1.4f, 1, t), 1);
            });
            _ = FadeArt(go, 0.35f, 1.1f, 0.35f);
            introPlaying = false;
            SetBusy(busy);
        }

        /// <summary>Both fighters breathe while the bud picks a move; the camera drifts a little; a low bar pulses.</summary>
        async Awaitable Idle(int token)
        {
            var t = 0f;
            while (token == idleToken && root && root.activeSelf && stage)
            {
                t += Time.unscaledDeltaTime;
                if (!busy && !introPlaying && !ShowingResult)
                {
                    foreach (var f in new[] { stage.Bud, stage.Enemy })
                    {
                        if (f.Lying > 0) continue;
                        var b = Mathf.Sin(t * 3.4f + (f.Dir > 0 ? 0 : 1.3f));
                        f.SquashX = 1 - 0.012f * b;
                        f.SquashY = 1 + 0.022f * b;
                    }
                    var drift = FightStage.Neutral;
                    drift.Yaw = Mathf.Sin(t * 0.35f) * 3;
                    drift.Look += new Vector3(Mathf.Sin(t * 0.27f) * 0.15f, 0, 0);
                    stage.Frame(drift, 1.5f);
                }
                foreach (var p in new[] { budPlate, enemyPlate })
                {
                    var low = p.MaxHp > 0 && p.Hp > 0 && p.Hp / (float)p.MaxHp < 0.3f;
                    p.HpImage.color = low ? Color.Lerp(p.HpColor, Color.white, 0.5f + 0.5f * Mathf.Sin(t * 9)) : p.HpColor;
                }
                await Awaitable.NextFrameAsync();
            }
        }

        /// <summary>
        /// The knockout: a BUM!, the loser falls flat onto the asphalt (dust), the camera orbits down onto them, a K.O.
        /// stencil is sprayed over them and, when the bud wins, its WYGRANA! tag goes up while it hops.
        /// </summary>
        async Awaitable KnockOut(StageFighter loser, StageFighter winner, bool budWon)
        {
            _ = Impact("fx-bum", stage.ScreenOf(loser, 1.7f), loser.Dir, 0.55f, 0.55f);
            _ = Focus(budWon ? UiKit.Buds400 : UiKit.Alert500);
            stage.Shake(0.35f, 0.2f);
            var orbit = FightStage.Neutral;
            orbit.Look = loser.Home + new Vector3(-loser.Dir * 0.6f, 0.2f, -0.6f);
            orbit.Distance = 6.2f;
            orbit.Yaw = Math.Sign(loser.Home.x) * 26;
            orbit.Pitch = 66;
            orbit.Fov = 32;
            stage.Frame(orbit, 2.2f);
            timeScale = 0.45f; // the fall in slow motion
            await Tween(0.5f, t =>
            {
                var k = Ease(t);
                loser.Lying = k;
                loser.X = -0.9f * k;
                loser.Height = Mathf.Sin(t * Mathf.PI) * 0.35f;
            });
            timeScale = 1;
            loser.Height = 0;
            loser.Alpha = 0.85f;
            stage.Dust(loser.Position, 9, 0.7f);
            stage.Shake(0.18f, 0.1f);

            var ko = Art("fx-ko", Local(stage.ScreenOf(loser, 0.9f)) + new Vector2(0, 40), 0.56f, UnityEngine.Random.Range(-7f, 4f));
            Clamp(ko);
            await SprayOn(ko, 0.3f);
            if (Moment != null) await Moment("ko");
            if (budWon)
            {
                winTag = Art("fx-wygrana", TopCenter(150), 0.7f, 0);
                Clamp(winTag);
                _ = SprayOn(winTag, 0.45f);
            }
            for (var hop = 0; hop < 2; hop++)
            {
                await Tween(0.28f, t => winner.Height = Mathf.Sin(t * Mathf.PI) * 0.6f);
                stage.Dust(winner.Position, 3, 0.3f);
            }
            await Wait(0.45f);
        }

        // ---------- comic street effects on the HUD layer (Resources/Ui/Fx) ----------

        /// <summary>A screen point (pixels) in the effects layer's own coordinates (centre origin).</summary>
        Vector2 Local(Vector2 screen)
        {
            RectTransformUtility.ScreenPointToLocalPointInRectangle(fx, screen, null, out var local);
            return local;
        }

        Vector2 TopCenter(float fromTop) => new(0, fx.rect.height / 2 - fromTop);

        /// <summary>A piece of effect art, centred at <paramref name="at"/> (effects-layer units), at its own size × scale.</summary>
        Image Art(string name, Vector2 at, float scale, float rotation, Color? tint = null)
        {
            var img = UiKit.Rect(name, fx).gameObject.AddComponent<Image>();
            img.sprite = UiKit.Picture("Ui/Fx/" + name);
            img.raycastTarget = false;
            img.color = tint ?? Color.white;
            img.enabled = img.sprite;
            var rt = img.rectTransform;
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0.5f, 0.5f);
            rt.sizeDelta = img.sprite ? new Vector2(img.sprite.rect.width, img.sprite.rect.height) * scale : new Vector2(100, 100) * scale;
            rt.anchoredPosition = at;
            rt.localEulerAngles = new Vector3(0, 0, rotation);
            return img;
        }

        /// <summary>Keeps a piece of art fully on the screen (and clear of the HUD bands at the top and bottom).</summary>
        void Clamp(Image img, float scale = 1)
        {
            if (!img) return;
            var rt = img.rectTransform;
            var half = rt.sizeDelta * scale / 2 + new Vector2(10, 10);
            var area = fx.rect;
            var p = rt.anchoredPosition;
            p.x = Mathf.Clamp(p.x, area.xMin + half.x, Mathf.Max(area.xMin + half.x, area.xMax - half.x));
            p.y = Mathf.Clamp(p.y, area.yMin + 120 + half.y, Mathf.Max(area.yMin + 120 + half.y, area.yMax - 130 - half.y));
            rt.anchoredPosition = p;
        }

        /// <summary>The sound of a blow, by its kind: a jab goes PAC!, a hook or kick ŁUP!, a weapon BAM!, a crit TRZASK!</summary>
        static string BurstFor(string anim, bool crit) => crit
            ? "fx-trzask"
            : anim switch
            {
                "hook" or "kick" => "fx-lup",
                "swing" or "thrust" or "spin" or "flip" or "shout" => "fx-bam",
                _ => "fx-pac",
            };

        /// <summary>A burst pops out past its size beside the target (towards the attacker), settles, holds and goes.</summary>
        async Awaitable Impact(string art, Vector2 screen, int targetDir, float scale, float hold = 0.26f)
        {
            var at = Local(screen) + new Vector2(targetDir * 120, 20);
            var img = Art(art, at, scale, UnityEngine.Random.Range(-10f, 10f));
            Clamp(img, 1.14f);
            var rt = img.rectTransform;
            await Tween(0.09f, t => { if (img) rt.localScale = Vector3.one * Mathf.Lerp(0.25f, 1.14f, Ease(t)); });
            await Tween(0.07f, t => { if (img) rt.localScale = Vector3.one * Mathf.Lerp(1.14f, 1, t); });
            await Wait(hold);
            await FadeArt(img, 0.16f, 0.8f);
        }

        /// <summary>A crit or a knockout: focus lines and halftone flare up over the whole stage and fade.</summary>
        async Awaitable Focus(Color tone)
        {
            var lines = Art("fx-speed", Vector2.zero, 1, UnityEngine.Random.Range(-4f, 4f), new Color(1, 1, 1, 0));
            var dots = Art("fx-halftone", Vector2.zero, 1, 0, new Color(tone.r, tone.g, tone.b, 0));
            lines.rectTransform.SetAsFirstSibling();
            dots.rectTransform.SetAsFirstSibling();
            var size = new Vector2(fx.rect.width * 1.2f, fx.rect.height * 1.3f);
            lines.rectTransform.sizeDelta = size;
            dots.rectTransform.sizeDelta = size;
            await Tween(0.45f, t =>
            {
                var a = t < 0.15f ? t / 0.15f : 1 - (t - 0.15f) / 0.85f;
                if (lines)
                {
                    lines.color = new Color(1, 1, 1, 0.5f * a);
                    lines.rectTransform.localScale = Vector3.one * Mathf.Lerp(1.12f, 1, Ease(t));
                }
                if (dots) dots.color = new Color(tone.r, tone.g, tone.b, 0.3f * a);
            });
            if (lines) UnityEngine.Object.Destroy(lines.gameObject);
            if (dots) UnityEngine.Object.Destroy(dots.gameObject);
        }

        /// <summary>Sprays a stencil or tag on: the paint runs across, then the piece settles with a tiny kick.</summary>
        async Awaitable SprayOn(Image img, float seconds)
        {
            if (!img) return;
            img.type = Image.Type.Filled;
            img.fillMethod = Image.FillMethod.Horizontal;
            img.fillOrigin = (int)Image.OriginHorizontal.Left;
            img.fillAmount = 0;
            var rt = img.rectTransform;
            var home = rt.anchoredPosition;
            await Tween(seconds, t =>
            {
                if (!img) return;
                img.fillAmount = Ease(t);
                rt.anchoredPosition = home + new Vector2(0, Mathf.Sin(t * 40) * 1.5f); // the hand shakes while spraying
            });
            if (!img) return;
            rt.anchoredPosition = home;
            await Tween(0.1f, t => { if (img) rt.localScale = Vector3.one * (1 + 0.05f * Mathf.Sin(t * Mathf.PI)); });
        }

        /// <summary>Fades a piece of art out (optionally growing or shrinking to <paramref name="endScale"/>) after a delay.</summary>
        async Awaitable FadeArt(Image img, float seconds, float endScale = 1, float delay = 0)
        {
            if (delay > 0) await Wait(delay);
            if (!img) return;
            var start = img.rectTransform.localScale;
            var color = img.color;
            await Tween(seconds, t =>
            {
                if (!img) return;
                img.rectTransform.localScale = start * Mathf.Lerp(1, endScale, t);
                img.color = new Color(color.r, color.g, color.b, color.a * (1 - t));
            });
            if (img) UnityEngine.Object.Destroy(img.gameObject);
        }

        async Awaitable FadeProp(SpriteRenderer r, float seconds)
        {
            if (!r) return;
            var from = r.color;
            await Tween(seconds, t =>
            {
                if (r) r.color = new Color(from.r, from.g, from.b, from.a * (1 - t));
            });
            if (r) UnityEngine.Object.Destroy(r.gameObject);
        }

        /// <summary>Floating text over a fighter's head, kept on the screen; <paramref name="shift"/> moves it sideways (in tiles).</summary>
        void Popup(StageFighter over, string text, Color color, int size, float lift = 0, float shift = 0)
        {
            var label = UiKit.Outlined("Popup", fx, text, size, color);
            label.horizontalOverflow = HorizontalWrapMode.Overflow;
            var rt = label.rectTransform;
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0.5f, 0.5f);
            rt.sizeDelta = new Vector2(300, 60);
            var screen = stage.ScreenOf(over.Position + new Vector3(shift * over.Dir, 0, -2.1f - lift));
            var start = Local(screen);
            var area = fx.rect;
            start.x = Mathf.Clamp(start.x, area.xMin + 150, area.xMax - 150);
            start.y = Mathf.Clamp(start.y, area.yMin + 160, area.yMax - 230);
            rt.anchoredPosition = start;
            _ = Float(label, start);
        }

        async Awaitable Float(Text label, Vector2 start)
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

        static string WeaponName(string kind) => kind switch
        {
            "kij" => "kij",
            "procarka" => "proca",
            "spray" => "spray",
            "mikrofon" => "mikrofon",
            "deska" => "deska",
            _ => "pięści",
        };

        static readonly Dictionary<string, Sprite> weaponSprites = new();

        /// <summary>An item icon as a world sprite held at its handle (the icons' handles sit bottom left).</summary>
        static Sprite WeaponSprite(string itemId)
        {
            if (string.IsNullOrEmpty(itemId)) return null;
            if (weaponSprites.TryGetValue(itemId, out var cached)) return cached;
            var tex = Resources.Load<Texture2D>("Items/" + itemId);
            var sprite = tex ? Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.19f, 0.13f), tex.width / 0.8f) : null;
            weaponSprites[itemId] = sprite;
            return sprite;
        }

        /// <summary>A white ring (sound waves, the aim mark).</summary>
        static Sprite MakeRing(int size)
        {
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear };
            var px = new Color32[size * size];
            var c = size / 2f;
            for (var y = 0; y < size; y++)
            for (var x = 0; x < size; x++)
            {
                var d = Vector2.Distance(new Vector2(x + 0.5f, y + 0.5f), new Vector2(c, c));
                var a = Mathf.Clamp01(c - 1 - d) * Mathf.Clamp01(d - (c - 7));
                px[y * size + x] = new Color32(255, 255, 255, (byte)(a * 255));
            }
            tex.SetPixels32(px);
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), size);
        }
    }
}
