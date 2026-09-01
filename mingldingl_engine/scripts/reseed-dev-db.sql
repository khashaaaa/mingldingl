-- Wipes and reseeds the local development database with varied, realistic Mongolian-market data.
-- Reference content (icebreakers, quizzes, content pages, businesses) plus a user population
-- spread across every tier, oath, membership and lifecycle state the app has to render.
--
-- Destructive. Local dev only: mingldingl_engine/scripts/reseed-dev-db.sql
-- NOT truncated: AdminConfigs (AdminConfigSeeder owns it and re-syncs on boot) and
-- ContentPages (authored product copy — terms, privacy, and the guides text — not fixtures).

BEGIN;

TRUNCATE TABLE
  "TownSquareIcebreakerResponses", "TownSquarePairings", "TownSquareRounds",
  "TownSquareRsvps", "TownSquareSessions",
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

-- ---------------------------------------------------------------- users
-- 60 users spread across every tier, oath, membership and lifecycle state, so each screen
-- has something real to render (empty states are exercised by the tail of the list).

INSERT INTO "Users" (
  "Id","DisplayName","Age","Gender","City","Bio","PhotoUrls","IsProfileComplete",
  "HasKids","SmokingHabit","DrinkingHabit","Religion","Lifestyle",
  "TotalScore","GemTier","ReputationScore","MembershipLevel","DailyMatchesUsed",
  "DailyMatchesResetAt","CreatedAt","CurrentStreak","LongestStreak","LastLoginDate",
  "PhoneNumber","Latitude","Longitude","IsDeleted","PushEnabled","AgeMin","AgeMax",
  "IsPaused","IsBanned","NoShowFlagCount","Oath","OathProven","ReferralCode")
SELECT
  gen_random_uuid(),
  name, age, gender, 'Ulaanbaatar', bio,
  jsonb_build_array(
    'http://localhost:5150/uploads/photos/seed/' || slug || '-1.jpg',
    'http://localhost:5150/uploads/photos/seed/' || slug || '-2.jpg',
    'http://localhost:5150/uploads/photos/seed/' || slug || '-3.jpg'),
  true,
  (i % 5 = 0),
  (ARRAY['Never','Socially','Regularly'])[1 + (i % 3)],
  (ARRAY['Never','Socially','Regularly'])[1 + ((i+1) % 3)],
  (ARRAY['Buddhist','None','Spiritual'])[1 + (i % 3)],
  (ARRAY['Active','Balanced','Homebody'])[1 + ((i+2) % 3)],
  score,
  -- Must match ScoreService.TierDefaults exactly, or a user's stored tier disagrees with
  -- what the engine would compute from their score.
  CASE WHEN score >= 2000 THEN 'Emerald' WHEN score >= 1000 THEN 'Ruby'
       WHEN score >= 600 THEN 'Sapphire' WHEN score >= 300 THEN 'Amethyst'
       WHEN score >= 100 THEN 'Opal' ELSE 'Garnet' END,
  reputation,
  CASE WHEN i % 9 = 0 THEN 'Gold' WHEN i % 5 = 0 THEN 'Silver' ELSE 'Free' END,
  (i % 4), now()::date, now() - (i || ' days')::interval,
  (i % 12), (i % 12) + (i % 7), now() - ((i % 3) || ' days')::interval,
  '8' || lpad((1000000 + i)::text, 7, '0'),
  47.90 + (i % 20) * 0.004, 106.88 + (i % 25) * 0.005,
  false, true, 18, 99, (i % 23 = 0), (i % 29 = 0), (i % 17)::int,
  CASE WHEN i % 4 = 0 THEN NULL ELSE (ARRAY['Bond','Fate','Kinship'])[1 + (i % 3)] END,
  (i % 6 = 0), upper(substr(md5(name), 1, 6))
