public class Icebreaker
{
    public Guid Id { get; set; }
    public string QuestionText { get; set; } = "";

    /// <summary>
    /// The English overlay. Null means untranslated, and the Mongolian shows instead — see
    /// <see cref="LocalisedContent"/>. Mongolian is the market's language and stays the stored column.
    /// </summary>
    public string? QuestionTextEn { get; set; }
    public string Type { get; set; } = "OpenText";
    public List<string> Options { get; set; } = [];
    public List<string>? OptionsEn { get; set; }
    public bool IsActive { get; set; } = true;
}
