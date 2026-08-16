using System.Text;

// Minimal RFC 4180-ish CSV writer — no dependency for something this small.
// Shared by every admin export endpoint so quoting/escaping can't drift
// between them.
public static class CsvWriter
{
    public static string Write(IReadOnlyList<string> headers, IEnumerable<string?[]> rows)
    {
        var sb = new StringBuilder();
        sb.AppendLine(string.Join(',', headers.Select(Escape)));
        foreach (var row in rows)
            sb.AppendLine(string.Join(',', row.Select(Escape)));
        return sb.ToString();
    }

    private static string Escape(string? value)
    {
        value ??= "";
        if (value.Contains(',') || value.Contains('"') || value.Contains('\n'))
            return $"\"{value.Replace("\"", "\"\"")}\"";
        return value;
    }
}
