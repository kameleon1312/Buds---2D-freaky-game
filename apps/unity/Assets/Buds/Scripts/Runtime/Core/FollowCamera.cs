using UnityEngine;

namespace Buds.Core
{
    /// <summary>
    /// Orthographic camera that shows about the same number of tiles on any screen (the art is smooth vector
    /// renders, so any zoom is fine), follows a target smoothly and stays inside the map.
    /// </summary>
    [RequireComponent(typeof(Camera))]
    public sealed class FollowCamera : MonoBehaviour
    {
        /// <summary>At least this many tiles are visible along each axis.</summary>
        public const float TargetTilesX = 14f;
        public const float TargetTilesY = 10.5f;

        public Transform target;
        public Rect bounds; // world units
        public float smoothing = 10f;

        Camera cam;
        int lastW;
        int lastH;

        void Awake()
        {
            cam = GetComponent<Camera>();
            cam.orthographic = true;
        }

        /// <summary>Half the visible height in tiles so that both target extents fit.</summary>
        public static float OrthoSizeFor(int screenW, int screenH) =>
            Mathf.Max(TargetTilesY / 2f, TargetTilesX / 2f * screenH / Mathf.Max(1, screenW));

        public void SnapToTarget()
        {
            Resize();
            if (target) transform.position = Clamp(new Vector3(target.position.x, target.position.y, -10));
        }

        void Resize()
        {
            if (Screen.width == lastW && Screen.height == lastH) return;
            lastW = Screen.width;
            lastH = Screen.height;
            cam.orthographicSize = OrthoSizeFor(lastW, lastH);
        }

        void LateUpdate()
        {
            Resize();
            if (!target) return;
            var goal = Clamp(new Vector3(target.position.x, target.position.y, -10));
            transform.position = Vector3.Lerp(transform.position, goal, 1 - Mathf.Exp(-smoothing * Time.deltaTime));
        }

        Vector3 Clamp(Vector3 p)
        {
            if (bounds.width <= 0) return p;
            var halfH = cam.orthographicSize;
            var halfW = halfH * cam.aspect;
            p.x = bounds.width > halfW * 2 ? Mathf.Clamp(p.x, bounds.xMin + halfW, bounds.xMax - halfW) : bounds.center.x;
            p.y = bounds.height > halfH * 2 ? Mathf.Clamp(p.y, bounds.yMin + halfH, bounds.yMax - halfH) : bounds.center.y;
            return p;
        }
    }
}
