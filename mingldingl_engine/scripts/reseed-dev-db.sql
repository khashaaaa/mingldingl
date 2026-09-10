-- Wipes and reseeds the local development database with varied, realistic Mongolian-market data.
-- Reference content (icebreakers, quizzes, content pages, businesses) plus an authored cast of
-- 19 people -- real portraits, real districts, hand-written bios -- and one real conversation per
-- match, spread across every tier, oath, membership and lifecycle state the app has to render.
--
-- Photos live under seed/c2/ -- a cast version, not decoration. expo-image caches by URL, so a
-- reseed that reuses seed/<slug>-1.jpg leaves every device that saw the old cast showing the old
-- picture. Bump the folder (c2, c3, ...) whenever the cast's photos change.
--
-- Portraits are StyleGAN output (photorealistic, but no real person): putting real people's
-- faces on fabricated dating profiles is not something a fixture should do. uploads/ is
-- gitignored, so after a fresh clone build the cast with
--   python3 scripts/gen-cast-photos.py
-- (read its warning about who it downloads), then
--   python3 scripts/gen-seed-photos.py
-- to fill in anything else the database references but the disk is missing.
--
-- Destructive. Local dev only: mingldingl_engine/scripts/reseed-dev-db.sql
-- NOT truncated: AdminConfigs (AdminConfigSeeder owns it and re-syncs on boot) and
-- ContentPages (authored product copy — terms, privacy, and the guides text — not fixtures).

-- Photo URLs are absolute, so the host has to be one the *client* can reach: `localhost` works
-- for the web build but resolves to the phone itself on a real device, leaving every seeded
-- candidate photo broken. Override with the LAN IP the app is pointed at:
--   API_HOST=http://192.168.1.32:5150 psql ... -f reseed-dev-db.sql
\set api_host `echo "${API_HOST:-http://localhost:5150}"`

BEGIN;

TRUNCATE TABLE
  "TownSquarePairings", "TownSquareRounds",
  "TownSquareRsvps", "TownSquareSessions", "CampaignRoomClaims",
  "IcebreakerResponses", "QuizResponses", "QuizQuestions", "Quizzes", "Icebreakers",
  "DateConfirmations", "ActivitySuggestions", "BusinessRatings", "BusinessPartners",
  "messages", "Matches", "BlockedUsers", "Ships", "Referrals",
  "UserDailyQuests", "UserItems", "UserMilestones", "ScoreEvents",
  "Memberships", "PushTokens", "PhoneVerifications", "AdminAuditLogs",
  "Users"
RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------- reference content

INSERT INTO "Icebreakers" ("Id", "QuestionText", "Type", "Options", "IsActive") VALUES
  (gen_random_uuid(), 'Хамгийн сүүлд юунд чин сэтгэлээсээ инээсэн бэ?', 'OpenText', '[]'::jsonb, true),
  (gen_random_uuid(), 'Төгс амралтын өдөр чиний хувьд ямар байдаг вэ?', 'OpenText', '[]'::jsonb, true),
  (gen_random_uuid(), 'Хэрэв маргааш нүүх боломжтой бол хаашаа явах вэ?', 'OpenText', '[]'::jsonb, true),
  (gen_random_uuid(), 'Аль нь чамд илүү тохирох вэ?', 'MultipleChoice',
     '["Уулын аялал","Далайн эрэг","Хотын кафе","Гэртээ ном"]'::jsonb, true),
  (gen_random_uuid(), 'Өглөө эрт босдог уу, шөнө сүүл болтол сэрүүн байдаг уу?', 'MultipleChoice',
     '["Өглөөний шувуу","Шөнийн шар шувуу","Аль аль нь"]'::jsonb, true),
  (gen_random_uuid(), 'Анхны болзоонд хамгийн чухал нь юу вэ?', 'MultipleChoice',
     '["Хошин шог","Чин үнэнч байдал","Сониуч зан","Тайван байдал"]'::jsonb, true),
  (gen_random_uuid(), 'Ямар нэг зүйлийг дахин сурч эхлэх боломж гарвал юу сурах вэ?', 'OpenText', '[]'::jsonb, true),
  (gen_random_uuid(), 'Энэ асуулт идэвхгүй — UI-д харагдах ёсгүй.', 'OpenText', '[]'::jsonb, false);

INSERT INTO "Quizzes" ("Id", "Title") VALUES
  ('11111111-1111-1111-1111-111111111111', 'Хамтын амьдралын хэв маяг'),
  ('22222222-2222-2222-2222-222222222222', 'Үнэт зүйлсийн сорил');

INSERT INTO "QuizQuestions" ("Id", "QuizId", "Text", "Options") VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Амралтын өдөр хэрхэн өнгөрүүлэх дуртай вэ?',
     ARRAY['Гадаа идэвхтэй','Гэртээ тайван','Найзуудтай','Аяллаар']::text[]),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Мөнгөө хэрхэн зарцуулдаг вэ?',
     ARRAY['Хэмнэдэг','Туршлагад зарцуулдаг','Тэнцвэртэй','Төлөвлөдөггүй']::text[]),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Маргаан гарвал юу хийдэг вэ?',
     ARRAY['Шууд ярилцдаг','Хэсэг бодох цаг авдаг','Зайлсхийдэг','Гуравдагч талаас зөвлөгөө авдаг']::text[]),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Гэр бүлийн үүрэг хуваарилалт?',
     ARRAY['Тэгш хуваах','Ур чадвараар','Уян хатан','Ярилцаж шийддэг']::text[]),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Юу чамд хамгийн чухал вэ?',
     ARRAY['Гэр бүл','Карьер','Эрх чөлөө','Тогтвортой байдал']::text[]),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Итгэлийг хэрхэн байгуулдаг вэ?',
     ARRAY['Цаг хугацаагаар','Илэн далангүй яриагаар','Үйлдлээр','Хамтын туршлагаар']::text[]),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Ирээдүйгээ хэрхэн төлөвлөдөг вэ?',
     ARRAY['Нарийн төлөвлөдөг','Ерөнхий чиглэлтэй','Урсгалаар','Хамтдаа шийддэг']::text[]);
COMMIT;

BEGIN;

-- ---------------------------------------------------------------- businesses

INSERT INTO "BusinessPartners"
  ("Id","Name","Category","City","District","Description","PhotoUrls","OperatingHours",
   "IsVerified","IsFeatured","AverageRating","RatingCount","CreatedAt")
