import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/api/apiClient';
import { loginError } from '@/lib/apiError';
import { clearToken, getTokenExpiry, setToken } from '@/lib/auth';
import { clearSessionExpired, isSessionExpired, markSessionExpired, subscribeSession } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const WARN_BEFORE_MS = 5 * 60 * 1000;
const TICK_MS = 15 * 1000;

/**
 * The admin token lasts 12h with no refresh. Warns a few minutes before it runs out, and once it
 * has (or any request came back 401) asks for the password over the current page, so an
 * unsaved edit survives instead of being lost to a redirect.
 */
export function SessionGuard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [expired, setExpired] = useState(isSessionExpired);
  const [renewing, setRenewing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => subscribeSession(setExpired), []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const expiry = getTokenExpiry();
  const msLeft = expiry === null ? null : expiry - now;

  useEffect(() => {
    if (msLeft !== null && msLeft <= 0 && !isSessionExpired()) {
      clearToken();
      markSessionExpired();
    }
  }, [msLeft]);

  const open = expired || renewing;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { token, expiresAt } = await apiClient.auth.login(username, password);
      if (!token) throw new Error('No token returned');
      setToken(token, expiresAt);
      setPassword('');
      setRenewing(false);
      setNow(Date.now());
      clearSessionExpired();
      qc.invalidateQueries();
    } catch (err) {
      setError(loginError(err));
    } finally {
      setSubmitting(false);
    }
  }

  function goToLogin() {
    clearToken();
    clearSessionExpired();
    const current = location.pathname + location.search;
    const next = current === '/' ? '' : `?next=${encodeURIComponent(current)}`;
    navigate(`/login${next}`);
  }

  const showWarning = !expired && msLeft !== null && msLeft > 0 && msLeft <= WARN_BEFORE_MS;

  return (
    <>
      {showWarning && (
        <div role="status" className="bg-warning text-warning-foreground flex flex-wrap items-center justify-center gap-3 px-6 py-2 text-sm">
          <span>
            Your session expires in about {Math.max(1, Math.ceil(msLeft / 60000))} min. Save your work, or sign in
            again to keep going.
          </span>
          <Button size="sm" variant="outline" onClick={() => setRenewing(true)}>
            Sign in again
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={(next) => !next && !expired && setRenewing(false)}>
        <DialogContent
          showCloseButton={!expired}
          onEscapeKeyDown={(e) => expired && e.preventDefault()}
          onPointerDownOutside={(e) => expired && e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{expired ? 'Session expired' : 'Renew session'}</DialogTitle>
            <DialogDescription>
              Sign in again to continue. This page stays as it is, including anything you haven't saved yet — retry
              the save afterwards.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="session-username">Username</Label>
              <Input
                id="session-username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-password">Password</Label>
              <Input
                id="session-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={goToLogin}>
                Go to login page
              </Button>
              <Button type="submit" disabled={submitting || !username || !password}>
                {submitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
