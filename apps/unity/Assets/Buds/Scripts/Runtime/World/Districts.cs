using System.Collections.Generic;
namespace Buds.World
{
    public sealed class District
    {
        public string Id;
        public string Name;
        public int UnlockLevel;
        public bool Open; // false = designed, map not built yet
        public string Blurb;
        /// <summary>The quest that brings the pass or letter needed here on top of the level (districts.ts gateQuest).</summary>
        public string GateQuest;
    }

    /// <summary>Mirror of packages/shared/src/districts.ts — keep ids, names and levels identical.</summary>
    public static class Districts
    {
        public const string Start = "miasto-ziomkow";

        public static readonly District[] All =
        {
            new() { Id = "miasto-ziomkow", Name = "Miasto Ziomków", UnlockLevel = 1, Open = true, Blurb = "Tu zaczynasz. Codzienne życie, freestyle i graffiti pod nosem policji." },
            new() { Id = "dzika-puszcza", Name = "Dzika Puszcza", UnlockLevel = 2, Open = true, Blurb = "Las bez końca na zachód od miasta: rzeka, jezioro, obozowisko i rozbójnicy w ruinach." },
            new() { Id = "las-palmas", Name = "Las Palmas", UnlockLevel = 3, Open = true, GateQuest = "przepustka-na-wydmy", Blurb = "Tropiki: plaże, ocean, hawajskie chatki i egzotyczne zwierzaki." },
            new() { Id = "dwor-carski", Name = "Dwór Carski", UnlockLevel = 5, Open = true, GateQuest = "zaproszenie-na-dwor", Blurb = "Cegła, dworek i zagadki. Nieuczciwi urzędnicy w cylindrach." },
            new() { Id = "los-karkos", Name = "Los Karkos", UnlockLevel = 7, Open = true, GateQuest = "tajemnica-dworu", Blurb = "Niebezpiecznie. Opuszczone bloki, zaczepki i trening przetrwania." },
            new() { Id = "chinatown", Name = "Chinatown", UnlockLevel = 9, Open = true, GateQuest = "list-do-chinatown", Blurb = "Za Dworem Carskim: lampiony, nocny targ, pagoda i dojo. Tu pamięta się każdą przysługę." },
        };

        /// <summary>
        /// The tutorial island (packages/shared TUTORIAL_ISLAND): new buds start here; handing in the final quest opens
        /// the pier to Miasto Ziomków. Not a district: no level gate, no road back.
        /// </summary>
        public const string Tutorial = "wyspa-startowa";
        public const string TutorialName = "Wyspa Startowa";
        public const string TutorialFinalQuest = "wyspa-rejs";

        /// <summary>
        /// The wastelands between the cities (packages/shared travel.ts ROUTES): A is the west or north end, B the east or
        /// south end. Not districts: no turfs, no level of their own; the road onto one needs the far city's level.
        /// </summary>
        public static readonly (string Id, string Name, string A, string B)[] Routes =
        {
            ("pustkowie-ostepy", "Leśne Ostępy", "dzika-puszcza", "miasto-ziomkow"),
            ("pustkowie-wydmy", "Wydmy", "las-palmas", "miasto-ziomkow"),
            ("pustkowie-gosciniec", "Stary Gościniec", "miasto-ziomkow", "dwor-carski"),
            ("pustkowie-nieuzytki", "Nieużytki", "miasto-ziomkow", "los-karkos"),
            ("pustkowie-ryzowe", "Ryżowy Trakt", "dwor-carski", "chinatown"),
        };

        public static bool IsRoute(string id) => System.Array.Exists(Routes, r => r.Id == id);

        /// <summary>The city at the other end of a route, seen from <paramref name="from"/> (null if it's not an end).</summary>
        public static string FarEnd(string routeId, string from)
        {
            foreach (var r in Routes)
                if (r.Id == routeId)
                    return r.A == from ? r.B : r.B == from ? r.A : null;
            return null;
        }

        /// <summary>Stepping onto a route needs the level of the city it leads to (going home is always free).</summary>
        public static bool CanEnterRoute(string routeId, string from, int level)
        {
            var far = FarEnd(routeId, from);
            return far != null && CanEnter(far, level);
        }

        /// <summary>A map's name for labels: a district, a route, the island, or the id.</summary>
        public static string NameOf(string id)
        {
            if (id == Tutorial) return TutorialName;
            foreach (var r in Routes)
                if (r.Id == id) return r.Name;
            return Get(id)?.Name ?? id;
        }

        public static District Get(string id)
        {
            foreach (var d in All)
                if (d.Id == id) return d;
            return null;
        }

        public static bool CanEnter(string id, int level)
        {
            var d = Get(id);
            return d != null && d.Open && level >= d.UnlockLevel;
        }

        /// <summary>Who gives the pass to a city, in words, and whether the bud has it (no gate: it has).</summary>
        public static bool HasPass(District d, ICollection<string> completed) =>
            d == null || string.IsNullOrEmpty(d.GateQuest) || completed.Contains(d.GateQuest);

        /// <summary>What the road says when the level is enough but the pass is missing.</summary>
        public static string NoPassReason(District d, string questTitle, string giverName) =>
            $"{d.Blurb}\nStraż nie przepuści cię bez przepustki. Zadanie „{questTitle}” u: {giverName}.";

        /// <summary>What the road sign says when you can't go in yet.</summary>
        public static string ClosedReason(District d, int level) =>
            !d.Open
                ? $"{d.Blurb}\nDzielnica jest jeszcze w budowie. Wejście od poziomu {d.UnlockLevel}."
                : $"{d.Blurb}\nWejście od poziomu {d.UnlockLevel} (masz {level}).";
    }
}
