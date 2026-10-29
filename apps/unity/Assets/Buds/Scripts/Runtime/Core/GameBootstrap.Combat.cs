using System;
using System.Collections.Generic;
using Buds.Api;
using Buds.Characters;
using Buds.Combat;
using Buds.Quests;
using Buds.UI;
using UnityEngine;
using UnityEngine.EventSystems;
using Keyboard = UnityEngine.InputSystem.Keyboard;
using Mouse = UnityEngine.InputSystem.Mouse;

namespace Buds.Core
{
    /// <summary>
    /// The fight in the main view (docs/walka.md): the server runs it (live.ts, brawl.ts), the game sends button
    /// presses and draws what happened. Phones: the stick on the left, the buttons on the right (tap = the nearest
    /// foe, drag = aim, "Anuluj" = call off). Computers: WASD, the mouse aims, left click is the basic attack, 1–4 the
    /// abilities (held = aim shown, let go = fire). Opponents of the districts fight back once hit (lurkers jump out
    /// on their own); other buds from level 6 outside the safe zones; crews side by side. Rewards come as the
    /// server's word ("reward"), a knockout as "lost": the bud gets up somewhere safe a few seconds later.
    /// </summary>
    public sealed partial class GameBootstrap
    {
        EnemyWorld enemyWorld;
        /// <summary>A guest next to an opponent (the tutorial's dummy can be practised on without the server).</summary>
        EnemyView nearbyEnemy;
        CombatFx combatFx;
        CombatUi combatUi;
        CombatPad pad;
        FollowCamera followCam;
        readonly BrawlSelf self = new();
        /// <summary>Other buds' health as the room last said (id → hp, max, down).</summary>
        readonly Dictionary<string, (int hp, int max, bool down)> budHealth = new();
        readonly List<BrawlTarget> targets = new();
        string myTeam = "";
        float lastCombatAt = -99;
        /// <summary>Walking into reach of the foe a tap went for (the stick always wins over it).</summary>
        string chaseId;
        int chaseSlot;
        float chaseUntil;
        /// <summary>A key (1–4) held on a computer: its aim follows the mouse until it is let go.</summary>
        int keyAim = -1;
        bool fightHintShown;
        /// <summary>The autopilot shows an aim on its own for a moment (no finger holds a button then).</summary>
        float demoAimUntil = -99;
        /// <summary>When the bud last landed a blow (the autopilot shoots right then).</summary>
        float landedAt = -99;

        const float PlateRange = 9f;
        /// <summary>A foe this close brings up the basic attack (the whole arc comes with the first blow).</summary>
        const float ReadyRange = 5.5f;
        const float ChaseSeconds = 1.2f;

        string Me => session?.Slug ?? "";
        bool CanFight => live != null && liveWelcomed && self.Armed && player;
        /// <summary>Knocked out, stunned or flung: the bud doesn't steer.</summary>
        bool CombatLocked => player && (self.Down(Time.time) || self.Stunned(Time.time) || player.Forced);
        bool InCombat => Time.time - lastCombatAt < 6f;

        void SetUpFights()
        {
            followCam = Camera.main ? Camera.main.GetComponent<FollowCamera>() : null;
            combatUi ??= new CombatUi(ui.FullScreen);
            if (pad != null) return;
            pad = new CombatPad(ui.Root, UiKit.Mobile);
            pad.Aiming += (slot, pull) => { };
            pad.Fire += (slot, pull, tap) => Press(slot, tap ? null : (Vector2?)pull, null);
            pad.Cancelled += _ => combatFx?.HideAim();
        }

        /// <summary>The map's fight: opponents and effects (called with the map's people).</summary>
        void SetUpMapFight()
        {
            enemyWorld = EnemyWorld.Create(world, quests.Content);
            combatFx = CombatFx.Create(world.transform);
            combatUi?.Clear();
            chaseId = null;
            keyAim = -1;
        }

        // ---------- the server's word ----------

