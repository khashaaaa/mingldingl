import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '../../design/Button';
import { errorText } from '../../lib/api/client';
import {
  adminSaveFestival,
  getAdminListFestivalsQueryKey,
  useAdminListFestivals,
} from '../../lib/api/generated/engine';
import type { FestivalRow } from '../../lib/api/generated/model';

const NAME: Record<string, string> = {
  tsagaanSar: 'Tsagaan Sar',
  naadam: 'Naadam',
  dayOfBond: 'Day of the Bond',
  march8: 'March 8',
  lastBell: 'The last bell of the year',
};

/** The festival calendar the square and the honours read; Tsagaan Sar moves with the moon. */
export function FestivalCalendar() {
  const list = useAdminListFestivals();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ulaanbaatar' });
  const rows = (list.data ?? []).filter((f) => f.ends >= today);
  return (
    <section className="square-festivals">
      <h2 className="page-title">Festival calendar</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Festival</th>
            <th>Starts</th>
            <th>Ends</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <FestivalLine key={f.id} f={f} />
          ))}
        </tbody>
      </table>
    </section>
  );
}

function FestivalLine({ f }: { f: FestivalRow }) {
  const client = useQueryClient();
  const [starts, setStarts] = useState(f.starts);
  const [ends, setEnds] = useState(f.ends);
  const [error, setError] = useState<string | null>(null);
  const changed = starts !== f.starts || ends !== f.ends;
  const save = async () => {
    setError(null);
    try {
      await adminSaveFestival(f.id, { key: f.key, starts, ends });
      await client.invalidateQueries({ queryKey: getAdminListFestivalsQueryKey() });
    } catch (e) {
      setError(errorText(e));
    }
  };
  return (
    <tr>
      <td>{NAME[f.key] ?? f.key}</td>
      <td>
        <input className="input" type="date" value={starts} onChange={(e) => setStarts(e.target.value)} />
      </td>
      <td>
        <input className="input" type="date" value={ends} onChange={(e) => setEnds(e.target.value)} />
      </td>
      <td>
        {changed && (
          <Button kind="quiet" onClick={save}>
            Save
          </Button>
        )}
        {error && <span className="danger"> {error}</span>}
      </td>
    </tr>
  );
}
