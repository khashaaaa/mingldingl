/// <summary>
/// Length caps for free-text request fields. Before these existed, every string on the API was
/// bounded only by Kestrel's 30MB body limit and stored in an uncapped `text` column.
/// </summary>
public static class FieldLimits
{
    public const int Phone = 16;
    public const int Code = 16;
    public const int ShortLabel = 64;
    public const int DisplayName = 64;
    public const int Password = 256;
    public const int Url = 512;
    public const int PushToken = 256;
    public const int Title = 200;
    public const int Bio = 1000;
    public const int Review = 1000;
    public const int Reason = 1000;
    public const int MessageContent = 2000;
    public const int ConfigValue = 4000;
    public const int PageBody = 100_000;

    public const int MaxPhotos = 6;
    public const int MinAge = 18;
    public const int MaxAge = 99;
}
