using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddContentPages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ContentPages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Slug = table.Column<string>(type: "text", nullable: false),
                    TitleEn = table.Column<string>(type: "text", nullable: false),
                    TitleMn = table.Column<string>(type: "text", nullable: false),
                    BodyEn = table.Column<string>(type: "text", nullable: false),
                    BodyMn = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ContentPages", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ContentPages_Slug",
                table: "ContentPages",
                column: "Slug",
                unique: true);

            migrationBuilder.InsertData(
                table: "ContentPages",
                columns: new[] { "Id", "Slug", "TitleEn", "TitleMn", "BodyEn", "BodyMn", "UpdatedAt" },
                values: new object[,]
                {
                    {
                        new Guid("a1000000-0000-0000-0000-000000000001"),
                        "terms",
                        "Terms of Service",
                        "Үйлчилгээний нөхцөл",
                        "Terms of Service — full text coming soon.\n\nThis placeholder confirms the in-app link works; the binding legal text will be added by the team before public launch.",
                        "Үйлчилгээний нөхцөл — бүрэн эх бичвэр удахгүй нэмэгдэнэ.\n\nЭнэ түр агуулга нь холбоос ажиллаж байгааг баталгаажуулна; хууль зүйн эцсийн эх бичвэрийг баг нийтийн нээлтээс өмнө нэмэх болно.",
                        new DateTime(2026, 7, 28, 0, 0, 0, DateTimeKind.Utc)
                    },
                    {
                        new Guid("a1000000-0000-0000-0000-000000000002"),
                        "privacy",
                        "Privacy Policy",
                        "Нууцлалын бодлого",
                        "Privacy Policy — full text coming soon.\n\nThis placeholder confirms the in-app link works; the binding legal text will be added by the team before public launch.",
                        "Нууцлалын бодлого — бүрэн эх бичвэр удахгүй нэмэгдэнэ.\n\nЭнэ түр агуулга нь холбоос ажиллаж байгааг баталгаажуулна; хууль зүйн эцсийн эх бичвэрийг баг нийтийн нээлтээс өмнө нэмэх болно.",
                        new DateTime(2026, 7, 28, 0, 0, 0, DateTimeKind.Utc)
                    },
                    {
                        new Guid("a1000000-0000-0000-0000-000000000003"),
                        "guides",
                        "Guides",
                        "Гарын авлага",
                        "FINDING MATCHES\nDiscover shows the adventurers nearest to you first — as the closest ranks thin out, farther seekers take their place. Gold and Platinum members also see deeper compatibility matches within their local area, not just the nearest.\n\nICEBREAKERS & QUIZZES\nEvery new match starts as a mystery. Exchange messages to unlock icebreaker questions, then a quiz — each step reveals a little more of who they are, until the full profile (and eventually video call) unlocks.\n\nSTAYING SAFE\nAlways meet new matches in public places for the first few dates. Never send money or financial details to someone you haven't met in person. If something feels wrong, block and report them from the chat — we take it from there.\n\nSCORE & RANKS\nEvery login, message, and completed activity earns Score. Climb through Garnet, Opal, Amethyst, Sapphire, Ruby, and Emerald tiers as your Score grows. Membership tiers (Silver, Gold, Platinum) are separate — they grant extra daily matches and, for Gold/Platinum, priority matching.",
                        "ТОГЛОГЧ ОЛОХ\nХайлт таны хамгийн ойрхон адал явдалчдыг эхэлж харуулна — ойрын хүмүүс цөөрөх тусам холын хайгчид тэдний оронд гарч ирнэ. Алт болон Цагаан алт гишүүд өөрийн орчинд илүү гүнзгий тохиролыг мөн эхэнд харна.\n\nМӨС ХАГАЛАГЧ БА ШАЛГАЛТ\nШинэ тохирол бүр нууц байдлаар эхэлдэг. Зурвас солилцож мөс хагалах асуултуудыг, дараа нь шалгалтыг нээ — алхам бүр тэдний тухай илүү ихийг илчилнэ, эцэст нь бүтэн профайл (мөн видео дуудлага) нээгдэнэ.\n\nАЮУЛГҮЙ БАЙДАЛ\nЭхний хэдэн уулзалтаа үргэлж олон нийтийн газар хийгээрэй. Биечлэн уулзаагүй хүнд мөнгө эсвэл санхүүгийн мэдээлэл бүү илгээ. Ямар нэг зүйл буруу мэт санагдвал, чат дотроос блоклож мэдээлээрэй — бид цаашид арга хэмжээ авна.\n\nОНОО БА ЗЭРЭГЛЭЛ\nНэвтрэх, зурвас бичих, үйл ажиллагаа хийх бүрдээ Оноо хуримтлуулна. Гранат, Опал, Аметист, Сапфир, Рубин, Эмеральд зэргүүдээр Оноо өсөх тусам ахина. Гишүүнчлэлийн зэрэглэл (Мөнгөн, Алтан, Цагаан алт) энэ хараат бус — өдөр тутмын тохирол нэмж, Алт/Цагаан алт нь давуу тохиролтой болно.",
                        new DateTime(2026, 7, 28, 0, 0, 0, DateTimeKind.Utc)
                    },
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ContentPages");
        }
    }
}
