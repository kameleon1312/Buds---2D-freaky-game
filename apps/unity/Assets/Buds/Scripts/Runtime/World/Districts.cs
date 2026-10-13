namespace Buds.World
{
    public sealed class District
    {
        public string Id;
        public string Name;
        public int UnlockLevel;
        public bool Open; // false = designed, map not built yet
        public string Blurb;
    }

    /// <summary>Mirror of packages/shared/src/districts.ts — keep ids, names and levels identical.</summary>
    public static class Districts
    {
        public const string Start = "miasto-ziomkow";

        public static readonly District[] All =
        {
            new() { Id = "miasto-ziomkow", Name = "Miasto Ziomków", UnlockLevel = 1, Open = true, Blurb = "Tu zaczynasz. Codzienne życie, freestyle i graffiti pod nosem policji." },
            new() { Id = "las-palmas", Name = "Las Palmas", UnlockLevel = 4, Open = true, Blurb = "Tropiki: plaże, ocean, hawajskie chatki i egzotyczne zwierzaki." },
            new() { Id = "dwor-carski", Name = "Dwór Carski", UnlockLevel = 8, Open = true, Blurb = "Cegła, dworek i zagadki. Nieuczciwi urzędnicy w cylindrach." },
            new() { Id = "los-karkos", Name = "Los Karkos", UnlockLevel = 12, Open = true, Blurb = "Niebezpiecznie. Opuszczone bloki, zaczepki i trening przetrwania." },
        };

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

        /// <summary>What the road sign says when you can't go in yet.</summary>
        public static string ClosedReason(District d, int level) =>
            !d.Open
                ? $"{d.Blurb}\nDzielnica jest jeszcze w budowie. Wejście od poziomu {d.UnlockLevel}."
                : $"{d.Blurb}\nWejście od poziomu {d.UnlockLevel} (masz {level}).";
    }
}
