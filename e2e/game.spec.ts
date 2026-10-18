import { test, expect, type Page } from '@playwright/test';

function shots(projectName: string, step: string): string {
  return `e2e/screenshots/${projectName}-${step}.png`;
}

async function startGame(page: Page, name = 'Alice'): Promise<void> {
  await page.goto('/');
  await page.getByPlaceholder('Enter your name').fill(name);
  await page.getByRole('button', { name: 'Play as X' }).click();
  await page.getByRole('button', { name: 'Start Game' }).click();
  await expect(page).toHaveURL(/\/game/);
}

function cell(page: Page, index: number) {
  return page.getByRole('button', { name: new RegExp(`^cell ${index + 1}(,|$)`) });
}

async function isPageScrollable(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight + 1,
  );
}

test('start screen fits viewport without scrolling', async ({ page }, testInfo) => {
  await page.goto('/');
  expect(await isPageScrollable(page)).toBe(false);
  await page.screenshot({ path: shots(testInfo.project.name, '01-start') });
});

test('game screen fits viewport without scrolling', async ({ page }, testInfo) => {
  await startGame(page);
  expect(await isPageScrollable(page)).toBe(false);
  await page.screenshot({ path: shots(testInfo.project.name, '02-game') });
});

test('win flow: status, dialog, score and rematch', async ({ page }, testInfo) => {
  await startGame(page);
  for (const move of [0, 3, 1, 4, 2]) {
    await cell(page, move).click();
  }

  await expect(page.getByRole('status')).toHaveText('ALICE wins!');
  const dialog = page.getByRole('dialog', { name: 'Game result' });
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('score-x')).toHaveText(/1$/);
  await page.screenshot({ path: shots(testInfo.project.name, '03-win') });

  await dialog.getByRole('button', { name: 'Rematch' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(cell(page, 1)).toBeEmpty();
  await expect(page.getByTestId('score-x')).toHaveText(/1$/);
  await page.screenshot({ path: shots(testInfo.project.name, '04-rematch') });
});

test('draw flow and score survives reload', async ({ page }, testInfo) => {
  await startGame(page);
  for (const move of [0, 1, 2, 4, 3, 5, 7, 6, 8]) {
    await cell(page, move).click();
  }

  await expect(page.getByRole('status')).toHaveText("It's a draw!");
  await expect(page.getByTestId('score-draws')).toHaveText('1');
  await page.screenshot({ path: shots(testInfo.project.name, '05-draw') });

  await page.reload();
  await expect(page.getByTestId('score-draws')).toHaveText('1');
  await page.screenshot({ path: shots(testInfo.project.name, '06-reload') });

  await page.getByRole('button', { name: 'Reset Scores' }).click();
  await expect(page.getByTestId('score-draws')).toHaveText('0');
});

test('validation blocks empty start', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Game' }).click();
  await expect(page.getByText('Please Enter your name')).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});