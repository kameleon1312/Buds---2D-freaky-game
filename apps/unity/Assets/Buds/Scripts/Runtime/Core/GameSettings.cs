using System;
using UnityEngine;

namespace Buds.Core
{
    /// <summary>
    /// The player's settings (Twój Bud → Profil → Ustawienia), kept on this device: smoothness (30 or 60 frames a
    /// second), the graphics (full, or a lighter look for weaker phones and longer battery: no screen grade and no
    /// small life around the bud), short vibrations on blows and the numbers over blows. Plain code with a key–value
    /// store behind it, so it is testable; <see cref="Current"/> is the game's own copy over PlayerPrefs.
    /// </summary>
    public sealed class GameSettings
    {
        public const string Prefix = "buds.settings.";

        public int FrameRate { get; private set; } = 60;
        public bool Economy { get; private set; }
        public bool Vibration { get; private set; } = true;
        public bool DamageNumbers { get; private set; } = true;

        /// <summary>Fires after any change (the game applies it at once).</summary>
        public event Action Changed;

        readonly Func<string, int, int> read;
        readonly Action<string, int> write;

        public GameSettings(Func<string, int, int> read, Action<string, int> write)
        {
            this.read = read;
            this.write = write;
            FrameRate = read(Prefix + "fps", 60) == 30 ? 30 : 60;
            Economy = read(Prefix + "economy", 0) == 1;
            Vibration = read(Prefix + "vibration", 1) == 1;
            DamageNumbers = read(Prefix + "numbers", 1) == 1;
        }

        static GameSettings current;

        /// <summary>The settings of this device (PlayerPrefs).</summary>
        public static GameSettings Current => current ??= new GameSettings(PlayerPrefs.GetInt, (k, v) =>
        {
            PlayerPrefs.SetInt(k, v);
            PlayerPrefs.Save();
        });

        public void SetFrameRate(int fps) => Set("fps", fps == 30 ? 30 : 60, () => FrameRate = fps == 30 ? 30 : 60);
        public void SetEconomy(bool on) => Set("economy", on ? 1 : 0, () => Economy = on);
        public void SetVibration(bool on) => Set("vibration", on ? 1 : 0, () => Vibration = on);
        public void SetDamageNumbers(bool on) => Set("numbers", on ? 1 : 0, () => DamageNumbers = on);

        void Set(string key, int value, Action apply)
        {
            apply();
            write(Prefix + key, value);
            Changed?.Invoke();
        }
    }

    /// <summary>
    /// Short vibrations (a blow taken, a knockout), only when the player wants them: a few dozen milliseconds through
    /// Android's vibrator; nothing on a computer.
    /// </summary>
    public static class Haptics
    {
        static AndroidJavaObject vibrator;
        static bool unavailable;

        public static void Tap(int milliseconds)
        {
            if (!GameSettings.Current.Vibration || unavailable) return;
#if UNITY_ANDROID && !UNITY_EDITOR
            try
            {
                if (vibrator == null)
                {
                    using var player = new AndroidJavaClass("com.unity3d.player.UnityPlayer");
                    using var activity = player.GetStatic<AndroidJavaObject>("currentActivity");
                    vibrator = activity.Call<AndroidJavaObject>("getSystemService", "vibrator");
                }
                vibrator?.Call("vibrate", (long)Mathf.Clamp(milliseconds, 5, 200));
            }
            catch (Exception)
            {
                // no vibrator, or the call is not allowed: the long built-in buzz is better than nothing once
                unavailable = true;
                Handheld.Vibrate();
            }
#endif
        }
    }
}
