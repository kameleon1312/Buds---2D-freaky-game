using System.Collections.Generic;
using Buds.Core;
using Buds.UI;
using NUnit.Framework;

namespace Buds.Tests
{
    /// <summary>The player's settings and the bud's account window (docs/konto.md).</summary>
    public class AccountSettingsTests
    {
        static (GameSettings settings, Dictionary<string, int> store) Fresh()
        {
            var store = new Dictionary<string, int>();
            var settings = new GameSettings((k, d) => store.TryGetValue(k, out var v) ? v : d, (k, v) => store[k] = v);
            return (settings, store);
        }

        [Test]
        public void SettingsStartSmoothAndFullAndRemembered()
        {
            var (s, store) = Fresh();
            Assert.AreEqual(60, s.FrameRate);
            Assert.IsFalse(s.Economy);
            Assert.IsTrue(s.Vibration);
            Assert.IsTrue(s.DamageNumbers);
            var changes = 0;
            s.Changed += () => changes++;
            s.SetFrameRate(30);
            s.SetEconomy(true);
            s.SetVibration(false);
            s.SetDamageNumbers(false);
            Assert.AreEqual(4, changes);
            // a new start reads them back
            var again = new GameSettings((k, d) => store.TryGetValue(k, out var v) ? v : d, (k, v) => store[k] = v);
            Assert.AreEqual(30, again.FrameRate);
            Assert.IsTrue(again.Economy);
            Assert.IsFalse(again.Vibration);
            Assert.IsFalse(again.DamageNumbers);
        }

        [Test]
        public void OnlyThirtyOrSixtyFramesASecond()
        {
            var (s, store) = Fresh();
            s.SetFrameRate(144);
            Assert.AreEqual(60, s.FrameRate);
            store[GameSettings.Prefix + "fps"] = 12;
            Assert.AreEqual(60, new GameSettings((k, d) => store.TryGetValue(k, out var v) ? v : d, (k, v) => { }).FrameRate);
        }

        [Test]
        public void DeletingNeedsTheBudsOwnName()
        {
            Assert.IsTrue(AccountScreen.Confirms("Szymon", "Szymon"));
            Assert.IsTrue(AccountScreen.Confirms("  szymon ", "Szymon"), "case and spaces at the ends don't count");
            Assert.IsFalse(AccountScreen.Confirms("Szymo", "Szymon"));
            Assert.IsFalse(AccountScreen.Confirms("", "Szymon"));
            Assert.IsFalse(AccountScreen.Confirms("   ", ""));
        }

        [Test]
        public void TheNewAccountFormChecksWhatTheServerChecks()
        {
            Assert.IsNull(Buds.Api.AccountForm.Problem("ala@buds.pl", "dobre-haslo", "dobre-haslo"));
            StringAssert.Contains("e-mail", Buds.Api.AccountForm.Problem("", "dobre-haslo", "dobre-haslo"));
            foreach (var email in new[] { "ala", "ala@", "@buds.pl", "ala@buds", "ala@@buds.pl", "a la@buds.pl", "ala@buds." })
                Assert.AreEqual("Sprawdź adres e-mail.", Buds.Api.AccountForm.Problem(email, "dobre-haslo", "dobre-haslo"), email);
            StringAssert.Contains("co najmniej 8", Buds.Api.AccountForm.Problem("ala@buds.pl", "krotkie", "krotkie"));
            var tooLong = new string('ą', 37); // 74 bytes
            Assert.AreEqual("Hasło jest za długie.", Buds.Api.AccountForm.Problem("ala@buds.pl", tooLong, tooLong));
            Assert.AreEqual("Hasła się różnią.", Buds.Api.AccountForm.Problem("ala@buds.pl", "dobre-haslo", "dobre-hasl0"));
        }
    }
}
