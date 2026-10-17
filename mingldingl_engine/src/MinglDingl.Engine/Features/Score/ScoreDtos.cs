namespace MinglDingl.Engine.Features.Score;

/// earned: points this return paid (0 when already counted today); seventh: the seven-dawns ceremony.
public sealed record DawnView(int Earned, int Streak, bool Seventh);

public sealed record DeedView(Guid Id, string Kind, int Amount, Guid? BondId, DateOnly Day, DateTimeOffset CreatedAt);

/// nextBefore: pass as `before` for the next page; null at the end.
public sealed record DeedPage(IReadOnlyList<DeedView> Items, DateTimeOffset? NextBefore);

/// candles: summons a day on reaching this tier (more come with points).
public sealed record TierView(string Name, int Points, int Candles);
