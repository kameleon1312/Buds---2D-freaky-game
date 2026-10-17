using System;
using System.Collections.Generic;
using System.Globalization;
using Buds.Api;

namespace Buds.Quests
{
    /// <summary>
    /// Rywalizacja in the game (docs/rywalizacja.md): the words and small rules the Rewiry screen and the HUD use.
    /// The server decides everything; this only explains it to the player (Polish, gender-neutral).
    /// </summary>
    public static class Rivalry
    {
        /// <summary>RIVALRY_MIN_LEVEL in packages/shared rivalry.ts: crews, PvP and the market open after the island.</summary>
        public const int MinLevel = 2;
        /// <summary>MARKET_* in packages/shared rivalry.ts.</summary>
        public const int MarketMinPrice = 5;
        public const int MarketMaxPrice = 5000;

        /// <summary>Polish plural: 1 dzień, 2–4 dni, 5+ dni (12–14 take the "many" form).</summary>
        public static string Plural(int n, string one, string few, string many)
        {
            if (n == 1) return one;
            var tens = n % 100;
            var units = n % 10;
            return units is >= 2 and <= 4 && (tens < 12 || tens > 14) ? few : many;
        }

        /// <summary>"2 dni 4 godz." until <paramref name="endsAt"/> (ISO, UTC); "chwila" when nearly over.</summary>
        public static string TimeLeft(string endsAt, DateTime nowUtc)
        {
            if (!DateTime.TryParse(endsAt, CultureInfo.InvariantCulture,
                    DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var end))
                return "";
            var left = end - nowUtc;
            if (left.TotalMinutes < 1) return "chwila";
            if (left.TotalDays >= 1)
                return $"{left.Days} {Plural(left.Days, "dzień", "dni", "dni")} {left.Hours} godz.";
            return left.TotalHours >= 1 ? $"{left.Hours} godz. {left.Minutes} min" : $"{left.Minutes} min";
        }

        /// <summary>"2026-W42" → "tydzień 42".</summary>
        public static string WeekName(string week)
        {
            var i = week?.IndexOf("-W", StringComparison.Ordinal) ?? -1;
            return i < 0 ? week ?? "" : "tydzień " + week.Substring(i + 2).TrimStart('0');
        }

        /// <summary>Kept titles in short: "2× władca rewiru · 1× podium tygodnia".</summary>
        public static string Titles(TitleDto[] titles)
        {
            if (titles == null || titles.Length == 0) return "";
            int turfs = 0, podium = 0, first = 0;
            foreach (var t in titles)
            {
                if (t.title.StartsWith("turf:", StringComparison.Ordinal)) turfs++;
                else if (t.title == "top:1") first++;
                else if (t.title.StartsWith("top:", StringComparison.Ordinal)) podium++;
            }
            var parts = new List<string>();
            if (first > 0) parts.Add($"{first}× numer jeden tygodnia");
            if (podium > 0) parts.Add($"{podium}× podium tygodnia");
            if (turfs > 0) parts.Add($"{turfs}× władza nad rewirem");
            return string.Join(" · ", parts);
        }

        /// <summary>
        /// Whether an owned item may go on the Bazar (the server checks again): earned gear and rides with a coin value,
        /// never premium items, drinks, starter clothes or quest rewards.
        /// </summary>
        public static bool Tradeable(ItemData item, ISet<string> questRewards) =>
            item != null && !item.premium && !item.IsDrink && item.gems == 0 && item.coins > 0 &&
            (questRewards == null || !questRewards.Contains(item.id));

        /// <summary>What the seller gets: the price minus the market's 10% (at least one coin), like marketPayout.</summary>
        public static int Payout(int price) => price - Math.Max(1, (int)Math.Round(price * 0.1, MidpointRounding.AwayFromZero));

        /// <summary>A short line about influence just earned (null when there is nothing to say).</summary>
        public static string InfluenceLine(InfluenceDto influence)
        {
            if (influence == null || !influence.Present) return null;
            if (influence.captured) return $"Rewir {influence.name} jest teraz twój!";
            return influence.gained > 0
                ? $"+{influence.gained} wpływu · {influence.name} ({influence.total})"
                : $"Dzienny limit wpływu w: {influence.name}";
        }

        /// <summary>Who rules a turf, for the zone banner.</summary>
        public static string RulerLine(TurfStateDto turf, string mySlug)
        {
            if (turf == null) return null;
            if (!turf.HasOwner) return $"{turf.name} · rewir wolny";
            if (turf.owner.slug == mySlug) return $"{turf.name} · twój rewir";
            var tag = string.IsNullOrEmpty(turf.owner.crewTag) ? "" : $" [{turf.owner.crewTag}]";
            return $"{turf.name} · rządzi {turf.owner.name}{tag}";
        }
    }
}
