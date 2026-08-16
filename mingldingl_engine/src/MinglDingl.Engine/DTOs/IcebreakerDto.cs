public record IcebreakerRespondDto(Guid IcebreakerId, string Answer);
public record QuizRespondDto(Dictionary<Guid, string> Answers, Guid? MatchId);