        void HandleFight(LiveIn m)
        {
            switch (m.t)
            {
                case "ents":
                    if (m.es != null)
                        foreach (var u in m.es)
                            if (u != null && !string.IsNullOrEmpty(u.id)) Entity(u);
                    break;
                case "es":
                    if (m.es == null) break;
                    foreach (var u in m.es)
                    {
                        if (u == null || string.IsNullOrEmpty(u.id)) continue;
                        var view = enemyWorld ? enemyWorld.Unit(u.id) : null;
                        if (view) view.Apply(u, false);
                        else if (u.id != Me) budHealth[u.id] = (u.h, u.mh, u.d);
                    }
                    break;
                case "fx":
                    if (m.ev == null) break;
                    foreach (var e in m.ev)
                        if (e != null && !string.IsNullOrEmpty(e.k)) Fx(e);
                    break;
                case "you":
                    var wasDown = self.Down(Time.time);
                    var hadKit = self.Armed;
                    self.Apply(m, Time.time);
                    myTeam = m.team ?? "";
                    if (!hadKit && self.Armed && !fightHintShown)
                    {
                        fightHintShown = true;
                        ui.ShowToast(UiKit.Mobile ? "Walka: przycisk ciosu po prawej, przeciągnij, by celować." : "Walka: LPM cios, 1–4 umiejętności, mysz celuje.", 3.5f);
                    }
                    if (wasDown && !self.Down(Time.time)) combatUi?.HideKnockout();
                    break;
                case "reward":
                    Rewarded(m);
                    break;
                case "lost":
                    Lost(m);
                    break;
            }
        }

        void Entity(LiveUnitDto u)
        {
            if (!enemyWorld) return;
            var view = enemyWorld.Unit(u.id);
            if (view)
            {
                view.Apply(u, true);
                return;
            }
            if (u.kind != "shadow") return;
            // a rival or a district's defender on the street: the guest's picture until its own one arrives
            var placeholder = Resources.Load<Texture2D>("Sheets/guest");
            if (!placeholder) return;
            var shadow = EnemyView.SpawnShadow(u, BudSheet.Shared(placeholder), false, enemyWorld.transform);
            enemyWorld.AddShadow(shadow);
            if (u.only == Me)
            {
                ui.ShowToast($"{u.name} wychodzi na ulicę!", 2.5f);
                lastCombatAt = Time.time;
            }
            if (!string.IsNullOrEmpty(u.slug)) _ = LoadShadowSheet(shadow, u.slug);
        }

        async Awaitable LoadShadowSheet(EnemyView view, string slug)
        {
            try
            {
                var tex = await api.GetSheet(slug, false, LiveSheetScale);
                if (!view || !tex)
                {
                    if (tex) Destroy(tex);
                    return;
                }
                view.SetSheet(new BudSheet(tex, true), true);
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[Fight] no sheet for {slug}: {e.Message}");
            }
        }

        // ---------- who is who ----------

        (GameObject root, Transform visual, SpriteRenderer body, Vector3 head, Vector2 feet)? Body(string id)
        {
            if (string.IsNullOrEmpty(id)) return null;
            if (id == Me && player) return (player.gameObject, player.Visual, player.Body, RemoteBud.HeadOf(player.Body, player.transform), player.transform.position);
            if (remotes.TryGetValue(id, out var r) && r && r.Visual) return (r.gameObject, r.Visual, r.Body, r.Head, r.transform.position);
            var view = enemyWorld ? enemyWorld.Unit(id) : null;
            if (view) return (view.gameObject, view.Visual, view.Body, view.Head, view.Feet);
            return null;
        }

        CombatPose PoseOf(string id)
        {
            var b = Body(id);
            return b.HasValue && b.Value.visual ? CombatPose.For(b.Value.root, b.Value.visual, b.Value.body) : null;
        }

        /// <summary>Which side a fighter is on for this bud (its colour).</summary>
        BrawlLook.Side SideOf(string id)
        {
            if (id == Me) return BrawlLook.Side.Me;
            var view = enemyWorld ? enemyWorld.Unit(id) : null;
            if (view) return !view.IsShadow || view.Only == Me ? BrawlLook.Side.Foe : BrawlLook.Side.Neutral;
            if (remotes.TryGetValue(id, out var r) && r)
                return BrawlLook.BudSide(myTeam, r.Data.team, self.Open && r.Data.level >= 6);
            return BrawlLook.Side.Neutral;
        }

        bool Hostile(string id) => SideOf(id) == BrawlLook.Side.Foe;

