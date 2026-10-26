using System;
using System.Collections.Generic;
using UnityEngine;

// Field names mirror packages/shared/src/land.ts (the server's JSON).
// ReSharper disable InconsistentNaming
namespace Buds.Quests
{
    [Serializable]
    public sealed class LandResourcesDto
    {
        public int beton;
        public int stal;
        public int energia;
        public int zywnosc;

        public int Get(string id) => id switch
        {
            "beton" => beton,
            "stal" => stal,
            "energia" => energia,
            "zywnosc" => zywnosc,
            _ => 0,
        };

        public bool IsEmpty => beton == 0 && stal == 0 && energia == 0 && zywnosc == 0;
    }

    [Serializable]
    public sealed class LandBuildingDto
    {
        public int id;
        public string kind;
        /// <summary>Plot-local cell of the anchor (the middle of the bottom row).</summary>
        public int x;
        public int y;
        public int level;
        /// <summary>Ms since epoch (the server's clock) when it (or its last upgrade) is done.</summary>
        public double readyAt;
        public double collectedAt;
    }

    [Serializable]
    public sealed class RaidRecordDto
    {
        public double at;
        public string by;
        public string slug;
        public bool won;
        public LandResourcesDto loot;
    }

    [Serializable]
    public sealed class LandStateDto
    {
        public string plot;
        /// <summary>The name the bud gave its district.</summary>
        public string name;
        public int stage;
        public LandResourcesDto resources;
        public LandBuildingDto[] buildings;
        public int nextId;
        public double shieldUntil;
        public RaidRecordDto[] raids;
    }

    [Serializable]
    public sealed class LandPendingDto
    {
        public int id;
        public int amount;
    }

    [Serializable]
    public sealed class LandViewDto
    {
        public LandStateDto land;
        public double now;
        public int storage;
        public int power;
        public int defence;
        public int @protected;
        public LandPendingDto[] pending;
    }

    [Serializable]
    public sealed class LandResponse
    {
        public LandViewDto land;
        public int coins = -1;
        public LandResourcesDto gathered;
        /// <summary>Rent collected with this request (coins).</summary>
        public int rent;

        /// <summary>JsonUtility fills a missing object with defaults: a real district always has its plot.</summary>
        public bool HasLand => land?.land != null && !string.IsNullOrEmpty(land.land.plot);
    }

    [Serializable]
    public sealed class DistrictOwnerDto
    {
        public string slug;
        public string name;
        public int level;
    }

    /// <summary>Any district as everyone on the wasteland sees it (no stores).</summary>
    [Serializable]
    public sealed class DistrictDto
    {
        public string plot;
        public DistrictOwnerDto owner;
        public string name;
        public int stage;
        public LandBuildingDto[] buildings;
        public int power;
        public int defence;
        public double shieldUntil;
    }

    [Serializable]
    public sealed class DistrictsResponse
    {
        public string route;
        public double now;
        public DistrictDto[] districts;
    }

    [Serializable]
    sealed class BuyPlotRequest
    {
        public string plot;
        public string name;
    }

    [Serializable]
    sealed class RenameLandRequest
    {
        public string name;
    }

    [Serializable]
    sealed class BuildRequest
    {
        public string kind;
        public int x;
        public int y;
    }

    [Serializable]
    sealed class RaidRequest
    {
        public string plot;
    }

    [Serializable]
    sealed class SellResourceRequest
    {
        public string resource;
        public int amount;
    }

    /// <summary>
    /// The bud's own district as the game sees it (EditMode-testable): the server's last word plus the rules of land.ts
    /// the game needs to draw it and to say up front whether something can be built here (the server decides; this only
    /// spares a pointless request). Cells are plot-local; <see cref="ToMap"/> and <see cref="ToLocal"/> convert. Production
    /// ticks on the server's clock, kept by the offset of the last answer.
    /// </summary>
    public sealed class Land
    {
        public const string Hall = "ratusz";
        /// <summary>What an apartment block "produces": rent, straight to the wallet.</summary>
        public const string Rent = "monety";

        public readonly LandContent Rules;
        public LandStateDto State { get; private set; }
        public PlotData Plot { get; private set; }
        public int Power { get; private set; }
        public int Defence { get; private set; }
        public int Protected { get; private set; }
        double clockOffset;

        public Land(LandContent rules)
        {
            Rules = rules;
        }

        public bool Has => State != null && !string.IsNullOrEmpty(State.plot) && Plot != null;
        int Size => Rules.plotSize;
        int Centre => (Rules.plotSize - 1) / 2;

