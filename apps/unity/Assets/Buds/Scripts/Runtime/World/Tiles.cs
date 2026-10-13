namespace Buds.World
{
    /// <summary>Map cell ids. Only collision and placement use them; the look comes from WorldView.</summary>
    public static class Tiles
    {
        public const int Empty = -1;
        public const int Grass = 0;
        public const int Grass2 = 1;
        public const int Flowers = 2;
        public const int Path = 3;
        public const int Water = 4;
        public const int TreeTrunk = 5;
        public const int TreeTop = 6;
        public const int Bush = 7;
        public const int Rock = 8;
        public const int Fence = 9;
        public const int Roof = 10;
        public const int RoofEave = 11;
        public const int Wall = 12;
        public const int Window = 13;
        public const int Door = 14;
        public const int Sign = 15;
        public const int Shore = 16;

        public const int Count = 17;
        public const int Size = 16;

        public static bool IsSolid(int tile) => tile switch
        {
            Water or TreeTrunk or Bush or Rock or Fence or Roof or RoofEave or Wall or Window or Door or Sign => true,
            _ => false,
        };
    }
}
