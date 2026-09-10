public class BusinessPartner
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Category { get; set; } = "";
    public string City { get; set; } = "";
    public string District { get; set; } = "";
    public string Description { get; set; } = "";

    /// <summary>
    /// The Mongolian overlay for the four fields above — see <see cref="LocalisedContent"/>. This
    /// table was seeded in English before that scheme existed, so (unlike icebreakers and quizzes)
    /// English is the stored fallback here and these are the missing translations. Null means
    /// untranslated, and the English column shows instead; populating them is a native speaker's
    /// job, not this codebase's.
    /// </summary>
    public string? NameMn { get; set; }
    public string? CategoryMn { get; set; }
    public string? DistrictMn { get; set; }
    public string? DescriptionMn { get; set; }

    public List<string> PhotoUrls { get; set; } = [];
    public string OperatingHours { get; set; } = "";
    public bool IsVerified { get; set; }
    public bool IsFeatured { get; set; }
    public decimal AverageRating { get; set; }
    public int RatingCount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<BusinessRating> Ratings { get; set; } = [];
}