        /// <summary>Every foe the bud could aim at now, with where it stands.</summary>
        IReadOnlyList<BrawlTarget> Targets()
        {
            targets.Clear();
            if (enemyWorld)
                foreach (var e in enemyWorld.Enemies)
                    if (e && e.Available && (!e.IsShadow || e.Only == Me))
                        targets.Add(new BrawlTarget { Id = e.UnitId, At = e.Feet, Hostile = true });
            if (self.Open)
                foreach (var pair in remotes)
                {
                    var r = pair.Value;
                    if (!r || (budHealth.TryGetValue(pair.Key, out var h) && h.down)) continue;
                    if (SideOf(pair.Key) == BrawlLook.Side.Foe) targets.Add(new BrawlTarget { Id = pair.Key, At = r.Shown, Hostile = true });
                }
            return targets;
        }

        // ---------- pressing buttons ----------

        /// <summary>
        /// A button: with a pull (a dragged aim) it fires where the pull points; without (a tap, a key, a click) at the
        /// foe the auto-aim picks: the one pointed at (<paramref name="spot"/>), else the nearest in reach.
        /// </summary>
        void Press(int slot, Vector2? pull, Vector2? spot)
        {
            combatFx?.HideAim();
            if (!player) return;
            var now = Time.time;
            if (!CanFight)
            {
                FightOffline();
                return;
            }
            if (!self.CanPress(slot, now)) return;
            var e = self.Kit[slot];
            var me = (Vector2)player.transform.position;
            var facing = FacingVector();
            string target = null;
            Vector2 aim;
            if (BrawlAim.Aimless(e)) aim = me + facing;
            else if (pull.HasValue)
            {
                aim = BrawlAim.FromPull(me, pull.Value, e, facing);
                // a drag right at a foe still locks on it (a stone flies true)
                if (!BrawlAim.AimsASpot(e)) target = BrawlAim.Along(me, aim, Targets(), BrawlAim.Reach(e) + 1, out _);
            }
            else
            {
                var reach = BrawlAim.Reach(e) + BrawlAim.TapSlack;
                target = spot.HasValue
                    ? BrawlAim.Along(me, spot.Value, Targets(), reach, out var at) ?? BrawlAim.Nearest(me, Targets(), reach, out at)
                    : BrawlAim.Nearest(me, Targets(), reach, out at);
                aim = target != null ? at : spot ?? me + facing * Mathf.Max(1, e.range);
                if (BrawlAim.AimsASpot(e)) aim = BrawlAim.Clamp(me, aim, e);
                // a foe a few steps too far: walk in and hit (only a basic attack and only while the stick is free)
                if (target != null && Vector2.Distance(me, at) > BrawlAim.Reach(e) + 0.2f && e.shape is "melee" or "arc")
                {
                    chaseId = target;
                    chaseSlot = slot;
                    chaseUntil = now + ChaseSeconds;
                    return;
                }
            }
            Send(slot, aim, target);
        }

        void Send(int slot, Vector2 aim, string target)
        {
            var e = self.Kit[slot];
            live.Send(LiveProtocol.Act(slot, aim, target));
            self.Pressed(slot, Time.time);
            lastCombatAt = Time.time;
            chaseId = null;
            // the bud turns to its blow at once (the server's cast event follows a moment later)
            var dir = aim - (Vector2)player.transform.position;
            if (dir.sqrMagnitude > 0.01f && e.shape != "shield" && e.shape != "buff") player.Look(dir);
        }

        Vector2 FacingVector() => player.Facing switch
        {
            Facing.Up => Vector2.up,
            Facing.Side => player.Motor.FacingRight ? Vector2.right : Vector2.left,
            _ => Vector2.down,
        };

        void FightOffline()
        {
            // the tutorial's dummy still counts for a guest, so the island can be finished
            var dummy = enemyWorld ? enemyWorld.Nearest(player.transform.position, 3f) : null;
            if (dummy && PracticeAsGuest(dummy)) return;
            ui.ShowToast(session == null ? "Walczy połączony Bud: XP i łup zapisuje serwer." : "Brak połączenia z serwerem: walka wróci, gdy się połączy.", 2.6f);
        }

