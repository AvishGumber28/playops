import { test, expect, request } from '@playwright/test';

const API_BASE = 'http://localhost:4000';
const PASSWORD = 'TestPass123!';

// Golden path 2: a Caretaker appoints a Secretary, and that Secretary
// creates a tournament - all through the real UI. Mirrors backend/test/
// golden-path.e2e-spec.ts, but this is the layer that actually proves
// the Caretaker's "Appoint Secretary" button and the Secretary's
// "Create Tournament" form are wired to those endpoints, not just that
// the endpoints themselves work.
//
// The appointee has to already belong to the hostel before a Caretaker
// can appoint them (FR-004) - that's arranged directly through the API
// below, same as backend/test/helpers/db.ts does for the Jest e2e suite,
// since picking a hostel is already covered end-to-end by
// auth-and-onboarding.spec.ts and re-driving it through the UI here
// would just slow this test down without covering anything new.
test('Caretaker appoints a Secretary, who then creates a tournament', async ({ page }) => {
  // Re-running this spec against an already-seeded hostel re-appoints
  // over whoever an earlier run left in the seat, which triggers a
  // confirm() the Caretaker UI shows before replacing them - accept it
  // unconditionally; it simply never fires when the seat is vacant.
  page.on('dialog', (dialog) => dialog.accept());

  const api = await request.newContext({ baseURL: API_BASE });
  const candidateEmail = `e2e.secretary.${Date.now()}@thapar.edu`;
  const candidateName = 'E2E Secretary Candidate';

  await api.post('/api/auth/signup', {
    data: { name: candidateName, email: candidateEmail, password: PASSWORD },
  });
  const loginRes = await api.post('/api/auth/login', {
    data: { email: candidateEmail, password: PASSWORD },
  });
  const { token: candidateToken } = await loginRes.json();

  const hostels: { id: string; code: string }[] = await (await api.get('/api/hostels')).json();
  const hostelA = hostels.find((h) => h.code === 'A');
  if (!hostelA) throw new Error('Seed data missing: Hostel A (Agira Hall) not found.');

  await api.post('/api/hostels/select', {
    headers: { Authorization: `Bearer ${candidateToken}` },
    data: { hostelId: hostelA.id },
  });

  // --- Caretaker logs in and appoints the candidate as Secretary ---
  await page.goto('/login');
  await page.getByRole('button', { name: 'Caretaker' }).click();
  await page.locator('#login-email').fill('ACaretaker@thapar.edu');
  await page.locator('#login-password').fill('changeme123');
  await page.getByRole('button', { name: /Log in/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('link', { name: 'Secretary' }).click();
  await expect(page).toHaveURL(/\/dashboard\/secretary$/);

  const secretaryCard = page.locator('text=Sports Secretary').locator('..').locator('..');
  await secretaryCard.getByRole('button', { name: /Appoint Secretary|Change Secretary/ }).click();
  await secretaryCard.getByPlaceholder('student@thapar.edu').fill(candidateEmail);
  await secretaryCard.getByRole('button', { name: 'Confirm' }).click();

  await expect(page.getByText(candidateEmail)).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);

  // --- The newly-appointed Secretary logs in and creates a tournament ---
  await page.getByRole('button', { name: 'Secretary' }).click();
  await page.locator('#login-email').fill(candidateEmail);
  await page.locator('#login-password').fill(PASSWORD);
  await page.getByRole('button', { name: /Log in/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('link', { name: 'Tournaments' }).click();
  await expect(page).toHaveURL(/\/dashboard\/secretary-tournaments$/);

  const tournamentName = `E2E Football Cup ${Date.now()}`;
  const deadline = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  await page.getByRole('button', { name: '+ Create Tournament' }).click();
  await page.locator('#t-name').fill(tournamentName);
  await page.locator('#t-sport').selectOption({ label: 'Football' });
  await page.locator('#t-deadline').fill(deadline);
  await page.getByRole('button', { name: 'Create tournament' }).click();

  const card = page.getByRole('heading', { name: tournamentName }).locator('../..');
  await expect(card).toBeVisible();
  await expect(card.getByText('Registration Open')).toBeVisible();

  await api.dispose();
});
