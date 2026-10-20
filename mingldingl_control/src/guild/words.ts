/**
 * The Guild House page in both languages, Mongolian first (the market's language; the legal pages do
 * the same). The words follow the app's own lines (en.json / mn.json) so the page and the app say one
 * thing. `{name}` slots are filled whole — a Mongolian case suffix is never glued onto one.
 */
export type Lang = 'mn' | 'en';

const en = {
  sign: 'The Guild House',
  switchTo: 'Монгол хэл',
  enterTitle: 'Enter the Guild House',
  leaveTitle: 'Abandon your character',
  enterBody:
    'Sign in with the number your character carries. Pay here, and your floor opens in the app at once.',
  leaveBody:
    'Sign in with the number your character carries. You will be asked once more before anything happens.',
  phone: 'Phone number',
  cost: 'We text a six-digit code to this number. It costs you nothing.',
  continue: 'Continue',
  codeTitle: 'Speak the code',
  sentTo: 'A six-digit code is on its way to {phone}. It lives ten minutes.',
  codeLabel: 'The code',
  open: 'Open the gate',
  otherNumber: 'Use another number',
  codeCold: 'The code went cold. Ask for a new one.',
  sealedTitle: 'The coffers are sealed',
  sealedBody: 'Payment is not open yet. Every floor will open soon; the game is the same until then.',
  climbTitle: 'Climb the Guild House',
  climbBody:
    '{name}, every floor plays the same game and keeps the same word. Higher floors hold more bonds at once and see deeper.',
  youSit: 'You sit in {floor} until {date}. Time bought now follows on.',
  hall: 'the Hall',
  highTable: 'the High Table',
  Hall: 'The Hall',
  HighTable: 'The High Table',
  hallGives: 'More summons each night, two more seats at your fire, the deep profile.',
  highTableGives: 'Summons to spare, four more seats, the deep profile, first seat at the bells.',
  howLong: 'How long',
  moon: '1 moon',
  moons: '{n} moons',
  oneMoon: 'one moon',
  pay: 'Pay {amount} with QPay',
  abandonLink: 'Abandon this character',
  leaveQuestion: 'Abandon {name}?',
  leaveWarn:
    'When the days of grace run out, your portraits, letters and bonds are burned and your number is free again. Sign in to the app before then to keep the character.',
  floorGoes: '{floor} goes with it; time already paid is not returned.',
  floorGoesStore:
    '{floor} goes with it. Cancel its renewal in Google Play or the App Store; time already paid is not returned.',
  abandon: 'Abandon',
  keep: 'Keep my character',
  abandonedTitle: 'The character is abandoned',
  abandonedBody:
    'It burns on {date}, with its portraits, letters and bonds. Sign in to MingldIngl before then to keep it.',
  waitingTitle: 'Waiting for the payment',
  waitingBody: 'Finish in your bank app. We will open {floor} the moment it lands.',
  scanTitle: 'Scan to pay',
  scanBody: '{amount} · {floor} for {months}. Scan with any bank app. This code holds for fifteen minutes.',
  qrLabel: 'QPay code',
  welcomeTitle: 'Welcome to {floor}',
  welcomeBody: 'Open MingldIngl. {Floor} is already yours.',
  paidUntil: 'Paid until {date} · it will not renew on its own',
  coldTitle: 'The code went cold',
  coldBody: 'Fifteen minutes passed and nothing was paid. Nothing was taken.',
  newCode: 'New code',
  refundTitle: 'Your payment is coming back',
  refundBody:
    'We could not open the floor, so {amount} is on its way back to your bank. It lands within three days.',
  generic: 'Something went wrong — try again.',
  network: 'No connection — check your network and try again.',
};

type Words = typeof en;

