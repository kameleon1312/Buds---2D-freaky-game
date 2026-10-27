using UnityEngine;

namespace Buds.World
{
    /// <summary>
    /// What makes each district look like itself beyond its art: its water (a calm city pond, the bright turquoise of Las
    /// Palmas with its web of light and glints, the dark deep forest lake, the manor's mirror, the murky green of Los
    /// Karkos), its ground (how patchy, how muted), its birds (pigeons in the city and on the manor's cobbles, gulls on the
    /// beaches, crows in the forest and on the scrapland, swans on the manor's lake), how many leaves fall and butterflies
    /// fly, how dense the passing clouds' shadows are and whether dust rises from every surface. A wasteland takes the look
    /// of the city its road leads to, a room the look of its district, the tutorial island the look of Las Palmas.
    /// Plain data (EditMode-testable); the colour grade of each district is <see cref="WorldGrade"/>.
    /// </summary>
    public sealed class DistrictLook
    {
        public string Id;

        // the water shader (BudsWater)
        public float WebLow = 0.96f, WebHigh = 1.1f, Glint = 0.45f, Flow = 1f, Sky = 0.16f;
        public Color WaterTint = Color.white;

        // the ground shader (BudsGround)
        public float Macro = 0.17f, Desat = 0.12f;

        // life (WorldLife)
        /// <summary>The birds on the ground: "golab", "mewa", "wrona" (art zycie-*), or null for none.</summary>
        public string Bird = "golab";
        /// <summary>The grounds the birds come down on.</summary>
        public string[] BirdGround = { "plaza", "sidewalk", "grass", "grass2", "lawn", "lawn2", "cobble" };
        public bool Swans;
        public float LeafRate = 1f;
        public int Butterflies = 5;
        public float CloudShade = 0.085f;
        /// <summary>Dust rises from asphalt and concrete too (the scrapland).</summary>
        public bool DustEverywhere;

        /// <summary>The district's own things on its open ground (WorldView.Dressing): by ground kind, how often, which props.</summary>
        public (string ground, float chance, string props)[] Extra = System.Array.Empty<(string, float, string)>();

        /// <summary>The district a map belongs to: itself, the city a wasteland's road leads to, a room's district.</summary>
        public static string DistrictOf(string mapId)
        {
            mapId ??= "";
            switch (mapId)
            {
                case "pustkowie-ostepy": return "dzika-puszcza";
                case "pustkowie-wydmy": return "las-palmas";
                case "pustkowie-gosciniec": return "dwor-carski";
                case "pustkowie-nieuzytki": return "los-karkos";
                case "wyspa-startowa": return "las-palmas";
            }
            foreach (var d in new[] { "miasto-ziomkow", "las-palmas", "dzika-puszcza", "dwor-carski", "los-karkos" })
                if (mapId == d || mapId.StartsWith(d + "-"))
                    return d;
            return "miasto-ziomkow";
        }

        public static DistrictLook For(string mapId)
        {
            var id = DistrictOf(mapId);
            switch (id)
            {
                case "las-palmas":
                    return new DistrictLook
                    {
                        Id = id, WebLow = 0.95f, WebHigh = 1.13f, Glint = 0.55f, Flow = 1.1f, Macro = 0.13f, Desat = 0.04f,
                        Bird = "mewa", BirdGround = new[] { "sand", "shore", "planks" }, LeafRate = 0.5f, Butterflies = 6,
                        CloudShade = 0.07f,
                        Extra = new[] { ("sand", 0.012f, "muszle|rozgwiazda|muszle|krab"), ("grass2", 0.01f, "hibiskus|paproc") },
                    };
                case "dzika-puszcza":
                    return new DistrictLook
                    {
                        Id = id, WebLow = 0.97f, WebHigh = 1.04f, Glint = 0.18f, Flow = 0.6f, Sky = 0.22f,
                        WaterTint = new Color(0.78f, 0.88f, 0.86f), Macro = 0.22f, Desat = 0.1f,
                        Bird = "wrona", BirdGround = new[] { "grass", "grass2", "path", "dirt" }, LeafRate = 1.8f, Butterflies = 4,
                        CloudShade = 0.1f,
                        Extra = new[] { ("grass", 0.012f, "grzyby|paproc|pien|krzak-jagody|grzyby"), ("grass2", 0.014f, "grzyby|paproc|paproc") },
                    };
                case "dwor-carski":
                    return new DistrictLook
                    {
                        Id = id, WebLow = 0.985f, WebHigh = 1.035f, Glint = 0.3f, Flow = 0.45f, Sky = 0.24f,
                        WaterTint = new Color(0.92f, 0.96f, 1f), Macro = 0.12f, Desat = 0.14f,
                        Bird = "golab", BirdGround = new[] { "cobble", "gravel", "lawn", "lawn2" }, Swans = true, LeafRate = 1f,
                        Butterflies = 6, CloudShade = 0.075f,
                        Extra = new[] { ("lawn", 0.008f, "roze|flowers-c"), ("lawn2", 0.006f, "roze") },
                    };
                case "los-karkos":
                    return new DistrictLook
                    {
                        Id = id, WebLow = 0.97f, WebHigh = 1.03f, Glint = 0.05f, Flow = 0.35f, Sky = 0.1f,
                        WaterTint = new Color(0.72f, 0.8f, 0.6f), Macro = 0.24f, Desat = 0.22f,
                        Bird = "wrona", BirdGround = new[] { "dirt", "rubble", "concrete", "asphalt" }, LeafRate = 0.3f, Butterflies = 0,
                        CloudShade = 0.12f, DustEverywhere = true,
                        Extra = new[] { ("dirt", 0.012f, "gruz|smieci|gruz|opony"), ("rubble", 0.015f, "gruz|gruz|smieci") },
                    };
                default:
                    return new DistrictLook
                    {
                        Id = id, WebLow = 0.965f, WebHigh = 1.08f, Glint = 0.38f, Flow = 0.8f,
                        Extra = new[] { ("grass", 0.006f, "flowers-a|flowers-b"), ("grass2", 0.006f, "flowers-a|flowers-c") },
                    };
            }
        }
    }
}
