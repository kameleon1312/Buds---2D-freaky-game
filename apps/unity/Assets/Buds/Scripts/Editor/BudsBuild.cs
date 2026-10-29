using System;
using System.IO;
using System.Linq;
using System.Net.NetworkInformation;
using System.Net.Sockets;
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
        public static void Windows()
        {
            BudsIcons.Configure();
            Build(BuildTarget.StandaloneWindows64, "Builds/Windows/Buds.exe", BuildOptions.Development);
        }

        /// <summary>Where a dev build looks for the API by default (Resources/Dev/api.txt, git-ignored).</summary>
        const string DevApiFile = "Assets/Buds/Resources/Dev/api.txt";

        /// <summary>
        /// Android dev build. By default it talks to the production API (PlayerSession.DefaultApiBaseUrl). BUDS_API_URL
        /// bakes in another server; BUDS_API_LOCAL=1 (pnpm phone --local) bakes in this PC's address on the home network
        /// (http://&lt;LAN IP&gt;:4000), since the phone can't reach "localhost". The pairing screen can still change it.
        /// </summary>
        [MenuItem("Buds/Build/Android APK (dev)")]
        public static void AndroidDev()
        {
            var api = Environment.GetEnvironmentVariable("BUDS_API_URL");
            if (string.IsNullOrWhiteSpace(api) && Environment.GetEnvironmentVariable("BUDS_API_LOCAL") == "1")
                api = LanIp() is { } ip ? $"http://{ip}:4000" : null;
            if (string.IsNullOrWhiteSpace(api))
            {
                // no baked-in address: the build uses the production default
                if (AssetDatabase.DeleteAsset(DevApiFile)) Debug.Log("[BudsBuild] dev API for the phone: production default");
            }
            else
            {
                Directory.CreateDirectory(Path.GetDirectoryName(DevApiFile)!);
                File.WriteAllText(DevApiFile, api.Trim().TrimEnd('/'));
                AssetDatabase.ImportAsset(DevApiFile);
                Debug.Log($"[BudsBuild] dev API for the phone: {api}");
            }
            BudsSetup.ConfigureOrientation();
            BudsIcons.Configure();
            Build(BuildTarget.Android, "Builds/Android/Buds-dev.apk", BuildOptions.Development);
        }

        /// <summary>
        /// The store build (docs/telefon.md): an Android App Bundle (.aab, what Google Play takes), IL2CPP for 64-bit ARM
        /// (Play requires 64-bit), the newest installed target SDK, no development flags, HTTPS only, the production
        /// API, quiet logs. Signed with the upload key from environment variables (never stored in the repo):
        /// BUDS_KEYSTORE (path to the .keystore), BUDS_KEYSTORE_PASS, BUDS_KEY_ALIAS, BUDS_KEY_PASS; the version from
        /// BUDS_VERSION (e.g. 1.0.0) and BUDS_VERSION_CODE (a whole number, higher with every upload).
        /// </summary>
        [MenuItem("Buds/Build/Android AAB (release)")]
        public static void AndroidRelease()
        {
            string Env(string name) => Environment.GetEnvironmentVariable(name)?.Trim();
            var keystore = Env("BUDS_KEYSTORE");
            if (string.IsNullOrEmpty(keystore) || !File.Exists(keystore) || string.IsNullOrEmpty(Env("BUDS_KEYSTORE_PASS")) ||
                string.IsNullOrEmpty(Env("BUDS_KEY_ALIAS")) || string.IsNullOrEmpty(Env("BUDS_KEY_PASS")))
            {
                Debug.LogError("[BudsBuild] release: set BUDS_KEYSTORE, BUDS_KEYSTORE_PASS, BUDS_KEY_ALIAS and BUDS_KEY_PASS (docs/telefon.md)");
                if (Application.isBatchMode) EditorApplication.Exit(1);
                return;
            }
            // a release never carries a development server address
            if (AssetDatabase.DeleteAsset(DevApiFile)) Debug.Log("[BudsBuild] release: the dev API file removed");
            BudsSetup.ConfigureOrientation();
            BudsIcons.Configure();

            var android = UnityEditor.Build.NamedBuildTarget.Android;
            PlayerSettings.SetScriptingBackend(android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.Android.targetSdkVersion = AndroidSdkVersions.AndroidApiLevelAuto;
            // low stripping: JsonUtility reads the DTOs' fields by reflection, nothing of them may be cut away
            PlayerSettings.SetManagedStrippingLevel(android, ManagedStrippingLevel.Low);
            PlayerSettings.SetStackTraceLogType(LogType.Log, StackTraceLogType.None);
            PlayerSettings.SetStackTraceLogType(LogType.Warning, StackTraceLogType.None);
            if (!string.IsNullOrEmpty(Env("BUDS_VERSION"))) PlayerSettings.bundleVersion = Env("BUDS_VERSION");
            if (int.TryParse(Env("BUDS_VERSION_CODE"), out var code) && code > 0) PlayerSettings.Android.bundleVersionCode = code;
            EditorUserBuildSettings.buildAppBundle = true;

            PlayerSettings.Android.useCustomKeystore = true;
            PlayerSettings.Android.keystoreName = keystore;
            PlayerSettings.Android.keystorePass = Env("BUDS_KEYSTORE_PASS");
            PlayerSettings.Android.keyaliasName = Env("BUDS_KEY_ALIAS");
            PlayerSettings.Android.keyaliasPass = Env("BUDS_KEY_PASS");
            try
            {
                Build(BuildTarget.Android, "Builds/Android/Buds.aab", BuildOptions.None);
            }
            finally
            {
                // the passwords never stay in the editor's settings
                PlayerSettings.Android.keystorePass = "";
                PlayerSettings.Android.keyaliasPass = "";
                PlayerSettings.Android.useCustomKeystore = false;
                EditorUserBuildSettings.buildAppBundle = false;
            }
        }

        /// <summary>The PC's IPv4 address on the local network (Wi-Fi or Ethernet), or null.</summary>
        static string LanIp()
        {
            var addresses = NetworkInterface.GetAllNetworkInterfaces()
                .Where(n => n.OperationalStatus == OperationalStatus.Up &&
                            n.NetworkInterfaceType != NetworkInterfaceType.Loopback &&
                            n.NetworkInterfaceType != NetworkInterfaceType.Tunnel &&
                            !n.Description.Contains("Virtual") && !n.Description.Contains("Hyper-V"))
                .Where(n => n.GetIPProperties().GatewayAddresses.Count > 0)
                .SelectMany(n => n.GetIPProperties().UnicastAddresses)
                .Select(a => a.Address)
                .Where(a => a.AddressFamily == AddressFamily.InterNetwork)
                .Select(a => a.ToString())
                .ToList();
            return addresses.FirstOrDefault(a => a.StartsWith("192.168.") || a.StartsWith("10.")) ?? addresses.FirstOrDefault();
        }

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
