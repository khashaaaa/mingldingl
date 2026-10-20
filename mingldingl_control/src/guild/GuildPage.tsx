import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { art } from '../design/art';
import { Button } from '../design/Button';
import { GuildError, guildSession } from './api/client';
import {
  guildCreateInvoice,
  guildInvoice,
  guildMe,
  guildSignIn,
  phoneStatus,
  startPhone,
} from './api/generated/guild';
import type { GuildMe, InvoiceView, StartResponse } from './api/generated/model';

type Floor = 'hall' | 'highTable';
type Step =
  | { at: 'phone' }
  | { at: 'code'; start: StartResponse }
  | { at: 'choose'; me: GuildMe }
  | { at: 'qr'; invoice: InvoiceView }
  | { at: 'done'; invoice: InvoiceView };

const FLOOR = { hall: 'the Hall', highTable: 'the High Table' } as const;
const GIVES = {
  hall: 'More summons each night, two more seats at your fire, the deep profile.',
  highTable: 'Summons to spare, four more seats, the deep profile, first seat at the bells.',
} as const;
const MOONS = [
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
];

const tugrik = (n: number) => `${n.toLocaleString('en-US')}₮`;

function ordinal(n: number) {
  const s =
    n % 100 >= 11 && n % 100 <= 13
      ? 'th'
      : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th');
  return `${n}${s}`;
}
/** "the 5th of the second moon" — the world's calendar, as in the app. */
export const onMoon = (iso: string) => {
  const d = new Date(iso);
  return `the ${ordinal(d.getDate())} of the ${MOONS[d.getMonth()]} moon`;
};

const said = (e: unknown) => (e instanceof GuildError ? e.message : 'Something went wrong — try again.');

/** A fresh key per "Pay" press: a double tap or a retry of the same press makes one invoice. */
const newKey = () => crypto.randomUUID().replaceAll('-', '');

/**
 * The Guild House on the web (Figma page S9, 216:4980–216:12458). Pay here with QPay; the floor
 * opens in the app at once. The page asks the engine while its code or QR is on screen — the only
 * waiting it does — and every answer is the engine's.
 */
export function GuildPage() {
  const [step, setStep] = useState<Step>({ at: 'phone' });
  const [error, setError] = useState<string | null>(null);

  // Back from a reload inside the half hour: straight to the floors.
  useEffect(() => {
    if (guildSession.get())
      guildMe().then(
        (me) => setStep({ at: 'choose', me }),
        () => guildSession.clear(),
      );
  }, []);

  return (
    <main className="guild">
      <header className="guild-sign">
        <span>The Guild House</span>
      </header>
      {error && (
        <p className="guild-error" role="alert">
          {error}
        </p>
      )}
      {step.at === 'phone' && (
        <Phone onStarted={(start) => setStep({ at: 'code', start })} onError={setError} />
      )}
      {step.at === 'code' && (
        <Code
          start={step.start}
          onIn={(me) => setStep({ at: 'choose', me })}
          onBack={() => setStep({ at: 'phone' })}
          onError={setError}
        />
      )}
      {step.at === 'choose' && (
        <Choose me={step.me} onInvoice={(invoice) => setStep({ at: 'qr', invoice })} onError={setError} />
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
              (e) => setError(said(e)),
            )
          }
        />
      )}
    </main>
  );
}

