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
        public string pants = "jeansy";
        public int pantsColor;
        public string shoes = "trampki";
        public int shoesColor;

        public BudLookDto Clone() => (BudLookDto)MemberwiseClone();
    }

    [Serializable]
    public class OptionDto
    {
        public string id;
        public string label;
    }

    /// <summary>One body part's standard catalog for a gender: styles and colours.</summary>
    [Serializable]
    public class PartDto
    {
        public OptionDto[] styles;
        public string[] colors;
    }

    [Serializable]
    public class GenderOptionsDto
    {
        public string gender;
        public OptionDto[] moods;
        public PartDto hair;
        public PartDto top;
        public PartDto legs;
        public PartDto shoes;
    }

    /// <summary>GET /v1/look/options: everything the creator offers (the lists live in packages/shared).</summary>
    [Serializable]
    public class LookOptionsDto
    {
        public OptionDto[] genders;
        public string[] skins;
        public GenderOptionsDto[] byGender;

        public GenderOptionsDto For(string gender) => Array.Find(byGender ?? Array.Empty<GenderOptionsDto>(), g => g.gender == gender);
    }

    [Serializable]
    public class CreateBudRequest
    {
        public string name;
        public BudLookDto look;
    }

    [Serializable]
    public class CreateBudResponse
    {
        public BudDto bud;
        public string token;
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
        public int rank; // points spent
        public int trainingXp;
        public int trained; // ranks from training on top of the points

        public int Effective => rank + trained;
    }

    [Serializable]
    public class SkillsResponse
    {
        public int points;
        public int available;
        public SkillRankDto[] skills;
        public string[] perks;
    }

    [Serializable]
    public class TrainResponse
    {
        public string spotId;
        public string skill;
        public int xpGained;
        public int trainingXp;
        public int rank;
        public bool rankUp;
        public string[] perksUnlocked;
        public int cooldown;
    }

    [Serializable]
    public class OwnedConsumableDto
    {
        public string itemId;
        public int qty;
    }

    [Serializable]
    public class ActiveBuffDto
    {
        public string buff;
        public string until;
        public int secondsLeft;
    }

    [Serializable]
    public class ConsumablesResponse
    {
        public OwnedConsumableDto[] items;
        public ActiveBuffDto[] buffs;
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
        public string mount;

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
            Add("mount", mount);
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
        public int gems; // premium purchases
    }

    [Serializable]
    public class FighterStatusDto
    {
        public int blind;
        public int weaken;
        public bool aim;
        public bool secondWind;
    }

    [Serializable]
    public class FighterDto
    {
        public string name;
        public int level;
        public int maxHp;
        public int hp;
        public int attack;
        public int armor;
        public int speed;
        public int luck;
        public string weapon;
        public string weaponItem;
        public string[] moves;
        public string[] perks;
        public FighterStatusDto status;
    }

    [Serializable]
    public class FightDto
    {
        public string id;
        public string enemyId;
        public int turn;
        public string status; // active | won | lost | fled
        public FighterDto bud;
        public FighterDto enemy;
    }

    [Serializable]
    public class HitDto
    {
        public bool hit;
        public bool crit;
        public int damage;
    }

    [Serializable]
    public class TurnEventDto
    {
        public string actor; // bud | enemy
        public string move;
        public HitDto[] hits;
        public string effect; // guard | dodge | aim | blind | weaken | ""
        public int budHp;
        public int enemyHp;
        public SecondWindDto secondWind; // who == "" when it did not happen
    }

    [Serializable]
    public class SecondWindDto
    {
        public string who; // bud | enemy
        public int hp;
    }

    /// <summary>Only meaningful when the fight was won (JsonUtility can't tell a null object from an empty one).</summary>
    [Serializable]
    public class FightRewardDto
    {
        public int xpGained;
        public int xp;
        public int level;
        public bool levelUp;
        public int coinsGained;
        public int coins;
        public string item;
        public string drink; // an energy drink dropped with the loot
    }

    [Serializable]
    public class FightResponse
    {
        public FightDto fight;
        public TurnEventDto[] events;
        public FightRewardDto reward;
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