SELECT gen_random_uuid(), n, c, 'Ulaanbaatar', d, descr, '[]'::jsonb, hrs, ver, feat, rating, cnt, now()
FROM (VALUES
  ('Café Amsterdam','Cafe','Sukhbaatar','Quiet corner tables, good for a first conversation.','08:00-22:00',true,true,4.60,23),
  ('Modern Nomads','Restaurant','Sukhbaatar','Traditional Mongolian, generous portions.','11:00-23:00',true,true,4.30,41),
  ('Rosewood Kitchen','Restaurant','Chingeltei','European menu, dim lighting.','12:00-23:00',true,false,4.10,12),
  ('Tom n Toms','Cafe','Bayangol','Chain café, reliably open late.','07:00-24:00',true,false,3.80,55),
  ('Zaisan Hill','Outdoor','Khan-Uul','City viewpoint — best at sunset.','00:00-24:00',true,true,4.80,67),
  ('National Art Gallery','Culture','Sukhbaatar','Rotating exhibitions, easy to talk while walking.','10:00-18:00',true,false,4.40,19),
  ('Hunnu Mall Cinema','Entertainment','Khan-Uul','Late showings, big screens.','10:00-24:00',true,false,4.00,88),
  ('Bogd Khan Trailhead','Outdoor','Khan-Uul','Half-day hike for a bolder second date.','00:00-24:00',false,false,4.70,9),
  ('Grand Khaan Irish Pub','Bar','Sukhbaatar','Loud on weekends, quiet midweek.','16:00-02:00',true,false,3.90,34),
  ('Shangri-La Rooftop','Bar','Sukhbaatar','Expensive, worth it once.','17:00-01:00',true,true,4.50,28),
  ('Steppe Nomads Tea House','Cafe','Bayanzurkh','Suutei tsai and board games.','09:00-21:00',false,false,4.20,7),
  ('UB Bowling Center','Entertainment','Bayangol','Something to do with your hands while you talk.','11:00-23:00',true,false,3.70,46),
  ('Gandan Monastery','Culture','Chingeltei','Calm, respectful, free to enter.','06:00-20:00',true,false,4.90,102),
  ('Terelj Day Trip','Outdoor','Nalaikh','A full day out — for people who already like each other.','00:00-24:00',false,false,4.60,15),
  ('Choijin Lama Museum','Culture','Sukhbaatar','Small, atmospheric, half an hour well spent.','09:00-17:00',true,false,4.30,21)
) AS t(n,c,d,descr,hrs,ver,feat,rating,cnt);


COMMIT;

BEGIN;

-- ---------------------------------------------------------------- users
-- An authored cast rather than a modulo-generated one: 19 people with real photos, real
-- districts and bios that a human wrote. Fixed UUIDs so the conversations below can name
-- their participants instead of guessing at row_number() ordering.

