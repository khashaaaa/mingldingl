import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import { downloadBlob } from '../lib/download';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination } from '@/components/Pagination';

const PAGE_SIZE = 20;

export function UsersList() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.users(search, page),
    queryFn: () => apiClient.users.list(search, page, PAGE_SIZE),
  });

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await apiClient.users.export(search);
      downloadBlob(blob, 'users.csv');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Users</h1>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </div>
      <Input
        className="mb-4 w-72"
        placeholder="Search by name, city, or phone"
        value={search}
        onChange={(e) => handleSearchChange(e.target.value)}
      />

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {isError && <p className="text-destructive text-sm">Couldn't load users. Try again.</p>}

      {data && (
        <>
          <div className="bg-background mb-4 rounded-lg border shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Membership</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.items ?? []).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <Link to={`/users/${u.id}`} className="text-primary hover:underline">
                        {u.displayName}
                      </Link>
                    </TableCell>
                    <TableCell>{u.age}</TableCell>
                    <TableCell>{u.city}</TableCell>
                    <TableCell>{u.gemTier}</TableCell>
                    <TableCell>{u.membershipLevel}</TableCell>
                    <TableCell>{u.totalScore}</TableCell>
                    <TableCell>
                      {u.isBanned ? (
                        <Badge variant="destructive">Banned</Badge>
                      ) : u.isDeleted ? (
                        <Badge variant="destructive">Deleted</Badge>
                      ) : u.isPaused ? (
                        <Badge variant="warning">Paused</Badge>
                      ) : (
                        <Badge variant="success">Active</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {data.items?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground text-center">
                      No users found.
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
