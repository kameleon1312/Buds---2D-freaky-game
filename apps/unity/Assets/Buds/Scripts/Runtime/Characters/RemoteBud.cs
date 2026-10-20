using System;
using Buds.Api;
using Buds.World;
using UnityEngine;

namespace Buds.Characters
{
    /// <summary>
    /// Another player's bud on this map: drawn like the player's own (sheet, shadow, cast shadow, walking legs, the
    /// ride with the skater's stance), moved smoothly from the room's snapshots (<see cref="LiveTrack"/>). No collider:
    /// buds pass through each other, nobody can block a street. Never touches the network itself.
    /// </summary>
    public sealed class RemoteBud : MonoBehaviour
    {
        public LivePlayerDto Data { get; private set; }
        public string Name => Data?.name ?? "";

        readonly LiveTrack track = new();
        readonly WalkCycle walk = new(BudMotor.WalkSpeed, BudMotor.RunSpeed, 0.95f, 1.35f, 0.035f);
        BudSheet sheet;
        bool ownsSheet;
        SpriteRenderer body;
        SpriteRenderer rideSprite;
        Func<string, Facing, Sprite> rideArt;
        Vector2 shownAt;
        Vector2 lastShown;

        /// <summary>Where the head is (for the name and the speech bubble), in world space.</summary>
        public Vector3 Head => HeadOf(body, transform);

        /// <summary>
        /// How high the top of a bud's head is above its feet, in the sprite's own units: the frame (1.5 units, feet at
        /// 2/24) has room above the hair, so its edge would put a name far over the head.
        /// </summary>
        const float HeadTop = 0.98f;

        /// <summary>A point just over a standing bud's head (it leans back with the camera tilt, like the sprite).</summary>
        public static Vector3 HeadOf(SpriteRenderer sprite, Transform fallback)
        {
            if (!sprite) return fallback.position;
            // the sprite's parent, not the sprite: the bounce of a step must not shake the name
            var stand = sprite.transform.parent ? sprite.transform.parent : sprite.transform;
            // ...but sitting high on a ride lifts it with the bud
            var rise = sprite.transform.localPosition.y;
            return stand.TransformPoint(new Vector3(0, HeadTop + (rise > 0.08f ? rise : 0), 0));
        }

        public static RemoteBud Spawn(LivePlayerDto data, BudSheet placeholder, Transform parent, Func<string, Facing, Sprite> rideArt)
        {
            var go = new GameObject("Remote " + data.id);
            go.transform.SetParent(parent, false);
            var at = new Vector2(data.x, data.y);
            go.transform.position = at;
            var bud = go.AddComponent<RemoteBud>();
            bud.Data = data;
            bud.sheet = placeholder;
            bud.rideArt = rideArt;
            bud.shownAt = bud.lastShown = at;
            WorldView.Shadow(go.transform, 0.9f);
            var visual = WorldView.StandCharacter(go.transform);
            var art = new GameObject("Sprite");
            art.transform.SetParent(visual, false);
            bud.body = art.AddComponent<SpriteRenderer>();
            bud.body.sprite = placeholder.Get(Facing.Down, 0);
            var ride = new GameObject("Ride");
            ride.transform.SetParent(visual, false);
            bud.rideSprite = ride.AddComponent<SpriteRenderer>();
            bud.rideSprite.enabled = false;
            CastShadow.Attach(go.transform, bud.body, visual);
            bud.track.Add(Time.time, at);
            return bud;
        }

        /// <summary>The bud's own sheet arrived: drawn with it from now on (the old one is freed if it was ours).</summary>
        public void SetSheet(BudSheet value, bool owned)
        {
            if (!this) return;
            if (ownsSheet) sheet?.Dispose();
            sheet = value;
            ownsSheet = owned;
        }

        /// <summary>Name, level or look changed (a "join" for a bud already here).</summary>
        public void SetInfo(LivePlayerDto p)
        {
            Data.name = p.name;
            Data.level = p.level;
            Data.look = p.look;
        }

        /// <summary>A snapshot from the room.</summary>
        public void Push(LivePlayerDto p)
        {
            Data.f = p.f;
            Data.m = p.m;
            Data.r = p.r ?? "";
            Data.s = p.s;
            Data.x = p.x;
            Data.y = p.y;
            track.Add(Time.time, new Vector2(p.x, p.y));
        }

        void Update()
        {
            if (track.Empty || sheet == null) return;
            shownAt = track.At(Time.time);
            var step = (shownAt - lastShown).magnitude;
            var speed = Time.deltaTime > 0 ? step / Time.deltaTime : 0;
            lastShown = shownAt;
            transform.position = new Vector3(shownAt.x, shownAt.y, 0);
            var (facing, right) = LiveProtocol.FacingOf(Data.f);
            var riding = !string.IsNullOrEmpty(Data.r);
            if (riding)
            {
                walk.Reset();
                var stance = Rides.RiderFacing(Data.r, facing);
                body.sprite = sheet.Get(stance, 0);
                body.flipX = stance == Facing.Side && right;
                body.transform.localPosition = new Vector3(0, Rides.Rise(Data.r), 0);
                var s = rideArt?.Invoke(Data.r, facing);
                rideSprite.enabled = s;
                if (s)
                {
                    rideSprite.sprite = s;
                    rideSprite.flipX = facing == Facing.Side && right;
                    rideSprite.sortingOrder = body.sortingOrder + (Rides.DrawnOverBud(Data.r, facing) ? 1 : -1);
                }
            }
            else
            {
                rideSprite.enabled = false;
                // the legs follow what the bud really covers here, not the flag: no running on the spot
                walk.Tick(Data.m ? Mathf.Max(speed, 0.5f) : speed, Time.deltaTime);
                body.sprite = sheet.Get(facing, walk.Frame);
                body.flipX = facing == Facing.Side && right;
                body.transform.localPosition = new Vector3(0, walk.Lift, 0);
            }
            body.sortingOrder = WorldView.SortOrderFor(shownAt.y);
            if (rideSprite.enabled)
                rideSprite.sortingOrder = body.sortingOrder + (Rides.DrawnOverBud(Data.r, facing) ? 1 : -1);
        }

        void OnDestroy()
        {
            if (ownsSheet) sheet?.Dispose();
            sheet = null;
        }
    }
}
