import { execFileSync } from 'node:child_process';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

/**
 * Brings up its own engine (port 5151, Development, fake WeSend, code 000000) with a throwaway admin password,
 * and its own admin dev server pointed at it, so a running dev engine on 5150 is left alone.
 * The engine gets its own database too, made fresh each run (the engine migrates and seeds it at
 * boot): pointed at the dev database it left bells, venues and stand-in Mongolian there, and a
 * second run failed on its own leftovers.
 */
export const E2E_ENGINE = 'http://localhost:5151';
// Not Vite's next-free 5174: another project's dev server on this desktop usually holds it.
const E2E_PANEL_PORT = process.env.E2E_PANEL_PORT ?? '5183';
const E2E_PANEL = `http://localhost:${E2E_PANEL_PORT}`;
/** The legal pages print it (deploy reads it from engine.env). */
export const E2E_SUPPORT_EMAIL = 'keepers@e2e.test';
export const E2E_ADMIN = { username: 'keeper-e2e', password: 'e2e-word-not-secret' };

const salt = randomBytes(16);
const hash = pbkdf2Sync(E2E_ADMIN.password, salt, 210_000, 32, 'sha256');
const passwordHash = `210000.${salt.toString('base64')}.${hash.toString('base64')}`;
const home = process.env.HOME ?? '';

// The dev database's server and login (appsettings.Development.json), with another database name.
const dev: string = JSON.parse(
  readFileSync('../mingldingl_engine/src/MinglDingl.Engine/appsettings.Development.json', 'utf8'),
).ConnectionStrings.Default;
const part = (k: string) => new RegExp(`(?:^|;)\\s*${k}=([^;]*)`, 'i').exec(dev)?.[1] ?? '';
const E2E_DB = 'mingldingl_e2e';
const e2eConnection = `${dev.replace(/(^|;)\s*Database=[^;]*/i, '$1')};Database=${E2E_DB}`;
/** Runs one SQL statement on the e2e database (tests use it for what no endpoint does). */
export const e2eSql = (sql: string) =>
  execFileSync(
    'psql',
    [
      '-h',
      part('Host') || '127.0.0.1',
      '-p',
      part('Port') || '5432',
      '-U',
      part('Username'),
      '-d',
      E2E_DB,
      '-qc',
      sql,
    ],
    { env: { ...process.env, PGPASSWORD: part('Password') } },
  );
const dropDb = `psql -h ${part('Host') || '127.0.0.1'} -p ${part('Port') || '5432'} -U ${part('Username')} -d postgres -qc "DROP DATABASE IF EXISTS ${E2E_DB} WITH (FORCE)"`;

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: {
    baseURL: E2E_PANEL,
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
  },
  webServer: [
    {
      command: `${dropDb} && ${home}/.dotnet/dotnet run --project ../mingldingl_engine/src/MinglDingl.Engine --no-launch-profile --urls ${E2E_ENGINE}`,
      url: `${E2E_ENGINE}/health`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        DOTNET_ROOT: `${home}/.dotnet`,
        ASPNETCORE_ENVIRONMENT: 'Development',
        Admin__Username: E2E_ADMIN.username,
        Admin__PasswordHash: passwordHash,
        WeSend__Fake: 'true',
        // Every test signs people up from one address; the per-IP auth limit is not what is tested here.
        RateLimits__AuthPerMinute: '1000',
        ConnectionStrings__Default: e2eConnection,
        PGPASSWORD: part('Password'),
      },
    },
    {
      command: `npx vite --port ${E2E_PANEL_PORT} --strictPort`,
      url: E2E_PANEL,
      reuseExistingServer: false,
      env: { VITE_API_URL: E2E_ENGINE, VITE_SUPPORT_EMAIL: E2E_SUPPORT_EMAIL },
    },
  ],
});
