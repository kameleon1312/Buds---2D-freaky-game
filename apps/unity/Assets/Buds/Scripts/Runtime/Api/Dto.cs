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
        // the finer details; a stored bud without them looks as it always did
        public int eyes;
        public string mark = "brak";
        public string glasses = "brak";
        public string print = "gladka";
        public string accessory = "brak";
        /// <summary>Trims, prints, hats and accessories: a colour of the top's palette; -1 picks one to go with the top.</summary>
        public int accent = -1;

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
        public OptionDto[] marks;
    }

    /// <summary>GET /v1/look/options: everything the creator offers (the lists live in packages/shared).</summary>
    [Serializable]
    public class LookOptionsDto
    {
        public OptionDto[] genders;
        public string[] skins;
        public string[] eyes;
        public OptionDto[] glasses;
        public OptionDto[] prints;
        public OptionDto[] accessories;
        public string[] accents;
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
    public class UpdateLookRequest
    {
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

    /// <summary>GET /v1/auth/config: where the game signs players in (public values).</summary>
    [Serializable]
    public class AuthConfigDto
    {
        /// <summary>The website (privacy, terms, the account page); empty on a local server.</summary>
        public string site;
        public bool enabled;
        public string url;
        public string publishableKey;
    }

    [Serializable]
    public class SignInRequest
    {
        public string email;
        public string password;
    }

    [Serializable]
    public class SignUpRequest
    {
        public string email;
        public string password;
        public bool consent;
    }

    /// <summary>Supabase Auth's answer to a password sign-in (only what the game needs).</summary>
    [Serializable]
    public class SupabaseSessionDto
    {
        public string access_token;
        public SupabaseUserDto user;
    }

    [Serializable]
    public class SupabaseUserDto
    {
        public string email;
    }

    [Serializable]
    public class SupabaseErrorDto
    {
        public string error_code;
        public string error;
        public string msg;
        public string error_description;
    }

    [Serializable]
    public class AccountBudDto
    {
        public BudDto bud;
        public int level;
    }

    [Serializable]
    public class AccountBudsDto
    {
        public AccountBudDto[] buds;
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
    public class PairCodeDto
    {
        public string code;
        public string expiresAt;
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
        public InfluenceDto influence;
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
        public InfluenceDto influence;
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
    public class ExploredMapDto
    {
        public string map;
        public string seen;
    }

    [Serializable]
    public class ExploredResponse
    {
        public ExploredMapDto[] maps;
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
        public InfluenceDto influence;
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
    public class FerryRequest
    {
        public string from;
        public string to;
    }

    /// <summary>A ferry ticket: the coins left, the fare paid and where the boat goes.</summary>
    [Serializable]
    public class FerryResponse
    {
        public int coins;
        public int fare;
        public string to;
        public string district;
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
        public InfluenceDto influence;
        public PvpResultDto pvp;
        public RaidResultDto raid;
    }

    [Serializable]
    public class RenameRequest
    {
        public string name;
    }

    [Serializable]
    public class DeleteBudRequest
    {
        public string confirm;
    }

    [Serializable]
    public class LogoutAllDto
    {
        public int signedOut;
    }

    /// <summary>The Ciosy screen (packages/shared loadout.ts movesView): the five buttons and what can go on each.</summary>
    [Serializable]
    public class MovesResponseDto
    {
        public string weapon;
        /// <summary>Five ability ids in button order ("" or null = an empty ultimate).</summary>
        public string[] kit;
        public MoveSlotDto[] slots;
        public int coins;
    }

    [Serializable]
    public class MoveSlotDto
    {
        public string name;
        public string kind;
        public MoveOptionDto[] options;
    }

    [Serializable]
    public class MoveOptionDto
    {
        public string id;
        public string name;
        public string icon;
        public string blurb;
        public string shape;
        /// <summary>What still opens it ("Poziom 7 · Walka 2"); empty when it is open.</summary>
        public string need;
        public int rank;
        public int power;
        /// <summary>The next upgrade; coins 0 = none left (JsonUtility turns a null into an empty object).</summary>
        public MoveNextDto next;
    }

    [Serializable]
    public class MoveNextDto
    {
        public int coins;
        public int level;
    }

    /// <summary>How a raid on a district ended for the raider (empty <c>plot</c>: not a raid).</summary>
    [Serializable]
    public class RaidResultDto
    {
        public string plot;
        public string district;
        public bool won;
        public Quests.LandResourcesDto loot;

        public bool Present => !string.IsNullOrEmpty(plot);
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
