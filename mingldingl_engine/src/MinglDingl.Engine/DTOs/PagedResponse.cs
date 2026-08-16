public record PagedResponse<T>(List<T> Items, int Page, int PageSize, int TotalCount, bool HasMore);

public static class PagingDefaults
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 50;

    public static (int Page, int PageSize, int Skip) Normalize(int page, int pageSize)
    {
        var safePage = Math.Max(1, page);
        var safePageSize = Math.Clamp(pageSize <= 0 ? DefaultPageSize : pageSize, 1, MaxPageSize);
        return (safePage, safePageSize, (safePage - 1) * safePageSize);
    }
}
