using System;
using System.Collections.Generic;
using UnityEngine;

namespace Buds.World
{
    /// <summary>Triangles of one flat-coloured ground layer, in world units (x right, y up).</summary>
    public sealed class GroundMesh
    {
        public readonly List<Vector3> Vertices = new();
        public readonly List<int> Triangles = new();

        /// <summary>Covered area in square tiles.</summary>
        public float Area()
        {
            var area = 0f;
            for (var i = 0; i < Triangles.Count; i += 3)
            {
                var a = Vertices[Triangles[i]];
                var b = Vertices[Triangles[i + 1]];
                var c = Vertices[Triangles[i + 2]];
                area += Mathf.Abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
            }
            return area;
        }
    }

    /// <summary>
    /// Turns tile masks (roads, water…) into smooth, rounded shapes: the mask is blurred into a field and
    /// the field's iso-line is traced with filled marching squares. Straight edges stay on the tile
    /// boundary (field = 0.5 there by symmetry); corners round off. Different thresholds of the same field
    /// give concentric bands (a curb, a foam line, deep water).
    /// </summary>
    public static class GroundShapes
    {
        public const int SamplesPerTile = 6;
        /// <summary>Smoothing radius in tiles: bigger = rounder corners, but thin (1-tile) features shrink.</summary>
        public const float DefaultRadius = 1.3f;
        public const float MinRadius = 0.75f;

        /// <summary>Field sampled at (i / SamplesPerTile, j / SamplesPerTile) in map units (y down).</summary>
        public static float[,] Field(Func<int, int, bool> mask, int width, int height, float radius = DefaultRadius)
        {
            // below ~0.71 a sample on a cell corner would reach no cell centre at all (division by zero)
            radius = Mathf.Max(radius, MinRadius);
            var reach = Mathf.CeilToInt(radius);
            var span = 2 * reach + 1;

            // summed-area table of the mask: lets us skip samples whose whole neighbourhood is uniform
            var sat = new int[height + 1, width + 1];
            var cells = new bool[height, width];
            for (var y = 0; y < height; y++)
            for (var x = 0; x < width; x++)
            {
                cells[y, x] = mask(x, y);
                sat[y + 1, x + 1] = (cells[y, x] ? 1 : 0) + sat[y, x + 1] + sat[y + 1, x] - sat[y, x];
            }
            int Count(int x0, int y0, int x1, int y1) // inclusive, clamped
            {
                x0 = Mathf.Clamp(x0, 0, width - 1);
                y0 = Mathf.Clamp(y0, 0, height - 1);
                x1 = Mathf.Clamp(x1, 0, width - 1);
                y1 = Mathf.Clamp(y1, 0, height - 1);
                return sat[y1 + 1, x1 + 1] - sat[y0, x1 + 1] - sat[y1 + 1, x0] + sat[y0, x0];
            }

            // the weights only depend on where the sample sits inside its cell: precompute them
            var weights = new float[SamplesPerTile + 1, SamplesPerTile + 1, span, span];
            for (var fj = 0; fj <= SamplesPerTile; fj++)
            for (var fi = 0; fi <= SamplesPerTile; fi++)
            {
                var px = fi / (float)SamplesPerTile;
                var py = fj / (float)SamplesPerTile;
                var total = 0f;
                for (var cy = 0; cy < span; cy++)
                for (var cx = 0; cx < span; cx++)
                {
                    var dx = cx - reach + 0.5f - px;
                    var dy = cy - reach + 0.5f - py;
                    var q = 1 - (dx * dx + dy * dy) / (radius * radius);
                    var w = q > 0 ? q * q : 0;
                    weights[fi, fj, cx, cy] = w;
                    total += w;
                }
                for (var cy = 0; cy < span; cy++)
                for (var cx = 0; cx < span; cx++)
                    weights[fi, fj, cx, cy] /= total;
            }

            var nx = width * SamplesPerTile + 1;
            var ny = height * SamplesPerTile + 1;
            var field = new float[ny, nx];
            for (var j = 0; j < ny; j++)
            for (var i = 0; i < nx; i++)
            {
                var bx = i / SamplesPerTile;
                var by = j / SamplesPerTile;
                var fi = i - bx * SamplesPerTile;
                var fj = j - by * SamplesPerTile;
                var x0 = bx - reach;
                var y0 = by - reach;
                var ones = Count(x0, y0, x0 + span - 1, y0 + span - 1);
                var inside = Mathf.Max(0, Mathf.Min(x0 + span, width) - Mathf.Max(x0, 0)) *
                             Mathf.Max(0, Mathf.Min(y0 + span, height) - Mathf.Max(y0, 0));
                // fully inside the map and uniform: no need to weigh anything
                if (inside == span * span && (ones == 0 || ones == inside))
                {
                    field[j, i] = ones == 0 ? 0 : 1;
                    continue;
                }
                if (ones == 0) continue; // nothing of this kind nearby (also near the border, cells clamp)

                var sum = 0f;
                for (var cy = 0; cy < span; cy++)
                {
                    var yy = Mathf.Clamp(y0 + cy, 0, height - 1); // outside the map continues the edge cell
                    for (var cx = 0; cx < span; cx++)
                    {
                        if (!cells[yy, Mathf.Clamp(x0 + cx, 0, width - 1)]) continue;
                        sum += weights[fi, fj, cx, cy];
                    }
                }
                field[j, i] = sum;
            }
            return field;
        }

        /// <summary>Filled region where field ≥ threshold, as triangles in world space (y up).</summary>
        public static GroundMesh Contour(float[,] field, float threshold, int mapHeight) =>
            Contour(field, threshold, mapHeight, 0, 0, field.GetLength(1) - 1, field.GetLength(0) - 1);

        /// <summary>Same, limited to sample cells [i0, i1) × [j0, j1) — one chunk of a big map.</summary>
        public static GroundMesh Contour(float[,] field, float threshold, int mapHeight, int i0, int j0, int i1, int j1)
        {
            var mesh = new GroundMesh();
            var poly = new List<Vector2>(8);
            var cx = new[] { 0, 1, 1, 0 };
            var cy = new[] { 0, 0, 1, 1 };
            var v = new float[4];
            for (var j = j0; j < j1; j++)
            for (var i = i0; i < i1; i++)
            {
                var inside = 0;
                for (var k = 0; k < 4; k++)
                {
                    v[k] = field[j + cy[k], i + cx[k]];
                    if (v[k] >= threshold) inside++;
                }
                if (inside == 0) continue;

                // clip the cell square to the inside of the iso-line (corners in order TL, TR, BR, BL)
                poly.Clear();
                for (var k = 0; k < 4; k++)
                {
                    var n = (k + 1) % 4;
                    var a = new Vector2(i + cx[k], j + cy[k]);
                    var b = new Vector2(i + cx[n], j + cy[n]);
                    var aIn = v[k] >= threshold;
                    if (aIn) poly.Add(a);
                    if (aIn != v[n] >= threshold)
                    {
                        var t = (threshold - v[k]) / (v[n] - v[k]);
                        poly.Add(Vector2.Lerp(a, b, t));
                    }
                }
                if (poly.Count < 3) continue;

                var start = mesh.Vertices.Count;
                foreach (var p in poly)
                    mesh.Vertices.Add(new Vector3(p.x / SamplesPerTile, mapHeight - p.y / SamplesPerTile, 0));
                for (var k = 1; k < poly.Count - 1; k++)
                {
                    mesh.Triangles.Add(start);
                    mesh.Triangles.Add(start + k + 1);
                    mesh.Triangles.Add(start + k);
                }
            }
            return mesh;
        }
    }
}
