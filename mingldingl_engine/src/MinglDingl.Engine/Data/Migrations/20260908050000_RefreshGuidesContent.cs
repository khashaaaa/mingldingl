using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <summary>
    /// Settings → Guides is the one place the app explains itself, and it was describing a product
    /// that no longer exists. It sold the Platinum tier — retired by <c>RetirePlatinumTier</c> and
    /// now absent from the engine, the app and the admin panel, where buying it is refused outright
    /// — and it credited Gold with "a weekly spotlight and monthly extras to give out", neither of
    /// which was ever built. It also said Score falls when "a match reports you", which is not a
    /// mechanic, and it mentioned none of the Oath, the Flame Rite, Fated Threads, the Town Square,
    /// the Campaign or Honours, all of which shipped after it was written.
    /// <para>
    /// Each language is rewritten only where its body still carries the old text, fingerprinted on
    /// the Platinum sentence unique to it. ContentPages is admin-editable at runtime, and an edit
    /// made there must not be silently discarded by a deploy.
    /// </para>
    /// </summary>
    [DbContext(typeof(AppDbContext))]
    [Migration("20260908050000_RefreshGuidesContent")]
    public partial class RefreshGuidesContent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                UPDATE ""ContentPages"" SET ""BodyEn"" = 'GEMSTONE TIERS
Every profile carries a gem, and that gem tells the truth about you before a single word is exchanged. Start as Garnet, then rise through Opal, Amethyst, Sapphire, and Ruby, until the truly consistent reach Emerald. The climb can''t be bought — your gem tracks the Score you build through real effort, not currency you spend. Other adventurers read it as a measure of who actually shows up.

SCORE ECONOMY
Score is the pulse of your standing here. It rises with the things a good match deserves — logging in, opening a conversation, finishing an icebreaker or quiz, keeping a conversation alive instead of leaving someone waiting. It falls when you go silent in a conversation you were part of until it closes, or when you don''t turn up to an encounter you pledged. Score isn''t just a number to admire — it sets your gemstone tier and widens how many matches you see each day, so consistency compounds.

PROGRESSIVE REVEAL
Every new match starts as a mystery, and that''s by design. At first you''ll see a first name, one photo, and a short bio — enough to decide if the conversation is worth starting. Keep talking, and more reveals itself: another photo, their age, their district, and eventually the deeper details of who they are. Only messages the two of you both send count towards it, so talking into someone''s silence never opens their profile. Go quiet for too long, and the reveal freezes exactly where you left it.

MEMBERSHIP TIERS
Free members already get the full core experience — daily matches, icebreakers, quizzes, everything that makes this feel alive. Silver widens your daily reach and shows compatibility at a glance. Gold widens it further and adds priority matching, which weighs shared Oaths and compatibility inside your own area rather than simply serving the nearest people first. The game plays the same at every tier — membership only changes how far and how fast you move through it.

ICEBREAKERS & QUIZZES
Silence is the enemy of every new match, so we never let a conversation start cold. The moment you match, an icebreaker question waits for both of you — answer independently, and the reveal happens together. Clear that, and a short compatibility quiz follows, turning a vague feeling into a number you can actually see. Both earn Score, but more importantly, they turn two strangers into a conversation before either of you has to find the first words alone.

THE OATH
Swear an Oath — Bond, Fate, or Kinship — to say plainly what you are here for. Discover weighs a shared Oath when it ranks people, so an Oath is not decoration; it changes who you are shown. Keeping the encounters you pledge is what proves it, and a proven Oath is worn on your character sheet.

THE FLAME RITE
Before either of you pledges to meet, one side can propose the Flame Rite: a short video call the other has to accept. It is asked for and agreed to deliberately — no message count unlocks it — and it exists so you can see and hear each other before agreeing to meet in person.

FATED THREADS
Think two people you know belong together? Weave a thread between them. Neither learns who else was named unless both say yes; if they do, they match, and you are named as the Weaver who brought them together.

THE TOWN SQUARE
A gathering held at a set time and run as a series of short video rounds. RSVP before the roster locks, meet everyone on the other side one round at a time, then answer yes or no in private. Only a mutual yes becomes a match, and neither of you ever learns what the other answered.

THE CAMPAIGN
Every match carries a dungeon of its own. Its rooms open as the two of you talk, break the ice, and complete the Flame Rite; the Threshold at the end opens only once you have both confirmed the other turned up to a real encounter.