        /// <summary>Every frame: the buttons, the aim on the ground, a computer's mouse and keys, walking into reach.</summary>
        void UpdateCombat(PlayerInput input, bool windowOpen)
        {
            var now = Time.time;
            var showPad = self.Armed && player && !windowOpen && !travelling && ui.HudVisible;
            if (!player)
            {
                pad?.SetMode(CombatPad.Mode.Hidden);
                pad?.Tick(self, now);
                return;
            }
            var me = (Vector2)player.transform.position;
            // the buttons come only with a fight: the basic attack alone with a foe close, the whole arc once blows fly
            var mode = !showPad ? CombatPad.Mode.Hidden
                : InCombat || self.Down(now) || self.Stunned(now) || (pad != null && pad.Holding) ? CombatPad.Mode.Full
                : BrawlAim.Nearest(me, Targets(), ReadyRange, out _) != null ? CombatPad.Mode.Ready
                : CombatPad.Mode.Hidden;
            pad?.SetMode(mode);
            pad?.Tick(self, now);

            if (!showPad)
            {
                combatFx?.HideAim();
                input.Assist = null;
                chaseId = null;
                keyAim = -1;
                return;
            }

            // a finger holding an ability: its reach on the ground, where it will land
            if (pad.Holding && pad.Held != BrawlSelf.Basic && pad.Pull.magnitude >= BrawlAim.TapDrag)
            {
                var e = self.Kit[pad.Held];
                if (e != null && !BrawlAim.Aimless(e))
                    combatFx?.ShowAim(e, me, BrawlAim.FromPull(me, pad.Pull, e, FacingVector()), pad.OverCancel);
                else if (e != null) combatFx?.ShowAim(e, me, me, pad.OverCancel);
            }
            else if (pad.Holding && pad.Held != BrawlSelf.Basic && self.Kit[pad.Held] is { } held && BrawlAim.Aimless(held))
                combatFx?.ShowAim(held, me, me, pad.OverCancel);
            else if (keyAim < 0 && Time.time > demoAimUntil) combatFx?.HideAim();
            // holding the basic attack keeps attacking
            if (pad.BasicHeld && pad.HeldFor > 0.25f && self.CanPress(BrawlSelf.Basic, now)) Press(BrawlSelf.Basic, null, null);

            PcFight(me, now);

            // walking into reach of the tapped foe, until it is in reach, gone or the stick moves
            input.Assist = null;
            if (chaseId != null)
            {
                var b = Body(chaseId);
                var e = self.Kit[chaseSlot];
                if (!b.HasValue || e == null || now > chaseUntil || self.Down(now) || input.Move.sqrMagnitude > 0.04f || !Hostile(chaseId))
                    chaseId = null;
                else
                {
                    var to = b.Value.feet - me;
                    if (to.magnitude <= Mathf.Max(1.05f, BrawlAim.Reach(e) - 0.15f))
                    {
                        if (self.CanPress(chaseSlot, now)) Send(chaseSlot, b.Value.feet, chaseId);
                        chaseId = null;
                    }
                    else input.Assist = to.normalized;
                }
            }
        }

        /// <summary>A computer: left click = the basic attack at the mouse, 1–4 held = aim at the mouse, let go = fire.</summary>
        void PcFight(Vector2 me, float now)
        {
            var mouse = Mouse.current;
            var kb = Keyboard.current;
            if (mouse == null || kb == null || UiKit.Mobile) return;
            var cursor = MouseOnGround(mouse.position.ReadValue());
            var overUi = EventSystem.current && EventSystem.current.IsPointerOverGameObject();
            if (cursor.HasValue && !overUi && mouse.leftButton.isPressed && self.CanPress(BrawlSelf.Basic, now) &&
                (mouse.leftButton.wasPressedThisFrame || now - lastCombatAt > 0.05f))
                Press(BrawlSelf.Basic, null, cursor);

            var keys = new[] { kb.digit1Key, kb.digit2Key, kb.digit3Key, kb.digit4Key };
            for (var i = 0; i < keys.Length; i++)
            {
                var slot = i + 1;
                if (keys[i].wasPressedThisFrame && self.Kit[slot] != null) keyAim = slot;
                if (keyAim == slot && keys[i].wasReleasedThisFrame)
                {
                    keyAim = -1;
                    combatFx?.HideAim();
                    var e = self.Kit[slot];
                    if (e == null || !cursor.HasValue) continue;
                    if (BrawlAim.Aimless(e)) Press(slot, Vector2.zero, null);
                    else
                    {
                        // the mouse is the aim: a spot for areas, a direction (and the foe there) for the rest
                        var to = cursor.Value - me;
                        var reach = Mathf.Max(0.5f, e.range);
                        var pull = BrawlAim.AimsASpot(e) ? Vector2.ClampMagnitude(to / reach, 1) : to.normalized;
                        var foe = BrawlAim.Along(me, cursor.Value, Targets(), BrawlAim.Reach(e) + 1, out var at);
                        if (foe != null && !BrawlAim.AimsASpot(e)) Press(slot, null, at);
                        else Press(slot, pull, null);
                    }
                }
            }
            if (keyAim > 0 && cursor.HasValue && self.Kit[keyAim] is { } aimed)
                combatFx?.ShowAim(aimed, me, BrawlAim.AimsASpot(aimed) ? BrawlAim.Clamp(me, cursor.Value, aimed) : cursor.Value, false);
        }

