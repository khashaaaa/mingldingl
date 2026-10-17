import { useSyncExternalStore } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { AuditPage } from './features/audit/AuditPage';
import { CodexEditPage, CodexPagesPage } from './features/codex/CodexPages';
import { ConfigPage } from './features/config/ConfigPage';
import { LoginPage } from './features/login/LoginPage';
import { DashboardPage, DeletionsPage, OpsPage } from './features/ops/OpsPages';
import { InvoicePage, PaymentsPage } from './features/payments/PaymentsPage';
import { ReportDetailPage } from './features/reports/ReportDetailPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { Shell } from './features/shell/Shell';
import { GatheringsPage } from './features/square/GatheringsPage';
import { StatsPage } from './features/stats/StatsPage';
import { ThreadsPage } from './features/threads/ThreadsPage';
import { UserDetailPage } from './features/users/UserDetailPage';
import { UsersPage } from './features/users/UsersPage';
import { VenueFormPage } from './features/venues/VenueFormPage';
import { VenuesPage } from './features/venues/VenuesPage';
import { session } from './lib/session';

/** The one place that decides: no session → login, whatever the URL; the URL survives signing in. */
function Gate() {
  const signedIn = useSyncExternalStore(session.subscribe, () => session.get() !== null);
  return signedIn ? <Shell /> : <LoginPage />;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Gate />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'stats', element: <StatsPage /> },
      { path: 'stats/:group', element: <StatsPage /> },
      { path: 'deletions', element: <DeletionsPage /> },
      { path: 'ops', element: <OpsPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'users/:id', element: <UserDetailPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'reports/:id', element: <ReportDetailPage /> },
      { path: 'payments', element: <PaymentsPage /> },
      { path: 'payments/:id', element: <InvoicePage /> },
      { path: 'venues', element: <VenuesPage /> },
      { path: 'venues/:id', element: <VenueFormPage /> },
      { path: 'threads', element: <ThreadsPage /> },
      { path: 'square', element: <GatheringsPage /> },
      { path: 'codex', element: <CodexPagesPage /> },
      { path: 'codex/:slug', element: <CodexEditPage /> },
      { path: 'audit', element: <AuditPage /> },
      { path: 'config', element: <ConfigPage /> },
      { path: '*', element: <p className="state">Nothing is kept here.</p> },
    ],
  },
]);
