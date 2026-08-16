public class Icebreaker
{
    public Guid Id { get; set; }
    public string QuestionText { get; set; } = "";
    public string Type { get; set; } = "OpenText"; // OpenText|EmojiPick|ThisOrThat
    public List<string> Options { get; set; } = []; // for ThisOrThat/EmojiPick
    public bool IsActive { get; set; } = true;
}
