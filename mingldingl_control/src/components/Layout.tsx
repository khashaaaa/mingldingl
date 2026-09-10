import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { clearToken } from '../lib/auth';
import { ErrorBoundary } from './ErrorBoundary';
import { applyTheme, getStoredTheme, subscribeTheme } from '../lib/theme';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/users', label: 'Users' },
  { to: '/reports', label: 'Reports' },
  { to: '/deletion-requests', label: 'Deletion Requests' },
  { to: '/content', label: 'Content' },
  { to: '/business', label: 'Business' },
  { to: '/ships', label: 'Ships' },
  { to: '/townsquare', label: 'Town Square' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/ops', label: 'Ops' },
  { to: '/audit-log', label: 'Audit Log' },
  { to: '/config', label: 'Config' },
];

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState(getStoredTheme);

  // Keep the toggle in step with a theme change made in another tab.
  useEffect(() => subscribeTheme(setTheme), []);

  function handleLogout() {
    clearToken();
    navigate('/login');
  }

  function toggleTheme() {
    applyTheme(theme === 'dark' ? 'light' : 'dark');
  }

  return (
    <div className="bg-muted/30 min-h-screen">
      <nav className="bg-background flex flex-wrap items-center justify-between gap-y-2 border-b px-6 py-3">
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-4 font-semibold">mingldingl_control</span>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
