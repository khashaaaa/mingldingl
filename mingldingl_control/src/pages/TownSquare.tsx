import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination } from '@/components/Pagination';

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

// Session list here is read-only support lookup, same reasoning as Ships —
// no admin action exists to cancel/reschedule a session or force-resolve a
// pairing yet, just visibility into a stuck round for investigating a
// complaint (e.g. "my partner never joined").
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
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.townSquareSessions(page),
    queryFn: () => apiClient.townSquare.sessions(page, PAGE_SIZE),
  });

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Town Square Sessions</h1>

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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpanded(expanded === s.id ? null : (s.id ?? null))}
                  >
                    {expanded === s.id ? 'Hide pairings' : 'View pairings'}
                  </Button>
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
    </div>
  );
}
