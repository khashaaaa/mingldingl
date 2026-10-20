using System.Text.RegularExpressions;

namespace MinglDingl.Engine.Kernel.Push;

/// Every push's words, EN + MN. A line with no Mongolian (null) is sent in English.
/// {{name}} and {{text}} are filled per push.
public static class PushCopy
{
    public sealed record Line(string TitleEn, string BodyEn, string? TitleMn, string? BodyMn);

    public static readonly IReadOnlyDictionary<string, Line> Table = new Dictionary<string, Line>
    {
        [PushKinds.Letter] = new("A letter from {{name}}", "“{{text}}”", "{{name}} захидал илгээлээ", "“{{text}}”"),
        [PushKinds.BondMade] = new("A bond is made", "{{name}} summoned you. Speak first, and the first seal starts to crack.", "Холбоо тогтлоо", "{{name}} чамайг урилаа. Эхэлж үг хэл — анхны лац цуурч эхэлнэ."),
        [PushKinds.Embers] = new("Your fire is going cold", "{{name}} waits for your word — {{text}} hours left.", "Гал чинь хөрч байна", "{{name}} чиний үгийг хүлээж байна — {{text}} цаг үлдлээ."),
        [PushKinds.GoneCold] = new("The fire went out", "Your bond with {{name}} has gone cold.", "Гал унтарлаа", "{{name}} гэдэг хүнтэй холбоо чинь хөрлөө."),
        [PushKinds.RiteProposed] = new("The Flame Rite", "{{name}} asks for the Flame Rite — five minutes, face to face.", "Галын ёслол", "{{name}} Галын ёслол хүсэж байна — таван минут нүүр тулан."),
        [PushKinds.MeetingProposed] = new("A meeting is offered", "{{name}} pledged to meet: {{text}}.", "Уулзалтын санал", "{{name}} уулзахаа амлалаа: {{text}}."),
        [PushKinds.MeetingSworn] = new("The meeting is sworn", "You and {{name}}: {{text}}.", "Уулзалт тангараглагдлаа", "Чи ба {{name}}: {{text}}."),
        [PushKinds.MeetingCalledOff] = new("The meeting is called off", "{{name}} called off {{text}}.", "Уулзалт цуцлагдлаа", "{{name}} цуцаллаа: {{text}}."),
        [PushKinds.Attendance] = new("Did {{name}} come?", "Tell the hold how the meeting went. Your answer is private.", "{{name}} ирсэн үү?", "Уулзалт хэрхэн болсныг цайзад хэл. Хариулт чинь зөвхөн чамд."),
        [PushKinds.ThreadWoven] = new("A thread from {{name}}", "{{name}} thinks you should meet someone. Neither learns who the other is until both say yes.", "{{name}} нэхсэн утас", "{{name}} чамайг нэг хүнтэй уулзах ёстой гэж бодож байна. Хоёулаа тийм гэх хүртэл хэн нь хэн бэ гэдгийг мэдэхгүй."),
        [PushKinds.ThreadSparked] = new("Your thread sparked", "Both said yes. The thread-weaver's due is yours.", "Утас чинь оч хаялаа", "Хоёулаа тийм гэлээ. Утас-Нэхэгчийн хувь чинийх."),
        [PushKinds.SquareSoon] = new("{{name}} rings soon", "Town Square opens in one minute.", "{{name}} удахгүй хангинана", "Талбай нэг минутын дараа нээгдэнэ."),
        [PushKinds.FloorEnding] = new("Your floor ends soon", "{{name}} ends on {{text}}. The game stays the same on every floor.", "Давхрын хугацаа дуусах гэж байна", "{{name}} {{text}} дуусна. Тоглоом бүх давхарт адилхан."),
        [PushKinds.RefundSent] = new("Your payment is coming back", "We could not open the floor, so {{text}} is on its way back to your bank.", "Төлбөр чинь буцаж байна", "Давхрыг нээж чадсангүй, тиймээс {{text}} банк руу чинь буцаж байна."),
        [PushKinds.RetireAsked] = new("{{name}} asks to retire together", "If you agree, you both leave the search and keep this bond as complete.", "{{name}} хамтдаа замаас буухыг хүсэж байна", "Зөвшөөрвөл хоёулаа эрлээс гарч, энэ холбоог бүрэн гэж хадгална."),
    };

    public static (string Title, string Body) Render(PushItem item, string locale)
    {
        var line = Table[item.Kind];
        var mn = locale == "mn" && line.TitleMn is not null && line.BodyMn is not null;
        var title = mn ? line.TitleMn! : line.TitleEn;
        var body = mn ? line.BodyMn! : line.BodyEn;
        string Value(string? v) => mn ? Mongolian(v ?? "") : v ?? "";
        string Fill(string s) => s.Replace("{{name}}", Value(item.Name)).Replace("{{text}}", Clip(Value(item.Text), 140));
        return (Fill(title), Fill(body));
    }

    private static readonly string[] Months =
        ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    private static readonly Dictionary<string, string> Weekdays = new()
    {
        ["Mon"] = "Да", ["Tue"] = "Мя", ["Wed"] = "Лх", ["Thu"] = "Пү", ["Fri"] = "Ба", ["Sat"] = "Бя", ["Sun"] = "Ня",
    };
    private static readonly Dictionary<string, string> Floors = new() { ["The High Table"] = "Дээд ширээ", ["The Hall"] = "Танхим" };

    /// The English values a push carries (a floor's name, "Fri 17 Oct, 19:00", "16 October") as a
    /// Mongolian reader reads them: "Ба, 10-р сарын 17, 19:00", "10-р сарын 16".
    private static string Mongolian(string v)
    {
        if (Floors.TryGetValue(v, out var floor)) return floor;
        int Month(string m) => Array.FindIndex(Months, x => x.StartsWith(m, StringComparison.Ordinal)) + 1;
        v = Regex.Replace(v, @"\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b",
            m => $"{Weekdays[m.Groups[1].Value]}, {Month(m.Groups[3].Value)}-р сарын {m.Groups[2].Value}");
        return Regex.Replace(v, @"^(\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December)$",
            m => $"{Month(m.Groups[2].Value)}-р сарын {m.Groups[1].Value}");
    }

    private static string Clip(string s, int max) => s.Length <= max ? s : s[..(max - 1)] + "…";
}
