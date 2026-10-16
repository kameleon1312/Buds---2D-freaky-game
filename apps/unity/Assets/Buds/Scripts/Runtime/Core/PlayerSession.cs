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

        /// <summary>The production API (Render). Local runs pass -buds-api, phone dev builds bake in the PC address.</summary>
        public const string DefaultApiBaseUrl = "https://buds-api-9vhw.onrender.com";

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

        static string DevApi()
        {
            if (!Debug.isDebugBuild) return null;
            var file = Resources.Load<TextAsset>("Dev/api");
            return file && file.text.Trim().StartsWith("http") ? file.text.Trim() : null;
        }

        public static void Clear()
        {
            PlayerPrefs.DeleteKey(TokenKey);
            PlayerPrefs.DeleteKey(SlugKey);
            PlayerPrefs.Save();
        }

        /// <summary>
        /// Command line wins (automated runs), then the address typed on the pairing screen, then (dev builds) the PC
        /// address baked in by BudsBuild.AndroidDev, then the default.
        /// </summary>
        public static string ApiBaseUrl
        {
            get
            {
                var saved = PlayerPrefs.GetString(ApiKey, "");
                return CommandLine.Get("-buds-api") ?? (saved.Length > 0 ? saved : null) ?? DevApi() ?? DefaultApiBaseUrl;
            }
            set
            {
                PlayerPrefs.SetString(ApiKey, value.Trim().TrimEnd('/'));
                PlayerPrefs.Save();
            }
        }
    }
}
