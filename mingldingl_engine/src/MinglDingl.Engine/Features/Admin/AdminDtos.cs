using System.ComponentModel.DataAnnotations;
using MinglDingl.Engine.Features.Bonds;
using MinglDingl.Engine.Features.Photos;
using MinglDingl.Engine.Features.Profile;
using MinglDingl.Engine.Features.Score;

namespace MinglDingl.Engine.Features.Admin;

public sealed record AdminLoginRequest([Required, StringLength(100)] string Username, [Required, StringLength(200)] string Password);
public sealed record AdminLoginResponse(string Token, DateTimeOffset ExpiresAt);

public sealed record AdminUserRow(Guid AccountId, string Phone, string? Name, string Status, int PhotoCount, DateTimeOffset CreatedAt);
public sealed record AdminUserPage(IReadOnlyList<AdminUserRow> Items, string? NextCursor);

public sealed record AdminDevice(Guid Id, string DeviceName, DateTimeOffset CreatedAt, DateTimeOffset LastSeenAt, DateTimeOffset? RevokedAt);
public sealed record AdminUserDetail(
    Guid AccountId, string Phone, string Status, DateTimeOffset CreatedAt, int OnboardingStep,
    ProfileView? Profile, IReadOnlyList<PhotoView> Photos, IReadOnlyList<AdminDevice> Devices,
    int? Reputation, int ReportsAgainst, IReadOnlyList<AdminBondRow> Bonds, IReadOnlyList<DeedView> Deeds,
    AdminEncounters Encounters);

/// Meetings on a person's record: kept, no-shows against them (recent = inside the window that
/// counts toward the reputation dock), and answers that disagreed.
public sealed record AdminEncounters(int Kept, int NoShows, int RecentNoShows, int Disputed);

public sealed record ConfigWriteRequest([Required, StringLength(200)] string Value);
