import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { type APIRequestContext, expect, test } from '@playwright/test';
import { E2E_ADMIN, E2E_ENGINE } from '../playwright.config';

/** Signs up a brand-new number the way the app does: start → status → complete → POST /me. */
async function signUp(api: APIRequestContext, name: string) {
  const phone = `99${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`;
  const start = await (await api.post(`${E2E_ENGINE}/auth/phone/start`, { data: { phone } })).json();
  const status = await (await api.get(`${E2E_ENGINE}/auth/phone/status/${start.verificationId}`)).json();
  expect(status.state).toBe('verified');
  const pairRes = await api.post(`${E2E_ENGINE}/auth/phone/complete`, {
    data: { verificationId: start.verificationId, deviceName: 'playwright' },
  });
  expect(pairRes.ok()).toBe(true);
  const pair = await pairRes.json();
  return { phone, accountId: pair.accountId as string, token: pair.accessToken as string, name };
}

async function createProfile(api: APIRequestContext, u: { token: string; name: string }) {
  const res = await api.post(`${E2E_ENGINE}/me`, {
    headers: { Authorization: `Bearer ${u.token}` },
    data: { name: u.name, birthDate: '1998-04-12', locale: 'en' },
  });
  expect(res.ok()).toBe(true);
}

test('keeper sees a sign-up live, opens it, and an out-of-bounds config write is refused', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await page.getByLabel('Name').fill(E2E_ADMIN.username);
  await page.getByLabel('Word').fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: 'Enter' }).click();

  await page.getByRole('link', { name: 'Users' }).click();
  await expect(page.getByRole('heading', { name: 'Travellers' })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
  // the live connection is up before the sign-up happens
  await expect(page.getByTestId('live-state')).toHaveAttribute('data-state', 'live');

  const name = `Тэмүүжин ${Date.now() % 100000}`;
  const u = await signUp(request, name);
  // the list masks numbers (S8 frame), so the row is found by its account id
  const row = page.locator(`tr[data-account-id="${u.accountId}"]`);
  await expect(row).toBeVisible({ timeout: 2_000 });
  await expect(row).toContainText(u.phone.slice(0, 4));
  await createProfile(request, u);
  await expect(row).toContainText(name, { timeout: 2_000 });

  await row.click();
  await expect(page.getByRole('heading', { name })).toBeVisible();

  await page.getByRole('link', { name: 'Config' }).click();
  const cfg = page.getByRole('row').filter({ hasText: 'photos.min' });
  const before = (await cfg.getByTestId('config-value').textContent())?.trim();
  await cfg.getByRole('button', { name: 'Edit photos.min' }).click();
  await cfg.getByRole('textbox').fill('99');
  await cfg.getByRole('button', { name: 'Save' }).click();
  await expect(cfg.getByRole('alert')).toContainText('between 1 and 6');
  await cfg.getByRole('button', { name: 'Cancel' }).click();
  await expect(cfg.getByTestId('config-value')).toHaveText(before ?? '');
});

test('a report arrives live, and the keeper penalises it', async ({ page, request }) => {
  const from = await signUp(request, `Saruul ${Date.now() % 100000}`);
  const against = await signUp(request, `Bold ${Date.now() % 100000}`);
  await createProfile(request, from);
  await createProfile(request, against);

  await page.goto('/reports');
  await page.getByLabel('Name').fill(E2E_ADMIN.username);
  await page.getByLabel('Word').fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: 'Enter' }).click();
  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
  await expect(page.getByTestId('live-state')).toHaveAttribute('data-state', 'live');

  const res = await request.post(`${E2E_ENGINE}/reports`, {
    headers: { Authorization: `Bearer ${from.token}` },
    data: { accountId: against.accountId, bondId: null, reason: 'money', note: '50,000₮ for a taxi' },
  });
  expect(res.status()).toBe(204);
  const row = page.getByRole('row').filter({ hasText: against.name });
  await expect(row).toContainText('Asked for money', { timeout: 2_000 });
  await expect(row).toContainText('“50,000₮ for a taxi”');

  await row.click();
  await page.getByRole('button', { name: 'Penalise' }).click();
  await expect(page.getByTestId('report-status')).toContainText('Penalised');
  await expect(page.getByRole('button', { name: 'Penalise' })).toHaveCount(0);

  await page.getByRole('link', { name: against.name }).click();
  // at 0 points there is nothing to take (no ledger row), but reputation drops
  await expect(page.locator('.stat').filter({ hasText: 'Reputation' })).toContainText('90');
  await expect(page.locator('.stat').filter({ hasText: 'Reports against' })).toContainText('1');
});

