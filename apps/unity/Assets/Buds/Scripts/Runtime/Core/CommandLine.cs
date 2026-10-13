using System;

namespace Buds.Core
{
    /// <summary>Reads "-flag value" style arguments passed to the player (used by automated runs).</summary>
    public static class CommandLine
    {
        public static string Get(string flag)
        {
            var args = Environment.GetCommandLineArgs();
            for (var i = 0; i < args.Length - 1; i++)
            {
                if (string.Equals(args[i], flag, StringComparison.OrdinalIgnoreCase)) return args[i + 1];
            }
            return null;
        }

        public static bool Has(string flag) =>
            Array.Exists(Environment.GetCommandLineArgs(), a => string.Equals(a, flag, StringComparison.OrdinalIgnoreCase));
    }
}
