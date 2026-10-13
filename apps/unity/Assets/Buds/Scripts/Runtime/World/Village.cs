using System.Collections.Generic;

namespace Buds.World
{
    /// <summary>Road leaving the map towards another district (inclusive cell rectangle, map coords).</summary>
    public sealed class Exit
    {
        public int X0;
        public int Y0;
        public int X1;
        public int Y1;
        public string DistrictId;

        public bool Contains(int x, int y) => x >= X0 && x <= X1 && y >= Y0 && y <= Y1;
    }

    public sealed class Sign
    {
        public int X;
        public int Y;
        public string Title;
        public string Text;
    }

    /// <summary>
    /// Tile layers in map coordinates: x right, y DOWN (row 0 is the northern edge).
    /// WorldView flips to Unity's y-up when placing tiles.
    /// </summary>
    public sealed class WorldMap
    {
        public int Width;
        public int Height;
        public int[,] Ground; // [y, x], always filled
        public int[,] Objects; // Tiles.Empty or a tile; solid ones collide
        public int[,] Above; // drawn over the player (tree canopies)
        public int SpawnX;
        public int SpawnY;
        public List<Sign> Signs = new();
        public List<Exit> Exits = new();

        public bool IsWalkable(int x, int y) =>
            x >= 0 && y >= 0 && x < Width && y < Height &&
            !Tiles.IsSolid(Ground[y, x]) && !Tiles.IsSolid(Objects[y, x]);
    }

    /// <summary>
    /// Starting map of Miasto Ziomków (a small placeholder until the full district from docs/districts.md is built).
    /// Roads leave north to Las Palmos, south to Dwór Carski and east to Los Karkos. Deterministic: everyone gets
    /// the same map.
    /// </summary>
    public static class Village
    {
        const int W = 48;
        const int H = 36;

        public static WorldMap Build()
        {
            var map = new WorldMap
            {
                Width = W,
                Height = H,
                Ground = Fill(Tiles.Grass),
                Objects = Fill(Tiles.Empty),
                Above = Fill(Tiles.Empty),
                SpawnX = 24,
                SpawnY = 19,
            };
            var reserved = new bool[H, W];
            var random = new Rng(20261012);

            // forest border, two trees deep
            for (var y = 0; y < H; y++)
            for (var x = 0; x < W; x++)
                if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) Tree(map, x, y);

            // roads; gaps in the forest lead to future zones
            Path(map, reserved, 2, 17, W - 3, 18);
            Path(map, reserved, 23, 2, 24, H - 3);
            foreach (var y in new[] { 0, 1, H - 2, H - 1 })
            foreach (var x in new[] { 23, 24 })
            {
                map.Objects[y, x] = Tiles.Empty;
                map.Ground[y, x] = Tiles.Path;
            }
            foreach (var y in new[] { 17, 18 })
            foreach (var x in new[] { W - 2, W - 1 })
            {
                map.Objects[y, x] = Tiles.Empty;
                map.Ground[y, x] = Tiles.Path;
            }
            map.Exits.Add(new Exit { X0 = 23, Y0 = 0, X1 = 24, Y1 = 0, DistrictId = "las-palmos" });
            map.Exits.Add(new Exit { X0 = 23, Y0 = H - 1, X1 = 24, Y1 = H - 1, DistrictId = "dwor-carski" });
            map.Exits.Add(new Exit { X0 = W - 1, Y0 = 17, X1 = W - 1, Y1 = 18, DistrictId = "los-karkos" });

            // plaza with the notice board
            Path(map, reserved, 19, 14, 28, 21);
            map.Objects[15, 21] = Tiles.Sign;
            Reserve(reserved, 18, 13, 29, 22);
            map.Signs.Add(new Sign
            {
                X = 21,
                Y = 15,
                Title = "Miasto Ziomków",
                Text = "Witaj w Mieście Ziomków! Drogi prowadzą do Las Palmos (północ), Dworu Carskiego (południe) i Los Karkos (wschód). Mieszkańcy niedługo będą mieli dla ciebie zadania.",
            });

            // cottages, each with a path down to the road
            House(map, reserved, 6, 8);
            Path(map, reserved, 8, 13, 8, 16);
            House(map, reserved, 13, 8);
            Path(map, reserved, 15, 13, 15, 16);
            House(map, reserved, 31, 8);
            Path(map, reserved, 33, 13, 33, 16);
            House(map, reserved, 38, 9);
            Path(map, reserved, 40, 14, 40, 16);
            House(map, reserved, 8, 22);
            Path(map, reserved, 10, 19, 10, 21);

            // pond with a sandy shore
            const float cx = 36.5f, cy = 27.5f, rx = 5.2f, ry = 3.4f;
            for (var y = 0; y < H; y++)
            for (var x = 0; x < W; x++)
            {
                var dx = (x + 0.5f - cx) / rx;
                var dy = (y + 0.5f - cy) / ry;
                var d = dx * dx + dy * dy;
                if (d <= 1f) map.Ground[y, x] = Tiles.Water;
                else if (d <= 1.45f) map.Ground[y, x] = Tiles.Shore;
            }
            Reserve(reserved, 30, 23, 43, 32);

