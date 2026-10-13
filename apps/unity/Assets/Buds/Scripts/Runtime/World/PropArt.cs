using System;
using System.Collections.Generic;
using UnityEngine;

namespace Buds.World
{
    /// <summary>
    /// World prop sprites rendered from vector art by tools/export-world-art.ts into Resources/World,
    /// with each sprite's ground point (pivot) listed in props.json.
    /// </summary>
    public sealed class PropArt
    {
        [Serializable]
        public sealed class Entry
        {
            public string name;
            public float pivotX;
            public float pivotY;
        }

        [Serializable]
        public sealed class Manifest
        {
            public int ppu;
            public Entry[] props;
        }

        readonly Dictionary<string, Sprite> sprites = new();

        public static Manifest Parse(string json) => JsonUtility.FromJson<Manifest>(json);

        public static PropArt Load()
        {
            var art = new PropArt();
            var json = Resources.Load<TextAsset>("World/props");
            if (!json)
            {
                Debug.LogError("Missing Resources/World/props.json — run tools/export-world-art.ts");
                return art;
            }
            var manifest = Parse(json.text);
            foreach (var e in manifest.props)
            {
                var tex = Resources.Load<Texture2D>("World/" + e.name);
                if (!tex) continue;
                art.sprites[e.name] = Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height),
                    new Vector2(e.pivotX, e.pivotY), manifest.ppu, 0, SpriteMeshType.Tight);
            }
            return art;
        }

        public Sprite Get(string name) => sprites.TryGetValue(name, out var s) ? s : null;
    }
}
