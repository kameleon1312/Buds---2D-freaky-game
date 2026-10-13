using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace Buds.EditorTools
{
    /// <summary>
    /// Headless builds:
    /// Unity -batchmode -projectPath apps/unity -executeMethod Buds.EditorTools.BudsBuild.Windows -quit
    /// </summary>
    public static class BudsBuild
    {
        [MenuItem("Buds/Build/Windows (dev)")]
        public static void Windows() =>
            Build(BuildTarget.StandaloneWindows64, "Builds/Windows/Buds.exe", BuildOptions.Development);

        [MenuItem("Buds/Build/Android APK (dev)")]
        public static void AndroidDev() =>
            Build(BuildTarget.Android, "Builds/Android/Buds-dev.apk", BuildOptions.Development);

        static void Build(BuildTarget target, string path, BuildOptions options)
        {
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = new[] { BudsSetup.ScenePath },
                locationPathName = path,
                target = target,
                options = options,
            });
            var summary = report.summary;
            Debug.Log($"[BudsBuild] {target}: {summary.result}, {summary.totalErrors} errors, {summary.totalSize / 1024 / 1024} MB → {path}");
            if (Application.isBatchMode) EditorApplication.Exit(summary.result == BuildResult.Succeeded ? 0 : 1);
        }
    }
}
