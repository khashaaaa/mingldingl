import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../design/Button';
import { errorText } from '../../lib/api/client';
import { adminListReports } from '../../lib/api/generated/engine';
import { formatAge } from '../../lib/format';
import { BarredNumbers } from './BarredNumbers';
import { REASON, STATUS } from './labels';
import './reports.css';

const FILTERS = [
  { status: 'Open', label: 'Awaiting a keeper' },
  { status: '', label: 'All' },
  { status: 'barred', label: 'Barred numbers' },
] as const;

export function ReportsPage() {
  const [status, setStatus] = useState<string>('Open');
  const navigate = useNavigate();
  const barred = status === 'barred';
  const list = useInfiniteQuery({
    enabled: !barred,
    queryKey: ['/admin/reports', 'pages', { status }],
    queryFn: ({ pageParam, signal }) =>
      adminListReports({ status: status || undefined, before: pageParam ?? undefined }, { signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextBefore ?? null,
  });
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <section>
      <div className="page-head">
        <h1 className="page-title">Reports</h1>
      </div>
      <div className="filters" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.status}
            type="button"
            role="tab"
            aria-selected={status === f.status}
            className="filter label"
            onClick={() => setStatus(f.status)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {barred ? (
        <BarredNumbers />
      ) : (
        <>
          <table className="table">
            <thead>
              <tr>
                <th>From</th>
                <th>Against</th>
                <th>Reason</th>
                <th>Note</th>
                <th>Age</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  data-report-id={r.id}
                  className="clickable"
                  onClick={() => navigate(`/reports/${r.id}`)}
                >
                  <td>
                    <Link to={`/users/${r.reporterId}`} onClick={(e) => e.stopPropagation()}>
                      {r.reporterName}
                    </Link>
                  </td>
                  <td>
                    <Link to={`/reports/${r.id}`}>{r.targetName}</Link>
                    {r.targetReports > 1 && <span className="muted"> · {r.targetReports} reports</span>}
                  </td>
                  <td>{REASON[r.reason] ?? r.reason}</td>
                  <td className="report-note">{r.note ? `“${r.note}”` : '—'}</td>
                  <td>{formatAge(r.createdAt)}</td>
                  <td className={r.status === 'Open' ? undefined : 'muted'}>
                    {STATUS[r.status] ?? r.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.isPending && <p className="state">Gathering the reports…</p>}
          {list.isError && (
            <p role="alert" className="state danger">
              {errorText(list.error)}
            </p>
          )}
          {list.isSuccess && rows.length === 0 && (
            <p className="state">{status ? 'Nothing awaits a keeper.' : 'No one has been reported.'}</p>
          )}
          {list.hasNextPage && (
            <p className="state">
              <Button onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>
                Older reports
              </Button>
            </p>
          )}
        </>
      )}
    </section>
  );
}
