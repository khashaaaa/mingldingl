import { type FormEvent, useState } from 'react';
import { Button } from '../../design/Button';
import { errorText } from '../../lib/api/client';
import { useAdminLogin } from '../../lib/api/generated/engine';
import { session } from '../../lib/session';
import './login.css';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const login = useAdminLogin({
    mutation: { onSuccess: (r) => session.set({ token: r.token, expiresAt: r.expiresAt }) },
  });
  const error = login.error ? errorText(login.error) : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate({ data: { username, password } });
  };

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <h1 className="login-title">The Keepers</h1>
        <label className="field">
          <span className="label">Name</span>
          <input
            className="input"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span className="label">Word</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && (
          <p role="alert" className="login-error danger">
            {error}
          </p>
        )}
        <Button kind="brass" type="submit" disabled={login.isPending}>
          Enter
        </Button>
      </form>
    </main>
  );
}
