import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '../../design/Button';
import { Glyph } from '../../design/Glyph';
import { errorText } from '../../lib/api/client';
import {
  getAdminGetReportQueryKey,
  useAdminGetReport,
  useAdminResolveReport,
} from '../../lib/api/generated/engine';
import { formatDateTime } from '../../lib/format';
import { REASON, STATUS } from './labels';
import '../users/users.css';
import './reports.css';

const ACTIONS = [
  { action: 'dismiss', label: 'Dismiss', kind: 'outline' },
  { action: 'penalise', label: 'Penalise', kind: 'outline' },
  { action: 'castOut', label: 'Cast out the account', kind: 'brass' },
] as const;

export function ReportDetailPage() {
  const { id = '' } = useParams();
  const report = useAdminGetReport(id);
  const client = useQueryClient();
  const [note, setNote] = useState('');
  const resolve = useAdminResolveReport({
    mutation: {
      onSuccess: (data) => {
        client.setQueryData(getAdminGetReportQueryKey(id), data);
        client.invalidateQueries({ queryKey: ['/admin/reports', 'pages'] });
      },
    },
  });

  if (report.isPending) return <p className="state">Opening the report…</p>;
  if (report.isError)
    return (
      <p role="alert" className="state danger">
        {errorText(report.error)}
      </p>
    );

  const r = report.data;
  const open = r.status === 'Open';

  return (
    <section>
      <Link to="/reports" className="back label">
        <Glyph name="back" /> Reports
      </Link>
      <div className="page-head">
        <h1 className="page-title">{REASON[r.reason] ?? r.reason}</h1>
        <p className="voice page-sub">
          {r.reporterName} against {r.targetName} · {formatDateTime(r.createdAt)}
        </p>
      </div>

      <dl className="facts">
        <dt className="label">From</dt>
        <dd>
          <Link to={`/users/${r.reporterId}`}>{r.reporterName}</Link>
        </dd>
        <dt className="label">Against</dt>
        <dd>
          <Link to={`/users/${r.targetId}`}>{r.targetName}</Link>
          <span className="muted">
            {' '}
            · {r.targetStatus} · {r.targetReports} {r.targetReports === 1 ? 'report' : 'reports'} in all
          </span>
          {r.targetUnderReview && <span className="danger"> · hidden from Seek until decided</span>}
        </dd>
        <dt className="label">Note</dt>
        <dd>{r.note ?? <span className="muted">—</span>}</dd>
        <dt className="label">Status</dt>
        <dd data-testid="report-status">
          {STATUS[r.status] ?? r.status}
          {r.resolvedAt && <span className="muted"> · {formatDateTime(r.resolvedAt)}</span>}
          {r.resolution && <span className="muted"> · “{r.resolution}”</span>}
        </dd>
      </dl>

      <h2 className="section-title">Their last letters</h2>
      {r.lastLetters.length === 0 ? (
        <p className="state">{r.bondId ? 'No letters were written.' : 'Not reported from a bond.'}</p>
      ) : (
        <ol className="letters">
          {[...r.lastLetters].reverse().map((l) => (
            <li key={`${l.createdAt}-${l.byTarget}`} className={l.byTarget ? 'letter target' : 'letter'}>
              <div className="label">
                {l.byTarget ? r.targetName : r.reporterName} · {formatDateTime(l.createdAt)}
              </div>
              <p>{l.text}</p>
            </li>
          ))}
        </ol>
      )}

      {open && (
        <>
          <h2 className="section-title">Decide</h2>
          <p className="muted resolve-hint">
            Nothing has happened to anyone yet. Penalising takes points and reputation; casting out suspends
            the account and severs its bonds.
          </p>
          <textarea
            className="input resolve-note"
            aria-label="Keeper's note"
            placeholder="A note for the record (optional)"
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="resolve-actions">
            {ACTIONS.map((a) => (
              <Button
                key={a.action}
                kind={a.kind}
                disabled={resolve.isPending}
                onClick={() => resolve.mutate({ id, data: { action: a.action, note: note.trim() || null } })}
              >
                {a.label}
              </Button>
            ))}
          </div>
          {resolve.isError && (
            <p role="alert" className="danger">
              {errorText(resolve.error)}
            </p>
          )}
        </>
      )}
    </section>
  );
}