FROM (
  SELECT row_number() OVER () AS i, name, gender, bio,
         18 + ((row_number() OVER ()) * 7 % 30) AS age,
         ((row_number() OVER ()) * 137 % 6000) AS score,
         round((3.0 + ((row_number() OVER ()) % 21) * 0.1)::numeric, 2) AS reputation,
         lower(regexp_replace(name, '[^a-zA-Z]', '', 'g')) AS slug
  FROM (VALUES
    ('Altantsetseg','Female','Teacher. I read more than I sleep and I am fine with that.'),
    ('Bat-Erdene','Male','Engineer, hiker, terrible cook. Working on the third one.'),
    ('Oyunchimeg','Female','I run a small bakery in Bayangol. Ask me about bread.'),
    ('Ganbaatar','Male','Ex-wrestler, current accountant. Both require patience.'),
    ('Enkhjargal','Female','Nurse on night shifts. Free most afternoons.'),
    ('Tuvshinbayar','Male','Photographer. I will make you pose on a hill.'),
    ('Saruul','Female','Vet. Dogs like me more than people do, usually.'),
    ('Munkhbat','Male','Software developer. Yes, I can fix your wifi.'),
    ('Nomin-Erdene','Female','Architect. I judge buildings out loud, sorry in advance.'),
    ('Batbayar','Male','Truck driver. I have seen every road in this country.'),
    ('Uyanga','Female','Musician. Loud job, quiet person.'),
    ('Temuulen','Male','Med student. Perpetually tired, still fun.'),
    ('Khulan','Female','Translator. Three languages, zero sense of direction.'),
    ('Sukhbold','Male','Chef. I will cook, you do dishes. Fair deal.'),
    ('Gerelmaa','Female','Banker who wants to quit banking. Talk me into it.'),
    ('Otgonbayar','Male','Electrician, weekend fisherman, dad of one.'),
    ('Anujin','Female','Graphic designer. Strong opinions about fonts.'),
    ('Chuluunbold','Male','Geologist. I am away three weeks a month, be warned.'),
    ('Delgermaa','Female','Pharmacist. Calm by training and by nature.'),
    ('Erdenebat','Male','Carpenter. I built the table I am typing on.'),
    ('Bolormaa','Female','Journalist. I ask a lot of questions.'),
    ('Ariunbold','Male','Gym owner. Not as intense as that sounds.'),
    ('Tsetsegmaa','Female','Kindergarten teacher. Patience is my whole personality.'),
    ('Naranbaatar','Male','Pilot. Home less than I would like.'),
    ('Solongo','Female','Dentist. Everyone tells me the same joke.'),
    ('Batzorig','Male','Farmer outside the city. Come see the horses.'),
    ('Undram','Female','Lawyer. Off the clock I am much nicer.'),
    ('Jargalsaikhan','Male','Taxi driver, amateur historian, excellent storyteller.'),
    ('Amarjargal','Female','Data analyst. I like patterns and long walks.'),
    ('Battulga','Male','Firefighter. Steady under pressure, useless at small talk.')
  ) AS n(name, gender, bio)
) AS src
UNION ALL
-- A second cohort, older and quieter, so age and tier filters have both ends to work with.
SELECT
  gen_random_uuid(),
  name || ' B.', 34 + (i % 22), gender, 'Ulaanbaatar', bio,
  jsonb_build_array('http://localhost:5150/uploads/photos/seed/alt-' || i || '-1.jpg'),
  (i % 7 <> 0),
  (i % 3 = 0), 'Never', 'Socially', 'Buddhist', 'Homebody',
  (i * 53) % 900,
  CASE WHEN (i * 53) % 900 >= 600 THEN 'Sapphire' WHEN (i * 53) % 900 >= 300 THEN 'Amethyst'
       WHEN (i * 53) % 900 >= 100 THEN 'Opal' ELSE 'Garnet' END,
  round((2.5 + (i % 15) * 0.1)::numeric, 2),
  'Free', 0, now()::date, now() - ((30 + i) || ' days')::interval,
  0, (i % 4), now() - ((i % 9) || ' days')::interval,
  '9' || lpad((2000000 + i)::text, 7, '0'),
  47.88 + (i % 15) * 0.003, 106.90 + (i % 18) * 0.004,
  false, (i % 4 <> 0), 25, 60, false, false, 0,
  CASE WHEN i % 3 = 0 THEN 'Kinship' ELSE NULL END, false,
  upper(substr(md5(name || 'b'), 1, 6))
