using System.Collections.Generic;
using Buds.Api;
using Buds.Combat;
using NUnit.Framework;
using UnityEngine;

namespace Buds.Tests
{
    /// <summary>The fight in the main view (docs/walka.md): the wire, the buttons, the aim, the colours, the shapes.</summary>
    public class CombatTests
    {
        const string You =
            "{\"t\":\"you\",\"hp\":150,\"mhp\":180,\"sh\":20,\"ko\":0,\"guard\":0,\"stun\":400,\"open\":true,\"team\":\"ZR\"," +
            "\"kit\":[{\"id\":\"prosty\",\"name\":\"Prosty\",\"shape\":\"melee\",\"range\":1.35,\"radius\":0,\"angle\":110,\"width\":0,\"cd\":700,\"anim\":\"jab\",\"icon\":\"ab-fist\",\"windup\":110}," +
            "{\"id\":\"sierpowy\",\"name\":\"Sierpowy\",\"shape\":\"dash\",\"range\":2.6,\"radius\":0.9,\"angle\":0,\"width\":0,\"cd\":6000,\"anim\":\"hook\",\"icon\":\"ab-dash\",\"windup\":60}," +
            "{\"id\":\"kopniak\",\"name\":\"Kopniak\",\"shape\":\"arc\",\"range\":2.1,\"radius\":0,\"angle\":80,\"width\":0,\"cd\":7500,\"anim\":\"kick\",\"icon\":\"ab-kick\",\"windup\":200}," +
            "{\"id\":\"garda\",\"name\":\"Garda\",\"shape\":\"shield\",\"range\":0,\"radius\":0,\"angle\":0,\"width\":0,\"cd\":12000,\"anim\":\"guard\",\"icon\":\"ab-shield\",\"windup\":0}," +
            "null],\"cd\":[0,3000,0,0,0]}";

        [Test]
        public void TheBudsOwnSideComesFromTheServer()
        {
            var m = LiveProtocol.Parse(You);
            var self = new BrawlSelf();
            Assert.IsFalse(self.Armed);
            self.Apply(m, 10);
            Assert.IsTrue(self.Armed);
            Assert.AreEqual(150, self.Hp);
            Assert.AreEqual(180, self.MaxHp);
            Assert.AreEqual(20, self.Shield);
            Assert.IsTrue(self.Open);
            Assert.AreEqual("ZR", m.team);
            Assert.AreEqual("prosty", self.Kit[0].id);
            Assert.AreEqual("ab-dash", self.Kit[1].icon);
            Assert.IsNull(self.Kit[4], "no ultimate before level 5: an empty button");
            // held for 0.4 s: nothing can be pressed
            Assert.IsTrue(self.Stunned(10.2f));
            Assert.IsFalse(self.CanPress(0, 10.2f));
            Assert.IsTrue(self.CanPress(0, 10.5f));
            // three seconds of cooldown on the dash
            Assert.IsFalse(self.CanPress(1, 12.9f));
            Assert.IsTrue(self.CanPress(1, 13.05f));
            Assert.AreEqual(0.5f, self.CooldownShare(1, 10.0f), 0.01f);
            Assert.IsFalse(self.CanPress(4, 20), "an empty button never fires");
        }

        [Test]
        public void APressGreysTheButtonAtOnceAndKeepsTheGlobalPause()
        {
            var self = new BrawlSelf();
            self.Apply(LiveProtocol.Parse(You), 0);
            self.Pressed(0, 1);
            Assert.IsFalse(self.CanPress(0, 1.5f), "the basic attack's own cooldown");
            Assert.IsFalse(self.CanPress(2, 1.1f), "the global pause after any press");
            Assert.IsTrue(self.CanPress(2, 1 + BrawlSelf.GlobalCooldown + 0.01f));
            Assert.IsTrue(self.CanPress(0, 1.71f));
        }

        [Test]
        public void ATapAimsAtTheNearestFoeAndAClickAtTheOnePointedAt()
        {
            var me = Vector2.zero;
            var targets = new List<BrawlTarget>
            {
                new() { Id = "near", At = new Vector2(2, 0), Hostile = true },
                new() { Id = "far", At = new Vector2(0, 5), Hostile = true },
                new() { Id = "mate", At = new Vector2(1, 0), Hostile = false },
            };
            Assert.AreEqual("near", BrawlAim.Nearest(me, targets, 6, out var at));
            Assert.AreEqual(new Vector2(2, 0), at);
            Assert.IsNull(BrawlAim.Nearest(me, targets, 1.5f, out _), "an ally is never a target");
            Assert.AreEqual("far", BrawlAim.Along(me, new Vector2(0.3f, 4.5f), targets, 6, out _));
        }

