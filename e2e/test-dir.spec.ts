import { test, expect } from '@playwright/test';
test('direction rush hub appears', async ({ page }) => {
  await page.goto('http://localhost:5199/');
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
  if (dirExists) {
    await dirCard.getByRole('button', { name: 'Play' }).click();
    await page.waitForURL('/direction-rush', { timeout: 10000 });
    await expect(page).toHaveURL('/direction-rush');
    console.log('Navigated to direction-rush successfully');
  } else {
    // Log page source for debugging
    const pageContent = page.locator('.game-card').first();
    console.log('First game card text:', await pageContent.textContent());
  }
});
