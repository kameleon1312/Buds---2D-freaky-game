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
        // the free Render plan sleeps after 15 min idle and takes up to a minute to wake: wait that long rather than
        // telling the player there is no connection (no network at all still fails right away)
        /// <summary>
        /// How long a request may take: long until the server has answered once this session (a sleeping server on
        /// Render takes up to a minute to wake), then short, so a lost connection never keeps a screen waiting long.
        /// </summary>
        static int TimeoutSeconds => awake ? 30 : 75;

        static bool awake;
        readonly string baseUrl;

        /// <summary>Requests on their way right now, across every client (the corner spinner shows while any is).</summary>
        public static int InFlight { get; private set; }

        static async Awaitable Send(UnityWebRequest req)
        {
            InFlight++;
            try
            {
                await req.SendWebRequest();
                if (req.responseCode > 0) awake = true;
            }
            finally
            {
                InFlight--;
            }
        }

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
            await Send(req);
            return Parse<PairResponse>(req);
        }

        public async Awaitable<BudDto> GetMe(string token)
        {
            using var req = UnityWebRequest.Get($"{baseUrl}/v1/buds/me");
            req.timeout = TimeoutSeconds;
            req.SetRequestHeader("Authorization", $"Bearer {token}");
            await Send(req);
            return Parse<BudResponse>(req).bud;
        }

        /// <summary>Saves a new look for the bud (the server checks it like a new bud's and that it owns what it wears).</summary>
        public async Awaitable<BudDto> UpdateLook(string token, BudLookDto look)
        {
            using var req = new UnityWebRequest($"{baseUrl}/v1/buds/me/look", UnityWebRequest.kHttpVerbPUT)
            {
                uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(JsonUtility.ToJson(new UpdateLookRequest { look = look }))),
                downloadHandler = new DownloadHandlerBuffer(),
                timeout = TimeoutSeconds,
            };
            req.SetRequestHeader("Content-Type", "application/json");
            req.SetRequestHeader("Authorization", $"Bearer {token}");
            await Send(req);
            return Parse<BudResponse>(req).bud;
        }

        /// <summary>Signs this device out on the server: its player token stops working (other devices stay signed in).</summary>
        public async Awaitable Logout(string token)
        {
            using var req = new UnityWebRequest($"{baseUrl}/v1/buds/me/logout", UnityWebRequest.kHttpVerbPOST)
            {
                downloadHandler = new DownloadHandlerBuffer(),
                timeout = 10, // signing out never waits for a sleeping server: the device forgets the token anyway
            };
            req.SetRequestHeader("Authorization", $"Bearer {token}");
            await Send(req);
            if (req.result != UnityWebRequest.Result.Success && req.responseCode != 401) throw ToException(req);
        }

        /// <summary>Ids of the quests this bud has completed (server is the source of truth).</summary>
        public async Awaitable<string[]> GetCompletedQuests(string token)
        {
            using var req = UnityWebRequest.Get($"{baseUrl}/v1/buds/me/quests");
            req.timeout = TimeoutSeconds;
            req.SetRequestHeader("Authorization", $"Bearer {token}");
            await Send(req);
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
            await Send(req);
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
            await Send(req);
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
            await Send(req);
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
            await Send(req);
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
            await Send(req);
            return Parse<BuyResponse>(req);
        }

        /// <summary>Starts a duel at one of the opponent's spots (the turf it counts for); the server builds both fighters.</summary>
        public Awaitable<FightResponse> StartFight(string token, string enemyId, int spot = 0) =>
            Post<FightResponse>("/v1/fights", token, $"{{\"enemyId\":\"{enemyId}\",\"spot\":{Math.Clamp(spot, 0, 5)}}}");

        // ---------- rywalizacja ----------

        /// <summary>Who rules each turf of a district this week, and this bud's standing there.</summary>
        public Awaitable<TurfsResponse> GetTurfs(string token, string district) =>
            Get<TurfsResponse>($"/v1/rivalry/district/{Uri.EscapeDataString(district)}", token);

        public Awaitable<RivalryMeResponse> GetRivalryMe(string token) => Get<RivalryMeResponse>("/v1/rivalry/me", token);

        public Awaitable<RankingResponse> GetRanking(string token) => Get<RankingResponse>("/v1/rivalry/ranking", token);

        /// <summary>The ruler's daily tribute; the server checks who rules and that it wasn't collected today.</summary>
        public Awaitable<TributeResponse> CollectTribute(string token, string turf) =>
            Post<TributeResponse>($"/v1/rivalry/turfs/{Uri.EscapeDataString(turf)}/tribute", token, "{}");

        public Awaitable<CrewResponse> GetMyCrew(string token) => Get<CrewResponse>("/v1/buds/me/crew", token);

        public Awaitable<CrewListResponse> GetCrews(string token) => Get<CrewListResponse>("/v1/crews", token);

        public Awaitable<CrewResponse> CreateCrew(string token, string name, string tag) =>
            Post<CrewResponse>("/v1/crews", token, JsonUtility.ToJson(new CreateCrewRequest { name = name, tag = tag }));

        public Awaitable<CrewResponse> JoinCrew(string token, string tag) =>
            Post<CrewResponse>($"/v1/crews/{Uri.EscapeDataString(tag)}/join", token, "{}");

        public Awaitable<CrewResponse> LeaveCrew(string token) => Post<CrewResponse>("/v1/crews/leave", token, "{}");

        public Awaitable<PvpOpponentsResponse> GetPvpOpponents(string token) =>
            Get<PvpOpponentsResponse>("/v1/pvp/opponents", token);

        /// <summary>Challenges another bud's saved fighter; the duel then runs through FightMove like any other.</summary>
        public Awaitable<FightResponse> StartPvp(string token, string opponentSlug) =>
            Post<FightResponse>("/v1/pvp/fights", token, $"{{\"opponent\":\"{opponentSlug}\"}}");

        public Awaitable<MarketResponse> GetMarket(string token) => Get<MarketResponse>("/v1/market", token);

        public Awaitable<MarketResponse> Sell(string token, string itemId, int price) =>
            Post<MarketResponse>("/v1/market", token, JsonUtility.ToJson(new SellRequest { itemId = itemId, price = price }));

        public Awaitable<MarketResponse> BuyListing(string token, string listingId) =>
            Post<MarketResponse>($"/v1/market/{Uri.EscapeDataString(listingId)}/buy", token, "{}");

        public async Awaitable<MarketResponse> CancelListing(string token, string listingId)
        {
            using var req = new UnityWebRequest($"{baseUrl}/v1/market/{Uri.EscapeDataString(listingId)}", UnityWebRequest.kHttpVerbDELETE)
            {
                downloadHandler = new DownloadHandlerBuffer(),
                timeout = TimeoutSeconds,
            };
            req.SetRequestHeader("Authorization", $"Bearer {token}");
            await Send(req);
            return Parse<MarketResponse>(req);
        }

        /// <summary>Plays one turn; the server answers with what happened (and the reward on a win).</summary>
        public Awaitable<FightResponse> FightMove(string token, string fightId, string move) =>
            Post<FightResponse>($"/v1/fights/{Uri.EscapeDataString(fightId)}/move", token, $"{{\"move\":\"{move}\"}}");

        public Awaitable<FightResponse> Flee(string token, string fightId) =>
            Post<FightResponse>($"/v1/fights/{Uri.EscapeDataString(fightId)}/flee", token, "{}");

        /// <summary>Buys a premium item for gems; the server checks the price and the gem balance.</summary>
        public Awaitable<BuyResponse> BuyPremium(string token, string itemId) =>
            Post<BuyResponse>($"/v1/premium/{Uri.EscapeDataString(itemId)}/buy", token, "{}");

        /// <summary>A short-lived code that links this bud to an account on the website (or pairs another device).</summary>
        public Awaitable<PairCodeDto> CreatePairCode(string token) =>
            Post<PairCodeDto>("/v1/buds/me/pair-code", token, "{}");

        /// <summary>A training round: the server grants training XP for the mini-game score (0..5) once per cooldown.</summary>
        public Awaitable<TrainResponse> Train(string token, string spotId, int score) =>
            Post<TrainResponse>($"/v1/buds/me/training/{Uri.EscapeDataString(spotId)}", token, $"{{\"score\":{score}}}");

        public Awaitable<ConsumablesResponse> GetConsumables(string token) =>
            Get<ConsumablesResponse>("/v1/buds/me/consumables", token);

        /// <summary>Drinks one energy drink; the server starts its boost.</summary>
        public Awaitable<ConsumablesResponse> UseConsumable(string token, string itemId) =>
            Post<ConsumablesResponse>($"/v1/buds/me/consumables/{Uri.EscapeDataString(itemId)}/use", token, "{}");

        /// <summary>POST with a small JSON body (ids are [a-z0-9-], safe to inline).</summary>
        async Awaitable<T> Post<T>(string path, string token, string json)
        {
            using var req = new UnityWebRequest(baseUrl + path, UnityWebRequest.kHttpVerbPOST)
            {
                uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(json)),
                downloadHandler = new DownloadHandlerBuffer(),
                timeout = TimeoutSeconds,
            };
            req.SetRequestHeader("Content-Type", "application/json");
            req.SetRequestHeader("Authorization", $"Bearer {token}");
            await Send(req);
            return Parse<T>(req);
        }

        // ---------- the in-game creator ----------

        public async Awaitable<LookOptionsDto> GetLookOptions()
        {
            using var req = UnityWebRequest.Get($"{baseUrl}/v1/look/options");
            req.timeout = TimeoutSeconds;
            await Send(req);
            return Parse<LookOptionsDto>(req);
        }

        /// <summary>A sheet for a look that isn't a bud yet: the server renders it with the same generator.</summary>
        public async Awaitable<Texture2D> PreviewSheet(BudLookDto look, int scale = 6)
        {
            var encoded = Convert.ToBase64String(Encoding.UTF8.GetBytes(JsonUtility.ToJson(look)))
                .TrimEnd('=').Replace('+', '-').Replace('/', '_');
            using var req = UnityWebRequestTexture.GetTexture($"{baseUrl}/v1/look/sheet.png?look={encoded}&scale={scale}", false);
            req.timeout = TimeoutSeconds;
            await Send(req);
            if (req.result != UnityWebRequest.Result.Success) throw ToException(req);
            return DownloadHandlerTexture.GetContent(req);
        }

        // ---------- accounts (the website's e-mail + password) ----------

        public async Awaitable<AuthConfigDto> GetAuthConfig()
        {
            using var req = UnityWebRequest.Get($"{baseUrl}/v1/auth/config");
            req.timeout = TimeoutSeconds;
            await Send(req);
            return Parse<AuthConfigDto>(req);
        }

        /// <summary>
        /// Signs in with Supabase Auth directly (the password never goes to the Buds API); returns the account session.
        /// </summary>
        public static async Awaitable<SupabaseSessionDto> SignIn(AuthConfigDto config, string email, string password)
        {
            var body = JsonUtility.ToJson(new SignInRequest { email = email, password = password });
            using var req = new UnityWebRequest($"{config.url.TrimEnd('/')}/auth/v1/token?grant_type=password", UnityWebRequest.kHttpVerbPOST)
            {
                uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(body)),
                downloadHandler = new DownloadHandlerBuffer(),
                timeout = TimeoutSeconds,
            };
            req.SetRequestHeader("Content-Type", "application/json");
            req.SetRequestHeader("apikey", config.publishableKey);
            await Send(req);
            if (req.result == UnityWebRequest.Result.Success)
                return JsonUtility.FromJson<SupabaseSessionDto>(req.downloadHandler.text);
            if (req.result == UnityWebRequest.Result.ConnectionError)
                throw new ApiException(0, "Brak połączenia z internetem.");
            throw new ApiException(req.responseCode, SignInMessage(req.responseCode, req.downloadHandler?.text));
        }

        /// <summary>Supabase Auth errors in Polish (same wording as the website).</summary>
        public static string SignInMessage(long status, string body)
        {
            SupabaseErrorDto e = null;
            try
            {
                if (!string.IsNullOrEmpty(body)) e = JsonUtility.FromJson<SupabaseErrorDto>(body);
            }
            catch (ArgumentException)
            {
                // not JSON
            }
            var code = (e?.error_code ?? e?.error ?? "").ToLowerInvariant();
            var text = $"{e?.msg} {e?.error_description}".ToLowerInvariant();
            if (code.Contains("email_not_confirmed") || text.Contains("not confirmed"))
                return "Najpierw potwierdź e-mail: kliknij link z wiadomości od nas.";
            if (code.Contains("invalid_credentials") || code.Contains("invalid_grant") || text.Contains("invalid login"))
                return "Zły e-mail albo hasło.";
            if (status == 429 || text.Contains("rate limit")) return "Za dużo prób. Odczekaj chwilę.";
            if (code.Contains("validation") || text.Contains("email")) return "Sprawdź adres e-mail i hasło.";
            return status >= 500 ? "Logowanie ma chwilowe problemy. Spróbuj za moment." : "Nie udało się zalogować. Spróbuj ponownie.";
        }

        /// <summary>The signed-in account's buds.</summary>
        public Awaitable<AccountBudsDto> GetAccountBuds(string accessToken) => Get<AccountBudsDto>("/v1/account/buds", accessToken);

        /// <summary>A player token for one of the account's buds, for this device.</summary>
        public Awaitable<CreateBudResponse> DeviceToken(string accessToken, string slug) =>
            Post<CreateBudResponse>($"/v1/account/buds/{Uri.EscapeDataString(slug)}/device", accessToken, "{}");

        /// <summary>
        /// Creates a bud from the game (no website needed); returns it with its player token. With an account token it
        /// goes straight onto that account.
        /// </summary>
        public async Awaitable<CreateBudResponse> CreateBud(string name, BudLookDto look, string accountToken = null)
        {
            var body = JsonUtility.ToJson(new CreateBudRequest { name = name, look = look });
            using var req = new UnityWebRequest($"{baseUrl}/v1/buds", UnityWebRequest.kHttpVerbPOST)
            {
                uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(body)),
                downloadHandler = new DownloadHandlerBuffer(),
                timeout = TimeoutSeconds,
            };
            req.SetRequestHeader("Content-Type", "application/json");
            if (!string.IsNullOrEmpty(accountToken)) req.SetRequestHeader("Authorization", $"Bearer {accountToken}");
            await Send(req);
            return Parse<CreateBudResponse>(req);
        }

        async Awaitable<T> Get<T>(string path, string token)
        {
            using var req = UnityWebRequest.Get(baseUrl + path);
            req.timeout = TimeoutSeconds;
            req.SetRequestHeader("Authorization", $"Bearer {token}");
            await Send(req);
            return Parse<T>(req);
        }

        /// <summary>384×576 sheet (128×192 per frame): columns = walk frames 0..2, rows = down, side, up.</summary>
        public async Awaitable<Texture2D> GetSheet(string slug, bool fresh = false)
        {
            // readable, so BudSheet can build mipmaps from it
            // right after a look change: skip any cache between here and the server
            var bust = fresh ? $"?v={DateTime.UtcNow.Ticks}" : "";
            using var req = UnityWebRequestTexture.GetTexture($"{baseUrl}/v1/buds/{Uri.EscapeDataString(slug)}/sheet.png{bust}", false);
            req.timeout = TimeoutSeconds;
            await Send(req);
            if (req.result != UnityWebRequest.Result.Success) throw ToException(req);
            return DownloadHandlerTexture.GetContent(req);
        }

        static T Parse<T>(UnityWebRequest req)
        {
            if (req.result != UnityWebRequest.Result.Success) throw ToException(req);
            try
            {
                return JsonUtility.FromJson<T>(req.downloadHandler.text);
            }
            catch (ArgumentException)
            {
                // a proxy page or a cut-off answer: an error the screens already know how to show
                throw new ApiException(req.responseCode, "Serwer odpowiedział niezrozumiale. Spróbuj jeszcze raz.");
            }
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
