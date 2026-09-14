public record PagedResponse<T>(List<T> Items, int Page, int PageSize, int TotalCount, bool HasMore);

public static class PagingDefaults
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 50;

    /// <summary>
    /// Deepest page served. <c>(page - 1) * pageSize</c> is an int, so an unbounded page overflowed
    /// into a negative skip and a 500; this keeps the product comfortably inside int range.
    /// </summary>
    public const int MaxPage = 10_000;

    public static (int Page, int PageSize, int Skip) Normalize(int page, int pageSize)
    {
        var safePage = Math.Clamp(page, 1, MaxPage);
        var safePageSize = Math.Clamp(pageSize <= 0 ? DefaultPageSize : pageSize, 1, MaxPageSize);
        return (safePage, safePageSize, (safePage - 1) * safePageSize);
    }
}
