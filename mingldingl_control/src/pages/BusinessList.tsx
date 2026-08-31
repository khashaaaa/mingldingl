import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import { downloadBlob } from '../lib/download';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Pagination } from '@/components/Pagination';

const PAGE_SIZE = 20;

export function BusinessList() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();
  const debouncedSearch = useDebouncedValue(search);

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.business(debouncedSearch, page),
    queryFn: () => apiClient.business.list(debouncedSearch, page, PAGE_SIZE),
  });

  function invalidateList() {
    qc.invalidateQueries({ queryKey: ['business'] });
    qc.invalidateQueries({ queryKey: ['businessDetail'] });
  }

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.business.remove(id),
    onSuccess: () => {
      invalidateList();
      setPendingDelete(null);
    },
    onError: () => {
      toast({ variant: 'destructive', description: "Couldn't delete — it may have existing reviews attached." });
      setPendingDelete(null);
    },
  });

  const bulkUpdate = useMutation({
    mutationFn: (body: { isVerified?: boolean; isFeatured?: boolean }) =>
      apiClient.business.bulkUpdate({ ids: [...selected], isVerified: body.isVerified ?? null, isFeatured: body.isFeatured ?? null }),
    onSuccess: (res) => {
      invalidateList();
      setSelected(new Set());
      toast({ variant: 'success', description: `Updated ${res.updated} businesses.` });
    },
    onError: () => toast({ variant: 'destructive', description: 'Bulk update failed — try again.' }),
  });

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const ids = (data?.items ?? []).map((b) => b.id!);
    setSelected((prev) => (ids.every((id) => prev.has(id)) ? new Set() : new Set(ids)));
  }

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await apiClient.business.export(search);
      downloadBlob(blob, 'business-partners.csv');
    } catch {
      toast({ variant: 'destructive', description: 'Export failed — try again.' });
    } finally {
      setExporting(false);
    }
  }

  const allSelected = (data?.items?.length ?? 0) > 0 && (data?.items ?? []).every((b) => selected.has(b.id!));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Business Partners</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
          <Button asChild size="sm">
            <Link to="/business/new">+ New</Link>
          </Button>
        </div>
      </div>

      <Input
        className="mb-4 w-72"
        placeholder="Search by name, city, or category"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
          setSelected(new Set());
        }}
      />

      {selected.size > 0 && (
        <div className="bg-muted mb-4 flex items-center gap-3 rounded-md border px-4 py-2 text-sm">
          <span>{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => bulkUpdate.mutate({ isVerified: true })} disabled={bulkUpdate.isPending}>
            Mark verified
          </Button>
          <Button size="sm" variant="outline" onClick={() => bulkUpdate.mutate({ isFeatured: true })} disabled={bulkUpdate.isPending}>
            Mark featured
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {isError && <p className="text-destructive text-sm">Couldn't load businesses.</p>}

      {data && (
        <>
          <div className="bg-background mb-4 rounded-lg border shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.items ?? []).map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Checkbox checked={selected.has(b.id!)} onCheckedChange={() => toggleSelected(b.id!)} />
                    </TableCell>
                    <TableCell>
                      <Link to={`/business/${b.id}/edit`} className="text-primary hover:underline">
                        {b.name}
                      </Link>
                    </TableCell>
                    <TableCell>{b.category}</TableCell>
                    <TableCell>{b.city}</TableCell>
                    <TableCell>
                      {b.averageRating?.toFixed(1)} ({b.ratingCount})
                    </TableCell>
                    <TableCell className="space-x-1">
                      {b.isVerified ? <Badge variant="success">Verified</Badge> : <Badge variant="warning">Unverified</Badge>}
                      {b.isFeatured && <Badge variant="secondary">★ Featured</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setPendingDelete({ id: b.id!, name: b.name! })}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {data.items?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground text-center">
                      No businesses found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <Pagination
            page={data.page ?? 1}
            totalCount={data.totalCount ?? 0}
            pageSize={PAGE_SIZE}
            onPageChange={(p) => {
              setPage(p);
              setSelected(new Set());
            }}
          />
        </>
      )}

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{pendingDelete?.name}"?</DialogTitle>
            <DialogDescription>This can't be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => pendingDelete && remove.mutate(pendingDelete.id)}
            >
              {remove.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
