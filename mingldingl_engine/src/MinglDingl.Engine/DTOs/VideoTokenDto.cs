public record VideoTokenRequestDto(Guid MatchId);
public record VideoCompleteDto(Guid MatchId);
public record VideoTokenResponse(string Token, string ChannelName, string AppId);
public record VideoCompleteResponse(int Awarded, DroppedItem? DroppedItem = null);
