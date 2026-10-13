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
    /// Turns tile masks (paths, water…) into smooth, rounded shapes: the mask is blurred into a field and
    /// the field's iso-line is traced with filled marching squares. Straight edges stay on the tile
    /// boundary (field = 0.5 there by symmetry); corners round off. Different thresholds of the same field
    /// give concentric bands (a path rim, a water foam line, deep water).
    /// </summary>
    public static class GroundShapes
    {
        public const int SamplesPerTile = 6;
        /// <summary>Smoothing radius in tiles: bigger = rounder corners, but thin (1-tile) features shrink.</summary>
        public const float DefaultRadius = 1.3f;

        /// <summary>Field sampled at (i / SamplesPerTile, j / SamplesPerTile) in map units (y down).</summary>
        public static float[,] Field(Func<int, int, bool> mask, int width, int height, float radius = DefaultRadius)
        {
            var cells = new float[height, width];
            for (var y = 0; y < height; y++)
            for (var x = 0; x < width; x++)
                cells[y, x] = mask(x, y) ? 1 : 0;

            var nx = width * SamplesPerTile + 1;
            var ny = height * SamplesPerTile + 1;
            var field = new float[ny, nx];
            var reach = Mathf.CeilToInt(radius);
            for (var j = 0; j < ny; j++)
            for (var i = 0; i < nx; i++)
            {
                var px = i / (float)SamplesPerTile;
                var py = j / (float)SamplesPerTile;
                var cx0 = Mathf.FloorToInt(px) - reach;
                var cy0 = Mathf.FloorToInt(py) - reach;
                float sum = 0, weight = 0;
                for (var cy = cy0; cy <= cy0 + 2 * reach; cy++)
                for (var cx = cx0; cx <= cx0 + 2 * reach; cx++)
                {
                    var dx = cx + 0.5f - px;
                    var dy = cy + 0.5f - py;
                    var q = 1 - (dx * dx + dy * dy) / (radius * radius);
                    if (q <= 0) continue;
                    var w = q * q;
                    // outside the map continues the nearest edge cell, so shapes don't fade at the border
                    sum += w * cells[Mathf.Clamp(cy, 0, height - 1), Mathf.Clamp(cx, 0, width - 1)];
                    weight += w;
                }
                field[j, i] = weight > 0 ? sum / weight : 0;
            }
            return field;
        }

        /// <summary>Filled region where field ≥ threshold, as triangles in world space (y up).</summary>
        public static GroundMesh Contour(float[,] field, float threshold, int mapHeight)
        {
            var mesh = new GroundMesh();
            var ny = field.GetLength(0);
            var nx = field.GetLength(1);
            var poly = new List<Vector2>(8);
            var cx = new int[] { 0, 1, 1, 0 };
            var cy = new int[] { 0, 0, 1, 1 };
            var v = new float[4];
            for (var j = 0; j < ny - 1; j++)
            for (var i = 0; i < nx - 1; i++)
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
                // y is flipped, so reverse the fan to keep the winding facing the camera
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
