using System;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

namespace Buds.Api
{
    public sealed class ApiException : Exception
    {
        public long Status { get; }

        public ApiException(long status, string message) : base(message)
        {
            Status = status;
        }
    }

    /// <summary>Thin client for the Buds API (apps/api). All messages are player-facing Polish.</summary>
    public sealed class BudsApi
    {
        const int TimeoutSeconds = 10;
        readonly string baseUrl;

        public BudsApi(string baseUrl)
        {
            this.baseUrl = baseUrl.TrimEnd('/');
        }

        public async Awaitable<PairResponse> Pair(string code)
        {
            using var req = new UnityWebRequest($"{baseUrl}/v1/pair", UnityWebRequest.kHttpVerbPOST)
            {
                uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(JsonUtility.ToJson(new PairRequest { code = code }))),
                downloadHandler = new DownloadHandlerBuffer(),
                timeout = TimeoutSeconds,
            };
            req.SetRequestHeader("Content-Type", "application/json");
            await req.SendWebRequest();
            return Parse<PairResponse>(req);
        }

        public async Awaitable<BudDto> GetMe(string token)
        {
            using var req = UnityWebRequest.Get($"{baseUrl}/v1/buds/me");
            req.timeout = TimeoutSeconds;
            req.SetRequestHeader("Authorization", $"Bearer {token}");
            await req.SendWebRequest();
            return Parse<BudResponse>(req).bud;
        }

        /// <summary>Ids of the quests this bud has completed (server is the source of truth).</summary>
        public async Awaitable<string[]> GetCompletedQuests(string token)
        {
            using var req = UnityWebRequest.Get($"{baseUrl}/v1/buds/me/quests");
            req.timeout = TimeoutSeconds;
            req.SetRequestHeader("Authorization", $"Bearer {token}");
            await req.SendWebRequest();
            return Parse<QuestsResponse>(req).completed ?? Array.Empty<string>();
        }

        /// <summary>Reports a finished quest; the server validates it and grants the XP once.</summary>
        public async Awaitable<CompleteQuestResponse> CompleteQuest(string token, string questId)
        {
            using var req = new UnityWebRequest($"{baseUrl}/v1/buds/me/quests/{Uri.EscapeDataString(questId)}/complete",
                UnityWebRequest.kHttpVerbPOST)
            {
                downloadHandler = new DownloadHandlerBuffer(),
                timeout = TimeoutSeconds,
            };
            req.SetRequestHeader("Authorization", $"Bearer {token}");
            await req.SendWebRequest();
            return Parse<CompleteQuestResponse>(req);
        }

        public async Awaitable<OwnedItemDto[]> GetItems(string token) =>
            (await Get<OwnedItemsResponse>("/v1/buds/me/items", token)).items ?? Array.Empty<OwnedItemDto>();

        public Awaitable<SkillsResponse> GetSkills(string token) => Get<SkillsResponse>("/v1/buds/me/skills", token);

        public Awaitable<WalletResponse> GetWallet(string token) => Get<WalletResponse>("/v1/buds/me/wallet", token);

        /// <summary>Spends one skill point; the server checks free points and the maximum rank.</summary>
        public async Awaitable<SkillsResponse> UpgradeSkill(string token, string skillId)
        {
            using var req = new UnityWebRequest($"{baseUrl}/v1/buds/me/skills/{Uri.EscapeDataString(skillId)}/upgrade",
                UnityWebRequest.kHttpVerbPOST)
            {
                downloadHandler = new DownloadHandlerBuffer(),
                timeout = TimeoutSeconds,
            };
            req.SetRequestHeader("Authorization", $"Bearer {token}");
            await req.SendWebRequest();
            return Parse<SkillsResponse>(req);
        }

        /// <summary>Ids of the caches this bud has opened.</summary>
        public async Awaitable<string[]> GetOpenedCaches(string token) =>
            (await Get<CachesResponse>("/v1/buds/me/caches", token)).opened ?? Array.Empty<string>();

        /// <summary>Reports a searched cache; the server checks it and grants its coins and XP once.</summary>
        public async Awaitable<OpenCacheResponse> OpenCache(string token, string cacheId)
        {
            using var req = new UnityWebRequest($"{baseUrl}/v1/buds/me/caches/{Uri.EscapeDataString(cacheId)}/open",
                UnityWebRequest.kHttpVerbPOST)
            {
                downloadHandler = new DownloadHandlerBuffer(),
                timeout = TimeoutSeconds,
            };
            req.SetRequestHeader("Authorization", $"Bearer {token}");
            await req.SendWebRequest();
            return Parse<OpenCacheResponse>(req);
        }

