import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import { StatTile } from '../components/StatTile';
import { BarChart } from '../components/BarChart';
import { LineChart } from '../components/LineChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function Analytics() {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.analyticsOverview,
    queryFn: () => apiClient.analytics.overview(),
  });

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading…</p>;
  if (isError || !data) return <p className="text-destructive text-sm">Couldn't load analytics.</p>;

  const membershipData = Object.entries(data.usersByMembership ?? {}).map(([label, value]) => ({ label, value }));
  const gemTierData = Object.entries(data.usersByGemTier ?? {}).map(([label, value]) => ({ label, value }));
  const scoreEventData = (data.scoreEventsLast30Days ?? [])
    .slice(0, 8)
    .map((e) => ({ label: e.eventType ?? '', value: e.count ?? 0 }));
  const signups = (data.signupsLast30Days ?? []).map((d) => ({ date: d.date ?? '', count: d.count ?? 0 }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Analytics</h1>
        <p className="text-muted-foreground text-sm">
          Real data from the engine — no payment/transaction records exist yet, so revenue below is an estimate, not
          recorded income.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Total users" value={data.totalUsers ?? 0} />
        <StatTile label="Active" value={data.activeUsers ?? 0} />
        <StatTile label="Paused" value={data.pausedUsers ?? 0} />
        <StatTile label="Deleted" value={data.deletedUsers ?? 0} />
        <StatTile label="Total matches" value={data.totalMatches ?? 0} />
        <StatTile label="Total messages" value={data.totalMessages ?? 0} />
        <StatTile
          label="Est. monthly revenue"
          value={`${(data.estimatedMonthlyRevenueMnt ?? 0).toLocaleString()} MNT`}
          caption="Current tier mix × listed prices, not recorded payments"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Signups — last 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          <LineChart data={signups} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Users by membership</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={membershipData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Users by gem tier</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={gemTierData} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Score events — last 30 days (top 8)</CardTitle>
        </CardHeader>
        <CardContent>
          <BarChart data={scoreEventData} />
        </CardContent>
      </Card>
    </div>
  );
}
