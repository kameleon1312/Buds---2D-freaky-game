using System;
using System.Collections.Generic;
using Buds.World;
using UnityEngine;

namespace Buds.Core
{
    /// <summary>
    /// Seamless roads out of a city (World/Seams): walking towards a road onto a wasteland, the wasteland is worked out on
    /// a worker thread and laid down right behind the city's edge a little at a time, so the bud sees it ahead and walks
    /// straight on, no fade, no stop. The moment its feet cross the edge the wasteland becomes the map the bud is on: the
    /// whole world moves so it sits at the origin (nothing notices: the bud, the camera and the dust move with it), its
    /// own people come in, and the city stays behind as scenery until the bud is far enough away. Walking back is just as
    /// seamless. Only the wasteland's far end, into the next city, keeps the fade: that is where a new place begins.
    /// </summary>
    public sealed partial class GameBootstrap
    {
        /// <summary>Tiles from the road out: start working the next map out, lay it down, let it go again.</summary>
        const float SeamPrepareReach = 48f, SeamBuildReach = 36f, SeamDropReach = 70f;
        /// <summary>Standing on a seamless road this long while the next map still isn't there: the old way (a fade).</summary>
        const float SeamFallbackSeconds = 3f;
        /// <summary>The light drifts into the new land's over this long after crossing.</summary>
        const float SeamGradeSeconds = 4f;

        WorldView neighbour;
        Vector2 neighbourAt; // where the neighbour's origin is (world units; the current map's origin is zero)
        /// <summary>On a wasteland: the city the bud came from (its end is seamless). Null in a city.</summary>
        string seamFrom;
        bool neighbourBuilding;
        int seamGeneration;
        float seamWaitSince = -1;
        /// <summary>Maps that could not be laid next to another (they don't line up): their roads keep the fade.</summary>
        readonly HashSet<string> seamBroken = new();

        /// <summary>Whether this road out of the current map is walked seamlessly into the next map.</summary>
        bool IsSeamExit(Exit e)
        {
            if (e == null || !world || world.Map.IsInterior || seamBroken.Contains(e.DistrictId)) return false;
            var map = world.Map;
            if (Districts.IsRoute(map.Id)) return seamFrom != null && e.DistrictId == seamFrom;
            return Districts.IsRoute(e.DistrictId) && RouteOpen(e.DistrictId, map.Id);
        }

        /// <summary>The road onto a wasteland is open when the city at its far end is (dev builds walk everywhere).</summary>
        bool RouteOpen(string routeId, string from)
        {
            if (Districts.CanEnterRoute(routeId, from, level)) return true;
            var far = Districts.Get(Districts.FarEnd(routeId, from) ?? "");
            return far == null || (Debug.isDebugBuild && far.Open);
        }

        /// <summary>The seamless road nearest to the bud, and how far it is.</summary>
        (Exit exit, float distance) NearestSeam(Vector2 feet)
        {
            Exit best = null;
            var bestD = float.MaxValue;
            foreach (var e in world.Map.Exits)
            {
                if (!IsSeamExit(e)) continue;
                var d = Seams.DistanceTo(e, world.Map, feet);
                if (d >= bestD) continue;
                bestD = d;
                best = e;
            }
            return (best, bestD);
        }

        /// <summary>
        /// Every frame on a map: lays the next map down when the bud nears a seamless road, lets it go when the bud is
        /// far, and crosses over when the bud's feet leave this map for it. True = crossed (the frame starts over).
        /// </summary>
        bool UpdateSeam(Vector2Int cell)
        {
            var map = world.Map;
            var feet = (Vector2)player.transform.position;
            if (neighbour && !map.InBounds(cell.x, cell.y) && InNeighbour(feet))
            {
                CrossSeam();
                return true;
            }
            if (neighbour)
            {
                var exit = Seams.ExitTo(map, neighbour.Map.Id);
                if (exit == null || Seams.DistanceTo(exit, map, feet) > SeamDropReach) DropNeighbour();
                seamWaitSince = -1;
                return false;
            }
            var (near, distance) = NearestSeam(feet);
            if (near == null) return false;
            if (distance < SeamPrepareReach) WorldView.Prepare(near.DistrictId);
            if (distance < SeamBuildReach && !neighbourBuilding) _ = BuildNeighbour(near);
            // standing on the road while the next map is still on its way: wait a moment, then go the old way
            if (near.Contains(cell.x, cell.y))
            {
                if (seamWaitSince < 0) seamWaitSince = Time.unscaledTime;
                else if (Time.unscaledTime - seamWaitSince > SeamFallbackSeconds)
                {
                    seamWaitSince = -1;
                    Debug.LogWarning($"[Seam] {near.DistrictId} not ready in time: fading over");
                    _ = Travel(near.DistrictId, map.Id);
                    return true;
                }
            }
            else seamWaitSince = -1;
            return false;
        }

