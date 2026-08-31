import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { clearToken, getToken, isTokenExpired } from '../lib/auth';

export function ProtectedRoute() {
  const location = useLocation();
  if (!getToken() || isTokenExpired()) {
    clearToken();
    const current = location.pathname + location.search;
    const next = current === '/' ? '' : `?next=${encodeURIComponent(current)}`;
    return <Navigate to={`/login${next}`} replace />;
  }
  return <Outlet />;
}
