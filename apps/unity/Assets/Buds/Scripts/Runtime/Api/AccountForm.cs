using System.Text;

namespace Buds.Api
{
    /// <summary>
    /// The new-account form's own checks before anything is sent: the same rules as the server's
    /// signUpRequestSchema (packages/shared account.ts), so the player hears about a typo at once.
    /// </summary>
    public static class AccountForm
    {
        public const int PasswordMin = 8;
        /// <summary>bcrypt, which Supabase Auth uses, reads at most 72 bytes.</summary>
        public const int PasswordMax = 72;

        /// <summary>What's wrong with the form, or null when it can go to the server.</summary>
        public static string Problem(string email, string password, string repeat)
        {
            if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password)) return "Wpisz e-mail i hasło.";
            if (!LooksLikeEmail(email)) return "Sprawdź adres e-mail.";
            if (password.Length < PasswordMin) return $"Hasło musi mieć co najmniej {PasswordMin} znaków.";
            if (Encoding.UTF8.GetByteCount(password) > PasswordMax) return "Hasło jest za długie.";
            if (password != repeat) return "Hasła się różnią.";
            return null;
        }

        /// <summary>One @, something before it, a dot in the domain, no spaces (the server checks it properly).</summary>
        public static bool LooksLikeEmail(string email)
        {
            if (string.IsNullOrEmpty(email) || email.Length > 254 || email.Contains(" ")) return false;
            var at = email.IndexOf('@');
            if (at <= 0 || at != email.LastIndexOf('@')) return false;
            var dot = email.LastIndexOf('.');
            return dot > at + 1 && dot < email.Length - 1;
        }
    }
}
