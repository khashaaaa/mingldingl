import QRCode from 'qrcode';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { art } from '../design/art';
import { Button } from '../design/Button';
import { Glyph } from '../design/Glyph';
import { GuildError, guildSession } from './api/client';
import {
  checkPhone,
  guildAbandon,
  guildCreateInvoice,
  guildInvoice,
  guildMe,
  guildSignIn,
  startPhone,
} from './api/generated/guild';
import type { GuildMe, InvoiceView, StartResponse } from './api/generated/model';
import { type Lang, type Say, saveLang, startLang, words } from './words';

type Floor = 'hall' | 'highTable';
type Step =
  | { at: 'phone' }
  | { at: 'code'; start: StartResponse; phone: string }
  | { at: 'choose'; me: GuildMe }
  | { at: 'qr'; invoice: InvoiceView }
  | { at: 'done'; invoice: InvoiceView }
  | { at: 'leave'; me: GuildMe }
  | { at: 'left'; deleteAt: string };

const SayContext = createContext<Say>(words('mn'));
/** The page's words in the reader's language. */
const useSay = () => useContext(SayContext);

const tugrik = (n: number) => `${n.toLocaleString('en-US')}₮`;

/** `/guild/?leave` is the stores' "delete your account on the web": sign in, then Abandon. */
const leaving = new URLSearchParams(window.location.search).has('leave');
const signedIn = (me: GuildMe): Step => (leaving ? { at: 'leave', me } : { at: 'choose', me });

const said = (w: Say, e: unknown) =>
  e instanceof GuildError ? w.error(e.code, e.message) : w.error(null, null);

/** A fresh key per "Pay" press: a double tap or a retry of the same press makes one invoice. */
const newKey = () => crypto.randomUUID().replaceAll('-', '');

/**
 * The Guild House on the web (Figma page S9, 216:4980–216:12458). Pay here with QPay; the floor
 * opens in the app at once. The page asks the engine while its QR is on screen — the only waiting
 * it does — and every answer is the engine's.
 */
export function GuildPage() {
  const [step, setStep] = useState<Step>({ at: 'phone' });
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>(startLang);
  const w = useMemo(() => words(lang), [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `${w.say('sign')} · MingldIngl`;
  }, [lang, w]);

  // Back from a reload inside the half hour: straight to the floors.
  useEffect(() => {
    if (guildSession.get())
      guildMe().then(
        (me) => setStep(signedIn(me)),
        () => guildSession.clear(),
      );
  }, []);

  return (
    <SayContext.Provider value={w}>
      <main className={`guild guild-${lang}`}>
        <button
          type="button"
          className="guild-link guild-lang"
          onClick={() => {
            const next = lang === 'mn' ? 'en' : 'mn';
            saveLang(next);
            setLang(next);
            setError(null);
          }}
        >
          {w.say('switchTo')}
        </button>
        <header className="guild-sign">
          <span>{w.say('sign')}</span>
        </header>
        {error && (
          <p className="guild-error" role="alert">
            {error}
          </p>
        )}
        {step.at === 'phone' && (
          <Phone onStarted={(start, phone) => setStep({ at: 'code', start, phone })} onError={setError} />
        )}
        {step.at === 'code' && (
          <Code
            start={step.start}
            phone={step.phone}
            onIn={(me) => setStep(signedIn(me))}
            onBack={() => setStep({ at: 'phone' })}
            onError={setError}
          />
        )}
        {step.at === 'choose' && (
          <>
            <Choose me={step.me} onInvoice={(invoice) => setStep({ at: 'qr', invoice })} onError={setError} />
            <button
              type="button"
              className="guild-link guild-leave"
              onClick={() => setStep({ at: 'leave', me: step.me })}
            >
              {w.say('abandonLink')}
            </button>
          </>
        )}
        {step.at === 'leave' && (
          <Leave
            me={step.me}
            onLeft={(deleteAt) => setStep({ at: 'left', deleteAt })}
            onKeep={() => setStep({ at: 'choose', me: step.me })}
            onError={setError}
          />
        )}
        {step.at === 'left' && (
          <Stone
            art={art.guildSeal}
            title={w.say('abandonedTitle')}
            body={w.say('abandonedBody', { date: w.onMoon(step.deleteAt) })}
          />
        )}
        {step.at === 'qr' && (
          <Qr invoice={step.invoice} onSettled={(invoice) => setStep({ at: 'done', invoice })} />
        )}
        {step.at === 'done' && (
          <Done
            invoice={step.invoice}
            onAgain={() =>
              guildMe().then(
                (me) => setStep({ at: 'choose', me }),
                (e) => setError(said(w, e)),
              )
            }
          />
        )}
      </main>
    </SayContext.Provider>
  );
}

