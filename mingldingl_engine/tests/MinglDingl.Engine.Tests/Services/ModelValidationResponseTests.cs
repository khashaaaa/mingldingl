using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace MinglDingl.Engine.Tests.Services;

/// <summary>
/// DataAnnotations failures were the one error path that escaped the DomainException contract:
/// they came back as raw .NET prose ("The field Content must be a string or array type with a
/// maximum length of '2000'.") with no code at all, so the app could neither localise them nor
/// branch on them — and a Mongolian user read them in English.
/// </summary>
public class ModelValidationResponseTests
{
    private static ErrorResponse Build(string field, string message)
    {
        var state = new ModelStateDictionary();
        state.AddModelError(field, message);
        var result = Assert.IsType<BadRequestObjectResult>(ModelValidationResponse.For(state));
        return Assert.IsType<ErrorResponse>(result.Value);
    }

    [Fact]
    public void AValidationFailure_CarriesAStableCodeTheAppCanLocalise() =>
        Assert.Equal("request.invalid", Build("Content", "The Content field is required.").Code);

    [Fact]
    public void AValidationFailure_KeepsTheFrameworkTextAsADeveloperFallback() =>
        Assert.Equal("The Content field is required.", Build("Content", "The Content field is required.").Error);

    [Fact]
    public void AnEmptyModelState_StillProducesACodedResponse()
    {
        var result = Assert.IsType<BadRequestObjectResult>(ModelValidationResponse.For(new ModelStateDictionary()));
        Assert.Equal("request.invalid", Assert.IsType<ErrorResponse>(result.Value).Code);
    }
}
