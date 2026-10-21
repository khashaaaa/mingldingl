namespace MinglDingl.Engine.Features.Codex;

/// The Codex as first written (Figma 35:1254 / 35:1348 / 35:1410). The keepers edit it in the admin.
public static class CodexSeed
{
    public sealed record Page(string Slug, CodexKind Kind, string Title, string Summary, string Body);

    public static readonly IReadOnlyList<Page> Pages =
    [
        new("seals", CodexKind.Guide, "How seals break", "Faces are earned by talking",
            "A new bond shows a name, a sealed portrait and a tale. Every letter the two of you trade "
            + "wears at the seals. Five letters each break the first: the first portrait. Ten break the second "
            + "portrait; fifteen the third, and the district shows. Thirty break the last seal and the whole "
            + "character opens. Only letters on both sides count — a monologue breaks nothing."),
        new("fire", CodexKind.Guide, "The fire and the cold", "Why silence has a cost",
            "When someone writes to you, the fire is yours to keep. Answer within two days and it burns on. "
            + "Leave it, and the fire goes cold — the hold takes its due from whoever let it die. Someone who "
            + "never wrote is never at fault."),
        new("gems", CodexKind.Guide, "Gems and the Ascent", "How score is earned and lost",
            "Every deed earns points: the first dawn of each day, a reply, the icebreaker, the Trial, the "
            + "Flame Rite, a meeting kept. Points raise your gem — Garnet, Opal, Amethyst, Sapphire, Ruby, "
            + "Emerald — and a higher gem lights more candles in Seek. Letting a fire go cold costs points. "
            + "A gem is never bought."),
        new("safety", CodexKind.Guide, "Meeting safely", "Public places, a friend told, the Rite first",
            "Meet only at the places the hold has verified, in daylight hours if you can. Light the Flame "
            + "Rite first: five minutes face to face before you share a table. Use \"Share safety info\" to "
            + "send the place and time to a friend. If anyone asks for money, report them — the keepers read "
            + "every report."),
        new("first-letter", CodexKind.Guide, "Your first letter", "Begin with their tale, not their face",
            "Their face is sealed for a reason: start with what they wrote. Answer one thing from their tale "
            + "and ask one real question, one you would want answered yourself. Three or four lines is enough; "
            + "a long first letter is a weight to carry. Don't open with \"hi\" alone, and don't ask for photos "
            + "or a number. The seals will show you their face, if you both keep talking."),
        new("before-you-meet", CodexKind.Guide, "Before you meet", "A short first meeting, in the open",
            "Meet at the venue you swore to, in daylight if you can, and keep it to an hour or two. Tell a "
            + "friend where you will be and when; Share safety info does it in one tap. Come with two or three "
            + "things to ask about the life in their letters. Pay your own way or take turns; no one owes "
            + "anyone. If something feels wrong, leave. You need no reason, and the keepers will listen if you "
            + "report it."),
        new("letting-go", CodexKind.Guide, "When to let go", "Ending kindly, and early",
            "Some fires don't catch. If the letters feel like work, if they never ask about you, or if your "
            + "answer to \"do I want to meet them?\" stays no, it is time. Sever costs nothing; silence costs "
            + "you points and leaves them waiting. A Sever tells them only that the paths parted, with no "
            + "blame, and gives back the candle they spent on you that night. Letting go early is a kindness "
            + "to both of you."),
        new("guild", CodexKind.Guide, "The Guild House", "What each floor changes",
            "Everyone stands in the Yard, free. The Hall and the High Table give more candles each night "
            + "and open the deep pages of a character. A floor never buys points, a gem, or a place in "
            + "anyone's Seek."),
        new("terms", CodexKind.Legal, "Terms of the hold", "Terms · Privacy",
            "Your number proves you are one person; it is never shown to anyone. When you abandon your "
            + "character, its portraits, letters and bonds are burned after thirty days. Video in the Flame "
            + "Rite is never recorded or stored. Reports are read by the keepers, and nothing changes "
            + "anyone's standing until a keeper decides. The full terms and privacy notice are kept in "
            + "Mongolian and English."),
    ];

