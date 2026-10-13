using UnityEngine;

namespace Buds.Core
{
    /// <summary>
    /// The guest credential obtained by pairing with the website. PlayerPrefs is fine for a guest token:
    /// it only grants access to this one bud, and real accounts will replace it.
    /// </summary>
    public sealed class PlayerSession
    {
        const string TokenKey = "buds.token";
        const string SlugKey = "buds.slug";
        const string ApiKey = "buds.api";

        public const string DefaultApiBaseUrl = "http://localhost:4000";

        public string Token { get; }
        public string Slug { get; }

        public PlayerSession(string token, string slug)
        {
            Token = token;
            Slug = slug;
        }

        public static PlayerSession Load()
        {
            var token = PlayerPrefs.GetString(TokenKey, "");
            var slug = PlayerPrefs.GetString(SlugKey, "");
            return token.Length > 0 && slug.Length > 0 ? new PlayerSession(token, slug) : null;
        }

        public void Save()
        {
            PlayerPrefs.SetString(TokenKey, Token);
            PlayerPrefs.SetString(SlugKey, Slug);
            PlayerPrefs.Save();
        }

        public static void Clear()
        {
            PlayerPrefs.DeleteKey(TokenKey);
            PlayerPrefs.DeleteKey(SlugKey);
            PlayerPrefs.Save();
        }

        /// <summary>Command line wins (automated runs), then the saved dev override, then the default.</summary>
        public static string ApiBaseUrl
        {
            get => CommandLine.Get("-buds-api") ?? PlayerPrefs.GetString(ApiKey, DefaultApiBaseUrl);
            set
            {
                PlayerPrefs.SetString(ApiKey, value.Trim().TrimEnd('/'));
                PlayerPrefs.Save();
            }
        }
    }
}
