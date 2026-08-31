import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination } from '@/components/Pagination';

const PAGE_SIZE = 20;

export function AuditLog() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.auditLog(page, PAGE_SIZE),
    queryFn: () => apiClient.auditLog.list(page, PAGE_SIZE),
  });

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold">Audit Log</h1>
      <p className="text-muted-foreground mb-4 text-sm">Every admin write action taken from this dashboard, most recent first.</p>

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {isError && <p className="text-destructive text-sm">Couldn't load the audit log.</p>}

      {data && (
        <>
          <div className="bg-background mb-4 rounded-lg border shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.items ?? []).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-muted-foreground">{l.createdAt && new Date(l.createdAt).toLocaleString()}</TableCell>
                    <TableCell>{l.adminUsername}</TableCell>
                    <TableCell className="font-medium">{l.action}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {l.entityType}
                      {l.entityId ? ` (${l.entityId.slice(0, 8)}…)` : ''}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{l.details ?? '—'}</TableCell>
                  </TableRow>
                ))}
                {data.items?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground text-center">
                      No admin actions recorded yet.
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