        public Awaitable<EquipmentResponse> GetEquipment(string token) =>
            Get<EquipmentResponse>("/v1/buds/me/equipment", token);

        /// <summary>Wears an owned item in its slot, or empties the slot (null). The server checks both.</summary>
        public async Awaitable<EquipmentResponse> Equip(string token, string slot, string itemId)
        {
            // item ids are [a-z0-9-], safe to inline; JsonUtility can't write a null
            var body = itemId == null ? "{\"itemId\":null}" : $"{{\"itemId\":\"{itemId}\"}}";
            using var req = new UnityWebRequest($"{baseUrl}/v1/buds/me/equipment/{Uri.EscapeDataString(slot)}", UnityWebRequest.kHttpVerbPUT)
            {
                uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(body)),
                downloadHandler = new DownloadHandlerBuffer(),
                timeout = TimeoutSeconds,
            };
            req.SetRequestHeader("Content-Type", "application/json");
            req.SetRequestHeader("Authorization", $"Bearer {token}");
            await req.SendWebRequest();
            return Parse<EquipmentResponse>(req);
        }

        /// <summary>Buys gear for coins; the server checks the price and the wallet.</summary>
        public async Awaitable<BuyResponse> Buy(string token, string itemId)
        {
            using var req = new UnityWebRequest($"{baseUrl}/v1/shop/{Uri.EscapeDataString(itemId)}/buy", UnityWebRequest.kHttpVerbPOST)
            {
                downloadHandler = new DownloadHandlerBuffer(),
                timeout = TimeoutSeconds,
            };
            req.SetRequestHeader("Authorization", $"Bearer {token}");
            await req.SendWebRequest();
            return Parse<BuyResponse>(req);
        }

        async Awaitable<T> Get<T>(string path, string token)
        {
            using var req = UnityWebRequest.Get(baseUrl + path);
            req.timeout = TimeoutSeconds;
            req.SetRequestHeader("Authorization", $"Bearer {token}");
            await req.SendWebRequest();
            return Parse<T>(req);
        }

        /// <summary>384×576 sheet (128×192 per frame): columns = walk frames 0..2, rows = down, side, up.</summary>
        public async Awaitable<Texture2D> GetSheet(string slug)
        {
            // readable, so BudSheet can build mipmaps from it
            using var req = UnityWebRequestTexture.GetTexture($"{baseUrl}/v1/buds/{Uri.EscapeDataString(slug)}/sheet.png", false);
            req.timeout = TimeoutSeconds;
            await req.SendWebRequest();
            if (req.result != UnityWebRequest.Result.Success) throw ToException(req);
            return DownloadHandlerTexture.GetContent(req);
        }

        static T Parse<T>(UnityWebRequest req)
        {
            if (req.result != UnityWebRequest.Result.Success) throw ToException(req);
            return JsonUtility.FromJson<T>(req.downloadHandler.text);
        }

        static ApiException ToException(UnityWebRequest req)
        {
            if (req.result == UnityWebRequest.Result.ConnectionError)
                return new ApiException(0, "Brak połączenia z serwerem. Sprawdź internet.");
            return new ApiException(req.responseCode, FriendlyMessage(req.responseCode, req.downloadHandler?.text));
        }

        /// <summary>Maps an HTTP status + optional API error body to a message for the player.</summary>
        public static string FriendlyMessage(long status, string body)
        {
            string apiMessage = null;
            if (!string.IsNullOrEmpty(body))
            {
                try
                {
                    apiMessage = JsonUtility.FromJson<ApiErrorBody>(body)?.error?.message;
                }
                catch (ArgumentException)
                {
                    // not JSON
                }
            }

            return status switch
            {
                400 or 403 or 404 or 409 when !string.IsNullOrEmpty(apiMessage) => apiMessage,
                401 => "Sesja wygasła. Połącz się ponownie kodem ze strony.",
                429 => "Za dużo prób. Odczekaj minutę.",
                >= 500 => "Serwer ma chwilowe problemy. Spróbuj za moment.",
                _ => "Coś poszło nie tak. Spróbuj ponownie.",
            };
        }
    }
}
