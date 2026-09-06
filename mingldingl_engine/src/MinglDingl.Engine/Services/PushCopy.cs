/// <summary>Every push the engine sends, keyed so the copy can be localised per recipient.</summary>
public enum PushKind
{
    NewMatch,
    NewMessage,
    ThreadSparked,
    TownSquareMatch,
    FlameRiteProposed,
    FlameRiteAccepted,
    DateConfirmed,
    MatchGhosted,
    MatchGhostedByYou,
    TownSquareStarting,
}

/// <summary>
/// Title/body per kind and locale. Mongolian is the market's language, so every kind carries an
/// MN string; English is the fallback for an unknown locale. `{0}`/`{1}` are the call-site args.
/// </summary>
public static class PushCopy
{
    public static readonly string[] SupportedLocales = ["en", "mn"];

    public static bool IsSupportedLocale(string? locale) =>
        locale is not null && SupportedLocales.Contains(locale);

    /// <summary>The `type` the app routes on; stable wire names, never the enum's spelling.</summary>
    public static string WireType(PushKind kind) => kind switch
    {
        PushKind.NewMatch => "match",
        PushKind.NewMessage => "message",
        PushKind.ThreadSparked => "match",
        PushKind.TownSquareMatch => "match",
        PushKind.FlameRiteProposed => "flame_rite_proposed",
        PushKind.FlameRiteAccepted => "flame_rite_accepted",
        PushKind.DateConfirmed => "date_confirmed",
        PushKind.MatchGhosted => "match_ghosted",
        PushKind.MatchGhostedByYou => "match_ghosted",
        PushKind.TownSquareStarting => "townsquare_started",
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, null),
    };

    public static (string Title, string Body) For(PushKind kind, string? locale, params string[] args)
    {
        var (title, body) = locale == "mn" ? Mongolian(kind) : English(kind);
        return (Fill(title, args), Fill(body, args));
    }

    /// <summary>
    /// One left-to-right pass, so a substituted argument is never rescanned: replacing `{0}` and
    /// then `{1}` over the accumulated string let a display name containing `{1}` splice the
    /// message body into the push title.
    /// </summary>
    private static string Fill(string template, string[] args)
    {
        if (args.Length == 0 || !template.Contains('{')) return template;

        var sb = new System.Text.StringBuilder(template.Length);
        for (int i = 0; i < template.Length; i++)
        {
            var close = template[i] == '{' ? template.IndexOf('}', i + 1) : -1;
            if (close > i
                && int.TryParse(template.AsSpan(i + 1, close - i - 1), out var index)
                && index >= 0 && index < args.Length)
            {
                sb.Append(args[index]);
                i = close;
                continue;
            }
            sb.Append(template[i]);
        }
        return sb.ToString();
    }

    private static (string, string) English(PushKind kind) => kind switch
    {
        PushKind.NewMatch => ("New Match!", "{0} sent you a summons."),
        PushKind.NewMessage => ("{0}", "{1}"),
        PushKind.ThreadSparked => ("Thread Sparked!", "A thread you accepted just became a match."),
        PushKind.TownSquareMatch => ("New Match!", "You both said yes in the Town Square."),
        PushKind.FlameRiteProposed => ("Flame Rite Proposed", "Your match wants to video-screen before pledging to meet."),
        PushKind.FlameRiteAccepted => ("Flame Rite Accepted", "Your match accepted the Flame Rite. Light the call when you are ready."),
        PushKind.DateConfirmed => ("Encounter Pledged", "You both pledged to meet. Open the activity for the details."),
        PushKind.MatchGhosted => ("A Thread Went Cold", "A match stayed silent too long and has been closed."),
        PushKind.MatchGhostedByYou => ("A Thread Went Cold", "You left a conversation unanswered. It has closed, and your score and standing have taken the cost."),
        PushKind.TownSquareStarting => ("The Town Square Is Open", "Your session has begun. Step in now."),
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, null),
    };

    private static (string, string) Mongolian(PushKind kind) => kind switch
    {
        PushKind.NewMatch => ("Шинэ таарал!", "{0} танд урилга илгээлээ."),
        PushKind.NewMessage => ("{0}", "{1}"),
        PushKind.ThreadSparked => ("Утас гялсхийлээ!", "Таны зөвшөөрсөн утас таарал боллоо."),
        PushKind.TownSquareMatch => ("Шинэ таарал!", "Та хоёр Хотын талбайд бие биедээ тийм гэлээ."),
        PushKind.FlameRiteProposed => ("Галын ёслол санал болголоо", "Таны таарал уулзахаасаа өмнө видеогоор ярилцахыг хүсэж байна."),
        PushKind.FlameRiteAccepted => ("Галын ёслолыг хүлээн авлаа", "Таны таарал Галын ёслолыг зөвшөөрлөө. Бэлэн болмогцоо дуудлагаа эхлүүлээрэй."),
        PushKind.DateConfirmed => ("Уулзалт батлагдлаа", "Та хоёр уулзахаа амлалаа. Дэлгэрэнгүйг үйл ажиллагаанаас хараарай."),
        PushKind.MatchGhosted => ("Утас хүйтэрлээ", "Нэг таарал хэт удаан чимээгүй байсан тул хаагдлаа."),
        PushKind.MatchGhostedByYou => ("Утас хүйтэрлээ", "Та нэг яриаг хариугүй орхилоо. Тэр хаагдаж, оноо болон нэр хүнд чинь буурлаа."),
        PushKind.TownSquareStarting => ("Хотын талбай нээгдлээ", "Таны үе эхэллээ. Одоо ороорой."),
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, null),
    };
}