            // fenced flower garden with a gate in the north side
            const int gx0 = 14, gy0 = 24, gx1 = 20, gy1 = 29;
            for (var y = gy0; y <= gy1; y++)
            for (var x = gx0; x <= gx1; x++)
            {
                var edge = x == gx0 || x == gx1 || y == gy0 || y == gy1;
                if (edge && !(y == gy0 && x == 17)) map.Objects[y, x] = Tiles.Fence;
                else if (!edge) map.Ground[y, x] = Tiles.Flowers;
            }
            Path(map, reserved, 17, 19, 17, 23);
            Reserve(reserved, gx0 - 1, gy0 - 1, gx1 + 1, gy1 + 1);

            // scatter: groves, bushes, rocks, flowers, grass variation
            for (var y = 2; y < H - 2; y++)
            for (var x = 2; x < W - 2; x++)
            {
                if (map.Ground[y, x] == Tiles.Grass && random.Next() < 0.22) map.Ground[y, x] = Tiles.Grass2;
                if (reserved[y, x] || map.Objects[y, x] != Tiles.Empty || map.Ground[y, x] != Tiles.Grass) continue;
                var r = random.Next();
                if (r < 0.045 && !reserved[y + 1, x] && map.Objects[y - 1, x] == Tiles.Empty) Tree(map, x, y);
                else if (r < 0.065) map.Objects[y, x] = Tiles.Bush;
                else if (r < 0.075) map.Objects[y, x] = Tiles.Rock;
                else if (r < 0.12) map.Ground[y, x] = Tiles.Flowers;
            }

            // canopies only exist directly above a trunk, and never hide a solid non-tree object
            for (var y = 0; y < H; y++)
            for (var x = 0; x < W; x++)
            {
                if (map.Above[y, x] == Tiles.Empty) continue;
                var trunkBelow = y + 1 < H && map.Objects[y + 1, x] == Tiles.TreeTrunk;
                var o = map.Objects[y, x];
                if (!trunkBelow || (Tiles.IsSolid(o) && o != Tiles.TreeTrunk)) map.Above[y, x] = Tiles.Empty;
            }

            return map;
        }

        static int[,] Fill(int value)
        {
            var grid = new int[H, W];
            for (var y = 0; y < H; y++)
            for (var x = 0; x < W; x++)
                grid[y, x] = value;
            return grid;
        }

        static bool InBounds(int x, int y) => x >= 0 && y >= 0 && x < W && y < H;

        static void Reserve(bool[,] reserved, int x0, int y0, int x1, int y1)
        {
            for (var y = y0; y <= y1; y++)
            for (var x = x0; x <= x1; x++)
                if (InBounds(x, y)) reserved[y, x] = true;
        }

        static void Path(WorldMap map, bool[,] reserved, int x0, int y0, int x1, int y1)
        {
            for (var y = System.Math.Min(y0, y1); y <= System.Math.Max(y0, y1); y++)
            for (var x = System.Math.Min(x0, x1); x <= System.Math.Max(x0, x1); x++)
                if (InBounds(x, y)) map.Ground[y, x] = Tiles.Path;
            Reserve(reserved, x0 - 1, y0 - 1, x1 + 1, y1 + 1);
        }

        static void Tree(WorldMap map, int x, int y)
        {
            if (!InBounds(x, y)) return;
            map.Objects[y, x] = Tiles.TreeTrunk;
            if (y > 0) map.Above[y - 1, x] = Tiles.TreeTop;
        }

        /// <summary>5×3 cottage: two roof rows, then a wall with windows and a door at (x+2, y+2).</summary>
        static void House(WorldMap map, bool[,] reserved, int x, int y)
        {
            for (var dx = 0; dx < 5; dx++)
            {
                map.Objects[y, x + dx] = Tiles.Roof;
                map.Objects[y + 1, x + dx] = Tiles.RoofEave;
                map.Objects[y + 2, x + dx] = dx == 2 ? Tiles.Door : dx is 0 or 4 ? Tiles.Window : Tiles.Wall;
            }
            Reserve(reserved, x - 1, y - 1, x + 5, y + 3);
            Path(map, reserved, x + 2, y + 3, x + 2, y + 4);
        }

        /// <summary>mulberry32 — matches the web prototype so the layout is reproducible.</summary>
        sealed class Rng
        {
            uint a;

            public Rng(uint seed)
            {
                a = seed;
            }

            public double Next()
            {
                unchecked
                {
                    a += 0x6d2b79f5;
                    var t = a;
                    t = (t ^ (t >> 15)) * (t | 1);
                    t ^= t + (t ^ (t >> 7)) * (t | 61);
                    return (t ^ (t >> 14)) / 4294967296.0;
                }
            }
        }
    }
}
