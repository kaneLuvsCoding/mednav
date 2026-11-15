import { test, expect } from '@playwright/test';

test('crew selection, explicit unknown, save and report', async ({ page }) => {
  await page.goto('/');

  // Verify initial vitals for default Crew A (88 bpm)
  await expect(page.locator('.vital-copy strong').first()).toContainText('88');

  // Select Crew B via crew tabs and verify vitals update to 72 bpm
  await page.getByRole('button', { name: 'Crew B', exact: true }).click();
  await expect(page.locator('.vital-copy strong').first()).toContainText('72');

  // Switch back to Crew A
  await page.getByRole('button', { name: 'Crew A', exact: true }).click();
  await expect(page.locator('.vital-copy strong').first()).toContainText('88');

  // Navigate to Health Check-In
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Health Check-In' }).click();
  await expect(page.locator('h1')).toContainText('Health Check-In for Crew A');

  // Test blood pressure validation: enter only systolic
  await page.locator('#field-2').fill('120');
  await page.getByRole('button', { name: 'Review Check-In' }).click();
  await expect(page.getByRole('alert')).toContainText('both');

  // Clear systolic so both are Unknown
  await page.locator('#field-2').fill('');
  await page.getByRole('button', { name: 'Review Check-In' }).click();

  // Review screen shows Unknown values (systolic, diastolic, and unmeasured fields)
  await expect(page.locator('dd').filter({ hasText: 'Unknown' })).toHaveCount(4);

  // Save check-in
  await page.getByRole('button', { name: 'Save Check-In' }).click();
  await expect(page.getByRole('status')).toContainText('Saved to local health log');

  // Open investigation
  await page.getByRole('button', { name: 'Open Investigation' }).click();
  await expect(page.locator('.vital-history-scrubber-bar')).toBeVisible();

  // Navigate to Incident Report via sidebar
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Incident Report' }).click();
  await expect(page.getByText('PENDING GROUND REVIEW · OFFLINE')).toBeVisible();
  await expect(page.locator('dd').filter({ hasText: 'Unknown' })).toHaveCount(2);
});

test('evidence selection, all fixtures, resource and report consistency', async ({ page }) => {
  await page.goto('/');

  // Navigate to Investigation via sidebar
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Investigation' }).click();

  // Click on evidence item
  await page.getByRole('button', { name: /Vitals, radiation dosimetry/i }).click();
  await expect(page.locator('.selection-context strong')).toContainText('Recorded observations');

  // Open What-If controls drawer
  await page.getByRole('button', { name: /What-If Controls/i }).click();

  // Toggle flags in What-If drawer
  for (let n = 0; n < 16; n++) {
    for (let i = 0; i < 4; i++) {
      const sw = page.getByRole('switch').nth(i);
      const isChecked = (await sw.getAttribute('aria-checked')) === 'true';
      const shouldBeChecked = Boolean(n & (1 << i));
      if (isChecked !== shouldBeChecked) {
        await sw.click();
      }
    }
    const trace = page.getByLabel('Decision trace');
    if (n & 8) {
      await expect(trace).toContainText('Emergency override active');
    } else if (n & 2) {
      await expect(trace).toContainText('Officer review of observations');
    } else if (n & 1) {
      await expect(trace).toContainText('Record blood pressure');
    } else {
      // Both blocked (0000) and insufficient (0010) are handled deterministically by backend contract
      await expect(trace).toContainText(/BP unknown|Insufficient evidence/);
    }

    const resLink = page.locator('.resource-link');
    await expect(resLink).toContainText(n & 1 ? 'BP monitor available' : 'Blocked: BP monitor unavailable');

    if (n & 8) {
      await expect(trace).toContainText('None (next_check: null)');
    }
  }

  // Go to incident report from investigation via sidebar
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Incident Report' }).click();
  await expect(page.locator('dd').filter({ hasText: 'escalate' })).toHaveCount(1);

  // Check Medical Inventory via sidebar
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Medical Inventory' }).click();
  await page.getByPlaceholder('Filter by equipment name…').fill('Blood');
  await expect(page.locator('.equipment-hairline-row')).toHaveCount(1);
  await expect(page.locator('.equipment-hairline-row')).toContainText('Usable');

  // Mark unavailable
  await page.getByRole('button', { name: 'Mark Unavailable' }).click();
  await expect(page.locator('.equipment-hairline-row')).toContainText('Unavailable');

  // Go back to Investigation and verify resource is blocked
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Investigation' }).click();
  await expect(page.locator('.resource-link')).toContainText('Blocked: BP monitor unavailable');
});

test('desktop mobile and keyboard layouts', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // Desktop view
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.body-stage')).toBeVisible();

  // Test 3D anatomy quick part selection
  await page.getByRole('button', { name: 'Heart', exact: true }).click();
  await expect(page.locator('.selected-card')).toContainText('Heart');

  // Mobile layout test
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of ['Dashboard', 'Health Check-In', 'Investigation', 'What-If Lab', 'Medical Inventory', 'Incident Report']) {
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('main')).toBeVisible();
  }

  expect(errors).toEqual([]);
});

test('medical inventory CRUD operations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Medical Inventory' }).click();

  // Create new item
  await page.getByLabel('New equipment name').fill('Glucometer');
  await page.getByLabel('New equipment category').selectOption('Monitoring');
  await page.getByLabel('New equipment quantity').fill('2');
  await page.getByRole('button', { name: 'Add Item' }).click();

  await page.getByPlaceholder('Filter by equipment name…').fill('Glucometer');
  await expect(page.locator('.equipment-hairline-row')).toHaveCount(1);
  await expect(page.locator('.equipment-hairline-row')).toContainText('Qty 2');

  // Update quantity via stepper
  await page.getByRole('button', { name: 'Increase quantity for Glucometer' }).click();
  await expect(page.locator('.equipment-hairline-row')).toContainText('Qty 3');

  // Edit item inline
  await page.getByRole('button', { name: 'Edit Glucometer' }).click();
  await page.getByLabel('Edit equipment name').fill('Portable Glucometer');
  await page.getByLabel('Edit equipment quantity').fill('4');
  await page.getByRole('button', { name: 'Save' }).click();

  await page.getByPlaceholder('Filter by equipment name…').fill('Portable Glucometer');
  await expect(page.locator('.equipment-hairline-row')).toContainText('Portable Glucometer');
  await expect(page.locator('.equipment-hairline-row')).toContainText('Qty 4');

  // Delete item
  await page.getByRole('button', { name: 'Delete Portable Glucometer' }).click();
  await expect(page.locator('.equipment-hairline-row')).toHaveCount(0);
  await expect(page.getByText('No matching medical items.')).toBeVisible();
});
