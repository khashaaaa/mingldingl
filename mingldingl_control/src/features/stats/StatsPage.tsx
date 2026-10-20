import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '../../design/Button';
import { LineChart } from '../../design/LineChart';
import { errorText } from '../../lib/api/client';
import { API_URL } from '../../lib/api/config';
import { useAdminStats, useAdminStatsTable } from '../../lib/api/generated/engine';
import type { StatSeries, StatTable } from '../../lib/api/generated/model';
import { tugrik } from '../../lib/format';
import '../users/users.css';
import './stats.css';

type Totals = Record<string, StatSeries | undefined>;
type Chart = { metric: string; label: string; money?: true };
type Tile = { label: string; value: (t: Totals) => string; note: (t: Totals) => string };

const n = (t: Totals, m: string) => t[m]?.count ?? 0;
const s = (t: Totals, m: string) => t[m]?.sum ?? 0;
const pct = (part: number, whole: number) => (whole ? `${Math.round((100 * part) / whole)}%` : '—');

/** Each group: its three charts, its four tiles (from the same totals) and the engine's table. */
const GROUPS: Record<
  string,
  { title: string; sub: string; charts: Chart[]; tiles: Tile[]; extra?: string[] }
> = {
  growth: {
    title: 'Growth',
    sub: 'Who arrives, and how far they get.',
    charts: [
      { metric: 'signups', label: 'Sign-ups' },
      { metric: 'finished', label: 'Finished characters' },
      { metric: 'allies', label: 'Allies brought in' },
    ],
    extra: ['threadsWoven', 'threadsSparked'],
    tiles: [
      {
        label: 'Threads woven',
        value: (t) => String(n(t, 'threadsWoven')),
        note: (t) => `sparked ${n(t, 'threadsSparked')}`,
      },
      {
        label: 'Sign-up → finished',
        value: (t) => pct(n(t, 'finished'), n(t, 'signups')),
        note: () => 'in the range',
      },
      {
        label: 'Ally codes used',
        value: (t) => String(n(t, 'allies')),
        note: (t) => `of ${n(t, 'signups')} sign-ups`,
      },
      { label: 'Finished', value: (t) => String(n(t, 'finished')), note: () => 'characters in the world' },
    ],
  },
  engagement: {
    title: 'Engagement',
    sub: 'How the hold is used, not how long people stare at it.',
    charts: [
      { metric: 'active', label: 'Returned at dawn' },
      { metric: 'quests', label: 'Quests claimed' },
      { metric: 'letters', label: 'Letters' },
    ],
    extra: ['seventhDawn', 'chests'],
    tiles: [
      {
        label: 'Seven-dawn streaks',
        value: (t) => String(n(t, 'seventhDawn')),
        note: () => 'reached in the range',
      },
      { label: 'Quests claimed', value: (t) => String(n(t, 'quests')), note: () => '' },
      { label: 'Chests opened', value: (t) => String(n(t, 'chests')), note: () => '' },
      {
        label: 'Letters a return',
        value: (t) => (n(t, 'active') ? (n(t, 'letters') / n(t, 'active')).toFixed(1) : '—'),
        note: () => 'letters per dawn returned',
      },
    ],
  },
  matching: {
    title: 'Matching',
    sub: 'Summons, bonds and seals — and where fires go cold.',
    charts: [
      { metric: 'summons', label: 'Summons sent' },
      { metric: 'bonds', label: 'Bonds made' },
      { metric: 'goneCold', label: 'Gone cold' },
    ],
    extra: ['answered', 'seal1', 'seal4', 'severed'],
    tiles: [
      {
        label: 'Summons answered',
        value: (t) => pct(n(t, 'answered'), n(t, 'summons')),
        note: () => 'both wrote',
      },
      { label: 'First seal broken', value: (t) => pct(n(t, 'seal1'), n(t, 'bonds')), note: () => 'of bonds' },
      { label: 'Fourth seal', value: (t) => pct(n(t, 'seal4'), n(t, 'bonds')), note: () => 'of bonds' },
      {
        label: 'Ghosting rate',
        value: (t) => pct(n(t, 'goneCold'), n(t, 'bonds')),
        note: (t) => `${n(t, 'severed')} severed`,
      },
    ],
  },
  encounters: {
    title: 'Encounters',
    sub: 'From the first word to a kept meeting.',
    charts: [
      { metric: 'icebreakers', label: 'Icebreakers' },
      { metric: 'rites', label: 'Flame Rites' },
      { metric: 'kept', label: 'Meetings kept' },
    ],
    extra: ['trials', 'sworn', 'noShows', 'oaths'],
    tiles: [
      { label: 'Trials taken', value: (t) => String(n(t, 'trials')), note: () => '' },
      {
        label: 'Meetings sworn',
        value: (t) => String(n(t, 'sworn')),
        note: (t) => `${pct(n(t, 'kept'), n(t, 'sworn'))} kept`,
      },
      { label: 'No-shows', value: (t) => String(n(t, 'noShows')), note: () => '' },
      { label: 'Oaths proven', value: (t) => String(n(t, 'oaths')), note: () => '' },
    ],
  },
  square: {
    title: 'Square',
    sub: 'Every bell rung, and what came of it.',
    charts: [
      { metric: 'seats', label: 'Seats taken' },
      { metric: 'squareSat', label: 'Sat through a round' },
      { metric: 'bondsSquare', label: 'Bonds at the bell' },
    ],
    tiles: [
      { label: 'Seats taken', value: (t) => String(n(t, 'seats')), note: () => '' },
      {
        label: 'Came to the square',
        value: (t) => pct(n(t, 'squareSat'), n(t, 'seats')),
        note: () => 'of seats taken',
      },
      { label: 'Bonds at the bell', value: (t) => String(n(t, 'bondsSquare')), note: () => '' },
      {
        label: 'Bonds per 100 seats',
        value: (t) => (n(t, 'seats') ? ((100 * n(t, 'bondsSquare')) / n(t, 'seats')).toFixed(1) : '—'),
        note: () => '',
      },
    ],
  },
  money: {
    title: 'Money',
    sub: 'Floors, cycles and channels. Paying buys reach, never score.',
    charts: [
      { metric: 'revenue', label: 'Web revenue', money: true },
      { metric: 'newMembers', label: 'New members' },
      { metric: 'storeStarts', label: 'Store purchases' },
    ],
    extra: ['webPayments', 'refunds', 'active'],
    tiles: [
      {
        label: 'Web revenue',
        value: (t) => tugrik(s(t, 'revenue')),
        note: (t) => `${n(t, 'webPayments')} payments`,
      },
      { label: 'New members', value: (t) => String(n(t, 'newMembers')), note: () => 'first floor bought' },
      {
        label: 'Yard → paid',
        value: (t) => pct(n(t, 'newMembers'), n(t, 'active')),
        note: () => 'of dawns returned',
      },
      { label: 'Refunds', value: (t) => String(n(t, 'refunds')), note: (t) => tugrik(s(t, 'refunds')) },
    ],
  },
  cohorts: {
    title: 'Cohorts',
    sub: 'Of each week’s sign-ups, who still lights the hearth.',
    charts: [],
    tiles: [],
  },
};

