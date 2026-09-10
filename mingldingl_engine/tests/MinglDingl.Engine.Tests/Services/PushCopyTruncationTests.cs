namespace MinglDingl.Engine.Tests.Services;

/// <summary>
/// Expo refuses any single message over 4KiB. A chat push carries the message verbatim and
/// <c>FieldLimits.MessageContent</c> allows 2000 characters — which in Mongolian Cyrillic is ~4000
/// bytes on its own, so a long message produced a <c>MessageTooBig</c> ticket and no notification
/// at all. Nothing logged it either, so it looked like the push had simply never been sent.
/// </summary>
public class PushCopyTruncationTests
{
    [Fact]
    public void ALongMongolianMessage_IsCutToSomethingExpoWillAccept()
    {
        var body = string.Concat(Enumerable.Repeat("Сайн байна уу ", 200));
        var (_, pushBody) = PushCopy.For(PushKind.NewMessage, "mn", "Болор", body);

        Assert.True(System.Text.Encoding.UTF8.GetByteCount(pushBody) <= 500);
        Assert.EndsWith("…", pushBody);
    }

    [Fact]
    public void AShortMessage_IsLeftExactlyAsItIs()
    {
        var (title, body) = PushCopy.For(PushKind.NewMessage, "mn", "Болор", "Сайн уу?");
        Assert.Equal("Болор", title);
        Assert.Equal("Сайн уу?", body);
    }

    [Fact]
    public void ADisplayNameLongerThanTheTitleBudget_IsCut()
    {
        var (title, _) = PushCopy.For(PushKind.NewMessage, "mn", new string('Ө', 200), "hi");
        Assert.True(System.Text.Encoding.UTF8.GetByteCount(title) <= 100);
    }

    /// <summary>A multi-byte letter must never be halved into replacement characters.</summary>
    [Fact]
    public void TruncationLandsOnARuneBoundary()
    {
        var cut = PushCopy.Truncate(new string('ө', 100), 21);
        Assert.DoesNotContain('�', cut);
        Assert.True(System.Text.Encoding.UTF8.GetByteCount(cut) <= 21);
    }
}
