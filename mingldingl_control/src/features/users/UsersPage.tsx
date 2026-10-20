import { useInfiniteQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../design/Button';
import { SearchField } from '../../design/SearchField';
import { errorText } from '../../lib/api/client';
import { adminListUsers } from '../../lib/api/generated/engine';
import { maskPhone } from '../../lib/format';
import { usersListKey } from '../../lib/live';
import { useDebounced } from './useDebounced';

/** Reputation starts at 100 and only falls; the keepers read it as Good or by how far it fell. */
const reputation = (r: number | null | undefined) => (r == null ? '—' : r >= 100 ? 'Good' : `${r} of 100`);

export function UsersPage() {
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim(), 250);
  const navigate = useNavigate();
  const list = useInfiniteQuery({
    queryKey: usersListKey(term),
    queryFn: ({ pageParam, signal }) =>
      adminListUsers({ search: term || undefined, cursor: pageParam ?? undefined }, { signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? null,
  });

  // Rows that were not in the first load (a live sign-up, the next page) play a short arrival once,
  // on mount; the first load does not.
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];
  const firstLoad = useRef<{ term: string; ids: Set<string> } | null>(null);
  if (list.data && firstLoad.current?.term !== term)
    firstLoad.current = { term, ids: new Set(rows.map((r) => r.accountId)) };
  const isNew = (id: string) => firstLoad.current?.term === term && !firstLoad.current.ids.has(id);

  return (
    <section>
      <div className="page-head">
        <h1 className="page-title">Travellers</h1>
      </div>
      <SearchField value={search} onChange={setSearch} placeholder="Search by name, number or id" />
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Number</th>
            <th>Tier</th>
            <th>Score</th>
            <th>Reputation</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.accountId}
              data-account-id={r.accountId}
              className={isNew(r.accountId) ? 'clickable fresh' : 'clickable'}
              onClick={() => navigate(`/users/${r.accountId}`)}
            >
              <td>
                <Link to={`/users/${r.accountId}`}>
                  {r.name ?? <span className="muted">— not yet named</span>}
                </Link>
              </td>
              <td>{maskPhone(r.phone)}</td>
              <td>{r.tier ?? '—'}</td>
              <td>{r.points ?? '—'}</td>
              <td>{reputation(r.reputation)}</td>
              <td className={r.status === 'Active' ? undefined : 'danger'}>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.isPending && <p className="state">Gathering the travellers…</p>}
      {list.isError && (
        <p role="alert" className="state danger">
          {errorText(list.error)}
        </p>
      )}
      {list.isSuccess && rows.length === 0 && (
        <p className="state">{term ? 'No traveller answers to that.' : 'No one has arrived yet.'}</p>
      )}
      {list.hasNextPage && (
        <p className="state">
          <Button onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>
            More travellers
          </Button>
        </p>
      )}
    </section>
  );
}
