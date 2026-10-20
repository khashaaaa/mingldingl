namespace MinglDingl.Engine.Kernel.Validation;

/// Every request field's length cap, in one place. Validation attributes on record DTOs go on
/// the constructor parameter, never `[property: ...]`.
public static class FieldLimits
{
    public const int Name = 40;
    public const int Bio = 300;
    public const int DeviceName = 80;
    public const int Phone = 8;
    public const int Code = 64;
    public const int SmsCode = 8;
    public const int Letter = 1000;
    public const int ReportNote = 1000;
    public const int PushToken = 200;
    public const int VenueName = 80;
    public const int VenueAddress = 160;
    public const int CodexTitle = 80;
    public const int CodexSummary = 120;
    public const int CodexBody = 8000;
    public const int VenueDescription = 400;
    public const int VenueHours = 60;
    public const int Icebreaker = 300;
    public const int AllyCode = 9;
    public const int GatheringName = 60;
}
