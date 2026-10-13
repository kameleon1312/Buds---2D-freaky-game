using System;
using System.Collections.Generic;
using UnityEngine;

namespace Buds.Quests
{
    public enum NpcMarker
    {
        None,
        Offer, // gold "!": has a quest for you
        TurnIn, // green "?": hand in a finished quest, or the next "talk" step is with this NPC
        Progress, // grey "…": gave you a quest that is still in progress
    }

    /// <summary>
    /// The player's quests: what is offered, what is in progress, and which steps are done. Plain class (no Unity
    /// objects) so the rules are tested in EditMode. Completion is final only when the server confirms it.
    /// </summary>
    public sealed class QuestLog
    {
        [Serializable]
        sealed class ActiveState
        {
            public string id;
            public int step;
            public List<int> collected = new();
        }

        [Serializable]
        sealed class SaveData
        {
            public List<ActiveState> active = new();
            public List<string> completed = new();
        }

        readonly QuestContent content;
        readonly List<ActiveState> active = new();
        public readonly HashSet<string> Completed = new();

        /// <summary>Current player level (for quests with a minimum level).</summary>
        public int Level { get; set; } = 1;

        public event Action Changed;

        public QuestLog(QuestContent content)
        {
            this.content = content;
        }

        public QuestContent Content => content;

        public IEnumerable<QuestData> Active
        {
            get
            {
                foreach (var a in active) yield return content.Quest(a.id);
            }
        }

        public bool IsActive(string questId) => active.Exists(a => a.id == questId);

        ActiveState State(string questId) => active.Find(a => a.id == questId);

        /// <summary>A quest this NPC can give you now (not done, not taken, requirements and level met).</summary>
        public QuestData OfferFrom(string npcId)
        {
            foreach (var q in content.quests)
                if (q.giver == npcId && CanTake(q)) return q;
            return null;
        }

        /// <summary>Quest from this NPC that is blocked only by level (to tell the player when to come back).</summary>
        public QuestData LockedByLevelAt(string npcId)
        {
            foreach (var q in content.quests)
                if (q.giver == npcId && !Completed.Contains(q.id) && !IsActive(q.id) && RequirementsMet(q) && Level < q.minLevel)
                    return q;
            return null;
        }

        public bool CanTake(QuestData q) =>
            !Completed.Contains(q.id) && !IsActive(q.id) && Level >= q.minLevel && RequirementsMet(q);

        bool RequirementsMet(QuestData q) => Array.TrueForAll(q.requires, r => Completed.Contains(r));

        public void Accept(string questId)
        {
            var q = content.Quest(questId);
            if (q == null || !CanTake(q)) return;
            active.Add(new ActiveState { id = questId });
            Changed?.Invoke();
        }

        public StepData CurrentStep(string questId)
        {
            var s = State(questId);
            var q = content.Quest(questId);
            return s != null && q != null && s.step < q.steps.Length ? q.steps[s.step] : null;
        }

        public bool IsReady(string questId)
        {
            var s = State(questId);
            return s != null && s.step >= content.Quest(questId).steps.Length;
        }

        /// <summary>A finished quest you can hand in to this NPC.</summary>
        public QuestData TurnInAt(string npcId)
        {
            foreach (var a in active)
            {
                var q = content.Quest(a.id);
                if (q.giver == npcId && IsReady(q.id)) return q;
            }
            return null;
        }

        /// <summary>Talking to an NPC who is the current "talk" step of an active quest: advances it, returns their line.</summary>
        public string TalkTo(string npcId)
        {
            foreach (var a in active)
            {
                var step = CurrentStep(a.id);
                if (step is not { kind: "talk" } || step.npc != npcId) continue;
                Advance(a);
                return step.text;
            }
            return null;
        }

        /// <summary>The player stands on (x, y) of `district`: completes any "reach" step whose area contains it.</summary>
        public bool Reach(string district, int x, int y)
        {
            var any = false;
            foreach (var a in active.ToArray())
            {
                var q = content.Quest(a.id);
                var step = CurrentStep(a.id);
                if (q.district != district || step is not { kind: "reach" }) continue;
                if (Mathf.Abs(x - step.x) > step.radius || Mathf.Abs(y - step.y) > step.radius) continue;
                Advance(a);
                any = true;
            }
            return any;
        }

        /// <summary>A duel was won: completes any "duel" step against this opponent.</summary>
        public bool Duel(string enemyId)
        {
            var any = false;
            foreach (var a in active.ToArray())
            {
                var step = CurrentStep(a.id);
                if (step is not { kind: "duel" } || step.enemy != enemyId) continue;
                Advance(a);
                any = true;
            }
            return any;
        }

