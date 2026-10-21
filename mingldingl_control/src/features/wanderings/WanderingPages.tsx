import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '../../design/Button';
import { errorText } from '../../lib/api/client';
import {
  adminSaveWandering,
  getAdminGetWanderingQueryKey,
  getAdminListWanderingsQueryKey,
  useAdminGetWandering,
  useAdminListWanderings,
} from '../../lib/api/generated/engine';
import type { AdminWandering } from '../../lib/api/generated/model';
import '../codex/codex.css';
import { Glyph } from '../../design/Glyph';

const TEXT_MAX = 1000;
const KINDS = ['Cafe', 'Restaurant', 'Bar', 'Entertainment', 'Outdoor', 'Culture'];
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });

/** The Wanderings: the thirteen side roads for two, their road, the places that suit them, how often kept. */
export function WanderingsPage() {
  const navigate = useNavigate();
  const list = useAdminListWanderings();
  return (
    <section>
      <div className="page-head">
        <h1 className="page-title">The Wanderings</h1>
        <p className="voice page-sub">
          Side roads for two, opened by kept meetings. Edit their words and places.
        </p>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Wandering</th>
            <th>Road</th>
            <th>Places</th>
            <th>Kept</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {(list.data ?? []).map((r) => (
            <tr
              key={r.key}
              className="clickable"
              data-wandering={r.key}
              onClick={() => navigate(`/wanderings/${r.key}`)}
            >
              <td>
                <Link to={`/wanderings/${r.key}`}>{r.titleEn}</Link>
                <div className="muted">{r.titleMn}</div>
              </td>
              <td>{r.road === 'first' ? 'First' : 'Trusted'}</td>
              <td>{r.venueKinds.join(' · ') || '—'}</td>
              <td>{r.kept}</td>
              <td>{day(r.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.isPending && <p className="state">Reading the Wanderings…</p>}
      {list.isError && (
        <p role="alert" className="state danger">
          {errorText(list.error)}
        </p>
      )}
    </section>
  );
}

/** Edit one Wandering: its words in both languages and the kinds of verified place it suggests. */
export function WanderingEditPage() {
  const { key = '' } = useParams();
  const w = useAdminGetWandering(key);
  return w.data ? <WanderingForm w={w.data} /> : <p className="state">Reading the Wandering…</p>;
}

type Words = { title: string; line: string; body: string; where: string };

function WanderingForm({ w }: { w: AdminWandering }) {
  const client = useQueryClient();
  const [locale, setLocale] = useState<'en' | 'mn'>('en');
  const [en, setEn] = useState<Words>({ title: '', line: '', body: '', where: '' });
  const [mn, setMn] = useState<Words>({ title: '', line: '', body: '', where: '' });
  const [kinds, setKinds] = useState<string[]>([]);
  const [state, setState] = useState<string | null>(null);
  useEffect(() => {
    setEn({ title: w.titleEn, line: w.lineEn, body: w.bodyEn, where: w.whereEn });
    setMn({ title: w.titleMn, line: w.lineMn, body: w.bodyMn, where: w.whereMn });
    setKinds([...w.venueKinds]);
  }, [w]);
  const form = locale === 'en' ? en : mn;
  const set = (patch: Partial<Words>) =>
    locale === 'en' ? setEn({ ...en, ...patch }) : setMn({ ...mn, ...patch });
  const lang = locale === 'en' ? 'English' : 'Mongolian';
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState(null);
    try {
      await adminSaveWandering(w.key, {
        titleEn: en.title,
        lineEn: en.line,
        bodyEn: en.body,
        whereEn: en.where,
        titleMn: mn.title,
        lineMn: mn.line,
        bodyMn: mn.body,
        whereMn: mn.where,
        venueKinds: kinds,
      });
      await Promise.all([
        client.invalidateQueries({ queryKey: getAdminGetWanderingQueryKey(w.key) }),
        client.invalidateQueries({ queryKey: getAdminListWanderingsQueryKey() }),
      ]);
      setState('Published.');
    } catch (err) {
      setState(errorText(err));
    }
  };
  return (
    <section>
      <Link to="/wanderings" className="back label">
        <Glyph name="back" /> Wanderings
      </Link>
      <div className="page-head">
        <h1 className="page-title">{w.titleEn}</h1>
        <p className="voice page-sub">
          {w.road === 'first' ? 'A first road' : 'A trusted road'} · season {w.season}
        </p>
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
        <Field label={`Title (${lang})`}>
          <input
            className="input"
            value={form.title}
            onChange={(e) => set({ title: e.target.value })}
            required
          />
        </Field>
        <Field label={`Line (${lang})`}>
          <input
            className="input"
            value={form.line}
            onChange={(e) => set({ line: e.target.value })}
            required
          />
        </Field>
        <Field label={`What you do (${lang})`}>
          <textarea
            className="input codex-body"
            value={form.body}
            maxLength={TEXT_MAX}
            onChange={(e) => set({ body: e.target.value })}
            required
          />
        </Field>
        <Field label={`Where (${lang})`}>
          <textarea
            className="input"
            value={form.where}
            maxLength={TEXT_MAX}
            onChange={(e) => set({ where: e.target.value })}
            required
          />
        </Field>
        <fieldset className="field">
          <legend className="label">Verified places it suggests</legend>
          {KINDS.map((k) => (
            <label key={k} className="check">
              <input
                type="checkbox"
                checked={kinds.includes(k)}
                onChange={(e) => setKinds(e.target.checked ? [...kinds, k] : kinds.filter((x) => x !== k))}
              />{' '}
              {k}
            </label>
          ))}
        </fieldset>
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
