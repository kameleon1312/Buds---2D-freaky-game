using UnityEditor;
using UnityEngine;

namespace Buds.EditorTools
{
    /// <summary>Textures under Assets/Buds import uncompressed; tiles stay crisp, character sheets smooth.</summary>
    public sealed class PixelArtImporter : AssetPostprocessor
    {
        // bump when the rules change so Unity reimports existing textures
        public override uint GetVersion() => 2;

        void OnPreprocessTexture()
        {
            if (!assetPath.StartsWith("Assets/Buds/")) return;
            var importer = (TextureImporter)assetImporter;
            importer.textureType = TextureImporterType.Default;
            importer.filterMode = FilterMode.Point;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.mipmapEnabled = false;
            importer.npotScale = TextureImporterNPOTScale.None;
            importer.alphaIsTransparency = true;
            importer.wrapMode = TextureWrapMode.Clamp;

            // character sheets and world props are smooth vector renders, not pixel art
            if (assetPath.StartsWith("Assets/Buds/Resources/Sheets/") || assetPath.StartsWith("Assets/Buds/Resources/World/"))
            {
                importer.filterMode = FilterMode.Trilinear;
                importer.mipmapEnabled = true;
            }
            // world props are packed into one atlas per district at runtime, which needs readable pixels
            if (assetPath.StartsWith("Assets/Buds/Resources/World/")) importer.isReadable = true;
        }
    }
}
