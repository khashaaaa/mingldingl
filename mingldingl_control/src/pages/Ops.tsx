import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

export function Ops() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: pricing, isLoading, isError } = useQuery({
    queryKey: queryKeys.pricing,
    queryFn: () => apiClient.ops.pricing(),
  });

  const runSweep = useMutation({
    mutationFn: () => apiClient.ops.runMaintenanceSweep(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.deletionRequests });
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['user'] });
      qc.invalidateQueries({ queryKey: queryKeys.analyticsOverview });
      toast({ variant: 'success', description: `Sweep ran at ${new Date().toLocaleTimeString()}` });
    },
    onError: () => toast({ variant: 'destructive', description: 'Sweep failed — try again.' }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Operations</h1>
        <p className="text-muted-foreground text-sm">
          Feature flags aren't included here — no such system exists anywhere in the engine yet; adding one would mean
          building a whole new flag-storage-and-evaluation subsystem, not just admin plumbing.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Maintenance Sweep</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4 text-sm">
            Normally runs automatically every hour (ghosting stale matches, daily-budget reset, deletion anonymization,
            membership expiry). Trigger it manually here instead of waiting.
          </p>
          <Button onClick={() => runSweep.mutate()} disabled={runSweep.isPending}>
            {runSweep.isPending ? 'Running…' : 'Run sweep now'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Membership Pricing</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4 text-sm">
            Read-only — pricing is a hardcoded function of each tier's monthly price in the engine today, not
            DB-backed config, so there's nothing here yet to edit.
          </p>

          {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
          {isError && <p className="text-destructive text-sm">Couldn't load pricing.</p>}

          {pricing && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tier</TableHead>
                  <TableHead>Daily matches</TableHead>
                  <TableHead>Deep profile view</TableHead>
                  <TableHead>Monthly price (MNT)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pricing.map((tier) => (
                  <TableRow key={tier.level}>
                    <TableCell className="font-medium">{tier.level}</TableCell>
                    <TableCell>{tier.dailyMatches}</TableCell>
                    <TableCell>{tier.deepProfileView ? 'Yes' : 'No'}</TableCell>
                    <TableCell>{tier.monthlyPriceMnt?.toLocaleString() ?? 'Free'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
