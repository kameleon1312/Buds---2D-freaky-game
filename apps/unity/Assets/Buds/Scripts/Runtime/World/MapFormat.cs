using System;
using System.Collections.Generic;
using System.Globalization;
using UnityEngine;

namespace Buds.World
{
    /// <summary>
    /// Text map format (Resources/Maps/&lt;district&gt;.txt). The file is the single source of truth for a district:
    /// what the ground is, what blocks movement, where props, signs, exits and zones are. The multiplayer server
    /// will read the same file for walkability.
    ///
    /// <code>
    /// // comment
    /// [district]
    /// id = miasto-ziomkow
    /// name = Miasto Ziomków
    /// base = #86c95a              // colour under everything
    /// spawn = 64,50
    /// kind = interior             // optional: a room inside a building…
    /// outside = miasto-ziomkow    // …whose way out ([exits]) leads to this district
    ///
    /// [legend]                    // one character = ground [+ prop|variant…] [!solid]
    /// . = grass
    /// T = grass + tree-a|tree-b !
    /// # = sidewalk !              // part of a building's footprint
    ///
    /// [ground]                    // drawn in this order: name : kinds : radius : threshold colour, …
    /// road : asphalt : 1.0 : 0.4 #3a3d4a, 0.5 #4a4e5c
    ///
    /// [scatter]                   // ground : chance : prop|prop
    /// grass : 0.04 : tuft
    ///
    /// [grid]
    /// TTTT....TTTT
    ///
    /// [signs]   x,y | Title | Text
    /// [exits]   x0,y0,x1,y1 | district-id
    /// [zones]   x0,y0,x1,y1 | Name
    /// [doors]   x,y | interior-id | Name     // x,y = the building's anchor; entered from the cell below
    /// </code>
    /// Prop variants (a|b|c) are chosen per cell with a fixed hash, so every client and the server agree.
    /// </summary>
    public static class MapFormat
    {
        sealed class LegendEntry
        {
            public string Ground;
            public string[] Props;
            public bool Solid;
        }

        public static WorldMap Load(string districtId)
        {
            var asset = Resources.Load<TextAsset>("Maps/" + districtId);
            if (!asset) throw new ArgumentException($"No map Resources/Maps/{districtId}.txt");
            return Parse(asset.text);
        }

        public static WorldMap Parse(string text)
        {
            var map = new WorldMap();
            var legend = new Dictionary<char, LegendEntry>();
            var grid = new List<string>();
            var section = "";
            var lineNo = 0;

            foreach (var raw in text.Replace("\r", "").Split('\n'))
            {
                lineNo++;
                if (section == "grid" && raw.Length > 0 && !raw.StartsWith("["))
                {
                    grid.Add(raw);
                    continue;
                }
                var line = StripComment(raw).Trim();
                if (line.Length == 0) continue;
                if (line.StartsWith("[") && line.EndsWith("]"))
                {
                    section = line.Substring(1, line.Length - 2).Trim().ToLowerInvariant();
                    continue;
                }
                try
                {
                    switch (section)
                    {
                        case "district": District(map, line); break;
                        case "legend": Legend(legend, line); break;
                        case "ground": map.GroundStyles.Add(Ground(line)); break;
                        case "scatter": map.Scatter.Add(Scatter(line)); break;
                        case "signs": map.Signs.Add(SignLine(line)); break;
                        case "exits": map.Exits.Add(ExitLine(line)); break;
                        case "zones": map.Zones.Add(ZoneLine(line)); break;
                        case "doors": map.Doors.Add(DoorLine(line)); break;
                        default: throw new FormatException($"unknown section [{section}]");
                    }
                }
                catch (Exception e) when (e is not MapFormatException)
                {
                    throw new MapFormatException($"line {lineNo}: {e.Message}");
                }
            }

            Grid(map, legend, grid);
            return map;
        }

        // "//" starts a comment, except inside the grid
        static string StripComment(string line)
        {
            var i = line.IndexOf("//", StringComparison.Ordinal);
            return i < 0 ? line : line.Substring(0, i);
        }

        static void District(WorldMap map, string line)
        {
            var (key, value) = KeyValue(line);
            switch (key)
            {
                case "id": map.Id = value; break;
                case "name": map.Name = value; break;
                case "base": map.BaseColor = Color(value); break;
                case "kind":
                    if (value != "interior" && value != "district") throw new FormatException($"unknown kind '{value}'");
                    map.IsInterior = value == "interior";
                    break;
                case "outside": map.Outside = value; break;
                case "spawn":
                    var xy = Ints(value, 2);
                    map.SpawnX = xy[0];
                    map.SpawnY = xy[1];
                    break;
                default: throw new FormatException($"unknown key '{key}'");
            }
        }

        static void Legend(Dictionary<char, LegendEntry> legend, string line)
        {
            var key = line[0];
            var rest = line.Substring(1).TrimStart();
            if (!rest.StartsWith("=")) throw new FormatException("legend lines look like 'X = ground [+ prop] [!]'");
            var def = rest.Substring(1).Trim();
            var entry = new LegendEntry { Solid = def.EndsWith("!") };
            if (entry.Solid) def = def.Substring(0, def.Length - 1).Trim();
            var plus = def.IndexOf('+');
            entry.Ground = (plus < 0 ? def : def.Substring(0, plus)).Trim();
            entry.Props = plus < 0 ? Array.Empty<string>() : def.Substring(plus + 1).Trim().Split('|');
            if (entry.Ground.Length == 0) throw new FormatException("missing ground");
            if (legend.ContainsKey(key)) throw new FormatException($"'{key}' defined twice");
            legend[key] = entry;
        }

