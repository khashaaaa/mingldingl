import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

function flameRiteStage(m: {
  flameRiteProposedAt?: string | null;
  flameRiteAcceptedAt?: string | null;
  flameRiteCompletedAt?: string | null;
}): string {
  if (m.flameRiteCompletedAt) return `Completed ${new Date(m.flameRiteCompletedAt).toLocaleDateString()}`;
  if (m.flameRiteAcceptedAt) return `Accepted ${new Date(m.flameRiteAcceptedAt).toLocaleDateString()}`;
  if (m.flameRiteProposedAt) return `Proposed ${new Date(m.flameRiteProposedAt).toLocaleDateString()}`;
  return '—';
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
      <dd className="text-sm">{value ?? '—'}</dd>
    </div>
  );
}

export function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false);
  const [scoreDelta, setScoreDelta] = useState('');
  const [scoreReason, setScoreReason] = useState('');

  const { data: user, isLoading, isError } = useQuery({
    queryKey: queryKeys.user(id ?? ''),
    queryFn: () => apiClient.users.detail(id ?? ''),
    enabled: !!id,
  });

  function updateUserCache(updated: Awaited<ReturnType<typeof apiClient.users.detail>>) {
    qc.setQueryData(queryKeys.user(id ?? ''), updated);
  }

  const ban = useMutation({
    mutationFn: () => apiClient.users.ban(id ?? '', banReason),
    onSuccess: (updated) => {
      updateUserCache(updated);

      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: queryKeys.analyticsOverview });
      setBanDialogOpen(false);
      setBanReason('');
      toast({ variant: 'success', description: 'User banned.' });
    },
    onError: () => toast({ variant: 'destructive', description: 'Ban failed — try again.' }),
  });

  const unban = useMutation({
    mutationFn: () => apiClient.users.unban(id ?? ''),
    onSuccess: (updated) => {
      updateUserCache(updated);
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: queryKeys.analyticsOverview });
      toast({ variant: 'success', description: 'User unbanned.' });
    },
    onError: () => toast({ variant: 'destructive', description: 'Unban failed — try again.' }),
  });

  const cancelDeletion = useMutation({
    mutationFn: () => apiClient.users.cancelDeletion(id ?? ''),
    onSuccess: (updated) => {
      updateUserCache(updated);
      qc.invalidateQueries({ queryKey: queryKeys.deletionRequests });
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: queryKeys.analyticsOverview });
      toast({ variant: 'success', description: 'Deletion request cancelled.' });
    },
    onError: () => toast({ variant: 'destructive', description: 'Failed to cancel — try again.' }),
  });

  const adjustScore = useMutation({
    mutationFn: () => apiClient.users.adjustScore(id ?? '', Number(scoreDelta), scoreReason),
    onSuccess: (updated) => {
      updateUserCache(updated);
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: queryKeys.analyticsOverview });
      setScoreDialogOpen(false);
      setScoreDelta('');
      setScoreReason('');
      toast({ variant: 'success', description: 'Score adjusted.' });
    },
    onError: () => toast({ variant: 'destructive', description: 'Adjustment failed — try again.' }),
  });

  const resetNoShow = useMutation({
    mutationFn: () => apiClient.users.resetNoShow(id ?? ''),
    onSuccess: (updated) => {
      updateUserCache(updated);
      qc.invalidateQueries({ queryKey: queryKeys.user(id ?? '') });
      qc.invalidateQueries({ queryKey: queryKeys.analyticsOverview });
      toast({ variant: 'success', description: 'No-show flags reset.' });
    },
    onError: () => toast({ variant: 'destructive', description: 'Reset failed — try again.' }),
  });

  return (
    <div>
      <Link to="/users" className="text-primary mb-4 inline-block text-sm hover:underline">
        ← Back to users
      </Link>

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {isError && <p className="text-destructive text-sm">Couldn't load this user.</p>}

      {user && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-lg">{user.displayName}</CardTitle>
              {user.isBanned ? (
                <Badge variant="destructive">Banned</Badge>
              ) : user.isDeleted ? (
                <Badge variant="destructive">Deleted</Badge>
              ) : user.isPaused ? (
                <Badge variant="warning">Paused</Badge>
              ) : (
                <Badge variant="success">Active</Badge>
              )}
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-3 gap-4">
                <Field label="Phone" value={user.phoneNumber} />
                <Field label="Age" value={user.age} />
                <Field label="Gender" value={user.gender} />
                <Field label="City" value={user.city} />
                <Field label="Gem tier" value={user.gemTier} />
                <Field label="Membership" value={user.membershipLevel} />
                <Field
                  label="Membership expires"
                  value={user.membershipExpiresAt && new Date(user.membershipExpiresAt).toLocaleDateString()}
                />
                <Field label="Total score" value={user.totalScore} />
                <Field label="Reputation" value={user.reputationScore} />
                <Field label="Streak" value={`${user.currentStreak} (longest ${user.longestStreak})`} />
                <Field label="Created" value={user.createdAt && new Date(user.createdAt).toLocaleDateString()} />
                <Field
                  label="Deletion requested"
                  value={user.deletionRequestedAt && new Date(user.deletionRequestedAt).toLocaleDateString()}
                />
                <Field label="Banned at" value={user.bannedAt && new Date(user.bannedAt).toLocaleString()} />
                <Field label="Ban reason" value={user.banReason} />
                <Field label="Oath" value={user.oath} />
                <Field label="Oath sworn" value={user.oathSwornAt && new Date(user.oathSwornAt).toLocaleDateString()} />
                <Field
                  label="Oath proven"
                  value={user.oathProven ? <Badge variant="success">Yes</Badge> : <Badge variant="secondary">No</Badge>}
                />
                <Field
                  label="No-show flags"
                  value={
                    <span className="flex items-center gap-2">
                      {user.noShowFlagCount ?? 0}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resetNoShow.mutate()}
                        disabled={resetNoShow.isPending || !(user.noShowFlagCount ?? 0)}
                      >
                        {resetNoShow.isPending ? 'Resetting…' : 'Reset'}
                      </Button>
                    </span>
                  }
                />
              </dl>
              <div className="mt-4">
                <dt className="text-muted-foreground text-xs font-medium">Bio</dt>
                <dd className="text-sm">{user.bio || '—'}</dd>
              </div>

              <div className="mt-6 flex flex-wrap gap-2 border-t pt-4">
                {user.isBanned ? (
                  <Button size="sm" variant="outline" onClick={() => unban.mutate()} disabled={unban.isPending}>
                    {unban.isPending ? 'Unbanning…' : 'Unban'}
                  </Button>
                ) : (
                  <Button size="sm" variant="destructive" onClick={() => setBanDialogOpen(true)}>
                    Ban
                  </Button>
                )}
                {user.deletionRequestedAt && (
                  <Button size="sm" variant="outline" onClick={() => cancelDeletion.mutate()} disabled={cancelDeletion.isPending}>
                    {cancelDeletion.isPending ? 'Cancelling…' : 'Cancel deletion request'}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setScoreDialogOpen(true)}>
                  Adjust score
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Blocked by this user</CardTitle>
              </CardHeader>
              <CardContent>
                {user.usersBlockedByThem?.length ? (
                  <ul className="space-y-1 text-sm">
                    {user.usersBlockedByThem.map((b) => (
                      <li key={b.userId}>
                        <Link to={`/users/${b.userId}`} className="text-primary hover:underline">
                          {b.displayName}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-sm">Hasn't blocked anyone.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Blocked this user</CardTitle>
              </CardHeader>
              <CardContent>
                {user.usersWhoBlockedThem?.length ? (
                  <ul className="space-y-1 text-sm">
                    {user.usersWhoBlockedThem.map((b) => (
                      <li key={b.userId}>
                        <Link to={`/users/${b.userId}`} className="text-primary hover:underline">
                          {b.displayName}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-sm">Not blocked by anyone.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent score events</CardTitle>
            </CardHeader>
            <CardContent>
              {user.recentScoreEvents?.length ? (
                <Table>
                  <TableBody>
                    {user.recentScoreEvents.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">{e.eventType}</TableCell>
                        <TableCell className="text-right font-medium">
                          {(e.delta ?? 0) > 0 ? '+' : ''}
                          {e.delta}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-right">
                          {e.createdAt && new Date(e.createdAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-sm">No score events yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent matches</CardTitle>
            </CardHeader>
            <CardContent>
              {user.recentMatches?.length ? (
                <Table>
                  <TableBody>
                    {user.recentMatches.map((m) => (
                      <TableRow key={m.matchId}>
                        <TableCell>
                          <Link to={`/users/${m.otherUserId}`} className="text-primary hover:underline">
                            {m.otherUserDisplayName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{m.status}</TableCell>
                        <TableCell className="text-muted-foreground">{m.messageCount} messages</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap text-xs">{flameRiteStage(m)}</TableCell>
                        <TableCell className="text-muted-foreground text-right">
                          {m.createdAt && new Date(m.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-sm">No matches yet.</p>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Fated Threads (Ships)</CardTitle>
              </CardHeader>
              <CardContent>
                {user.ships?.length ? (
                  <ul className="space-y-1 text-sm">
                    {user.ships.map((s) => (
                      <li key={s.shipId} className="flex justify-between">
                        <span>{s.role}</span>
                        <span className="text-muted-foreground">{s.status}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-sm">No ships.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Town Square RSVPs</CardTitle>
              </CardHeader>
              <CardContent>
                {user.townSquareRsvps?.length ? (
                  <ul className="space-y-1 text-sm">
                    {user.townSquareRsvps.map((r) => (
                      <li key={r.sessionId} className="flex justify-between">
                        <span>{r.scheduledStartAt && new Date(r.scheduledStartAt).toLocaleDateString()}</span>
                        <span className="text-muted-foreground">{r.sessionStatus}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-sm">No RSVPs.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban {user?.displayName}?</DialogTitle>
            <DialogDescription>Rejected at auth time — they won't be able to use the app until unbanned.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Input value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="e.g. harassment reports" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => ban.mutate()} disabled={ban.isPending}>
              {ban.isPending ? 'Banning…' : 'Ban user'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scoreDialogOpen} onOpenChange={setScoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust score</DialogTitle>
            <DialogDescription>Goes through the same tier recalculation as any other score change.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Delta (positive or negative)</Label>
            <Input type="number" value={scoreDelta} onChange={(e) => setScoreDelta(e.target.value)} placeholder="e.g. 50 or -20" />
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Input value={scoreReason} onChange={(e) => setScoreReason(e.target.value)} placeholder="e.g. compensation for bug" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScoreDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => adjustScore.mutate()}
              disabled={adjustScore.isPending || !scoreDelta || Number.isNaN(Number(scoreDelta))}
            >
              {adjustScore.isPending ? 'Saving…' : 'Apply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
