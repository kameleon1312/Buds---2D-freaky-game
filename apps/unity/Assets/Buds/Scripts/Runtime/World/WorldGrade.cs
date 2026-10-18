using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Buds.World
{
    /// <summary>
    /// The colour grade of the world, the same care the duel stage gets: a global post-processing volume with a mood
    /// per district (the city's warm afternoon, the forest's cool green, the tropics' saturated sun, the manor's gold,
    /// Los Karkos' dust, rooms under warm lamps). Every mood lifts contrast a little, tints the light warm and the shade
    /// cool and darkens the corners softly, so the map, the characters and the props sit in one light. The HUD is a
    /// screen overlay and stays exactly in its design-system colours.
    /// </summary>
    public static class WorldGrade
    {
        public sealed class Mood
        {
            public float Contrast;
            public float Saturation;
            public float Exposure;
            public Color Highlights = Color.white;
            public Color Shadows = Color.gray;
            public float Balance;
            public float Vignette;
        }

        /// <summary>The mood of a map: its district's, or the rooms' warm lamp light.</summary>
        public static Mood For(string districtId, bool interior)
        {
            if (interior)
                return new Mood { Contrast = 14, Saturation = 4, Highlights = Hex("#ffd6a0"), Shadows = Hex("#4a3a58"), Balance = -15, Vignette = 0.3f };
            return districtId switch
            {
                "dzika-puszcza" => new Mood
                    { Contrast = 17, Saturation = 6, Highlights = Hex("#f2ffd2"), Shadows = Hex("#28495c"), Balance = 10, Vignette = 0.3f },
                "las-palmas" or "wyspa-startowa" => new Mood
                    { Contrast = 13, Saturation = 14, Exposure = 0.05f, Highlights = Hex("#fff0c2"), Shadows = Hex("#22688c"), Balance = 15, Vignette = 0.22f },
                "dwor-carski" => new Mood
                    { Contrast = 15, Saturation = 4, Highlights = Hex("#ffe0a0"), Shadows = Hex("#55467c"), Balance = 0, Vignette = 0.28f },
                "los-karkos" => new Mood
                    { Contrast = 18, Saturation = -4, Highlights = Hex("#ffcc96"), Shadows = Hex("#4a3a5c"), Balance = -10, Vignette = 0.32f },
                _ => new Mood
                    { Contrast = 16, Saturation = 8, Highlights = Hex("#ffdcae"), Shadows = Hex("#465a8c"), Balance = 0, Vignette = 0.26f },
            };
        }

        static Volume volume;
        static ColorAdjustments adjust;
        static SplitToning split;
        static Vignette vignette;
        static Bloom bloom;

        /// <summary>Grades the camera's picture with the mood of this map (post-processing switched on).</summary>
        public static void Apply(Camera cam, WorldMap map)
        {
            if (!cam) return;
            var data = cam.GetUniversalAdditionalCameraData();
            if (data) data.renderPostProcessing = true;
            Ensure();
            var mood = For(map.DistrictId, map.IsInterior);
            adjust.contrast.value = mood.Contrast;
            adjust.saturation.value = mood.Saturation;
            adjust.postExposure.value = mood.Exposure;
            split.highlights.value = mood.Highlights;
            split.shadows.value = mood.Shadows;
            split.balance.value = mood.Balance;
            vignette.intensity.value = mood.Vignette;
        }

        static void Ensure()
        {
            if (volume) return;
            var go = new GameObject("World grade");
            Object.DontDestroyOnLoad(go);
            volume = go.AddComponent<Volume>();
            volume.isGlobal = true;
            volume.priority = 0;
            var profile = ScriptableObject.CreateInstance<VolumeProfile>();
            profile.name = "World grade";
            adjust = profile.Add<ColorAdjustments>(true);
            split = profile.Add<SplitToning>(true);
            vignette = profile.Add<Vignette>(true);
            vignette.smoothness.value = 0.45f;
            vignette.color.value = Hex("#141a2c");
            vignette.rounded.value = false;
            // a soft glow on lamps, windows and water highlights; phones skip it (it costs a full-screen blur)
            bloom = profile.Add<Bloom>(true);
            bloom.active = !UI.UiKit.Mobile;
            bloom.threshold.value = 0.92f;
            bloom.intensity.value = 0.22f;
            bloom.scatter.value = 0.6f;
            bloom.highQualityFiltering.value = false;
            volume.sharedProfile = profile;
        }

        static Color Hex(string hex) => ColorUtility.TryParseHtmlString(hex, out var c) ? c : Color.white;
    }
}