test('a venue added elsewhere appears live; the keeper edits it and takes it off the list', async ({
  page,
  request,
}) => {
  await page.goto('/venues');
  await page.getByLabel('Name').fill(E2E_ADMIN.username);
  await page.getByLabel('Word').fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: 'Enter' }).click();
  await expect(page.getByRole('heading', { name: 'Partner venues' })).toBeVisible();
  await expect(page.getByTestId('live-state')).toHaveAttribute('data-state', 'live');

  // another keeper's session adds a place
  const login = await (
    await request.post(`${E2E_ENGINE}/admin/auth/login`, {
      data: { username: E2E_ADMIN.username, password: E2E_ADMIN.password },
    })
  ).json();
  const name = `Nomad Café ${Date.now() % 100000}`;
  const created = await request.post(`${E2E_ENGINE}/admin/venues`, {
    headers: { Authorization: `Bearer ${login.token ?? login.accessToken}` },
    data: {
      name,
      nameMn: null,
      kind: 'Cafe',
      district: 'Chingeltei',
      address: 'Peace Avenue 14, 2nd floor',
      hours: null,
      description: null,
      verified: true,
    },
  });
  expect(created.ok()).toBe(true);
  const row = page.getByRole('row').filter({ hasText: name });
  await expect(row).toContainText('Chingeltei', { timeout: 2_000 });

  await row.click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await page.getByLabel('Address').fill('Seoul Street 7');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByLabel('Address')).toHaveValue('Seoul Street 7');

  await page.getByRole('button', { name: 'Take it off the list' }).click();
  await expect(page.getByRole('heading', { name: 'Partner venues' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: name })).toContainText('Removed');
});

test('the keeper rings a bell, writes a Codex page in Mongolian, and both stand in the audit log', async ({
  page,
}) => {
  await page.goto('/square');
  await page.getByLabel('Name').fill(E2E_ADMIN.username);
  await page.getByLabel('Word').fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: 'Enter' }).click();
  await expect(page.getByRole('heading', { name: 'Gatherings' })).toBeVisible();

  const bell = `The Bell ${Date.now() % 100000}`;
  await page.getByRole('button', { name: 'Ring a new bell' }).click();
  await page.getByLabel('Name of the bell').fill(bell);
  const at = new Date(Date.now() + 3 * 86_400_000);
  const local = new Date(at.getTime() - at.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  await page.getByLabel('When (your local time)').fill(local);
  await page.getByRole('button', { name: 'Ring the bell' }).click();
  await expect(page.getByRole('row').filter({ hasText: bell })).toContainText('Open');
  await expect(page.getByRole('heading', { name: 'Festival calendar' })).toBeVisible();

  await page.getByRole('link', { name: 'Codex pages' }).click();
  await expect(page.getByRole('heading', { name: 'The Codex' })).toBeVisible();
  const first = page.locator('tr[data-codex]').first();
  await expect(first).toContainText('Published'); // the first pages are seeded in both languages
  await first.getByRole('link').click();
  await page.getByRole('tab', { name: 'Mongolian' }).click();
  await page.getByLabel('Title (Mongolian)').fill('Гал ба хүйтэн');
  await page.getByLabel('Body (Mongolian)').fill('Бие');
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByRole('status')).toHaveText('Published.');

  await page.getByRole('link', { name: 'Audit log' }).click();
  await expect(page.getByRole('heading', { name: 'What the keepers did' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'A bell was rung' })).toHaveCount(1);
  await expect(page.getByRole('row').filter({ hasText: 'Codex page saved' })).toHaveCount(1);
});

