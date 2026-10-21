import { type APIRequestContext, expect, type Page, test } from '@playwright/test';
import { E2E_ADMIN, E2E_ENGINE, e2eSql } from '../playwright.config';

/** A name no earlier run has used. */
const stamp = (name: string) => `${name} ${Date.now() % 100000}`;
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Signs up a brand-new number the way the app does: start → check → complete. */
async function signUp(api: APIRequestContext, name: string, deviceKey?: string) {
  const phone = `99${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`;
  const start = await (await api.post(`${E2E_ENGINE}/auth/phone/start`, { data: { phone } })).json();
  // The fake WeSend's code is always 000000.
  const check = await (
    await api.post(`${E2E_ENGINE}/auth/phone/check`, {
      data: { verificationId: start.verificationId, code: '000000' },
    })
  ).json();
  expect(check.state).toBe('verified');
  const pairRes = await api.post(`${E2E_ENGINE}/auth/phone/complete`, {
    data: { verificationId: start.verificationId, deviceName: 'playwright', deviceKey },
  });
  expect(pairRes.ok()).toBe(true);
  const pair = await pairRes.json();
  return { phone, accountId: pair.accountId as string, token: pair.accessToken as string, name };
}

async function createProfile(api: APIRequestContext, u: { token: string; name: string }) {
  const res = await api.post(`${E2E_ENGINE}/me`, {
    headers: bearer(u.token),
    data: { name: u.name, birthDate: '1998-04-12', locale: 'en' },
  });
  expect(res.ok()).toBe(true);
}

/** Signs up and names a character (POST /me), as the app's first onboarding step does. */
async function newcomer(api: APIRequestContext, name: string, deviceKey?: string) {
  const u = await signUp(api, name, deviceKey);
  await createProfile(api, u);
  return u;
}

/**
 * Marks a character finished in the throwaway database: the web serves finished characters only,
 * and the dev seeder would upload portraits.
 */
const finish = (accountId: string) =>
  e2eSql(`UPDATE profiles SET "WelcomedAt" = now() WHERE "AccountId" = '${accountId}'`);

/** Opens the panel at `path` and signs the keeper in. */
async function enter(page: Page, path = '/') {
  await page.goto(path);
  await page.getByLabel('Name').fill(E2E_ADMIN.username);
  await page.getByLabel('Word').fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: 'Enter' }).click();
}

/** Fills a keeper's dialog that asks for a reason, and confirms it. */
async function withReason(page: Page, dialog: string, reason: string, confirm = dialog) {
  const d = page.getByRole('dialog', { name: dialog });
  await d.getByLabel('Reason (written in the audit log)').fill(reason);
  await d.getByRole('button', { name: confirm }).click();
}

/** Signs a character in on the Guild House web page by the fake WeSend code. */
async function guildSignIn(page: Page, phone: string) {
  await page.getByLabel('Phone number').fill(phone);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('The code').fill('000000');
}

