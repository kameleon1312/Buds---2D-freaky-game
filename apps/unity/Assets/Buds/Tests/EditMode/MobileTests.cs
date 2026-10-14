using Buds.Characters;
using Buds.Core;
using Buds.UI;
using NUnit.Framework;

namespace Buds.Tests
{
    /// <summary>Phone layout: the fixed joystick, the bigger UI on small screens and the closer camera.</summary>
    public class MobileTests
    {
        [Test]
        public void FixedStickWalksSlowlyNearTheCentreAndNeverRuns()
        {
            var (slow, slowRun) = PlayerInput.FixedStickPush(10, 100);
            var (walk, walkRun) = PlayerInput.FixedStickPush(80, 100);
            var (rim, rimRun) = PlayerInput.FixedStickPush(100, 100);
            Assert.AreEqual(0.4f, slow, 1e-3);
            Assert.AreEqual(1f, walk, 1e-3);
            Assert.AreEqual(1f, rim, 1e-3);
            Assert.IsFalse(slowRun || walkRun || rimRun);
        }

        [Test]
        public void TheCameraSitsFarEnoughToShowTheTiles()
        {
            // a 32° view 4.25 tiles tall (half) at the focus needs ~14.8 tiles of distance
            Assert.AreEqual(14.82f, FollowCamera.DistanceFor(4.25f, 32f), 0.01f);
            Assert.Greater(FollowCamera.DistanceFor(6f, 32f), FollowCamera.DistanceFor(4.25f, 32f));
        }

        [TestCase(1080, 420, true, 540)] // 6" phone in landscape: about 2.6" tall
        [TestCase(1600, 320, true, 720)] // tablet
        [TestCase(1440, 400, true, 620)]
        [TestCase(1080, 96, false, 720)] // desktop
        public void SmallScreensGetABiggerUi(int heightPx, float dpi, bool mobile, float expected) =>
            Assert.AreEqual(expected, UiKit.CanvasHeight(heightPx, dpi, mobile));

        [Test]
        public void PhonesShowFewerTiles()
        {
            var phone = FollowCamera.OrthoSizeFor(2400, 1080, true);
            Assert.AreEqual(FollowCamera.CompactTilesY / 2, phone, 1e-3);
            Assert.Less(phone, FollowCamera.OrthoSizeFor(2400, 1080));
            Assert.GreaterOrEqual(phone * 2 * 2400 / 1080, FollowCamera.CompactTilesX);
        }
    }
}