        bool InNeighbour(Vector2 feet)
        {
            var n = neighbour.Map;
            var local = feet - neighbourAt;
            var x = Mathf.FloorToInt(local.x);
            var y = n.Height - 1 - Mathf.FloorToInt(local.y + 0.15f);
            return n.InBounds(x, y);
        }

        /// <summary>Works the next map out (worker thread) and lays it down next to this one over a few frames.</summary>
        async Awaitable BuildNeighbour(Exit exit)
        {
            neighbourBuilding = true;
            var generation = ++seamGeneration;
            var hereId = world.Map.Id;
            var id = exit.DistrictId;
            var clock = System.Diagnostics.Stopwatch.StartNew();
            var frames = 0;
            bool Stale() => !this || generation != seamGeneration || !world || world.Map.Id != hereId || travelling;
            try
            {
                // the ground is worked out on a worker thread: wait for it without blocking a frame
                WorldView.Prepare(id);
                while (!WorldView.IsPrepared(id))
                {
                    await Awaitable.NextFrameAsync();
                    frames++;
                    if (Stale()) return;
                    WorldView.Prepare(id); // someone else's map took the slot meanwhile: ours again
                }
                var ready = WorldView.TakePrepared(id);
                if (ready == null) throw new InvalidOperationException("nothing prepared");
                var (map, ground) = ready.Value;
                var offset = Seams.OffsetOf(world.Map, map);
                if (offset == null)
                {
                    // the two maps don't line up: this road keeps the fade
                    seamBroken.Add(id);
                    Debug.LogWarning($"[Seam] {hereId} and {id} don't line up: keeping the fade");
                    return;
                }
                var view = await WorldView.CreateSpread(map, ground, offset.Value);
                if (Stale())
                {
                    if (view) Destroy(view.gameObject);
                    return;
                }
                if (!view) return;
                neighbour = view;
                neighbourAt = offset.Value;
                LinkSeam();
                if (CommandLine.Has("-buds-autoshot"))
                    Debug.Log($"[Seam] {id} laid next to {hereId} at {neighbourAt} in {clock.ElapsedMilliseconds} ms ({WorldView.LastTimings})");
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                seamBroken.Add(id); // never trap the bud at an edge: this road goes back to the fade
            }
            finally
            {
                if (generation == seamGeneration) neighbourBuilding = false;
            }
        }

        /// <summary>Opens both maps' edges where the road runs on, splits the ground between them, widens the camera.</summary>
        void LinkSeam()
        {
            world.OpenEdge(Seams.ExitTo(world.Map, neighbour.Map.Id));
            neighbour.OpenEdge(Seams.ExitTo(neighbour.Map, world.Map.Id));
            world.SetBase(Seams.BaseRect(world.Map, neighbour.Map, neighbourAt));
            neighbour.SetBase(Seams.NeighbourBaseRect(neighbour.Map, world.Map, neighbourAt));
            UpdateCameraBounds();
        }

        /// <summary>The map laid next to this one goes (the bud walked far away, or travels elsewhere).</summary>
        void DropNeighbour()
        {
            seamGeneration++;
            neighbourBuilding = false;
            seamWaitSince = -1;
            if (neighbour) Destroy(neighbour.gameObject);
            neighbour = null;
            if (!world) return;
            world.OpenEdge(null);
            world.SetBase(Seams.BaseRect(world.Map, null, Vector2.zero));
            UpdateCameraBounds();
        }

