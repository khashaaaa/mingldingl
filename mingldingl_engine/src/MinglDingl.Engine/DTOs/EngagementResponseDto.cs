public record IcebreakerQuestionResponse(Guid Id, string QuestionText, string Type, List<string> Options);

// Awarded is this caller's real total for this call (0 unless BothResponded
// — the score only lands once both participants have answered), including
// any daily-quest bonus on top of the base IcebreakerDone amount.
public record IcebreakerRespondResult(bool BothResponded, int Awarded = 0, DroppedItem? DroppedItem = null);

public record IcebreakerRevealEntry(Guid UserId, string Answer);

// Lets the client ask "have I already answered this icebreaker for this
// match" without relying on local mutation state — see QuizStatusResponse
// below for the identical reasoning; icebreaker just didn't have this until
// the waiting screen needed a safe-to-revisit "back to chat" exit.
public record IcebreakerStatusResponse(bool HasResponded);

public record QuizQuestionResponse(Guid Id, string Text, List<string> Options);

public record QuizDetailsResponse(Guid Id, string Title, List<QuizQuestionResponse> Questions);

// Awarded is this caller's real total for this call (0 on a repeat
// submission — only the first response per quiz/match/user earns anything),
// including any daily-quest bonus on top of the base QuizDone amount.
public record QuizCompatibilityResponse(int? Compatibility, int Awarded = 0, DroppedItem? DroppedItem = null);

// Lets the client ask "have I already answered this quiz for this match"
// without needing to hold the answers themselves in memory — unlike
// RespondQuiz, this is safe to call on every mount.
public record QuizStatusResponse(bool HasResponded, int? Compatibility);

public record QuestEntryResponse(string QuestId, string NameKey, int Target, int Progress, bool Completed, int Xp);
public record QuestBoardResponse(List<QuestEntryResponse> Quests, bool AllComplete, bool ChestClaimed);
public record ClaimChestResponse(int Awarded, bool AlreadyClaimed, DroppedItem? Item = null);

public record MilestoneResponse(string Id, string NameKey, int Xp, DateTime? AchievedAt, DateTime? OpenedAt);
public record OpenMilestoneResponse(int Awarded, DroppedItem? Item, bool AlreadyOpened);