        /// <summary>The server's clock now (ms), as worked out from the last answer.</summary>
        public double Now => LocalMs + clockOffset;

        static double LocalMs => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        public void Apply(LandViewDto view, double localMs = -1)
        {
            if (view?.land == null || string.IsNullOrEmpty(view.land.plot))
            {
                State = null;
                Plot = null;
                return;
            }
            State = view.land;
            Plot = Rules.Plot(State.plot);
            blockedCache = null;
            State.buildings ??= Array.Empty<LandBuildingDto>();
            State.resources ??= new LandResourcesDto();
            State.raids ??= Array.Empty<RaidRecordDto>();
            if (State.stage < 1) State.stage = 1;
            Power = view.power;
            Defence = view.defence;
            Protected = view.@protected;
            clockOffset = view.now - (localMs >= 0 ? localMs : LocalMs);
        }

        // ---------- the plot on its map ----------

        public Vector2Int ToMap(int x, int y) => new(Plot.x + x, Plot.y + y);
        public Vector2Int ToLocal(Vector2Int map) => new(map.x - Plot.x, map.y - Plot.y);

        /// <summary>Whether a map cell is on this district's plot (fence included).</summary>
        public bool OnPlot(Vector2Int map) => Has && OnPlot(Plot, Size, map);

        public static bool OnPlot(PlotData plot, int size, Vector2Int map) =>
            map.x >= plot.x && map.y >= plot.y && map.x < plot.x + size && map.y < plot.y + size;

        // ---------- stages ----------

        /// <summary>The built-up square of a stage, plot-local (xMin/yMin inclusive, xMax/yMax exclusive).</summary>
        public RectInt StageArea(int stage) => StageArea(Rules, stage);

        public static RectInt StageArea(LandContent rules, int stage)
        {
            var side = rules.stageSides[Mathf.Clamp(stage, 1, rules.stageSides.Length) - 1];
            var c = (rules.plotSize - 1) / 2;
            var half = (side - 1) / 2;
            return new RectInt(c - half, c - half, side, side);
        }

        public bool InStage(int x, int y) => StageArea(State.stage).Contains(new Vector2Int(x, y));

        /// <summary>What the next stage asks for, or null when the district fills its plot.</summary>
        public LandStageData NextStage => Has && State.stage < Rules.stages.Length ? Rules.stages[State.stage] : null;

        /// <summary>Why the district can't grow now (a land.ts problem code), or null.</summary>
        public string GrowProblem(int budLevel, int coins)
        {
            var next = NextStage;
            if (next == null) return "max_stage";
            if (budLevel < next.level) return "level_too_low";
            if (HallLevel < next.hall) return "hall_too_low";
            if (!CanAfford(next) || (coins >= 0 && coins < next.coins)) return "poor";
            return null;
        }

        // ---------- cells ----------

        public RectInt Footprint(BuildingData kind, int x, int y) =>
            new(x - (kind.w - 1) / 2, y - kind.h + 1, kind.w, kind.h);

        bool Inside(int x, int y) => x >= 1 && y >= 1 && x < Size - 1 && y < Size - 1;

        /// <summary>The cells of the gate in the fence (plot-local).</summary>
        public static Vector2Int[] GateCells(string gate, int size)
        {
            var c = (size - 1) / 2;
            var last = size - 1;
            return gate switch
            {
                "n" => new[] { new Vector2Int(c - 1, 0), new Vector2Int(c, 0), new Vector2Int(c + 1, 0) },
                "s" => new[] { new Vector2Int(c - 1, last), new Vector2Int(c, last), new Vector2Int(c + 1, last) },
                "w" => new[] { new Vector2Int(0, c - 1), new Vector2Int(0, c), new Vector2Int(0, c + 1) },
                _ => new[] { new Vector2Int(last, c - 1), new Vector2Int(last, c), new Vector2Int(last, c + 1) },
            };
        }

        /// <summary>The cell just outside the middle of the gate (plot-local), where a passer-by stands.</summary>
        public static Vector2Int OutsideGate(string gate, int size)
        {
            var c = (size - 1) / 2;
            return gate switch
            {
                "n" => new Vector2Int(c, -1),
                "s" => new Vector2Int(c, size),
                "w" => new Vector2Int(-1, c),
                _ => new Vector2Int(size, c),
            };
        }

        bool InGateClear(int x, int y)
        {
            var c = Centre;
            var last = Size - 1;
            bool Across(int v) => v >= c - 1 && v <= c + 1;
            return Plot.gate switch
            {
                "n" => Across(x) && y >= 1 && y <= 2,
                "s" => Across(x) && y >= last - 2 && y <= last - 1,
                "w" => Across(y) && x >= 1 && x <= 2,
                _ => Across(y) && x >= last - 2 && x <= last - 1,
            };
        }

