using System.Threading.Channels;

namespace MinglDingl.Engine.Kernel.Push;

public static class PushKinds
{
    public const string Letter = "letter";
    public const string BondMade = "bondMade";
    public const string Embers = "embers";
    public const string GoneCold = "goneCold";
    public const string RiteProposed = "riteProposed";
    public const string MeetingProposed = "meetingProposed";
    public const string MeetingSworn = "meetingSworn";
    public const string MeetingCalledOff = "meetingCalledOff";
    public const string Attendance = "attendance";
    public const string RetireAsked = "retireAsked";
    public const string ThreadWoven = "threadWoven";
    public const string ThreadSparked = "threadSparked";
    public const string SquareSoon = "squareSoon";
    public const string FloorEnding = "floorEnding";
    public const string RefundSent = "refundSent";
}

/// A push to one person's devices. `name` and `text` fill the copy table's {{name}} / {{text}}.
public sealed record PushItem(Guid AccountId, string Kind, Guid? BondId, string? Name, string? Text);

/// Pushes a request wants sent — like live events, held until the transaction commits, then
/// handed to the sender off the request path.
public interface IPushOutbox
{
    void Send(Guid accountId, string kind, Guid? bondId = null, string? name = null, string? text = null);
}

public sealed class PushOutbox(PushQueue queue) : IPushOutbox
{
    private readonly List<PushItem> _held = [];

    public void Send(Guid accountId, string kind, Guid? bondId = null, string? name = null, string? text = null) =>
        _held.Add(new(accountId, kind, bondId, name, text));

    internal void Discard() => _held.Clear();

    internal void Flush()
    {
        foreach (var item in _held) queue.Writer.TryWrite(item);
        _held.Clear();
    }
}

/// Bounded: if the sender falls far behind, the oldest pushes are dropped, never the app.
public sealed class PushQueue
{
    private readonly Channel<PushItem> _channel = Channel.CreateBounded<PushItem>(
        new BoundedChannelOptions(10_000) { FullMode = BoundedChannelFullMode.DropOldest, SingleReader = true });

    public ChannelWriter<PushItem> Writer => _channel.Writer;
    public ChannelReader<PushItem> Reader => _channel.Reader;
}
