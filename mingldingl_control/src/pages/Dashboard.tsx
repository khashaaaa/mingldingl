import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import { StatTile } from '../components/StatTile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const QUICK_LINKS = [
  { to: '/users', label: 'Users', description: 'Search, view, and moderate accounts' },
  { to: '/deletion-requests', label: 'Deletion Requests', description: 'Pending auto-anonymization' },
  { to: '/content', label: 'Content', description: 'Terms, Privacy, Guides' },
  { to: '/business', label: 'Business Partners', description: 'Cafes, hikes, and date spots' },
  { to: '/analytics', label: 'Analytics', description: 'Signups, engagement, revenue estimate' },
  { to: '/ops', label: 'Operations', description: 'Maintenance sweep, pricing' },
  { to: '/audit-log', label: 'Audit Log', description: 'Every admin action, who and when' },
];

export function Dashboard() {
  const { data: overview } = useQuery({
    queryKey: queryKeys.analyticsOverview,
    queryFn: () => apiClient.analytics.overview(),
  });
  const { data: deletionRequests } = useQuery({
    queryKey: queryKeys.deletionRequests,
    queryFn: () => apiClient.users.deletionRequests(),
  });
  const { data: auditLog } = useQuery({
    queryKey: queryKeys.auditLog(1),
    queryFn: () => apiClient.auditLog.list(1, 5),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Total users" value={overview?.totalUsers ?? '—'} />
        <StatTile label="Active" value={overview?.activeUsers ?? '—'} />
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
          {auditLog?.items?.length ? (
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