INSERT INTO "Users" (
  "Id","DisplayName","Age","Gender","City","Bio","PhotoUrls","IsProfileComplete",
  "HasKids","SmokingHabit","DrinkingHabit","Religion","Lifestyle",
  "TotalScore","GemTier","ReputationScore","MembershipLevel","DailyMatchesUsed",
  "DailyMatchesResetAt","CreatedAt","CurrentStreak","LongestStreak","LastLoginDate",
  "PhoneNumber","Latitude","Longitude","IsDeleted","PushEnabled","AgeMin","AgeMax",
  "IsPaused","IsBanned","NoShowFlagCount","Oath","OathProven","ReferralCode","PreferredLocale")
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Батболд', 31, 'Male', 'Sükhbaatar', 'Backend хөгжүүлэгч. Уулын дугуй, гитар, муу кофе — гурвуулаа адилхан хайртай.',
   jsonb_build_array(:'api_host' || '/uploads/photos/seed/c2/batbold-1.jpg', :'api_host' || '/uploads/photos/seed/c2/batbold-2.jpg', :'api_host' || '/uploads/photos/seed/c2/batbold-3.jpg'),
   true, false,
   'Occasionally',
   'Never',
   'None',
   'Balanced',
   1240, 'Ruby', 4.6, 'Silver', 1, now()::date,
   now() - interval '23 days', 11, 12,
   now() - interval '1 days',
   '88000137', 47.928700, 106.920700,
   false, true, 21, 45, false, false, 0,
   'Bond', true,
   'MG7919', 'mn'),
  ('a0000000-0000-4000-8000-000000000002', 'Номин', 30, 'Female', 'Sükhbaatar', 'Эмийн сангийн эрхлэгч. Ажлын дараа усан бассейн, амралтын өдөр ном.',
   jsonb_build_array(:'api_host' || '/uploads/photos/seed/c2/nomin-1.jpg', :'api_host' || '/uploads/photos/seed/c2/nomin-2.jpg', :'api_host' || '/uploads/photos/seed/c2/nomin-3.jpg'),
   true, false,
   'Never',
   'Occasionally',
   'Buddhist',
   'Relaxed',
   1180, 'Ruby', 4.8, 'Free', 2, now()::date,
   now() - interval '26 days', 9, 11,
   now() - interval '2 days',
   '88000274', 47.930300, 106.922800,
   false, true, 21, 45, false, false, 0,
   'Bond', true,
   'MG5838', 'mn'),
  ('a0000000-0000-4000-8000-000000000003', 'Төмөрлөн', 27, 'Male', 'Bayangol', 'Архитектор. Барилга шүүмжилдэг муу зуршилтай, уучлаарай.',
   jsonb_build_array(:'api_host' || '/uploads/photos/seed/c2/temuulen-1.jpg', :'api_host' || '/uploads/photos/seed/c2/temuulen-2.jpg', :'api_host' || '/uploads/photos/seed/c2/temuulen-3.jpg'),
   true, false,
   'Never',
   'Regularly',
   'None',
   'Active',
   420, 'Amethyst', 4.1, 'Free', 0, now()::date,
   now() - interval '29 days', 3, 6,
   now() - interval '0 days',
   '88000411', 47.915300, 106.849300,
   false, true, 21, 45, false, false, 0,
   'Fate', false,
   'MG3757', 'en'),
  ('a0000000-0000-4000-8000-000000000004', 'Сарнай', 26, 'Female', 'Bayangol', 'График дизайнер. Фонтны талаар маргаж чадна, бас дуртай.',
   jsonb_build_array(:'api_host' || '/uploads/photos/seed/c2/sarnai-1.jpg', :'api_host' || '/uploads/photos/seed/c2/sarnai-2.jpg', :'api_host' || '/uploads/photos/seed/c2/sarnai-3.jpg'),
   true, false,
   'Occasionally',
   'Never',
   'Other',
   'Balanced',
   385, 'Amethyst', 4.3, 'Free', 1, now()::date,
   now() - interval '32 days', 5, 9,
   now() - interval '1 days',
   '88000548', 47.916900, 106.851400,
   false, true, 21, 45, false, false, 0,
   'Fate', false,
   'MG1676', 'mn'),
  ('a0000000-0000-4000-8000-000000000005', 'Энхбат', 34, 'Male', 'Khan-Uul', 'Сэргээн засах эмч. Хүмүүсийг дахин алхуулдаг ажилтай.',
   jsonb_build_array(:'api_host' || '/uploads/photos/seed/c2/enkhbat-1.jpg', :'api_host' || '/uploads/photos/seed/c2/enkhbat-2.jpg', :'api_host' || '/uploads/photos/seed/c2/enkhbat-3.jpg'),
   true, false,
   'Never',
   'Occasionally',
   'Buddhist',
   'Relaxed',
   760, 'Sapphire', 4.7, 'Free', 2, now()::date,
   now() - interval '35 days', 6, 6,
   now() - interval '2 days',
   '88000685', 47.887000, 106.908000,
   false, true, 21, 45, false, false, 0,
   'Bond', true,
   'MG9595', 'mn'),
  ('a0000000-0000-4000-8000-000000000006', 'Мишээл', 32, 'Female', 'Khan-Uul', 'Шүдний эмч. Тийм ээ, бүгд надад ижил хошигнол ярьдаг.',
   jsonb_build_array(:'api_host' || '/uploads/photos/seed/c2/misheel-1.jpg', :'api_host' || '/uploads/photos/seed/c2/misheel-2.jpg', :'api_host' || '/uploads/photos/seed/c2/misheel-3.jpg'),
   true, true,
   'Occasionally',
   'Never',
   'None',
   'Active',
   690, 'Sapphire', 4.5, 'Silver', 0, now()::date,
   now() - interval '38 days', 2, 3,
   now() - interval '0 days',
   '88000822', 47.888600, 106.910100,
   false, true, 21, 45, false, false, 0,
   'Bond', false,
   'MG7514', 'en'),
  ('a0000000-0000-4000-8000-000000000007', 'Ганзориг', 41, 'Male', 'Bayanzürkh', 'Жуулчны бааз эрхэлдэг. Зун хээр, өвөл хотод.',
   jsonb_build_array(:'api_host' || '/uploads/photos/seed/c2/ganzorig-1.jpg', :'api_host' || '/uploads/photos/seed/c2/ganzorig-2.jpg', :'api_host' || '/uploads/photos/seed/c2/ganzorig-3.jpg'),
   true, false,
   'Never',
   'Occasionally',
   'Buddhist',
   'Balanced',
   2140, 'Emerald', 4.9, 'Gold', 1, now()::date,
   now() - interval '41 days', 21, 23,
   now() - interval '1 days',
   '88000959', 47.918000, 106.984200,
   false, true, 21, 45, false, false, 0,
   'Kinship', true,
   'MG5433', 'mn'),
  ('a0000000-0000-4000-8000-000000000008', 'Нарантуяа', 38, 'Female', 'Bayanzürkh', 'Ноолуурын жижиг үйлдвэр. Гараараа ажиллах дуртай.',
   jsonb_build_array(:'api_host' || '/uploads/photos/seed/c2/narantuya-1.jpg', :'api_host' || '/uploads/photos/seed/c2/narantuya-2.jpg', :'api_host' || '/uploads/photos/seed/c2/narantuya-3.jpg'),
   true, false,
   'Never',
   'Regularly',
   'None',
   'Relaxed',
   1980, 'Ruby', 4.8, 'Gold', 2, now()::date,
   now() - interval '44 days', 17, 20,
   now() - interval '2 days',
   '88001096', 47.919600, 106.986300,
   false, true, 21, 45, false, false, 0,
   'Kinship', true,
   'MG3352', 'mn'),
  ('a0000000-0000-4000-8000-000000000009', 'Мөнхболд', 29, 'Male', 'Chingeltei', 'Дата аналист. Ширээний тоглоом цуглуулдаг, дийлэнх нь тоглогдоогүй.',
   jsonb_build_array(:'api_host' || '/uploads/photos/seed/c2/munkhbold-1.jpg', :'api_host' || '/uploads/photos/seed/c2/munkhbold-2.jpg', :'api_host' || '/uploads/photos/seed/c2/munkhbold-3.jpg'),
   true, false,
   'Occasionally',
   'Never',
   'Other',
   'Active',
   880, 'Sapphire', 4.4, 'Free', 0, now()::date,
   now() - interval '47 days', 7, 11,
   now() - interval '0 days',
   '88001233', 47.934200, 106.897400,
   false, true, 21, 45, false, false, 0,
   'Fate', false,
   'MG1271', 'en'),
  ('a0000000-0000-4000-8000-000000000010', 'Хулан', 28, 'Female', 'Chingeltei', 'Орчуулагч. Гурван хэл, чиг баримжаа тэг.',
   jsonb_build_array(:'api_host' || '/uploads/photos/seed/c2/khulan-1.jpg', :'api_host' || '/uploads/photos/seed/c2/khulan-2.jpg', :'api_host' || '/uploads/photos/seed/c2/khulan-3.jpg'),
   true, false,
   'Never',
   'Occasionally',
   'Buddhist',
   'Balanced',
   840, 'Sapphire', 4.6, 'Free', 1, now()::date,
   now() - interval '50 days', 8, 8,
   now() - interval '1 days',
   '88001370', 47.935800, 106.889000,
   false, true, 21, 45, false, false, 0,
   'Fate', true,
   'MG9190', 'mn'),
  ('a0000000-0000-4000-8000-000000000011', 'Эрдэнэбат', 33, 'Male', 'Songinokhairkhan', 'Мал эмнэлгийн эмч. Долоо хоногт нэг удаа муур намайг хазна.',
   jsonb_build_array(:'api_host' || '/uploads/photos/seed/c2/erdenebat-1.jpg', :'api_host' || '/uploads/photos/seed/c2/erdenebat-2.jpg', :'api_host' || '/uploads/photos/seed/c2/erdenebat-3.jpg'),
   true, false,
   'Occasionally',
   'Never',
   'None',
   'Relaxed',
   1620, 'Ruby', 4.9, 'Silver', 2, now()::date,
   now() - interval '53 days', 14, 15,
   now() - interval '2 days',
   '88001507', 47.926400, 106.772100,
   false, true, 21, 45, false, false, 0,
   'Bond', true,
   'MG7109', 'mn'),
  ('a0000000-0000-4000-8000-000000000012', 'Саруул', 27, 'Female', 'Songinokhairkhan', 'Мал эмнэлгийн сувилагч. Нохойд хүнээс илүү таалагддаг.',
   jsonb_build_array(:'api_host' || '/uploads/photos/seed/c2/saruul-1.jpg', :'api_host' || '/uploads/photos/seed/c2/saruul-2.jpg', :'api_host' || '/uploads/photos/seed/c2/saruul-3.jpg'),
   true, true,
   'Never',
   'Occasionally',
   'Buddhist',
   'Active',
   1560, 'Ruby', 4.7, 'Free', 0, now()::date,
   now() - interval '56 days', 12, 14,
   now() - interval '0 days',
   '88001644', 47.928000, 106.774200,
   false, true, 21, 45, false, false, 0,
   'Bond', true,
   'MG5028', 'en'),
  ('a0000000-0000-4000-8000-000000000013', 'Цогтбаатар', 36, 'Male', 'Bayangol', 'Тогооч. Би хоол хийнэ, чи аяга угаана. Шударга.',
   jsonb_build_array(:'api_host' || '/uploads/photos/seed/c2/tsogtbaatar-1.jpg', :'api_host' || '/uploads/photos/seed/c2/tsogtbaatar-2.jpg', :'api_host' || '/uploads/photos/seed/c2/tsogtbaatar-3.jpg'),
   true, false,
   'Never',
   'Regularly',
   'None',
   'Balanced',
   540, 'Amethyst', 3.9, 'Free', 1, now()::date,
   now() - interval '59 days', 0, 3,
   now() - interval '1 days',
   '88001781', 47.920100, 106.849300,
   false, true, 21, 45, false, false, 0,
   NULL, false,
   'MG2947', 'mn'),
  ('a0000000-0000-4000-8000-000000000014', 'Дэлгэрмаа', 33, 'Female', 'Sükhbaatar', 'Рентген эмч. Ажил дээрээ чимээгүй, гадаа нь тийм ч биш.',
   jsonb_build_array(:'api_host' || '/uploads/photos/seed/c2/delgermaa-1.jpg', :'api_host' || '/uploads/photos/seed/c2/delgermaa-2.jpg', :'api_host' || '/uploads/photos/seed/c2/delgermaa-3.jpg'),
   true, false,
   'Occasionally',
   'Never',
   'Other',
   'Relaxed',
   610, 'Sapphire', 4.2, 'Free', 2, now()::date,
   now() - interval '62 days', 1, 5,
   now() - interval '2 days',
   '88001918', 47.927100, 106.927000,
   false, true, 21, 45, false, false, 0,
   'Bond', false,
   'MG0866', 'mn'),
  ('a0000000-0000-4000-8000-000000000015', 'Ануужин', 24, 'Female', 'Khan-Uul', 'Байгаль орчны магистрант. Талбайн судалгаанд явах дуртай.',
   jsonb_build_array(:'api_host' || '/uploads/photos/seed/c2/anujin-1.jpg', :'api_host' || '/uploads/photos/seed/c2/anujin-2.jpg', :'api_host' || '/uploads/photos/seed/c2/anujin-3.jpg'),
   true, false,
   'Never',
   'Occasionally',
   'Buddhist',
   'Active',
   260, 'Opal', 4.0, 'Free', 0, now()::date,
   now() - interval '65 days', 4, 4,
   now() - interval '0 days',
   '88002055', 47.880600, 106.908000,
   false, true, 21, 45, false, false, 0,
   'Kinship', false,
   'MG8785', 'en'),
  ('a0000000-0000-4000-8000-000000000016', 'Оюунаа', 25, 'Female', 'Chingeltei', 'Бариста, оройдоо нягтлан бодогчийн ангид. Latte art сурч байгаа.',
   jsonb_build_array(:'api_host' || '/uploads/photos/seed/c2/oyunaa-1.jpg', :'api_host' || '/uploads/photos/seed/c2/oyunaa-2.jpg', :'api_host' || '/uploads/photos/seed/c2/oyunaa-3.jpg'),
   true, false,
   'Occasionally',
   'Never',
   'None',
   'Balanced',
   310, 'Amethyst', 4.3, 'Free', 1, now()::date,
   now() - interval '68 days', 6, 7,
   now() - interval '1 days',
   '88002192', 47.934200, 106.891100,
   false, true, 21, 45, false, false, 0,
   'Fate', false,
   'MG6704', 'mn'),
  ('a0000000-0000-4000-8000-000000000017', 'Болормаа', 35, 'Female', 'Bayanzürkh', 'Химийн багш. Асуулт их асуудаг, хариулт нь бүр илүү.',
   jsonb_build_array(:'api_host' || '/uploads/photos/seed/c2/bolormaa-1.jpg', :'api_host' || '/uploads/photos/seed/c2/bolormaa-2.jpg', :'api_host' || '/uploads/photos/seed/c2/bolormaa-3.jpg'),
   true, false,
   'Never',
   'Occasionally',
   'Buddhist',
   'Relaxed',
   920, 'Sapphire', 4.6, 'Free', 2, now()::date,
   now() - interval '71 days', 10, 12,
   now() - interval '2 days',
   '88002329', 47.922800, 106.984200,
   false, true, 21, 45, false, false, 0,
   'Kinship', true,
   'MG4623', 'mn'),
  ('a0000000-0000-4000-8000-000000000018', 'Түвшин', 29, 'Female', 'Nalaikh', 'Барилгын инженер. Талбай дээр каск, гэртээ ном.',
   jsonb_build_array(:'api_host' || '/uploads/photos/seed/c2/tuvshin-1.jpg', :'api_host' || '/uploads/photos/seed/c2/tuvshin-2.jpg', :'api_host' || '/uploads/photos/seed/c2/tuvshin-3.jpg'),
   true, true,
   'Never',
   'Regularly',
   'None',
   'Active',
   470, 'Amethyst', 4.4, 'Free', 0, now()::date,
   now() - interval '74 days', 3, 6,
   now() - interval '0 days',
   '88002466', 47.778400, 107.262300,
   false, true, 21, 45, false, false, 0,
   'Bond', false,
   'MG2542', 'en'),
  ('a0000000-0000-4000-8000-000000000019', 'Алтанзул', 31, 'Female', 'Sükhbaatar', 'Сэтгүүлч. Ажлын гадна ч гэсэн их асуудаг, өршөөгөөрэй.',
   jsonb_build_array(:'api_host' || '/uploads/photos/seed/c2/altanzul-1.jpg', :'api_host' || '/uploads/photos/seed/c2/altanzul-2.jpg', :'api_host' || '/uploads/photos/seed/c2/altanzul-3.jpg'),
   true, false,
   'Occasionally',
   'Never',
   'Other',
   'Balanced',
   1050, 'Ruby', 4.5, 'Silver', 1, now()::date,
   now() - interval '77 days', 13, 17,
   now() - interval '1 days',
   '88002603', 47.935100, 106.927000,
   false, true, 21, 45, false, false, 0,
   'Fate', true,
   'MG0461', 'mn');

