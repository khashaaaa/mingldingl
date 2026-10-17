using FluentAssertions;
using MinglDingl.Engine.Kernel.Errors;
using Sentry;

namespace MinglDingl.Engine.Tests.Kernel;

public class SentryScrubTests
{
    [Fact]
    public void Scrub_removes_phone_numbers_and_tokens()
    {
        var e = new SentryEvent(new Exception("Failed for 99112233 with eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc"))
        {
            Message = new SentryMessage { Formatted = "number 88001122 refused" },
        };
        e.Request.QueryString = "?phone=99112233";
        e.Request.Data = new { phone = "99112233" };
        e.Request.Headers["Authorization"] = "Bearer secret";
        e.Request.Cookies = "a=b";

        var s = SentryScrub.Scrub(e);

        s.Message!.Formatted.Should().Be("number [phone] refused");
        s.Request.QueryString.Should().BeNull();
        s.Request.Data.Should().BeNull();
        s.Request.Cookies.Should().BeNull();
        s.Request.Headers.Should().NotContainKey("Authorization");
        SentryScrub.Text("Failed for 99112233 with eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc")
            .Should().Be("Failed for [phone] with [token]");
    }
}