FROM (
  SELECT row_number() OVER () AS i, name, gender, bio FROM (VALUES
    ('Dorj','Male','Retired teacher. Chess, walks, quiet evenings.'),
    ('Sarantuya','Female','Grandmother of two. Not looking to rush anything.'),
    ('Purevdorj','Male','Mechanic. Thirty years under cars, still curious.'),
    ('Khishigjargal','Female','Seamstress. I make most of what I wear.'),
    ('Byambasuren','Male','Herder turned shopkeeper. City is loud but fine.'),
    ('Oyuntsetseg','Female','Retired nurse. Gardening season is my favourite.'),
    ('Ganzorig','Male','Security guard, night shifts, lots of reading time.'),
    ('Tsolmon','Female','Accountant. Divorced, calm about it.'),
    ('Enkhtuya','Female','Baker. Up at four, asleep by nine.'),
    ('Bayarsaikhan','Male','Bus driver. I know every face on route 22.')
  ) AS n(name, gender, bio)
) AS src2;

COMMIT;

BEGIN;

-- ---------------------------------------------------------------- matches
-- Pairs drawn from the complete-profile cohort, spread across every reveal tier and status
-- so the matches list, chat, and reveal strip all have something to render.

WITH pool AS (
  SELECT "Id", row_number() OVER (ORDER BY "CreatedAt") AS rn
  FROM "Users" WHERE "IsProfileComplete" AND NOT "IsDeleted" AND NOT "IsBanned"
),
pairs AS (
  SELECT a."Id" AS a_id, b."Id" AS b_id, a.rn AS n
  FROM pool a JOIN pool b ON b.rn = a.rn + 15
  WHERE a.rn <= 14
)
INSERT INTO "Matches" (
  "Id","InitiatorId","ReceiverId","Status","RevealLevel","MessageCount",
  "IcebreakerComplete","VideoCallUnlocked","CreatedAt","LastMessageAt","LastMessageSenderId")
SELECT
  gen_random_uuid(), a_id, b_id,
  CASE WHEN n = 13 THEN 'Ghosted' WHEN n = 14 THEN 'Unmatched' ELSE 'Active' END,
  -- Stored floor; the effective level is max(this, level-for-message-count).
  CASE WHEN n = 13 THEN 2 ELSE 1 END,
  msgs,
  (msgs >= 2), (msgs >= 15),
  now() - (n || ' days')::interval,
  CASE WHEN msgs = 0 THEN NULL
       WHEN n = 13 THEN now() - interval '5 days'   -- stale on purpose: feeds the ghost sweep
       ELSE now() - ((n % 3) || ' hours')::interval END,
  CASE WHEN msgs = 0 THEN NULL ELSE a_id END
FROM (SELECT *, (CASE WHEN n <= 3 THEN 0 WHEN n <= 6 THEN 3 WHEN n <= 9 THEN 8
                      WHEN n <= 11 THEN 20 ELSE 35 END) AS msgs FROM pairs) p;

-- Messages for every match that claims to have them, so MessageCount is not a lie.
-- NB: `messages` is the one table on snake_case columns (a Supabase-era leftover).
INSERT INTO "messages" (id, match_id, sender_id, content, created_at)
SELECT
  gen_random_uuid(), m."Id",
  CASE WHEN g.i % 2 = 0 THEN m."InitiatorId" ELSE m."ReceiverId" END,
  (ARRAY[
    'Сайн байна уу! Профайл чинь сонирхолтой санагдлаа.',
    'Баярлалаа :) Чи хаана ажилладаг вэ?',
    'Энэ долоо хоногт завтай юу?',
    'Café Amsterdam-д уулзвал ямар вэ?',
    'Тэр газар надад их таалагддаг.',
    'Маргааш орой болих уу?',
    'Тохирлоо, тэгвэл 7 цагт.',
    'Өнөөдөр их сайхан байлаа, баярлалаа.'
  ])[1 + (g.i % 8)],
  m."CreatedAt" + (g.i || ' minutes')::interval
FROM "Matches" m
CROSS JOIN LATERAL generate_series(1, m."MessageCount") AS g(i)
WHERE m."MessageCount" > 0;

-- ---------------------------------------------------------------- score history

