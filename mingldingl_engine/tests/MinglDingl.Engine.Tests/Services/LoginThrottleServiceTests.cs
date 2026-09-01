namespace MinglDingl.Engine.Tests.Services;

public class LoginThrottleServiceTests
{
    private const string User = "admin";
    private const string Ip = "203.0.113.7";

    [Fact]
    public void A_fresh_caller_is_not_throttled() =>
        Assert.Null(new LoginThrottleService().RetryAfter(User, Ip));

    [Fact]
    public void Four_failures_stay_under_the_limit()
    {
        var throttle = new LoginThrottleService();
        for (var i = 0; i < 4; i++) throttle.RecordFailure(User, Ip);

        Assert.Null(throttle.RetryAfter(User, Ip));
    }

    [Fact]
    public void The_fifth_failure_locks_the_caller_out()
    {
        var throttle = new LoginThrottleService();
        for (var i = 0; i < 5; i++) throttle.RecordFailure(User, Ip);

        var wait = throttle.RetryAfter(User, Ip);
        Assert.NotNull(wait);
        Assert.True(wait > TimeSpan.Zero);
    }

    [Fact]
    public void A_successful_login_clears_accumulated_failures()
    {
        var throttle = new LoginThrottleService();
        for (var i = 0; i < 4; i++) throttle.RecordFailure(User, Ip);
        throttle.RecordSuccess(User, Ip);

        throttle.RecordFailure(User, Ip);
        Assert.Null(throttle.RetryAfter(User, Ip));
    }

    [Fact]
    public void Lockout_is_scoped_per_caller_so_one_attacker_cannot_lock_everyone_out()
    {
        var throttle = new LoginThrottleService();
        for (var i = 0; i < 5; i++) throttle.RecordFailure(User, "198.51.100.1");

        Assert.NotNull(throttle.RetryAfter(User, "198.51.100.1"));
        Assert.Null(throttle.RetryAfter(User, "203.0.113.9"));
    }

    [Fact]
    public void Concurrent_failures_are_counted_without_losing_updates()
    {
        var throttle = new LoginThrottleService();
        Parallel.For(0, 50, _ => throttle.RecordFailure(User, Ip));

        Assert.NotNull(throttle.RetryAfter(User, Ip));
    }
}
