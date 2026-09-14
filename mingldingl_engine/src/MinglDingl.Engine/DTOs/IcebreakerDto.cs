using System.ComponentModel.DataAnnotations;

public record IcebreakerRespondDto(Guid IcebreakerId, [MaxLength(FieldLimits.MessageContent)] string Answer);

public record QuizRespondDto([MinLength(1), MaxLength(QuizRespondDto.MaxAnswers)] Dictionary<Guid, string> Answers, Guid? MatchId)
{
    public const int MaxAnswers = 100;
}
