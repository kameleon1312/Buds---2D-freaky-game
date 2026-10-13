using Buds.Api;
using Buds.Characters;
using Buds.Core;
using NUnit.Framework;
using UnityEngine;

namespace Buds.Tests
{
    public class BudSheetTests
    {
        [Test]
        public void DetectsScale()
        {
            Assert.AreEqual(1, BudSheet.ScaleOf(48, 72));
            Assert.AreEqual(4, BudSheet.ScaleOf(192, 288));
            Assert.Throws<System.ArgumentException>(() => BudSheet.ScaleOf(50, 72));
            Assert.Throws<System.ArgumentException>(() => BudSheet.ScaleOf(96, 72));
        }

        [Test]
        public void RowsAreReadTopDown()
        {
            // texture origin is bottom-left: "down" (first row in the PNG) is the highest rect
            Assert.AreEqual(new Rect(0, 48, 16, 24), BudSheet.FrameRect(Facing.Down, 0, 1, 72));
            Assert.AreEqual(new Rect(16, 24, 16, 24), BudSheet.FrameRect(Facing.Side, 1, 1, 72));
            Assert.AreEqual(new Rect(64, 0, 32, 48), BudSheet.FrameRect(Facing.Up, 2, 2, 144));
        }

        [Test]
        public void SlicesTheBundledGuestSheet()
        {
            var tex = Resources.Load<Texture2D>("Sheets/guest");
            Assert.IsNotNull(tex, "Resources/Sheets/guest.png missing — run tools/export-guest-sheet.ts");
            var sheet = new BudSheet(tex);
            Assert.AreEqual(8, sheet.Scale);
            // 128 px per world unit: a frame is one tile wide, 1.5 tiles tall
            Assert.AreEqual(128f, sheet.Get(Facing.Down, 0).pixelsPerUnit);
            Assert.AreEqual(new Vector2(1f, 1.5f), (Vector2)sheet.Get(Facing.Down, 0).bounds.size);
            Assert.Greater(tex.mipmapCount, 1);
        }
    }

    public class FollowCameraTests
    {
        [TestCase(1280, 720, 6f)] // landscape: height limits (12 tiles tall, ~21 wide)
        [TestCase(1920, 1080, 6f)]
        [TestCase(1080, 2400, 16.6667f)] // portrait phone: 15 tiles across
        [TestCase(1000, 1000, 7.5f)]
        public void ShowsAtLeastTheTargetTiles(int w, int h, float expected)
        {
            var size = FollowCamera.OrthoSizeFor(w, h);
            Assert.AreEqual(expected, size, 1e-3);
            Assert.GreaterOrEqual(size * 2, FollowCamera.TargetTilesY - 1e-4);
            Assert.GreaterOrEqual(size * 2 * w / h, FollowCamera.TargetTilesX - 1e-3);
        }
    }

    public class ProgressionTests
    {
        [TestCase(0, 1, 100)]
        [TestCase(99, 1, 100)]
        [TestCase(100, 2, 400)]
        [TestCase(400, 3, 900)]
        [TestCase(8100, 10, 10000)]
        public void MatchesTheWebCurve(int xp, int level, int next)
        {
            Assert.AreEqual(level, Progression.Level(xp));
            Assert.AreEqual(next, Progression.NextLevelXp(xp));
        }

        [TestCase(0, 0f)]
        [TestCase(50, 0.5f)]
        [TestCase(250, 0.5f)]
        [TestCase(399, 299 / 300f)]
        public void ProgressWithinLevel(int xp, float progress)
        {
            Assert.AreEqual(progress, Progression.Progress(xp), 1e-5f);
        }
    }

    public class ApiTests
    {
        [Test]
        public void ParsesPairResponse()
        {
            const string json =
                "{\"bud\":{\"slug\":\"zuzia-ab2c\",\"name\":\"Zuzia\",\"look\":{\"gender\":\"ona\",\"mood\":\"zadziorny\"," +
                "\"skin\":3,\"hair\":\"kucyk\",\"hairColor\":4,\"outfit\":\"kurtka\",\"outfitColor\":2,\"pantsColor\":1}," +
                "\"xp\":120,\"createdAt\":\"2026-10-12T16:00:00.000Z\"},\"token\":\"abc\"}";
            var res = JsonUtility.FromJson<PairResponse>(json);
            Assert.AreEqual("zuzia-ab2c", res.bud.slug);
            Assert.AreEqual("Zuzia", res.bud.name);
            Assert.AreEqual("kucyk", res.bud.look.hair);
            Assert.AreEqual(120, res.bud.xp);
            Assert.AreEqual("abc", res.token);
        }

        [Test]
        public void FriendlyMessagesArePolishAndUseApiTextWhenUseful()
        {
            Assert.AreEqual("Kod nieważny lub wygasł",
                BudsApi.FriendlyMessage(404, "{\"error\":{\"code\":\"http_404\",\"message\":\"Kod nieważny lub wygasł\"}}"));
            Assert.AreEqual("Za dużo prób. Odczekaj minutę.", BudsApi.FriendlyMessage(429, null));
            StringAssert.StartsWith("Serwer", BudsApi.FriendlyMessage(503, "<html>"));
            StringAssert.StartsWith("Sesja", BudsApi.FriendlyMessage(401, null));
        }
    }
}
