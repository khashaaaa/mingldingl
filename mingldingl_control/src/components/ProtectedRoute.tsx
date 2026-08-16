import { Navigate, Outlet } from 'react-router-dom';
import { getToken } from '../lib/auth';

// Presence of a stored token is enough to render — an actually-expired or
// invalid token still gets caught by the axios 401 interceptor on the first
// real request, which clears it and redirects to /login (see lib/api/api.ts).
export function ProtectedRoute() {
  return getToken() ? <Outlet /> : <Navigate to="/login" replace />;
}
