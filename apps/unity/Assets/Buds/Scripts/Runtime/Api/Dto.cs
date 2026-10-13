using System;

// Field names mirror the API's JSON exactly (JsonUtility maps by name).
// ReSharper disable InconsistentNaming
namespace Buds.Api
{
    [Serializable]
    public class BudLookDto
    {
        public string gender;
        public string mood;
        public int skin;
        public string hair;
        public int hairColor;
        public string outfit;
        public int outfitColor;
        public int pantsColor;
    }

    [Serializable]
    public class BudDto
    {
        public string slug;
        public string name;
        public BudLookDto look;
        public int xp;
        public string createdAt;
    }

    [Serializable]
    public class BudResponse
    {
        public BudDto bud;
    }

    [Serializable]
    public class PairResponse
    {
        public BudDto bud;
        public string token;
    }

    [Serializable]
    public class PairRequest
    {
        public string code;
    }

    [Serializable]
    public class QuestsResponse
    {
        public string[] completed;
    }

    [Serializable]
    public class CompleteQuestResponse
    {
        public string questId;
        public int xpGained;
        public int xp;
        public int level;
        public bool levelUp;
        public string item;
    }

    [Serializable]
    public class OwnedItemDto
    {
        public string itemId;
        public string source;
        public string acquiredAt;
    }

    [Serializable]
    public class OwnedItemsResponse
    {
        public OwnedItemDto[] items;
    }

    [Serializable]
    public class SkillRankDto
    {
        public string id;
        public int rank;
    }

    [Serializable]
    public class SkillsResponse
    {
        public int points;
        public int available;
        public SkillRankDto[] skills;
    }

    [Serializable]
    public class WalletResponse
    {
        public int coins;
        public int gems;
    }

    [Serializable]
    public class CachesResponse
    {
        public string[] opened;
    }

    [Serializable]
    public class OpenCacheResponse
    {
        public string cacheId;
        public int coinsGained;
        public int coins;
        public int xpGained;
        public int xp;
        public int level;
        public bool levelUp;
    }

    /// <summary>Worn item per slot ("" or null = empty). Stats are recomputed in the game (Gear.Stats).</summary>
    [Serializable]
    public class EquipmentSlotsDto
    {
        public string head;
        public string face;
        public string torso;
        public string hands;
        public string legs;
        public string feet;
        public string accessory;
        public string held;

        public System.Collections.Generic.Dictionary<string, string> ToDictionary()
        {
            var d = new System.Collections.Generic.Dictionary<string, string>();
            void Add(string slot, string id)
            {
                if (!string.IsNullOrEmpty(id)) d[slot] = id;
            }
            Add("head", head);
            Add("face", face);
            Add("torso", torso);
            Add("hands", hands);
            Add("legs", legs);
            Add("feet", feet);
            Add("accessory", accessory);
            Add("held", held);
            return d;
        }
    }

    [Serializable]
    public class EquipmentResponse
    {
        public EquipmentSlotsDto slots;
    }

    [Serializable]
    public class BuyResponse
    {
        public string itemId;
        public int coins;
    }

    [Serializable]
    public class ApiErrorBody
    {
        public ApiErrorDetail error;
    }

    [Serializable]
    public class ApiErrorDetail
    {
        public string code;
        public string message;
    }
}
