import { errorText } from '../../lib/api/client';
import { useAdminAudit } from '../../lib/api/generated/engine';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** What the keepers did (Figma S8 39:1163): every write, newest first, live. */
export function AuditPage() {
  const log = useAdminAudit();
  const rows = log.data ?? [];
  return (
    <section>
      <div className="page-head">
        <h1 className="page-title">What the keepers did</h1>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>When</th>
            <th>Keeper</th>
            <th>Action</th>
            <th>Target</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{when(r.at)}</td>
              <td>{r.keeper}</td>
              <td>{r.action}</td>
              <td>{r.target ?? '—'}</td>
              <td className="muted">{r.note ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {log.isPending && <p className="state">Reading the log…</p>}
      {log.isError && (
        <p role="alert" className="state danger">
          {errorText(log.error)}
        </p>
      )}
      {log.isSuccess && rows.length === 0 && <p className="state">Nothing has been done yet.</p>}
    </section>
  );
}