        HashSet<int> blockedCache;

        /// <summary>Cells under buildings (kept until the next answer from the server).</summary>
        HashSet<int> Blocked()
        {
            if (blockedCache != null) return blockedCache;
            var set = new HashSet<int>();
            if (Has)
                foreach (var b in State.buildings)
                {
                    var kind = Rules.Building(b.kind);
                    if (kind == null) continue;
                    var f = Footprint(kind, b.x, b.y);
                    for (var y = f.yMin; y < f.yMax; y++)
                    for (var x = f.xMin; x < f.xMax; x++)
                        set.Add(y * Size + x);
                }
            return blockedCache = set;
        }

        /// <summary>The building whose footprint covers a plot-local cell, or null.</summary>
        public LandBuildingDto BuildingAt(int x, int y)
        {
            if (!Has) return null;
            foreach (var b in State.buildings)
            {
                var kind = Rules.Building(b.kind);
                if (kind != null && Footprint(kind, b.x, b.y).Contains(new Vector2Int(x, y))) return b;
            }
            return null;
        }

        public int HallLevel
        {
            get
            {
                if (!Has) return 1;
                foreach (var b in State.buildings)
                    if (b.kind == Hall) return b.level;
                return 1;
            }
        }

        public int Count(string kind)
        {
            var n = 0;
            if (Has)
                foreach (var b in State.buildings)
                    if (b.kind == kind) n++;
            return n;
        }

        public int Limit(BuildingData kind) => kind.limit != null && kind.limit.Length > 0
            ? kind.limit[Mathf.Clamp(HallLevel - 1, 0, kind.limit.Length - 1)]
            : 0;

        public bool CanAfford(LandCost cost) =>
            Has && State.resources.beton >= cost.beton && State.resources.stal >= cost.stal &&
            State.resources.energia >= cost.energia && State.resources.zywnosc >= cost.zywnosc;

        /// <summary>
        /// Why a building can't go here (a land.ts problem code), or null; plot-local anchor. The server checks the same,
        /// and also that nothing gets walled in.
        /// </summary>
        public string PlacementProblem(string kindId, int x, int y, int budLevel)
        {
            var kind = Rules.Building(kindId);
            if (kind == null) return "unknown_building";
            if (Count(kind.id) >= Limit(kind)) return "too_many";
            var first = kind.levels[0];
            if (budLevel < first.player) return "level_too_low";
            var f = Footprint(kind, x, y);
            if (!InStage(f.xMin, f.yMin) || !InStage(f.xMax - 1, f.yMax - 1) || !Inside(x, f.yMax)) return "outside";
            var blocked = Blocked();
            for (var cy = f.yMin; cy <= f.yMax; cy++)
            for (var cx = f.xMin; cx < f.xMax; cx++)
            {
                if (cy == f.yMax && cx != x) continue; // only the cell in front of the door below
                if (InGateClear(cx, cy)) return "gate";
                if (blocked.Contains(cy * Size + cx)) return "occupied";
            }
            return CanAfford(first) ? null : "poor";
        }

        // ---------- production ----------

        /// <summary>Units (or coins of rent) an hour a producer makes now (with the wasteland's bonus).</summary>
        public int Hourly(LandBuildingDto b)
        {
            var kind = Rules.Building(b.kind);
            if (kind == null || string.IsNullOrEmpty(kind.produces) || b.level < 1 || b.level > kind.levels.Length) return 0;
            var rate = (float)kind.levels[b.level - 1].value;
            if (Plot != null && Rules.BonusOf(Plot.route) == kind.produces) rate *= Rules.bonus;
            return Mathf.RoundToInt(rate);
        }

        /// <summary>Whole units waiting in a producer at the server's time <paramref name="now"/> (land.ts pending).</summary>
        public int Pending(LandBuildingDto b, double now)
        {
            var rate = Hourly(b);
            if (rate <= 0 || now <= b.readyAt) return 0;
            var from = Math.Max(b.collectedAt, b.readyAt);
            var hours = Math.Min(Rules.producerHours, Math.Max(0, now - from) / 3_600_000d);
            return (int)Math.Floor(hours * rate);
        }

        /// <summary>How much of each resource the district holds at most now.</summary>
        public int Storage(double now)
        {
            var extra = 0;
            if (Has)
            {
                var store = Rules.Building("magazyn");
                foreach (var b in State.buildings)
                    if (b.kind == "magazyn" && store != null)
                        extra += (b.readyAt <= now ? b.level : b.level - 1) * store.levels[0].value;
            }
            return Rules.baseStorage + extra;
        }

