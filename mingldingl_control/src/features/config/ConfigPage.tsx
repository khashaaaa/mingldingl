import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Button } from '../../design/Button';
import { SearchField } from '../../design/SearchField';
import { errorText } from '../../lib/api/client';
import {
  getAdminGetConfigQueryKey,
  useAdminGetConfig,
  useAdminSetConfig,
} from '../../lib/api/generated/engine';
import type { ConfigView } from '../../lib/api/generated/model';
import './config.css';

const bounds = (c: ConfigView) =>
  c.type === 'Bool' ? 'true / false' : c.min != null && c.max != null ? `${c.min} – ${c.max}` : '—';

export function ConfigPage() {
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const config = useAdminGetConfig();
  const f = filter.trim().toLowerCase();
  const rows = (config.data ?? []).filter(
    (c) => !f || c.key.toLowerCase().includes(f) || c.category.toLowerCase().includes(f),
  );

  return (
    <section>
      <div className="page-head">
        <h1 className="page-title">The rules of the house</h1>
        <p className="voice page-sub">Every number the game uses. Bounds are enforced on save.</p>
      </div>
      <SearchField value={filter} onChange={setFilter} placeholder="Filter keys" />
      <table className="table config">
        <thead>
          <tr>
            <th>Key</th>
            <th>Value</th>
            <th>Default</th>
            <th>Bounds</th>
            <th>Category</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.key}>
              <td>
                <div>{c.key}</div>
                <div className="muted config-desc">{c.description}</div>
              </td>
              <td>
                {editing === c.key ? (
                  <ValueEditor row={c} onDone={() => setEditing(null)} />
                ) : (
                  <button
                    type="button"
                    className="config-value"
                    aria-label={`Edit ${c.key}`}
                    onClick={() => setEditing(c.key)}
                  >
                    <span data-testid="config-value">{c.value}</span>
                  </button>
                )}
              </td>
              <td className={c.value === c.default ? 'muted' : undefined}>{c.default}</td>
              <td>{bounds(c)}</td>
              <td>{c.category}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {config.isPending && <p className="state">Reading the rules…</p>}
      {config.isError && (
        <p role="alert" className="state danger">
          {errorText(config.error)}
        </p>
      )}
    </section>
  );
}

function ValueEditor({ row, onDone }: { row: ConfigView; onDone: () => void }) {
  const [value, setValue] = useState(row.value);
  const client = useQueryClient();
  const save = useAdminSetConfig({
    mutation: {
      onSuccess: (saved) => {
        client.setQueryData<ConfigView[]>(getAdminGetConfigQueryKey(), (all) =>
          all?.map((c) => (c.key === saved.key ? saved : c)),
        );
        onDone();
      },
    },
  });
  const error = save.error ? errorText(save.error) : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({ key: row.key, data: { value } });
  };

  return (
    <form className="config-edit" onSubmit={submit}>
      {row.type === 'Bool' ? (
        <select
          className="input"
          aria-label={row.key}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : (
        <input
          className="input"
          aria-label={row.key}
          inputMode={row.type === 'Int' ? 'numeric' : undefined}
          value={value}
          // biome-ignore lint/a11y/noAutofocus: the keeper just asked to edit this cell
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onDone()}
        />
      )}
      <div className="config-actions">
        <Button kind="quiet" type="submit" disabled={save.isPending}>
          Save
        </Button>
        <Button kind="quiet" onClick={onDone}>
          Cancel
        </Button>
      </div>
      {error && (
        <p role="alert" className="danger config-error">
          {error}
        </p>
      )}
    </form>
  );
}
