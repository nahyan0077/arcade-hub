import { expect, type Page } from '@playwright/test';
import { test, shots, isPageScrollable } from './helpers';

function col(page: Page, index: number) {
  return page.getByTestId(`c4-col-${index}`);
}

function disc(page: Page, index: number) {
  return page.getByTestId(`c4-disc-${index}`);
}

async function startConnectFour(
  page: Page,
  options: { name?: string; mode?: 'pvp' | 'pve'; difficulty?: string } = {},
): Promise<void> {
  const { name = 'Alice', mode = 'pvp', difficulty = 'medium' } = options;
  await page.goto('/');
  await page
    .getByTestId('hub-card-connect-four')
    .getByRole('button', { name: 'Play' })
    .click();
  await expect(page).toHaveURL(/\/start/);
  await expect(page.getByText('CONNECT')).toBeVisible();
  await page.getByPlaceholder('Enter your name').fill(name);
  if (mode === 'pve') {
    await page.getByRole('button', { name: 'vs AI' }).click();
    await page.getByRole('button', { name: difficulty.toUpperCase() }).click();
  }
  await page.getByRole('button', { name: 'Start Game' }).click();
  await expect(page).toHaveURL(/\/connect-four/);
}

test('connect-four start screen fits viewport without scrolling', async ({ page }, testInfo) => {
  await page.goto('/');
  await page
    .getByTestId('hub-card-connect-four')
    .getByRole('button', { name: 'Play' })
    .click();
  await expect(page).toHaveURL(/\/start/);
  expect(await isPageScrollable(page)).toBe(false);
  await page.screenshot({ path: shots(testInfo.project.name, 'c4-start') });
});

test('local drop flow: turns, win dialog, and rematch', async ({ page }, testInfo) => {
  await startConnectFour(page);
  expect(await isPageScrollable(page)).toBe(false);

  await col(page, 0).click();
  await expect(disc(page, 0)).toBeVisible();
  await expect(page.getByRole('status')).toHaveText("PLAYER 2's turn");

  await col(page, 6).click();
  await expect(disc(page, 6)).toBeVisible();
  await expect(page.getByRole('status')).toHaveText("ALICE's turn");
  await page.screenshot({ path: shots(testInfo.project.name, 'c4-drops') });

  for (const c of [0, 1, 0, 1, 0]) {
    await col(page, c).click();
  }
  await expect(page.getByRole('status')).toHaveText('ALICE wins!');

  const dialog = page.getByRole('dialog', { name: 'Game result' });
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('score-x')).toHaveText(/1$/);
  await page.screenshot({ path: shots(testInfo.project.name, 'c4-win') });

  await dialog.getByRole('button', { name: 'Rematch' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('status')).toHaveText("PLAYER 2's turn");
  await expect(page.getByTestId('score-x')).toHaveText(/1$/);
  await page.screenshot({ path: shots(testInfo.project.name, 'c4-rematch') });
});

test('vs AI: SCOUT replies and a human loss is labeled', async ({ page }, testInfo) => {
  await startConnectFour(page, { mode: 'pve', difficulty: 'medium' });
  await expect(page.getByTestId('score-o')).toHaveText(/SCOUT/);

  const humanTurn = () =>
    expect(page.getByRole('status')).toHaveText("ALICE's turn");

  // X never threatens; medium SCOUT keeps stacking column 3 and wins.
  await col(page, 6).click();
  await expect(disc(page, 3)).toBeVisible();
  await humanTurn();

  await col(page, 5).click();
  await expect(disc(page, 10)).toBeVisible();
  await humanTurn();

  await col(page, 6).click();
  await expect(disc(page, 17)).toBeVisible();
  await humanTurn();

  await col(page, 4).click();
  await expect(page.getByRole('status')).toHaveText('You lose!');
  await expect(page.getByText('SCOUT wins')).toBeVisible();
  await page.screenshot({ path: shots(testInfo.project.name, 'c4-ai-loss') });

  const dialog = page.getByRole('dialog', { name: 'Game result' });
  await dialog.getByRole('button', { name: 'Rematch' }).click();
  await expect(dialog).not.toBeVisible();
});
