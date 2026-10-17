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
        ["If you could walk anywhere in Mongolia tomorrow, where would you go — and why?"] = "Маргааш Монголын хаана ч алхаж болдог бол хаашаа явах вэ — яагаад?",
        ["What is a sound that means home to you?"] = "Чамд гэрийг санагдуулдаг дуу чимээ юу вэ?",
        ["Which meal would you cook for someone you wanted to impress?"] = "Гайхшруулахыг хүссэн хүндээ ямар хоол хийж өгөх вэ?",
        ["What did you want to be when you were seven?"] = "Долоон настайдаа хэн болохыг хүсдэг байв?",
        ["What is the best advice an older person ever gave you?"] = "Ахмад хүнээс сонссон хамгийн сайн зөвлөгөө юу вэ?",
        ["Where do you go when you need to think?"] = "Бодох хэрэгтэй үедээ хаашаа явдаг вэ?",
        ["Which season are you, and why?"] = "Чи аль улирал вэ, яагаад?",
        ["What small thing made you happy this week?"] = "Энэ долоо хоногт ямар жижиг зүйл чамайг баярлуулсан бэ?",
        ["What would you do with a free day and no one to answer to?"] = "Хэнд ч дагаваргүй чөлөөт өдөр юу хийх вэ?",
        ["Which song would you play at the start of a long drive?"] = "Холын замын эхэнд ямар дуу тавих вэ?",
        ["What is something you are quietly proud of?"] = "Чимээгүйхэн бахархдаг зүйл чинь юу вэ?",
        ["If you could learn one skill overnight, which would it be?"] = "Нэг шөнийн дотор нэг ур чадвар сурч болдог бол юуг сонгох вэ?",
        ["What is the kindest thing a stranger has done for you?"] = "Танихгүй хүний чамд хийсэн хамгийн сайхан сэтгэлийн үйл юу вэ?",
        ["Which old story or legend do you still think about?"] = "Ямар эртний үлгэр домгийг одоо ч эргэцүүлдэг вэ?",
        ["What do you notice first when you walk into a room?"] = "Өрөөнд ороход юуг хамгийн түрүүнд анзаардаг вэ?",
        ["Tea or coffee — and how do you take it?"] = "Цай юу, кофе юу — ямрыг нь уудаг вэ?",
        ["What would your friends say you are terrible at?"] = "Найзууд чинь чамайг юунд муу гэж хэлэх вэ?",
        ["Where in the world have you felt most free?"] = "Дэлхийн хаана хамгийн чөлөөтэй санагдаж байсан бэ?",
        ["What is a tradition from your family you would keep forever?"] = "Гэр бүлийнхээ аль уламжлалыг үүрд хадгалах вэ?",
        ["What makes you laugh when nothing else can?"] = "Юу ч инээлгэж чадахгүй үед чамайг юу инээлгэдэг вэ?",

        // Trial questions
        ["A free Saturday. You…"] = "Чөлөөт бямба гараг. Чи…",
        ["how a free Saturday begins"] = "чөлөөт бямба хэрхэн эхлэх",
        ["Ride out early"] = "Эрт мордоно",
        ["Horses, a river, no signal."] = "Морь, гол, сүлжээгүй.",
        ["Find a quiet café"] = "Нам гүм кафе олно",
        ["A book and a long tea."] = "Ном, удаан уух цай.",
        ["Gather friends"] = "Найзуудаа цуглуулна",
        ["A table full of noise and food."] = "Шуугиан, хоолоор дүүрэн ширээ.",
        ["Fix something"] = "Ямар нэг юм засна",
        ["A broken thing made whole by evening."] = "Эвдэрсэн юмыг орой гэхэд бүтэн болгоно.",

        ["The perfect evening ends…"] = "Төгс орой төгсдөг нь…",
        ["how an evening should end"] = "орой хэрхэн төгсөх",
        ["By the fire"] = "Галын дэргэд",
        ["Talk until the coals go grey."] = "Цог саарал болтол ярилцана.",
        ["Under the stars"] = "Одны доор",
        ["Out past the city lights."] = "Хотын гэрлээс цааш.",
        ["Early to bed"] = "Эрт унтана",
        ["Tomorrow starts at dawn."] = "Маргааш үүрээр эхэлнэ.",
        ["Somewhere loud"] = "Шуугиантай газар",
        ["Music, and one more song."] = "Хөгжим, бас нэг дуу.",

        ["A long journey. You would rather…"] = "Холын аян. Чи илүүд үзнэ…",
        ["how to travel"] = "хэрхэн аялах",
        ["Plan every stop"] = "Буудал бүрийг төлөвлөнө",
        ["A map with every road marked."] = "Зам бүрийг тэмдэглэсэн газрын зураг.",
        ["Follow the road"] = "Замаа дагана",
        ["Turn where it looks good."] = "Сайхан харагдсан тийшээ эргэнэ.",
        ["Go with a guide"] = "Хөтөчтэй явна",
        ["Someone who knows the way."] = "Зам мэддэг хүн.",
        ["Stay home"] = "Гэртээ үлдэнэ",
        ["The best journeys are short ones."] = "Хамгийн сайн аян бол богино нь.",

        ["When a friend is sad, you…"] = "Найз чинь гуниглахад чи…",
        ["how to comfort a friend"] = "найзыгаа хэрхэн тайвшруулах",
        ["Listen"] = "Сонсоно",
        ["Say little, stay long."] = "Цөөн үг, удаан дэргэд.",
        ["Make them laugh"] = "Инээлгэнэ",
        ["A joke to break the cloud."] = "Үүл сарниулах нэг шог.",
        ["Cook for them"] = "Хоол хийж өгнө",
        ["A warm bowl says it all."] = "Халуун аяга бүгдийг хэлнэ.",
        ["Make a plan"] = "Төлөвлөгөө гаргана",
        ["Fix what can be fixed."] = "Засаж болохыг засна.",

        ["Your home would be…"] = "Чиний гэр бол…",
        ["what makes a home"] = "гэрийг юу гэр болгодог",
        ["A ger in the steppe"] = "Хээр талын гэр",
        ["Wide sky, few neighbours."] = "Уудам тэнгэр, цөөн хөрш.",
        ["A flat in the city"] = "Хотын байр",
        ["Everything a walk away."] = "Бүх юм алхаад хүрнэ.",
        ["A house by water"] = "Усны эрэг дээрх байшин",
        ["A lake at the door."] = "Үүдэнд нуур.",
        ["Wherever family is"] = "Гэр бүл хаана байна, тэнд",
        ["Walls matter less than people."] = "Ханаас хүн чухал.",

        ["A quarrel. You…"] = "Хэрүүл. Чи…",
        ["how to settle a quarrel"] = "хэрүүлийг хэрхэн намжаах",
        ["Talk it out now"] = "Одоо л ярилцана",
        ["No sleeping on anger."] = "Уураа тээж унтахгүй.",
        ["Take a walk first"] = "Эхлээд алхана",
        ["Cool the iron, then speak."] = "Төмрөө хөргөөд, дараа нь ярь.",
        ["Write it down"] = "Бичиж үлдээнэ",
        ["Words chosen with care."] = "Нягт сонгосон үгс.",
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
        ["When the world is quiet."] = "Ертөнц нам гүм болох үед.",

        ["A gift you would treasure…"] = "Чиний нандигнах бэлэг…",
        ["what a gift should be"] = "бэлэг ямар байх ёстой",
        ["Something handmade"] = "Гараар хийсэн зүйл",
        ["Hours in every stitch."] = "Оёдол бүрт цаг хугацаа.",
        ["A shared day"] = "Хамт өнгөрөөсөн өдөр",
        ["Time, not things."] = "Эд биш, цаг хугацаа.",
        ["A letter"] = "Захидал",
        ["Words to keep."] = "Хадгалах үгс.",
        ["Something useful"] = "Хэрэгтэй зүйл",
        ["A good knife, a warm coat."] = "Сайн хутга, дулаан дээл.",

        ["With money to spare, you…"] = "Илүү мөнгөтэй болбол чи…",
        ["what money is for"] = "мөнгө юунд хэрэгтэй",
        ["Save it"] = "Хуримтлуулна",
        ["For the hard winter."] = "Хатуу өвөлд зориулж.",
        ["Travel"] = "Аялна",
        ["See what is over the hill."] = "Толгойн цаана юу байгааг харна.",
        ["Share it"] = "Хуваалцана",
        ["Family first."] = "Гэр бүл нэгдүгээрт.",
        ["Build something"] = "Ямар нэг юм босгоно",
        ["A business, a home, a future."] = "Бизнес, гэр, ирээдүй.",

        ["Tsagaan Sar morning. You are…"] = "Цагаан сарын өглөө. Чи…",
        ["how a holiday should feel"] = "баяр ямар байх ёстой",
        ["Visiting elders"] = "Ахмадуудаараа золгоно",
        ["Every door, every greeting."] = "Айл бүр, золголт бүр.",
        ["Cooking all night"] = "Шөнөжин хоол хийнэ",
        ["Buuz by the hundred."] = "Зуу зуугаар нь бууз.",
        ["Resting"] = "Амарна",
        ["The year starts slow."] = "Шинэ он аажуухан эхэлнэ.",
        ["Out with friends"] = "Найзуудтайгаа гадуур",
        ["The new year, loudly."] = "Шинэ он, шуугиантай.",

        ["A day of rain. You…"] = "Бороотой өдөр. Чи…",
        ["a day of rain"] = "бороотой өдөр",
        ["Stay in"] = "Гэртээ байна",
        ["Blankets and a film."] = "Хөнжил, кино.",
        ["Walk in it"] = "Бороонд алхана",
        ["Rain never hurt anyone."] = "Бороо хэнийг ч гэмтээгээгүй.",
        ["Clean the house"] = "Гэрээ цэвэрлэнэ",
        ["A good day for order."] = "Эмх цэгцэнд сайхан өдөр.",
        ["Call someone"] = "Хэн нэгэн рүү залгана",
        ["Long talk, slow tea."] = "Урт яриа, удаан цай.",

        ["What matters most in a partner?"] = "Ханьд юу хамгийн чухал вэ?",
        ["what matters most in a partner"] = "ханьд юу хамгийн чухал",
        ["Honesty"] = "Үнэнч байдал",
        ["Hard truths, kindly told."] = "Хатуу үнэнийг зөөлөн хэлнэ.",
        ["Humour"] = "Хошин шог",
        ["Laughter on the long road."] = "Холын замд инээд.",
        ["Steadiness"] = "Тогтвортой байдал",
        ["Someone who shows up."] = "Хэрэгтэй үед ирдэг хүн.",
        ["Curiosity"] = "Сониуч зан",
        ["Always another question."] = "Үргэлж дахиад нэг асуулт.",

        // the weekly Exchange
        ["Tell the other one thing you have never told anyone here."] = "Энд хэнд ч хэлж байгаагүй нэг зүйлээ нөгөөдөө хэл.",
        ["Tell the other the moment this year you felt most like yourself."] = "Энэ жил хамгийн их өөрийнхөөрөө байсан агшнаа нөгөөдөө хэл.",
        ["Tell the other a place you want to see before you are old."] = "Хөгшрөхөөсөө өмнө үзэхийг хүссэн газраа нөгөөдөө хэл.",
        ["Tell the other something you were wrong about, and how you found out."] = "Буруу байсан нэг зүйлээ, түүнийгээ хэрхэн мэдсэнээ нөгөөдөө хэл.",
        ["Tell the other what a perfect ordinary Tuesday looks like."] = "Төгс энгийн мягмар гараг ямар байдгийг нөгөөдөө хэл.",
        ["Tell the other a fear you have outgrown."] = "Даван туулсан нэг айдсаа нөгөөдөө хэл.",
        ["Tell the other who taught you the most, and what."] = "Чамд хэн хамгийн их зүйл зааж, юу заасныг нөгөөдөө хэл.",
        ["Tell the other one thing they said that stayed with you."] = "Түүний хэлсэн, сэтгэлд чинь үлдсэн нэг зүйлийг хэл.",
    };
}