    /// The same pages in Mongolian, by slug.
    public static readonly IReadOnlyDictionary<string, (string Title, string Summary, string Body)> Mn =
        new Dictionary<string, (string, string, string)>
        {
            ["seals"] = ("Лац хэрхэн эвдэрдэг вэ", "Ярилцсаар байж царай нээгдэнэ",
                "Шинэ холбоонд нэр, лацтай хөрөг, домог харагдана. Хоёул солилцсон захидал бүр лацыг "
                + "элээнэ. Тус бүр таван захидал бичихэд анхны лац эвдэрч, анхны хөрөг нээгдэнэ. Аравт хоёр "
                + "дахь хөрөг; арван тавд гурав дахь хөрөг, дүүрэг нь нээгдэнэ. Гучид сүүлчийн лац эвдэрч, баатар "
                + "бүтнээрээ нээгдэнэ. Хоёр талын захидал л тоологдоно — ганцаараа бичихэд юу ч эвдэрдэггүй."),
            ["fire"] = ("Гал ба хүйтэн", "Дуугүй өнгөрөх нь яагаад алдагдалтай вэ",
                "Хэн нэгэн чамд бичихэд гал чиний гарт байна. Хоёр өдрийн дотор хариулбал гал асаар байна. Орхивол "
                + "гал хөрнө — цайз галыг унтраасан хүнээс өөрийн хувийг авна. Хэзээ ч бичээгүй хүн хэзээ ч "
                + "буруугүй."),
            ["gems"] = ("Эрдэнэ ба Өгсөлт", "Оноог хэрхэн олж, алддаг вэ",
                "Гавьяа бүр оноо авчирна: өдөр бүрийн анхны үүр, хариу захидал, мөс хагалах, Сорил, Галын "
                + "ёслол, сахисан болзоо. Оноогоор эрдэнэ чинь дээшилнэ — Анар, Гэрэлт чимэд, Ягаан болор, Индранил, "
                + "Бадмаараг, Маргад — өндөр эрдэнэ Учралын тойрогт илүү олон лаа асаана. Галаа унтраавал оноо алдана. "
                + "Эрдэнийг мөнгөөр хэзээ ч авч болохгүй."),
            ["safety"] = ("Аюулгүй болзох нь", "Олон нийтийн газар, найздаа хэлж, эхлээд ёслол",
                "Цайзын шалгасан газруудад л болз, боломжтой бол өдрийн цагаар. Эхлээд Галын ёслол асаа: "
                + "нэг ширээнд суухаасаа өмнө таван минут нүүр нүүрээрээ ярилц. \"Аюулгүй байдлын мэдээлэл хуваалцах\" товчоор "
                + "газар, цагаа найздаа илгээ. Хэн нэгэн мөнгө гуйвал гомдол гарга — манаач гомдол бүрийг "
                + "уншдаг."),
            ["first-letter"] = ("Анхны захидал", "Царайнаас биш, домгоос нь эхэл",
                "Царай нь учиртай лацтай: бичсэн зүйлээс нь эхэл. Домгоос нь нэг зүйлд хариулж, хариултыг нь "
                + "өөрөө мэдмээр байгаа нэг жинхэнэ асуулт асуу. Гурав, дөрвөн мөр хангалттай; урт анхны захидал "
                + "үүрэхэд хүнд ачаа. Зөвхөн \"сайн уу\" гэж бүү эхэл, зураг эсвэл утасны дугаар бүү гуй. Хоёул "
                + "ярьсаар байвал лац царайг нь харуулна."),
            ["before-you-meet"] = ("Болзохоосоо өмнө", "Богинохон анхны болзоо, ил газар",
                "Товлосон газраа, боломжтой бол өдрийн цагаар болз, нэг хоёр цагаар хязгаарла. Хаана, хэзээ "
                + "байхаа найздаа хэл; \"Аюулгүй байдлын мэдээлэл хуваалцах\" товч үүнийг нэг товшилтоор хийнэ. "
                + "Захидлаас нь мэдсэн амьдралынх нь талаар асуух хоёр гурван зүйл бэлдээд оч. Өөрийнхөө "
                + "төлбөрийг төл эсвэл ээлжлэ; хэн ч хэнд өргүй. Ямар нэг зүйл таагүй санагдвал шууд гараад яв. Шалтгаан "
                + "тайлбарлах хэрэггүй; гомдол гаргавал манаач сонсоно."),
            ["letting-go"] = ("Хэзээ тавьж явуулах вэ", "Эелдгээр, эрт салах нь",
                "Зарим гал асдаггүй. Захидал бичих нь хүнд ажил мэт санагдах, эсвэл тэр чиний тухай юу ч асуудаггүй байх, эсвэл \"түүнтэй "
                + "болзмоор байна уу?\" гэхэд хариулт чинь үгүй хэвээр байвал цаг нь болжээ. Холбоо таслахад "
                + "юу ч алдахгүй; дуугүй өнгөрснөөр оноо чинь хорогдож, түүнийг дэмий хүлээлгэнэ. Таслахад "
                + "түүнд зөвхөн \"зам салсан\" гэж мэдэгдэнэ — үүнд хэнийг ч буруутгахгүй. Тэр шөнө чамд зарцуулсан "
                + "лааг нь ч буцааж өгнө. Эрт тавьж явуулах "
                + "нь хэн хэндээ үзүүлж буй энэрэл."),
            ["guild"] = ("Наймааны өргөө", "Давхар бүр юуг өөрчилдөг вэ",
                "Хүн бүр Хашаанд үнэгүй зогсоно. Танхим ба Дээд танхим шөнө бүр илүү лаа өгч, гүн профайлыг "
                + "нээнэ. Ямар ч давхар оноо, эрдэнэ, Учралын тойрог дахь байрыг худалдаж өгдөггүй."),
            ["terms"] = ("Цайзын нөхцөл", "Нөхцөл · Нууцлал",
                "Утасны дугаар чинь чамайг нэг л хүн гэдгийг батална; хэнд ч харагдахгүй. Баатраа орхивол хөрөг, "
                + "захидал, холбоо нь гучин өдрийн дараа шатаагдана. Галын ёслолын видеог хэзээ ч бичихгүй, "
                + "хадгалахгүй. Гомдлыг манаач уншдаг бөгөөд манаач шийдэх хүртэл хэнд ч юу ч "
                + "өөрчлөгдөхгүй. Нөхцөл болон нууцлалын бүрэн мэдэгдэл Монгол, Англи хэлээр хадгалагдана."),
        };
}
