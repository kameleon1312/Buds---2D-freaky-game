using Buds.World;
using UnityEngine;

namespace Buds.Characters
{
    /// <summary>
    /// How any character in a fight moves its body on top of what it is doing anyway (walking, standing, riding): a
    /// short lunge into a blow, a flinch and a flash when hit, a fall flat on the ground on a knockout and getting up
    /// again, stars circling a stunned head, a shield's ring at the feet, tints for slowed, weakened and blinded. Works
    /// on the standing "Visual" (its rotation and offset) and the body sprite's colour only, so the walking legs, the
    /// breathing and the ride keep working underneath. Attached by the fight to the bud, other buds and opponents.
    /// </summary>
    public sealed class CombatPose : MonoBehaviour
    {
        Transform visual;
        SpriteRenderer body;
        Quaternion standing;
        Vector3 rest;

        float lungeAt = -99, lungeFor = 0.16f;
        Vector2 lungeDir;
        float lungeReach;
        float hitAt = -99;
        Vector2 hitDir;
        bool down;
        float downAt = -99, upAt = -99;
        float stunUntil, shieldUntil, slowUntil, weakUntil, blindUntil, dodgeUntil;
        /// <summary>Which way the body falls (+1 to the right, −1 to the left): away from the last blow.</summary>
        float fallSide = 1;
        float castAt = -99, castFor;

        Transform stars;
        SpriteRenderer[] starSprites;
        SpriteRenderer shieldRing;
        static Sprite starSprite, ringSprite;

        /// <summary>The fight's pose for a character with this standing visual and body sprite (created once).</summary>
        public static CombatPose For(GameObject root, Transform visual, SpriteRenderer body)
        {
            var pose = root.GetComponent<CombatPose>();
            if (!pose) pose = root.AddComponent<CombatPose>();
            if (pose.visual != visual)
            {
                pose.visual = visual;
                pose.body = body;
                pose.standing = visual.localRotation;
                pose.rest = visual.localPosition;
            }
            return pose;
        }

        public bool IsDown => down;

        /// <summary>How much of the body shows (a beaten opponent fading away sets it); the pose's tints keep it.</summary>
        public float Presence { get; set; } = 1;

        /// <summary>A blow thrown towards a direction (world XY): the body leans into it for a moment.</summary>
        public void Lunge(Vector2 dir, float reach = 0.22f, float seconds = 0.16f)
        {
            lungeDir = dir.sqrMagnitude > 1e-4f ? dir.normalized : Vector2.down;
            lungeReach = reach;
            lungeFor = Mathf.Max(0.08f, seconds);
            lungeAt = Time.time;
        }

        /// <summary>Winding up a slow blow (ms): the body draws back, then the lunge lets it go.</summary>
        public void WindUp(Vector2 dir, float seconds)
        {
            if (seconds < 0.15f) return;
            lungeDir = dir.sqrMagnitude > 1e-4f ? dir.normalized : Vector2.down;
            castAt = Time.time;
            castFor = seconds;
        }

        /// <summary>Hit from a direction (where the blow came from): a flinch away from it and a bright flash.</summary>
        public void Hit(Vector2 from)
        {
            hitDir = from.sqrMagnitude > 1e-4f ? -from.normalized : Vector2.up;
            hitAt = Time.time;
            if (Mathf.Abs(hitDir.x) > 0.05f) fallSide = Mathf.Sign(hitDir.x);
        }

        /// <summary>Knocked out: falls flat on the ground (and stays there until <see cref="GetUp"/>).</summary>
        public void KnockDown()
        {
            if (down) return;
            down = true;
            downAt = Time.time;
            stunUntil = 0;
        }

        public void GetUp()
        {
            if (!down) return;
            down = false;
            upAt = Time.time;
        }

        /// <summary>A hold or an effect on the character for some seconds (brawl.ts statuses).</summary>
        public void Status(string kind, float seconds)
        {
            var until = Time.time + seconds;
            switch (kind)
            {
                case "stun": stunUntil = Mathf.Max(stunUntil, until); break;
                case "shield": shieldUntil = Mathf.Max(shieldUntil, until); break;
                case "unshield": shieldUntil = 0; break;
                case "slow": slowUntil = Mathf.Max(slowUntil, until); break;
                case "weak": weakUntil = Mathf.Max(weakUntil, until); break;
                case "blind": blindUntil = Mathf.Max(blindUntil, until); break;
                case "dodge": dodgeUntil = Mathf.Max(dodgeUntil, until); break;
            }
        }

        /// <summary>Everything off (a new map, standing up fresh).</summary>
        public void Clear()
        {
            down = false;
            stunUntil = shieldUntil = slowUntil = weakUntil = blindUntil = dodgeUntil = 0;
            hitAt = lungeAt = castAt = downAt = upAt = -99;
        }

