using System;
using System.Collections.Generic;
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
        // ---------- dystrykty (packages/shared land.ts; the server works everything out) ----------

        /// <summary>The bud's district worked out to the server's clock (none yet: <c>HasLand</c> is false).</summary>
        public Awaitable<Quests.LandResponse> GetLand(string token) => Get<Quests.LandResponse>("/v1/land", token);

        /// <summary>Every district on a wasteland as anyone passing by sees it (public).</summary>
        public Awaitable<Quests.DistrictsResponse> GetDistricts(string route) =>
            Get<Quests.DistrictsResponse>($"/v1/districts/{route}", null);

        /// <summary>Buys a free plot and founds the bud's district on it under its own name (one per bud).</summary>
        public Awaitable<Quests.LandResponse> BuyPlot(string token, string plot, string name) =>
            Post<Quests.LandResponse>("/v1/land", token, JsonUtility.ToJson(new Quests.BuyPlotRequest { plot = plot, name = name }));

        /// <summary>Gives the district a new name (the server checks it like a chat line).</summary>
        public Awaitable<Quests.LandResponse> RenameLand(string token, string name) =>
            Post<Quests.LandResponse>("/v1/land/name", token, JsonUtility.ToJson(new Quests.RenameLandRequest { name = name }));

        /// <summary>Has a crew clear a wild sector of the plot next to the district.</summary>
        public Awaitable<Quests.LandResponse> ClearSector(string token, int sector) =>
            Post<Quests.LandResponse>("/v1/land/clear", token, JsonUtility.ToJson(new Quests.ClearRequest { sector = sector }));

        /// <summary>Raids the district on a plot: a duel against its owner, fortified by the district.</summary>
        public Awaitable<FightResponse> StartRaid(string token, string plot) =>
            Post<FightResponse>("/v1/land/raids", token, JsonUtility.ToJson(new Quests.RaidRequest { plot = plot }));

        public Awaitable<Quests.LandResponse> Build(string token, string kind, int x, int y, int rot = 0) =>
            Post<Quests.LandResponse>("/v1/land/build", token, JsonUtility.ToJson(new Quests.BuildRequest { kind = kind, x = x, y = y, rot = rot }));

        public Awaitable<Quests.LandResponse> UpgradeBuilding(string token, int id) =>
            Post<Quests.LandResponse>($"/v1/land/buildings/{id}/upgrade", token, "{}");

        /// <summary>Gathers what a producer made (or every producer, id &lt; 0) into the district's storage (rent into the wallet).</summary>
        public Awaitable<Quests.LandResponse> Collect(string token, int id = -1) =>
            Post<Quests.LandResponse>("/v1/land/collect", token, id >= 0 ? $"{{\"id\":{id}}}" : "{}");

        public Awaitable<Quests.LandResponse> SellResource(string token, string resource, int amount) =>
            Post<Quests.LandResponse>("/v1/land/sell", token,
                JsonUtility.ToJson(new Quests.SellResourceRequest { resource = resource, amount = amount }));

        /// <summary>Buys a ferry ticket between two harbours; the server checks the level and takes the fare.</summary>
        public async Awaitable<FerryResponse> Ferry(string token, string from, string to)
        {
            using var req = new UnityWebRequest($"{baseUrl}/v1/buds/me/ferry", UnityWebRequest.kHttpVerbPOST)
            {
                uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(JsonUtility.ToJson(new FerryRequest { from = from, to = to }))),
                downloadHandler = new DownloadHandlerBuffer(),
                timeout = TimeoutSeconds,
            };
            req.SetRequestHeader("Content-Type", "application/json");
            req.SetRequestHeader("Authorization", $"Bearer {token}");
            await Send(req);
            return Parse<FerryResponse>(req);
        }

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

        /// <summary>What this bud has seen of every map, whichever device it walked there on.</summary>
        public async Awaitable<ExploredMapDto[]> GetExplored(string token) =>
            (await Get<ExploredResponse>("/v1/buds/me/explored", token)).maps ?? Array.Empty<ExploredMapDto>();

        /// <summary>Adds what was seen on a map; the answer is everything the server now has for it.</summary>
        public Awaitable<ExploredMapDto> SaveExplored(string token, string mapId, string seen) =>
            Send<ExploredMapDto>("PUT", $"/v1/buds/me/explored/{Uri.EscapeDataString(mapId)}", token, $"{{\"seen\":\"{seen}\"}}");

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

        /// <summary>Challenges another bud's saved fighter: the fight it starts is then fought live (summoned to the street).</summary>
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

        // ---------- the bud itself: name, devices, data, deleting it ----------

        /// <summary>A new name (once a week, the public name rules: the server checks).</summary>
        public Awaitable<BudResponse> RenameBud(string token, string name) =>
            Send<BudResponse>("PUT", "/v1/buds/me/name", token, JsonUtility.ToJson(new RenameRequest { name = name }));

        /// <summary>Every other device of the bud signed out; this one stays.</summary>
        public Awaitable<LogoutAllDto> SignOutOthers(string token) =>
            Post<LogoutAllDto>("/v1/buds/me/logout-all", token, "{}");

        /// <summary>Everything the game keeps about the bud, as the JSON the server sends (to copy out).</summary>
        public async Awaitable<string> ExportBud(string token)
        {
            using var req = UnityWebRequest.Get($"{baseUrl}/v1/buds/me/export");
            req.timeout = TimeoutSeconds;
            req.SetRequestHeader("Authorization", $"Bearer {token}");
            await Send(req);
            if (req.result != UnityWebRequest.Result.Success) throw ToException(req);
            return req.downloadHandler.text;
        }

        /// <summary>Deletes the bud for good; `confirm` is its name as the player typed it.</summary>
        public async Awaitable DeleteBud(string token, string confirm)
        {
            using var req = new UnityWebRequest($"{baseUrl}/v1/buds/me", UnityWebRequest.kHttpVerbDELETE)
            {
                uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(JsonUtility.ToJson(new DeleteBudRequest { confirm = confirm }))),
                downloadHandler = new DownloadHandlerBuffer(),
                timeout = TimeoutSeconds,
            };
            req.SetRequestHeader("Content-Type", "application/json");
            req.SetRequestHeader("Authorization", $"Bearer {token}");
            await Send(req);
            if (req.result != UnityWebRequest.Result.Success || req.responseCode >= 400) throw ToException(req);
        }

        // ---------- ciosy ----------

        /// <summary>The five fight buttons of the weapon in hand, every move that could go on them, the upgrades.</summary>
        public Awaitable<MovesResponseDto> GetMoves(string token) => Get<MovesResponseDto>("/v1/buds/me/moves", token);

        /// <summary>Saves a loadout (the server checks every move: it fits, it is open, the two abilities differ).</summary>
        public Awaitable<MovesResponseDto> SaveLoadout(string token, string weapon, string[] kit)
        {
            var parts = new string[kit.Length];
            for (var i = 0; i < kit.Length; i++) parts[i] = string.IsNullOrEmpty(kit[i]) ? "null" : $"\"{kit[i]}\"";
            return Send<MovesResponseDto>("PUT", "/v1/buds/me/moves/loadout", token,
                $"{{\"weapon\":\"{weapon}\",\"kit\":[{string.Join(",", parts)}]}}");
        }

        /// <summary>One upgrade of a move for coins; the server checks the level and the price.</summary>
        public Awaitable<MovesResponseDto> UpgradeMove(string token, string moveId) =>
            Post<MovesResponseDto>($"/v1/buds/me/moves/{Uri.EscapeDataString(moveId)}/upgrade", token, "{}");

        /// <summary>POST with a small JSON body (ids are [a-z0-9-], safe to inline).</summary>
        Awaitable<T> Post<T>(string path, string token, string json) => Send<T>(UnityWebRequest.kHttpVerbPOST, path, token, json);

        /// <summary>A request with a small JSON body.</summary>
        async Awaitable<T> Send<T>(string method, string path, string token, string json)
        {
            using var req = new UnityWebRequest(baseUrl + path, method)
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

        /// <summary>
        /// A new account on the game's server, ready at once (no confirmation e-mail); sign in right after with the
        /// same e-mail and password. Opening the account means accepting the privacy policy (said on the form).
        /// </summary>
        public async Awaitable SignUp(string email, string password)
        {
            var body = JsonUtility.ToJson(new SignUpRequest { email = email, password = password, consent = true });
            using var req = new UnityWebRequest($"{baseUrl}/v1/auth/signup", UnityWebRequest.kHttpVerbPOST)
            {
                uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(body)),
                downloadHandler = new DownloadHandlerBuffer(),
                timeout = TimeoutSeconds,
            };
            req.SetRequestHeader("Content-Type", "application/json");
            await Send(req);
            if (req.result != UnityWebRequest.Result.Success) throw ToException(req);
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
            // public reads go without a token
            if (!string.IsNullOrEmpty(token)) req.SetRequestHeader("Authorization", $"Bearer {token}");
            await Send(req);
            return Parse<T>(req);
        }

        /// <summary>384×576 sheet (128×192 per frame): columns = walk frames 0..2, rows = down, side, up.</summary>
        /// <param name="scale">Pixels per sheet unit (0 = the server's default 8); other players' buds use a lighter one.</param>
        public async Awaitable<Texture2D> GetSheet(string slug, bool fresh = false, int scale = 0)
        {
            // readable, so BudSheet can build mipmaps from it
            // right after a look change: skip any cache between here and the server
            var query = new List<string>();
            if (scale > 0) query.Add($"scale={scale}");
            if (fresh) query.Add($"v={DateTime.UtcNow.Ticks}");
            var tail = query.Count > 0 ? "?" + string.Join("&", query) : "";
            using var req = UnityWebRequestTexture.GetTexture($"{baseUrl}/v1/buds/{Uri.EscapeDataString(slug)}/sheet.png{tail}", false);
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
