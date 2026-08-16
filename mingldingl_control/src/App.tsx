import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { queryClient } from './lib/api/queryClient';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { UsersList } from './pages/UsersList';
import { UserDetail } from './pages/UserDetail';
import { DeletionRequests } from './pages/DeletionRequests';
import { ContentPages } from './pages/ContentPages';
import { ContentPageEdit } from './pages/ContentPageEdit';
import { BusinessList } from './pages/BusinessList';
import { BusinessForm } from './pages/BusinessForm';
import { Analytics } from './pages/Analytics';
import { Ops } from './pages/Ops';
import { AuditLog } from './pages/AuditLog';
import { Config } from './pages/Config';
import { Ships } from './pages/Ships';
import { TownSquare } from './pages/TownSquare';
import { Toaster } from './components/ui/toaster';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/users" element={<UsersList />} />
              <Route path="/users/:id" element={<UserDetail />} />
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
    </QueryClientProvider>
  );
}

export default App;
