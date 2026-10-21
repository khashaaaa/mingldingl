import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Button } from '../../design/Button';
import { errorText } from '../../lib/api/client';
import {
  getAdminHealthQueryKey,
  useAdminDashboard,
  useAdminDeletions,
  useAdminHealth,
  useAdminRunSweep,
} from '../../lib/api/generated/engine';
import { formatAge, formatDate, formatDateTime, tugrik } from '../../lib/format';
import '../users/users.css';
import { Glyph } from '../../design/Glyph';

const KIND: Record<string, string> = { report: 'Report', payment: 'Payment', deletion: 'Deletion' };

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="muted stat-note">{note || '—'}</div>
    </div>
  );
}

/** The hold tonight (Figma S8 226:13358): today, live, and everything that waits on a keeper. */
export function DashboardPage() {
  const dash = useAdminDashboard();
  const d = dash.data;
  return (
    <section>
      <div className="page-head">
        <h1 className="page-title">The hold tonight</h1>
        <p className="voice page-sub">Everything the keepers watch, at a glance.</p>
      </div>
      {dash.isError && (
        <p role="alert" className="state danger">
          {errorText(dash.error)}
        </p>
      )}
      {d && (
        <>
          <div className="stats">
            <Stat
              label="Active today"
              value={d.activeToday.toLocaleString('en-US')}
              note={`${d.activeDelta >= 0 ? '+' : ''}${d.activeDelta} on this day last week`}
            />
            <Stat label="New bonds" value={String(d.bondsToday)} note="today" />
            <Stat
              label="Money in today"
              value={tugrik(d.moneyToday)}
              note={`store ${d.storePurchasesToday} · web ${d.webPaymentsToday}`}
            />
            <Stat
              label="Needs attention"
              value={String(d.openReports + d.stuckPayments)}
              note={`${d.openReports} reports · ${d.stuckPayments} payments`}
            />
          </div>
          <h2 className="section-title">Waiting on the keepers</h2>
          {d.waiting.length === 0 ? (
            <p className="state">Nothing waits on the keepers.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Kind</th>
                  <th>About</th>
                  <th>Waiting</th>
                  <th>Who</th>
                </tr>
              </thead>
              <tbody>
                {d.waiting.map((w) => (
                  <tr key={`${w.kind}${w.link}`}>
                    <td>{KIND[w.kind] ?? w.kind}</td>
                    <td>
                      <Link to={w.link}>{w.about}</Link>
                    </td>
                    <td>{formatAge(w.since)}</td>
                    <td>{w.who}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}

/** Characters fading (Figma S8 39:502): every abandoned character and the day it burns. */
export function DeletionsPage() {
  const rows = useAdminDeletions();
  return (
    <section>
      <div className="page-head">
        <h1 className="page-title">Characters fading</h1>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Asked</th>
            <th>Burns on</th>
            <th>Files</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {(rows.data ?? []).map((r) => (
            <tr key={r.accountId}>
              <td>
                <Link to={`/users/${r.accountId}`}>{r.name}</Link>
              </td>
              <td>{formatDate(r.askedAt)}</td>
              <td>{formatDate(r.burnsAt)}</td>
              <td>
                {r.portraits} portrait{r.portraits === 1 ? '' : 's'}
              </td>
              <td>Pending</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.isSuccess && rows.data.length === 0 && <p className="state">No character is fading.</p>}
      {rows.isError && (
        <p role="alert" className="state danger">
          {errorText(rows.error)}
        </p>
      )}
    </section>
  );
}

const STATE: Record<string, string> = { ok: 'Reachable', down: 'Down', unknown: 'Unknown' };

/** The engine room (Figma S8 226:13443): what the engine is, what it holds, and who it can reach. */
/** "1.0.0+817ef910d2…" → "1.0.0 · 817ef91": the build's commit, short enough for its tile. */
const shortVersion = (v: string) => {
  const [base, commit] = v.split('+');
  return commit ? `${base} · ${commit.slice(0, 7)}` : v;
};

export function OpsPage() {
  const health = useAdminHealth();
  const client = useQueryClient();
  const sweep = useAdminRunSweep({
    mutation: { onSuccess: () => client.invalidateQueries({ queryKey: getAdminHealthQueryKey() }) },
  });
  const h = health.data;
  return (
    <section>
      <div className="page-head">
        <h1 className="page-title">The engine room</h1>
      </div>
      {health.isError && (
        <p role="alert" className="state danger">
          {errorText(health.error)}
        </p>
      )}
      {h && (
        <>
          <div className="stats">
            <Stat
              label="Engine"
              value="Healthy"
              note={`${shortVersion(h.version)} · up ${formatAge(h.startedAt)}`}
            />
            <Stat label="Database" value={`${(h.databaseBytes / 1024 / 1024).toFixed(1)} MB`} note="" />
            <Stat
              label="Last backup"
              value={h.lastBackupAt ? formatDateTime(h.lastBackupAt) : '—'}
              note={h.lastBackupAt ? '' : 'none seen'}
            />
            <Stat label="Push queue" value={String(h.pushQueue)} note="waiting to send" />
          </div>
          <div className="stats">
            {h.checks.map((c) => (
              <Stat key={c.name} label={c.name} value={STATE[c.state] ?? c.state} note={c.note} />
            ))}
          </div>
          <div className="stats">
            <Stat
              label="Daily sweep"
              value={h.dailySweepAt ? formatDateTime(h.dailySweepAt) : '—'}
              note="hourly"
            />
            <Stat
              label="Payment sweep"
              value={h.paymentSweepAt ? formatDateTime(h.paymentSweepAt) : '—'}
              note={`${h.invoicesWatched} invoices watched`}
            />
            <Stat
              label="Statistics"
              value={h.statsRolledAt ? formatDateTime(h.statsRolledAt) : '—'}
              note="rolled up"
            />
          </div>
          <Button onClick={() => sweep.mutate()} disabled={sweep.isPending}>
            <Glyph name="turn" /> Run maintenance sweep
          </Button>
        </>
      )}
    </section>
  );
}