-- ---------------------------------------------------------------- matches
-- Every match below carries a real thread (see the messages block). InitiatorMessageCount and
-- ReceiverMessageCount are seeded explicitly: RevealService.MutualMessageCount reads the per-side
-- counts, so leaving them at 0 pinned a 34-message conversation to "1 of 3 photos revealed".

INSERT INTO "Matches" (
  "Id","InitiatorId","ReceiverId","Status","RevealLevel","MessageCount",
  "InitiatorMessageCount","ReceiverMessageCount",
  "IcebreakerComplete","VideoCallUnlocked","CreatedAt","LastMessageAt","LastMessageSenderId")
VALUES
  ('a0000000-0000-4000-8000-000000000901', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'Active', 1,
   24, 12, 12, true, true,
   now() - interval '9 days', now() - interval '2 hours',
   'a0000000-0000-4000-8000-000000000002'),
  ('a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000012', 'Active', 1,
   34, 17, 17, true, true,
   now() - interval '14 days', now() - interval '1 hours',
   'a0000000-0000-4000-8000-000000000012'),
  ('a0000000-0000-4000-8000-000000000903', 'a0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000010', 'Active', 1,
   16, 8, 8, true, true,
   now() - interval '6 days', now() - interval '5 hours',
   'a0000000-0000-4000-8000-000000000010'),
  ('a0000000-0000-4000-8000-000000000904', 'a0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000008', 'Active', 1,
   12, 6, 6, true, false,
   now() - interval '11 days', now() - interval '20 hours',
   'a0000000-0000-4000-8000-000000000008'),
  ('a0000000-0000-4000-8000-000000000905', 'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004', 'Active', 1,
   7, 4, 3, true, false,
   now() - interval '4 days', now() - interval '30 hours',
   'a0000000-0000-4000-8000-000000000003'),
  ('a0000000-0000-4000-8000-000000000906', 'a0000000-0000-4000-8000-000000000013', 'a0000000-0000-4000-8000-000000000014', 'Ghosted', 2,
   6, 3, 3, true, false,
   now() - interval '12 days', now() - interval '10 days',
   'a0000000-0000-4000-8000-000000000014'),
  ('a0000000-0000-4000-8000-000000000907', 'a0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000006', 'Active', 1,
   4, 2, 2, true, false,
   now() - interval '2 days', now() - interval '8 hours',
   'a0000000-0000-4000-8000-000000000006'),
  ('a0000000-0000-4000-8000-000000000908', 'a0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000016', 'Active', 1,
   2, 1, 1, true, false,
   now() - interval '1 days', now() - interval '26 hours',
   'a0000000-0000-4000-8000-000000000016'),
  ('a0000000-0000-4000-8000-000000000909', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000015', 'Unmatched', 1,
   0, 0, 0, false, false,
   now() - interval '20 days', NULL,
   NULL);