const RANGES = { day: 0, week: 6, month: 29 } as const;
// The hold's day is Ulaanbaatar's (the engine's IClock); toISOString's UTC day is yesterday until 08:00.
const iso = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ulaanbaatar' });
const daysAgo = (k: number) => iso(new Date(Date.now() - k * 86_400_000));
const short = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });

type Filters = { city?: string; gender?: string; age?: string; tier?: string; floor?: string };

/** The comma-separated text a spreadsheet opens: the days and every metric, then the group's table. */
function toCsv(series: StatSeries[], table: StatTable | undefined): string {
  const cell = (v: string | number) =>
    /[",\n]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : String(v);
  const lines = [['day', ...series.map((x) => x.metric)].join(',')];
  const days = series[0]?.days ?? [];
  days.forEach((d, i) => {
    lines.push(
      [
        d.day,
        ...series.map((x) =>
          x.metric === 'revenue' || x.metric === 'refunds' ? x.days[i].sum : x.days[i].count,
        ),
      ]
        .map(cell)
        .join(','),
    );
  });
  if (table) {
    lines.push('');
    lines.push(table.head.map(cell).join(','));
    for (const r of table.rows) lines.push(r.map(cell).join(','));
  }
  return `${lines.join('\n')}\n`;
}

/**
 * The ledger of the hold (Figma S8 226:1236–226:2247): seven groups over a range and filters (city,
 * gender, age band, tier, floor). Finished days come from the nightly rollup; today is live.
 */
export function StatsPage() {
  const { group = 'growth' } = useParams();
  const g = GROUPS[group] ?? GROUPS.growth;
  const [range, setRange] = useState<'day' | 'week' | 'month' | 'custom'>('month');
  const [custom, setCustom] = useState({ from: daysAgo(29), to: daysAgo(0) });
  const [f, setF] = useState<Filters>({});
  const from = range === 'custom' ? custom.from : daysAgo(RANGES[range]);
  const to = range === 'custom' ? custom.to : daysAgo(0);
  const metrics = [...g.charts.map((c) => c.metric), ...(g.extra ?? [])];
  const params = { from, to, city: f.city, gender: f.gender, age: f.age, tier: f.tier, floor: f.floor };
  const stats = useAdminStats(
    { metrics: metrics.join(','), ...params },
    { query: { enabled: metrics.length > 0 } },
  );
  const table = useAdminStatsTable(group, params);
  const cities = useQuery({
    queryKey: ['/geo/cities'],
    queryFn: async () => (await (await fetch(`${API_URL}/geo/cities`)).json()) as { name: string }[],
  });
  const totals: Totals = Object.fromEntries((stats.data?.series ?? []).map((x) => [x.metric, x]));

  const download = () => {
    const blob = new Blob([toCsv(stats.data?.series ?? [], table.data)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mingldingl-${group}-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const cohortTiles =
    group === 'cohorts' && table.data
      ? ['Day 1', 'Day 7', 'Day 30'].map((label, i) => {
          const shares = table.data.rows
            .map((r) => r[i + 2])
            .filter((v) => v !== '—')
            .map((v) => Number.parseInt(v, 10));
          return {
            label,
            value: shares.length ? `${Math.round(shares.reduce((a, b) => a + b, 0) / shares.length)}%` : '—',
            note: `${shares.length} weeks`,
          };
        })
      : [];

  return (
    <section>
      <div className="page-head">
        <h1 className="page-title">The ledger of the hold</h1>
        <p className="voice page-sub">{g.sub}</p>
      </div>
      <nav className="chips" aria-label="Groups">
        {Object.entries(GROUPS).map(([key, x]) => (
          <Link
            key={key}
            to={`/stats/${key}`}
            className={`chip${key === group ? ' is-on' : ''}`}
            aria-current={key === group ? 'page' : undefined}
          >
            {x.title}
          </Link>
        ))}
      </nav>
      <div className="chips filters">
        {(['day', 'week', 'month', 'custom'] as const).map((r) => (
          <button
            type="button"
            key={r}
            className={`chip${range === r ? ' is-on' : ''}`}
            aria-pressed={range === r}
            onClick={() => setRange(r)}
          >
            {r}
          </button>
        ))}
        {range === 'custom' && (
          <>
            <input
              type="date"
              aria-label="From"
              value={custom.from}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
            />
            <input
              type="date"
              aria-label="To"
              value={custom.to}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
            />
          </>
        )}
        <Select
          label="City"
          value={f.city}
          options={(cities.data ?? []).map((c) => c.name)}
          onChange={(city) => setF({ ...f, city })}
        />
        <Select
          label="Gender"
          value={f.gender}
          options={['Male', 'Female']}
          onChange={(gender) => setF({ ...f, gender })}
        />
        <Select
          label="Age"
          value={f.age}
          options={['18-24', '25-34', '35-44', '45+']}
          onChange={(age) => setF({ ...f, age })}
        />
        <Select
          label="Tier"
          value={f.tier}
          options={['Garnet', 'Opal', 'Amethyst', 'Sapphire', 'Ruby', 'Emerald']}
          onChange={(tier) => setF({ ...f, tier })}
        />
        <Select
          label="Floor"
          value={f.floor}
          options={['yard', 'hall', 'highTable']}
          onChange={(floor) => setF({ ...f, floor })}
        />
        <Button onClick={download} disabled={!stats.data && !table.data}>
          Export CSV
        </Button>
      </div>

      {stats.isError && (
        <p role="alert" className="state danger">
          {errorText(stats.error)}
        </p>
      )}
      {g.charts.length > 0 && (
        <div className="charts">
          {g.charts.map((c) => {
            const x = totals[c.metric];
            const values = (x?.days ?? []).map((d) => (c.money ? d.sum : d.count));
            return (
              <div className="chart-panel" key={c.metric}>
                <div className="label">{c.label}</div>
                <div className="stat-value">
                  {c.money ? tugrik(x?.sum ?? 0) : (x?.count ?? 0).toLocaleString('en-US')}
                </div>
                <div className="muted stat-note">
                  {short(from)} – {short(to)}
                </div>
                <LineChart values={values} first={short(from)} last={short(to)} />
              </div>
            );
          })}
        </div>
      )}
      <div className="stats">
        {(g.tiles.length
          ? g.tiles.map((t) => ({ label: t.label, value: t.value(totals), note: t.note(totals) }))
          : cohortTiles
        ).map((t) => (
          <div className="stat" key={t.label}>
            <div className="label">{t.label}</div>
            <div className="stat-value">{t.value}</div>
            <div className="muted stat-note">{t.note || '—'}</div>
          </div>
        ))}
      </div>
      {table.data && (
        <table className="table">
          <thead>
            <tr>
              {table.data.head.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.data.rows.map((r) => (
              <tr key={r.join('|')}>
                {r.map((c, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: cells are positional
                  <td key={i}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {table.data && table.data.rows.length === 0 && <p className="state">Nothing in this range.</p>}
    </section>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: string;
  options: string[];
  onChange: (v?: string) => void;
}) {
  return (
    <label className="select">
      <span className="visually-hidden">{label}</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">{label}: all</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
