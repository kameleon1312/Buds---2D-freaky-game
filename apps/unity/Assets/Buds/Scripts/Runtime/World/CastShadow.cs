using UnityEngine;
using UnityEngine.Rendering;

namespace Buds.World
{
    /// <summary>
    /// A character's own cast shadow: its current frame laid flat on the ground and stretched north-east the same way
    /// as the props' shadows (<see cref="WorldView.ShadowPoint"/>), so walkers, NPCs and opponents stand in the same sun.
    /// Rebuilt only when the frame, flip or pose changes; off indoors.
    /// </summary>
    public sealed class CastShadow : MonoBehaviour
    {
        SpriteRenderer source;
        Transform stand;
        Mesh mesh;
        MeshRenderer view;
        Material material;
        Sprite lastSprite;
        bool lastFlip;
        Vector3 lastScale, lastPosition;
        readonly Vector3[] corners = new Vector3[64];
        readonly Color[] colors = new Color[64];

        /// <summary>A frame's quad (vertices, uvs, triangles): sprites hand out new arrays on every call.</summary>
        static readonly System.Collections.Generic.Dictionary<Sprite, (Vector2[] v, Vector2[] uv, int[] t)> frames = new();

        static (Vector2[] v, Vector2[] uv, int[] t) Frame(Sprite s)
        {
            if (frames.TryGetValue(s, out var f)) return f;
            if (frames.Count > 512) frames.Clear(); // old sheets' frames
            return frames[s] = (s.vertices, s.uv, System.Array.ConvertAll(s.triangles, i => (int)i));
        }

        public static CastShadow Attach(Transform root, SpriteRenderer source, Transform stand)
        {
            var go = new GameObject("Cast shadow", typeof(MeshFilter), typeof(MeshRenderer));
            go.transform.SetParent(root, false);
            var shadow = go.AddComponent<CastShadow>();
            shadow.source = source;
            shadow.stand = stand;
            shadow.mesh = new Mesh { name = "Cast shadow" };
            shadow.mesh.MarkDynamic();
            go.GetComponent<MeshFilter>().sharedMesh = shadow.mesh;
            shadow.view = go.GetComponent<MeshRenderer>();
            shadow.view.sortingOrder = -97;
            shadow.view.shadowCastingMode = ShadowCastingMode.Off;
            return shadow;
        }

        void LateUpdate()
        {
            var sprite = source ? source.sprite : null;
            var on = sprite && WorldView.Sunlit && source.enabled && source.gameObject.activeInHierarchy;
            view.enabled = on;
            if (!on) return;
            var t = source.transform;
            if (sprite == lastSprite && source.flipX == lastFlip && t.localScale == lastScale && t.localPosition == lastPosition) return;
            if (!material || material.mainTexture != sprite.texture)
            {
                if (material) Destroy(material);
                material = new Material(source.sharedMaterial) { name = "Cast shadow", mainTexture = sprite.texture };
                view.sharedMaterial = material;
            }
            lastSprite = sprite;
            lastFlip = source.flipX;
            lastScale = t.localScale;
            lastPosition = t.localPosition;

            var (verts, uv, tris) = Frame(sprite);
            var count = Mathf.Min(verts.Length, corners.Length);
            for (var i = 0; i < count; i++)
            {
                var v = verts[i];
                if (source.flipX) v.x = -v.x;
                // the frame's point as it stands (pose and character scale), then laid on the ground
                var p = Vector2.Scale(Vector2.Scale(v, t.localScale) + (Vector2)t.localPosition, stand.localScale);
                corners[i] = WorldView.ShadowPoint(p);
                colors[i] = WorldView.ShadowColor;
            }
            mesh.Clear();
            mesh.SetVertices(corners, 0, count);
            mesh.SetUVs(0, uv, 0, count);
            mesh.SetColors(colors, 0, count);
            mesh.SetTriangles(tris, 0);
            mesh.RecalculateBounds();
        }

        void OnDestroy()
        {
            if (material) Destroy(material);
            if (mesh) Destroy(mesh);
        }
    }
}
