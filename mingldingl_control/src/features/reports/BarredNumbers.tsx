import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Button } from '../../design/Button';
import { errorText } from '../../lib/api/client';
import {
  adminUnbarNumber,
  getAdminListBarredQueryKey,
  useAdminListBarred,
} from '../../lib/api/generated/engine';
import { formatDate } from '../../lib/format';
import '../users/users.css';

/**
 * The numbers of characters the keepers removed (or that left with reports still open): they get no
 * code, so they cannot make a new character. Lifting one is for an appeal; its devices stay marked.
 */
export function BarredNumbers() {
  const list = useAdminListBarred();
  const [lifting, setLifting] = useState<string | null>(null);

  if (list.isPending) return <p className="state">Reading the barred numbers…</p>;
  if (list.isError)
    return (
      <p role="alert" className="state danger">
        {errorText(list.error)}
      </p>
    );
  return (
    <>
      <p className="voice muted">
        A removed character's number gets no code, so it cannot make another. A phone it used is not refused —
        a new character on it is flagged on their record.
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>Number</th>
            <th>Why</th>
            <th>Since</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.data.map((b) => (
            <tr key={b.phone} data-barred={b.phone}>
              <td>{b.phone}</td>
              <td>{b.why}</td>
              <td>{formatDate(b.createdAt)}</td>
              <td>
                <Button onClick={() => setLifting(b.phone)}>Lift</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.data.length === 0 && <p className="state">No number is barred.</p>}
      {lifting && <LiftDialog phone={lifting} onClose={() => setLifting(null)} />}
    </>
  );
}

function LiftDialog({ phone, onClose }: { phone: string; onClose: () => void }) {
  const client = useQueryClient();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminUnbarNumber(phone, { reason: reason.trim() });
      client.invalidateQueries({ queryKey: getAdminListBarredQueryKey() });
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="scrim">
      <form className="dialog" role="dialog" aria-modal="true" aria-label="Lift the bar" onSubmit={submit}>
        <h2 className="section-title">Lift the bar on {phone}?</h2>
        <p className="voice">The number may make a new character. The devices it used stay marked.</p>
        <label className="field">
          <span className="label">Reason (written in the audit log)</span>
          <input
            className="input"
            value={reason}
            maxLength={300}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </label>
        {error && (
          <p role="alert" className="state danger">
            {error}
          </p>
        )}
        <div className="hand-row">
          <Button onClick={onClose}>Cancel</Button>
          <Button kind="brass" type="submit" disabled={busy || reason.trim().length === 0}>
            Lift
          </Button>
        </div>
      </form>
    </div>
  );
}