        public bool Building(LandBuildingDto b, double now) => b.readyAt > now;

        /// <summary>The next level of a building, or null at the top.</summary>
        public LandLevelData NextLevel(LandBuildingDto b)
        {
            var kind = Rules.Building(b.kind);
            return kind != null && b.level < kind.levels.Length ? kind.levels[b.level] : null;
        }

        public bool Shielded(double now) => Has && State.shieldUntil > now;

        // ---------- how it looks ----------

        /// <summary>
        /// The prop drawn for a building: the town hall grows from a pavilion to an office block to a tower; a building
        /// site with a crane while something new goes up (an upgrade keeps the building standing).
        /// </summary>
        public static string SpriteFor(LandBuildingDto b, double now)
        {
            if (b.readyAt > now && b.level <= 1) return b.kind == Hall ? "dz-budowa-duza" : "dz-budowa";
            if (b.kind == Hall) return b.level >= 4 ? "dz-ratusz-3" : b.level >= 2 ? "dz-ratusz-2" : "dz-ratusz-1";
            return "dz-" + b.kind;
        }

        /// <summary>A district name as the server will take it (trimmed, spaces collapsed), or null when it can't be.</summary>
        public static string CleanName(string raw, int min = 3, int max = 24)
        {
            if (raw == null) return null;
            var name = System.Text.RegularExpressions.Regex.Replace(raw.Trim(), @"\s+", " ");
            if (name.Length < min || name.Length > max) return null;
            if (!char.IsLetterOrDigit(name[0])) return null;
            foreach (var c in name)
                if (!char.IsLetterOrDigit(c) && c != ' ' && c != '.' && c != '\'' && c != '-')
                    return null;
            return name;
        }

        /// <summary>Player-facing words for a land.ts problem code.</summary>
        public static string ProblemText(string code) => code switch
        {
            "unknown_building" => "Nie ma takiego budynku.",
            "too_many" => "Masz już tyle takich budynków, ile pozwala ratusz. Ulepsz ratusz.",
            "outside" => "Tu jeszcze nie da się budować. Rozbuduj dystrykt.",
            "occupied" => "To miejsce jest zajęte.",
            "gate" => "Przy bramie musi zostać wolne przejście.",
            "walls_in" => "Tak postawiony budynek zamknąłby drogę do innych.",
            "level_too_low" => "Na to potrzebujesz wyższego poziomu.",
            "hall_too_low" => "Najpierw ulepsz ratusz.",
            "max_level" => "To już najwyższy poziom.",
            "max_stage" => "Dystrykt zajmuje już całą działkę.",
            "busy" => "Trwa budowa.",
            "poor" => "Brakuje surowców.",
            "not_found" => "Nie ma tu takiego budynku.",
            _ => "Nie da się.",
        };

        /// <summary>"1:05", "12 min", "2 h 10 min": how long until <paramref name="until"/>.</summary>
        public static string Countdown(double until, double now)
        {
            var s = Math.Max(0, (int)Math.Ceiling((until - now) / 1000));
            if (s < 60) return $"0:{s:00}";
            if (s < 3600) return $"{s / 60}:{s % 60:00}";
            return $"{s / 3600} h {s % 3600 / 60} min";
        }

        /// <summary>A cost written out: "120 betonu, 60 stali".</summary>
        public static string CostText(LandCost cost, int coins = 0)
        {
            var parts = new List<string>();
            if (cost.beton > 0) parts.Add($"{cost.beton} betonu");
            if (cost.stal > 0) parts.Add($"{cost.stal} stali");
            if (cost.energia > 0) parts.Add($"{cost.energia} energii");
            if (cost.zywnosc > 0) parts.Add($"{cost.zywnosc} żywności");
            if (coins > 0) parts.Add(Core.GameBootstrap.Coins(coins));
            return parts.Count == 0 ? "za darmo" : string.Join(", ", parts);
        }

        /// <summary>Loot written out: "+120 betonu, +40 energii", or null for none.</summary>
        public static string LootText(LandResourcesDto loot)
        {
            if (loot == null || loot.IsEmpty) return null;
            var parts = new List<string>();
            if (loot.beton > 0) parts.Add($"+{loot.beton} betonu");
            if (loot.stal > 0) parts.Add($"+{loot.stal} stali");
            if (loot.energia > 0) parts.Add($"+{loot.energia} energii");
            if (loot.zywnosc > 0) parts.Add($"+{loot.zywnosc} żywności");
            return string.Join(", ", parts);
        }
    }
}