HONOURS
Titles and frames earned for things that actually happened — a first match, a completed rite, a kept encounter, a thread you wove that sparked. They are not bought and not random. Wear one on your character sheet; a frame is unlocked by your gem tier, so a tier you fall out of takes its frame with it.

STAYING SAFE
Always meet a new match in a public place for your first few dates. Never send money or financial details to someone you haven''t met in person. If something feels wrong, block and report them directly from the chat — we take it from there. A couple of days after a pledged encounter, each of you is asked whether the other turned up; being reported as a no-show repeatedly costs standing.', ""UpdatedAt"" = now() at time zone 'utc'
                WHERE ""Slug"" = 'guides'
                  AND ""BodyEn"" LIKE '%Platinum opens every door%';");

            migrationBuilder.Sql(@"
                UPDATE ""ContentPages"" SET ""BodyMn"" = 'ЭРДЭНИЙН ЧУЛУУНЫ ЗЭРЭГ
Профайл бүрт эрдэнийн чулуун зэрэг байдаг бөгөөд энэ чулуу таны тухай юу ч хэлэхээс өмнө үнэнийг харуулдаг. Гранатаас эхэлж, Опал, Аметист, Индранил, Бадмаарагаар дамжин, хамгийн тууштай хүмүүс эцэст нь Маргад хүрдэг. Энэ ахилтыг мөнгөөр худалдаж авах боломжгүй — зөвхөн хуримтлуулсан Оноогоор л ахина. Бусад адал явдалчид таны чулууг харж, та хэр тууштай оролцдогийг мэддэг.

ОНООНЫ ЭДИЙН ЗАСАГ
Оноо бол энд таны нэр хүндийн зүрхний цохилт юм. Нэвтрэх, шинэ яриа эхлүүлэх, мөс хагалагч болон шалгалт дуусгах, ярианы дунд хүнийг хүлээлгэхгүй байх зэрэг сайн үйлдэл бүрт Оноо нэмэгддэг. Харин өөрөө оролцож байсан яриагаа хаагдтал нь чимээгүй орхих буюу амласан уулзалтдаа ирэхгүй бол Оноо буурдаг. Оноо зүгээр тоо биш — таны эрдэнийн чулуун зэргийг тодорхойлж, өдөр тутмын тохиролын хязгаарыг өргөжүүлдэг тул тогтвортой байх нь үр дүнгээ өгдөг.

АЛХАМ БҮРЭЭР НЭЭГДЭХ ПРОФАЙЛ
Шинэ тохирол бүр нууц байдлаар эхэлдэг — энэ нь санаатай хийгдсэн зүйл. Эхэндээ зөвхөн нэр, нэг зураг, товч танилцуулгыг л харна — яриа өрнүүлэх эсэхээ шийдэхэд хангалттай. Ярианаа үргэлжлүүлбэл илүү ихийг харах болно: дараагийн зураг, нас, дүүрэг, эцэст нь тэдний гүнзгий мэдээлэл хүртэл. Зөвхөн хоёулаа илгээсэн зурвас тоологдох тул нөгөө хүний чимээгүй рүү ганцаараа бичсэн зурвас түүний профайлыг хэзээ ч нээхгүй. Хэрэв удаан хугацаанд хариу ирэхгүй бол нээлт тэр хэвээрээ зогсоно.

ГИШҮҮНЧЛЭЛИЙН ЗЭРЭГ
Үнэгүй гишүүд өдөр тутмын тохирол, мөс хагалагч, шалгалт зэрэг бүрэн туршлагыг аль хэдийн авдаг. Мөнгөн зэрэг таны хайлтын хүрээг өргөжүүлж, тохирлын хувийг шууд харуулна. Алтан зэрэг хүрээг улам өргөжүүлж, эрэмбийн давуу тал нэмнэ — энэ нь зөвхөн хамгийн ойрын хүмүүсийг эхэлж харуулахын оронд таны орчинд нийтлэг Тангараг болон тохирлыг тооцож эрэмбэлдэг. Ямар ч зэрэгт байсан тоглоомын дүрэм адилхан — зөвхөн хэр хол, хэр хурдан явахаас л ялгаатай.

МӨС ХАГАЛАГЧ БА ШАЛГАЛТ
Чимээгүй байдал бол тохирол бүрийн дайсан тул бид ярианыг хэзээ ч хүйтнээр эхлүүлдэггүй. Тохирсон даруйд мөс хагалах асуулт хоёуланг чинь хүлээнэ — тус тусад нь хариулж, дараа нь хариултаа хамт нээнэ. Үүнийг дуусгасны дараа товч тохирлын шалгалт ирнэ, энэ нь тодорхойгүй мэдрэмжийг та бодитоор харж болох тоо болгож өгдөг. Хоёулаа Оноо авах ба, хамгийн чухал нь — та хоёр өөрсдөө үг олохгүйгээр ч танихгүй хүнээс яриа өрнүүлж чадна.

ТАНГАРАГ
Юуны төлөө энд байгаагаа шулуухан хэлэхийн тулд Тангараг өргө — Хосын холбоо, Хувь заяа эсвэл Нөхөрлөл. Хайлт хүмүүсийг эрэмбэлэхдээ нийтлэг Тангаргийг тооцдог тул Тангараг бол чимэг биш; энэ нь танд хэн харагдахыг өөрчилдөг. Амласан уулзалтаа биелүүлэх нь үүнийг баталдаг бөгөөд баталсан Тангараг баатрын хуудсанд тань тодордог.

ГАЛЫН ЁСЛОЛ
Уулзахаар амлахаасаа өмнө аль нэг тань Галын ёслолыг санал болгож болно: нөгөө тал нь зөвшөөрөх ёстой богино видео дуудлага. Үүнийг зурвасын тоо нээдэггүй — санаатай санал болгож, санаатай зөвшөөрдөг. Биечлэн уулзахаар шийдэхээсээ өмнө бие биеэ харж, сонсох боломж юм.

ХУВЬ ТАВИЛАНГИЙН УТАСНУУД
Таны мэдэх хоёр хүн зохих юм шиг санагдаж байна уу? Тэдний хооронд утас нэх. Хоёулаа зөвшөөрөхөөс нааш аль нь ч нөгөөг нь мэдэхгүй; зөвшөөрвөл тэд тохирч, тэднийг холбосон Нэхмэлчээр таны нэр үлдэнэ.

ХОТЫН ТАЛБАЙ
Тогтсон цагт болох цуглаан бөгөөд богино видео үеүүдээр явагдана. Бүртгэл хаагдахаас өмнө бүртгүүлж, нөгөө талын хүн бүртэй ээлжлэн уулзаад, дараа нь нууцаар тийм эсвэл үгүй гэж хариул. Зөвхөн хоёр талын тийм л тохирол болно, нөгөө тал чинь юу хариулсныг та хэзээ ч мэдэхгүй.

АЯН
Тохирол бүр өөрийн гэсэн агуйтай. Та хоёр ярилцаж, мөс хагалж, Галын ёслолыг гүйцээх тусам түүний өрөөнүүд нээгдэнэ; төгсгөлийн Босго нь хоёулаа нөгөөгөө жинхэнэ уулзалтад ирснийг баталсны дараа л нээгдэнэ.

ЦОЛ ХЭРГЭМ
Үнэхээр болсон зүйлсийн төлөө олгогдох цол, хүрээ — анхны тохирол, гүйцээсэн ёслол, биелүүлсэн уулзалт, таны нэхсэн утас гялсхийсэн нь. Эдгээрийг худалдаж авдаггүй, санамсаргүй ч олгодоггүй. Баатрын хуудсандаа нэгийг нь зүү; хүрээг эрдэнийн чулуун зэрэг нээдэг тул зэрэг буурвал хүрээ нь ч хамт алга болно.

АЮУЛГҮЙ БАЙДАЛ
Эхний хэдэн уулзалтаа үргэлж олон нийтийн газар хийгээрэй. Биечлэн уулзаагүй хүнд мөнгө эсвэл санхүүгийн мэдээлэл бүү илгээ. Ямар нэг зүйл буруу мэт санагдвал, чат дотроос блоклож мэдээлээрэй — бид цаашид арга хэмжээ авна. Амласан уулзалтаас хойш хоёр хоногийн дараа нөгөө тал чинь ирсэн эсэхийг та тус бүрээс асууна; дахин дахин ирээгүй гэж мэдээлэгдвэл нэр хүнд буурна.', ""UpdatedAt"" = now() at time zone 'utc'
                WHERE ""Slug"" = 'guides'
                  AND ""BodyMn"" LIKE '%Цагаан алт зэрэг бүх хаалгыг нээнэ%';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Deliberately empty: the old text advertised a tier that can no longer be bought and a
            // perk that was never built, so restoring it would put both back in front of every user.
        }
    }
}