        [Test]
        public void ADragPicksADirectionOrASpot()
        {
            var circle = new KitEntryDto { id = "chmura", shape = "circle", range = 5, radius = 1.8f };
            var shot = new KitEntryDto { id = "strzal", shape = "proj", range = 7 };
            // an area goes as far as the pull is long; a shot always flies its full reach
            Assert.AreEqual(new Vector2(2.5f, 0), BrawlAim.FromPull(Vector2.zero, new Vector2(0.5f, 0), circle, Vector2.down));
            Assert.AreEqual(new Vector2(0, 7), BrawlAim.FromPull(Vector2.zero, new Vector2(0, 0.3f), shot, Vector2.down));
            // no pull: along the facing
            Assert.AreEqual(new Vector2(0, -7), BrawlAim.FromPull(Vector2.zero, Vector2.zero, shot, Vector2.down));
            Assert.AreEqual(new Vector2(5, 0), BrawlAim.Clamp(Vector2.zero, new Vector2(9, 0), circle));
            Assert.IsTrue(BrawlAim.Aimless(new KitEntryDto { shape = "shield" }));
            Assert.IsTrue(BrawlAim.AimsASpot(circle));
            Assert.AreEqual(3, BrawlAim.FacingCode(new Vector2(1, 0.2f), 0));
            Assert.AreEqual(2, BrawlAim.FacingCode(new Vector2(0.1f, 1), 0));
            Assert.AreEqual(1, BrawlAim.FacingCode(Vector2.zero, 1), "no direction keeps the facing");
        }

        [Test]
        public void SidesAndNumbersReadAtAGlance()
        {
            Assert.AreEqual(BrawlLook.Side.Ally, BrawlLook.BudSide("ZR", "ZR", true));
            Assert.AreEqual(BrawlLook.Side.Foe, BrawlLook.BudSide("ZR", "XX", true));
            Assert.AreEqual(BrawlLook.Side.Foe, BrawlLook.BudSide("", "", true), "no crew is nobody's ally");
            Assert.AreEqual(BrawlLook.Side.Neutral, BrawlLook.BudSide("", "XX", false));
            Assert.AreNotEqual(BrawlLook.Fill(BrawlLook.Side.Ally), BrawlLook.Fill(BrawlLook.Side.Foe));
            Assert.AreEqual("12", BrawlLook.DamageText(12, false, false));
            Assert.AreEqual("31!", BrawlLook.DamageText(31, true, false));
            Assert.AreEqual("Unik", BrawlLook.DamageText(0, false, true));
            Assert.AreEqual("Blok", BrawlLook.DamageText(0, false, false));
        }

        [Test]
        public void ButtonPressesAndCallOutsGoOutAsTheServerReadsThem()
        {
            Assert.AreEqual("{\"t\":\"act\",\"a\":1,\"x\":3.5,\"y\":-2}", LiveProtocol.Act(1, new Vector2(3.5f, -2), null));
            Assert.AreEqual("{\"t\":\"act\",\"a\":0,\"x\":1,\"y\":2,\"tid\":\"m-dresiarz-0\"}", LiveProtocol.Act(0, new Vector2(1, 2), "m-dresiarz-0"));
            Assert.AreEqual("{\"t\":\"act\",\"a\":4,\"x\":0,\"y\":0}", LiveProtocol.Act(9, Vector2.zero, ""), "a slot out of range is clamped");
            StringAssert.EndsWith(",\"s\":1,\"q\":3}", LiveProtocol.Move(Vector2.one, 0, true, "", 1, 3));
            Assert.AreEqual("{\"t\":\"summon\",\"fight\":\"abc\"}", LiveProtocol.Summon("abc"));
        }