-- Authored conversations, one per match. The old seed looped the same eight lines through
-- every thread, so chat, the reveal strip and the activity gate all rendered the same wallpaper.
-- NB: `messages` is the one table on snake_case columns (a Supabase-era leftover).
INSERT INTO "messages" (id, match_id, sender_id, content, created_at) VALUES
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000901', 'a0000000-0000-4000-8000-000000000001', 'Сайн байна уу, Номин. Профайл дээрх ном унших хэсэг чинь анхаарал татлаа — сүүлд юу уншсан бэ?',
   now() - interval '9 days' + interval '0 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000901', 'a0000000-0000-4000-8000-000000000002', 'Сайн байна уу :) Сүүлд Хан Канн-ы «Цагаан ном»-ыг уншсан. Нимгэн ч удаан уншигдсан.',
   now() - interval '9 days' + interval '14 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000901', 'a0000000-0000-4000-8000-000000000001', 'Тэрийг нь сонсож байсан. Удаан уншигдсан гэдэг нь сайн шинж үү, муу шинж үү?',
   now() - interval '9 days' + interval '28 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000901', 'a0000000-0000-4000-8000-000000000002', 'Сайн шинж. Хуудас болгоны дараа зогсоод бодох хэрэгтэй болдог.',
   now() - interval '9 days' + interval '42 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000901', 'a0000000-0000-4000-8000-000000000001', 'Ойлголоо. Би сүүлдээ ажлын дараа ном барихаар нойр хүрчихдэг болсон.',
   now() - interval '9 days' + interval '44 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000901', 'a0000000-0000-4000-8000-000000000002', 'Эмийн санд ч мөн адил. 12 цагийн ээлжийн дараа хамгийн сайн ном ч ялахгүй.',
   now() - interval '9 days' + interval '58 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000901', 'a0000000-0000-4000-8000-000000000001', '12 цаг?! Тэр чинь хүнд байна шүү.',
   now() - interval '9 days' + interval '72 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000901', 'a0000000-0000-4000-8000-000000000002', 'Долоо хоногт гурав. Оронд нь дараа нь дөрвөн өдөр чөлөөтэй.',
   now() - interval '9 days' + interval '86 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000901', 'a0000000-0000-4000-8000-000000000001', 'Тэр бол үнэндээ сайхан хуваарь юм. Чөлөөт өдрүүддээ юу хийдэг вэ?',
   now() - interval '9 days' + interval '88 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000901', 'a0000000-0000-4000-8000-000000000002', 'Усанд сэлдэг. Долоо хоногт хоёр удаа, заавал. Тэгэхгүй бол нуруу минь өвдөнө.',
   now() - interval '9 days' + interval '102 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000901', 'a0000000-0000-4000-8000-000000000001', 'Би дугуй унадаг. Зуны улиралд Богд ууланд гардаг.',
   now() - interval '9 days' + interval '116 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000901', 'a0000000-0000-4000-8000-000000000002', 'Богд уул! Би хэзээ ч дугуйгаар гарч үзээгүй. Хэцүү юу?',
   now() - interval '9 days' + interval '130 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000901', 'a0000000-0000-4000-8000-000000000001', 'Эхний удаад хэцүү. Дараа нь зүгээр. Гол нь яарахгүй байх.',
   now() - interval '9 days' + interval '132 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000901', 'a0000000-0000-4000-8000-000000000002', 'Тэр зөвлөгөө бүх зүйлд хамаатай юм шиг байна :)',
   now() - interval '9 days' + interval '146 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000901', 'a0000000-0000-4000-8000-000000000001', 'Тийм байх. Ажил дээр ч тэр — би удаан кодчилдог, гэхдээ цөөн алдаатай.',
   now() - interval '9 days' + interval '160 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000901', 'a0000000-0000-4000-8000-000000000002', 'Эм зүйч хүнд яг тэр хандлага хэрэгтэй. Хурдан гэдэг үг манай мэргэжилд аюултай.',
   now() - interval '9 days' + interval '174 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000901', 'a0000000-0000-4000-8000-000000000001', 'Тэгэхээр бид хоёр адилхан хурдгүй хүмүүс юм байна.',
   now() - interval '9 days' + interval '176 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000901', 'a0000000-0000-4000-8000-000000000002', 'Гоё дүгнэлт боллоо :) Тэгээд, кофе муу гэж бичсэн байсан. Яагаад муу?',
   now() - interval '9 days' + interval '190 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000901', 'a0000000-0000-4000-8000-000000000001', 'Учир нь би сайн кофе уухаараа ялгааг нь мэдэхгүй. Мөнгө дэмий үрсэн мэт санагддаг.',
   now() - interval '9 days' + interval '204 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000901', 'a0000000-0000-4000-8000-000000000002', 'Café Amsterdam-д ороод үз. Тэнд буланд нь тайван ширээ бий.',
   now() - interval '9 days' + interval '218 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000901', 'a0000000-0000-4000-8000-000000000001', 'Тэнд очиж үзсэн. Гэхдээ ганцаараа. Хамт ороод ялгааг нь тайлбарлаж өгөх үү?',
   now() - interval '9 days' + interval '220 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000901', 'a0000000-0000-4000-8000-000000000002', 'Тайлбарлах гэдэг нь их даалгавар шиг сонсогдож байна. Гэхдээ за, зөвшөөрлөө.',
   now() - interval '9 days' + interval '234 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000901', 'a0000000-0000-4000-8000-000000000001', 'Пүрэв гарагийн орой 7 цагт болох уу?',
   now() - interval '9 days' + interval '248 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000901', 'a0000000-0000-4000-8000-000000000002', 'Болно. Пүрэв 7 цагт. Хоцорвол би дотор нь ном уншиж байх болно.',
   now() - interval '9 days' + interval '262 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000011', 'Саруул, профайл чинь харагдмагц инээлээ. Нохойн тухай тэр өгүүлбэр яг үнэн.',
   now() - interval '14 days' + interval '0 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000012', 'Тийм ээ, миний хамгийн үнэнч найзууд бүгд дөрвөн хөлтэй :) Та мал эмнэлэгт ажилладаг гэсэн үү?',
   now() - interval '14 days' + interval '14 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000011', 'Сонгинохайрхан дахь жижиг эмнэлэгт. Ихэвчлэн нохой муур, заримдаа адуу.',
   now() - interval '14 days' + interval '28 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000012', 'Би Найрамдал эмнэлэгт сувилагч. Бид магадгүй нэг хоёр өвчтөнийг хуваалцсан байх.',
   now() - interval '14 days' + interval '42 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000011', 'Тэгсэн байх магадлалтай. Нэрийг чинь сонссон юм шиг санагдаж байна.',
   now() - interval '14 days' + interval '44 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000012', 'Хотод хэдхэн мал эмнэлэг байдаг болохоор гайхах зүйл биш.',
   now() - interval '14 days' + interval '58 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000011', 'Хамгийн хэцүү өвчтөн чинь юу байсан бэ?',
   now() - interval '14 days' + interval '72 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000012', 'Хоёр жилийн өмнөх нэг Мэйн Кун муур. Гурван хүн барьж байж тарилга хийсэн.',
   now() - interval '14 days' + interval '86 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000011', 'Мэйн Кун! Тэд бол муурны дүрд орсон нохой шүү дээ.',
   now() - interval '14 days' + interval '88 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000012', 'Яг тийм. Тэр минийг хазсан, гэхдээ би түүнийг өршөөсөн.',
   now() - interval '14 days' + interval '102 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000011', 'Өршөөсөн гэдэг нь мэргэжлийн ур чадвар юм.',
   now() - interval '14 days' + interval '116 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000012', 'Ажлын нэг хэсэг :) Та яагаад мал эмнэлэг сонгосон бэ?',
   now() - interval '14 days' + interval '130 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000011', 'Хүүхэд байхад манайд хөгшин нохой байсан. Түүнийг эмчлэх гэж хичээгээд чадаагүй.',
   now() - interval '14 days' + interval '132 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000012', 'Тэгээд сурчихсан юм байна.',
   now() - interval '14 days' + interval '146 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000011', 'Хожуу боловч. Одоо тэр төрлийн тохиолдол ирэхээр өөр мэдрэмж төрдөг.',
   now() - interval '14 days' + interval '160 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000012', 'Ойлгож байна. Би ч мөн адил шалтгаантай — гэрийн муур маань.',
   now() - interval '14 days' + interval '174 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000011', 'Тэр муур одоо байгаа юу?',
   now() - interval '14 days' + interval '176 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000012', 'Байгаа. Арван нэгэн настай, надаас илүү зөрүүд.',
   now() - interval '14 days' + interval '190 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000011', 'Арван нэг гэдэг сайн нас. Хооллолт нь чухал болдог.',
   now() - interval '14 days' + interval '204 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000012', 'Мэднэ ээ, өдөрт хоёр удаа, бөөрний тусгай тэжээл. Ажил гэртээ ирдэг.',
   now() - interval '14 days' + interval '218 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000011', 'Бидний ажил гэртээ ирэхээ болихгүй.',
   now() - interval '14 days' + interval '220 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000012', 'Хэзээ ч. Гэхдээ би гомдоллохгүй.',
   now() - interval '14 days' + interval '234 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000011', 'Амралтын өдөр юу хийдэг вэ? Ажлаас гадна.',
   now() - interval '14 days' + interval '248 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000012', 'Хотоос гардаг. Тэрэлж рүү, эсвэл зүгээр л машинаар.',
   now() - interval '14 days' + interval '262 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000011', 'Би морь унадаг. Хөвсгөлд өссөн.',
   now() - interval '14 days' + interval '264 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000012', 'Хөвсгөл! Би нэг л удаа очсон, зун. Ус нь хүйтэн байсан.',
   now() - interval '14 days' + interval '278 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000011', 'Зун ч гэсэн хүйтэн. Тэр бол онцлог нь.',
   now() - interval '14 days' + interval '292 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000012', 'Дахиад очих юмсан гэж боддог.',
   now() - interval '14 days' + interval '306 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000011', 'Намар хамгийн сайхан байдаг. Аялагч цөөн, өнгө нь сайхан.',
   now() - interval '14 days' + interval '308 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000012', 'Намар гэхээр ажил их байдаг. Гэхдээ төлөвлөж болно.',
   now() - interval '14 days' + interval '322 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000011', 'Төлөвлөх нь ямар ч байсан үнэгүй.',
   now() - interval '14 days' + interval '336 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000012', 'Тэгвэл эхлээд хотод уулзъя, дараа нь Хөвсгөлөө яръя :)',
   now() - interval '14 days' + interval '350 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000011', 'Шударга солилцоо. Энэ долоо хоногт завтай өдөр бий юу?',
   now() - interval '14 days' + interval '352 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000902', 'a0000000-0000-4000-8000-000000000012', 'Бямба гарагийн үдээс хойш чөлөөтэй.',
   now() - interval '14 days' + interval '366 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000903', 'a0000000-0000-4000-8000-000000000009', 'Хулан, гурван хэл гэж бичсэн байна. Аль гурав вэ?',
   now() - interval '6 days' + interval '0 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000903', 'a0000000-0000-4000-8000-000000000010', 'Монгол, англи, орос. Тэгээд Google Translate бол дөрөв дэх нь :)',
   now() - interval '6 days' + interval '14 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000903', 'a0000000-0000-4000-8000-000000000009', 'Орос хэл сурахад хэцүү байсан уу?',
   now() - interval '6 days' + interval '28 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000903', 'a0000000-0000-4000-8000-000000000010', 'Хэлзүй нь хэцүү, дуудлага нь амархан. Англи хэл эсрэгээрээ.',
   now() - interval '6 days' + interval '42 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000903', 'a0000000-0000-4000-8000-000000000009', 'Би дата дээр ажилладаг болохоор код л мэднэ. Хэл гэхээр Python.',
   now() - interval '6 days' + interval '44 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000903', 'a0000000-0000-4000-8000-000000000010', 'Python бол хэл мөн. Зөвхөн ярилцагч нь тэвчээртэй.',
   now() - interval '6 days' + interval '58 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000903', 'a0000000-0000-4000-8000-000000000009', 'Тэвчээртэй биш ээ, зүгээр л шууд алдаа заачихдаг.',
   now() - interval '6 days' + interval '72 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000903', 'a0000000-0000-4000-8000-000000000010', 'Тэр бол миний ажилд ч байдаг. Зөвхөн алдааг хүн заана, бас нэлээд чангаар.',
   now() - interval '6 days' + interval '86 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000903', 'a0000000-0000-4000-8000-000000000009', 'Ширээний тоглоом тоглодог уу? Би цуглуулдаг, гэхдээ ихэнхийг нь тоглож үзээгүй.',
   now() - interval '6 days' + interval '88 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000903', 'a0000000-0000-4000-8000-000000000010', 'Хэдэн ширхэг вэ?',
   now() - interval '6 days' + interval '102 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000903', 'a0000000-0000-4000-8000-000000000009', 'Гучин долоо. Тоглосон нь арваад.',
   now() - interval '6 days' + interval '116 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000903', 'a0000000-0000-4000-8000-000000000010', 'Тэр бол цуглуулга биш, номын сан юм байна :)',
   now() - interval '6 days' + interval '130 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000903', 'a0000000-0000-4000-8000-000000000009', 'Зөв шүүмжиллээ. Хамт тоглох хүн олдохгүй байгаа нь гол шалтгаан.',
   now() - interval '6 days' + interval '132 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000903', 'a0000000-0000-4000-8000-000000000010', 'Би тоглоно. Гэхдээ дүрмийг нь удаан тайлбарлах хэрэгтэй болно.',
   now() - interval '6 days' + interval '146 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000903', 'a0000000-0000-4000-8000-000000000009', 'Дүрэм тайлбарлах бол миний хамгийн дуртай хэсэг.',
   now() - interval '6 days' + interval '160 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000903', 'a0000000-0000-4000-8000-000000000010', 'Тэгвэл асуудалгүй. Хэзээ?',
   now() - interval '6 days' + interval '174 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000904', 'a0000000-0000-4000-8000-000000000007', 'Нарантуяа, ноолуурын үйлдвэр гэдэг сонирхолтой байна. Хэдэн жил болж байна?',
   now() - interval '11 days' + interval '0 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000904', 'a0000000-0000-4000-8000-000000000008', 'Долоон жил. Эхэндээ гэртээ, одоо жижиг цехтэй.',
   now() - interval '11 days' + interval '14 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000904', 'a0000000-0000-4000-8000-000000000007', 'Би жуулчны бааз эрхэлдэг. Зун бид хоёулаа завгүй байх шив дээ.',
   now() - interval '11 days' + interval '28 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000904', 'a0000000-0000-4000-8000-000000000008', 'Зун бол ноолуур зардаггүй улирал. Харин ч би зундаа амардаг.',
   now() - interval '11 days' + interval '42 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000904', 'a0000000-0000-4000-8000-000000000007', 'Тэгвэл бид эсрэгээрээ юм байна. Миний амралт бол өвөл.',
   now() - interval '11 days' + interval '44 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000904', 'a0000000-0000-4000-8000-000000000008', 'Тэгэхээр хавар намар л уулзах цаг гарна гэсэн үг :)',
   now() - interval '11 days' + interval '58 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000904', 'a0000000-0000-4000-8000-000000000007', 'Эсвэл би зундаа нэг өдөр хулгайлж болно.',
   now() - interval '11 days' + interval '72 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000904', 'a0000000-0000-4000-8000-000000000008', 'Жуулчид тань юу гэх бол.',
   now() - interval '11 days' + interval '86 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000904', 'a0000000-0000-4000-8000-000000000007', 'Жуулчид маань морь унаад л явчихна. Тэд намайг санахгүй.',
   now() - interval '11 days' + interval '88 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000904', 'a0000000-0000-4000-8000-000000000008', 'Итгэмээргүй байна. Гэхдээ сонирхолтой санал.',
   now() - interval '11 days' + interval '102 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000904', 'a0000000-0000-4000-8000-000000000007', 'Тэрэлж рүү нэг өдрийн аялал хийе. Ажил бишээр.',
   now() - interval '11 days' + interval '116 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000904', 'a0000000-0000-4000-8000-000000000008', 'Ажил бишээр гэдгийг чинь тэмдэглэж авлаа.',
   now() - interval '11 days' + interval '130 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000905', 'a0000000-0000-4000-8000-000000000003', 'Сарнай, фонтны талаар маргаж чадна гэсэн. Comic Sans-ыг хамгаалж чадах уу?',
   now() - interval '4 days' + interval '0 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000905', 'a0000000-0000-4000-8000-000000000004', 'Чадна. Зөвхөн дислекситэй хүмүүсийн уншихад тустай гэсэн судалгаа бий :)',
   now() - interval '4 days' + interval '14 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000905', 'a0000000-0000-4000-8000-000000000003', 'Хүлээж аваад л дуусгая, чи яллаа.',
   now() - interval '4 days' + interval '28 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000905', 'a0000000-0000-4000-8000-000000000004', 'Хурдан бууж өглөө. Архитектор хүн илүү зөрүүд байх болов уу гэж бодсон.',
   now() - interval '4 days' + interval '42 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000905', 'a0000000-0000-4000-8000-000000000003', 'Барилга дээр зөрүүд, фонт дээр биш.',
   now() - interval '4 days' + interval '44 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000905', 'a0000000-0000-4000-8000-000000000004', 'Хотын аль барилгыг хамгийн их шүүмжилдэг вэ?',
   now() - interval '4 days' + interval '58 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000905', 'a0000000-0000-4000-8000-000000000003', 'Нэрийг нь хэлэхгүй. Гэхдээ Сүхбаатарын талбайн эргэн тойронд байгаа.',
   now() - interval '4 days' + interval '72 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000906', 'a0000000-0000-4000-8000-000000000013', 'Сайн байна уу. Тогооч хүнтэй болзох дуртай юу?',
   now() - interval '12 days' + interval '0 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000906', 'a0000000-0000-4000-8000-000000000014', 'Хоол хийж өгдөг бол дуртай :)',
   now() - interval '12 days' + interval '14 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000906', 'a0000000-0000-4000-8000-000000000013', 'Тэгвэл асуудалгүй. Юу идэх дуртай вэ?',
   now() - interval '12 days' + interval '28 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000906', 'a0000000-0000-4000-8000-000000000014', 'Бүх зүйл. Гэхдээ халуун ногоо багатай.',
   now() - interval '12 days' + interval '42 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000906', 'a0000000-0000-4000-8000-000000000013', 'Ойлголоо. Энэ долоо хоногт завтай юу?',
   now() - interval '12 days' + interval '44 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000906', 'a0000000-0000-4000-8000-000000000014', 'Энэ долоо хоног хэцүү байх шиг байна. Дараа нь бичье.',
   now() - interval '12 days' + interval '58 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000907', 'a0000000-0000-4000-8000-000000000005', 'Мишээл, хошигнолыг нь хэлэхгүй гэж амлая :)',
   now() - interval '2 days' + interval '0 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000907', 'a0000000-0000-4000-8000-000000000006', 'Баярлалаа, та анхны хүн боллоо.',
   now() - interval '2 days' + interval '14 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000907', 'a0000000-0000-4000-8000-000000000005', 'Би сэргээн засах эмч. Бид хоёр хоёулаа хүмүүсийн айдаг мэргэжилтэй.',
   now() - interval '2 days' + interval '28 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000907', 'a0000000-0000-4000-8000-000000000006', 'Тийм ээ. Гэхдээ таных дараа нь сайхан болдог, минийх бол шууд.',
   now() - interval '2 days' + interval '42 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000908', 'a0000000-0000-4000-8000-000000000009', 'Оюунаа, latte art сурч байгаа гэсэн. Одоогоор юу гардаг вэ?',
   now() - interval '1 days' + interval '0 minutes'),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000908', 'a0000000-0000-4000-8000-000000000016', 'Зүрх гарна. Навч гэж оролдоод бүтэхгүй байгаа :)',
   now() - interval '1 days' + interval '14 minutes');


