using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Features.Wanderings;

/// The thirteen Wanderings as first written, in English and Mongolian (places checked 2026-10-20).
/// Boot writes any that are missing; a keeper's edits are never replaced.
public static class WanderingSeed
{
    private sealed record W(string Key, string Road, string Season, string[] Kinds, (string T, string L, string B, string P) En,
        (string T, string L, string B, string P) Mn);

    private static readonly IReadOnlyList<W> All =
    [
        new("stranger-dish", WanderingRoads.First, "any", ["Restaurant", "Cafe"],
            ("The Stranger's Dish", "Order for each other, unasked",
                "Each of you orders a dish for the other, without asking what they like. Eat what you were given, every bite, and say what it tells you about the one who chose it.",
                "Any place that feeds you; the keepers' verified restaurants and cafés are below."),
            ("Танихгүй хоол", "Асуулгүйгээр бие биедээ захиал",
                "Хоёулаа нөгөөдөө юунд дуртайг нь асуулгүйгээр нэг хоол захиална. Өгсөн хоолоо сүүлчийн хазалт хүртэл ид, тэгээд сонгосон хүнийх нь тухай энэ хоол юу хэлж байгааг хэл.",
                "Хоол өгдөг л газар; манаачийн шалгасан ресторан, кафе доор байна.")),
        new("small-things", WanderingRoads.First, "any", [],
            ("Small Things", "Three things neither of you saw",
                "Walk one street of a district you both know. Find three small things neither of you had ever noticed: a carving, a sign, a window. Name them together.",
                "Any street, in any district. Daylight is best."),
            ("Өчүүхэн зүйлс", "Хоёулаа анзаараагүй гурван зүйл",
                "Хоёулаа мэддэг дүүргийнхээ нэг гудамжаар алх. Хэн хэн нь урьд нь анзаарч байгаагүй гурван өчүүхэн зүйл ол: сийлбэр, хаяг, цонх. Хамтдаа нэрлэ.",
                "Аль ч дүүргийн аль ч гудамж. Өдрийн цагаар хамгийн сайхан.")),
        new("piece-of-me", WanderingRoads.First, "any", ["Culture"],
            ("A Piece of Me", "A museum: one piece that is you",
                "Walk a museum apart for a while. Each of you quietly picks one piece that feels like you: a painting, a statue, an old saddle. Then show each other, and say why.",
                "The Chinggis Khaan National Museum, the National Museum of Mongolia across from it, or the Bogd Khan Palace Museum."),
            ("Миний нэг хэсэг", "Музей: чамайг илэрхийлэх нэг зүйл",
                "Музейгээр хэсэг хугацаанд тусдаа алх. Хоёулаа өөрийгөө илэрхийлэх нэг зүйлийг чимээгүй сонго: зураг, баримал, хуучин эмээл. Дараа нь бие биедээ үзүүлж, яагаад гэдгээ хэл.",
                "Чингис хаан үндэсний музей, түүний эсрэг талын Монголын үндэсний музей, эсвэл Богд хааны ордон музей.")),
        new("songs-of-steppe", WanderingRoads.First, "juneSept", ["Culture", "Entertainment"],
            ("Songs of the Steppe", "Morin khuur and khöömii, live",
                "Hear the morin khuur or throat singing live. After, each says what it made you think of: a place, a memory, a person.",
                "Tumen Ekh, Tsagaan Lavai or Ganzam Palace. Best June to September; check the evening's show."),
            ("Талын дуу", "Морин хуур, хөөмий амьдаар",
                "Морин хуур эсвэл хөөмийг амьдаар сонс. Дараа нь хоёулаа энэ ая юуг санагдуулсныг хэл: газар, дурсамж, хүн.",
                "Түмэн эх, Цагаан лавай эсвэл Ганзам ордон. Зургаагаас есдүгээр сард хамгийн тохиромжтой; тухайн оройн тоглолтыг шалгаарай.")),
        new("the-board", WanderingRoads.First, "any", ["Cafe"],
            ("The Board", "Shatar or shagai; the loser picks next",
                "Bring a shatar set or a handful of shagai and play at a quiet table. Whoever loses chooses the next place you go.",
                "Any café with a table to spare. Bring the pieces."),
            ("Самбар", "Шатар эсвэл шагай; ялагдсан нь дараагийнхыг сонгоно",
                "Шатар эсвэл атга шагай аваад нам гүм ширээнд тогло. Ялагдсан нь дараагийн очих газрыг сонгоно.",
                "Сул ширээтэй аль ч кафе. Хөлгөө авч яваарай.")),
        new("names-in-script", WanderingRoads.First, "any", ["Cafe"],
            ("Our Names in Mongol Script", "Write each other's name, as a gift",
                "Each of you learns to write the other's name in Mongol bichig, the old upright script, then writes it by hand and gives it as a gift. Keep the one you were given.",
                "Anywhere with a pen: a café, a park bench. Calligraphy masters in the city teach it, if you want help."),
            ("Монгол бичгээр нэрс", "Бие биеийнхээ нэрийг бэлэг болгон бич",
                "Хоёулаа нөгөөгийнхөө нэрийг монгол бичгээр бичиж сурч, гараараа бичээд бэлэг болгон өг. Өгсөн нэрээ хадгал.",
                "Үзэг байхад л хаана ч болно: кафе, цэцэрлэгийн сандал. Тусламж хэрэгтэй бол хотод уран бичлэгийн багш нар заадаг.")),
        new("dawn-hill", WanderingRoads.Trusted, "warm", ["Outdoor"],
            ("Dawn on the Hill", "Zaisan before the sun",
                "Climb to the Zaisan Memorial before the sun, about three hundred steps, and watch the city wake between the four holy mountains. Bring something warm.",
                "Zaisan Memorial, south of the city. Spring to autumn."),
            ("Толгой дээрх үүр", "Нар гарахаас өмнө Зайсанд",
                "Нар гарахаас өмнө Зайсангийн дурсгалд гар, гурван зуу орчим шат бий. Дөрвөн хайрхны дунд хот сэрэхийг хамт хар. Дулаан юм авч яваарай.",
                "Хотын урд талын Зайсангийн дурсгал. Хавраас намар хүртэл.")),
        new("frozen-river", WanderingRoads.Trusted, "winter", ["Outdoor"],
            ("The Frozen River", "The Tuul's ice, then milk tea",
                "Skate, or just walk, on the frozen Tuul where the city slides in winter. Then warm your hands over milk tea and say who fell first.",
                "The frozen Tuul River, the open-air rink on the central square from mid-December, or the Steppe Arena indoors."),
            ("Хөлдсөн гол", "Туулын мөс, дараа нь сүүтэй цай",
                "Өвөл хотынхон гулгадаг хөлдсөн Туул дээр тэшүүрээр гулга, эсвэл зүгээр алх. Дараа нь сүүтэй цайнд гараа дулаацуулж, хэн нь түрүүлж унасныг хэл.",
                "Хөлдсөн Туул гол, арванхоёрдугаар сарын дундаас төв талбайн ил гулгуур, эсвэл дотор талын Стэпп Арена.")),
        new("coldest-day", WanderingRoads.Trusted, "nineNines", [],
            ("The Coldest Day", "The warmest place in a cold city",
                "On a day of the Nine Nines, find the warmest place in the city together and stay until you are both thawed. The coldest days are the best for it.",
                "Anywhere warm: a ger restaurant, a library, a café with a stove."),
            ("Хамгийн хүйтэн өдөр", "Хүйтэн хотын хамгийн дулаан газар",
                "Есөн есийн нэг өдөр хотын хамгийн дулаан газрыг хамтдаа олж, хоёулаа гэсэх хүртэл суу. Хамгийн хүйтэн өдрүүд үүнд хамгийн тохиромжтой.",
                "Дулаан л бол хаана ч болно: гэр ресторан, номын сан, зуухтай кафе.")),
        new("three-games", WanderingRoads.Trusted, "naadam", ["Outdoor"],
            ("The Three Games", "Archery, wrestling or the horses at Naadam",
                "At Naadam, watch one of the three manly games together: the archers, the wrestlers or the race horses. Each picks a champion before it starts.",
                "The National Stadium, the archery grounds beside it, or the horse races at Khui Doloon Khudag. July 11 to 15."),
            ("Эрийн гурван наадам", "Наадмын сур, бөх эсвэл морь",
                "Наадмаар эрийн гурван наадмын нэгийг хамт үз: сур харваа, бөх, эсвэл хурдан морь. Эхлэхээс өмнө хоёулаа нэг аварга сонго.",
                "Үндэсний цэнгэлдэх хүрээлэн, түүний хажуугийн сурын талбай, эсвэл Хүй долоон худгийн морин уралдаан. Долдугаар сарын 11-15.")),
        new("white-moon", WanderingRoads.Trusted, "tsagaanSar", [],
            ("Teach Me Your White Moon", "One Tsagaan Sar custom from each family",
                "Each teaches the other one Tsagaan Sar custom from their own family, the way it is done at home: a greeting, a dish, a game. Then try it together.",
                "At home or over milk tea, around Tsagaan Sar."),
            ("Цагаан сараа зааж өгөөч", "Гэр бүл бүрийн нэг цагаан сарын заншил",
                "Хоёулаа өөрийн гэр бүлийн нэг цагаан сарын заншлыг гэртээ хийдэг шигээ нөгөөдөө заа: золгох ёс, хоол, тоглоом. Дараа нь хамтдаа туршаад үз.",
                "Цагаан сарын үеэр гэртээ эсвэл сүүтэй цайны дэргэд.")),
        new("past-last-stop", WanderingRoads.Trusted, "summer", ["Outdoor"],
            ("Past the Last Bus Stop", "A day out to Terelj",
                "Leave the city for a day: Gorkhi-Terelj, the rocks and the river, a horse if you dare. Tell a friend where you are going and when you will be back.",
                "Gorkhi-Terelj National Park. The bus is slow and rare; a day tour or a shared taxi is easier. Summer."),
            ("Сүүлчийн буудлаас цааш", "Тэрэлж рүү нэг өдөр",
                "Нэг өдөр хотоос гар: Горхи-Тэрэлж, хад чулуу, гол, зүрхэлбэл морь. Хаашаа явж, хэзээ буцахаа найздаа хэл.",
                "Горхи-Тэрэлжийн байгалийн цогцолборт газар. Автобус удаан, ховор; нэг өдрийн аялал эсвэл хамтын такси амар. Зун.")),
        new("hands-for-others", WanderingRoads.Trusted, "any", [],
            ("Hands for Others", "One morning of help, together",
                "Give one morning together to something bigger than the two of you: a city clean-up day, or the animals at a shelter. Work side by side, then eat.",
                "The city's clean-up days (about eight a year), the youth Clean Up days in the National Park, or Lucky Paws: write to them first."),
            ("Бусдад гар өгөх", "Хамтдаа нэг өглөөний тусламж",
                "Хоёулаа нэг өглөөгөө өөрсдөөсөө том зүйлд зориул: хотын их цэвэрлэгээ, эсвэл амьтны асрамжийн газар. Мөр зэрэгцэн ажиллаад, дараа нь хооллоорой.",
                "Хотын их цэвэрлэгээ (жилд найм орчим), Үндэсний цэцэрлэгт хүрээлэнгийн залуусын цэвэрлэгээ, эсвэл Азтай савар: эхлээд тэдэнд бичээрэй.")),
    ];

    public static async Task SeedAsync(AppDb db, DateTimeOffset now, CancellationToken ct = default)
    {
        var have = await db.Set<Wandering>().Select(w => w.Key).ToListAsync(ct);
        db.AddRange(All.Select((w, i) => (W: w, Position: i)).Where(x => !have.Contains(x.W.Key)).Select(x => new Wandering
        {
            Key = x.W.Key, Position = x.Position, Road = x.W.Road, Season = x.W.Season, VenueKinds = x.W.Kinds,
            TitleEn = x.W.En.T, LineEn = x.W.En.L, BodyEn = x.W.En.B, WhereEn = x.W.En.P,
            TitleMn = x.W.Mn.T, LineMn = x.W.Mn.L, BodyMn = x.W.Mn.B, WhereMn = x.W.Mn.P, UpdatedAt = now,
        }));
        await db.SaveChangesAsync(ct);
    }
}
