import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient, REPORT_OUTCOMES, type ReportOutcome } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import { serverError } from '../lib/apiError';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Pagination } from '@/components/Pagination';

const PAGE_SIZE = 20;
const STATUSES = ['Pending', 'Dismissed', 'Warned', 'Penalised', 'Banned'];

/** Plain-English for the wire values `POST /reports` accepts. */
const REASON_LABELS: Record<string, string> = {
  Harassment: 'Harassment or abuse',
  InappropriatePhotos: 'Inappropriate photos',
  FakeProfile: 'Fake profile / impersonation',
  Scam: 'Scam or solicitation',
  Underage: 'Appears under 18',
  OffPlatformHarm: 'Threats or harm off-platform',
  Other: 'Other',
};

/** What each way of closing a report actually does, said once where the choice is made. */
const OUTCOME_HELP: Record<ReportOutcome, string> = {
  Dismissed: 'No action. The report is kept — a pattern across reporters is the real signal.',
  Warned: 'Logged as upheld, no automatic consequence. Contact the user yourself.',
  Penalised: 'Applies the ReportPenalty score delta to the reported user.',
  Banned: 'Suspends the account and ends every live conversation it holds.',
};

function statusVariant(status?: string | null): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (status === 'Pending') return 'warning';
  if (status === 'Banned' || status === 'Penalised') return 'destructive';
  if (status === 'Dismissed') return 'secondary';
  return 'success';
}

export function Reports() {
  const [status, setStatus] = useState('Pending');
  const [page, setPage] = useState(1);
  const [resolving, setResolving] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ReportOutcome>('Dismissed');
  const [notes, setNotes] = useState('');
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.reports(status, page),
    queryFn: () => apiClient.reports.list(status, page, PAGE_SIZE),
  });

  // Only loaded while a report is open for resolution: it carries the reported user's whole
  // history, which is the thing that turns one complaint into a decision.
  const { data: detail } = useQuery({
    queryKey: queryKeys.report(resolving ?? ''),
    queryFn: () => apiClient.reports.detail(resolving!),
    enabled: !!resolving,
  });

  const resolve = useMutation({
    mutationFn: () => apiClient.reports.resolve(resolving!, outcome, notes.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: queryKeys.pendingReportCount });
      qc.invalidateQueries({ queryKey: ['user'] });
      toast({ variant: 'success', description: `Report ${outcome.toLowerCase()}.` });
      closeDialog();
    },
    onError: (err) =>
      toast({ variant: 'destructive', description: serverError(err, 'Could not resolve the report.') }),
  });

  function openDialog(id: string) {
    setResolving(id);
    setOutcome('Dismissed');
    setNotes('');
  }

  function closeDialog() {
    setResolving(null);
    setNotes('');
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Reports</h1>
        <Select
          value={status || 'all'}
          onValueChange={(v) => {
            setStatus(v === 'all' ? '' : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-muted-foreground mb-4 text-sm">
        Filing a report already blocks the reported user and ends the conversation, so nothing here
        is urgent for the reporter's safety. Resolved reports are kept: several reporters saying the
        same thing is the signal worth acting on.
      </p>

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {isError && <p className="text-destructive text-sm">Couldn't load reports.</p>}

      {data && (
        <>
          <div className="bg-background rounded-lg border shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reported</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Filed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items?.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link to={`/users/${r.reportedUserId}`} className="text-primary hover:underline">
                        {r.reportedDisplayName}
                      </Link>
                      {r.reportedIsBanned && <Badge variant="destructive" className="ml-2">Banned</Badge>}
                    </TableCell>
                    <TableCell>{REASON_LABELS[r.reason ?? ''] ?? r.reason}</TableCell>
                    <TableCell className="max-w-xs truncate" title={r.details ?? ''}>
                      {r.details || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <Link to={`/users/${r.reporterId}`} className="text-primary hover:underline">
                        {r.reporterDisplayName}
                      </Link>
                    </TableCell>
                    <TableCell>{r.createdAt && new Date(r.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell><Badge variant={statusVariant(r.status)}>{r.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {r.status === 'Pending' && (
                        <Button size="sm" variant="outline" onClick={() => openDialog(r.id!)}>
                          Resolve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {data.items?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground text-center">
                      No reports here.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <Pagination
            page={page}
            totalCount={data.totalCount ?? 0}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}

      <Dialog open={resolving !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve report</DialogTitle>
            <DialogDescription>
              {detail
                ? `${detail.reportedDisplayName} has ${detail.totalReportsAgainst} report(s) from ${detail.distinctReportersAgainst} reporter(s), ${detail.pendingReportsAgainst} still open.`
                : 'Loading the reported user’s history…'}
            </DialogDescription>
          </DialogHeader>

          {detail?.details && (
            <p className="bg-muted rounded p-3 text-sm">{detail.details}</p>
          )}

          <div className="space-y-2">
            <Select value={outcome} onValueChange={(v) => setOutcome(v as ReportOutcome)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REPORT_OUTCOMES.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-sm">{OUTCOME_HELP[outcome]}</p>
          </div>

          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (kept on the report, and used as the ban reason)"
            maxLength={1000}
          />

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              variant={outcome === 'Banned' ? 'destructive' : 'default'}
              disabled={resolve.isPending}
              onClick={() => resolve.mutate()}
            >
              {resolve.isPending ? 'Saving…' : `Mark ${outcome}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