-- ---------------------------------------------------------------- score history

INSERT INTO "ScoreEvents" ("Id","UserId","EventType","Delta","CreatedAt")
SELECT gen_random_uuid(), u."Id", e.t, e.p, now() - (g.i || ' days')::interval
FROM (SELECT "Id" FROM "Users" WHERE "IsProfileComplete" ORDER BY "CreatedAt") u
CROSS JOIN generate_series(1, 5) AS g(i)
CROSS JOIN LATERAL (
  SELECT (ARRAY['DailyLogin','ProfileComplete','FirstMessage','IcebreakerDone','DateConfirmed'])[1 + (g.i % 5)] AS t,
         (ARRAY[5, 50, 20, 20, 60])[1 + (g.i % 5)] AS p
) e;

-- ---------------------------------------------------------------- fated threads (ships)

INSERT INTO "Ships" ("Id","ShipperUserId","SlotAUserId","SlotBUserId",
  "SlotAOptIn","SlotBOptIn","SlotAInviteCode","SlotBInviteCode","Status","CreatedAt")
VALUES
  -- Болормаа introduces Түвшин to Цогтбаатар; neither has answered yet.
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000017',
   'a0000000-0000-4000-8000-000000000018', 'a0000000-0000-4000-8000-000000000013',
   'Pending','Pending','TVSH01','TSOG01','Pending', now() - interval '1 day'),
  -- Алтанзул introduces Ануужин to Төмөрлөн; one side is in.
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000019',
   'a0000000-0000-4000-8000-000000000015', 'a0000000-0000-4000-8000-000000000003',
   'Accepted','Pending','ANUJ01','TEMU01','Pending', now() - interval '3 days'),
  -- Нарантуяа's introduction took: both accepted, the thread sparked.
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000008',
   'a0000000-0000-4000-8000-000000000016', 'a0000000-0000-4000-8000-000000000009',
   'Accepted','Accepted','OYUN01','MUNK01','Sparked', now() - interval '6 days'),
  -- And one that was turned down, so the declined branch renders too.
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000007',
   'a0000000-0000-4000-8000-000000000014', 'a0000000-0000-4000-8000-000000000005',
   'Declined','Pending','DELG01','ENKH01','Declined', now() - interval '9 days');

