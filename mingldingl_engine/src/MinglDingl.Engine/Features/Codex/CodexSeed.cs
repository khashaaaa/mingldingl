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
            ["seals"] = ("Лац хэрхэн эвдэрдэг вэ", "Царай ярилцаж байж нээгдэнэ",
                "Шинэ холбоонд нэр, лацтай хөрөг, домог харагдана. Та хоёрын солилцсон захидал бүр лацыг "
                + "элээнэ. Тус бүр таван захидал анхны лацыг эвдэнэ: анхны хөрөг. Арав нь хоёр дахь хөргийг; "
                + "арван тав нь гурав дахийг, бас дүүрэг нээгдэнэ. Гуч нь сүүлчийн лацыг эвдэж, баатар бүтнээрээ "
                + "нээгдэнэ. Хоёр талын захидал л тоологдоно — ганцаараа ярихад юу ч эвдэрдэггүй."),
            ["fire"] = ("Гал ба хүйтэн", "Чимээгүй байдал яагаад үнэтэй вэ",
                "Хэн нэгэн чамд бичихэд гал чиний гарт байна. Хоёр өдрийн дотор хариулбал шатсаар. Орхивол "
                + "гал хөрнө — цайз галыг унтраасан хүнээс өөрийн хувийг авна. Хэзээ ч бичээгүй хүн хэзээ ч "
                + "буруугүй."),
            ["gems"] = ("Эрдэнэ ба Өгсөлт", "Оноо хэрхэн олж, алддаг вэ",
                "Гавьяа бүр оноо авчирна: өдөр бүрийн анхны үүр, хариу захидал, мөс хагалах, Сорил, Галын "
                + "ёслол, сахисан уулзалт. Оноо эрдэнийг чинь өргөнө — Анар, Гэрэлт чимэд, Ягаан болор, Индранил, "
                + "Бадмаараг, Маргад — өндөр эрдэнэ Хайх хэсэгт илүү олон лаа асаана. Галаа хөргөвөл оноо алдана. "
                + "Эрдэнийг хэзээ ч худалдаж авдаггүй."),
            ["safety"] = ("Аюулгүй уулзах нь", "Олон нийтийн газар, найздаа хэлж, эхлээд ёслол",
                "Цайзын шалгасан газруудад л уулз, боломжтой бол өдрийн цагаар. Эхлээд Галын ёслол асаа: "
                + "нэг ширээнд суухаас өмнө таван минут нүүр тулан. \"Аюулгүй байдлын мэдээлэл хуваалцах\" товчоор "
                + "газар, цагаа найздаа илгээ. Хэн нэгэн мөнгө гуйвал гомдол гарга — манаач гомдол бүрийг "
                + "уншдаг."),
            ["guild"] = ("Наймааны өргөө", "Давхар бүр юуг өөрчилдөг вэ",
                "Хүн бүр Хашаанд үнэгүй зогсоно. Танхим ба Дээд ширээ шөнө бүр илүү лаа өгч, баатрын гүн "
                + "хуудсыг нээнэ. Давхар хэзээ ч оноо, эрдэнэ, эсвэл хэний ч Хайх хэсэг дэх байрыг худалдаж авдаггүй."),
            ["terms"] = ("Цайзын нөхцөл", "Нөхцөл · Нууцлал",
                "Дугаар чинь чамайг нэг хүн гэдгийг батална; хэнд ч харагдахгүй. Баатраа орхивол хөрөг, "
                + "захидал, холбоо нь гучин өдрийн дараа шатаагдана. Галын ёслолын видеог хэзээ ч бичихгүй, "
                + "хадгалахгүй. Гомдлыг манаач уншдаг бөгөөд шийдвэр гаргах хүртэл хэний ч байр суурь "
                + "өөрчлөгдөхгүй. Нөхцөл болон нууцлалын бүрэн мэдэгдэл Монгол, Англи хэлээр хадгалагдана."),
        };
}
