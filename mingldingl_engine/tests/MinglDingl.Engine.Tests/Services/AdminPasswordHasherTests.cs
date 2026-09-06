namespace MinglDingl.Engine.Tests.Services;

public class AdminPasswordHasherTests
{
    [Fact]
    public void Verify_accepts_the_password_that_was_hashed()
    {
        var stored = AdminPasswordHasher.Hash("correct-horse-battery-staple");
        Assert.True(AdminPasswordHasher.Verify("correct-horse-battery-staple", stored));
    }

    [Fact]
    public void Verify_rejects_a_different_password()
    {
        var stored = AdminPasswordHasher.Hash("correct-horse-battery-staple");
        Assert.False(AdminPasswordHasher.Verify("incorrect-horse", stored));
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-a-hash")]
    [InlineData("abc.def.ghi")]
    [InlineData("210000.%%%not-base64%%%.AAAA")]
    [InlineData("210000.AAAA.%%%not-base64%%%")]
    [InlineData("0.AAAA.AAAA")]
    [InlineData("210000..")]
    public void Verify_reads_a_malformed_stored_hash_as_a_wrong_password_rather_than_throwing(string stored) =>
        Assert.False(AdminPasswordHasher.Verify("anything", stored));
}
