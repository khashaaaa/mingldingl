import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Button } from '../../design/Button';
import { errorText } from '../../lib/api/client';
import {
  adminCancelGathering,
  adminEditGathering,
  adminRingBell,
  getAdminListGatheringsQueryKey,
  useAdminListGatherings,
} from '../../lib/api/generated/engine';
import type { AdminGatheringRow, GatheringWriteRequest } from '../../lib/api/generated/model';
import { FestivalCalendar } from './Festivals';
import './square.css';

const FESTIVALS: [string, string][] = [
  ['', 'None'],
  ['tsagaanSar', 'Tsagaan Sar'],
  ['naadam', 'Naadam'],
  ['dayOfBond', 'Day of the Bond'],
  ['march8', 'March 8'],
  ['lastBell', 'The last bell of the year'],
];

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const status = (r: AdminGatheringRow) =>
  r.state === 'closed'
    ? `Closed · ${r.bonds} bond${r.bonds === 1 ? '' : 's'}`
    : r.state[0]?.toUpperCase() + r.state.slice(1);

/**
 * Town Square (Figma S8 39:831, edit 266:15296): every gathering, live; ring a new bell; edit or
 * cancel one not yet rung.
 */
export function GatheringsPage() {
  const client = useQueryClient();
  const list = useAdminListGatherings();
  const rows = list.data ?? [];
  const [ringing, setRinging] = useState(false);
  const [editing, setEditing] = useState<AdminGatheringRow | null>(null);
  const refresh = () => client.invalidateQueries({ queryKey: getAdminListGatheringsQueryKey() });
  return (
    <section>
      <div className="page-head">
        <h1 className="page-title">Gatherings</h1>
      </div>
      {ringing || editing ? (
        <RingForm
          edit={editing}
          onDone={() => {
            setRinging(false);
            setEditing(null);
            refresh();
          }}
        />
      ) : (
        <p className="square-ring">
          <Button kind="brass" onClick={() => setRinging(true)}>
            Ring a new bell
          </Button>
        </p>
      )}
      <table className="table">
        <thead>
          <tr>
            <th>Bell</th>
            <th>When</th>
            <th>Seats</th>
            <th>Rounds</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} data-gathering-id={r.id} className={r.state === 'cancelled' ? 'muted' : undefined}>
              <td>{r.name}</td>
              <td>{when(r.startsAt)}</td>
              <td>
                {r.taken} / {r.seats}
              </td>
              <td>
                {r.rounds} × {r.roundMinutes} min
              </td>
              <td>{status(r)}</td>
              <td>
                {r.state === 'open' && (
                  <>
                    <Button kind="quiet" onClick={() => setEditing(r)}>
                      Edit
                    </Button>
                    <Button kind="quiet" onClick={() => adminCancelGathering(r.id).then(refresh)}>
                      Cancel
                    </Button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.isPending && <p className="state">Reading the list…</p>}
      {list.isError && (
        <p role="alert" className="state danger">
          {errorText(list.error)}
        </p>
      )}
      {list.isSuccess && rows.length === 0 && <p className="state">No bell has been rung yet.</p>}
      <FestivalCalendar />
    </section>
  );
}

/** A datetime-local value (the keeper's own clock) for an ISO moment. */
const localInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

function RingForm({ onDone, edit }: { onDone: () => void; edit?: AdminGatheringRow | null }) {
  const [form, setForm] = useState(
    edit
      ? {
          name: edit.name,
          at: localInput(edit.startsAt),
          rounds: edit.rounds,
          minutes: edit.roundMinutes,
          seats: edit.seats,
          festival: edit.festival ?? '',
          masked: edit.masked,
        }
      : { name: '', at: '', rounds: 6, minutes: 5, seats: 16, festival: '', masked: false },
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const req: GatheringWriteRequest = {
      name: form.name,
      startsAt: new Date(form.at).toISOString(),
      rounds: form.rounds,
      roundMinutes: form.minutes,
      seats: form.seats,
      festival: form.festival || null,
      masked: form.masked,
    };
    try {
      if (edit) await adminEditGathering(edit.id, req);
      else await adminRingBell(req);
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="square-form" onSubmit={submit}>
      <Field label="Name of the bell">
        <input
          className="input"
          value={form.name}
          placeholder="The Fifth Bell"
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
      </Field>
      <Field label="When (your local time)">
        <input
          className="input"
          type="datetime-local"
          value={form.at}
          onChange={(e) => setForm({ ...form, at: e.target.value })}
          required
        />
      </Field>
      <div className="square-row">
        <Field label="Rounds">
          <input
            className="input"
            type="number"
            min={1}
            max={12}
            value={form.rounds}
            onChange={(e) => setForm({ ...form, rounds: Number(e.target.value) })}
          />
        </Field>
        <Field label="Minutes a round">
          <input
            className="input"
            type="number"
            min={1}
            max={30}
            value={form.minutes}
            onChange={(e) => setForm({ ...form, minutes: Number(e.target.value) })}
          />
        </Field>
        <Field label="Seats (half each side)">
          <input
            className="input"
            type="number"
            min={2}
            max={200}
            step={2}
            value={form.seats}
            onChange={(e) => setForm({ ...form, seats: Number(e.target.value) })}
          />
        </Field>
      </div>
      <Field label="Festival">
        <select
          className="input"
          value={form.festival}
          onChange={(e) => setForm({ ...form, festival: e.target.value })}
        >
          {FESTIVALS.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <label className="square-check label">
        <input
          type="checkbox"
          checked={form.masked}
          onChange={(e) => setForm({ ...form, masked: e.target.checked })}
        />
        The masked round — voices only until the bell
      </label>
      {error && (
        <p role="alert" className="state danger">
          {error}
        </p>
      )}
      <div className="square-actions">
        <Button kind="brass" type="submit" disabled={busy}>
          {edit ? 'Save' : 'Ring the bell'}
        </Button>
        <Button kind="quiet" onClick={onDone}>
          Not now
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is the child
    <label className="field">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
