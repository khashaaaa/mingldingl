public record IcebreakerQuestionResponse(Guid Id, string QuestionText, string Type, List<string> Options);

public record IcebreakerRespondResult(bool BothResponded, int Awarded = 0, DroppedItem? DroppedItem = null);

public record IcebreakerRevealEntry(Guid UserId, string Answer);

public record IcebreakerStatusResponse(bool HasResponded);

public record QuizQuestionResponse(Guid Id, string Text, List<string> Options);

public record QuizDetailsResponse(Guid Id, string Title, List<QuizQuestionResponse> Questions);

public record QuizCompatibilityResponse(int? Compatibility, int Awarded = 0, DroppedItem? DroppedItem = null);

public record QuizStatusResponse(bool HasResponded, int? Compatibility);

public record QuestEntryResponse(string QuestId, string NameKey, int Target, int Progress, bool Completed, int Xp);
public record QuestBoardResponse(List<QuestEntryResponse> Quests, bool AllComplete, bool ChestClaimed);
public record ClaimChestResponse(int Awarded, bool AlreadyClaimed, DroppedItem? Item = null);

public record MilestoneResponse(string Id, string NameKey, int Xp, DateTime? AchievedAt, DateTime? OpenedAt);
public record OpenMilestoneResponse(int Awarded, DroppedItem? Item, bool AlreadyOpened);
