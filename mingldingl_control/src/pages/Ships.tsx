import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pagination } from '@/components/Pagination';

const PAGE_SIZE = 20;
const STATUSES = ['Pending', 'Sparked', 'Declined', 'Expired'];

function statusVariant(status?: string | null): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (status === 'Sparked') return 'success';
  if (status === 'Pending') return 'warning';
  if (status === 'Declined' || status === 'Expired') return 'destructive';
  return 'secondary';
}

export function Ships() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.ships(status, page),
    queryFn: () => apiClient.ships.list(status, page, PAGE_SIZE),
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Fated Threads (Ships)</h1>
        <Select
          value={status || 'all'}
          onValueChange={(v) => {
            setStatus(v === 'all' ? '' : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {isError && <p className="text-destructive text-sm">Couldn't load ships.</p>}

      {data && (
        <>
          <div className="bg-background mb-4 rounded-lg border shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shipper</TableHead>
                  <TableHead>Slot A</TableHead>
                  <TableHead>Slot B</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.items ?? []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link to={`/users/${s.shipperUserId}`} className="text-primary hover:underline">
                        {s.shipperDisplayName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {s.slotAUserId ? (
                        <Link to={`/users/${s.slotAUserId}`} className="text-primary hover:underline">
                          {s.slotADisplayName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">— invite not claimed</span>
                      )}
                      <span className="text-muted-foreground ml-1 text-xs">({s.slotAOptIn})</span>
                    </TableCell>
                    <TableCell>
                      {s.slotBUserId ? (
                        <Link to={`/users/${s.slotBUserId}`} className="text-primary hover:underline">
                          {s.slotBDisplayName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">— invite not claimed</span>
                      )}
                      <span className="text-muted-foreground ml-1 text-xs">({s.slotBOptIn})</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {s.status === 'Sparked' && s.resultMatchId ? (
                        <button
                          type="button"
                          title={`${s.resultMatchId} — click to copy`}
                          className="text-muted-foreground font-mono text-xs hover:underline"
                          onClick={() => navigator.clipboard?.writeText(s.resultMatchId ?? '')}
                        >
                          {s.resultMatchId.slice(0, 8)}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.createdAt && new Date(s.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
                {data.items?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground text-center">
                      No ships found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <Pagination page={data.page ?? 1} totalCount={data.totalCount ?? 0} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
