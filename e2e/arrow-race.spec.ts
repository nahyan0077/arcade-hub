import { expect, type Page } from '@playwright/test';
import {
  test,
  shots,
  isPageScrollable,
  createRoom,
  joinRoom,
  newMutedContext,
} from './helpers';

async function startArrowRace(
  page: Page,
  options: { name?: string; mode?: 'pve' | 'online'; difficulty?: string } = {},
): Promise<void> {
  const { name = 'Alice', mode = 'pve', difficulty = 'medium' } = options;
  await page.goto('/start?game=arrow-race');
  await expect(page.getByText('ARROW')).toBeVisible();
  const nameInput = page.getByPlaceholder('Enter your name');
  await nameInput.fill(name);
  await nameInput.blur();
  if (mode === 'pve') {
    await page.getByRole('button', { name: difficulty.toUpperCase() }).click();
  } else {
    await page.getByRole('button', { name: 'Online' }).click();
  }
  await page.getByRole('button', { name: 'Start Game' }).click();
  await expect(page).toHaveURL(/\/arrow-race/);
}

async function answerFromLabel(page: Page): Promise<string> {
  const label = await page.getByTestId('race-arrow').getAttribute('aria-label');
  const match = /moving (up|down|left|right)/.exec(label ?? '');
  if (!match) throw new Error(`no moving direction in: ${label}`);
  return match[1];
}

test('arrow-race start screen fits viewport without scrolling', async ({ page }, testInfo) => {
  await page.goto('/');
  await page
    .getByTestId('hub-card-arrow-race')
    .getByRole('button', { name: 'Play' })
    .click();
  await expect(page).toHaveURL(/\/start/);
  expect(await isPageScrollable(page)).toBe(false);
  await page.screenshot({ path: shots(testInfo.project.name, 'race-start') });
});

test('local vs AI: answer the slide, score, and next round', async ({ page }, testInfo) => {
  await startArrowRace(page);
  expect(await isPageScrollable(page)).toBe(false);

  await expect(page.getByTestId('race-arrow')).toBeVisible();
  await expect(page.getByTestId('score-x')).toHaveText(/0/);
  await expect(page.getByRole('status')).toHaveText(/answer the slide|racing/i);

  const dir = await answerFromLabel(page);
  await page.getByTestId(`answer-${dir}`).click();
  await expect(page.getByTestId('score-x')).toHaveText(/1/);
  await expect(page.getByRole('status')).toHaveText('Next round…');
  await page.screenshot({ path: shots(testInfo.project.name, 'race-score') });

  // Next round re-enables answers after the gap.
  await expect(page.getByTestId('answer-up')).toBeEnabled({ timeout: 5000 });
  await expect(page.getByTestId('race-arrow')).toBeVisible();
});

test('online arrow-race: both peers share the same stimulus and host decides', async ({
  browser,
}, testInfo) => {
  const context = await newMutedContext(browser);
  const page = await context.newPage();
  const guestPage = await context.newPage();

  const code = await createRoom(page, 'Alice', 'arrow-race');
  await expect(page).toHaveURL(/\/lobby/);
  await expect(page.getByTestId('lobby-status')).toHaveText(/Waiting for opponent/);

  await joinRoom(guestPage, 'Bob', code, 'arrow-race');
  await expect(guestPage).toHaveURL(/\/room/);
  await expect(page).toHaveURL(/\/room/);

  await expect(page.getByTestId('race-arrow')).toBeVisible();
  await expect(guestPage.getByTestId('race-arrow')).toBeVisible();

  const hostLabel = await page.getByTestId('race-arrow').getAttribute('aria-label');
  const guestLabel = await guestPage.getByTestId('race-arrow').getAttribute('aria-label');
  expect(hostLabel).toBe(guestLabel);

  const dir = await answerFromLabel(page);
  await page.getByTestId(`answer-${dir}`).click();

  await expect(page.getByTestId('score-x')).toHaveText(/1/);
  await expect(guestPage.getByTestId('score-x')).toHaveText(/1/);
  await page.screenshot({ path: shots(testInfo.project.name, 'race-online') });

  await context.close();
});