        [Test]
        public void TheFightsMessagesParse()
        {
            var fx = LiveProtocol.Parse("{\"t\":\"fx\",\"ev\":[{\"k\":\"hit\",\"u\":\"ala\",\"v\":\"m-x-0\",\"a\":\"prosty\",\"n\":7,\"c\":true,\"h\":40,\"mh\":120}," +
                                        "{\"k\":\"cast\",\"u\":\"m-x-0\",\"a\":\"kopniak\",\"x\":1,\"y\":2,\"ms\":200,\"s\":\"arc\",\"w\":80,\"n\":2.1}]}");
            Assert.AreEqual(2, fx.ev.Length);
            Assert.AreEqual("hit", fx.ev[0].k);
            Assert.IsTrue(fx.ev[0].c);
            Assert.AreEqual(40, fx.ev[0].h);
            Assert.AreEqual("arc", fx.ev[1].s);
            Assert.AreEqual(80, fx.ev[1].w);
            var ents = LiveProtocol.Parse("{\"t\":\"ents\",\"es\":[{\"id\":\"s-1\",\"kind\":\"shadow\",\"slug\":\"bartek\",\"name\":\"Bartek\",\"level\":7,\"x\":3,\"y\":4,\"h\":300,\"mh\":300,\"only\":\"ala\"}]}");
            Assert.AreEqual("shadow", ents.es[0].kind);
            Assert.AreEqual("ala", ents.es[0].only);
            var reward = LiveProtocol.Parse("{\"t\":\"reward\",\"kind\":\"mob\",\"enemy\":\"x\",\"name\":\"X\",\"reward\":{\"xpGained\":30,\"xp\":130,\"level\":2,\"levelUp\":true,\"coinsGained\":9,\"coins\":19,\"item\":null,\"drink\":null},\"influence\":null,\"pvp\":null,\"raid\":null}");
            Assert.AreEqual(2, reward.reward.level);
            Assert.IsFalse(reward.pvp != null && reward.pvp.Present, "a null object is not a result");
            var lost = LiveProtocol.Parse("{\"t\":\"lost\",\"kind\":\"street\",\"name\":\"Bartek\",\"coins\":12,\"left\":230}");
            Assert.AreEqual(12, lost.coins);
        }

        [Test]
        public void ShapesOnTheGroundAreWhole()
        {
            var mesh = new Mesh();
            FxShapes.Wedge(mesh, 2, 360, 0.1f, Color.white, Color.red);
            Assert.Greater(mesh.vertexCount, 48);
            Assert.AreEqual(0, mesh.triangles.Length % 3);
            Assert.AreEqual(2, mesh.bounds.extents.x, 0.01f, "a disc as wide as its radius");
            FxShapes.Wedge(mesh, 2, 90, 0.1f, Color.white, Color.red, 0.5f);
            Assert.Greater(mesh.bounds.max.y, 1.9f, "a wedge points up its +Y");
            FxShapes.Strip(mesh, 6, 1, 0.08f, Color.white, Color.red, true);
            Assert.AreEqual(6, mesh.bounds.max.y, 0.01f);
            Assert.AreEqual(0.75f, mesh.bounds.extents.x, 0.01f, "the arrow head is a bit wider than the strip");
            Object.DestroyImmediate(mesh);
        }

        [Test]
        public void TheButtonsLieInAnEvenArcAroundTheBasicAttackWithoutTouching()
        {
            var basic = UI.CombatPad.PositionOf(0, 1);
            for (var i = 1; i < 5; i++)
            {
                var a = UI.CombatPad.PositionOf(i, 1);
                // up and to the left of the corner button, never right of it or below it
                Assert.LessOrEqual(a.x, basic.x + 1, "slot " + i);
                Assert.GreaterOrEqual(a.y, basic.y - 20, "slot " + i);
                for (var j = 0; j < i; j++)
                {
                    var b = UI.CombatPad.PositionOf(j, 1);
                    var room = (UI.CombatPad.Layout[i].size + UI.CombatPad.Layout[j].size) / 2;
                    Assert.Greater(Vector2.Distance(a, b), room + 6, $"slots {i} and {j} touch");
                }
            }
            // the three inner buttons at the same distance: one even arc
            Assert.AreEqual(UI.CombatPad.Layout[1].distance, UI.CombatPad.Layout[3].distance, 4);
        }

        [Test]
        public void EveryKindOfBlowLooksItsOwnWay()
        {
            Assert.AreEqual(CombatFx.Blow.Fist, CombatFx.StyleOf("prosty"));
            Assert.AreEqual(CombatFx.Blow.Bat, CombatFx.StyleOf("zamach"));
            Assert.AreEqual(CombatFx.Blow.Spin, CombatFx.StyleOf("huragan"));
            Assert.AreEqual(CombatFx.Blow.Paint, CombatFx.StyleOf("chmura"));
            Assert.AreEqual(CombatFx.Blow.Shock, CombatFx.StyleOf("mega-drop"));
            Assert.AreEqual(CombatFx.Blow.Ultimate, CombatFx.StyleOf("ult-kij"));
            var tones = new HashSet<Color>();
            foreach (var b in new[] { CombatFx.Blow.Fist, CombatFx.Blow.Bat, CombatFx.Blow.Spin, CombatFx.Blow.Paint, CombatFx.Blow.Sound })
                Assert.IsTrue(tones.Add(CombatFx.ToneOf(b)), b.ToString());
        }
    }
}
