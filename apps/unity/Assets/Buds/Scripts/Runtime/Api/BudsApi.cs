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
                400 or 404 when !string.IsNullOrEmpty(apiMessage) => apiMessage,
                401 => "Sesja wygasła. Połącz się ponownie kodem ze strony.",
                429 => "Za dużo prób. Odczekaj minutę.",
                >= 500 => "Serwer ma chwilowe problemy. Spróbuj za moment.",
                _ => "Coś poszło nie tak. Spróbuj ponownie.",
            };
        }
    }
}
