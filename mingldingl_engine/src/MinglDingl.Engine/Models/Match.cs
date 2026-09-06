public class Match
{
    public Guid Id { get; set; }
    public Guid InitiatorId { get; set; }
    public User Initiator { get; set; } = null!;
    public Guid ReceiverId { get; set; }
    public User Receiver { get; set; } = null!;
    public string Status { get; set; } = "Active";
    public int MessageCount { get; set; }

    /// <summary>
    /// Per-side totals, because the reveal ladder must not be climbable alone. <see cref="MessageCount"/>
    /// stays the combined figure every other feature (quests, campaign, activity suggestions) reads.
    /// </summary>
    public int InitiatorMessageCount { get; set; }
    public int ReceiverMessageCount { get; set; }
    public int RevealLevel { get; set; }
    public bool IcebreakerComplete { get; set; }
    public bool VideoCallUnlocked { get; set; }

    /// <summary>
    /// True once anyone completed a video call on this match. Kept because it is the only marker
    /// pre-Flame-Rite matches carry — <see cref="CampaignService"/> still reads it for them — while
    /// who has actually been paid is tracked per participant below.
    /// </summary>
    public bool VideoRewardClaimed { get; set; }

    public bool InitiatorVideoRewardClaimed { get; set; }
    public bool ReceiverVideoRewardClaimed { get; set; }

    public Guid? FlameRiteProposedById { get; set; }
    public DateTime? FlameRiteProposedAt { get; set; }
    public DateTime? FlameRiteAcceptedAt { get; set; }

    public DateTime? FlameRiteCompletedAt { get; set; }

    public Guid? ShipId { get; set; }
    public DateTime? LastMessageAt { get; set; }
    public Guid? LastMessageSenderId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public bool IsParticipant(Guid userId) => InitiatorId == userId || ReceiverId == userId;

    public Guid OtherParticipant(Guid userId) => InitiatorId == userId ? ReceiverId : InitiatorId;
}
