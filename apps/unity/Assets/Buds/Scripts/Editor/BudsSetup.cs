using System.IO;
using Buds.Core;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Buds.EditorTools
{
    /// <summary>
    /// Idempotent project configuration, runnable headless:
    /// Unity -batchmode -projectPath apps/unity -executeMethod Buds.EditorTools.BudsSetup.Configure -quit
    /// </summary>
    public static class BudsSetup
    {
        public const string ScenePath = "Assets/Buds/Scenes/Main.unity";
        const string RenderingDir = "Assets/Buds/Rendering";

        [MenuItem("Buds/Configure Project")]
        public static void Configure()
        {
            ConfigurePlayer();
            BudsIcons.Configure();
            ConfigureRendering();
            CreateMainScene();
            AssetDatabase.SaveAssets();
            Debug.Log("[BudsSetup] project configured");
        }

        /// <summary>The game is played in landscape only (either way round).</summary>
        public static void ConfigureOrientation()
        {
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.AutoRotation;
            PlayerSettings.allowedAutorotateToPortrait = false;
            PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
            PlayerSettings.allowedAutorotateToLandscapeLeft = true;
            PlayerSettings.allowedAutorotateToLandscapeRight = true;
        }

        static void ConfigurePlayer()
        {
            PlayerSettings.companyName = "Buds";
            PlayerSettings.productName = "Buds";
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, "com.buds.game");
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Standalone, "com.buds.game");
            ConfigureOrientation();
            // plain HTTP only for local development builds; production talks HTTPS
            PlayerSettings.insecureHttpOption = InsecureHttpOption.DevelopmentOnly;
            PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
            PlayerSettings.defaultScreenWidth = 1280;
            PlayerSettings.defaultScreenHeight = 720;
            PlayerSettings.resizableWindow = true;
            PlayerSettings.runInBackground = true;
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel26;

            // Input System only (the legacy Input Manager is not used anywhere)
            var settings = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/ProjectSettings.asset");
            if (settings.Length > 0)
            {
                var so = new SerializedObject(settings[0]);
                var prop = so.FindProperty("activeInputHandler");
                if (prop != null)
                {
                    prop.intValue = 1;
                    so.ApplyModifiedProperties();
                }
            }
        }

        static void ConfigureRendering()
        {
            Directory.CreateDirectory(RenderingDir);
            var rendererPath = $"{RenderingDir}/Renderer2D.asset";
            var pipelinePath = $"{RenderingDir}/URP-2D.asset";

            var renderer = AssetDatabase.LoadAssetAtPath<Renderer2DData>(rendererPath);
            if (!renderer)
            {
                // same steps as URP's "Create > Rendering > 2D Renderer" menu
                renderer = ScriptableObject.CreateInstance<Renderer2DData>();
                AssetDatabase.CreateAsset(renderer, rendererPath);
                ResourceReloader.ReloadAllNullIn(renderer, "Packages/com.unity.render-pipelines.universal");
                EditorUtility.SetDirty(renderer);
            }

            var pipeline = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(pipelinePath);
            if (!pipeline)
            {
                pipeline = UniversalRenderPipelineAsset.Create(renderer);
                AssetDatabase.CreateAsset(pipeline, pipelinePath);
            }

            GraphicsSettings.defaultRenderPipeline = pipeline;
            for (var i = 0; i < QualitySettings.names.Length; i++)
            {
                QualitySettings.SetQualityLevel(i, false);
                QualitySettings.renderPipeline = pipeline;
            }
        }

        static void CreateMainScene()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            var camGo = new GameObject("Main Camera") { tag = "MainCamera" };
            var cam = camGo.AddComponent<Camera>();
            cam.orthographic = true;
            cam.orthographicSize = 6;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color32(0x2d, 0x76, 0x38, 0xff);
            camGo.transform.position = new Vector3(0, 0, -10);
            camGo.AddComponent<FollowCamera>();

            new GameObject("Bootstrap").AddComponent<GameBootstrap>();

            Directory.CreateDirectory(Path.GetDirectoryName(ScenePath)!);
            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
        }
    }
}
