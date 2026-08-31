public record SendMessageRequest(string Content);

public record MessageResponse(
    Guid Id,
    Guid MatchId,
    Guid SenderId,
    string Content,
    DateTime CreatedAt);

public record SendMessageResponse(MessageResponse Message, int Awarded = 0);