        /// <summary>Where a screen point lands on the ground (the XY plane the map lies on).</summary>
        Vector2? MouseOnGround(Vector2 screen)
        {
            var cam = Camera.main;
            if (!cam) return null;
            var ray = cam.ScreenPointToRay(screen);
            if (Mathf.Abs(ray.direction.z) < 1e-4f) return null;
            var t = -ray.origin.z / ray.direction.z;
            if (t <= 0) return null;
            var p = ray.origin + ray.direction * t;
            return new Vector2(p.x, p.y);
        }

        // ---------- what happened ----------

        void Fx(LiveFxDto e)
        {
            var mine = e.u == Me || e.v == Me;
            if (mine) lastCombatAt = Time.time;
            switch (e.k)
            {
                case "cast":
                {
                    var caster = Body(e.u);
                    if (!caster.HasValue) break;
                    var from = caster.Value.feet;
                    var dir = new Vector2(e.x, e.y) - from;
                    var pose = PoseOf(e.u);
                    if (e.ms >= 150) pose?.WindUp(dir, e.ms / 1000f);
                    else if (e.s is not ("shield" or "buff")) pose?.Lunge(dir, e.s == "dash" ? 0.1f : 0.24f);
                    var turning = e.u != Me && enemyWorld ? enemyWorld.Unit(e.u) : null;
                    if (turning) turning.Face(new Vector3(e.x, e.y, 0));
                    // a foe's slow blow: the ground it will hit turns red until it lands
                    if (e.u != Me && Hostile(e.u) && e.ms >= 150 && e.s is "circle" or "self" or "line" or "arc" or "dash" or "melee")
                        combatFx?.Telegraph(e.s, from, new Vector2(e.x, e.y), Mathf.Max(0.5f, e.r), e.w, e.w, Mathf.Max(0.5f, e.n), e.ms / 1000f, UiKit.Alert500);
                    break;
                }
                case "proj":
                {
                    var speed = Mathf.Max(4, e.n);
                    var from = new Vector2(e.x, e.y - 0.5f);
                    var to = new Vector2(e.x2, e.y2 - 0.5f);
                    var kind = e.a is "diss" or "roast" ? "sound" : e.a is "psik" or "psik-z-bliska" ? "paint" : "stone";
                    combatFx?.Fly(kind, e.u, from, to, Vector2.Distance(from, to) / speed);
                    PoseOf(e.u)?.Lunge(to - from, 0.14f, 0.12f);
                    break;
                }
                case "area":
                {
                    // every kind of blow its own look, a foe's with a red cast so it reads as danger
                    var blow = CombatFx.StyleOf(e.a);
                    var tone = Hostile(e.u)
                        ? CombatFx.Mix(CombatFx.ToneOf(blow), UiKit.Alert500, 0.45f)
                        : CombatFx.ToneOf(blow);
                    if (e.s == "wedge" || e.s == "line")
                    {
                        combatFx?.Swing(e.s == "line" ? "line" : "arc", new Vector2(e.x, e.y), new Vector2(e.x2, e.y2), e.w, e.w, tone, blow);
                        if (e.s == "wedge") PoseOf(e.u)?.Lunge(new Vector2(e.x2 - e.x, e.y2 - e.y));
                    }
                    else
                    {
                        var kind = e.a is "chmura" or "burza-farby" or "tag" or "ult-spray" ? "paint" : e.a == "ult-procarka" ? "stones" : null;
                        var caster = Body(e.u);
                        var follows = caster.HasValue && Vector2.Distance(caster.Value.feet, new Vector2(e.x, e.y)) < 0.3f ? caster.Value.root.transform : null;
                        combatFx?.Area(new Vector2(e.x, e.y), Mathf.Max(0.5f, e.r), tone, blow, follows, kind);
                        if (e.u == Me && e.r >= 2) followCam?.Kick(0.18f);
                    }
                    break;
                }
                case "hit":
                    Hit(e);
                    break;
                case "st":
                    PoseOf(e.v)?.Status(e.a, e.ms / 1000f);
                    if (e.v == Me && e.a == "stun" && FightHead(Me) is { } stunned) combatUi?.Pop(stunned, "Ogłuszenie", UiKit.Gold400, false);
                    break;
                case "dash":
                case "knock":
                {
                    var id = e.k == "dash" ? e.u : e.v;
                    var b = Body(id);
                    var from = new Vector2(e.x, e.y);
                    var to = new Vector2(e.x2, e.y2);
                    if (b.HasValue) combatFx?.Ghosts(b.Value.body, from, to, CombatFx.Tone(SideOf(id)));
                    if (id == Me && player)
                    {
                        self.Forced = Mathf.Max(self.Forced, e.q);
                        player.ForceMove(to, Mathf.Max(0.08f, e.ms / 1000f));
                        if (e.k == "knock") followCam?.Kick(0.3f);
                    }
                    if (e.k == "dash") PoseOf(id)?.Lunge(to - from, 0.18f, Mathf.Max(0.12f, e.ms / 1000f));
                    break;
                }
                case "ko":
                    KnockedOut(e);
                    break;
                case "rsp":
                {
                    PoseOf(e.v)?.GetUp();
                    var view = enemyWorld ? enemyWorld.Unit(e.v) : null;
                    if (view)
                    {
                        view.SetDown(false);
                        view.SetHealth(e.h, e.mh);
                    }
                    else if (e.v != Me) budHealth[e.v] = (e.h, e.mh, false);
                    if (e.v == Me && player)
                    {
                        self.Forced = Mathf.Max(self.Forced, e.q);
                        player.ForceMove(new Vector2(e.x, e.y), 0);
                        followCam?.SnapToTarget();
                        combatUi?.HideKnockout();
                        combatFx?.Burst(new Vector2(e.x, e.y), 1.4f, UiKit.Buds400);
                        ui.ShowToast("Wstajesz. Chwila spokoju, zanim ktoś znowu zaczepi.", 2.5f);
                    }
                    break;
                }
                case "heal":
                {
                    var view = enemyWorld ? enemyWorld.Unit(e.v) : null;
                    if (view) view.SetHealth(e.h, e.mh);
                    else if (e.v != Me) budHealth[e.v] = (e.h, e.mh, false);
                    if (e.n > 0 && FightHead(e.v) is { } head) combatUi?.Pop(head, $"+{Mathf.RoundToInt(e.n)}", UiKit.Buds400, false);
                    break;
                }
                case "gone":
                    if (enemyWorld) enemyWorld.RemoveShadow(e.v);
                    break;
                case "aggro":
                {
                    var view = enemyWorld ? enemyWorld.Unit(e.u) : null;
                    if (!view) break;
                    if (e.a == "spring")
                    {
                        view.SetLurking(false);
                        if (e.v == Me)
                        {
                            ui.ShowToast($"Zasadzka! {view.Data.name} (poz. {view.Data.level})", 2.5f);
                            followCam?.Kick(0.25f);
                        }
                    }
                    if (e.v == Me) lastCombatAt = Time.time;
                    break;
                }
            }
        }