        void LateUpdate()
        {
            if (!visual || !body) return;
            var t = Time.time;

            // lying down: from standing to flat on the ground, turned on its side away from the blow, so the whole body
            // shows lying there (the ground is the XY plane: no tilt = flat on it)
            var fall = down ? Ease(Mathf.Clamp01((t - downAt) / 0.32f)) : 1 - Ease(Mathf.Clamp01((t - upAt) / 0.4f));
            if (!down && t - upAt > 0.4f) fall = 0;
            var lying = Quaternion.Euler(0, 0, -90 * fallSide);
            var rotation = Quaternion.Slerp(standing, lying, fall);
            // a little bounce as it lands
            var land = down ? Mathf.Clamp01((t - downAt - 0.32f) / 0.18f) : 1;
            var bounce = land is > 0 and < 1 ? Mathf.Sin(land * Mathf.PI) * 0.06f : 0;

            // a lunge out and back; a wind-up draws back first
            var offset = Vector2.zero;
            var k = (t - lungeAt) / lungeFor;
            if (k is >= 0 and < 1) offset += lungeDir * (lungeReach * Mathf.Sin(k * Mathf.PI));
            var w = (t - castAt) / castFor;
            if (w is >= 0 and < 1 && lungeAt < castAt) offset -= lungeDir * (0.1f * Ease(w));
            // a flinch: knocked back a little, a quick shake
            var h = (t - hitAt) / 0.2f;
            if (h is >= 0 and < 1) offset += hitDir * (0.12f * (1 - h)) + new Vector2(Mathf.Sin(h * 60) * 0.03f * (1 - h), 0);
            // stunned: a wobble
            if (t < stunUntil && !down) rotation *= Quaternion.Euler(0, 0, Mathf.Sin(t * 9) * 5);
            visual.localRotation = rotation;
            visual.localPosition = rest + new Vector3(offset.x, offset.y, -bounce);

            // colour: the flash of a blow over everything, then the effects' tints
            var c = Color.white;
            if (t < slowUntil) c *= new Color(0.78f, 0.9f, 1.15f);
            if (t < weakUntil) c *= new Color(0.85f, 0.8f, 0.92f);
            if (t < blindUntil) c *= new Color(1.1f, 0.82f, 0.95f);
            if (down) c *= new Color(0.72f, 0.72f, 0.76f);
            var flash = h is >= 0 and < 1 ? 1 - h : 0;
            c = Color.Lerp(c, new Color(1f, 0.42f, 0.38f), flash * 0.85f);
            c.a = (t < dodgeUntil ? 0.55f : 1) * Presence;
            body.color = c;

            UpdateStars(t);
            UpdateShield(t);
        }

        static float Ease(float x) => 1 - (1 - x) * (1 - x);

        void UpdateStars(float t)
        {
            var on = t < stunUntil && !down;
            if (!on)
            {
                if (stars) stars.gameObject.SetActive(false);
                return;
            }
            if (!stars)
            {
                starSprite ??= LoadStar();
                stars = new GameObject("Stun").transform;
                stars.SetParent(visual, false);
                starSprites = new SpriteRenderer[3];
                for (var i = 0; i < 3; i++)
                {
                    var s = new GameObject("Star").AddComponent<SpriteRenderer>();
                    s.transform.SetParent(stars, false);
                    s.sprite = starSprite;
                    s.color = UI.UiKit.Gold400;
                    starSprites[i] = s;
                }
            }
            stars.gameObject.SetActive(true);
            stars.localPosition = new Vector3(0, 1.08f, 0);
            for (var i = 0; i < 3; i++)
            {
                var a = t * 5.5f + i * Mathf.PI * 2 / 3;
                var s = starSprites[i];
                s.transform.localPosition = new Vector3(Mathf.Cos(a) * 0.32f, Mathf.Sin(a) * 0.09f, 0);
                s.transform.localScale = Vector3.one * (0.16f + Mathf.Sin(a) * 0.03f);
                s.sortingOrder = body.sortingOrder + (Mathf.Sin(a) < 0 ? 2 : -1);
            }
        }

        void UpdateShield(float t)
        {
            var on = t < shieldUntil && !down;
            if (!on)
            {
                if (shieldRing) shieldRing.gameObject.SetActive(false);
                return;
            }
            if (!shieldRing)
            {
                ringSprite ??= MakeRing();
                shieldRing = new GameObject("Shield").AddComponent<SpriteRenderer>();
                shieldRing.transform.SetParent(transform, false);
                shieldRing.sprite = ringSprite;
            }
            shieldRing.gameObject.SetActive(true);
            var pulse = 1 + Mathf.Sin(t * 6) * 0.04f;
            shieldRing.transform.localPosition = new Vector3(0, 0.05f, -0.01f);
            shieldRing.transform.localScale = new Vector3(1.25f, 0.9f, 1) * pulse;
            var left = shieldUntil - t;
            shieldRing.color = new Color(UI.UiKit.Rep400.r, UI.UiKit.Rep400.g, UI.UiKit.Rep400.b, left < 0.5f ? left * 1.6f : 0.85f);
            shieldRing.sortingOrder = -92;
        }

        static Sprite LoadStar()
        {
            var tex = Resources.Load<Texture2D>("Ui/Fx/fx-star");
            return tex ? Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f), tex.width) : null;
        }

        /// <summary>A ring with a soft inner glow (the shield at the feet), drawn once.</summary>
        static Sprite MakeRing()
        {
            const int size = 128;
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp };
            var px = new Color32[size * size];
            for (var y = 0; y < size; y++)
            for (var x = 0; x < size; x++)
            {
                var d = Vector2.Distance(new Vector2(x + 0.5f, y + 0.5f), new Vector2(size / 2f, size / 2f)) / (size / 2f);
                var edge = Mathf.Clamp01(1 - Mathf.Abs(d - 0.9f) / 0.07f);
                var glow = d < 0.9f ? Mathf.Pow(d / 0.9f, 3) * 0.35f : 0;
                var a = Mathf.Max(edge, glow);
                px[y * size + x] = new Color32(255, 255, 255, (byte)(a * 255));
            }
            tex.SetPixels32(px);
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), size);
        }

        void OnDestroy()
        {
            if (body) body.color = Color.white;
        }
    }
}
