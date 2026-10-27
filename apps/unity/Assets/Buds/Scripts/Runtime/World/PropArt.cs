using System;
using System.Collections.Generic;
using UnityEngine;

namespace Buds.World
{
    /// <summary>
    /// World prop sprites rendered from vector art by tools/export-world-art.ts into Resources/World, with each
    /// sprite's ground point (pivot) and whether it lies flat on the ground listed in props.json. The props a
    /// district uses are packed into one atlas, so hundreds of trees and houses draw in a handful of batches.
    /// </summary>
    public sealed class PropArt
    {
        [Serializable]
        public sealed class Entry
        {
            public string name;
            public float pivotX;
            public float pivotY;
            public bool flat;
            /// <summary>Blocked cells [width, depth]; the anchor is the middle of the bottom row.</summary>
            public int[] foot;
        }

        [Serializable]
        public sealed class Manifest
        {
            public int ppu;
            public Entry[] props;
        }

        const int MaxAtlas = 4096; // safe on every phone GPU

        readonly Dictionary<string, Sprite> sprites = new();
        readonly HashSet<string> flat = new();
        Texture2D atlas;

        public static Manifest Parse(string json) => JsonUtility.FromJson<Manifest>(json);

        public static Manifest LoadManifest()
        {
            var json = Resources.Load<TextAsset>("World/props");
            if (!json) throw new InvalidOperationException("Missing Resources/World/props.json — run tools/export-world-art.ts");
            return Parse(json.text);
        }

        /// <summary>Loads the named props (all of them when null) into one atlas.</summary>
        public static PropArt Load(ICollection<string> names = null)
        {
            var art = new PropArt();
            var manifest = LoadManifest();
            var entries = new List<Entry>();
            var textures = new List<Texture2D>();
            foreach (var e in manifest.props)
            {
                if (names != null && !names.Contains(e.name)) continue;
                var tex = Resources.Load<Texture2D>("World/" + e.name);
                if (!tex) continue;
                entries.Add(e);
                textures.Add(tex);
                if (e.flat) art.flat.Add(e.name);
            }
            if (textures.Count == 0) return art;

            var readable = textures.TrueForAll(t => t.isReadable);
            // PackTextures grows the atlas to what the props need (up to MaxAtlas): never a 4096² texture for a marker
            var atlas = art.atlas = new Texture2D(2, 2, TextureFormat.RGBA32, true) { name = "Props atlas" };
            var rects = readable ? atlas.PackTextures(textures.ToArray(), 4, MaxAtlas, true) : null;
            if (rects == null) Debug.LogWarning("Prop textures are not readable: drawing them without an atlas");
            atlas.filterMode = FilterMode.Trilinear;
            atlas.wrapMode = TextureWrapMode.Clamp;
            for (var i = 0; i < entries.Count; i++)
            {
                var e = entries[i];
                if (rects == null || rects[i].width <= 0)
                {
                    var t = textures[i];
                    art.sprites[e.name] = Sprite.Create(t, new Rect(0, 0, t.width, t.height), new Vector2(e.pivotX, e.pivotY),
                        manifest.ppu, 0, SpriteMeshType.FullRect);
                    continue;
                }
                var r = rects[i];
                var px = new Rect(r.x * atlas.width, r.y * atlas.height, r.width * atlas.width, r.height * atlas.height);
                // if everything didn't fit, PackTextures scaled sprites down: keep world sizes by lowering ppu too
                var shrink = px.width / textures[i].width;
                art.sprites[e.name] = Sprite.Create(atlas, px, new Vector2(e.pivotX, e.pivotY), manifest.ppu * shrink, 0,
                    SpriteMeshType.FullRect);
            }
            return art;
        }

        public Sprite Get(string name) => sprites.TryGetValue(name, out var s) ? s : null;

        /// <summary>Frees the atlas and its sprites (the owner's map is gone); the art must not be used after.</summary>
        public void Dispose()
        {
            foreach (var s in sprites.Values)
                if (s) UnityEngine.Object.Destroy(s);
            sprites.Clear();
            if (atlas) UnityEngine.Object.Destroy(atlas);
            atlas = null;
        }

        public bool IsFlat(string name) => flat.Contains(name);
    }
}