        void Hit(LiveFxDto e)
        {
            var victim = Body(e.v);
            var attacker = Body(e.u);
            var view = enemyWorld ? enemyWorld.Unit(e.v) : null;
            if (view) view.SetHealth(e.h, e.mh);
            else if (e.v != Me && e.mh > 0) budHealth[e.v] = (e.h, e.mh, e.h <= 0);
            // a shot of the attacker stops where it landed
            combatFx?.Landed(e.u, victim?.feet ?? Vector2.zero);
            if (!victim.HasValue) return;
            var head = victim.Value.head;
            var damage = Mathf.RoundToInt(e.n);
            if (e.u == Me && damage > 0) landedAt = Time.time;
            if (!e.e && damage > 0)
            {
                PoseOf(e.v)?.Hit(attacker.HasValue ? attacker.Value.feet - victim.Value.feet : Vector2.zero);
                combatFx?.Impact(head, damage, e.c, e.mh, CombatFx.StyleOf(e.a));
            }
            // numbers: what the bud dealt in white (gold when critical), what it took in red, the rest small and grey
            var color = e.v == Me ? UiKit.Alert500 : e.u == Me ? (e.c ? UiKit.Gold400 : Color.white) : new Color(0.85f, 0.86f, 0.9f, 0.9f);
            if (e.e) color = UiKit.TextOnDarkMuted;
            if (e.u == Me || e.v == Me || e.c) combatUi?.Pop(head + new Vector3(0, 0.1f, 0), BrawlLook.DamageText(damage, e.c, e.e), color, e.c);
            if (e.v == Me && damage > 0) Haptics.Tap(e.c ? 45 : 25);
            if (e.v == Me && damage > 0) followCam?.Kick(Mathf.Clamp(0.18f + (float)damage / Mathf.Max(1, e.mh) * 2, 0.18f, 0.55f));
            else if (e.u == Me && e.c) followCam?.Kick(0.22f);
        }

