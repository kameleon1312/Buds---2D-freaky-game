using UnityEngine;

namespace Buds.Core
{
    /// <summary>
    /// 2.5D camera: a perspective camera tilted by WorldView.Tilt, looking north across the flat ground, far enough
    /// away that about the same number of tiles shows on any screen (OrthoSizeFor). It follows a point on the ground
    /// smoothly and keeps that point inside the map. While building it rises over the plot instead (<see cref="Overview"/>):
    /// the same world, from higher up and more from above.
    /// </summary>
    [RequireComponent(typeof(Camera))]
    public sealed class FollowCamera : MonoBehaviour
    {
        /// <summary>At least this many tiles are visible along each axis.</summary>
        public const float TargetTilesX = 15f;
        public const float TargetTilesY = 12f;
        /// <summary>Phones: fewer tiles, so the bud and the world are big enough on a small screen.</summary>
        public const float CompactTilesX = 12f;
        public const float CompactTilesY = 8.5f;

        public Transform target;
        public Rect bounds; // world units
        public float smoothing = 10f;

        /// <summary>Vertical field of view: narrow, so the depth is gentle and the HUD-sized world stays readable.</summary>
        public const float FieldOfView = 36f;

        Camera cam;
        int lastW;
        int lastH;
        float size; // half the visible height on the ground at the focus, in tiles
        float distance;
        Vector3 focus;
        // what is shown now, easing towards the normal view or the overview
        float viewSize;
        float viewTilt = World.WorldView.Tilt;
        bool overview;
        Vector3 overviewAt;
        float overviewSize;
        float overviewTilt;

        void Awake()
        {
            cam = GetComponent<Camera>();
            cam.orthographic = false;
            cam.fieldOfView = FieldOfView;
            cam.nearClipPlane = 0.3f;
            cam.farClipPlane = 600f;
            transform.rotation = Quaternion.Euler(-World.WorldView.Tilt, 0, 0);
        }

        /// <summary>How far from its focus the camera sits so the view is 2·size tall there.</summary>
        public static float DistanceFor(float halfHeight, float fieldOfView) =>
            halfHeight / Mathf.Tan(fieldOfView * 0.5f * Mathf.Deg2Rad);

        /// <summary>The bud's feet, a bit north: the point the camera looks at (the bud stands up from its feet).</summary>
        Vector3 FocusOf(Vector3 target) => new(target.x, target.y + 0.6f, 0);

        void Place()
        {
            transform.rotation = Quaternion.Euler(-viewTilt, 0, 0);
            transform.position = focus + Shake() - transform.forward * DistanceFor(viewSize > 0 ? viewSize : size, FieldOfView);
        }

        /// <summary>Looks at a point of the ground from higher up: half the visible height, degrees from straight overhead.</summary>
        public void Overview(Vector3 at, float halfHeight, float tilt)
        {
            overview = true;
            overviewAt = at;
            overviewSize = halfHeight;
            overviewTilt = tilt;
        }

        /// <summary>Back to following the bud.</summary>
        public void EndOverview() => overview = false;

        /// <summary>The point of the flat ground under a point of the screen.</summary>
        public bool GroundAt(Vector2 screen, out Vector3 ground)
        {
            var ray = cam.ScreenPointToRay(screen);
            ground = default;
            if (!new Plane(Vector3.forward, Vector3.zero).Raycast(ray, out var along)) return false;
            ground = ray.GetPoint(along);
            return true;
        }

        /// <summary>How hard the view shakes now (0…1): a blow lands, it fades in a fraction of a second.</summary>
        float trauma;

        /// <summary>A blow that shakes the view (a critical hit, a knockout); small ones barely move it.</summary>
        public void Kick(float amount)
        {
            trauma = Mathf.Clamp01(Mathf.Max(trauma, amount));
        }

        Vector3 Shake()
        {
            if (trauma <= 0) return Vector3.zero;
            var t = Time.unscaledTime * 38f;
            var k = trauma * trauma * 0.16f;
            return new Vector3((Mathf.PerlinNoise(t, 0.3f) - 0.5f) * 2 * k, (Mathf.PerlinNoise(0.7f, t) - 0.5f) * 2 * k, 0);
        }

        /// <summary>Half the visible height in tiles so that both target extents fit.</summary>
        public static float OrthoSizeFor(int screenW, int screenH, bool compact = false) =>
            Mathf.Max((compact ? CompactTilesY : TargetTilesY) / 2f,
                (compact ? CompactTilesX : TargetTilesX) / 2f * screenH / Mathf.Max(1, screenW));

        /// <summary>The world moved by <paramref name="by"/> (a new map became the origin): the view moves with it, unseen.</summary>
        public void Shift(Vector3 by)
        {
            focus += by;
            Place();
        }

        public void SnapToTarget()
        {
            Resize();
            if (!target) return;
            focus = Clamp(FocusOf(target.position));
            overview = false;
            viewSize = size;
            viewTilt = World.WorldView.Tilt;
            Place();
        }

        void Resize()
        {
            if (Screen.width == lastW && Screen.height == lastH) return;
            lastW = Screen.width;
            lastH = Screen.height;
            size = OrthoSizeFor(lastW, lastH, UI.UiKit.Mobile);
            distance = DistanceFor(size, FieldOfView);
        }

        void LateUpdate()
        {
            Resize();
            if (!target) return;
            var ease = 1 - Mathf.Exp(-(overview ? 5f : 7f) * Time.unscaledDeltaTime);
            if (viewSize <= 0) viewSize = size;
            viewSize = Mathf.Lerp(viewSize, overview ? overviewSize : size, ease);
            viewTilt = Mathf.Lerp(viewTilt, overview ? overviewTilt : World.WorldView.Tilt, ease);
            focus = overview
                ? Vector3.Lerp(focus, overviewAt, ease)
                : Vector3.Lerp(focus, Clamp(FocusOf(target.position)), 1 - Mathf.Exp(-smoothing * Time.deltaTime));
            trauma = Mathf.Max(0, trauma - Time.unscaledDeltaTime * 2.6f);
            Place();
        }

        Vector3 Clamp(Vector3 p)
        {
            if (bounds.width <= 0) return p;
            // the tilted view sees more ground than it is tall: keep the near (bottom) edge inside the map
            var halfH = size / Mathf.Cos(World.WorldView.Tilt * Mathf.Deg2Rad) * 0.85f;
            var halfW = size * cam.aspect;
            p.x = bounds.width > halfW * 2 ? Mathf.Clamp(p.x, bounds.xMin + halfW, bounds.xMax - halfW) : bounds.center.x;
            p.y = bounds.height > halfH * 2 ? Mathf.Clamp(p.y, bounds.yMin + halfH, bounds.yMax - halfH) : bounds.center.y;
            return p;
        }
    }
}
