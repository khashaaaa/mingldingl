import { lazy } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { queryClient } from './lib/api/queryClient';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Toaster } from './components/ui/toaster';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useCrossTabSync } from './hooks/useCrossTabSync';

// One chunk per page, loaded on first visit: bundled together they made a 545 kB entry file.
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const UsersList = lazy(() => import('./pages/UsersList').then((m) => ({ default: m.UsersList })));
const UserDetail = lazy(() => import('./pages/UserDetail').then((m) => ({ default: m.UserDetail })));
const DeletionRequests = lazy(() => import('./pages/DeletionRequests').then((m) => ({ default: m.DeletionRequests })));
const Reports = lazy(() => import('./pages/Reports').then((m) => ({ default: m.Reports })));
const ContentPages = lazy(() => import('./pages/ContentPages').then((m) => ({ default: m.ContentPages })));
const ContentPageEdit = lazy(() => import('./pages/ContentPageEdit').then((m) => ({ default: m.ContentPageEdit })));
const BusinessList = lazy(() => import('./pages/BusinessList').then((m) => ({ default: m.BusinessList })));
const BusinessForm = lazy(() => import('./pages/BusinessForm').then((m) => ({ default: m.BusinessForm })));
const Analytics = lazy(() => import('./pages/Analytics').then((m) => ({ default: m.Analytics })));
const Ops = lazy(() => import('./pages/Ops').then((m) => ({ default: m.Ops })));
const AuditLog = lazy(() => import('./pages/AuditLog').then((m) => ({ default: m.AuditLog })));
const Config = lazy(() => import('./pages/Config').then((m) => ({ default: m.Config })));
const Ships = lazy(() => import('./pages/Ships').then((m) => ({ default: m.Ships })));
const TownSquare = lazy(() => import('./pages/TownSquare').then((m) => ({ default: m.TownSquare })));

function App() {
  useCrossTabSync();

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <ErrorBoundary>
        <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/users" element={<UsersList />} />
              <Route path="/users/:id" element={<UserDetail />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/deletion-requests" element={<DeletionRequests />} />
              <Route path="/content" element={<ContentPages />} />
              <Route path="/content/:slug" element={<ContentPageEdit />} />
              <Route path="/business" element={<BusinessList />} />
              <Route path="/business/new" element={<BusinessForm />} />
              <Route path="/business/:id/edit" element={<BusinessForm />} />
              <Route path="/ships" element={<Ships />} />
              <Route path="/townsquare" element={<TownSquare />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/ops" element={<Ops />} />
              <Route path="/audit-log" element={<AuditLog />} />
              <Route path="/config" element={<Config />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
