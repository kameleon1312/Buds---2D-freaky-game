using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;
#if UNITY_ANDROID
using UnityEditor.Android;
#endif

namespace Buds.EditorTools
{
    /// <summary>
    /// The app icon (the bud in the lime cap) from Assets/Buds/buds: the default icon (Windows and the fallback) and,
    /// on Android, the adaptive icon (the face over a background layer). The generator's adaptive background was the stock Android grid,
    /// so the adaptive icon gets the Buds dark surface behind the face instead.
    /// </summary>
    public static class BudsIcons
    {
        const string Dir = "Assets/Buds/buds/android/";
        const string BackgroundPath = Dir + "ic_launcher_background_buds.png";
        static readonly Color32 Background = new(0x16, 0x18, 0x1f, 0xff); // surface-900

        [MenuItem("Buds/Configure App Icons")]
        public static void Configure()
        {
            var main = Load("playstore-icon.png");
            if (!main)
            {
                Debug.LogWarning($"[BudsIcons] no icon at {Dir}playstore-icon.png");
                return;
            }
            PlayerSettings.SetIcons(NamedBuildTarget.Unknown, new[] { main }, IconKind.Any);
#if UNITY_ANDROID
            // Android 8+ (the minimum) uses adaptive icons everywhere; Unity 6 has no legacy/round kinds any more
            var foreground = Load("mipmap-xxxhdpi/ic_launcher_foreground.png") ?? main;
            var background = BackgroundTexture();
            Set(AndroidPlatformIconKind.Adaptive, icon => icon.SetTextures(background, foreground));
#endif
            AssetDatabase.SaveAssets();
            Debug.Log("[BudsIcons] app icons set");
        }

        static Texture2D Load(string file) => AssetDatabase.LoadAssetAtPath<Texture2D>(Dir + file);

#if UNITY_ANDROID
        static void Set(PlatformIconKind kind, Action<PlatformIcon> fill)
        {
            var icons = PlayerSettings.GetPlatformIcons(NamedBuildTarget.Android, kind);
            foreach (var icon in icons) fill(icon);
            PlayerSettings.SetPlatformIcons(NamedBuildTarget.Android, kind, icons);
        }
#endif

        /// <summary>A plain dark square for the adaptive icon's background layer (created once).</summary>
        static Texture2D BackgroundTexture()
        {
            if (!File.Exists(BackgroundPath))
            {
                const int size = 432;
                var tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
                var pixels = new Color32[size * size];
                for (var i = 0; i < pixels.Length; i++) pixels[i] = Background;
                tex.SetPixels32(pixels);
                tex.Apply();
                File.WriteAllBytes(BackgroundPath, tex.EncodeToPNG());
                UnityEngine.Object.DestroyImmediate(tex);
                AssetDatabase.ImportAsset(BackgroundPath);
            }
            return AssetDatabase.LoadAssetAtPath<Texture2D>(BackgroundPath);
        }
    }
}
