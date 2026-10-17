using MinglDingl.Engine.Features.Photos;

namespace MinglDingl.Engine.Features.Seek;

/// place: province, or "Ulaanbaatar". portrait: sealed (ThumbHash only).
public sealed record CandidateView(
    Guid AccountId, string Name, int Age, string Tier, string? Place, string? Oath, string? Bio, PortraitView? Portrait);

/// state: companion | rests (no candles left) | full (no free seat) | empty (no one tonight) | closed (Seek is off).
/// nextDawnAt: when the candles come back (the next Ulaanbaatar day). floor: yard / hall / highTable.
/// secondLook: the name a member may bring back tonight (null when there is none or it is spent).
/// filtered: a member's filters are narrowing who comes.
public sealed record SeekView(
    string State, CandidateView? Candidate, int CandlesLeft, int CandlesPerDay, DateTimeOffset NextDawnAt, int SeatsUsed, int Seats,
    string Floor, string? SecondLook, bool Filtered);

/// open: the person may set filters (a member). Every field null means no filter.
public sealed record SeekFilterView(bool Open, int? AgeMin, int? AgeMax, string? City, string? Oath, string? Children, string? Smoking,
    string? Drinking);

public sealed record SeekFilterRequest(
    [System.ComponentModel.DataAnnotations.Range(18, 99)] int? AgeMin,
    [System.ComponentModel.DataAnnotations.Range(18, 99)] int? AgeMax,
    [System.ComponentModel.DataAnnotations.StringLength(40)] string? City,
    [System.ComponentModel.DataAnnotations.StringLength(10)] string? Oath,
    [System.ComponentModel.DataAnnotations.StringLength(16)] string? Children,
    [System.ComponentModel.DataAnnotations.StringLength(16)] string? Smoking,
    [System.ComponentModel.DataAnnotations.StringLength(16)] string? Drinking);
