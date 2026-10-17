using Buds.Api;
using UnityEngine;
using UnityEngine.UI;

namespace Buds.UI
{
    /// <summary>
    /// The only sign of talking to the server: a small spinning ring in the top-right corner, shown while a request is
    /// on its way for more than a moment (quick answers never flash it). It covers nothing and takes no taps.
    /// </summary>
    public sealed class NetSpinner : MonoBehaviour
    {
        const float ShowAfter = 0.3f;
        const float Size = 30;
        static Sprite arc;

        Image ring;
        Image track;
        float busySince = -1;
        float alpha;

        public static NetSpinner Create()
        {
            var canvas = UiKit.CreateCanvas("Net", 100);
            var safe = UiKit.Rect("Safe", canvas.transform);
            UiKit.Stretch(safe);
            safe.gameObject.AddComponent<SafeArea>();
            var spinner = canvas.gameObject.AddComponent<NetSpinner>();
            arc ??= MakeArc(48);
            spinner.track = UiKit.Panel("Track", safe, new Color(0.086f, 0.094f, 0.122f, 0));
            spinner.track.sprite = UiKit.Circle(24);
            UiKit.Place(spinner.track.rectTransform, Vector2.one, new Vector2(-6, -6), new Vector2(Size, Size), Vector2.one);
            spinner.ring = UiKit.Panel("Ring", spinner.track.rectTransform, new Color(UiKit.Buds400.r, UiKit.Buds400.g, UiKit.Buds400.b, 0));
            spinner.ring.sprite = arc;
            UiKit.Stretch(spinner.ring.rectTransform, 3);
            return spinner;
        }

        void Update()
        {
            var now = Time.unscaledTime;
            if (BudsApi.InFlight > 0)
            {
                if (busySince < 0) busySince = now;
            }
            else busySince = -1;
            var want = busySince >= 0 && now - busySince >= ShowAfter ? 1f : 0f;
            alpha = Mathf.MoveTowards(alpha, want, Time.unscaledDeltaTime * 6);
            track.color = new Color(0.086f, 0.094f, 0.122f, 0.75f * alpha);
            ring.color = new Color(UiKit.Buds400.r, UiKit.Buds400.g, UiKit.Buds400.b, alpha);
            if (alpha > 0) ring.rectTransform.localEulerAngles = new Vector3(0, 0, -now * 360);
        }

        /// <summary>A white three-quarter ring with soft edges (the spinning part).</summary>
        static Sprite MakeArc(int size)
        {
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear };
            var pixels = new Color32[size * size];
            var c = size / 2f;
            var outer = c - 1;
            var inner = c * 0.62f;
            for (var y = 0; y < size; y++)
            for (var x = 0; x < size; x++)
            {
                var dx = x + 0.5f - c;
                var dy = y + 0.5f - c;
                var d = Mathf.Sqrt(dx * dx + dy * dy);
                var edge = Mathf.Clamp01(outer - d) * Mathf.Clamp01(d - inner);
                var angle = Mathf.Repeat(Mathf.Atan2(dy, dx) * Mathf.Rad2Deg + 360, 360);
                // the gap fades in, so the ring looks like it chases its tail
                var arcAlpha = angle < 270 ? Mathf.Clamp01(angle / 60f) : 0;
                pixels[y * size + x] = new Color32(255, 255, 255, (byte)(edge * arcAlpha * 255));
            }
            tex.SetPixels32(pixels);
            tex.Apply();
            return Sprite.Create(tex, new UnityEngine.Rect(0, 0, size, size), new Vector2(0.5f, 0.5f));
        }
    }

    /// <summary>
    /// Keeps a canvas the right size either way round: landscape matches the height (the game), portrait matches the
    /// width (the sign-in screen, held upright for typing), so a UI unit is the same size on screen in both.
    /// </summary>
    public sealed class OrientationFit : MonoBehaviour
    {
        public float ShortSide = 720;
        CanvasScaler scaler;

        void Awake() => scaler = GetComponent<CanvasScaler>();

        void Update()
        {
            if (!scaler) return;
            var portrait = Screen.height > Screen.width;
            scaler.matchWidthOrHeight = portrait ? 0 : 1;
            scaler.referenceResolution = portrait ? new Vector2(ShortSide, 1280) : new Vector2(1280, ShortSide);
        }
    }
}