const mn: Words = {
  sign: 'Наймааны өргөө',
  switchTo: 'English',
  enterTitle: 'Наймааны өргөөнд ор',
  leaveTitle: 'Баатраа орхих',
  enterBody: 'Баатрынхаа дугаараар нэвтэр. Энд төлбөл давхар чинь апп дээр даруй нээгдэнэ.',
  leaveBody: 'Баатрынхаа дугаараар нэвтэр. Юу ч болохоос өмнө дахин нэг асууна.',
  phone: 'Утасны дугаар',
  cost: 'Энэ дугаар руу зургаан оронтой код илгээнэ. Чамд нэг ч төгрөг төлөхгүй.',
  continue: 'Үргэлжлүүлэх',
  codeTitle: 'Кодоо хэл',
  sentTo: 'Зургаан оронтой код замдаа явж байна: {phone}. Арван минут хүчинтэй.',
  codeLabel: 'Код',
  open: 'Хаалгыг нээх',
  otherNumber: 'Өөр дугаар ашиглах',
  codeCold: 'Кодын хугацаа дууслаа. Шинийг ав.',
  sealedTitle: 'Сан хөмрөг хаалттай байна',
  sealedBody: 'Төлбөр хараахан нээгдээгүй. Удахгүй бүх давхар нээгдэнэ; түүнийг хүртэл тоглоом адилхан.',
  climbTitle: 'Наймааны өргөөнд өгс',
  climbBody:
    '{name}, давхар бүр нэг л тоглоом тоглож, нэг л үгэндээ хүрдэг. Дээд давхрууд нэг дор илүү олон холбоо барьж, илүү гүн хардаг.',
  youSit: 'Чиний давхар: {floor}, {date} хүртэл. Одоо авсан хугацаа араас нь үргэлжилнэ.',
  hall: 'Танхим',
  highTable: 'Дээд ширээ',
  Hall: 'Танхим',
  HighTable: 'Дээд ширээ',
  hallGives: 'Шөнө бүр илүү урилга, галын дэргэд хоёр нэмэлт суудал, гүн профайл.',
  highTableGives: 'Урилга элбэг, дөрвөн нэмэлт суудал, гүн профайл, хонхонд эхний суудал.',
  howLong: 'Хэр удаан',
  moon: '1 сар',
  moons: '{n} сар',
  oneMoon: 'нэг сар',
  pay: 'QPay-ээр төлөх · {amount}',
  abandonLink: 'Баатраа орхих',
  leaveQuestion: 'Баатраа орхих уу? · {name}',
  leaveWarn:
    'Хүлээх хоног дуусахад хөрөг, захидал, холбоо чинь шатаагдаж, дугаар чинь чөлөөлөгдөнө. Баатраа үлдээе гэвэл түүнээс өмнө апп руу нэвтэр.',
  floorGoes: 'Давхар чинь ({floor}) хамт алга болно; хэдийн төлсөн хугацааг буцаахгүй.',
  floorGoesStore:
    'Давхар чинь ({floor}) хамт алга болно. Сунгалтыг нь Google Play эсвэл App Store-оос цуцал; хэдийн төлсөн хугацааг буцаахгүй.',
  abandon: 'Орхих',
  keep: 'Баатраа үлдээх',
  abandonedTitle: 'Баатар орхигдлоо',
  abandonedBody:
    'Шатаагдах өдөр: {date}. Хөрөг, захидал, холбоо нь хамт шатна. Түүнээс өмнө MingldIngl-д нэвтэрвэл баатар үлдэнэ.',
  waitingTitle: 'Төлбөрийг хүлээж байна',
  waitingBody: 'Банкны аппдаа төлбөрөө дуусга. Төлбөр орсон даруйд нээгдэнэ: {floor}.',
  scanTitle: 'Уншуулж төлөх',
  scanBody: '{amount} · {floor}, {months}. Аль ч банкны аппаар уншуул. Код арван таван минут хүчинтэй.',
  qrLabel: 'QPay код',
  welcomeTitle: 'Тавтай морил — {floor}',
  welcomeBody: 'MingldIngl-ээ нээ. {Floor} хэдийн чинийх.',
  paidUntil: 'Төлсөн хугацаа: {date} хүртэл · өөрөө сунгагдахгүй',
  coldTitle: 'Кодын хугацаа дууслаа',
  coldBody: 'Арван таван минут өнгөрч, юу ч төлөгдсөнгүй. Юу ч авагдаагүй.',
  newCode: 'Шинэ код',
  refundTitle: 'Төлбөр чинь буцаж байна',
  refundBody:
    'Давхрыг нээж чадсангүй, тиймээс {amount} банк руу чинь буцаж байна. Гурав хоногийн дотор орно.',
  generic: 'Ямар нэг юм буруу боллоо. Дахин оролд.',
  network: 'Холболт алга — сүлжээгээ шалгаад дахин оролд.',
};

