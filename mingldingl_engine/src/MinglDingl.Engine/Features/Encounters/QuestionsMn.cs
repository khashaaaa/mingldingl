using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Features.Encounters;

/// The question banks in Mongolian, keyed by the English line they translate (icebreakers, Trial
/// questions with their topics, choices and hints, the weekly Exchange prompts). A row keeps the
/// English it was dealt with; the line is put in the viewer's language as it is shown, so two people
/// in one bond each read their own. A line missing here shows in English (a test keeps none missing).
public static class QuestionsMn
{
    public static string In(string text, string locale) =>
        locale == "mn" && Lines.TryGetValue(text, out var mn) ? mn : text;

    public static string[] In(IEnumerable<string> texts, string locale) => texts.Select(t => In(t, locale)).ToArray();

    /// The language the viewer chose ("en" until a profile says otherwise).
    public static async Task<string> LocaleAsync(AppDb db, Guid me, CancellationToken ct) =>
        await db.Set<Profile.Profile>().AsNoTracking().Where(p => p.AccountId == me).Select(p => p.Locale)
            .SingleOrDefaultAsync(ct) ?? "en";

    public static readonly IReadOnlyDictionary<string, string> Lines = new Dictionary<string, string>
    {
        // icebreakers
        ["If you could walk anywhere in Mongolia tomorrow, where would you go — and why?"] = "Маргааш Монголын аль ч газар очиж болдог бол хаашаа явах вэ, яагаад?",
        ["What is a sound that means home to you?"] = "Ямар чимээ чамд гэрээ санагдуулдаг вэ?",
        ["Which meal would you cook for someone you wanted to impress?"] = "Таалагдахыг хүссэн хүндээ ямар хоол хийж өгөх вэ?",
        ["What did you want to be when you were seven?"] = "Долоон настай байхдаа хэн болно гэж мөрөөддөг байсан бэ?",
        ["What is the best advice an older person ever gave you?"] = "Ахмад хүнээс сонссон хамгийн сайн зөвлөгөө юу вэ?",
        ["Where do you go when you need to think?"] = "Ганцаараа бодох хэрэгтэй үедээ хаашаа очдог вэ?",
        ["Which season are you, and why?"] = "Чи аль улиралтай хамгийн адилхан бэ, яагаад?",
        ["What small thing made you happy this week?"] = "Энэ долоо хоногт ямар жижиг зүйл чамайг баярлуулсан бэ?",
        ["What would you do with a free day and no one to answer to?"] = "Хэнд ч тайлагнах хэрэггүй, бүтэн чөлөөтэй нэг өдөр юу хийх вэ?",
        ["Which song would you play at the start of a long drive?"] = "Холын замд гарахдаа хамгийн түрүүнд ямар дуу тавих вэ?",
        ["What is something you are quietly proud of?"] = "Дотроо нууцхан бахархдаг зүйл чинь юу вэ?",
        ["If you could learn one skill overnight, which would it be?"] = "Нэг шөнийн дотор ямар нэг ур чадвар эзэмшиж болдог бол юуг сонгох вэ?",
        ["What is the kindest thing a stranger has done for you?"] = "Танихгүй хүн чиний төлөө хийж өгсөн хамгийн сайхан зүйл юу вэ?",
        ["Which old story or legend do you still think about?"] = "Ямар эртний үлгэр, домог одоо ч санаанаас чинь гардаггүй вэ?",
        ["What do you notice first when you walk into a room?"] = "Өрөөнд ороход юуг хамгийн түрүүнд анзаардаг вэ?",
        ["Tea or coffee — and how do you take it?"] = "Цай юу, кофе юу? Яаж уух дуртай вэ?",
        ["What would your friends say you are terrible at?"] = "Найзууд чинь чамайг юу огт чаддаггүй гэж хэлэх вэ?",
        ["Where in the world have you felt most free?"] = "Дэлхийн аль өнцөгт өөрийгөө хамгийн эрх чөлөөтэй мэдэрч байсан бэ?",
        ["What is a tradition from your family you would keep forever?"] = "Гэр бүлийнхээ ямар уламжлалыг насан туршдаа хадгалах вэ?",
        ["What makes you laugh when nothing else can?"] = "Юу ч инээлгэж чадахгүй үед чамайг юу инээлгэдэг вэ?",

        // Trial questions
        ["A free Saturday. You…"] = "Чөлөөт бямба гараг. Чи…",
        ["how a free Saturday begins"] = "чөлөөт бямба хэрхэн эхлэх",
        ["Ride out early"] = "Эрт мордоно",
        ["Horses, a river, no signal."] = "Морь, гол, сүлжээгүй.",
        ["Find a quiet café"] = "Нам гүм кафе олно",
        ["A book and a long tea."] = "Ном, удаан шимэх цай.",
        ["Gather friends"] = "Найзуудаа цуглуулна",
        ["A table full of noise and food."] = "Шуугиан, хоолоор дүүрэн ширээ.",
        ["Fix something"] = "Ямар нэг юм засна",
        ["A broken thing made whole by evening."] = "Эвдэрсэн юмыг орой гэхэд бүтэн болгоно.",

        ["The perfect evening ends…"] = "Төгс үдэш ингэж өндөрлөнө…",
        ["how an evening should end"] = "үдэш хэрхэн өндөрлөх",
        ["By the fire"] = "Галын дэргэд",
        ["Talk until the coals go grey."] = "Цог унтартал ярилцана.",
        ["Under the stars"] = "Одны доор",
        ["Out past the city lights."] = "Хотын гэрлээс хол.",
        ["Early to bed"] = "Эрт унтана",
        ["Tomorrow starts at dawn."] = "Маргааш үүрээр эхэлнэ.",
        ["Somewhere loud"] = "Шуугиантай газар",
        ["Music, and one more song."] = "Хөгжим, бас дахиад нэг дуу.",

        ["A long journey. You would rather…"] = "Холын аянд гарвал чи…",
        ["how to travel"] = "хэрхэн аялах",
        ["Plan every stop"] = "Буудал бүрээ урьдчилан төлөвлөнө",
        ["A map with every road marked."] = "Зам бүрийг тэмдэглэсэн газрын зураг.",
        ["Follow the road"] = "Замаа дагана",
        ["Turn where it looks good."] = "Сайхан харагдсан тийшээ эргэнэ.",
        ["Go with a guide"] = "Хөтөчтэй явна",
        ["Someone who knows the way."] = "Зам мэддэг хүн.",
        ["Stay home"] = "Гэртээ үлдэнэ",
        ["The best journeys are short ones."] = "Хамгийн сайхан аян бол богинохон нь.",

        ["When a friend is sad, you…"] = "Найз чинь гунигтай байхад чи…",
        ["how to comfort a friend"] = "найзаа хэрхэн тайтгаруулах",
        ["Listen"] = "Сонсоно",
        ["Say little, stay long."] = "Цөөн үг хэлж, удаан хажууд нь сууна.",
        ["Make them laugh"] = "Инээлгэнэ",
        ["A joke to break the cloud."] = "Уйтгарын үүлийг сарниулах нэг онигоо.",
        ["Cook for them"] = "Хоол хийж өгнө",
        ["A warm bowl says it all."] = "Халуун шөл бүх үгнээс илүү.",
        ["Make a plan"] = "Төлөвлөгөө гаргана",
        ["Fix what can be fixed."] = "Засаж болохыг засна.",

        ["Your home would be…"] = "Мөрөөдлийн гэр чинь…",
        ["what makes a home"] = "гэрийг юу гэр болгодог",
        ["A ger in the steppe"] = "Хээр талын гэр",
        ["Wide sky, few neighbours."] = "Уудам тэнгэр, цөөн хөрш.",
        ["A flat in the city"] = "Хотын байр",
        ["Everything a walk away."] = "Бүх юм алхах зайтай.",
        ["A house by water"] = "Усны эргийн байшин",
        ["A lake at the door."] = "Үүдэнд нь нуур.",
        ["Wherever family is"] = "Гэр бүл хаана байна, тэнд",
        ["Walls matter less than people."] = "Ямар гэрт биш, хэнтэй амьдрах нь чухал.",

        ["A quarrel. You…"] = "Хэрэлдчихвэл чи…",
        ["how to settle a quarrel"] = "хэрүүлийг хэрхэн намжаах",
        ["Talk it out now"] = "Тэр дор нь ярилцана",
        ["No sleeping on anger."] = "Уураа тээж унтахгүй.",
        ["Take a walk first"] = "Эхлээд алхана",
        ["Cool the iron, then speak."] = "Уураа намжаагаад, дараа нь ярина.",
        ["Write it down"] = "Бичгээр хэлнэ",
        ["Words chosen with care."] = "Нягталж сонгосон үгс.",
        ["Let it pass"] = "Өнгөрөөнө",
        ["Most storms blow over."] = "Ихэнх шуурга намждаг.",

        ["Morning or night?"] = "Өглөө юу, шөнө юу?",
        ["morning and night"] = "өглөө ба шөнө",
        ["First light"] = "Анхны гэгээ",
        ["Up before the sun."] = "Нараас өмнө босно.",
        ["Midday"] = "Үд",
        ["Neither early nor late."] = "Эрт ч биш, орой ч биш.",
        ["Dusk"] = "Бүрэнхий",
        ["The best hour of the day."] = "Өдрийн хамгийн сайхан цаг.",
        ["Deep night"] = "Шөнө дунд",
        ["When the world is quiet."] = "Хорвоо нам гүм болсон үед.",

        ["A gift you would treasure…"] = "Чиний нандигнах бэлэг…",
        ["what a gift should be"] = "бэлэг ямар байх ёстой",
        ["Something handmade"] = "Гараар хийсэн зүйл",
        ["Hours in every stitch."] = "Оёдол бүрт олон цагийн хөдөлмөр.",
        ["A shared day"] = "Хамт өнгөрөөсөн өдөр",
        ["Time, not things."] = "Эд зүйл биш, хамт өнгөрөөх цаг.",
        ["A letter"] = "Захидал",
        ["Words to keep."] = "Насан туршдаа хадгалах үгс.",
        ["Something useful"] = "Хэрэгтэй зүйл",
        ["A good knife, a warm coat."] = "Сайн хутга, дулаан дээл.",

        ["With money to spare, you…"] = "Илүү мөнгөтэй болбол чи…",
        ["what money is for"] = "мөнгө юунд хэрэгтэй",
        ["Save it"] = "Хуримтлуулна",
        ["For the hard winter."] = "Хатуу өвлийн нөөц.",
        ["Travel"] = "Аялна",
        ["See what is over the hill."] = "Давааны цаана юу байгааг үзнэ.",
        ["Share it"] = "Хуваалцана",
        ["Family first."] = "Гэр бүл хамгийн түрүүнд.",
        ["Build something"] = "Ямар нэг юм босгоно",
        ["A business, a home, a future."] = "Бизнес, гэр, ирээдүй.",

        ["Tsagaan Sar morning. You are…"] = "Цагаан сарын өглөө. Чи…",
        ["how a holiday should feel"] = "баяр ямар байх ёстой",
        ["Visiting elders"] = "Ахмадуудтайгаа золгоно",
        ["Every door, every greeting."] = "Айл бүр, золголт бүр.",
        ["Cooking all night"] = "Шөнөжин хоол хийнэ",
        ["Buuz by the hundred."] = "Зуу зуугаар нь бууз чимхэнэ.",
        ["Resting"] = "Амарна",
        ["The year starts slow."] = "Шинэ жил аажуухан эхэлнэ.",
        ["Out with friends"] = "Найзуудтайгаа гадуур",
        ["The new year, loudly."] = "Шинэ жилээ шуугиантай угтана.",

        ["A day of rain. You…"] = "Бороотой өдөр. Чи…",
        ["a day of rain"] = "бороотой өдөр",
        ["Stay in"] = "Гэртээ байна",
        ["Blankets and a film."] = "Хөнжил, кино.",
        ["Walk in it"] = "Бороонд алхана",
        ["Rain never hurt anyone."] = "Бороонд норсноор хэн ч хайлаагүй.",
        ["Clean the house"] = "Гэрээ цэвэрлэнэ",
        ["A good day for order."] = "Эмх цэгц тогтооход тохиромжтой өдөр.",
        ["Call someone"] = "Хэн нэгэн рүү залгана",
        ["Long talk, slow tea."] = "Цайгаа шимэнгээ удаан ярилцана.",

        ["What matters most in a partner?"] = "Ханьд хамгийн чухал чанар юу вэ?",
        ["what matters most in a partner"] = "ханьд хамгийн чухал чанар",
        ["Honesty"] = "Үнэнч байдал",
        ["Hard truths, kindly told."] = "Хатуу үнэнийг зөөлөн хэлнэ.",
        ["Humour"] = "Хошин мэдрэмж",
        ["Laughter on the long road."] = "Урт замд инээд хөөр.",
        ["Steadiness"] = "Тогтвортой байдал",
        ["Someone who shows up."] = "Хэрэгтэй үед ирдэг хүн.",
        ["Curiosity"] = "Сониуч зан",
        ["Always another question."] = "Үргэлж дахиад нэг асуулт.",

        // the weekly Exchange
        ["Tell the other one thing you have never told anyone here."] = "Энд хэнд ч хэлж байгаагүй нэг зүйлээ түүнд хэл.",
        ["Tell the other the moment this year you felt most like yourself."] = "Энэ жил яг өөрийнхөөрөө байна гэж хамгийн их мэдэрсэн агшнаа түүнд хэл.",
        ["Tell the other a place you want to see before you are old."] = "Хөгшрөхөөсөө өмнө заавал очиж үзэхийг хүсдэг газраа түүнд хэл.",
        ["Tell the other something you were wrong about, and how you found out."] = "Андуурч явсан нэг зүйлээ, түүнийгээ яаж ойлгосноо түүнд хэл.",
        ["Tell the other what a perfect ordinary Tuesday looks like."] = "Ердийн нэг мягмар гараг ямар байвал чамд төгс вэ, түүнд хэл.",
        ["Tell the other a fear you have outgrown."] = "Даван туулсан нэг айдсаа түүнд хэл.",
        ["Tell the other who taught you the most, and what."] = "Чамд хамгийн ихийг хэн зааж, юу заасныг түүнд хэл.",
        ["Tell the other one thing they said that stayed with you."] = "Түүний хэлсэн үгнээс сэтгэлд чинь хоногшсон нэгийг нь түүнд хэл.",
    };
}
