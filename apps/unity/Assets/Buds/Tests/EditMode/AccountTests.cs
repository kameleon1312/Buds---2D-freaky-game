using Buds.Api;
using NUnit.Framework;

namespace Buds.Tests
{
    /// <summary>Signing in from the game: Supabase Auth errors become the same Polish messages as on the website.</summary>
    public class AccountTests
    {
        [Test]
        public void SignInErrorsArePolish()
        {
            Assert.AreEqual("Zły e-mail albo hasło.",
                BudsApi.SignInMessage(400, "{\"code\":400,\"error_code\":\"invalid_credentials\",\"msg\":\"Invalid login credentials\"}"));
            Assert.AreEqual("Najpierw potwierdź e-mail: kliknij link z wiadomości od nas.",
                BudsApi.SignInMessage(400, "{\"error_code\":\"email_not_confirmed\",\"msg\":\"Email not confirmed\"}"));
            Assert.AreEqual("Za dużo prób. Odczekaj chwilę.", BudsApi.SignInMessage(429, ""));
            StringAssert.Contains("chwilowe", BudsApi.SignInMessage(503, "not json"));
        }
    }
}
