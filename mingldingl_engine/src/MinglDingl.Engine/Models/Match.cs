public class Match
{
    public Guid Id { get; set; }
    public Guid InitiatorId { get; set; }
    public User Initiator { get; set; } = null!;
    public Guid ReceiverId { get; set; }
    public User Receiver { get; set; } = null!;
    public string Status { get; set; } = "Active"; // Active|Ghosted|Unmatched
    public int MessageCount { get; set; }
    public int RevealLevel { get; set; }             // 0=none,1=basic,2=photos,3=district,4=deep
    public bool IcebreakerComplete { get; set; }
    public bool VideoCallUnlocked { get; set; }
    // Separate from VideoCallUnlocked on purpose: that flag is the durable
    // "this couple can video call" capability (set once, never revoked).
    // This one is the one-shot "has the completion reward already been paid
    // out" gate MarkComplete claims atomically — conflating the two would
    // permanently lock GetToken out after the first completed call.
    public bool VideoRewardClaimed { get; set; }
    // Set only for matches created by ShipService.RespondAsync when both
    // slots accept. Tags the match's origin for the chat header banner
    // ("Woven by ...") and exempts it from the DailyMatchesUsed budget —
    // see MatchesController.RequestMatch, which this bypasses entirely.
    public Guid? ShipId { get; set; }
    public DateTime? LastMessageAt { get; set; }
    public Guid? LastMessageSenderId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public bool IsParticipant(Guid userId) => InitiatorId == userId || ReceiverId == userId;

    public Guid OtherParticipant(Guid userId) => InitiatorId == userId ? ReceiverId : InitiatorId;
}
