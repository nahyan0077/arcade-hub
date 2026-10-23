import { test as base, expect, type Page, type Browser } from '@playwright/test';

export { expect };

const SOUND_MUTE_KEY = 'tic-tac-toe.muted.v1';
const MUTE_SOUND_INIT = `try { window.localStorage.setItem('${SOUND_MUTE_KEY}', 'true'); } catch {}`;

// Games would audibly blip on every click during test runs; seed the persisted
// mute flag before any app script runs. Tests that need sound opt out by
// creating their own context via browser.newContext().
export const test = base.extend({
  context: async ({ context }, run) => {
    await context.addInitScript(MUTE_SOUND_INIT);
    await run(context);
  },
});

export async function newMutedContext(browser: Browser) {
  const context = await browser.newContext();
  await context.addInitScript(MUTE_SOUND_INIT);
  return context;
}

export function shots(projectName: string, step: string): string {
  return `e2e/screenshots/${projectName}-${step}.png`;
}

export async function isPageScrollable(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight + 1,
  );
}

async function openStartForGame(page: Page, game: 'tictactoe' | 'connect-four') {
  if (game === 'tictactoe') {
    await page.goto('/start');
    return;
  }
  await page.goto('/');
  await page
    .getByTestId('hub-card-connect-four')
    .getByRole('button', { name: 'Play' })
    .click();
  await expect(page).toHaveURL(/\/start/);
}

export async function createRoom(
  page: Page,
  name: string,
  game: 'tictactoe' | 'connect-four' = 'tictactoe',
): Promise<string> {
  await openStartForGame(page, game);
  await page.getByPlaceholder('Enter your name').fill(name);
  await page.getByRole('button', { name: 'Online' }).click();
  await page.getByRole('button', { name: 'Create Room' }).click();
  await page.getByRole('button', { name: 'Start Game' }).click();
  await expect(page).toHaveURL(/\/lobby/);
  const codeButton = page.getByRole('button', { name: 'Copy room code' });
  await expect(codeButton).toBeVisible();
  const code = (await codeButton.innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);
  return code;
}

export async function joinRoom(
  page: Page,
  name: string,
  code: string,
  game: 'tictactoe' | 'connect-four' = 'tictactoe',
): Promise<void> {
  await openStartForGame(page, game);
  await page.getByPlaceholder('Enter your name').fill(name);
  await page.getByRole('button', { name: 'Online' }).click();
  await page.getByRole('button', { name: 'Join Room' }).click();
  await page.getByRole('textbox', { name: 'Room code' }).fill(code);
  await page.getByRole('button', { name: 'Start Game' }).click();
  // Connected so fast the lobby may already be replaced by the room.
  await expect(page).toHaveURL(/\/(lobby|room)/);
}

export function cell(page: Page, index: number) {
  return page.getByRole('button', { name: new RegExp(`^cell ${index + 1}(,|$)`) });
}
