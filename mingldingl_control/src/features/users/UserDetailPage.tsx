import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '../../design/Button';
import { Glyph } from '../../design/Glyph';
import { errorText } from '../../lib/api/client';
import {
  getAdminGetUserQueryKey,
  useAdminGetUser,
  useAdminUserPayments,
} from '../../lib/api/generated/engine';
import { formatDate, formatDateTime, tugrik } from '../../lib/format';
import { type HandAction, KeeperDialog } from './KeeperHand';
import './users.css';

export function UserDetailPage() {
  const { id = '' } = useParams();
  const user = useAdminGetUser(id);
  const client = useQueryClient();
  const [hand, setHand] = useState<HandAction | null>(null);

  // Portrait links are signed and expire: read the record again a minute before the first one does.
  const firstExpiry = user.data?.photos.reduce<number | null>((min, ph) => {
    const t = Date.parse(ph.expiresAt);
    return min === null || t < min ? t : min;
  }, null);
  useEffect(() => {
    if (firstExpiry == null) return;
    const t = setTimeout(
      () => client.invalidateQueries({ queryKey: getAdminGetUserQueryKey(id) }),
      Math.max(0, firstExpiry - Date.now() - 60_000),
    );
    return () => clearTimeout(t);
  }, [firstExpiry, id, client]);

  if (user.isPending) return <p className="state">Opening the record…</p>;
  if (user.isError)
    return (
      <p role="alert" className="state danger">
        {errorText(user.error)}
      </p>
    );

  const u = user.data;
  const p = u.profile;
  const activeDevices = u.devices.filter((d) => !d.revokedAt).length;
  const liveBonds = u.bonds.filter((b) => b.state === 'Live').length;
  const bondNames = new Map(u.bonds.map((b) => [b.id, b.otherName]));

  return (
    <section>
      <Link to="/users" className="back label">
        <Glyph name="back" /> Travellers
      </Link>
      <div className="page-head">
        <h1 className="page-title">{p?.name ?? u.phone}</h1>
        <p className="voice page-sub">
          {u.status === 'Suspended'
            ? `Suspended${u.suspendedAt ? ` on ${formatDate(u.suspendedAt)}` : ''} · ${u.suspendedWhy ?? 'by the keepers'}`
            : `${p ? `${p.tier} · ${p.points} · ` : ''}joined ${formatDate(u.createdAt)}`}
        </p>
      </div>

      {(u.flaggedAt || u.underReview) && (
        <div className="flags" role="status">
          {u.flaggedAt && (
            <p className="hand-line">
              <span className="danger">
                {u.flaggedWhy} · {formatDate(u.flaggedAt)}
              </span>
              <Button onClick={() => setHand({ kind: 'clearFlag' })}>Clear flag</Button>
            </p>
          )}
          {u.underReview && (
            <p className="danger">
              Hidden from Seek: open reports from several people wait for a keeper to decide.
            </p>
          )}
        </div>
      )}

      <div className="stats">
        <Stat label="Status" value={u.status} note={u.status === 'Active' ? '' : 'cannot sign in'} />
        <Stat
          label="Onboarding"
          value={String(u.onboardingStep)}
          note={u.onboardingStep >= 7 ? 'in the world' : 'in progress'}
        />
        <Stat label="Portraits" value={String(u.photos.length)} note="" />
        <Stat label="Devices" value={String(activeDevices)} note={`${u.devices.length} ever`} />
        <Stat label="Bonds" value={String(liveBonds)} note={`${u.bonds.length} ever`} />
        <Stat label="Reports against" value={String(u.reportsAgainst)} note="" />
        <Stat
          label="Reputation"
          value={u.reputation == null ? '—' : String(u.reputation)}
          note="never shown to them"
        />
        <Stat
          label="Meetings kept"
          value={String(u.encounters.kept)}
          note={u.encounters.disputed ? `${u.encounters.disputed} disputed` : ''}
        />
        <Stat
          label="No-shows"
          value={String(u.encounters.recentNoShows)}
          note={`recent · ${u.encounters.noShows} ever`}
        />
      </div>

      {/* Figma S8 266:2253: the name and tale a keeper may clear, and the hand */}
      {p && (
        <>
          <h2 className="section-title">Character</h2>
          <dl className="facts">
            <dt className="label">Name</dt>
            <dd className="hand-line">
              <span>{p.name}</span>
              <Button onClick={() => setHand({ kind: 'clear', field: 'name' })}>Clear name</Button>
            </dd>
            <dt className="label">Tale</dt>
            <dd className="hand-line">
              <span>{p.bio ?? <span className="muted">—</span>}</span>
              {p.bio && <Button onClick={() => setHand({ kind: 'clear', field: 'tale' })}>Clear tale</Button>}
            </dd>
          </dl>
        </>
      )}

      <h2 className="section-title">The keeper's hand</h2>
      <div className="hand-row">
        {u.status === 'Suspended' ? (
          <Button kind="brass" onClick={() => setHand({ kind: 'lift' })}>
            Lift suspension
          </Button>
        ) : (
          <>
            <Button onClick={() => setHand({ kind: 'floor' })}>Give a floor</Button>
            <Button onClick={() => setHand({ kind: 'adjust' })}>Adjust score</Button>
            <Button onClick={() => setHand({ kind: 'signOut' })}>
              <Glyph name="door" /> Sign out everywhere
            </Button>
            <Button kind="danger" onClick={() => setHand({ kind: 'suspend' })}>
              Suspend
            </Button>
          </>
        )}
        <Button kind="danger" onClick={() => setHand({ kind: 'delete' })}>
          Delete now
        </Button>
      </div>
      <p className="voice muted">Every action asks for a reason and is written in the audit log.</p>
      {hand && <KeeperDialog user={u} action={hand} onClose={() => setHand(null)} />}

      <h2 className="section-title">Score history</h2>
      {u.deeds.length === 0 ? (
        <p className="state">No deeds yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Event</th>
              <th>Points</th>
              <th>Bond</th>
            </tr>
          </thead>
          <tbody>
            {u.deeds.map((d) => (
              <tr key={d.id}>
                <td>{formatDateTime(d.createdAt)}</td>
                <td>{DEED[d.kind] ?? d.kind}</td>
                <td>{d.amount > 0 ? `+${d.amount}` : `−${-d.amount}`}</td>
                <td>{(d.bondId && bondNames.get(d.bondId)) ?? <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="section-title">Bonds</h2>
      {u.bonds.length === 0 ? (
        <p className="state">No bonds yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>With</th>
              <th>State</th>
              <th>Seals</th>
              <th>Letters</th>
              <th>Last letter</th>
            </tr>
          </thead>
          <tbody>
            {u.bonds.map((b) => (
              <tr key={b.id}>
                <td>
                  <Link to={`/users/${b.otherId}`}>{b.otherName}</Link>
                </td>
                <td className={b.state === 'Live' ? undefined : 'muted'}>{b.state}</td>
                <td>{b.seals} / 4</td>
                <td>
                  {b.letters} · {b.theirLetters}
                </td>
                <td>{b.lastLetterAt ? formatDateTime(b.lastLetterAt) : <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <UserPayments id={u.accountId} />

      <h2 className="section-title">Account</h2>
      <dl className="facts">
        <Fact term="Number" value={u.phone} />
        <Fact term="Account id" value={u.accountId} />
        {p && (
          <>
            <Fact term="Born" value={`${formatDate(p.birthDate)} (${p.age})`} />
            <Fact term="Gender" value={p.gender} />
            <Fact term="City" value={p.city} />
            <Fact term="Oath" value={p.oath ? `${p.oath} — ${p.oathProvenAt ? 'proven' : 'sworn'}` : null} />
            <Fact
              term="Face"
              value={p.faceProvenAt ? `proven ${formatDate(p.faceProvenAt)}` : 'not proven'}
            />
            <Fact term="Language" value={p.locale} />
            <Fact term="Tale" value={p.bio} />
          </>
        )}
      </dl>

      <h2 className="section-title">Portraits</h2>
      {u.photos.length === 0 ? (
        <p className="state">No portraits yet.</p>
      ) : (
        <div className="portraits">
          {u.photos.map((ph) => (
            <figure key={ph.id} className="portrait">
              <img
                src={ph.url}
                alt={`Portrait ${ph.position + 1}`}
                width={ph.width}
                height={ph.height}
                loading="lazy"
              />
              <Button onClick={() => setHand({ kind: 'photo', photoId: ph.id })}>Remove</Button>
            </figure>
          ))}
        </div>
      )}

      <h2 className="section-title">Devices</h2>
      {u.devices.length === 0 ? (
        <p className="state">No devices on record.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Device</th>
              <th>Signed in</th>
              <th>Last seen</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {u.devices.map((d) => (
              <tr key={d.id}>
                <td>{d.deviceName}</td>
                <td>{formatDateTime(d.createdAt)}</td>
                <td>{formatDateTime(d.lastSeenAt)}</td>
                <td className={d.revokedAt ? 'muted' : undefined}>
                  {d.revokedAt ? `revoked ${formatDateTime(d.revokedAt)}` : 'signed in'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

const DEED: Record<string, string> = {
  finished: 'Character finished',
  firstLetter: 'First letter',
  reply: 'Reply',
  dawn: 'Returned at dawn',
  seventhDawn: 'Seventh dawn',
  goneCold: 'Let a bond go cold',
  penalised: 'Penalised by a keeper',
  keeperAdjusted: 'Set right by a keeper',
};

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="muted stat-note">{note || '—'}</div>
    </div>
  );
}

function Fact({ term, value }: { term: string; value: string | null }) {
  return (
    <>
      <dt className="label">{term}</dt>
      <dd>{value ?? <span className="muted">—</span>}</dd>
    </>
  );
}

const FLOOR: Record<string, string> = { yard: 'The Yard', hall: 'The Hall', highTable: 'The High Table' };

/** Their floor and every payment (Figma S8 218:1271); a payment row opens its invoice. */
function UserPayments({ id }: { id: string }) {
  const data = useAdminUserPayments(id).data;
  if (!data) return null;
  const m = data.membership;
  return (
    <>
      <h2 className="section-title">Floor &amp; payments</h2>
      <p className="voice">
        {FLOOR[m.floor] ?? m.floor}
        {m.until
          ? ` until ${formatDate(m.until)} · ${m.source === 'store' ? 'Google Play' : m.source === 'keeper' ? 'a gift from the keepers' : 'QPay'}${m.renews ? ', renews' : ''}`
          : ' · free'}
      </p>
      {data.payments.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Floor</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.payments.map((r) => (
              <tr key={r.id}>
                <td>{formatDate(r.at)}</td>
                <td>
                  {FLOOR[r.floor] ?? r.floor} · {r.months} moon{r.months === 1 ? '' : 's'}
                </td>
                <td>{tugrik(r.amount)}</td>
                <td>
                  <Link to={`/payments/${r.invoiceId}`}>{r.state}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