INSERT INTO "ScoreEvents" ("Id","UserId","EventType","Delta","CreatedAt")
SELECT gen_random_uuid(), u."Id", e.t, e.p, now() - (g.i || ' days')::interval
FROM (SELECT "Id" FROM "Users" WHERE "IsProfileComplete" ORDER BY "CreatedAt" LIMIT 20) u
CROSS JOIN generate_series(1, 4) AS g(i)
CROSS JOIN LATERAL (
  SELECT (ARRAY['DailyLogin','ProfileComplete','FirstMessage','IcebreakerDone'])[1 + (g.i % 4)] AS t,
         (ARRAY[5, 50, 20, 20])[1 + (g.i % 4)] AS p
) e;

-- ---------------------------------------------------------------- fated threads (ships)

WITH pool AS (SELECT "Id", row_number() OVER (ORDER BY "CreatedAt") AS rn FROM "Users")
INSERT INTO "Ships" ("Id","ShipperUserId","SlotAUserId","SlotBUserId",
  "SlotAOptIn","SlotBOptIn","SlotAInviteCode","SlotBInviteCode","Status","CreatedAt")
SELECT gen_random_uuid(), w."Id", a."Id", b."Id",
       s.oa, s.ob, upper(substr(md5(a."Id"::text),1,6)), upper(substr(md5(b."Id"::text),1,6)),
       s.st, now() - (s.age || ' days')::interval
FROM (VALUES
  (1, 4, 5, 'Pending','Pending','Pending', 1),
  (2, 6, 7, 'Accepted','Pending','Pending', 3),
  (3, 8, 9, 'Accepted','Accepted','Sparked', 6),
  (10,11,12,'Declined','Pending','Declined', 9)
) AS s(wn, an, bn, oa, ob, st, age)
JOIN pool w ON w.rn = s.wn JOIN pool a ON a.rn = s.an JOIN pool b ON b.rn = s.bn;

-- ---------------------------------------------------------------- town square

INSERT INTO "TownSquareSessions"
  ("Id","ScheduledStartAt","RsvpOpensAt","RsvpClosesAt","Status","CurrentRoundNumber","CreatedAt")
VALUES
  (gen_random_uuid(), now() + interval '2 days', now() - interval '1 day',
   now() + interval '2 days' - interval '1 hour', 'Scheduled', 0, now() - interval '3 days'),
  (gen_random_uuid(), now() + interval '9 days', now() + interval '7 days',
   now() + interval '9 days' - interval '1 hour', 'Scheduled', 0, now() - interval '1 day'),
  (gen_random_uuid(), now() - interval '7 days', now() - interval '9 days',
   now() - interval '7 days' - interval '1 hour', 'Completed', 5, now() - interval '10 days');

INSERT INTO "TownSquareRsvps" ("Id","SessionId","UserId","RsvpAt")
SELECT gen_random_uuid(), s."Id", u."Id", now() - interval '6 hours'
FROM (SELECT "Id" FROM "TownSquareSessions" WHERE "Status" = 'Scheduled'
      ORDER BY "ScheduledStartAt" LIMIT 1) s
CROSS JOIN (SELECT "Id" FROM "Users" WHERE "IsProfileComplete" ORDER BY "CreatedAt" LIMIT 8) u;

-- ---------------------------------------------------------------- blocks & deletion states

WITH pool AS (SELECT "Id", row_number() OVER (ORDER BY "CreatedAt") AS rn FROM "Users")
INSERT INTO "BlockedUsers" ("Id","BlockerId","BlockedId","CreatedAt")
SELECT gen_random_uuid(), a."Id", b."Id", now() - interval '2 days'
FROM pool a JOIN pool b ON b.rn = a.rn + 20 WHERE a.rn IN (2, 5);

-- One account mid grace period and one already past it, so the deletion sweep has both cases.
UPDATE "Users" SET "DeletionRequestedAt" = now() - interval '2 days'
WHERE "Id" = (SELECT "Id" FROM "Users" ORDER BY "CreatedAt" DESC LIMIT 1);
UPDATE "Users" SET "DeletionRequestedAt" = now() - interval '9 days'
WHERE "Id" = (SELECT "Id" FROM "Users" ORDER BY "CreatedAt" DESC OFFSET 1 LIMIT 1);

COMMIT;