        /// <summary>
        /// Has this bud finished the tutorial island? Yes after its final quest — and for buds that played before the
        /// island existed (they have quests from elsewhere).
        /// </summary>
        public bool TutorialDone(string island, string finalQuest)
        {
            if (Completed.Contains(finalQuest)) return true;
            foreach (var id in Completed)
            {
                var q = content.Quest(id);
                if (q != null && q.district != island) return true;
            }
            return false;
        }

        /// <summary>Items still lying around for active "collect" steps in this district.</summary>
        public IEnumerable<(QuestData quest, StepData step, int spot)> Pickups(string district)
        {
            foreach (var a in active)
            {
                var q = content.Quest(a.id);
                var step = CurrentStep(a.id);
                if (q.district != district || step is not { kind: "collect" }) continue;
                for (var i = 0; i < step.spots.Length; i++)
                    if (!a.collected.Contains(i)) yield return (q, step, i);
            }
        }

        public void Collect(string questId, int spot)
        {
            var a = State(questId);
            var step = CurrentStep(questId);
            if (a == null || step is not { kind: "collect" } || a.collected.Contains(spot)) return;
            a.collected.Add(spot);
            if (a.collected.Count >= step.spots.Length) Advance(a);
            else Changed?.Invoke();
        }

        /// <summary>The server confirmed the quest (or it was already done there): it leaves the active list.</summary>
        public void Complete(string questId)
        {
            active.RemoveAll(a => a.id == questId);
            Completed.Add(questId);
            Changed?.Invoke();
        }

        void Advance(ActiveState a)
        {
            a.step++;
            a.collected.Clear();
            Changed?.Invoke();
        }

        public NpcMarker MarkerFor(string npcId)
        {
            if (TurnInAt(npcId) != null) return NpcMarker.TurnIn;
            foreach (var a in active)
                if (CurrentStep(a.id) is { kind: "talk" } step && step.npc == npcId)
                    return NpcMarker.TurnIn;
            if (OfferFrom(npcId) != null) return NpcMarker.Offer;
            foreach (var a in active)
                if (content.Quest(a.id).giver == npcId)
                    return NpcMarker.Progress;
            return NpcMarker.None;
        }

        /// <summary>What to do next, for the quest tracker ("Zbierz: Pomidory 2/5").</summary>
        public string Objective(string questId)
        {
            var q = content.Quest(questId);
            var a = State(questId);
            if (q == null || a == null) return "";
            if (IsReady(questId)) return $"Wróć do: {content.Npc(q.giver)?.name ?? q.giver}";
            var step = q.steps[a.step];
            return step.kind switch
            {
                "talk" => $"Porozmawiaj: {content.Npc(step.npc)?.name ?? step.npc}",
                "reach" => $"Idź do: {step.label}",
                "collect" => $"Zbierz: {step.label} {a.collected.Count}/{step.spots.Length}",
                "duel" => step.label,
                _ => step.label ?? "",
            };
        }

        /// <summary>Where the current objective is (map cell), or null when it's not a single place.</summary>
        public (string district, int x, int y)? Target(string questId)
        {
            var q = content.Quest(questId);
            if (q == null || State(questId) == null) return null;
            if (IsReady(questId)) return NpcCell(q.giver);
            var step = CurrentStep(questId);
            return step.kind switch
            {
                "talk" => NpcCell(step.npc),
                "reach" => (q.district, step.x, step.y),
                "duel" => EnemyCell(step.enemy),
                _ => null,
            };
        }

        (string, int, int)? EnemyCell(string enemyId)
        {
            var e = content.Enemy(enemyId);
            return e == null || e.spots.Length == 0 ? null : (e.district, e.spots[0].x, e.spots[0].y);
        }

        (string, int, int)? NpcCell(string npcId)
        {
            var n = content.Npc(npcId);
            return n == null ? null : (n.district, n.x, n.y);
        }

        // ---------- saving (progress of active quests; completions too for guests) ----------

        public string Save(bool includeCompleted)
        {
            var data = new SaveData { active = new List<ActiveState>(active) };
            if (includeCompleted) data.completed.AddRange(Completed);
            return JsonUtility.ToJson(data);
        }

        public void Restore(string json)
        {
            if (string.IsNullOrEmpty(json)) return;
            SaveData data;
            try
            {
                data = JsonUtility.FromJson<SaveData>(json);
            }
            catch (ArgumentException)
            {
                return;
            }
            if (data == null) return;
            foreach (var c in data.completed) Completed.Add(c);
            foreach (var a in data.active)
            {
                var q = content.Quest(a.id);
                // drop quests that no longer exist or were completed meanwhile (e.g. on another device)
                if (q == null || Completed.Contains(a.id) || IsActive(a.id)) continue;
                a.step = Mathf.Clamp(a.step, 0, q.steps.Length);
                active.Add(a);
            }
            Changed?.Invoke();
        }
    }
}
