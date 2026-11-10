import { test, expect } from '@playwright/test';

test('direction rush hub appears and game fits viewport', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
  // Wait for hydrated content
  await page.waitForSelector('[data-testid^="hub-card-"]', { timeout: 15000 });
  // Check for game cards
  const cards = page.locator('[data-testid^="hub-card-"]');
  const count = await cards.count();
  console.log('Hub cards count:', count);
  // Check for direction-rush specifically
  const dirCard = page.locator('[data-testid="hub-card-direction-rush"]');
  const dirExists = await dirCard.count() > 0;
  console.log('direction-rush card exists:', dirExists);
  expect(dirExists).toBe(true);

  await dirCard.getByRole('button', { name: 'Play' }).click();
  await page.waitForURL('/direction-rush', { timeout: 10000 });
  await expect(page).toHaveURL('/direction-rush');
  console.log('Navigated to direction-rush successfully');

  // Verify D-Pad controls are visible
  await expect(page.getByTestId('btn-up')).toBeVisible();
  await expect(page.getByTestId('btn-left')).toBeVisible();
  await expect(page.getByTestId('btn-right')).toBeVisible();
  await expect(page.getByTestId('btn-down')).toBeVisible();

  // Verify page does not overflow vertically
  const isScrollable = await page.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight + 1,
  );
  expect(isScrollable).toBe(false);

  // Verify all buttons are within visible viewport
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  const downBox = await page.getByTestId('btn-down').boundingBox();
  expect(downBox).not.toBeNull();
  if (downBox) {
    expect(downBox.y + downBox.height).toBeLessThanOrEqual(viewportHeight);
  }

  // Click an answer button
  await page.getByTestId('btn-up').click();
  await page.waitForTimeout(300);
});

test('direction rush is responsive and fits short tablet landscape viewports', async ({ page }) => {
  // Test short landscape viewport like 800x550 (similar to user screenshot)
  await page.setViewportSize({ width: 800, height: 550 });
  await page.goto('/direction-rush');
  await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

  await expect(page.getByTestId('btn-up')).toBeVisible();
  await expect(page.getByTestId('btn-down')).toBeVisible();

  const isScrollable = await page.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight + 1,
  );
  expect(isScrollable).toBe(false);

  const viewportHeight = await page.evaluate(() => window.innerHeight);
  const downBox = await page.getByTestId('btn-down').boundingBox();
  expect(downBox).not.toBeNull();
  if (downBox) {
    expect(downBox.y + downBox.height).toBeLessThanOrEqual(viewportHeight);
  }
});

test('direction rush expands game arena on large desktop viewports', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/direction-rush');
  await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

  await expect(page.getByTestId('btn-down')).toBeVisible();

  const isScrollable = await page.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight + 1,
  );
  expect(isScrollable).toBe(false);

  const downBox = await page.getByTestId('btn-down').boundingBox();
  expect(downBox).not.toBeNull();
  if (downBox) {
    expect(downBox.y + downBox.height).toBeLessThanOrEqual(900);
  }
});
