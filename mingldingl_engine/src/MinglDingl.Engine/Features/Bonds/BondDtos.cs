using System.ComponentModel.DataAnnotations;
using MinglDingl.Engine.Features.Photos;
using MinglDingl.Engine.Kernel.Validation;

namespace MinglDingl.Engine.Features.Bonds;

public sealed record WriteLetterRequest([Required(AllowEmptyStrings = true), StringLength(FieldLimits.Letter)] string Text);

/// The other person as this bond lets you see them. place: their province (or Ulaanbaatar) until
/// the third seal, then the district. portraits: sealed ones carry only a ThumbHash. deep: their deep
/// profile, only after the fourth seal and only to a member (null otherwise, or when they left it empty).
public sealed record BondPersonView(
    Guid AccountId, string Name, int Age, string Tier, string? Oath, string? Bio, string? Place,
    IReadOnlyList<PortraitView> Portraits, Profile.DeepView? Deep);

/// state: Live | Cold | Severed | Faded. myTurn: the last letter is theirs. coldAt: when the bond
/// goes cold if the side whose turn it is stays silent (null with no letters). embers: the warning
/// is showing. nextSealAt: letters each that break the next seal (null when all four are broken).
/// sealLadder: letters each for each of the four seals.
public sealed record BondView(
    Guid Id, string State, BondPersonView Other, int Seals, int Mutual, int? NextSealAt, IReadOnlyList<int> SealLadder,
    int MyLetters, int TheirLetters, bool MyTurn, bool Embers, DateTimeOffset? ColdAt,
    DateTimeOffset CreatedAt, DateTimeOffset? ClosedAt, bool ClosedByMe, bool SummonedByMe, string? ClosedWhy);

/// A Quest Log row.
public sealed record BondRow(
    Guid Id, string State, Guid OtherId, string OtherName, PortraitView? OtherPortrait, int Seals,
    string? LastLetter, bool LastLetterMine, DateTimeOffset? LastLetterAt, bool MyTurn, bool Unread,
    bool Embers, DateTimeOffset? ColdAt, DateTimeOffset CreatedAt, DateTimeOffset? ClosedAt);

/// A bond as the keepers see it on a person's record.
public sealed record AdminBondRow(
    Guid Id, string State, Guid OtherId, string OtherName, int Seals, int Letters, int TheirLetters,
    DateTimeOffset? LastLetterAt, DateTimeOffset CreatedAt, DateTimeOffset? ClosedAt);

public sealed record LetterView(Guid Id, bool Mine, string Text, int? SealBroken, DateTimeOffset CreatedAt);

/// Newest first; nextBefore pages back in time.
public sealed record LetterPage(IReadOnlyList<LetterView> Items, DateTimeOffset? NextBefore);
