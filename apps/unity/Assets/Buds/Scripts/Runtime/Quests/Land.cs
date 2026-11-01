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
        /// <summary>Plot-local cell of the anchor (the middle of the row its door is on).</summary>
        public int x;
        public int y;
        /// <summary>Quarter turns clockwise seen from above: the door looks south, west, north, east.</summary>
        public int rot;
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

    /// <summary>The sector a crew is clearing and when it is done (readyAt 0: none; JsonUtility fills a missing one so).</summary>
    [Serializable]
    public sealed class LandClearingDto
    {
        public int sector;
        public double readyAt;
    }

    [Serializable]
    public sealed class LandStateDto
    {
        public string plot;
        /// <summary>The name the bud gave its district.</summary>
        public string name;
        /// <summary>Cleared sectors (index sy·sectors + sx).</summary>
        public int[] sectors;
        public LandClearingDto clearing;
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
        public string rank;
        public int rentBoost;
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
        public int[] sectors;
        public LandClearingDto clearing;
        public LandBuildingDto[] buildings;
        public int power;
        public int defence;
        public string rank;
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
    sealed class ClearRequest
    {
        public int sector;
    }

    [Serializable]
    sealed class BuildRequest
    {
        public string kind;
        public int x;
        public int y;
        public int rot;
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
    /// the game needs to draw it and to say up front whether something can be built or cleared here (the server decides;
    /// this only spares a pointless request). Cells are plot-local; <see cref="ToMap"/> and <see cref="ToLocal"/> convert.
    /// Production and clearing tick on the server's clock, kept by the offset of the last answer.
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
        public string Rank { get; private set; }
        public int RentBoost { get; private set; }
        double clockOffset;

        public Land(LandContent rules)
        {
            Rules = rules;
        }

        public bool Has => State != null && !string.IsNullOrEmpty(State.plot) && Plot != null;
        int Size => Rules.plotSize;
        int Centre => (Rules.plotSize - 1) / 2;
        int SectorSize => Mathf.Max(1, Rules.sector);
        int SectorsPerSide => Mathf.Max(1, Rules.sectors);

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
            State.sectors ??= Array.Empty<int>();
            State.clearing ??= new LandClearingDto();
            Power = view.power;
            Defence = view.defence;
            Protected = view.@protected;
            Rank = string.IsNullOrEmpty(view.rank) ? Rules.RankName(view.power) : view.rank;
            RentBoost = view.rentBoost;
            clockOffset = view.now - (localMs >= 0 ? localMs : LocalMs);
        }

        // ---------- the plot on its map ----------

        public Vector2Int ToMap(int x, int y) => new(Plot.x + x, Plot.y + y);
        public Vector2Int ToLocal(Vector2Int map) => new(map.x - Plot.x, map.y - Plot.y);

        /// <summary>Whether a map cell is on this district's plot (fence included).</summary>
        public bool OnPlot(Vector2Int map) => Has && OnPlot(Plot, Size, map);

        public static bool OnPlot(PlotData plot, int size, Vector2Int map) =>
            map.x >= plot.x && map.y >= plot.y && map.x < plot.x + size && map.y < plot.y + size;

        // ---------- sectors ----------

        public static int SectorOf(int x, int y, int sector, int sectors) => y / sector * sectors + x / sector;

        /// <summary>The sectors a new district starts with: the gate's, its two neighbours along the road, the one behind it (land.ts startSectors).</summary>
        public static int[] StartSectors(string gate, int sectors)
        {
            var m = (sectors - 1) / 2;
            var last = sectors - 1;
            int I(int sx, int sy) => sy * sectors + sx;
            return gate switch
            {
                "n" => new[] { I(m - 1, 0), I(m, 0), I(m + 1, 0), I(m, 1) },
                "s" => new[] { I(m - 1, last), I(m, last), I(m + 1, last), I(m, last - 1) },
                "w" => new[] { I(0, m - 1), I(0, m), I(0, m + 1), I(1, m) },
                _ => new[] { I(last, m - 1), I(last, m), I(last, m + 1), I(last - 1, m) },
            };
        }

        /// <summary>The town hall's anchor (plot-local): the middle of the sector behind the gate's (land.ts hallSpot).</summary>
        public static Vector2Int HallSpot(string gate, int sector, int sectors)
        {
            var behind = StartSectors(gate, sectors)[3];
            return new Vector2Int(behind % sectors * sector + 2, behind / sectors * sector + 3);
        }

        /// <summary>Whether a sector is cleared at the server's time <paramref name="now"/> (a finished crew counts: land.ts settle).</summary>
        public static bool SectorCleared(int[] sectors, LandClearingDto clearing, int sector, double now) =>
            Array.IndexOf(sectors ?? Array.Empty<int>(), sector) >= 0 ||
            (clearing != null && clearing.readyAt > 0 && clearing.readyAt <= now && clearing.sector == sector);

        /// <summary>The sector a crew is working on now, or -1.</summary>
        public static int SectorInWork(LandClearingDto clearing, double now) =>
            clearing != null && clearing.readyAt > now ? clearing.sector : -1;

        public bool Cleared(int sector) => Has && SectorCleared(State.sectors, State.clearing, sector, Now);
        public int InWork => Has ? SectorInWork(State.clearing, Now) : -1;

        /// <summary>How many sectors the district holds now (a finished crew's included).</summary>
        public int ClearedCount
        {
            get
            {
                if (!Has) return 0;
                var n = State.sectors.Length;
                var c = State.clearing;
                if (c != null && c.readyAt > 0 && c.readyAt <= Now && Array.IndexOf(State.sectors, c.sector) < 0) n++;
                return n;
            }
        }

        /// <summary>Whether a plot-local cell lies in a cleared sector.</summary>
        public bool Claimed(int x, int y) =>
            x >= 0 && y >= 0 && x < Size && y < Size && Cleared(SectorOf(x, y, SectorSize, SectorsPerSide));

        public int SectorLimit => Rules.sectorLimit == null || Rules.sectorLimit.Length == 0
            ? SectorsPerSide * SectorsPerSide
            : Rules.sectorLimit[Mathf.Clamp(HallLevel - 1, 0, Rules.sectorLimit.Length - 1)];

        /// <summary>What clearing the next sector asks for, or null when the whole plot is the district's.</summary>
        public LandClearData NextClearing
        {
            get
            {
                var k = ClearedCount - 4;
                return Has && Rules.clearings != null && k >= 0 && k < Rules.clearings.Length ? Rules.clearings[k] : null;
            }
        }

        /// <summary>Whether a sector touches one the district holds.</summary>
        public bool NextToCleared(int sector)
        {
            var n = SectorsPerSide;
            int sx = sector % n, sy = sector / n;
            return (sx > 0 && Cleared(sector - 1)) || (sx < n - 1 && Cleared(sector + 1)) ||
                   (sy > 0 && Cleared(sector - n)) || (sy < n - 1 && Cleared(sector + n));
        }

        /// <summary>Why that sector can't be cleared now (a land.ts problem code), or null; <paramref name="coins"/> −1 = unknown.</summary>
        public string ClearProblem(int sector, int budLevel, int coins)
        {
            var n = SectorsPerSide;
            if (!Has || sector < 0 || sector >= n * n) return "outside";
            if (Cleared(sector)) return "cleared";
            if (InWork >= 0) return "clearing";
            var next = NextClearing;
            if (next == null) return "max_sectors";
            if (ClearedCount >= SectorLimit) return "hall_too_low";
            if (!NextToCleared(sector)) return "not_next";
            if (budLevel < next.level) return "level_too_low";
            if (!CanAfford(next) || (coins >= 0 && coins < next.coins)) return "poor";
            return null;
        }

        /// <summary>The wild sector next to the district a point on the plot (plot-local cell) is in or beside, or -1.</summary>
        public int WildSectorAt(Vector2Int local)
        {
            if (!Has || local.x < 0 || local.y < 0 || local.x >= Size || local.y >= Size) return -1;
            var s = SectorOf(local.x, local.y, SectorSize, SectorsPerSide);
            return Cleared(s) ? -1 : s;
        }

        // ---------- cells ----------

        /// <summary>The cells a building covers: it turns round its anchor (land.ts footprint).</summary>
        public static RectInt Footprint(BuildingData kind, int x, int y, int rot = 0)
        {
            var side = (kind.w - 1) / 2;
            return rot switch
            {
                1 => new RectInt(x, y - side, kind.h, kind.w),
                2 => new RectInt(x - side, y, kind.w, kind.h),
                3 => new RectInt(x - kind.h + 1, y - side, kind.h, kind.w),
                _ => new RectInt(x - side, y - kind.h + 1, kind.w, kind.h),
            };
        }

        /// <summary>The cell in front of a building's door (land.ts doorCell).</summary>
        public static Vector2Int DoorCell(int x, int y, int rot = 0) => rot switch
        {
            1 => new Vector2Int(x - 1, y),
            2 => new Vector2Int(x, y - 1),
            3 => new Vector2Int(x + 1, y),
            _ => new Vector2Int(x, y + 1),
        };

        /// <summary>The anchor that keeps a building's middle where it is when it turns to <paramref name="rot"/>.</summary>
        public static Vector2Int AnchorForCentre(BuildingData kind, Vector2Int centre, int rot)
        {
            // CentreOf rounds towards the far edge: from the near edge it is depth / 2, from the far one what is left
            var near = kind.h / 2;
            var far = kind.h - 1 - near;
            return rot switch
            {
                1 => new Vector2Int(centre.x - near, centre.y),
                2 => new Vector2Int(centre.x, centre.y - near),
                3 => new Vector2Int(centre.x + far, centre.y),
                _ => new Vector2Int(centre.x, centre.y + far),
            };
        }

        /// <summary>The cell in the middle of a footprint (a plan's handle on the building).</summary>
        public static Vector2Int CentreOf(RectInt f) => new(f.xMin + f.width / 2, f.yMin + f.height / 2);

        bool Inside(int x, int y) => x >= 1 && y >= 1 && x < Size - 1 && y < Size - 1;

        /// <summary>The first cell inside the gate (land.ts gateCells).</summary>
        static Vector2Int GateInside(string gate, int size)
        {
            var c = (size - 1) / 2;
            return gate switch
            {
                "n" => new Vector2Int(c, 1),
                "w" => new Vector2Int(1, c),
                "e" => new Vector2Int(size - 2, c),
                _ => new Vector2Int(c, size - 2),
            };
        }

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

        public bool InGateClear(int x, int y)
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
                    var f = Footprint(kind, b.x, b.y, b.rot);
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
                if (kind != null && Footprint(kind, b.x, b.y, b.rot).Contains(new Vector2Int(x, y))) return b;
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
        /// and also that nothing gets walled in (<see cref="WallsIn"/>).
        /// </summary>
        public string PlacementProblem(string kindId, int x, int y, int budLevel, int rot = 0)
        {
            var kind = Rules.Building(kindId);
            if (kind == null) return "unknown_building";
            if (Count(kind.id) >= Limit(kind)) return "too_many";
            var first = kind.levels[0];
            if (budLevel < first.player) return "level_too_low";
            // the whole building and the cell in front of its door
            var f = Footprint(kind, x, y, rot);
            var door = DoorCell(x, y, rot);
            if (!Inside(door.x, door.y) || !Claimed(door.x, door.y)) return "outside";
            for (var cy = f.yMin; cy < f.yMax; cy++)
            for (var cx = f.xMin; cx < f.xMax; cx++)
                if (!Inside(cx, cy) || !Claimed(cx, cy)) return "outside";
            var blocked = Blocked();
            if (InGateClear(door.x, door.y)) return "gate";
            if (blocked.Contains(door.y * Size + door.x)) return "occupied";
            for (var cy = f.yMin; cy < f.yMax; cy++)
            for (var cx = f.xMin; cx < f.xMax; cx++)
            {
                if (InGateClear(cx, cy)) return "gate";
                if (blocked.Contains(cy * Size + cx)) return "occupied";
            }
            return CanAfford(first) ? null : "poor";
        }

        /// <summary>
        /// Whether a new building here would shut off the way from the gate to its own door or another's (land.ts
        /// allReachable): the plan says so before the server has to.
        /// </summary>
        public bool WallsIn(BuildingData kind, int x, int y, int rot)
        {
            var blocked = new HashSet<int>(Blocked());
            var f = Footprint(kind, x, y, rot);
            for (var cy = f.yMin; cy < f.yMax; cy++)
            for (var cx = f.xMin; cx < f.xMax; cx++)
                blocked.Add(cy * Size + cx);
            bool Walkable(int cx, int cy)
            {
                var inGate = Array.Exists(GateCells(Plot.gate, Size), g => g.x == cx && g.y == cy);
                if (!inGate && !(Inside(cx, cy) && Claimed(cx, cy))) return false;
                return !blocked.Contains(cy * Size + cx);
            }
            var start = GateInside(Plot.gate, Size);
            if (!Walkable(start.x, start.y)) return true;
            var seen = new HashSet<int> { start.y * Size + start.x };
            var open = new Stack<Vector2Int>();
            open.Push(start);
            while (open.Count > 0)
            {
                var c = open.Pop();
                foreach (var d in new[] { Vector2Int.up, Vector2Int.down, Vector2Int.left, Vector2Int.right })
                {
                    var n = c + d;
                    if (!Walkable(n.x, n.y) || !seen.Add(n.y * Size + n.x)) continue;
                    open.Push(n);
                }
            }
            bool Open(Vector2Int door) => seen.Contains(door.y * Size + door.x);
            if (!Open(DoorCell(x, y, rot))) return true;
            foreach (var b in State.buildings)
                if (!Open(DoorCell(b.x, b.y, b.rot))) return true;
            return false;
        }

        /// <summary>Everything the plan needs to know about a spot: a problem code, "walls_in", or null when it fits.</summary>
        public string PlanProblem(string kindId, int x, int y, int budLevel, int rot)
        {
            var problem = PlacementProblem(kindId, x, y, budLevel, rot);
            if (problem != null) return problem;
            return WallsIn(Rules.Building(kindId), x, y, rot) ? "walls_in" : null;
        }

        /// <summary>
        /// The spot nearest to a wish that fits exactly, with the wished turn if it can be had, else any other: "Dopasuj".
        /// Null when nothing fits anywhere on the land held (or the only trouble is cost or limits).
        /// </summary>
        public (Vector2Int anchor, int rot)? NearestFit(string kindId, Vector2Int centre, int budLevel, int rot)
        {
            var kind = Rules.Building(kindId);
            if (kind == null) return null;
            (Vector2Int, int)? best = null;
            var bestScore = float.MaxValue;
            for (var r = 0; r < 4; r++)
            for (var y = 0; y < Size; y++)
            for (var x = 0; x < Size; x++)
            {
                // "poor" says the place itself is right: the plan still shows it, the server won't pay for it
                var problem = PlanProblem(kindId, x, y, budLevel, r);
                if (problem != null && problem != "poor") continue;
                var c = CentreOf(Footprint(kind, x, y, r));
                var score = (c - centre).sqrMagnitude + (r == rot ? 0 : 0.5f);
                if (score >= bestScore) continue;
                bestScore = score;
                best = (new Vector2Int(x, y), r);
            }
            return best;
        }

        // ---------- production ----------

        /// <summary>Units (or coins of rent) an hour a producer makes now (with the wasteland's bonus).</summary>
        public int Hourly(LandBuildingDto b)
        {
            var kind = Rules.Building(b.kind);
            if (kind == null || string.IsNullOrEmpty(kind.produces) || b.level < 1 || b.level > kind.levels.Length) return 0;
            var rate = (float)kind.levels[b.level - 1].value;
            if (kind.produces == Rent) return Mathf.RoundToInt(rate * (100 + RentBoostOf(State.buildings)) / 100f);
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

        /// <summary>Per cent more rent from the squares, fountains, statue and tower among these buildings (land.ts rentBoost).</summary>
        public int RentBoostOf(LandBuildingDto[] buildings)
        {
            var boost = 0;
            foreach (var b in buildings ?? Array.Empty<LandBuildingDto>()) boost += Rules.Building(b.kind)?.rentBoost ?? 0;
            return Mathf.Min(Rules.maxRentBoost > 0 ? Rules.maxRentBoost : 50, boost);
        }

        /// <summary>The style of the districts on the bud's wasteland.</summary>
        public string Style => Has ? Rules.StyleOf(Plot.route) : "las";

        // ---------- how it looks ----------

        /// <summary>
        /// The prop drawn for a building in a style (las, tropik, dwor, zlom): the town hall grows from a pavilion to an
        /// office block to a tower; a building site with a crane while something new goes up (an upgrade keeps the
        /// building standing; the 5×4 tower gets the big site).
        /// </summary>
        public static string SpriteFor(LandBuildingDto b, double now, string style, BuildingData kind = null)
        {
            if (b.readyAt > now && b.level <= 1) return kind != null && kind.w >= 5 ? "dz-budowa-duza" : "dz-budowa";
            if (b.kind == Hall) return $"dz-{style}-ratusz-" + (b.level >= 4 ? 3 : b.level >= 2 ? 2 : 1);
            return $"dz-{style}-{b.kind}";
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
            "outside" => "Tu jeszcze nie da się budować: najpierw oczyść ten teren.",
            "occupied" => "To miejsce jest zajęte.",
            "gate" => "Przy bramie musi zostać wolne przejście.",
            "walls_in" => "Tak postawiony budynek zamknąłby drogę do drzwi. Obróć go albo przesuń.",
            "level_too_low" => "Na to potrzebujesz wyższego poziomu.",
            "hall_too_low" => "Najpierw ulepsz ratusz.",
            "max_level" => "To już najwyższy poziom.",
            "max_sectors" => "Dystrykt zajmuje już całą działkę.",
            "not_next" => "Oczyszczać można tylko teren przy tym, co już masz.",
            "cleared" => "Ten teren jest już oczyszczony.",
            "clearing" => "Ekipa jeszcze pracuje. Jeden teren naraz.",
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
