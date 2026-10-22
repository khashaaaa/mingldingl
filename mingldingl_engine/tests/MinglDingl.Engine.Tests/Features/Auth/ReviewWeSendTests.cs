using FluentAssertions;
using MinglDingl.Engine.Features.Auth;

namespace MinglDingl.Engine.Tests.Features.Auth;

/// The store reviewers' number: no text, its own code only; everyone else still goes to WeSend.
public class ReviewWeSendTests
{
    private sealed class Recorder : IWeSend
    {
        public List<string> Sent { get; } = [];
        public Task<SentCode> SendCodeAsync(string phone, string locale, CancellationToken ct = default)
        {
            Sent.Add(phone);
            return Task.FromResult(new SentCode(CodeSent.Sent, "wesend-1", DateTimeOffset.UtcNow.AddMinutes(10)));
        }
        public Task<CodeChecked> CheckAsync(string providerId, string code, CancellationToken ct = default) =>
            Task.FromResult(CodeChecked.Wrong);
    }

    [Fact]
    public async Task The_review_number_gets_no_text_and_passes_only_with_its_code()
    {
        var inner = new Recorder();
        var review = new ReviewWeSend(inner, "70110000", "246813");

        var sent = await review.SendCodeAsync("70110000", "en");
        inner.Sent.Should().BeEmpty();
        (await review.CheckAsync(sent.Id!, "000000")).Should().Be(CodeChecked.Wrong);
        (await review.CheckAsync(sent.Id!, "246813")).Should().Be(CodeChecked.Approved);
    }

    [Fact]
    public async Task Every_other_number_goes_to_WeSend_and_the_review_code_does_not_open_it()
    {
        var inner = new Recorder();
        var review = new ReviewWeSend(inner, "70110000", "246813");

        var sent = await review.SendCodeAsync("99112233", "mn");
        inner.Sent.Should().Equal("99112233");
        (await review.CheckAsync(sent.Id!, "246813")).Should().Be(CodeChecked.Wrong);
    }
}