function Phone({
  onStarted,
  onError,
}: {
  onStarted: (s: StartResponse) => void;
  onError: (m: string | null) => void;
}) {
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = /^[0-9]{8}$/.test(phone);
  return (
    <section className="guild-body">
      <h1>Enter the Guild House</h1>
      <p className="voice">
        Sign in with the number your character carries. Pay here, and your floor opens in the app at once.
      </p>
      <label className="label" htmlFor="phone">
        Phone number
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
      <p className="muted guild-small">
        You will text a short code from this number to 144773. Your carrier charges 150₮ for that one message.
      </p>
      <Button
        kind="brass"
        className="guild-cta"
        disabled={!valid || busy}
        onClick={async () => {
          setBusy(true);
          onError(null);
          try {
            onStarted(await startPhone({ phone, resumeVerificationId: null }));
          } catch (e) {
            onError(said(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Continue
      </Button>
    </section>
  );
}

function Code({
  start,
  onIn,
  onBack,
  onError,
}: {
  start: StartResponse;
  onIn: (me: GuildMe) => void;
  onBack: () => void;
  onError: (m: string | null) => void;
}) {
  // The app's pace (3 s): verify.mn tells the engine when the text arrives.
  useEffect(() => {
    let live = true;
    const tick = async () => {
      try {
        const s = await phoneStatus(start.verificationId);
        if (!live) return;
        if (s.state === 'verified') {
          const session = await guildSignIn({ verificationId: start.verificationId });
          guildSession.set(session);
          onIn(await guildMe());
          return;
        }
        if (s.state === 'expired') {
          onError('The code went cold. Ask for a new one.');
          onBack();
          return;
        }
      } catch (e) {
        if (!live) return;
        onError(said(e));
        if (e instanceof GuildError && e.status !== 0) return onBack();
      }
      if (live) timer = window.setTimeout(tick, 3000);
    };
    let timer = window.setTimeout(tick, 3000);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [start, onIn, onBack, onError]);

  return (
    <section className="guild-body guild-center">
      <h1>Send this code</h1>
      <p className="guild-code">{start.code.replace(/(\d{3})(\d{3})/, '$1 $2')}</p>
      <p className="guild-to">to 144773</p>
      <p className="guild-instruction">{start.displayInstruction}</p>
      <p className="voice guild-listen">The gatekeeper listens for your word</p>
      <a
        className="btn btn-brass guild-cta"
        style={{ '--brass': `url(${art.brass})` } as React.CSSProperties}
        href={start.smsUri}
      >
        Open messages
      </a>
      <button type="button" className="guild-link" onClick={onBack}>
        Use another number
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
  const [floor, setFloor] = useState<Floor>('hall');
  const [months, setMonths] = useState(3);
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());
  const offer = (f: Floor, n: number) => me.offers.find((o) => o.floor === f && o.months === n);
  const chosen = offer(floor, months);
  if (!me.membership.open)
    return (
      <Stone
        art={art.guildSeal}
        title="The coffers are sealed"
        body="Payment is not open yet. Every floor will open soon; the game is the same until then."
      />
    );
  return (
    <section className="guild-body">
      <h1>Climb the Guild House</h1>
      <p className="voice">
        {me.name}, every floor plays the same game and keeps the same word. Higher floors hold more bonds at
        once and see deeper.
      </p>
      {me.membership.floor !== 'yard' && me.membership.until && (
        <p className="label guild-now">
          You sit in {me.membership.floor === 'highTable' ? FLOOR.highTable : FLOOR.hall} until{' '}
          {onMoon(me.membership.until)}. Time bought now follows on.
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
            <span
              className="glyph"
              style={{ maskImage: `url(${art.glyphs.knot})`, WebkitMaskImage: `url(${art.glyphs.knot})` }}
            />
            <span>
              <strong>
                {f === 'hall' ? 'The Hall' : 'The High Table'} · {tugrik(offer(f, 1)?.amount ?? 0)}
              </strong>
              <small>{GIVES[f]}</small>
            </span>
          </button>
        ))}
      </div>
      <p className="label">How long</p>
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
              {n} {n === 1 ? 'moon' : 'moons'} · {tugrik(o?.amount ?? 0)}
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
            onError(said(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Pay {tugrik(chosen?.amount ?? 0)} with QPay
      </Button>
    </section>
  );
}

function Qr({ invoice, onSettled }: { invoice: InvoiceView; onSettled: (i: InvoiceView) => void }) {
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
      <Stone
        art={art.stateWaiting}
        title="Waiting for the payment"
        body={`Finish in your bank app. We will open ${FLOOR[invoice.floor as Floor]} the moment it lands.`}
      />
    );
  return (
    <section className="guild-body guild-center">
      <h1>Scan to pay</h1>
      <p className="voice">
        {tugrik(invoice.amount)} · {FLOOR[invoice.floor as Floor]} for{' '}
        {invoice.months === 1 ? 'one moon' : `${invoice.months} moons`}. Scan with any bank app. This code
        holds for fifteen minutes.
      </p>
      <div className="guild-qr" role="img" aria-label="QPay code">
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
  const floor = FLOOR[invoice.floor as Floor];
  if (invoice.state === 'paid')
    return (
      <Stone
        art={art.honourLocked}
        title={`Welcome to ${floor}`}
        body={`Open MingldIngl. ${floor[0].toUpperCase()}${floor.slice(1)} is already yours.`}
        line={
          invoice.paidUntil
            ? `Paid until ${onMoon(invoice.paidUntil)} · it will not renew on its own`
            : undefined
        }
      />
    );
  if (invoice.state === 'cold')
    return (
      <Stone
        art={art.guildSeal}
        title="The code went cold"
        body="Fifteen minutes passed and nothing was paid. Nothing was taken."
      >
        <Button kind="brass" className="guild-cta" onClick={onAgain}>
          New code
        </Button>
      </Stone>
    );
  return (
    <Stone
      art={art.guildSeal}
      title="Your payment is coming back"
      body={`We could not open the floor, so ${tugrik(invoice.amount)} is on its way back to your bank. It lands within three days.`}
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