test('keeper sees a sign-up live, opens it, and an out-of-bounds config write is refused', async ({
  page,
  request,
}) => {
  await enter(page);

  await page.getByRole('link', { name: 'Users' }).click();
  await expect(page.getByRole('heading', { name: 'Travellers' })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
  // the live connection is up before the sign-up happens
  await expect(page.getByTestId('live-state')).toHaveAttribute('data-state', 'live');

  const name = stamp('Тэмүүжин');
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
  const from = await newcomer(request, stamp('Saruul'));
  const against = await newcomer(request, stamp('Bold'));

  await enter(page, '/reports');
  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
  await expect(page.getByTestId('live-state')).toHaveAttribute('data-state', 'live');

  const res = await request.post(`${E2E_ENGINE}/reports`, {
    headers: bearer(from.token),
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
  await enter(page, '/venues');
  await expect(page.getByRole('heading', { name: 'Partner venues' })).toBeVisible();
  await expect(page.getByTestId('live-state')).toHaveAttribute('data-state', 'live');

  // another keeper's session adds a place
  const login = await (
    await request.post(`${E2E_ENGINE}/admin/auth/login`, {
      data: { username: E2E_ADMIN.username, password: E2E_ADMIN.password },
    })
  ).json();
  const name = stamp('Nomad Café');
  const created = await request.post(`${E2E_ENGINE}/admin/venues`, {
    headers: bearer(login.token),
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
  await page.getByLabel('Address', { exact: true }).fill('Seoul Street 7');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByLabel('Address', { exact: true })).toHaveValue('Seoul Street 7');

  await page.getByRole('button', { name: 'Take it off the list' }).click();
  await expect(page.getByRole('heading', { name: 'Partner venues' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: name })).toContainText('Removed');
});

test('the keeper rings a bell, writes a Codex page in Mongolian, and both stand in the audit log', async ({
  page,
}) => {
  await enter(page, '/square');
  await expect(page.getByRole('heading', { name: 'Gatherings' })).toBeVisible();

  const bell = stamp('The Bell');
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
  const u = await newcomer(request, stamp('Guild'));
  finish(u.accountId);

  await page.goto('/guild/?lang=en');
  await guildSignIn(page, u.phone);
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

  await enter(page);
  await page.getByRole('link', { name: 'Payments' }).click();
  await expect(page.getByRole('heading', { name: 'The coffers' })).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: 'Paid twice' });
  await expect(row).toBeVisible({ timeout: 5_000 });
  await row.getByRole('link', { name: 'Settle' }).click();
  await page.getByRole('button', { name: /Refund 29,430₮/ }).click();
  await expect(page.getByRole('cell', { name: 'Refunded through QPay' })).toBeVisible({ timeout: 5_000 });
  await page.getByRole('link', { name: 'The coffers' }).click();
  await expect(page.getByText('Nothing waits on the keepers.')).toBeVisible();
});

test("the web page opens in Mongolian and keeps the reader's language", async ({ page }) => {
  await page.goto('/guild/');
  await expect(page.getByRole('heading', { name: 'Наймааны өргөөнд ор' })).toBeVisible();
  await expect(page.getByLabel('Утасны дугаар')).toBeVisible();
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: 'Enter the Guild House' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Enter the Guild House' })).toBeVisible();
  await page.getByLabel('Phone number').fill('99000002');
  await page.getByRole('button', { name: 'Монгол хэл' }).click();
  await page.getByRole('button', { name: 'Үргэлжлүүлэх' }).click();
  await page.getByLabel('Код').fill('000000');
  await expect(page.getByRole('alert')).toHaveText(/Энэ дугаартай баатар алга/, { timeout: 10_000 });
});

test("the stores' web deletion link signs a character in and abandons it", async ({ page, request }) => {
  const u = await newcomer(request, stamp('Leave'));
  finish(u.accountId);

  await page.goto('/guild/?leave&lang=en');
  await expect(page.getByRole('heading', { name: 'Abandon your character' })).toBeVisible();
  await guildSignIn(page, u.phone);
  await expect(page.getByRole('heading', { name: `Abandon ${u.name}?` })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Abandon', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'The character is abandoned' })).toBeVisible();

  const me = await (await request.get(`${E2E_ENGINE}/me`, { headers: bearer(u.token) })).json();
  expect(me.deleteAt).toBeTruthy();
});

test('the keeper reads the dashboard, every statistics group with its CSV, deletions and the engine room', async ({
  page,
  request,
}) => {
  await newcomer(request, stamp('Ledger'));

  await enter(page);
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

test('the keeper gives a floor, suspends with a reason, lifts it, and the audit log keeps the reasons', async ({
  page,
  request,
}) => {
  await enter(page);
  const name = stamp('Ариунаа');
  const u = await newcomer(request, name);
  // The sign-in lives in memory, so the record is opened from the list, not by its address.
  await page.getByRole('link', { name: 'Users' }).click();
  await page.locator(`tr[data-account-id="${u.accountId}"]`).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();

  await page.getByRole('button', { name: 'Give a floor' }).click();
  await page.getByRole('dialog', { name: 'Give a floor' }).getByLabel('Days').fill('14');
  await withReason(page, 'Give a floor', 'Play closed-test tester');
  await expect(page.getByText(/a gift from the keepers/)).toBeVisible();

  await page.getByRole('button', { name: 'Suspend' }).click();
  await withReason(page, `Suspend ${name}?`, 'Asked for money', 'Suspend');
  await expect(page.getByText(/Suspended on .* · Asked for money/)).toBeVisible();

  await page.getByRole('button', { name: 'Lift suspension' }).click();
  await withReason(page, 'Lift the suspension', 'Appeal heard');
  await expect(page.getByRole('button', { name: 'Suspend' })).toBeVisible();

  await page.getByRole('link', { name: 'Audit log' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Appeal heard' })).toContainText('Suspension lifted');
  await expect(page.getByRole('row').filter({ hasText: 'Asked for money' })).toContainText('Suspended');
});

test("a removed troll's number is barred, their phone flags the next character, and the keeper lifts the bar", async ({
  page,
  request,
}) => {
  await enter(page);
  const device = `pw-${Date.now()}`;
  const name = stamp('Тролль');
  const troll = await newcomer(request, name, device);

  await page.getByRole('link', { name: 'Users' }).click();
  await page.locator(`tr[data-account-id="${troll.accountId}"]`).click();
  await page.getByRole('button', { name: 'Suspend' }).click();
  await withReason(page, `Suspend ${name}?`, 'Trolled three women', 'Suspend');
  await expect(page.getByText(/Suspended on .* · Trolled three women/)).toBeVisible();
  await page.getByRole('button', { name: 'Delete now' }).click();
  await withReason(page, `Delete ${name} now?`, 'Removed', 'Delete now');
  await expect(page).toHaveURL(/\/users$/);

  // The same number gets no code; the same phone on a new number is flagged, not refused.
  const start = () => request.post(`${E2E_ENGINE}/auth/phone/start`, { data: { phone: troll.phone } });
  await expect.poll(async () => (await start()).status()).toBe(403);
  expect((await (await start()).json()).code).toBe('auth.barred');
  const next = await signUp(request, `${name} II`, device);
  await expect(page.locator(`tr[data-account-id="${next.accountId}"]`)).toContainText('shared device');

  await page.getByRole('link', { name: 'Reports' }).click();
  await page.getByRole('tab', { name: 'Barred numbers' }).click();
  const row = page.locator(`tr[data-barred="${troll.phone}"]`);
  await expect(row).toContainText('Trolled three women');
  await row.getByRole('button', { name: 'Lift' }).click();
  await withReason(page, 'Lift the bar', 'Appeal heard', 'Lift');
  await expect(row).toHaveCount(0);
  expect((await start()).ok()).toBe(true);
});