        static GroundStyle Ground(string line)
        {
            var parts = line.Split(':');
            if (parts.Length != 4) throw new FormatException("ground lines look like 'name : kinds : radius : t #colour, …'");
            var bands = new List<(float, Color)>();
            foreach (var band in parts[3].Split(','))
            {
                var bits = band.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
                if (bits.Length != 2) throw new FormatException($"bad band '{band.Trim()}'");
                bands.Add((Float(bits[0]), Color(bits[1])));
            }
            return new GroundStyle
            {
                Name = parts[0].Trim(),
                Kinds = parts[1].Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries),
                Radius = Float(parts[2].Trim()),
                Bands = bands.ToArray(),
            };
        }

        static ScatterRule Scatter(string line)
        {
            var parts = line.Split(':');
            if (parts.Length != 3) throw new FormatException("scatter lines look like 'ground : chance : prop|prop'");
            return new ScatterRule
            {
                Ground = parts[0].Trim(),
                Chance = Float(parts[1].Trim()),
                Props = parts[2].Trim().Split('|'),
            };
        }

        static Sign SignLine(string line)
        {
            var parts = line.Split('|');
            if (parts.Length != 3) throw new FormatException("sign lines look like 'x,y | Title | Text'");
            var xy = Ints(parts[0], 2);
            return new Sign { X = xy[0], Y = xy[1], Title = parts[1].Trim(), Text = parts[2].Trim() };
        }

        static Exit ExitLine(string line)
        {
            var parts = line.Split('|');
            if (parts.Length != 2) throw new FormatException("exit lines look like 'x0,y0,x1,y1 | district'");
            var r = Ints(parts[0], 4);
            return new Exit { X0 = r[0], Y0 = r[1], X1 = r[2], Y1 = r[3], DistrictId = parts[1].Trim() };
        }

        static Zone ZoneLine(string line)
        {
            var parts = line.Split('|');
            if (parts.Length != 2) throw new FormatException("zone lines look like 'x0,y0,x1,y1 | Name'");
            var r = Ints(parts[0], 4);
            return new Zone { X0 = r[0], Y0 = r[1], X1 = r[2], Y1 = r[3], Name = parts[1].Trim() };
        }

        static Door DoorLine(string line)
        {
            var parts = line.Split('|');
            if (parts.Length != 3) throw new FormatException("door lines look like 'x,y | interior-id | Name'");
            var xy = Ints(parts[0], 2);
            return new Door { X = xy[0], Y = xy[1], Target = parts[1].Trim(), Name = parts[2].Trim() };
        }

        static void Grid(WorldMap map, Dictionary<char, LegendEntry> legend, List<string> rows)
        {
            while (rows.Count > 0 && rows[^1].Trim().Length == 0) rows.RemoveAt(rows.Count - 1);
            if (rows.Count == 0) throw new MapFormatException("missing [grid]");
            map.Height = rows.Count;
            map.Width = rows[0].Length;
            map.Ground = new int[map.Height, map.Width];
            map.Solid = new bool[map.Height, map.Width];
            var kinds = new Dictionary<string, int>();

            for (var y = 0; y < map.Height; y++)
            {
                var row = rows[y];
                if (row.Length != map.Width)
                    throw new MapFormatException($"grid row {y} has {row.Length} characters, expected {map.Width}");
                for (var x = 0; x < map.Width; x++)
                {
                    if (!legend.TryGetValue(row[x], out var e))
                        throw new MapFormatException($"grid ({x},{y}): '{row[x]}' is not in the legend");
                    if (!kinds.TryGetValue(e.Ground, out var kind))
                    {
                        kind = map.GroundKinds.Count;
                        kinds[e.Ground] = kind;
                        map.GroundKinds.Add(e.Ground);
                    }
                    map.Ground[y, x] = kind;
                    map.Solid[y, x] = e.Solid;
                    if (e.Props.Length > 0)
                        map.Props.Add(new PropSpot { Name = Pick(e.Props, x, y), X = x, Y = y });
                }
            }
        }

        /// <summary>Deterministic 0..1 value per cell (and salt): same on every device and on the server.</summary>
        public static float Hash(int x, int y, int salt = 0)
        {
            unchecked
            {
                var n = (uint)(x * 374761393 + y * 668265263 + salt * 1442695041);
                n = (n ^ (n >> 13)) * 1274126177;
                return ((n ^ (n >> 16)) & 0xffffff) / (float)0x1000000;
            }
        }

        public static string Pick(string[] options, int x, int y, int salt = 0) =>
            options[Mathf.Min(options.Length - 1, (int)(Hash(x, y, salt) * options.Length))];

        static (string, string) KeyValue(string line)
        {
            var i = line.IndexOf('=');
            if (i < 0) throw new FormatException("expected 'key = value'");
            return (line.Substring(0, i).Trim().ToLowerInvariant(), line.Substring(i + 1).Trim());
        }

        static int[] Ints(string s, int count)
        {
            var parts = s.Split(',');
            if (parts.Length != count) throw new FormatException($"expected {count} numbers in '{s.Trim()}'");
            var result = new int[count];
            for (var i = 0; i < count; i++) result[i] = int.Parse(parts[i].Trim(), CultureInfo.InvariantCulture);
            return result;
        }

        static float Float(string s) => float.Parse(s, NumberStyles.Float, CultureInfo.InvariantCulture);

        static Color Color(string hex) =>
            ColorUtility.TryParseHtmlString(hex.Trim(), out var c) ? c : throw new FormatException($"bad colour '{hex}'");
    }

    public sealed class MapFormatException : Exception
    {
        public MapFormatException(string message) : base(message) { }
    }
}
