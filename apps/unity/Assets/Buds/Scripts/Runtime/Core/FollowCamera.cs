using UnityEngine;

namespace Buds.Core
{
    /// <summary>
    /// 2.5D camera: a perspective camera tilted by WorldView.Tilt, looking north across the flat ground, far enough
    /// away that about the same number of tiles shows on any screen (OrthoSizeFor). It follows a point on the ground
    /// smoothly and keeps that point inside the map.
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

        void Place() => transform.position = focus + Shake() - transform.forward * distance;

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
            focus = Vector3.Lerp(focus, Clamp(FocusOf(target.position)), 1 - Mathf.Exp(-smoothing * Time.deltaTime));
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