        /// <summary>
        /// The bud walked across the edge: the map ahead becomes the one it is on. Everything moves so the new map sits at
        /// the origin (map coordinates stay what the server, the quests and the others expect), the old map's people go,
        /// the new map's come, and the old map stays behind as scenery.
        /// </summary>
        void CrossSeam()
        {
            var clock = System.Diagnostics.Stopwatch.StartNew();
            var old = world;
            var by = -(Vector3)neighbourAt;
            old.transform.position += by;
            neighbour.transform.position = Vector3.zero;
            player.Shift(by);
            Camera.main!.GetComponent<FollowCamera>().Shift(by);
            // the old map's people live with it: they go, the old map stays as the view behind the bud
            ClearMapPeople();
            world = neighbour;
            neighbour = old;
            neighbourAt = -neighbourAt;
            world.Resort();
            neighbour.Resort();
            if (Districts.IsRoute(world.Map.Id)) seamFrom = neighbour.Map.Id;
            WorldView.MakeCurrent(world);
            EnterMap(world.Map);
            LinkSeam();
            SetUpMapPeople(SeamGradeSeconds);
            AnnounceMap(player.MapCell(world.Map.Height));
            if (CommandLine.Has("-buds-autoshot"))
                Debug.Log($"[Seam] crossed into {world.Map.Id} from {neighbour.Map.Id} in {clock.ElapsedMilliseconds} ms");
        }

        /// <summary>The current map's people and places go (their GameObjects live under the map).</summary>
        void ClearMapPeople()
        {
            if (questWorld) Destroy(questWorld.gameObject);
            if (cacheWorld) Destroy(cacheWorld.gameObject);
            if (enemyWorld) Destroy(enemyWorld.gameObject);
            if (combatFx) Destroy(combatFx.gameObject);
            if (trainingWorld) Destroy(trainingWorld.gameObject);
            if (districtsWorld) Destroy(districtsWorld.gameObject);
            nearbyNpc = null;
            nearbyEnemy = null;
            nearbyCache = null;
            nearbyTraining = null;
            nearbyDoor = null;
            nearby = null;
            ForgetRemotes();
        }

        /// <summary>Solid in the world: the current map, the one laid next to it, nothing beyond either.</summary>
        bool WalkBlocked(int x, int y)
        {
            if (!world) return true;
            var m = world.Map;
            var my = m.Height - 1 - y;
            if (m.InBounds(x, my))
            {
                if (!m.IsWalkable(x, my)) return true;
                // the districts on a wasteland's plots: their buildings are solid too
                return districtsWorld && districtsWorld.Blocks(x, my);
            }
            if (!neighbour) return true;
            var n = neighbour.Map;
            var lx = x - Mathf.RoundToInt(neighbourAt.x);
            var ly = n.Height - 1 - (y - Mathf.RoundToInt(neighbourAt.y));
            return !n.IsWalkable(lx, ly);
        }

        /// <summary>The camera keeps to the map, and reaches across into the map laid next to it.</summary>
        void UpdateCameraBounds()
        {
            if (!world || !Camera.main) return;
            var cam = Camera.main.GetComponent<FollowCamera>();
            if (!cam) return;
            var m = world.Map;
            // rooms: a little room above the map so the whole back wall shows; around them, the map's dark base
            var r = new Rect(0, 0, m.Width, m.Height + (m.IsInterior ? 1.6f : 0));
            if (neighbour)
            {
                var n = new Rect(neighbourAt, new Vector2(neighbour.Map.Width, neighbour.Map.Height));
                var sideways = n.xMin >= r.xMax - 0.01f || n.xMax <= r.xMin + 0.01f;
                if (sideways) r = Rect.MinMaxRect(Mathf.Min(r.xMin, n.xMin), r.yMin, Mathf.Max(r.xMax, n.xMax), r.yMax);
                else r = Rect.MinMaxRect(r.xMin, Mathf.Min(r.yMin, n.yMin), r.xMax, Mathf.Max(r.yMax, n.yMax));
            }
            cam.bounds = r;
        }
    }
}
