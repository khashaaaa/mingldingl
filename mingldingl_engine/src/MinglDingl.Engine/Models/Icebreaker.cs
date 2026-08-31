public class Icebreaker
{
    public Guid Id { get; set; }
    public string QuestionText { get; set; } = "";
    public string Type { get; set; } = "OpenText";
    public List<string> Options { get; set; } = [];
    public bool IsActive { get; set; } = true;
}
