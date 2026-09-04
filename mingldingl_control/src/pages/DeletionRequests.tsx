import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function DeletionRequests() {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.deletionRequests,
    queryFn: () => apiClient.users.deletionRequests(),
  });

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold">Deletion Requests</h1>
      <p className="text-muted-foreground mb-4 text-sm">
        Read-only — accounts are auto-anonymized after the grace period (Config → Safety → account.deletion_grace_days) unless the user logs back in themselves. "Days left" below already uses the current value.
      </p>

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {isError && <p className="text-destructive text-sm">Couldn't load deletion requests.</p>}

      {data && (
        <div className="bg-background rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Days remaining</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link to={`/users/${r.id}`} className="text-primary hover:underline">
                      {r.displayName}
                    </Link>
                  </TableCell>
                  <TableCell>{r.city}</TableCell>
                  <TableCell>{r.deletionRequestedAt && new Date(r.deletionRequestedAt).toLocaleDateString()}</TableCell>
                  <TableCell>{r.daysRemaining}</TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground text-center">
                    No pending deletion requests.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