-- ---------------------------------------------------------------- town square

INSERT INTO "TownSquareSessions"
  ("Id","ScheduledStartAt","RsvpOpensAt","RsvpClosesAt","Status","CurrentRoundNumber","CreatedAt")
VALUES
  -- 'Open' is the only live status the engine creates or reads: GetNextSession filters
  -- Open/Locked/InProgress and the scheduler only moves Open -> Locked -> InProgress. A seeded
  -- 'Scheduled' row was invisible to the app and nothing ever opened it, so the Town Square tab
  -- read "the square stands quiet" forever in dev.
  (gen_random_uuid(), now() + interval '2 days', now() - interval '1 day',
   now() + interval '2 days' - interval '1 hour', 'Open', 0, now() - interval '3 days'),
  (gen_random_uuid(), now() + interval '9 days', now() + interval '7 days',
   now() + interval '9 days' - interval '1 hour', 'Open', 0, now() - interval '1 day'),
  (gen_random_uuid(), now() - interval '7 days', now() - interval '9 days',
   now() - interval '7 days' - interval '1 hour', 'Completed', 5, now() - interval '10 days');

INSERT INTO "TownSquareRsvps" ("Id","SessionId","UserId","RsvpAt")
SELECT gen_random_uuid(), s."Id", u."Id", now() - interval '6 hours'
FROM (SELECT "Id" FROM "TownSquareSessions" WHERE "Status" = 'Open'
      ORDER BY "ScheduledStartAt" LIMIT 1) s
