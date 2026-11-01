using UnityEngine;

namespace Buds.World
{
    /// <summary>
    /// Where the map screen's picture lies in its frame: how far it is zoomed in and where it has been dragged. Plain maths,
    /// tested in EditMode. Units are the frame's; (0, 0) is the frame's centre, y up. At zoom 1 the whole map fits.
    /// </summary>
    public sealed class MapView
    {
        public const float MaxZoom = 8f;
        readonly Vector2 frame;
        readonly Vector2 fit;

        public float Zoom { get; private set; } = 1;
        /// <summary>The picture's centre, from the frame's centre.</summary>
        public Vector2 Pan { get; private set; }
        public Vector2 PictureSize => fit * Zoom;

        public MapView(Vector2 frame, Vector2 fittedPicture)
        {
            this.frame = frame;
            fit = fittedPicture;
        }

        /// <summary>Zooms by a factor, keeping what lies under <paramref name="point"/> (frame units) where it is.</summary>
        public void ZoomAt(float factor, Vector2 point)
        {
            var next = Mathf.Clamp(Zoom * factor, 1, MaxZoom);
            var real = next / Zoom;
            Pan = point + (Pan - point) * real;
            Zoom = next;
            Keep();
        }

        public void PanBy(Vector2 by)
        {
            Pan += by;
            Keep();
        }

        /// <summary>Brings a point of the picture (from its centre, at zoom 1) to the middle of the frame.</summary>
        public void CentreOn(Vector2 onFit)
        {
            Pan = -onFit * Zoom;
            Keep();
        }

        /// <summary>The picture never leaves a gap it could cover; one smaller than the frame stays in the middle.</summary>
        void Keep()
        {
            var size = PictureSize;
            var room = (size - frame) / 2;
            Pan = new Vector2(
                room.x > 0 ? Mathf.Clamp(Pan.x, -room.x, room.x) : 0,
                room.y > 0 ? Mathf.Clamp(Pan.y, -room.y, room.y) : 0);
        }
    }
}
