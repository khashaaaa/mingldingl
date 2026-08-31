public class BusinessPartner
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Category { get; set; } = "";
    public string City { get; set; } = "";
    public string District { get; set; } = "";
    public string Description { get; set; } = "";
    public List<string> PhotoUrls { get; set; } = [];
    public string OperatingHours { get; set; } = "";
    public bool IsVerified { get; set; }
    public bool IsFeatured { get; set; }
    public decimal AverageRating { get; set; }
    public int RatingCount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<BusinessRating> Ratings { get; set; } = [];
}
