using MinglDingl.Engine.Features.Photos;

namespace MinglDingl.Engine.Features.Seek;

/// place: province, or "Ulaanbaatar". portrait: sealed (ThumbHash only). No name: a stranger in Seek is
/// nameless until a bond is made. hasChildren: they have children and chose to show it. faceProven: a
/// selfie of theirs matched their portraits.
public sealed record CandidateView(
    Guid AccountId, int Age, string Tier, string? Place, string? Oath, string? Bio, PortraitView? Portrait, bool HasChildren,
    bool FaceProven);

/// state: companion | rests (no candles left) | full (no free seat) | empty (no one tonight) | closed (Seek is off).
/// nextDawnAt: when the candles come back (the next Ulaanbaatar day). floor: yard / hall / highTable.
/// secondLook: a member may bring back the last person passed tonight (false when there is none or it is spent).
/// filtered: a member's filters are narrowing who comes.
public sealed record SeekView(
    string State, CandidateView? Candidate, int CandlesLeft, int CandlesPerDay, DateTimeOffset NextDawnAt, int SeatsUsed, int Seats,
    string Floor, bool SecondLook, bool Filtered);

/// open: the person may set filters (a member). Every field null means no filter. children: has | wants |
/// doesNotWant | welcomes (a partner's children) — it reads the stored answer, shown or not. faceProven:
/// only companions whose face is proven.
public sealed record SeekFilterView(bool Open, int? AgeMin, int? AgeMax, string? City, string? Oath, string? Children, string? Smoking,
    string? Drinking, bool FaceProven);

public sealed record SeekFilterRequest(
    [System.ComponentModel.DataAnnotations.Range(18, 99)] int? AgeMin,
    [System.ComponentModel.DataAnnotations.Range(18, 99)] int? AgeMax,
    [System.ComponentModel.DataAnnotations.StringLength(40)] string? City,
    [System.ComponentModel.DataAnnotations.StringLength(10)] string? Oath,
    [System.ComponentModel.DataAnnotations.StringLength(16)] string? Children,
    [System.ComponentModel.DataAnnotations.StringLength(16)] string? Smoking,
    [System.ComponentModel.DataAnnotations.StringLength(16)] string? Drinking,
    bool? FaceProven = null);
