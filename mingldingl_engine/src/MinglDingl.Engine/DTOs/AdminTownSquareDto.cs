// Support-lookup views of Town Square sessions/pairings — a stuck pairing
// (one side never joined, a round that never advanced) had nowhere to be
// seen from the admin dashboard otherwise.
public record AdminTownSquareSessionDto(
    Guid Id,
    string Status,
    DateTime RsvpOpensAt,
    DateTime RsvpClosesAt,
    DateTime ScheduledStartAt,
    int CurrentRoundNumber,
    int RsvpCount,
    DateTime CreatedAt);

public record AdminTownSquarePairingDto(
    Guid Id,
    int RoundNumber,
    Guid UserAId,
    string UserADisplayName,
    string UserAResponse,
    DateTime? UserAJoinedAt,
    Guid UserBId,
    string UserBDisplayName,
    string UserBResponse,
    DateTime? UserBJoinedAt,
    Guid? ResultingMatchId);
