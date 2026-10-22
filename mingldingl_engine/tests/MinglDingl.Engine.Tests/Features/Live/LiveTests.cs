using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;
using MinglDingl.Engine.Tests.Infrastructure;

namespace MinglDingl.Engine.Tests.Features.Live;

public class LiveTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    private static async Task Touch(AppDb store) =>
        (await store.Set<ConfigEntry>().FirstAsync()).UpdatedAt = DateTimeOffset.UtcNow;

    [Fact]
    public async Task Event_reaches_only_its_account()
    {
        await using var f = new EngineFactory(db);
        var vm = f.UseScriptedWeSend();
        Guid target = Guid.Empty;
        f.WithEndpoint("/__send", async (AppDb store, ILiveOutbox live) =>
        {
            live.ToAccount(target, LiveKinds.ProfileUpdated, target);
            await Touch(store);
            await store.SaveChangesAsync();
        });
        var a = await f.SignInAsync(vm);
        var b = await f.SignInAsync(vm);
        target = a.AccountId;
        await using var la = await f.ListenAsync(a);
        await using var lb = await f.ListenAsync(b);
        await f.Client().GetAsync("/__send");
        (await la.WaitForAsync(LiveKinds.ProfileUpdated))!.Ids.Should().Equal(a.AccountId);
        (await lb.WaitForAsync(LiveKinds.ProfileUpdated, TimeSpan.FromMilliseconds(500))).Should().BeNull();
    }

    [Fact]
    public async Task Event_is_not_sent_when_transaction_rolls_back()
    {
        await using var f = new EngineFactory(db);
        var vm = f.UseScriptedWeSend();
        Guid target = Guid.Empty;
        f.WithEndpoint("/__rollback", async (AppDb store, ILiveOutbox live) =>
        {
            await using var tx = await store.Database.BeginTransactionAsync();
            live.ToAccount(target, LiveKinds.ProfileUpdated, target);
            await Touch(store);
            await store.SaveChangesAsync();
            await tx.RollbackAsync();
        });
        var a = await f.SignInAsync(vm);
        target = a.AccountId;
        await using var la = await f.ListenAsync(a);
        await f.Client().GetAsync("/__rollback");
        (await la.WaitForAsync(LiveKinds.ProfileUpdated, TimeSpan.FromMilliseconds(700))).Should().BeNull();
    }

    [Fact]
    public async Task Event_is_sent_after_commit_not_before()
    {
        await using var f = new EngineFactory(db);
        var vm = f.UseScriptedWeSend();
        Guid target = Guid.Empty;
        DateTimeOffset committedAt = default;
        f.WithEndpoint("/__slow", async (AppDb store, ILiveOutbox live) =>
        {
            await using var tx = await store.Database.BeginTransactionAsync();
            live.ToAccount(target, LiveKinds.ProfileUpdated, target);
            await Touch(store);
            await store.SaveChangesAsync();
            await Task.Delay(400);
            committedAt = DateTimeOffset.UtcNow;
            await tx.CommitAsync();
        });
        var a = await f.SignInAsync(vm);
        target = a.AccountId;
        await using var la = await f.ListenAsync(a);
        await f.Client().GetAsync("/__slow");
        (await la.WaitForAsync(LiveKinds.ProfileUpdated)).Should().NotBeNull();
        la.Received.Single(r => r.Event.Kind == LiveKinds.ProfileUpdated).At.Should().BeOnOrAfter(committedAt);
    }

    [Fact]
    public async Task Hub_rejects_missing_or_revoked_token()
    {
        await using var f = new EngineFactory(db);
        var vm = f.UseScriptedWeSend();
        var act = () => f.ListenAsync((string?)null);
        await act.Should().ThrowAsync<Exception>();

        var s = await f.SignInAsync(vm);
        await f.As(s).PostAsync("/auth/sign-out", null);
        var revoked = () => f.ListenAsync(s);
        await revoked.Should().ThrowAsync<Exception>();
    }

    [Fact]
    public async Task Revoking_a_device_sends_session_revoked_to_that_device_only()
    {
        await using var f = new EngineFactory(db);
        var vm = f.UseScriptedWeSend();
        var phone = SessionDriver.NewPhone();
        var a = await f.SignInAsync(vm, phone, "a");
        var b = await f.SignInAsync(vm, phone, "b");
        await using var la = await f.ListenAsync(a);
        await using var lb = await f.ListenAsync(b);
        await f.As(a).PostAsync("/auth/sign-out", null);
        (await la.WaitForAsync(LiveKinds.SessionRevoked)).Should().NotBeNull();
        (await lb.WaitForAsync(LiveKinds.SessionRevoked, TimeSpan.FromMilliseconds(500))).Should().BeNull();
    }

    [Fact]
    public async Task One_write_sends_each_group_one_batch_with_repeats_folded()
    {
        await using var f = new EngineFactory(db);
        var vm = f.UseScriptedWeSend();
        Guid target = Guid.Empty;
        var bond = Guid.NewGuid();
        f.WithEndpoint("/__many", async (AppDb store, ILiveOutbox live) =>
        {
            live.ToAccount(target, LiveKinds.BondUpdated, bond);
            live.ToAccount(target, LiveKinds.BondUpdated, bond); // same kind, same ids: a new array each time
            live.ToAccount(target, LiveKinds.SeekChanged, target);
            live.ToAccount(target, LiveKinds.BondUpdated, Guid.NewGuid());
            await Touch(store);
            await store.SaveChangesAsync();
        });
        var a = await f.SignInAsync(vm);
        target = a.AccountId;
        await using var la = await f.ListenAsync(a);
        using var req = new HttpRequestMessage(HttpMethod.Get, "/__many");
        req.Headers.Add(LiveOutbox.OriginHeader, "w-123");
        await f.Client().SendAsync(req);
        (await la.WaitForAsync(LiveKinds.SeekChanged)).Should().NotBeNull();
        await Task.Delay(200);
        la.Batches.Should().ContainSingle();
        var batch = la.Batches.Single();
        batch.Origin.Should().Be("w-123");
        batch.All.Should().BeFalse();
        batch.Events.Should().HaveCount(3);
        batch.Events.Count(e => e.Kind == LiveKinds.BondUpdated && e.Ids.SequenceEqual(new[] { bond })).Should().Be(1);
    }

    [Fact]
    public void Live_events_are_equal_by_their_ids()
    {
        var id = Guid.NewGuid();
        new LiveEvent("k", [id]).Should().Be(new LiveEvent("k", new[] { id }.ToList()));
        new LiveEvent("k", [id]).Should().NotBe(new LiveEvent("k", [Guid.NewGuid()]));
        new[] { new LiveEvent("k", [id]), new LiveEvent("k", [id]) }.Distinct().Should().ContainSingle();
    }
}
