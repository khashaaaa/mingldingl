namespace MinglDingl.Engine.Tests.Services;

public class CsvWriterTests
{
    private static string Unquote(string cell) =>
        cell.StartsWith('"') && cell.EndsWith('"')
            ? cell[1..^1].Replace("\"\"", "\"")
            : cell;

    private static string Row(string value) =>
        CsvWriter.Write(["Name"], [new[] { (string?)value }]).Split('\n')[1].TrimEnd('\r');

    [Theory]
    [InlineData("=HYPERLINK(\"http://evil\",\"click\")")]
    [InlineData("+1234")]
    [InlineData("-1+2")]
    [InlineData("@SUM(A1)")]
    public void A_display_name_that_looks_like_a_formula_is_neutralised(string displayName)
    {
        // The export is opened by an admin in Excel or Sheets, where a leading =, +, - or @ is
        // evaluated. The name came from the user, so it must not arrive as executable content.
        var cell = Unquote(Row(displayName));

        Assert.Equal("'" + displayName, cell);
    }

    [Fact]
    public void An_ordinary_value_is_left_alone()
    {
        Assert.Equal("Bat-Erdene", Row("Bat-Erdene"));
    }

    [Fact]
    public void A_carriage_return_is_quoted_so_it_cannot_break_row_framing()
    {
        var cell = Row("first\rsecond");

        Assert.StartsWith("\"", cell);
        Assert.EndsWith("\"", cell);
    }

    [Fact]
    public void Commas_and_quotes_are_still_escaped()
    {
        Assert.Equal("\"a,b\"", Row("a,b"));
        Assert.Equal("\"say \"\"hi\"\"\"", Row("say \"hi\""));
    }
}