function Phone({
  onStarted,
  onError,
}: {
  onStarted: (s: StartResponse, phone: string) => void;
  onError: (m: string | null) => void;
}) {
  const w = useSay();
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = /^[0-9]{8}$/.test(phone);
  return (
    <section className="guild-body">
      <h1>{w.say(leaving ? 'leaveTitle' : 'enterTitle')}</h1>
      <p className="voice">{w.say(leaving ? 'leaveBody' : 'enterBody')}</p>
      <label className="label" htmlFor="phone">
        {w.say('phone')}
      </label>
      <div className="guild-phone">
        <span>+976</span>
        <input
          id="phone"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={8}
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
        />
      </div>
      <p className="muted guild-small">{w.say('cost')}</p>
      <Button
        kind="brass"
        className="guild-cta"
        disabled={!valid || busy}
        onClick={async () => {
          setBusy(true);
          onError(null);
          try {
            onStarted(await startPhone({ phone, resumeVerificationId: null, locale: w.lang }), phone);
          } catch (e) {
            onError(said(w, e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {w.say('continue')}
      </Button>
    </section>
  );
}

/** WeSend texts the code; the person types it here. A wrong one may be typed again. */
function Code({
  start,
  phone,
  onIn,
  onBack,
  onError,
}: {
  start: StartResponse;
  phone: string;
  onIn: (me: GuildMe) => void;
  onBack: () => void;
  onError: (m: string | null) => void;
}) {
  const w = useSay();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const full = /^[0-9]{6}$/.test(code);

  const open = async (typed: string) => {
    setBusy(true);
    onError(null);
    try {
      await checkPhone({ verificationId: start.verificationId, code: typed });
      guildSession.set(await guildSignIn({ verificationId: start.verificationId }));
      onIn(await guildMe());
    } catch (e) {
      setCode('');
      if (e instanceof GuildError && e.code === 'auth.wrong_code') onError(said(w, e));
      else if (
        e instanceof GuildError &&
        ['auth.verification_expired', 'auth.too_many_attempts'].includes(e.code)
      ) {
        onError(w.say('codeCold'));
        onBack();
      } else {
        onError(said(w, e));
        if (e instanceof GuildError && e.status !== 0) onBack();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="guild-body">
      <h1>{w.say('codeTitle')}</h1>
      <p className="voice">{w.say('sentTo', { phone: phone.replace(/^(\d{4})(\d+)$/, '$1 $2') })}</p>
      <label className="label" htmlFor="code">
        {w.say('codeLabel')}
      </label>
      <div className="guild-phone">
        <input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          // biome-ignore lint/a11y/noAutofocus: the code is the step's only ask
          autoFocus
          maxLength={6}
          value={code}
          disabled={busy}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
            setCode(digits);
            if (digits.length === 6 && !busy) open(digits);
          }}
        />
      </div>
      <Button kind="brass" className="guild-cta" disabled={!full || busy} onClick={() => open(code)}>
        {w.say('open')}
      </Button>
      <button type="button" className="guild-link" onClick={onBack}>
        {w.say('otherNumber')}
      </button>
    </section>
  );
}

function Choose({
  me,
  onInvoice,
  onError,
}: {
  me: GuildMe;
  onInvoice: (i: InvoiceView) => void;
  onError: (m: string | null) => void;
}) {
  const w = useSay();
  const [floor, setFloor] = useState<Floor>('hall');
  const [months, setMonths] = useState(3);
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());
  const offer = (f: Floor, n: number) => me.offers.find((o) => o.floor === f && o.months === n);
  const chosen = offer(floor, months);
  if (!me.membership.open)
    return <Stone art={art.guildSeal} title={w.say('sealedTitle')} body={w.say('sealedBody')} />;
  return (
    <section className="guild-body">
      <h1>{w.say('climbTitle')}</h1>
      <p className="voice">{w.say('climbBody', { name: me.name })}</p>
      {me.membership.floor !== 'yard' && me.membership.until && (
        <p className="label guild-now">
          {w.say('youSit', {
            floor: w.say(me.membership.floor === 'highTable' ? 'highTable' : 'hall'),
            date: w.onMoon(me.membership.until),
          })}
        </p>
      )}
      <div className="guild-cards">
        {(['hall', 'highTable'] as const).map((f) => (
          <button
            type="button"
            aria-pressed={floor === f}
            key={f}
            className={`guild-card${floor === f ? ' is-on' : ''}`}
            onClick={() => {
              setFloor(f);
              key.current = newKey();
            }}
          >
            <Glyph name={f === 'hall' ? 'feast' : 'crown'} />
            <span>
              <strong>
                {w.say(f === 'hall' ? 'Hall' : 'HighTable')} · {tugrik(offer(f, 1)?.amount ?? 0)}
              </strong>
              <small>{w.say(f === 'hall' ? 'hallGives' : 'highTableGives')}</small>
            </span>
          </button>
        ))}
      </div>
      <p className="label">{w.say('howLong')}</p>
      <div className="guild-chips">
        {[1, 3, 6].map((n) => {
          const o = offer(floor, n);
          return (
            <button
              type="button"
              aria-pressed={months === n}
              key={n}
              className={`guild-chip${months === n ? ' is-on' : ''}`}
              onClick={() => {
                setMonths(n);
                key.current = newKey();
              }}
            >
              {w.chip(n)} · {tugrik(o?.amount ?? 0)}
              {o?.discountPercent ? ` · −${o.discountPercent}%` : ''}
            </button>
          );
        })}
      </div>
      <Button
        kind="brass"
        className="guild-cta"
        disabled={busy || !chosen}
        onClick={async () => {
          setBusy(true);
          onError(null);
          try {
            onInvoice(await guildCreateInvoice({ floor, months, key: key.current }));
          } catch (e) {
            onError(said(w, e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {w.say('pay', { amount: tugrik(chosen?.amount ?? 0) })}
      </Button>
    </section>
  );
}

function Leave({
  me,
  onLeft,
  onKeep,
  onError,
}: {
  me: GuildMe;
  onLeft: (deleteAt: string) => void;
  onKeep: () => void;
  onError: (m: string | null) => void;
}) {
  const w = useSay();
  const [busy, setBusy] = useState(false);
  const store = me.membership.source === 'store';
  return (
    <section className="guild-body">
      <h1>{w.say('leaveQuestion', { name: me.name })}</h1>
      <p className="voice">{w.say('leaveWarn')}</p>
      {me.membership.floor !== 'yard' && (
        <p className="label guild-now">
          {w.say(store ? 'floorGoesStore' : 'floorGoes', {
            floor: w.say(me.membership.floor === 'highTable' ? 'HighTable' : 'Hall'),
          })}
        </p>
      )}
      <Button
        kind="brass"
        className="guild-cta"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          onError(null);
          try {
            const { deleteAt } = await guildAbandon();
            guildSession.clear();
            onLeft(deleteAt);
          } catch (e) {
            onError(said(w, e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {w.say('abandon')}
      </Button>
      <button type="button" className="guild-link" onClick={onKeep}>
        {w.say('keep')}
      </button>
    </section>
  );
}

function Qr({ invoice, onSettled }: { invoice: InvoiceView; onSettled: (i: InvoiceView) => void }) {
  const w = useSay();
  const floor = w.say(invoice.floor === 'highTable' ? 'highTable' : 'hall');
  const [svg, setSvg] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (invoice.qrImage) return;
    QRCode.toString(invoice.qrText, { type: 'svg', margin: 1 }).then(setSvg, () => setSvg(null));
  }, [invoice]);

  // While the QR is up, ask how it stands; the engine checks with QPay itself each time.
  useEffect(() => {
    let live = true;
    let timer = 0;
    const tick = async () => {
      try {
        const now = await guildInvoice(invoice.id);
        if (!live) return;
        if (now.state !== 'open') return onSettled(now);
      } catch {
        // the road wavered; ask again
      }
      if (live) timer = window.setTimeout(tick, 3000);
    };
    timer = window.setTimeout(tick, 3000);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [invoice.id, onSettled]);

  if (waiting)
    return (
      <Stone art={art.stateWaiting} title={w.say('waitingTitle')} body={w.say('waitingBody', { floor })} />
    );
  return (
    <section className="guild-body guild-center">
      <h1>{w.say('scanTitle')}</h1>
      <p className="voice">
        {w.say('scanBody', { amount: tugrik(invoice.amount), floor, months: w.months(invoice.months) })}
      </p>
      <div className="guild-qr" role="img" aria-label={w.say('qrLabel')}>
        {invoice.qrImage ? (
          <img alt="" src={`data:image/png;base64,${invoice.qrImage}`} />
        ) : (
          // biome-ignore lint/security/noDangerouslySetInnerHtml: the SVG is drawn here from QPay's code
          svg && <div dangerouslySetInnerHTML={{ __html: svg }} />
        )}
      </div>
      <div className="guild-banks">
        {invoice.links.map((b) => (
          <a key={b.link} href={b.link} className="guild-bank" onClick={() => setWaiting(true)}>
            {b.logo && <img alt="" src={b.logo} />}
            <span>{b.name}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

function Done({ invoice, onAgain }: { invoice: InvoiceView; onAgain: () => void }) {
  const w = useSay();
  const high = invoice.floor === 'highTable';
  const floor = w.say(high ? 'highTable' : 'hall');
  if (invoice.state === 'paid')
    return (
      <Stone
        art={art.honourLocked}
        title={w.say('welcomeTitle', { floor })}
        body={w.say('welcomeBody', { Floor: w.say(high ? 'HighTable' : 'Hall') })}
        line={invoice.paidUntil ? w.say('paidUntil', { date: w.onMoon(invoice.paidUntil) }) : undefined}
      />
    );
  if (invoice.state === 'cold')
    return (
      <Stone art={art.guildSeal} title={w.say('coldTitle')} body={w.say('coldBody')}>
        <Button kind="brass" className="guild-cta" onClick={onAgain}>
          {w.say('newCode')}
        </Button>
      </Stone>
    );
  return (
    <Stone
      art={art.guildSeal}
      title={w.say('refundTitle')}
      body={w.say('refundBody', { amount: tugrik(invoice.amount) })}
    />
  );
}

function Stone({
  art: src,
  title,
  body,
  line,
  children,
}: {
  art: string;
  title: string;
  body: string;
  line?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="guild-body guild-center guild-stone">
      <img className="guild-art" alt="" src={src} />
      <h1>{title}</h1>
      <p className="voice">{body}</p>
      {line && <p className="label">{line}</p>}
      {children}
    </section>
  );
}
