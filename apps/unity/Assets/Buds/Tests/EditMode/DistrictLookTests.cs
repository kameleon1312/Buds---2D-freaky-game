using System.Collections.Generic;
using Buds.World;
using NUnit.Framework;

namespace Buds.Tests
{
    /// <summary>Every district has its own look (water, ground, life), and every map takes the look of its district.</summary>
    public class DistrictLookTests
    {
        [Test]
        public void MapsTakeTheLookOfTheirDistrict()
        {
            Assert.AreEqual("las-palmas", DistrictLook.DistrictOf("pustkowie-wydmy"));
            Assert.AreEqual("dzika-puszcza", DistrictLook.DistrictOf("pustkowie-ostepy"));
            Assert.AreEqual("dwor-carski", DistrictLook.DistrictOf("pustkowie-gosciniec"));
            Assert.AreEqual("los-karkos", DistrictLook.DistrictOf("pustkowie-nieuzytki"));
            Assert.AreEqual("dwor-carski", DistrictLook.DistrictOf("dwor-carski-dworek"));
            Assert.AreEqual("las-palmas", DistrictLook.DistrictOf("wyspa-startowa"));
            Assert.AreEqual("miasto-ziomkow", DistrictLook.DistrictOf("miasto-ziomkow"));
        }

        [Test]
        public void EveryDistrictLooksLikeItself()
        {
            var seen = new HashSet<string>();
            foreach (var id in new[] { "miasto-ziomkow", "las-palmas", "dzika-puszcza", "dwor-carski", "los-karkos" })
            {
                var l = DistrictLook.For(id);
                Assert.AreEqual(id, l.Id);
                Assert.Less(l.WebLow, l.WebHigh, id);
                Assert.IsTrue(seen.Add($"{l.Glint}|{l.Desat}|{l.LeafRate}"), $"{id} looks like another district");
            }
            Assert.Greater(DistrictLook.For("los-karkos").Desat, DistrictLook.For("las-palmas").Desat, "the scrapland is the drabbest");
        }
    }
}
