using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Buds.UI
{
    /// <summary>
    /// The ferryman's timetable: every other harbour with its fare, the ones the bud can't sail to yet greyed out with
    /// the reason. One tap buys the ticket (the server takes the fare) and the boat leaves.
    /// </summary>
    public sealed class FerryScreen
    {
        public sealed class Trip
        {
            public string PortId;
            public string Label;
            public string Detail;
            public bool Open;
        }

        readonly GameObject root;
        readonly RectTransform list;
        readonly Text title;
        readonly Text status;
        readonly List<GameObject> rows = new();
        Action<string> onPick;
        bool busy;

        public bool IsOpen => root.activeSelf;

        public FerryScreen(Transform canvas)
        {
            var dim = UiKit.Panel("Ferry", canvas, new Color(0.086f, 0.094f, 0.122f, 0.72f));
            dim.raycastTarget = true;
            UiKit.Stretch(dim.rectTransform);
            root = dim.gameObject;
            var group = UiKit.Rect("Group", dim.transform);
            UiKit.Place(group, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(820, 600));
            group.gameObject.AddComponent<FitInParent>();
            var body = UiKit.Window("Window", group, new Vector2(780, 580), "Rejsy", Hide, out var window, out title);
            UiKit.Place(window, new Vector2(0.5f, 0.5f), Vector2.zero, window.sizeDelta);
            status = UiKit.Label("Status", body, "", 20, UiKit.InkSoft, false, TextAnchor.UpperLeft);
            UiKit.Place(status.rectTransform, new Vector2(0, 1), Vector2.zero, new Vector2(716, 56), new Vector2(0, 1));
            list = UiKit.Rect("List", body);
            UiKit.Stretch(list, 0, 0, 0, 66);
            root.SetActive(false);
        }

        public void Open(string harbour, string note, IReadOnlyList<Trip> trips, Action<string> pick)
        {
            onPick = pick;
            busy = false;
            title.text = harbour;
            status.text = note;
            status.color = UiKit.InkSoft;
            foreach (var r in rows) UnityEngine.Object.Destroy(r);
            rows.Clear();
            for (var i = 0; i < trips.Count; i++)
            {
                var t = trips[i];
                var card = UiKit.OutlinedBox("Trip " + t.PortId, list, t.Open ? UiKit.Paper300 : UiKit.Paper100, UiKit.RadiusM);
                var rt = (RectTransform)card.transform.parent;
                UiKit.Place(rt, new Vector2(0, 1), new Vector2(0, -i * 92), new Vector2(716, 82), new Vector2(0, 1));
                var label = UiKit.Label("Label", card.transform, t.Label, 25, t.Open ? UiKit.Ink : UiKit.InkSoft, true, TextAnchor.MiddleLeft);
                UiKit.Place(label.rectTransform, new Vector2(0, 0.5f), new Vector2(18, 10), new Vector2(460, 34), new Vector2(0, 0.5f));
                var detail = UiKit.Label("Detail", card.transform, t.Detail, 17, UiKit.InkSoft, false, TextAnchor.MiddleLeft);
                UiKit.Place(detail.rectTransform, new Vector2(0, 0.5f), new Vector2(18, -18), new Vector2(460, 24), new Vector2(0, 0.5f));
                if (t.Open)
                {
                    var id = t.PortId;
                    var go = UiKit.Button("Sail", card.transform, "Płyń", new Vector2(170, 58), () => Pick(id), UiKit.Tone.Gold, 26);
                    UiKit.Place((RectTransform)go.transform, new Vector2(1, 0.5f), new Vector2(-14, 3), new Vector2(170, 58), new Vector2(1, 0.5f));
                }
                rows.Add(rt.gameObject);
            }
            root.SetActive(true);
            root.transform.SetAsLastSibling();
        }

        void Pick(string portId)
        {
            if (busy) return;
            busy = true;
            status.text = "Kupujesz bilet…";
            onPick?.Invoke(portId);
        }

        /// <summary>The ticket didn't go through: says why and lets the bud pick again.</summary>
        public void Fail(string message)
        {
            busy = false;
            status.text = message;
            status.color = UiKit.Alert500;
        }

        public void Hide() => root.SetActive(false);
    }
}
