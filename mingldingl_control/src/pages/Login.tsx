import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/api/apiClient';
import { setToken } from '../lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const DEFAULT_NEXT = '/users';

function resolveNext(raw: string | null): string {
  if (!raw || !/^\/(?![/\\])/.test(raw) || raw.startsWith('/login')) return DEFAULT_NEXT;
  return raw;
}

export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { token, expiresAt } = await apiClient.auth.login(username, password);
      if (!token) throw new Error('No token returned');
      setToken(token, expiresAt);
      navigate(resolveNext(searchParams.get('next')), { replace: true });
    } catch {
      setError('Invalid username or password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center">
      <Card className="w-80">
        <CardHeader>
          <CardTitle className="text-xl">mingldingl_control</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
