using System.ComponentModel.DataAnnotations;
using MinglDingl.Engine.Kernel.Validation;

namespace MinglDingl.Engine.Features.Profile;

public sealed record CreateProfileRequest(
    [Required, StringLength(FieldLimits.Name)] string Name,
    DateOnly BirthDate,
    [Required, StringLength(2)] string Locale);

/// Partial: only the fields present change.
public sealed record UpdateProfileRequest(
    [StringLength(FieldLimits.Name)] string? Name,
    [StringLength(10)] string? Gender,
    [StringLength(FieldLimits.Bio)] string? Bio,
    [StringLength(40)] string? City,
    [StringLength(10)] string? Oath,
    [StringLength(2)] string? Locale,
    bool? Welcomed,
    bool? Paused = null);

public sealed record ProfileView(
    string Name, DateOnly BirthDate, int Age, string? Gender, string? Bio, string? City, string? Oath,
    DateTimeOffset? OathSwornAt, DateTimeOffset? OathProvenAt, string Locale, int Points, string Tier, string? TierUpPending, DateTimeOffset CreatedAt,
    bool Paused, DateTimeOffset? AwayUntil, DateTimeOffset? AwayNextAt);

/// onboardingStep: 1 name & age · 2 gender · 3 portraits · 4 about + city · 5 oath · 6 welcome · 7 in the world.
/// phoneHint: the first four digits of your sigil (the War Room shows "+976 8858 ····").
/// deleteAt: set while the character is abandoned and not yet burned.
public sealed record MeView(Guid AccountId, string Status, ProfileView? Profile, int OnboardingStep,
    string PhoneHint, DateTimeOffset? DeleteAt);

/// region: the province a centre belongs to, or "Ulaanbaatar" for the capital and its districts.
public sealed record CityView(string Name, string Kind, string Region, double Lat, double Lng);

/// photosMin/photosMax: the portrait counter in onboarding and edit ("2 of 3 needed · up to 6").
/// restMinutes: continuous use before "the fire burns low" (0: never). deleteDays: how long an
/// abandoned character waits before it is burned.
public sealed record AppStatusView(string MinVersion, bool Maintenance, int PhotosMin, int PhotosMax, int RestMinutes, int DeleteDays, int FinishedPoints);
