using System.ComponentModel.DataAnnotations;

public record AdminUpdateContentPageRequest(
    [Required, MaxLength(FieldLimits.Title)] string TitleEn,
    [Required, MaxLength(FieldLimits.Title)] string TitleMn,
    [Required, MaxLength(FieldLimits.PageBody)] string BodyEn,
    [Required, MaxLength(FieldLimits.PageBody)] string BodyMn);
