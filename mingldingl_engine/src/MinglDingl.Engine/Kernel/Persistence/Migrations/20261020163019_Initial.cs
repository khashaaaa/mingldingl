using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Kernel.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "accounts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Phone = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Status = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    DeleteAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    SuspendedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    SuspendedWhy = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    AllyCode = table.Column<string>(type: "character varying(9)", maxLength: 9, nullable: true),
                    CalledBy = table.Column<Guid>(type: "uuid", nullable: true),
                    FlaggedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    FlaggedWhy = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_accounts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "audit_log",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    At = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Keeper = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Action = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Target = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    Note = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_audit_log", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "barred_devices",
                columns: table => new
                {
                    Key = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Why = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_barred_devices", x => x.Key);
                });

            migrationBuilder.CreateTable(
                name: "barred_numbers",
                columns: table => new
                {
                    Phone = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Why = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_barred_numbers", x => x.Phone);
                });

            migrationBuilder.CreateTable(
                name: "codex_pages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Slug = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Locale = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: false),
                    Kind = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Position = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Summary = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Body = table.Column<string>(type: "character varying(8000)", maxLength: 8000, nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_codex_pages", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "config",
                columns: table => new
                {
                    Key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Value = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Category = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Type = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_config", x => x.Key);
                });

            migrationBuilder.CreateTable(
                name: "festivals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Key = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Starts = table.Column<DateOnly>(type: "date", nullable: false),
                    Ends = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_festivals", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "gatherings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Festival = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    Masked = table.Column<bool>(type: "boolean", nullable: false),
                    StartsAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Rounds = table.Column<int>(type: "integer", nullable: false),
                    RoundMinutes = table.Column<int>(type: "integer", nullable: false),
                    Seats = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CancelledAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CalledAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_gatherings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "icebreaker_questions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    Text = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_icebreaker_questions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "phone_verifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Phone = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    ProviderId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    State = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    VerifiedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    WrongTries = table.Column<int>(type: "integer", nullable: false),
                    ClaimedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ClaimedByAccountId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_phone_verifications", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "stats_daily",
                columns: table => new
                {
                    Day = table.Column<DateOnly>(type: "date", nullable: false),
                    Metric = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    City = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Gender = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    AgeBand = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Tier = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                    Floor = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Count = table.Column<long>(type: "bigint", nullable: false),
                    Sum = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stats_daily", x => new { x.Day, x.Metric, x.City, x.Gender, x.AgeBand, x.Tier, x.Floor });
                });

            migrationBuilder.CreateTable(
                name: "trial_questions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    Text = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Choices = table.Column<string[]>(type: "text[]", nullable: false),
                    Hints = table.Column<string[]>(type: "text[]", nullable: false),
                    Topic = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_trial_questions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "venues",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    NameMn = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    District = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Address = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Hours = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    Description = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    AddressMn = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    HoursMn = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    DescriptionMn = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    Verified = table.Column<bool>(type: "boolean", nullable: false),
                    RemovedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_venues", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "wanderings",
                columns: table => new
                {
                    Key = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    Position = table.Column<int>(type: "integer", nullable: false),
                    Road = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Season = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                    VenueKinds = table.Column<string[]>(type: "text[]", nullable: false),
                    TitleEn = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    LineEn = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    BodyEn = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    WhereEn = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    TitleMn = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    LineMn = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    BodyMn = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    WhereMn = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_wanderings", x => x.Key);
                });

            migrationBuilder.CreateTable(
                name: "blocks",
                columns: table => new
                {
                    BlockerId = table.Column<Guid>(type: "uuid", nullable: false),
                    BlockedId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_blocks", x => new { x.BlockerId, x.BlockedId });
                    table.ForeignKey(
                        name: "FK_blocks_accounts_BlockedId",
                        column: x => x.BlockedId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_blocks_accounts_BlockerId",
                        column: x => x.BlockerId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "bonds",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AId = table.Column<Guid>(type: "uuid", nullable: false),
                    BId = table.Column<Guid>(type: "uuid", nullable: false),
                    SummonerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Origin = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false, defaultValue: "seek"),
                    SummonDay = table.Column<DateOnly>(type: "date", nullable: false),
                    State = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    LettersA = table.Column<int>(type: "integer", nullable: false),
                    LettersB = table.Column<int>(type: "integer", nullable: false),
                    Seals = table.Column<int>(type: "integer", nullable: false),
                    LastLetterAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LastLetterBy = table.Column<Guid>(type: "uuid", nullable: true),
                    LastLetterText = table.Column<string>(type: "character varying(140)", maxLength: 140, nullable: true),
                    EmbersAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ReadA = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ReadB = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ClosedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ClosedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    ClosedWhy = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    CandleBackTo = table.Column<Guid>(type: "uuid", nullable: true),
                    CandleBackDay = table.Column<DateOnly>(type: "date", nullable: true),
                    RetireBy = table.Column<Guid>(type: "uuid", nullable: true),
                    RetireAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RetireDeclinedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bonds", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bonds_accounts_AId",
                        column: x => x.AId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_bonds_accounts_BId",
                        column: x => x.BId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "chests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    FromQuest = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Day = table.Column<DateOnly>(type: "date", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    OpenedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_chests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_chests_accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "device_sessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    DeviceName = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    DeviceKey = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    LastSeenAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    RevokedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_device_sessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_device_sessions_accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ger_rests",
                columns: table => new
                {
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    Day = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ger_rests", x => new { x.AccountId, x.Day });
                    table.ForeignKey(
                        name: "FK_ger_rests_accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "honours",
                columns: table => new
                {
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    Key = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    EarnedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    SeenAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_honours", x => new { x.AccountId, x.Key, x.Year });
                    table.ForeignKey(
                        name: "FK_honours_accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "invoices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AccountId = table.Column<Guid>(type: "uuid", nullable: true),
                    Name = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    IdempotencyKey = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Floor = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Months = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<int>(type: "integer", nullable: false),
                    QPayInvoiceId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    QrText = table.Column<string>(type: "text", nullable: false),
                    QrImage = table.Column<string>(type: "text", nullable: true),
                    Links = table.Column<string>(type: "text", nullable: false),
                    State = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    WatchUntil = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_invoices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_invoices_accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "membership_grants",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    Floor = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Source = table.Column<string>(type: "character varying(6)", maxLength: 6, nullable: false),
                    Ref = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    StartsAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    EndsAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Renews = table.Column<bool>(type: "boolean", nullable: false),
                    RevokedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    EndingNoticeAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_membership_grants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_membership_grants_accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "photos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    Position = table.Column<int>(type: "integer", nullable: false),
                    Path = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Width = table.Column<int>(type: "integer", nullable: false),
                    Height = table.Column<int>(type: "integer", nullable: false),
                    ThumbHash = table.Column<byte[]>(type: "bytea", nullable: false),
                    SameHash = table.Column<long>(type: "bigint", nullable: true),
                    ClientKey = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_photos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_photos_accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "profiles",
                columns: table => new
                {
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    BirthDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Gender = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    Bio = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    City = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Oath = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    OathSwornAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    OathProvenAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    FaceProvenAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    FaceTries = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    FaceTriesDay = table.Column<DateOnly>(type: "date", nullable: true),
                    Locale = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: false),
                    WelcomedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    PausedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    AwayFrom = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    AwayUntil = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RetiredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Points = table.Column<int>(type: "integer", nullable: false),
                    Tier = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                    TierUpPending = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: true),
                    Reputation = table.Column<int>(type: "integer", nullable: false, defaultValue: 100),
                    HasChildren = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    ShowChildren = table.Column<bool>(type: "boolean", nullable: false),
                    WantsChildren = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    PartnerChildren = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    Smoking = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    Drinking = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    Faith = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    Lifestyle = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    Streak = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    LastDawn = table.Column<DateOnly>(type: "date", nullable: true),
                    LastSeenAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_profiles", x => x.AccountId);
                    table.ForeignKey(
                        name: "FK_profiles_accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "quest_claims",
                columns: table => new
                {
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Period = table.Column<DateOnly>(type: "date", nullable: false),
                    Points = table.Column<int>(type: "integer", nullable: false),
                    ClaimedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_quest_claims", x => new { x.AccountId, x.Kind, x.Period });
                    table.ForeignKey(
                        name: "FK_quest_claims_accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "reports",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ReporterId = table.Column<Guid>(type: "uuid", nullable: false),
                    TargetId = table.Column<Guid>(type: "uuid", nullable: false),
                    BondId = table.Column<Guid>(type: "uuid", nullable: true),
                    Reason = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Status = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                    Resolution = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ResolvedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reports", x => x.Id);
                    table.ForeignKey(
                        name: "FK_reports_accounts_ReporterId",
                        column: x => x.ReporterId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_reports_accounts_TargetId",
                        column: x => x.TargetId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "score_events",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    Amount = table.Column<int>(type: "integer", nullable: false),
                    BondId = table.Column<Guid>(type: "uuid", nullable: true),
                    Day = table.Column<DateOnly>(type: "date", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_score_events", x => x.Id);
                    table.ForeignKey(
                        name: "FK_score_events_accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "seek_filters",
                columns: table => new
                {
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    AgeMin = table.Column<int>(type: "integer", nullable: true),
                    AgeMax = table.Column<int>(type: "integer", nullable: true),
                    City = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Oath = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    Children = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    Smoking = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    Drinking = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    FaceProven = table.Column<bool>(type: "boolean", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_seek_filters", x => x.AccountId);
                    table.ForeignKey(
                        name: "FK_seek_filters_accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "seek_passes",
                columns: table => new
                {
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    TargetId = table.Column<Guid>(type: "uuid", nullable: false),
                    Day = table.Column<DateOnly>(type: "date", nullable: false),
                    PassedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_seek_passes", x => new { x.AccountId, x.Day, x.TargetId });
                    table.ForeignKey(
                        name: "FK_seek_passes_accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_seek_passes_accounts_TargetId",
                        column: x => x.TargetId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "seek_second_looks",
                columns: table => new
                {
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    Day = table.Column<DateOnly>(type: "date", nullable: false),
                    TargetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_seek_second_looks", x => new { x.AccountId, x.Day });
                    table.ForeignKey(
                        name: "FK_seek_second_looks_accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_seek_second_looks_accounts_TargetId",
                        column: x => x.TargetId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "threads",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    WeaverId = table.Column<Guid>(type: "uuid", nullable: false),
                    PhoneA = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    PhoneB = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    CodeA = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    CodeB = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    AnswerA = table.Column<bool>(type: "boolean", nullable: true),
                    AnswerB = table.Column<bool>(type: "boolean", nullable: true),
                    State = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    BondId = table.Column<Guid>(type: "uuid", nullable: true),
                    WovenAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ClosedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_threads", x => x.Id);
                    table.ForeignKey(
                        name: "FK_threads_accounts_WeaverId",
                        column: x => x.WeaverId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "square_pairs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    GatheringId = table.Column<Guid>(type: "uuid", nullable: false),
                    Round = table.Column<int>(type: "integer", nullable: false),
                    ManId = table.Column<Guid>(type: "uuid", nullable: false),
                    WomanId = table.Column<Guid>(type: "uuid", nullable: false),
                    Question = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    ManYes = table.Column<bool>(type: "boolean", nullable: true),
                    WomanYes = table.Column<bool>(type: "boolean", nullable: true),
                    BondId = table.Column<Guid>(type: "uuid", nullable: true),
                    Outcome = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_square_pairs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_square_pairs_accounts_ManId",
                        column: x => x.ManId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_square_pairs_accounts_WomanId",
                        column: x => x.WomanId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_square_pairs_gatherings_GatheringId",
                        column: x => x.GatheringId,
                        principalTable: "gatherings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "square_rounds",
                columns: table => new
                {
                    GatheringId = table.Column<Guid>(type: "uuid", nullable: false),
                    Index = table.Column<int>(type: "integer", nullable: false),
                    PairedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    SettledAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_square_rounds", x => new { x.GatheringId, x.Index });
                    table.ForeignKey(
                        name: "FK_square_rounds_gatherings_GatheringId",
                        column: x => x.GatheringId,
                        principalTable: "gatherings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "square_seats",
                columns: table => new
                {
                    GatheringId = table.Column<Guid>(type: "uuid", nullable: false),
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    Gender = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    TakenAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    JoinedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LeftAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    AttendPaid = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_square_seats", x => new { x.GatheringId, x.AccountId });
                    table.ForeignKey(
                        name: "FK_square_seats_accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_square_seats_gatherings_GatheringId",
                        column: x => x.GatheringId,
                        principalTable: "gatherings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "venue_photos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    VenueId = table.Column<Guid>(type: "uuid", nullable: false),
                    Position = table.Column<int>(type: "integer", nullable: false),
                    Path = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Width = table.Column<int>(type: "integer", nullable: false),
                    Height = table.Column<int>(type: "integer", nullable: false),
                    ThumbHash = table.Column<byte[]>(type: "bytea", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_venue_photos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_venue_photos_venues_VenueId",
                        column: x => x.VenueId,
                        principalTable: "venues",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "venue_ratings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    VenueId = table.Column<Guid>(type: "uuid", nullable: false),
                    MeetingId = table.Column<Guid>(type: "uuid", nullable: false),
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    Stars = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_venue_ratings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_venue_ratings_accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_venue_ratings_venues_VenueId",
                        column: x => x.VenueId,
                        principalTable: "venues",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "calls",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BondId = table.Column<Guid>(type: "uuid", nullable: false),
                    Channel = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    IssuedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    AIn = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    BIn = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    BothAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    TogetherSeconds = table.Column<int>(type: "integer", nullable: false),
                    EndedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Completed = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_calls", x => x.Id);
                    table.ForeignKey(
                        name: "FK_calls_bonds_BondId",
                        column: x => x.BondId,
                        principalTable: "bonds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "campaign_chambers",
                columns: table => new
                {
                    BondId = table.Column<Guid>(type: "uuid", nullable: false),
                    Chamber = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    ClearedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_campaign_chambers", x => new { x.BondId, x.Chamber });
                    table.ForeignKey(
                        name: "FK_campaign_chambers_bonds_BondId",
                        column: x => x.BondId,
                        principalTable: "bonds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "encounters",
                columns: table => new
                {
                    BondId = table.Column<Guid>(type: "uuid", nullable: false),
                    IcebreakerId = table.Column<int>(type: "integer", nullable: true),
                    IcebreakerOpenAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    IcebreakerA = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    IcebreakerB = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    IcebreakerRevealedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    TrialIds = table.Column<int[]>(type: "integer[]", nullable: true),
                    TrialOpenAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    TrialA = table.Column<int[]>(type: "integer[]", nullable: false),
                    TrialB = table.Column<int[]>(type: "integer[]", nullable: false),
                    TrialDoneAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RiteBy = table.Column<Guid>(type: "uuid", nullable: true),
                    RiteAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RiteAcceptedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RiteDeclinedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RiteDoneAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    MeetingOpenAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_encounters", x => x.BondId);
                    table.ForeignKey(
                        name: "FK_encounters_bonds_BondId",
                        column: x => x.BondId,
                        principalTable: "bonds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "letters",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BondId = table.Column<Guid>(type: "uuid", nullable: false),
                    AuthorId = table.Column<Guid>(type: "uuid", nullable: false),
                    Text = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    SealBroken = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_letters", x => x.Id);
                    table.ForeignKey(
                        name: "FK_letters_bonds_BondId",
                        column: x => x.BondId,
                        principalTable: "bonds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "meetings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BondId = table.Column<Guid>(type: "uuid", nullable: false),
                    VenueId = table.Column<Guid>(type: "uuid", nullable: false),
                    At = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ProposedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    PledgeA = table.Column<bool>(type: "boolean", nullable: false),
                    PledgeB = table.Column<bool>(type: "boolean", nullable: false),
                    State = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    SwornAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CalledOffAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CalledOffBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CheckUntil = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    AnswerA = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: true),
                    AnswerB = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: true),
                    Outcome = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: true),
                    NoShowOf = table.Column<Guid>(type: "uuid", nullable: true),
                    ClosedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_meetings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_meetings_bonds_BondId",
                        column: x => x.BondId,
                        principalTable: "bonds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_meetings_venues_VenueId",
                        column: x => x.VenueId,
                        principalTable: "venues",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "wanderings_taken",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BondId = table.Column<Guid>(type: "uuid", nullable: false),
                    Key = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    AskedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    AskedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    AgreedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    DeclinedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LineA = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    LineB = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    KeptAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_wanderings_taken", x => x.Id);
                    table.ForeignKey(
                        name: "FK_wanderings_taken_bonds_BondId",
                        column: x => x.BondId,
                        principalTable: "bonds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_wanderings_taken_wanderings_Key",
                        column: x => x.Key,
                        principalTable: "wanderings",
                        principalColumn: "Key",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "weekly_trials",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BondId = table.Column<Guid>(type: "uuid", nullable: false),
                    Week = table.Column<DateOnly>(type: "date", nullable: false),
                    Kind = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                    Prompts = table.Column<int[]>(type: "integer[]", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_weekly_trials", x => x.Id);
                    table.ForeignKey(
                        name: "FK_weekly_trials_bonds_BondId",
                        column: x => x.BondId,
                        principalTable: "bonds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "push_tokens",
                columns: table => new
                {
                    DeviceSessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    Token = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_push_tokens", x => x.DeviceSessionId);
                    table.ForeignKey(
                        name: "FK_push_tokens_device_sessions_DeviceSessionId",
                        column: x => x.DeviceSessionId,
                        principalTable: "device_sessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "refresh_tokens",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DeviceSessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    IssuedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UsedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    GraceUntil = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    GracePayload = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_refresh_tokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_refresh_tokens_device_sessions_DeviceSessionId",
                        column: x => x.DeviceSessionId,
                        principalTable: "device_sessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "payment_events",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    InvoiceId = table.Column<Guid>(type: "uuid", nullable: false),
                    At = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    What = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    By = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payment_events", x => x.Id);
                    table.ForeignKey(
                        name: "FK_payment_events_invoices_InvoiceId",
                        column: x => x.InvoiceId,
                        principalTable: "invoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "payments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    InvoiceId = table.Column<Guid>(type: "uuid", nullable: false),
                    QPayPaymentId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Amount = table.Column<int>(type: "integer", nullable: false),
                    State = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Note = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    PaidAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    SettledAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_payments_invoices_InvoiceId",
                        column: x => x.InvoiceId,
                        principalTable: "invoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "weekly_answers",
                columns: table => new
                {
                    TrialId = table.Column<Guid>(type: "uuid", nullable: false),
                    Game = table.Column<int>(type: "integer", nullable: false),
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    Text = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    Choice = table.Column<int>(type: "integer", nullable: true),
                    Guess = table.Column<int>(type: "integer", nullable: true),
                    OpenedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    AnsweredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_weekly_answers", x => new { x.TrialId, x.Game, x.AccountId });
                    table.ForeignKey(
                        name: "FK_weekly_answers_weekly_trials_TrialId",
                        column: x => x.TrialId,
                        principalTable: "weekly_trials",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_accounts_AllyCode",
                table: "accounts",
                column: "AllyCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_accounts_DeleteAt",
                table: "accounts",
                column: "DeleteAt",
                filter: "\"DeleteAt\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_accounts_FlaggedAt",
                table: "accounts",
                column: "FlaggedAt",
                filter: "\"FlaggedAt\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_accounts_Phone",
                table: "accounts",
                column: "Phone",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_audit_log_At",
                table: "audit_log",
                column: "At");

            migrationBuilder.CreateIndex(
                name: "IX_blocks_BlockedId",
                table: "blocks",
                column: "BlockedId");

            migrationBuilder.CreateIndex(
                name: "IX_bonds_AId_BId",
                table: "bonds",
                columns: new[] { "AId", "BId" },
                unique: true,
                filter: "\"State\" = 'Live'");

            migrationBuilder.CreateIndex(
                name: "IX_bonds_AId_State",
                table: "bonds",
                columns: new[] { "AId", "State" });

            migrationBuilder.CreateIndex(
                name: "IX_bonds_BId_State",
                table: "bonds",
                columns: new[] { "BId", "State" });

            migrationBuilder.CreateIndex(
                name: "IX_bonds_CandleBackTo_CandleBackDay",
                table: "bonds",
                columns: new[] { "CandleBackTo", "CandleBackDay" });

            migrationBuilder.CreateIndex(
                name: "IX_bonds_State_LastLetterAt",
                table: "bonds",
                columns: new[] { "State", "LastLetterAt" });

            migrationBuilder.CreateIndex(
                name: "IX_bonds_SummonerId_SummonDay",
                table: "bonds",
                columns: new[] { "SummonerId", "SummonDay" });

            migrationBuilder.CreateIndex(
                name: "IX_calls_BondId_IssuedAt",
                table: "calls",
                columns: new[] { "BondId", "IssuedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_calls_Channel",
                table: "calls",
                column: "Channel",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_chests_AccountId_Day",
                table: "chests",
                columns: new[] { "AccountId", "Day" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_codex_pages_Slug_Locale",
                table: "codex_pages",
                columns: new[] { "Slug", "Locale" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_device_sessions_AccountId",
                table: "device_sessions",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_device_sessions_DeviceKey",
                table: "device_sessions",
                column: "DeviceKey",
                filter: "\"DeviceKey\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_festivals_Starts_Ends",
                table: "festivals",
                columns: new[] { "Starts", "Ends" });

            migrationBuilder.CreateIndex(
                name: "IX_gatherings_StartsAt",
                table: "gatherings",
                column: "StartsAt");

            migrationBuilder.CreateIndex(
                name: "IX_invoices_AccountId_IdempotencyKey",
                table: "invoices",
                columns: new[] { "AccountId", "IdempotencyKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_invoices_WatchUntil",
                table: "invoices",
                column: "WatchUntil");

            migrationBuilder.CreateIndex(
                name: "IX_letters_BondId_CreatedAt",
                table: "letters",
                columns: new[] { "BondId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_meetings_BondId_State",
                table: "meetings",
                columns: new[] { "BondId", "State" });

            migrationBuilder.CreateIndex(
                name: "IX_meetings_NoShowOf_ClosedAt",
                table: "meetings",
                columns: new[] { "NoShowOf", "ClosedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_meetings_State_At",
                table: "meetings",
                columns: new[] { "State", "At" });

            migrationBuilder.CreateIndex(
                name: "IX_meetings_VenueId",
                table: "meetings",
                column: "VenueId");

            migrationBuilder.CreateIndex(
                name: "IX_membership_grants_AccountId_EndsAt",
                table: "membership_grants",
                columns: new[] { "AccountId", "EndsAt" });

            migrationBuilder.CreateIndex(
                name: "IX_membership_grants_Source_Ref",
                table: "membership_grants",
                columns: new[] { "Source", "Ref" });

            migrationBuilder.CreateIndex(
                name: "IX_payment_events_InvoiceId_At",
                table: "payment_events",
                columns: new[] { "InvoiceId", "At" });

            migrationBuilder.CreateIndex(
                name: "IX_payments_InvoiceId",
                table: "payments",
                column: "InvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_payments_QPayPaymentId",
                table: "payments",
                column: "QPayPaymentId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_payments_State_PaidAt",
                table: "payments",
                columns: new[] { "State", "PaidAt" });

            migrationBuilder.CreateIndex(
                name: "IX_phone_verifications_CreatedAt",
                table: "phone_verifications",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_phone_verifications_Phone_State",
                table: "phone_verifications",
                columns: new[] { "Phone", "State" });

            migrationBuilder.CreateIndex(
                name: "IX_photos_AccountId_ClientKey",
                table: "photos",
                columns: new[] { "AccountId", "ClientKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_photos_AccountId_Position",
                table: "photos",
                columns: new[] { "AccountId", "Position" });

            migrationBuilder.CreateIndex(
                name: "IX_profiles_Gender_City",
                table: "profiles",
                columns: new[] { "Gender", "City" });

            migrationBuilder.CreateIndex(
                name: "IX_push_tokens_AccountId",
                table: "push_tokens",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_push_tokens_Token",
                table: "push_tokens",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_refresh_tokens_DeviceSessionId",
                table: "refresh_tokens",
                column: "DeviceSessionId");

            migrationBuilder.CreateIndex(
                name: "IX_refresh_tokens_Hash",
                table: "refresh_tokens",
                column: "Hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_reports_ReporterId",
                table: "reports",
                column: "ReporterId");

            migrationBuilder.CreateIndex(
                name: "IX_reports_Status_CreatedAt",
                table: "reports",
                columns: new[] { "Status", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_reports_TargetId",
                table: "reports",
                column: "TargetId");

            migrationBuilder.CreateIndex(
                name: "IX_score_events_AccountId_BondId_Day_Kind",
                table: "score_events",
                columns: new[] { "AccountId", "BondId", "Day", "Kind" });

            migrationBuilder.CreateIndex(
                name: "IX_score_events_AccountId_CreatedAt",
                table: "score_events",
                columns: new[] { "AccountId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "ux_score_daily",
                table: "score_events",
                columns: new[] { "AccountId", "Kind", "Day" },
                unique: true,
                filter: "\"Kind\" IN ('dawn', 'seventhDawn')");

            migrationBuilder.CreateIndex(
                name: "ux_score_once",
                table: "score_events",
                columns: new[] { "AccountId", "Kind" },
                unique: true,
                filter: "\"Kind\" = 'finished'");

            migrationBuilder.CreateIndex(
                name: "IX_seek_passes_TargetId",
                table: "seek_passes",
                column: "TargetId");

            migrationBuilder.CreateIndex(
                name: "IX_seek_second_looks_TargetId",
                table: "seek_second_looks",
                column: "TargetId");

            migrationBuilder.CreateIndex(
                name: "IX_square_pairs_GatheringId_Round",
                table: "square_pairs",
                columns: new[] { "GatheringId", "Round" });

            migrationBuilder.CreateIndex(
                name: "IX_square_pairs_ManId",
                table: "square_pairs",
                column: "ManId");

            migrationBuilder.CreateIndex(
                name: "IX_square_pairs_WomanId",
                table: "square_pairs",
                column: "WomanId");

            migrationBuilder.CreateIndex(
                name: "IX_square_seats_AccountId",
                table: "square_seats",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_stats_daily_Metric_Day",
                table: "stats_daily",
                columns: new[] { "Metric", "Day" });

            migrationBuilder.CreateIndex(
                name: "IX_threads_PhoneA",
                table: "threads",
                column: "PhoneA");

            migrationBuilder.CreateIndex(
                name: "IX_threads_PhoneB",
                table: "threads",
                column: "PhoneB");

            migrationBuilder.CreateIndex(
                name: "IX_threads_WeaverId_WovenAt",
                table: "threads",
                columns: new[] { "WeaverId", "WovenAt" });

            migrationBuilder.CreateIndex(
                name: "IX_venue_photos_VenueId_Position",
                table: "venue_photos",
                columns: new[] { "VenueId", "Position" });

            migrationBuilder.CreateIndex(
                name: "IX_venue_ratings_AccountId",
                table: "venue_ratings",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_venue_ratings_MeetingId_AccountId",
                table: "venue_ratings",
                columns: new[] { "MeetingId", "AccountId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_venue_ratings_VenueId",
                table: "venue_ratings",
                column: "VenueId");

            migrationBuilder.CreateIndex(
                name: "IX_venues_Verified_RemovedAt",
                table: "venues",
                columns: new[] { "Verified", "RemovedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_wanderings_taken_BondId_Key",
                table: "wanderings_taken",
                columns: new[] { "BondId", "Key" },
                unique: true,
                filter: "\"DeclinedAt\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_wanderings_taken_Key",
                table: "wanderings_taken",
                column: "Key");

            migrationBuilder.CreateIndex(
                name: "IX_weekly_trials_BondId_Week",
                table: "weekly_trials",
                columns: new[] { "BondId", "Week" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "audit_log");

            migrationBuilder.DropTable(
                name: "barred_devices");

            migrationBuilder.DropTable(
                name: "barred_numbers");

            migrationBuilder.DropTable(
                name: "blocks");

            migrationBuilder.DropTable(
                name: "calls");

            migrationBuilder.DropTable(
                name: "campaign_chambers");

            migrationBuilder.DropTable(
                name: "chests");

            migrationBuilder.DropTable(
                name: "codex_pages");

            migrationBuilder.DropTable(
                name: "config");

            migrationBuilder.DropTable(
                name: "encounters");

            migrationBuilder.DropTable(
                name: "festivals");

            migrationBuilder.DropTable(
                name: "ger_rests");

            migrationBuilder.DropTable(
                name: "honours");

            migrationBuilder.DropTable(
                name: "icebreaker_questions");

            migrationBuilder.DropTable(
                name: "letters");

            migrationBuilder.DropTable(
                name: "meetings");

            migrationBuilder.DropTable(
                name: "membership_grants");

            migrationBuilder.DropTable(
                name: "payment_events");

            migrationBuilder.DropTable(
                name: "payments");

            migrationBuilder.DropTable(
                name: "phone_verifications");

            migrationBuilder.DropTable(
                name: "photos");

            migrationBuilder.DropTable(
                name: "profiles");

            migrationBuilder.DropTable(
                name: "push_tokens");

            migrationBuilder.DropTable(
                name: "quest_claims");

            migrationBuilder.DropTable(
                name: "refresh_tokens");

            migrationBuilder.DropTable(
                name: "reports");

            migrationBuilder.DropTable(
                name: "score_events");

            migrationBuilder.DropTable(
                name: "seek_filters");

            migrationBuilder.DropTable(
                name: "seek_passes");

            migrationBuilder.DropTable(
                name: "seek_second_looks");

            migrationBuilder.DropTable(
                name: "square_pairs");

            migrationBuilder.DropTable(
                name: "square_rounds");

            migrationBuilder.DropTable(
                name: "square_seats");

            migrationBuilder.DropTable(
                name: "stats_daily");

            migrationBuilder.DropTable(
                name: "threads");

            migrationBuilder.DropTable(
                name: "trial_questions");

            migrationBuilder.DropTable(
                name: "venue_photos");

            migrationBuilder.DropTable(
                name: "venue_ratings");

            migrationBuilder.DropTable(
                name: "wanderings_taken");

            migrationBuilder.DropTable(
                name: "weekly_answers");

            migrationBuilder.DropTable(
                name: "invoices");

            migrationBuilder.DropTable(
                name: "device_sessions");

            migrationBuilder.DropTable(
                name: "gatherings");

            migrationBuilder.DropTable(
                name: "venues");

            migrationBuilder.DropTable(
                name: "wanderings");

            migrationBuilder.DropTable(
                name: "weekly_trials");

            migrationBuilder.DropTable(
                name: "bonds");

            migrationBuilder.DropTable(
                name: "accounts");
        }
    }
}
