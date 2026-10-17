import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '../../design/Button';
import { errorText } from '../../lib/api/client';
import {
  adminSaveCodex,
  getAdminGetCodexQueryKey,
  getAdminListCodexQueryKey,
  useAdminGetCodex,
  useAdminListCodex,
} from '../../lib/api/generated/engine';
import type { AdminCodexPage } from '../../lib/api/generated/model';
import './codex.css';

const BODY_MAX = 8000;
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });

/** The Codex (Figma S8 39:1015): every page, its languages, and whether Mongolian is still owed. */
export function CodexPagesPage() {
  const navigate = useNavigate();
  const list = useAdminListCodex();
  const rows = list.data ?? [];
  return (
    <section>
      <div className="page-head">
        <h1 className="page-title">The Codex</h1>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Page</th>
            <th>Language</th>
            <th>Updated</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.slug}
              className="clickable"
              data-codex={r.slug}
              onClick={() => navigate(`/codex/${r.slug}`)}
            >
              <td>
                <Link to={`/codex/${r.slug}`}>{r.title}</Link>
              </td>
              <td>{r.locales.map((l) => l.toUpperCase()).join(' · ')}</td>
              <td>{day(r.updatedAt)}</td>
              <td>{r.status === 'published' ? 'Published' : 'Needs MN'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.isPending && <p className="state">Reading the Codex…</p>}
      {list.isError && (
        <p role="alert" className="state danger">
          {errorText(list.error)}
        </p>
      )}
    </section>
  );
}

/** Edit a Codex page (Figma S8 39:1095), English or Mongolian; publishing reaches every reader live. */
export function CodexEditPage() {
  const { slug = '' } = useParams();
  const page = useAdminGetCodex(slug);
  return page.data ? <CodexForm page={page.data} /> : <p className="state">Reading the page…</p>;
}

function CodexForm({ page }: { page: AdminCodexPage }) {
  const client = useQueryClient();
  const [locale, setLocale] = useState<'en' | 'mn'>('en');
  const source = locale === 'en' ? page.en : page.mn;
  const [form, setForm] = useState({ title: '', summary: '', body: '' });
  const [state, setState] = useState<string | null>(null);
  useEffect(() => {
    setForm({ title: source?.title ?? '', summary: source?.summary ?? '', body: source?.body ?? '' });
  }, [source]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState(null);
    try {
      await adminSaveCodex(page.slug, {
        locale,
        title: form.title,
        summary: form.summary || null,
        body: form.body,
      });
      await Promise.all([
        client.invalidateQueries({ queryKey: getAdminGetCodexQueryKey(page.slug) }),
        client.invalidateQueries({ queryKey: getAdminListCodexQueryKey() }),
      ]);
      setState('Published.');
    } catch (err) {
      setState(errorText(err));
    }
  };
  return (
    <section>
      <div className="page-head">
        <h1 className="page-title">{page.en.title}</h1>
        <p className="voice page-sub">Edit a Codex page</p>
      </div>
      <form className="codex-form" onSubmit={submit}>
        <div className="codex-tabs" role="tablist">
          {(['en', 'mn'] as const).map((l) => (
            <Button
              key={l}
              kind={l === locale ? 'brass' : 'quiet'}
              role="tab"
              aria-selected={l === locale}
              onClick={() => setLocale(l)}
            >
              {l === 'en' ? 'English' : 'Mongolian'}
            </Button>
          ))}
        </div>
        <Field label={`Title (${locale === 'en' ? 'English' : 'Mongolian'})`}>
          <input
            className="input"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </Field>
        <Field label="Summary">
          <input
            className="input"
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
          />
        </Field>
        <Field label={`Body (${locale === 'en' ? 'English' : 'Mongolian'})`}>
          <textarea
            className="input codex-body"
            value={form.body}
            maxLength={BODY_MAX}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            required
          />
        </Field>
        <p className="label codex-count">
          {form.body.length} / {BODY_MAX}
        </p>
        <div>
          <Button kind="brass" type="submit">
            Publish
          </Button>
        </div>
        {state && (
          <p role="status" className="state">
            {state}
          </p>
        )}
      </form>
    </section>
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
