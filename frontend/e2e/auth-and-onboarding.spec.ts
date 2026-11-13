import { test, expect } from '@playwright/test';

// Golden path 1: a brand-new visitor signs up, logs in, and picks their
// hostel - the one flow every other role-specific flow builds on top of.
// Mirrors backend/test/golden-path.e2e-spec.ts's setup half, but driven
// through the real signup/login forms instead of calling the API
// directly - this is what actually proves the forms are wired to those
// endpoints at all.
test('signup -> login -> select hostel -> lands on the student home', async ({ page }) => {
  const email = `e2e.student.${Date.now()}@thapar.edu`;
  const password = 'TestPass123!';
  const name = 'E2E Student';

  await page.goto('/signup');
  await page.locator('#name').fill(name);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByText('Account created')).toBeVisible();
  await page.getByRole('button', { name: 'Go to sign in' }).click();
  await expect(page).toHaveURL(/\/login$/);

  // The role tab defaults to Student - exactly what this fresh account is.
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: /Log in/ }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText('Select your hostel')).toBeVisible();

  await page.getByText('Agira Hall').click();
  await page.getByRole('button', { name: 'Confirm hostel' }).click();

  await expect(page.getByRole('heading', { name: /Agira Hall/ })).toBeVisible();
  await expect(page.getByText(`Welcome back, ${name}.`)).toBeVisible();
});

test('a wrong password is rejected with a visible error, not a silent failure', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#login-email').fill('nonexistent.user@thapar.edu');
  await page.locator('#login-password').fill('WrongPassword123!');
  await page.getByRole('button', { name: /Log in/ }).click();

  await expect(page.getByText('Invalid email or password.')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
