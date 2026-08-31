import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Pagination } from '@/components/Pagination';
import { useToast } from '@/hooks/use-toast';

const PAGE_SIZE = 20;

function statusVariant(status?: string | null): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (status === 'Completed') return 'success';
  if (status === 'Open' || status === 'Locked' || status === 'InProgress') return 'warning';
  if (status === 'Cancelled') return 'destructive';
  return 'secondary';
}

function responseVariant(response?: string | null): 'success' | 'warning' | 'destructive' {
  if (response === 'Yes') return 'success';
  if (response === 'No') return 'destructive';
  return 'warning';
}

function serverError(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultScheduleForm() {
  const now = new Date();
  const opens = new Date(now);
  opens.setMinutes(0, 0, 0);
  opens.setHours(opens.getHours() + 1);
  const start = new Date(now);
  start.setDate(start.getDate() + 1);
  start.setHours(20, 0, 0, 0);
  const closes = new Date(start.getTime() - 15 * 60 * 1000);
  return { rsvpOpensAt: toLocalInput(opens), rsvpClosesAt: toLocalInput(closes), scheduledStartAt: toLocalInput(start) };
}

function validateSchedule(form: ReturnType<typeof defaultScheduleForm>): string | null {
  const opens = new Date(form.rsvpOpensAt);
  const closes = new Date(form.rsvpClosesAt);
  const start = new Date(form.scheduledStartAt);
  if ([opens, closes, start].some((d) => Number.isNaN(d.getTime()))) return 'All three times are required.';
  if (start.getTime() <= Date.now()) return 'Start must be in the future.';
  if (opens.getTime() >= closes.getTime()) return 'RSVP opens must be before RSVP closes.';
  if (closes.getTime() > start.getTime()) return 'RSVP closes must be at or before start.';
  return null;
}

function SessionPairings({ sessionId }: { sessionId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.townSquarePairings(sessionId),
    queryFn: () => apiClient.townSquare.pairings(sessionId),
  });

  if (isLoading) return <p className="text-muted-foreground p-4 text-sm">Loading pairings…</p>;
  if (isError) return <p className="text-destructive p-4 text-sm">Couldn't load pairings.</p>;
  if (!data?.length) return <p className="text-muted-foreground p-4 text-sm">No pairings yet for this session.</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Round</TableHead>
          <TableHead>User A</TableHead>
          <TableHead>User B</TableHead>
          <TableHead>Matched?</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((p) => (
          <TableRow key={p.id}>
            <TableCell>{p.roundNumber}</TableCell>
            <TableCell>
              <Link to={`/users/${p.userAId}`} className="text-primary hover:underline">
                {p.userADisplayName}
              </Link>{' '}
              <Badge variant={responseVariant(p.userAResponse)} className="ml-1">
                {p.userAResponse}
              </Badge>
              {!p.userAJoinedAt && p.userAResponse === 'Yes' && (
                <span className="text-muted-foreground ml-1 text-xs">(never joined)</span>
              )}
            </TableCell>
            <TableCell>
              <Link to={`/users/${p.userBId}`} className="text-primary hover:underline">
                {p.userBDisplayName}
              </Link>{' '}
              <Badge variant={responseVariant(p.userBResponse)} className="ml-1">
                {p.userBResponse}
              </Badge>
              {!p.userBJoinedAt && p.userBResponse === 'Yes' && (
                <span className="text-muted-foreground ml-1 text-xs">(never joined)</span>
              )}
            </TableCell>
            <TableCell>{p.resultingMatchId ? <Badge variant="success">Matched</Badge> : '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function TownSquare() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [form, setForm] = useState(defaultScheduleForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingCancel, setPendingCancel] = useState<{ id: string; scheduledStartAt?: string } | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.townSquareSessions(page),
    queryFn: () => apiClient.townSquare.sessions(page, PAGE_SIZE),
  });

  function invalidateSessions() {
    qc.invalidateQueries({ queryKey: ['townSquareSessions'] });
  }

  const create = useMutation({
    mutationFn: () =>
      apiClient.townSquare.createSession({
        rsvpOpensAt: new Date(form.rsvpOpensAt).toISOString(),
        rsvpClosesAt: new Date(form.rsvpClosesAt).toISOString(),
        scheduledStartAt: new Date(form.scheduledStartAt).toISOString(),
      }),
    onSuccess: (s) => {
      invalidateSessions();
      setScheduleOpen(false);
      toast({
        variant: 'success',
        description: `Session scheduled for ${s.scheduledStartAt ? new Date(s.scheduledStartAt).toLocaleString() : 'the chosen time'}.`,
      });
    },
    onError: (err) => setFormError(serverError(err, "Couldn't schedule session — try again.")),
  });

  const cancel = useMutation({
    mutationFn: (sessionId: string) => apiClient.townSquare.cancelSession(sessionId),
    onSuccess: () => {
      invalidateSessions();
      setPendingCancel(null);
      toast({ variant: 'success', description: 'Session cancelled.' });
    },
    onError: (err) => {
      setPendingCancel(null);
      toast({ variant: 'destructive', description: serverError(err, "Couldn't cancel session — try again.") });
    },
  });

  function openSchedule() {
    setForm(defaultScheduleForm());
    setFormError(null);
    setScheduleOpen(true);
  }

  function submitSchedule() {
    const err = validateSchedule(form);
    setFormError(err);
    if (!err) create.mutate();
  }

  function setField(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setFormError(null);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Town Square Sessions</h1>
        <Button size="sm" onClick={openSchedule}>
          Schedule session
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {isError && <p className="text-destructive text-sm">Couldn't load sessions.</p>}

      {data && (
        <div className="space-y-3">
          {(data.items ?? []).map((s) => (
            <Card key={s.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                    <span className="text-sm font-medium">
                      {s.scheduledStartAt && new Date(s.scheduledStartAt).toLocaleString()}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      Round {s.currentRoundNumber} · {s.rsvpCount} RSVPs
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(s.status === 'Open' || s.status === 'Locked') && s.id && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setPendingCancel({ id: s.id!, scheduledStartAt: s.scheduledStartAt })}
                      >
                        Cancel
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExpanded(expanded === s.id ? null : (s.id ?? null))}
                    >
                      {expanded === s.id ? 'Hide pairings' : 'View pairings'}
                    </Button>
                  </div>
                </div>
                {expanded === s.id && s.id && (
                  <div className="mt-4 border-t pt-4">
                    <SessionPairings sessionId={s.id} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {data.items?.length === 0 && <p className="text-muted-foreground text-sm">No sessions found.</p>}

          <Pagination page={data.page ?? 1} totalCount={data.totalCount ?? 0} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      )}

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule a Town Square session</DialogTitle>
            <DialogDescription>Times are entered in your local timezone and stored as UTC.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="ts-opens">RSVP opens</Label>
            <Input
              id="ts-opens"
              type="datetime-local"
              value={form.rsvpOpensAt}
              onChange={(e) => setField('rsvpOpensAt', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ts-closes">RSVP closes</Label>
            <Input
              id="ts-closes"
              type="datetime-local"
              value={form.rsvpClosesAt}
              onChange={(e) => setField('rsvpClosesAt', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ts-start">Start</Label>
            <Input
              id="ts-start"
              type="datetime-local"
              value={form.scheduledStartAt}
              onChange={(e) => setField('scheduledStartAt', e.target.value)}
            />
          </div>
          {formError && <p className="text-destructive text-sm">{formError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button disabled={create.isPending} onClick={submitSchedule}>
              {create.isPending ? 'Scheduling…' : 'Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingCancel} onOpenChange={(open) => !open && setPendingCancel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this session?</DialogTitle>
            <DialogDescription>
              {pendingCancel?.scheduledStartAt
                ? `Scheduled for ${new Date(pendingCancel.scheduledStartAt).toLocaleString()}. `
                : ''}
              Everyone who RSVP'd will lose their spot. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingCancel(null)}>
              Keep session
            </Button>
            <Button
              variant="destructive"
              disabled={cancel.isPending}
              onClick={() => pendingCancel && cancel.mutate(pendingCancel.id)}
            >
              {cancel.isPending ? 'Cancelling…' : 'Cancel session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
