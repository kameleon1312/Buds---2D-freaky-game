using System.Collections.Generic;
using Buds.World;
using UnityEngine;

namespace Buds.Quests
{
    /// <summary>
    /// The training stations of the current map (packages/shared content/training.ts): a prop with a lime pennant
    /// that blocks its cell like an NPC. Walking up to one and pressing E starts the mini-game.
    /// </summary>
    public sealed class TrainingWorld : MonoBehaviour
    {
        readonly List<(TrainingSpotData data, Vector3 at)> spots = new();

        public static TrainingWorld Create(WorldView world, QuestContent content)
        {
            var tw = new GameObject("Training").AddComponent<TrainingWorld>();
            tw.transform.SetParent(world.transform, false);
            var here = new List<TrainingSpotData>();
            foreach (var t in content.training)
                if (t.map == world.Map.Id) here.Add(t);
            var names = new HashSet<string>();
            foreach (var t in here) names.Add("trening-" + t.look);
            var art = PropArt.Load(names);
            foreach (var t in here)
            {
                var feet = world.CellCenter(t.x, t.y) + new Vector3(0, -0.35f, 0);
                var go = new GameObject("Training " + t.id);
                go.transform.SetParent(tw.transform, false);
                go.transform.position = feet;
                var sprite = go.AddComponent<SpriteRenderer>();
                sprite.sprite = art.Get("trening-" + t.look);
                sprite.sortingOrder = WorldView.SortOrderFor(feet.y);
                var box = go.AddComponent<BoxCollider2D>();
                box.size = new Vector2(0.8f, 0.4f);
                box.offset = new Vector2(0, 0.2f);
                tw.spots.Add((t, feet));
            }
            return tw;
        }

        public IReadOnlyList<(TrainingSpotData data, Vector3 at)> Spots => spots;

        /// <summary>The closest station within <paramref name="range"/> tiles of the feet, or null.</summary>
        public TrainingSpotData Nearest(Vector2 feet, float range)
        {
            TrainingSpotData best = null;
            var bestD = range;
            foreach (var (data, at) in spots)
            {
                var d = Vector2.Distance(feet, at);
                if (d > bestD) continue;
                bestD = d;
                best = data;
            }
            return best;
        }
    }
}
