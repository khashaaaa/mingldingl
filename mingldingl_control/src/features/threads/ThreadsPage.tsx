import { errorText } from '../../lib/api/client';
import { useAdminListThreads } from '../../lib/api/generated/engine';

const STATE: Record<string, string> = {
  waiting: 'Waiting',
  oneSaidYes: 'Waiting',
  sparked: 'Sparked',
  cut: 'Cut',
};
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });

/** Fated Threads (Figma S8 39:751): every thread woven, numbers masked, and how it stands. Live. */
export function ThreadsPage() {
  const threads = useAdminListThreads();
  const rows = threads.data ?? [];
  return (
    <section>
      <div className="page-head">
        <h1 className="page-title">Threads woven</h1>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Weaver</th>
            <th>First</th>
            <th>Second</th>
            <th>Woven</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} data-thread-id={r.id}>
              <td>{r.weaver}</td>
              <td>{r.first}</td>
              <td>{r.second}</td>
              <td>{day(r.wovenAt)}</td>
              <td>{STATE[r.state] ?? r.state}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {threads.isPending && <p className="state">Reading the list…</p>}
      {threads.isError && (
        <p role="alert" className="state danger">
          {errorText(threads.error)}
        </p>
      )}
      {threads.isSuccess && rows.length === 0 && <p className="state">No thread has been woven yet.</p>}
    </section>
  );
}