test('a character pays on the web page, a second payment waits on the keepers, and is refunded', async ({
  page,
  request,
}) => {
  const u = await signUp(request, `Guild ${Date.now() % 100000}`);
  await createProfile(request, u);
  // The web serves finished characters only; the dev seeder would upload portraits, so the
  // character is marked finished directly in the throwaway database.
  finishInDb(u.accountId);

  await page.goto('/guild/');
  await page.getByLabel('Phone number').fill(u.phone);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Climb the Guild House' })).toBeVisible({ timeout: 10_000 });

  const made = page.waitForResponse(
    (r) => r.url().endsWith('/guild/invoices') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /Pay 29,430₮ with QPay/ }).click();
  const invoice = await (await made).json();
  await expect(page.getByRole('heading', { name: 'Scan to pay' })).toBeVisible();

  // The bank app pays — twice.
  expect((await request.post(`${E2E_ENGINE}/dev/qpay/pay/${invoice.id}`)).ok()).toBe(true);
  expect((await request.post(`${E2E_ENGINE}/dev/qpay/pay/${invoice.id}`)).ok()).toBe(true);
  await expect(page.getByRole('heading', { name: 'Welcome to the Hall' })).toBeVisible({ timeout: 10_000 });

  await page.goto('/');
  await page.getByLabel('Name').fill(E2E_ADMIN.username);
  await page.getByLabel('Word').fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: 'Enter' }).click();
  await page.getByRole('link', { name: 'Payments' }).click();
  await expect(page.getByRole('heading', { name: 'The coffers' })).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: 'Paid twice' });
  await expect(row).toBeVisible({ timeout: 5_000 });
  await row.getByRole('link', { name: 'Settle →' }).click();
  await page.getByRole('button', { name: /Refund 29,430₮/ }).click();
  await expect(page.getByRole('cell', { name: 'Refunded through QPay' })).toBeVisible({ timeout: 5_000 });
  await page.getByRole('link', { name: 'The coffers' }).click();
  await expect(page.getByText('Nothing waits on the keepers.')).toBeVisible();
});

function finishInDb(accountId: string) {
  const dev: string = JSON.parse(
    readFileSync('../mingldingl_engine/src/MinglDingl.Engine/appsettings.Development.json', 'utf8'),
  ).ConnectionStrings.Default;
  const part = (k: string) => new RegExp(`(?:^|;)\\s*${k}=([^;]*)`, 'i').exec(dev)?.[1] ?? '';
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
      'mingldingl_e2e',
      '-qc',
      `UPDATE profiles SET "WelcomedAt" = now() WHERE "AccountId" = '${accountId}'`,
    ],
    { env: { ...process.env, PGPASSWORD: part('Password') } },
  );
}

test('the keeper reads the dashboard, every statistics group with its CSV, deletions and the engine room', async ({
  page,
  request,
}) => {
  const u = await signUp(request, `Ledger ${Date.now() % 100000}`);
  await createProfile(request, u);

  await page.goto('/');
  await page.getByLabel('Name').fill(E2E_ADMIN.username);
  await page.getByLabel('Word').fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: 'Enter' }).click();
  await expect(page.getByRole('heading', { name: 'The hold tonight' })).toBeVisible();
  await page.screenshot({ path: 'test-results/shots/dashboard.png' });

  await page.getByRole('link', { name: 'Analytics' }).click();
  await expect(page.getByRole('heading', { name: 'The ledger of the hold' })).toBeVisible();
  for (const group of ['Growth', 'Engagement', 'Matching', 'Encounters', 'Square', 'Money', 'Cohorts']) {
    await page.getByRole('link', { name: group, exact: true }).click();
    await expect(page.getByRole('link', { name: group, exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByRole('table')).toBeVisible();
    await page.screenshot({ path: `test-results/shots/stats-${group.toLowerCase()}.png`, fullPage: true });
  }
  await page.getByRole('link', { name: 'Growth', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'In the world' })).toBeVisible();
  const csv = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  expect((await csv).suggestedFilename()).toMatch(/^mingldingl-growth-.*\.csv$/);

  await page.getByLabel('Gender').selectOption('Female');
  await expect(page.getByRole('table')).toBeVisible();

  await page.getByRole('link', { name: 'Deletions' }).click();
  await expect(page.getByRole('heading', { name: 'Characters fading' })).toBeVisible();
  await page.getByRole('link', { name: 'Ops' }).click();
  await expect(page.getByRole('heading', { name: 'The engine room' })).toBeVisible();
  await expect(page.getByText('Healthy')).toBeVisible();
  await page.screenshot({ path: 'test-results/shots/ops.png' });
});
