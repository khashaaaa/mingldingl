import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import { StatTile } from '../components/StatTile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const QUICK_LINKS = [
  { to: '/users', label: 'Users', description: 'Search, view, and moderate accounts' },
  { to: '/reports', label: 'Reports', description: 'What users have reported about each other' },
  { to: '/deletion-requests', label: 'Deletion Requests', description: 'Pending auto-anonymization' },
  { to: '/content', label: 'Content', description: 'Terms, Privacy, Guides' },
  { to: '/business', label: 'Business Partners', description: 'Cafes, hikes, and date spots' },
  { to: '/ships', label: 'Fated Threads', description: 'Ships, slots, and sparked matches' },
  { to: '/townsquare', label: 'Town Square', description: 'Sessions, RSVPs, and pairings' },
  { to: '/config', label: 'Config', description: 'Live-tunable thresholds and economy values' },
  { to: '/analytics', label: 'Analytics', description: 'Signups, engagement, revenue estimate' },
  { to: '/ops', label: 'Operations', description: 'Maintenance sweep, pricing' },
  { to: '/audit-log', label: 'Audit Log', description: 'Every admin action, who and when' },
];

export function Dashboard() {
  const overviewQuery = useQuery({
    queryKey: queryKeys.analyticsOverview,
    queryFn: () => apiClient.analytics.overview(),
  });
  const deletionRequestsQuery = useQuery({
    queryKey: queryKeys.deletionRequests,
    queryFn: () => apiClient.users.deletionRequests(),
  });
  const auditLogQuery = useQuery({
    queryKey: queryKeys.auditLog(1, 5),
    queryFn: () => apiClient.auditLog.list(1, 5),
  });
  // The only queue here with a person waiting at the other end of it.
  const pendingReportsQuery = useQuery({
    queryKey: queryKeys.pendingReportCount,
    queryFn: () => apiClient.reports.pendingCount(),
  });

  const overview = overviewQuery.data;
  const deletionRequests = deletionRequestsQuery.data;
  const auditLog = auditLogQuery.data;
  const statsError = overviewQuery.isError || deletionRequestsQuery.isError;

  function retryStats() {
    if (overviewQuery.isError) overviewQuery.refetch();
    if (deletionRequestsQuery.isError) deletionRequestsQuery.refetch();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Dashboard</h1>

      {statsError && (
        <p className="text-destructive text-sm">
          Couldn't load dashboard stats.{' '}
          <button type="button" className="underline" onClick={retryStats}>
            Try again
          </button>
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatTile label="Total users" value={overview?.totalUsers ?? '—'} />
        <StatTile label="Active" value={overview?.activeUsers ?? '—'} />
        <StatTile label="Open reports" value={pendingReportsQuery.data?.pending ?? '—'} />
        <StatTile label="Pending deletions" value={deletionRequests?.length ?? '—'} />
        <StatTile
          label="Est. monthly revenue"
          value={overview ? `${overview.estimatedMonthlyRevenueMnt?.toLocaleString()} MNT` : '—'}
        />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold">Sections</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((link) => (
            <Link key={link.to} to={link.to}>
              <Card className="hover:border-primary/50 h-full transition-colors">
                <CardHeader>
                  <CardTitle className="text-sm">{link.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">{link.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent admin activity</CardTitle>
        </CardHeader>
        <CardContent>
          {auditLogQuery.isError ? (
            <p className="text-destructive text-sm">
              Couldn't load admin activity.{' '}
              <button type="button" className="underline" onClick={() => auditLogQuery.refetch()}>
                Try again
              </button>
            </p>
          ) : auditLog?.items?.length ? (
            <ul className="space-y-2 text-sm">
              {auditLog.items.map((l) => (
                <li key={l.id} className="flex items-center justify-between">
                  <span>
                    <span className="font-medium">{l.adminUsername}</span> — {l.action}
                    {l.entityType && <span className="text-muted-foreground"> ({l.entityType})</span>}
                  </span>
                  <span className="text-muted-foreground text-xs">{l.createdAt && new Date(l.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">No admin actions recorded yet.</p>
          )}
          <Link to="/audit-log" className="text-primary mt-3 inline-block text-sm hover:underline">
            View full audit log →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