        void KnockedOut(LiveFxDto e)
        {
            PoseOf(e.v)?.KnockDown();
            var view = enemyWorld ? enemyWorld.Unit(e.v) : null;
            if (view)
            {
                view.SetDown(true);
                view.SetHealth(0, view.MaxHp);
                // a beaten shadow leaves the street for good once it has fallen and faded
                if (view.IsShadow) _ = ShadowLeaves(view.UnitId);
            }
            else if (e.v != Me) budHealth[e.v] = (0, budHealth.TryGetValue(e.v, out var h) ? h.max : 0, true);
            if (Body(e.v) is { } fallen) combatFx?.KnockOut(fallen.head);
            if (e.v == Me)
            {
                Haptics.Tap(120);
                followCam?.Kick(0.6f);
                chaseId = null;
                pad?.Release(false);
                var by = Body(e.u).HasValue ? NameOf(e.u) : "";
                combatUi?.ShowKnockout(by, 5f);
            }
            else if (e.u == Me) followCam?.Kick(0.35f);
        }

        async Awaitable ShadowLeaves(string id)
        {
            await Awaitable.WaitForSecondsAsync(2.4f);
            if (enemyWorld) enemyWorld.RemoveShadow(id);
        }

        string NameOf(string id)
        {
            var view = enemyWorld ? enemyWorld.Unit(id) : null;
            if (view) return view.Data.name;
            return remotes.TryGetValue(id, out var r) && r ? r.Name : "";
        }

        void Rewarded(LiveIn m)
        {
            var reward = m.reward != null && m.reward.level > 0 ? m.reward : null;
            var influence = m.influence != null && m.influence.Present ? m.influence : null;
            switch (m.kind)
            {
                case "mob":
                {
                    if (reward == null) break;
                    var movesBefore = CurrentMoves(reward.level - (reward.levelUp ? 1 : 0));
                    SetXp(reward.xp);
                    if (!string.IsNullOrEmpty(reward.drink)) _ = LoadConsumables();
                    var item = string.IsNullOrEmpty(reward.item) ? null : quests.Content.Item(reward.item);
                    var earned = influence != null && influence.gained > 0 ? $" · +{influence.gained} wpływu" : "";
                    if (reward.levelUp) ui.ShowToast($"Awans! Poziom {reward.level} (+1 punkt)" + MovesNote(movesBefore), 4f);
                    else if (item != null) ui.ShowToast($"Łup: {item.name}. Załóż w Ekwipunku.", 3f);
                    else ui.ShowToast($"Pokonany: {m.name}  ·  +{reward.xpGained} XP · +{Coins(reward.coinsGained)}{earned}", 2.8f);
                    OnInfluence(influence, false);
                    if (quests.Duel(m.enemy)) ui.ShowToast("Cel zadania osiągnięty!", 2.5f);
                    break;
                }
                case "pvp":
                {
                    var pvp = m.pvp != null && m.pvp.Present ? m.pvp : null;
                    if (pvp != null)
                    {
                        var delta = pvp.delta >= 0 ? $"+{pvp.delta}" : pvp.delta.ToString();
                        var coins = reward != null && reward.coinsGained > 0 ? $" · +{Coins(reward.coinsGained)}" : "";
                        ui.ShowToast($"{(pvp.delta >= 0 ? "Wygrana" : "Porażka")} z {m.name}: {delta} pkt · liga {pvp.league}{coins}", 3.5f);
                    }
                    break;
                }
                case "raid":
                {
                    var raid = m.raid != null && m.raid.Present ? m.raid : null;
                    if (raid != null)
                    {
                        if (raid.won && Land.LootText(raid.loot) is { } loot) ui.ShowToast($"Napad udany! Łup: {loot}", 3.5f);
                        else ui.ShowToast(raid.won ? "Napad udany, ale nie było czego zabrać." : $"Napad odparty: {raid.district} się obronił.", 3f);
                    }
                    _ = RefreshDistricts(true);
                    break;
                }
                case "street":
                {
                    var coins = reward != null && reward.coinsGained > 0 ? $"  ·  +{Coins(reward.coinsGained)}" : "";
                    var pvp = m.pvp != null && m.pvp.Present ? $"  ·  +{m.pvp.delta} pkt ligi" : "";
                    ui.ShowToast($"Nokaut! {m.name} leży.{coins}{pvp}", 3f);
                    break;
                }
            }
        }

