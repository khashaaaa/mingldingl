using System.ComponentModel.DataAnnotations;
using MinglDingl.Engine.Features.Bonds;
using MinglDingl.Engine.Features.Photos;
using MinglDingl.Engine.Features.Profile;
using MinglDingl.Engine.Features.Score;

namespace MinglDingl.Engine.Features.Admin;

public sealed record AdminLoginRequest([Required, StringLength(100)] string Username, [Required, StringLength(200)] string Password);
public sealed record AdminLoginResponse(string Token, DateTimeOffset ExpiresAt);

/// Tier, Points and Reputation are null until the person has a profile.
/// flagged: signed in on a device a removed or suspended character used (see the detail's flaggedWhy).
public sealed record AdminUserRow(Guid AccountId, string Phone, string? Name, string Status, int PhotoCount, DateTimeOffset CreatedAt,
    string? Tier, int? Points, int? Reputation, bool Flagged);
public sealed record AdminUserPage(IReadOnlyList<AdminUserRow> Items, string? NextCursor);

public sealed record AdminDevice(Guid Id, string DeviceName, DateTimeOffset CreatedAt, DateTimeOffset LastSeenAt, DateTimeOffset? RevokedAt);
public sealed record AdminUserDetail(
    Guid AccountId, string Phone, string Status, DateTimeOffset CreatedAt, int OnboardingStep,
    ProfileView? Profile, IReadOnlyList<PhotoView> Photos, IReadOnlyList<AdminDevice> Devices,
    int? Reputation, int ReportsAgainst, IReadOnlyList<AdminBondRow> Bonds, IReadOnlyList<DeedView> Deeds,
    AdminEncounters Encounters, DateTimeOffset? SuspendedAt, string? SuspendedWhy,
    DateTimeOffset? FlaggedAt, string? FlaggedWhy, bool UnderReview);

/// A removed character's number, barred from making another (see BarredNumber).
public sealed record AdminBarredRow(string Phone, string Why, DateTimeOffset CreatedAt);

/// Meetings on a person's record: kept, no-shows against them (recent = inside the window that
/// counts toward the reputation dock), and answers that disagreed.
public sealed record AdminEncounters(int Kept, int NoShows, int RecentNoShows, int Disputed);

public sealed record ConfigWriteRequest([Required, StringLength(200)] string Value);
