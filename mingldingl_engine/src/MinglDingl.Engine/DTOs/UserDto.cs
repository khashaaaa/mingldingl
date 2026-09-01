using System.ComponentModel.DataAnnotations;

public record CreateUserRequest(
    [Required, MaxLength(FieldLimits.DisplayName)] string DisplayName,
    [Range(FieldLimits.MinAge, FieldLimits.MaxAge)] int Age,
    [Required, MaxLength(FieldLimits.ShortLabel)] string Gender,
    [Required, MaxLength(FieldLimits.ShortLabel)] string City,
    [Required, MaxLength(FieldLimits.Bio)] string Bio,
    [MaxLength(FieldLimits.MaxPhotos)] List<string> PhotoUrls,
    [Range(-90, 90)] double? Latitude = null,
    [Range(-180, 180)] double? Longitude = null,
    [MaxLength(FieldLimits.Code)] string? ReferralCode = null);

public record UpdateLocationRequest(double Latitude, double Longitude);

public record UpdateLocationResponse(string City);

public record UpdateUserRequest(
    [MaxLength(FieldLimits.DisplayName)] string? DisplayName,
    [MaxLength(FieldLimits.Bio)] string? Bio,
    [MaxLength(FieldLimits.MaxPhotos)] List<string>? PhotoUrls,
    bool? HasKids,
    [MaxLength(FieldLimits.ShortLabel)] string? SmokingHabit,
    [MaxLength(FieldLimits.ShortLabel)] string? DrinkingHabit,
    [MaxLength(FieldLimits.ShortLabel)] string? Religion,
    [MaxLength(FieldLimits.ShortLabel)] string? Lifestyle,
    bool? PushEnabled = null,
    [Range(FieldLimits.MinAge, FieldLimits.MaxAge)] int? AgeMin = null,
    [Range(FieldLimits.MinAge, FieldLimits.MaxAge)] int? AgeMax = null,
    bool? IsPaused = null,
    [MaxLength(FieldLimits.ShortLabel)] string? City = null);

public record SwearOathRequest(
    [Required, MaxLength(FieldLimits.ShortLabel)] string Oath);

public record UserResponse(
    Guid Id,
    string DisplayName,
    int Age,
    string Gender,
    string City,
    string Bio,
    List<string> PhotoUrls,
    string MembershipLevel,
    bool IsProfileComplete,
    string? EquippedFrameId = null,
    string? EquippedTitleId = null,
    bool? HasKids = null,
    string? SmokingHabit = null,
    string? DrinkingHabit = null,
    string? Religion = null,
    string? Lifestyle = null,
    bool PushEnabled = true,
    int AgeMin = 18,
    int AgeMax = 99,
    bool IsPaused = false,
    string? PhoneNumber = null,
    string? ReferralCode = null,
    DroppedItem? ReferralRewardItem = null,
    string? Oath = null,
    bool OathProven = false,
    int? OathEncountersHeld = null,
    int? OathEncountersNeeded = null);

public record OwnedItemResponse(string ItemId, string NameKey, string Rarity, string ItemType, DateTime AcquiredAt, bool Equipped);

public record BlockedUserResponse(Guid UserId, string DisplayName, string? FirstPhoto, DateTime BlockedAt);

/// <summary>VerificationId proves ownership of the new number; without it the change is refused.</summary>
public record ChangePhoneRequest(
    [Required, MaxLength(FieldLimits.Phone)] string PhoneNumber,
    Guid? VerificationId = null);
