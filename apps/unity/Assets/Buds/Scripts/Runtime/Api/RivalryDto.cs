using System;

// Rywalizacja (packages/shared rivalry.ts, docs/rywalizacja.md). Field names mirror the API's JSON exactly.
// JsonUtility can't tell a null object from an empty one: check an id field (turf, slug, tag) before using one.
// ReSharper disable InconsistentNaming
namespace Buds.Api
{
    /// <summary>Influence an action earned in a turf this week; <c>turf</c> is empty outside turfs.</summary>
    [Serializable]
    public class InfluenceDto
    {
        public string turf;
        public string name;
        public int gained;
        public int total;
        public bool captured;

        public bool Present => !string.IsNullOrEmpty(turf);
    }

    /// <summary>How a PvP duel moved the rating; <c>opponent</c> is empty for duels with the district's people.</summary>
    [Serializable]
    public class PvpResultDto
    {
        public string opponent;
        public int rating;
        public int delta;
        public string league;
        public int paidLeft;

        public bool Present => !string.IsNullOrEmpty(opponent);
    }

    [Serializable]
    public class TurfOwnerDto
    {
        public string slug;
        public string name;
        public string crewTag;
        public int points;
    }

    [Serializable]
    public class TurfStateDto
    {
        public string id;
        public string name;
        public string district;
        public TurfOwnerDto owner;
        public int mine;
        public int rank; // 0 = no points this week (the API's null)
        public bool tributeReady;
        public int tribute;

        public bool HasOwner => owner != null && !string.IsNullOrEmpty(owner.slug);
    }

    /// <summary>GET /v1/rivalry/district/:id</summary>
    [Serializable]
    public class TurfsResponse
    {
        public string week;
        public string endsAt;
        public TurfStateDto[] turfs;
    }

    [Serializable]
    public class RuledTurfDto
    {
        public string id;
        public string name;
        public bool tributeReady;
        public int tribute;
    }

    [Serializable]
    public class TitleDto
    {
        public string week;
        public string title; // turf:<id> | top:<1..3>
    }

    [Serializable]
    public class CrewRefDto
    {
        public string tag;
        public string name;
    }

    [Serializable]
    public class ChallengeStandingDto
    {
        public string id;
        public string name;
        public int count;
        public int rank; // 0 = not on the board
    }

    /// <summary>GET /v1/rivalry/me</summary>
    [Serializable]
    public class RivalryMeResponse
    {
        public string week;
        public string endsAt;
        public int points;
        public int rank;
        public RuledTurfDto[] ruled;
        public TitleDto[] titles;
        public CrewRefDto crew;
        public int rating;
        public string league;
        public ChallengeStandingDto[] challenges;

        public bool InCrew => crew != null && !string.IsNullOrEmpty(crew.tag);
    }

    [Serializable]
    public class RankedBudDto
    {
        public string slug;
        public string name;
        public int level;
        public string crewTag;
        public int points;
    }

    [Serializable]
    public class RankedCrewDto
    {
        public string tag;
        public string name;
        public int points;
        public int members;
    }

    [Serializable]
    public class ChallengeLeaderDto
    {
        public string slug;
        public string name;
        public int count;
    }

    [Serializable]
    public class ChallengeBoardDto
    {
        public string id;
        public string name;
        public string unit;
        public ChallengeLeaderDto[] leaders;
    }

    [Serializable]
    public class PvpLeaderDto
    {
        public string slug;
        public string name;
        public int rating;
        public string league;
    }

    /// <summary>GET /v1/rivalry/ranking</summary>
    [Serializable]
    public class RankingResponse
    {
        public string week;
        public string endsAt;
        public RankedBudDto[] buds;
        public RankedCrewDto[] crews;
        public ChallengeBoardDto[] challenges;
        public PvpLeaderDto[] pvp;
    }

    [Serializable]
    public class TributeResponse
    {
        public string turf;
        public int coins;
        public int gained;
    }

    [Serializable]
    public class CrewMemberDto
    {
        public string slug;
        public string name;
        public int level;
        public string role; // leader | member
        public int points;
    }

    [Serializable]
    public class CrewDto
    {
        public string tag;
        public string name;
        public CrewMemberDto[] members;
        public int points;
    }

    [Serializable]
    public class CrewResponse
    {
        public CrewDto crew;

        public bool Present => crew != null && !string.IsNullOrEmpty(crew.tag);
    }

    [Serializable]
    public class CrewListResponse
    {
        public RankedCrewDto[] crews;
    }

    [Serializable]
    public class CreateCrewRequest
    {
        public string name;
        public string tag;
    }

    [Serializable]
    public class PvpOpponentDto
    {
        public string slug;
        public string name;
        public int level;
        public int rating;
        public string league;
        public string crewTag;
        public string weapon;
        public int wait; // seconds until they can be challenged again
    }

    /// <summary>GET /v1/pvp/opponents</summary>
    [Serializable]
    public class PvpOpponentsResponse
    {
        public int rating;
        public string league;
        public int wins;
        public int losses;
        public PvpOpponentDto[] opponents;
    }

    [Serializable]
    public class ListingSellerDto
    {
        public string slug;
        public string name;
    }

    [Serializable]
    public class ListingDto
    {
        public string id;
        public string itemId;
        public int price;
        public ListingSellerDto seller;
        public bool mine;
        public string createdAt;
    }

    /// <summary>GET /v1/market (and every market write answers with the fresh list)</summary>
    [Serializable]
    public class MarketResponse
    {
        public ListingDto[] listings;
        public int coins;
    }

    [Serializable]
    public class SellRequest
    {
        public string itemId;
        public int price;
    }
}