        void Lost(LiveIn m)
        {
            var coins = m.coins > 0 ? $" Z kieszeni wypada {Coins(m.coins)}." : "";
            var by = string.IsNullOrEmpty(m.name) ? "" : $" ({m.name})";
            ui.ShowToast($"Nokaut{by}.{coins} Wstajesz w bezpiecznym miejscu.", 3.5f);
            if (m.kind is "pvp" or "raid") _ = RefreshDistricts(true);
        }

        // ---------- plates over the heads ----------

        void FightPlates()
        {
            if (combatUi == null || !player) return;
            var showWorld = player && !travelling && ui.HudVisible;
            combatUi.SetVisible(showWorld);
            if (!showWorld) return;
            var me = (Vector2)player.transform.position;
            var now = Time.time;
            if (self.Armed && (self.Hp < self.MaxHp || InCombat || self.Shield > 0))
                combatUi.Show(Me, BrawlLook.Side.Me, level, null, self.Hp, self.MaxHp, self.Shield);
            if (enemyWorld)
                foreach (var e in enemyWorld.Enemies)
                {
                    if (!e || !e.Available) continue;
                    var near = Vector2.Distance(me, e.Feet) < PlateRange;
                    if (!near && (e.MaxHp == 0 || e.Hp >= e.MaxHp)) continue;
                    if (e.IsShadow && e.Only != Me && !near) continue;
                    var max = e.MaxHp > 0 ? e.MaxHp : 1;
                    var hp = e.MaxHp > 0 ? e.Hp : 1;
                    combatUi.Show(e.UnitId, e.IsShadow && e.Only != Me ? BrawlLook.Side.Neutral : BrawlLook.Side.Foe, e.Data.level, e.Data.name, hp, max);
                }
            foreach (var pair in remotes)
            {
                if (!pair.Value || !budHealth.TryGetValue(pair.Key, out var h) || h.max <= 0 || h.down) continue;
                var side = SideOf(pair.Key);
                var near = Vector2.Distance(me, pair.Value.Shown) < PlateRange;
                if (h.hp >= h.max && !(side == BrawlLook.Side.Foe && near) && side != BrawlLook.Side.Ally) continue;
                combatUi.Show(pair.Key, side, pair.Value.Data.level, null, h.hp, h.max);
            }
            combatUi.Tick(Camera.main, FightHead);
            combatUi.TickKnockout(now, self.DownUntil);
        }

        Vector3? FightHead(string id)
        {
            if (id == Me) return player ? RemoteBud.HeadOf(player.Body, player.transform) : null;
            if (remotes.TryGetValue(id, out var r) && r) return r.Head;
            var view = enemyWorld ? enemyWorld.Unit(id) : null;
            return view && view.Available ? view.Head : null;
        }

        /// <summary>A bud's name tag moves up when a plate sits over its head.</summary>
        bool HasPlate(string id) => combatUi != null && combatUi.Has(id);

        /// <summary>The fight forgets everything (a new room, the connection gone).</summary>
        void ForgetFight()
        {
            self.Reset();
            budHealth.Clear();
            chaseId = null;
            keyAim = -1;
            combatFx?.Clear();
            combatUi?.Clear();
            combatUi?.HideKnockout();
            pad?.Release(false);
            pad?.SetVisible(false);
            if (player) player.Input.Assist = null;
        }
    }
}
