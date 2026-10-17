using System.Text.RegularExpressions;
using FluentAssertions;
using MinglDingl.Engine.Features.Campaign;
using MinglDingl.Engine.Features.Encounters;
using MinglDingl.Engine.Kernel.Push;

namespace MinglDingl.Engine.Tests.Features.Encounters;

/// The engine's own words reach a Mongolian reader in Mongolian: every bank line, every push.
public class MongolianTests
{
    [Fact]
    public void Every_bank_line_has_its_Mongolian()
    {
        var english = Questions.Icebreakers
            .Concat(Questions.Trials.SelectMany(q => new[] { q.Text, q.Topic }.Concat(q.Choices.SelectMany(c => new[] { c.Choice, c.Hint }))))
            .Concat(WeeklyTrialService.Exchanges);
        english.Where(e => !QuestionsMn.Lines.ContainsKey(e)).Should().BeEmpty();
        QuestionsMn.In("What is a sound that means home to you?", "en").Should().Be("What is a sound that means home to you?");
        QuestionsMn.In("What is a sound that means home to you?", "mn").Should().Be("Чамд гэрийг санагдуулдаг дуу чимээ юу вэ?");
    }

    [Fact]
    public void Every_push_has_its_Mongolian_with_the_same_placeholders()
    {
        static string Vars(string s) => string.Join(",", Regex.Matches(s, @"\{\{\w+\}\}").Select(m => m.Value).Order());
        foreach (var (kind, line) in PushCopy.Table)
        {
            line.TitleMn.Should().NotBeNull(kind);
            line.BodyMn.Should().NotBeNull(kind);
            Vars(line.TitleMn! + line.BodyMn!).Should().Be(Vars(line.TitleEn + line.BodyEn), kind);
        }
    }

    [Fact]
    public void A_Mongolian_push_reads_its_floor_and_date_in_Mongolian()
    {
        var item = new PushItem(Guid.Empty, PushKinds.FloorEnding, null, "The High Table", "16 October");
        PushCopy.Render(item, "mn").Body.Should().StartWith("Дээд ширээ 10-р сарын 16 дуусна.");
        PushCopy.Render(item, "en").Body.Should().StartWith("The High Table ends on 16 October.");
        var meeting = new PushItem(Guid.Empty, PushKinds.MeetingSworn, null, "Saruul", "Nomad Café, Fri 17 Oct, 19:00");
        PushCopy.Render(meeting, "mn").Body.Should().Be("Чи ба Saruul: Nomad Café, Ба, 10-р сарын 17, 19:00.");
    }
}
