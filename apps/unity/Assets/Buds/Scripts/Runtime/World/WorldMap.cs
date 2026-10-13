using System.Collections.Generic;
using UnityEngine;

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

    /// <summary>Named area (city centre, beach, junkyard…) announced when the player walks in.</summary>
    public sealed class Zone
    {
        public int X0;
        public int Y0;
        public int X1;
        public int Y1;
        public string Name;

        public bool Contains(int x, int y) => x >= X0 && x <= X1 && y >= Y0 && y <= Y1;
        public int Area => (X1 - X0 + 1) * (Y1 - Y0 + 1);
    }

    /// <summary>
    /// A building you can walk into: (X, Y) is its anchor (middle of the bottom row, solid), entered from the cell
    /// below it. Target is the interior map's id.
    /// </summary>
    public sealed class Door
    {
        public int X;
        public int Y;
        public string Target;
        public string Name;

        public Vector2Int Front => new(X, Y + 1);
    }

    public sealed class Sign
    {
        public int X;
        public int Y;
        public string Title;
        public string Text;
    }

    /// <summary>A prop sprite anchored at the bottom-centre of a cell (buildings: the middle of their bottom row).</summary>
    public sealed class PropSpot
    {
        public string Name;
        public int X;
        public int Y;
        /// <summary>Sprinkled by a [scatter] rule (not drawn in the grid): may wander inside its cell.</summary>
        public bool Scattered;
    }

    /// <summary>How one ground layer looks: which ground kinds form it, how round it is, and its colour bands.</summary>
    public sealed class GroundStyle
    {
        public string Name;
        public string[] Kinds;
        public float Radius;
        public (float Threshold, Color Color)[] Bands;
    }

    /// <summary>Decorations sprinkled over a ground kind (tufts on grass, shells on sand…).</summary>
    public sealed class ScatterRule
    {
        public string Ground;
        public float Chance;
        public string[] Props;
    }

    /// <summary>
    /// One district, loaded from Resources/Maps/&lt;id&gt;.txt (see MapFormat). Map coordinates: x right,
    /// y DOWN (row 0 is the northern edge); WorldView flips to Unity's y-up.
    /// </summary>
    public sealed class WorldMap
    {
        public string Id;
        public string Name;
        public int Width;
        public int Height;
        public Color BaseColor = new(0.53f, 0.79f, 0.35f);
        public int SpawnX;
        public int SpawnY;
        /// <summary>Interior (a room inside a building) rather than a district.</summary>
        public bool IsInterior;
        /// <summary>For interiors: the district its way out leads to.</summary>
        public string Outside;

        public readonly List<string> GroundKinds = new();
        public int[,] Ground; // index into GroundKinds, [y, x]
        public bool[,] Solid; // [y, x]

        public readonly List<PropSpot> Props = new();
        public readonly List<Sign> Signs = new();
        public readonly List<Exit> Exits = new();
        public readonly List<Zone> Zones = new();
        public readonly List<Door> Doors = new();
        public readonly List<GroundStyle> GroundStyles = new();
        public readonly List<ScatterRule> Scatter = new();

        public bool InBounds(int x, int y) => x >= 0 && y >= 0 && x < Width && y < Height;

        public bool IsWalkable(int x, int y) => InBounds(x, y) && !Solid[y, x];

        public string GroundAt(int x, int y) => GroundKinds[Ground[y, x]];

        /// <summary>The smallest zone containing the cell (zones can nest: a skatepark inside the city centre).</summary>
        public Zone ZoneAt(int x, int y)
        {
            Zone best = null;
            foreach (var z in Zones)
                if (z.Contains(x, y) && (best == null || z.Area < best.Area))
                    best = z;
            return best;
        }

        public Exit ExitAt(int x, int y)
        {
            foreach (var e in Exits)
                if (e.Contains(x, y)) return e;
            return null;
        }

        /// <summary>The district this map belongs to: itself, or the one an interior is entered from.</summary>
        public string DistrictId => IsInterior ? Outside : Id;

        /// <summary>The door whose front cell (just below the building) is (x, y).</summary>
        public Door DoorInFront(int x, int y)
        {
            foreach (var d in Doors)
                if (d.X == x && d.Y + 1 == y) return d;
            return null;
        }

        /// <summary>
        /// Where a bud coming from another map appears: in front of the door of the room it left, or next to the
        /// exit that leads back to the district it came from, a few steps into the map. Interiors always start at
        /// their spawn (just inside the door); unknown origins fall back to the spawn point.
        /// </summary>
        public Vector2Int ArrivalFrom(string districtId)
        {
            foreach (var d in Doors)
                if (d.Target == districtId) return d.Front;
            if (IsInterior) return new Vector2Int(SpawnX, SpawnY);
            foreach (var e in Exits)
            {
                if (e.DistrictId != districtId) continue;
                var x = (e.X0 + e.X1) / 2;
                var y = (e.Y0 + e.Y1) / 2;
                var dx = e.X0 == 0 ? 1 : e.X1 == Width - 1 ? -1 : 0;
                var dy = e.Y0 == 0 ? 1 : e.Y1 == Height - 1 ? -1 : 0;
                for (var step = 3; step < 8; step++)
                    if (IsWalkable(x + dx * step, y + dy * step))
                        return new Vector2Int(x + dx * step, y + dy * step);
            }
            return new Vector2Int(SpawnX, SpawnY);
        }
    }
}
