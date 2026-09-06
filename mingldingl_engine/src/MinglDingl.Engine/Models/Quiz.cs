public class Quiz
{
    public Guid Id { get; set; }
    public string Title { get; set; } = "";
    public string? TitleEn { get; set; }
    public List<QuizQuestion> Questions { get; set; } = [];
}

public class QuizQuestion
{
    public Guid Id { get; set; }
    public Guid QuizId { get; set; }
    public string Text { get; set; } = "";
    public string? TextEn { get; set; }
    public List<string> Options { get; set; } = [];
    public List<string>? OptionsEn { get; set; }
}
