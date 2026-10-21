import { expect, type Page } from '@playwright/test';
import { test } from './helpers';

function shots(projectName: string, step: string): string {
  return `e2e/screenshots/${projectName}-${step}.png`;
}

async function startGame(page: Page, name = 'Alice'): Promise<void> {
  await page.goto('/start');
  await page.getByPlaceholder('Enter your name').fill(name);
  await page.getByRole('button', { name: 'Play as X' }).click();
  await page.getByRole('button', { name: 'Start Game' }).click();
  await expect(page).toHaveURL(/\/game/);
}

async function startPve(
  page: Page,
  options: { name?: string; mark?: 'X' | 'O'; difficulty?: string } = {},
): Promise<void> {
  const { name = 'Alice', mark = 'X', difficulty = 'medium' } = options;
  await page.goto('/start');
  await page.getByPlaceholder('Enter your name').fill(name);
  await page.getByRole('button', { name: `Play as ${mark}` }).click();
  await page.getByRole('button', { name: 'vs AI' }).click();
  await page.getByRole('button', { name: difficulty.toUpperCase() }).click();
  await page.getByRole('button', { name: 'Start Game' }).click();
  await expect(page).toHaveURL(/\/game/);
}

function cell(page: Page, index: number) {
  return page.getByRole('button', { name: new RegExp(`^cell ${index + 1}(,|$)`) });
}

function markCount(page: Page, mark: string) {
  return page.locator('span', { hasText: new RegExp(`^${mark}$`) }).count();
}

async function isPageScrollable(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight + 1,
  );
}

test('hub lists games and Play reaches the start screen', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByTestId('hub-card-tictactoe')).toBeVisible();
  await expect(page.getByTestId('hub-card-connect-four')).toBeVisible();
  await expect(page.getByText('Coming soon')).toHaveCount(2);
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page).toHaveURL(/\/start/);
  await expect(page.getByPlaceholder('Enter your name')).toBeVisible();
  await page.screenshot({ path: shots(testInfo.project.name, 'hub'), fullPage: true });
});

test('start screen fits viewport without scrolling', async ({ page }, testInfo) => {
  await page.goto('/start');
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
  await page.goto('/start');
  await page.getByRole('button', { name: 'Start Game' }).click();
  await expect(page.getByText('Please Enter your name')).toBeVisible();
  await expect(page).toHaveURL(/\/start/);
});

test('vs AI: shows personality, replies to the human, fits viewport', async ({ page }, testInfo) => {
  await startPve(page, { difficulty: 'medium' });

  await expect(page.getByTestId('score-o')).toHaveText(/SCOUT/);
  expect(await isPageScrollable(page)).toBe(false);

  await cell(page, 6).click();
  await expect.poll(() => markCount(page, 'O')).toBe(1);
  await expect(page.getByRole('status')).toHaveText("ALICE's turn");
  await page.screenshot({ path: shots(testInfo.project.name, '07-ai-reply') });
});

test('vs AI: AI moves first when human plays as O', async ({ page }) => {
  await startPve(page, { mark: 'O' });

  await expect.poll(() => markCount(page, 'X')).toBe(1);
  await expect(page.getByRole('status')).toHaveText("ALICE's turn");
});

test('vs AI: AI takes an available win', async ({ page }, testInfo) => {
  await startPve(page, { difficulty: 'medium' });

  await cell(page, 6).click();
  await expect.poll(() => markCount(page, 'O')).toBe(1);
  await cell(page, 0).click();
  await expect.poll(() => markCount(page, 'O')).toBe(2);
  await expect(cell(page, 3)).toHaveText('O');

  await cell(page, 1).click();
  await expect(page.getByRole('status')).toHaveText('SCOUT wins!');
  const dialog = page.getByRole('dialog', { name: 'Game result' });
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('score-o')).toHaveText(/1$/);
  await page.screenshot({ path: shots(testInfo.project.name, '08-ai-win') });
});

test('hint highlights the recommended cell', async ({ page }, testInfo) => {
  await startGame(page);

  await page.getByRole('button', { name: 'Hint' }).click();
  const hint = page.getByTestId('hint-cell');
  await expect(hint).toBeVisible();
  await expect(hint).toHaveAccessibleName(/^cell 1$/);
  await page.screenshot({ path: shots(testInfo.project.name, '09-hint') });

  await hint.click();
  await expect(hint).toBeVisible();
  await page.getByRole('button', { name: 'Hint' }).click();
  await expect(page.getByTestId('hint-cell')).toHaveCount(0);
});

test('mute silences sounds, unmute restores them, mute survives reload', async ({ browser }) => {
  // Sound is muted globally for tests; this one needs the default unmuted
  // state, so it opts out of the shared muted context fixture.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    (window as unknown as { __osc: number }).__osc = 0;
    const Orig = (window as unknown as { AudioContext: typeof AudioContext }).AudioContext;
    (window as unknown as { AudioContext: unknown }).AudioContext = class extends Orig {
      createOscillator() {
        (window as unknown as { __osc: number }).__osc += 1;
        return super.createOscillator();
      }
    };
    (window as unknown as { webkitAudioContext: unknown }).webkitAudioContext = (
      window as unknown as { AudioContext: unknown }
    ).AudioContext;
  });

  const oscCount = () =>
    page.evaluate(() => (window as unknown as { __osc: number }).__osc);

  await startGame(page);

  await cell(page, 0).click();
  await expect.poll(oscCount).toBeGreaterThan(0);
  const baseline = await oscCount();

  await page.getByRole('button', { name: 'Mute sound' }).click();
  await cell(page, 4).click();
  await cell(page, 8).click();
  expect(await oscCount()).toBe(baseline);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Unmute sound' })).toBeVisible();
  const baselineAfterReload = await oscCount();
  await cell(page, 2).click();
  expect(await oscCount()).toBe(baselineAfterReload);

  await page.getByRole('button', { name: 'Unmute sound' }).click();
  await cell(page, 6).click();
  await expect.poll(oscCount).toBeGreaterThan(baselineAfterReload);

  await context.close();
});