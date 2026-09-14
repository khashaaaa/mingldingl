namespace MinglDingl.Engine.Tests;

public class PagingDefaultsTests
{
    /// <summary>(page - 1) * pageSize is an int: an unbounded page overflowed into a negative skip and a 500.</summary>
    [Theory]
    [InlineData(int.MaxValue)]
    [InlineData(100_000_000)]
    public void Normalize_AHugePage_IsClampedAndNeverOverflows(int page)
    {
        var (safePage, pageSize, skip) = PagingDefaults.Normalize(page, PagingDefaults.MaxPageSize);

        Assert.Equal(PagingDefaults.MaxPage, safePage);
        Assert.Equal((PagingDefaults.MaxPage - 1) * pageSize, skip);
        Assert.True(skip >= 0);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    [InlineData(int.MinValue)]
    public void Normalize_APageBelowOne_IsTheFirstPage(int page) =>
        Assert.Equal((1, PagingDefaults.DefaultPageSize, 0), PagingDefaults.Normalize(page, 0));
}
