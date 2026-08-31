public record CreateUserRequest(
    string DisplayName,
    int Age,
    string Gender,
    string City,
    string Bio,
    List<string> PhotoUrls,
    double? Latitude = null,
    double? Longitude = null,
    string? ReferralCode = null);

public record UpdateLocationRequest(double Latitude, double Longitude);

public record UpdateLocationResponse(string City);

public record UpdateUserRequest(
    string? DisplayName,
    string? Bio,
    List<string>? PhotoUrls,
    bool? HasKids,
    string? SmokingHabit,
    string? DrinkingHabit,
    string? Religion,
    string? Lifestyle,
    bool? PushEnabled = null,
    int? AgeMin = null,
    int? AgeMax = null,
    bool? IsPaused = null,
    string? City = null);

public record SwearOathRequest(string Oath);

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

public record ChangePhoneRequest(string PhoneNumber);
