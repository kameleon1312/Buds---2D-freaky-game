using System.Collections.Generic;
using Buds.World;
using NUnit.Framework;
using UnityEngine;

namespace Buds.Tests
{
    /// <summary>
    /// The rules every picture of the world keeps (tools/world/art, exported by export-art.ts): it is there, buildings
    /// stand on an odd footprint (the anchor is the middle of the bottom row), what stands touches the ground near its
    /// bottom edge, nothing is absurdly big, and everything the districts and the world's life lay out has its picture.
    /// </summary>
    public class ArtRulesTests
    {
        static readonly PropArt.Manifest Manifest = PropArt.LoadManifest();

        static HashSet<string> Names()
        {
            var names = new HashSet<string>();
            foreach (var e in Manifest.props) names.Add(e.name);
            return names;
        }

        [Test]
        public void EveryPropHasItsPictureAndKeepsTheRules()
        {
            Assert.Greater(Manifest.props.Length, 300);
            foreach (var e in Manifest.props)
            {
                var tex = Resources.Load<Texture2D>("World/" + e.name);
                Assert.IsNotNull(tex, $"{e.name}: no picture");
                Assert.LessOrEqual(Mathf.Max(tex.width, tex.height), 2048, $"{e.name}: too big for one atlas page");
                Assert.That(e.pivotX, Is.InRange(0f, 1f), e.name);
                Assert.That(e.pivotY, Is.InRange(0f, 1f), e.name);
                if (e.flat) continue;
                if (e.foot is { Length: 2 }) Assert.AreEqual(1, e.foot[0] % 2, $"{e.name}: footprint width must be odd");
                Assert.Less(e.pivotY, 0.35f, $"{e.name}: what stands meets the ground near its bottom");
            }
        }

        [Test]
        public void EverythingTheWorldLaysOutHasItsPicture()
        {
            var names = Names();
            foreach (var n in WorldLife.Names) Assert.IsTrue(names.Contains(n), $"life: {n}");
            foreach (var g in new[] { "grass", "lawn", "sand", "dirt", "gravel", "asphalt" })
                if (WorldView.DressingFor(g) is { } d)
                    foreach (var n in d.props.Split('|'))
                        Assert.IsTrue(names.Contains(n), $"dressing on {g}: {n}");
            foreach (var id in new[] { "miasto-ziomkow", "las-palmas", "dzika-puszcza", "dwor-carski", "los-karkos" })
            {
                var look = DistrictLook.For(id);
                foreach (var (_, _, props) in look.Extra)
                foreach (var n in props.Split('|'))
                    Assert.IsTrue(names.Contains(n), $"{id}: {n}");
            }
            foreach (var n in new[] { "tuft", "chwast", "flowers-c" }) Assert.IsTrue(names.Contains(n), $"edges: {n}");
        }
    }
}
