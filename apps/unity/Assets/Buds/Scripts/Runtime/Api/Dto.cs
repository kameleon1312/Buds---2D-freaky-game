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
