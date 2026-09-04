using System.Text;

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

        // Spreadsheets evaluate a leading =, +, - or @ as a formula, so a DisplayName the user
        // chose runs as code the moment an admin opens the export. The leading apostrophe is what
        // Excel and Sheets both read as "this cell is text".
        if (value.Length > 0 && "=+-@\t\r".Contains(value[0]))
            value = "'" + value;

        if (value.AsSpan().IndexOfAny(",\"\n\r".AsSpan()) >= 0)
            return $"\"{value.Replace("\"", "\"\"")}\"";
        return value;
    }
}
