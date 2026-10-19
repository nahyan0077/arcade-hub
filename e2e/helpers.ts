import { expect, type Page } from '@playwright/test';

export function shots(projectName: string, step: string): string {
  return `e2e/screenshots/${projectName}-${step}.png`;
}

export async function isPageScrollable(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight + 1,
  );
}

export async function createRoom(page: Page, name: string): Promise<string> {
  await page.goto('/start');
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

export async function joinRoom(page: Page, name: string, code: string): Promise<void> {
  await page.goto('/start');
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