CROSS JOIN (SELECT "Id" FROM "Users" WHERE "IsProfileComplete" ORDER BY "CreatedAt" LIMIT 8) u;

-- ---------------------------------------------------------------- milestones

-- The seed writes matches, icebreaker completions and messages straight into the tables, so the
-- controllers that would normally call MilestoneService.AchieveAsync never run. Without these
-- rows GettingStartedCard keys off an empty milestone set and tells a 2,100-point Emerald with
-- three bonds to go forge their first bond.
INSERT INTO "UserMilestones" ("Id","UserId","MilestoneId","AchievedAt","OpenedAt")
SELECT gen_random_uuid(), p."UserId", p."MilestoneId", now() - interval '5 days', now() - interval '5 days'
FROM (
  SELECT DISTINCT "InitiatorId" AS "UserId", 'first_match' AS "MilestoneId" FROM "Matches"
  UNION
  SELECT DISTINCT "ReceiverId", 'first_match' FROM "Matches"
  UNION
  SELECT DISTINCT "InitiatorId", 'first_icebreaker' FROM "Matches" WHERE "IcebreakerComplete"
  UNION
  SELECT DISTINCT "ReceiverId", 'first_icebreaker' FROM "Matches" WHERE "IcebreakerComplete"
  UNION
  SELECT DISTINCT "InitiatorId", 'ten_messages_one_match' FROM "Matches" WHERE "MessageCount" >= 10
  UNION
  SELECT DISTINCT "ReceiverId", 'ten_messages_one_match' FROM "Matches" WHERE "MessageCount" >= 10
  UNION
  SELECT DISTINCT "UserId", 'first_quiz' FROM "QuizResponses"
  UNION
  SELECT DISTINCT "InitiatorId", 'first_video_call' FROM "Matches" WHERE "VideoCallUnlocked"
  UNION
  SELECT DISTINCT "ReceiverId", 'first_video_call' FROM "Matches" WHERE "VideoCallUnlocked"
  UNION
  SELECT "Id", 'oath_proven' FROM "Users" WHERE "OathProven"
) p
ON CONFLICT ("UserId","MilestoneId") DO NOTHING;

-- ---------------------------------------------------------------- icebreaker answers

-- Every match whose IcebreakerComplete is true needs both sides' answers on the same question,
-- or the reveal screen renders a completed icebreaker with nothing in it.
INSERT INTO "IcebreakerResponses" ("Id","MatchId","UserId","IcebreakerId","Answer","CreatedAt")
SELECT gen_random_uuid(), m."Id", u, ib."Id", a.txt, m."CreatedAt" + interval '20 minutes'
FROM "Matches" m
CROSS JOIN LATERAL (SELECT "Id" FROM "Icebreakers" WHERE "IsActive" ORDER BY "Id" LIMIT 1) ib
CROSS JOIN LATERAL (VALUES
  (m."InitiatorId", 'Сүүлд ажлын хамт олонтойгоо инээлдсэн. Ямар учиртай нь одоо санахгүй байна.'),
  (m."ReceiverId",  'Нохойгоо усанд оруулах гэж оролдоод би нь илүү нордог болсон :)')
) AS a(u, txt)
WHERE m."IcebreakerComplete";

-- ---------------------------------------------------------------- lifecycle states

-- Дэлгэрмаа has paused her profile; Цогтбаатар is mid deletion grace period. Both stay out of
-- Discover, which is the point: the pause and deletion paths need something to exercise them.
UPDATE "Users" SET "IsPaused" = true
WHERE "Id" = 'a0000000-0000-4000-8000-000000000014';
UPDATE "Users" SET "DeletionRequestedAt" = now() - interval '2 days'
WHERE "Id" = 'a0000000-0000-4000-8000-000000000013';

-- One block in each direction so the blocked list and the mutual-exclusion filter both render.
INSERT INTO "BlockedUsers" ("Id","BlockerId","BlockedId","CreatedAt")
VALUES
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000019',
   'a0000000-0000-4000-8000-000000000013', now() - interval '2 days');

COMMIT;