/** The engine's rules this page can meet, in Mongolian (the app's `error.<code>` lines). */
const errorsMn: Record<string, string> = {
  'auth.bad_phone': '8 оронтой Монгол дугаар оруул.',
  'auth.not_verified': 'Эхлээд кодоо бич.',
  'auth.already_claimed': 'Энэ код хэдийн ашиглагдсан.',
  'auth.verification_expired': 'Код хуучирсан — шинийг илгээ.',
  'auth.provider_unavailable': 'Баталгаажуулалт түр ажиллахгүй байна, удахгүй дахин оролд.',
  'auth.verification_not_found': 'Энэ код олдсонгүй — шинийг ав.',
  'auth.wrong_code': 'Бидний илгээсэн код энэ биш. Дахин хараад бич.',
  'auth.code_cooldown': 'Код аль хэдийн замдаа явж байна. Дахин хүсэхээсээ өмнө нэг минут хүлээ.',
  'auth.too_many_codes': 'Өнөөдөр энэ дугаар руу хэт олон код очлоо. Дараа дахин оролд.',
  'auth.too_many_attempts': 'Буруу код хэт олон удаа орлоо. Шинэ код ав.',
  rate_limited: 'Хэт олон оролдлого — нэг минут хүлээ.',
  'guild.no_character': 'Энэ дугаартай баатар алга — эхлээд апп дээр баатраа бүтээ.',
  'account.deleted': 'Энэ баатар байхгүй болжээ.',
  'account.suspended': 'Энэ баатар цөлөгдсөн.',
  'membership.closed': 'Сан хөмрөг хаалттай байна.',
  'membership.floor': 'Танхим эсвэл Дээд ширээг сонго.',
  'membership.months': 'Нэг, гурав, зургаан сар.',
  'payments.not_found': 'Энэ нэхэмжлэх олдсонгүй — дахин эхэл.',
  'payments.unavailable': 'QPay хариу өгөхгүй байна — нэг минутын дараа дахин оролд.',
};

const MOONS: Record<Lang, string[]> = {
  en: [
    'first',
    'second',
    'third',
    'fourth',
    'fifth',
    'sixth',
    'seventh',
    'eighth',
    'ninth',
    'tenth',
    'eleventh',
    'twelfth',
  ],
  mn: [
    'нэгдүгээр',
    'хоёрдугаар',
    'гуравдугаар',
    'дөрөвдүгээр',
    'тавдугаар',
    'зургадугаар',
    'долдугаар',
    'наймдугаар',
    'есдүгээр',
    'аравдугаар',
    'арван нэгдүгээр',
    'арван хоёрдугаар',
  ],
};

/** ?lang=en|mn, then the reader's last choice, then Mongolian. */
export function startLang(): Lang {
  const asked = new URLSearchParams(window.location.search).get('lang');
  if (asked === 'en' || asked === 'mn') return asked;
  try {
    const saved = localStorage.getItem('guild.lang');
    if (saved === 'en' || saved === 'mn') return saved;
  } catch {
    // no storage: Mongolian
  }
  return 'mn';
}

export function saveLang(l: Lang) {
  try {
    localStorage.setItem('guild.lang', l);
  } catch {
    // it lasts until reload
  }
}

export function words(lang: Lang) {
  const w = lang === 'mn' ? mn : en;
  const say = (key: keyof Words, vars: Record<string, string | number> = {}) =>
    w[key].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
  const ordinal = (n: number) => {
    const s =
      n % 100 >= 11 && n % 100 <= 13
        ? 'th'
        : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th');
    return `${n}${s}`;
  };
  return {
    lang,
    say,
    /** "the 5th of the second moon" / "хоёрдугаар сарын 5" — the world's calendar, as in the app. */
    onMoon(iso: string) {
      const d = new Date(iso);
      return lang === 'mn'
        ? `${MOONS.mn[d.getMonth()]} сарын ${d.getDate()}`
        : `the ${ordinal(d.getDate())} of the ${MOONS.en[d.getMonth()]} moon`;
    },
    months: (n: number) => (n === 1 ? w.oneMoon : say('moons', { n })),
    chip: (n: number) => (n === 1 ? w.moon : say('moons', { n })),
    /** The engine's rule in the reader's language: its message in English, our line in Mongolian. */
    error(code: string | null, message: string | null) {
      if (code === 'network') return w.network;
      if (lang === 'mn') return (code && errorsMn[code]) || w.generic;
      return message || w.generic;
    },
  };
}

export type Say = ReturnType<typeof words>;
