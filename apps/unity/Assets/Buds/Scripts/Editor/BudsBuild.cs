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
