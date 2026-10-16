using System.Collections.Generic;
using Buds.World;
using NUnit.Framework;
using UnityEngine;

namespace Buds.Tests
{
    public class MapLabelTests
    {
        static readonly Rect Bounds = new(-380, -285, 760, 570);

        static MapLabels.Label L(float x, float y, float w = 140, int priority = 1) =>
            new() { Anchor = new Vector2(x, y), Size = new Vector2(w, 28), Priority = priority };

        [Test]
        public void PlacedLabelsNeverOverlapEachOtherOrMarkers()
        {
            // a crowded corner: many names wanting the same spot, a marker in the middle of it
            var labels = new List<MapLabels.Label>();
            for (var i = 0; i < 12; i++) labels.Add(L(-200 + i * 6, 100 - i * 3, 120 + i * 5, i % 3));
            var marker = MapLabels.RectAt(new Vector2(-180, 95), new Vector2(34, 34));
            var spots = MapLabels.Place(labels, Bounds, new[] { marker });

            var placed = new List<Rect>();
            for (var i = 0; i < labels.Count; i++)
            {
                if (spots[i] is not { } at) continue;
                var r = MapLabels.RectAt(at, labels[i].Size);
                Assert.IsFalse(r.Overlaps(marker), $"label {i} covers the marker");
                foreach (var other in placed) Assert.IsFalse(r.Overlaps(other), $"label {i} overlaps another");
                Assert.IsTrue(r.xMin >= Bounds.xMin - 0.01f && r.xMax <= Bounds.xMax + 0.01f && r.yMin >= Bounds.yMin - 0.01f &&
                              r.yMax <= Bounds.yMax + 0.01f, $"label {i} leaves the picture");
                placed.Add(r);
            }
            Assert.Greater(placed.Count, 3, "several still fit around each other");
        }

        [Test]
        public void HigherPriorityWinsTheSpot()
        {
            var low = L(0, 0, 200, 0);
            var high = L(0, 0, 200, 5);
            var spots = MapLabels.Place(new[] { low, high }, Bounds, new Rect[0]);
            Assert.AreEqual(new Vector2(0, 0), spots[1], "the important one sits on its anchor");
            Assert.AreNotEqual(spots[1], spots[0]);
        }

        [Test]
        public void LabelsNearTheEdgeStayInside()
        {
            var spots = MapLabels.Place(new[] { L(370, 280, 200) }, Bounds, new Rect[0]);
            var r = MapLabels.RectAt(spots[0]!.Value, new Vector2(200, 28));
            Assert.LessOrEqual(r.xMax, Bounds.xMax);
            Assert.LessOrEqual(r.yMax, Bounds.yMax);
        }
    }
}
