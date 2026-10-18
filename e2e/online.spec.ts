import { test, expect, type Page } from '@playwright/test';

function shots(projectName: string, step: string): string {
  return `e2e/screenshots/${projectName}-${step}.png`;
}

async function isPageScrollable(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight + 1,
  );
}

async function createRoom(page: Page, name: string): Promise<string> {
  await page.goto('/');
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

async function joinRoom(page: Page, name: string, code: string): Promise<void> {
  await page.goto('/');
  await page.getByPlaceholder('Enter your name').fill(name);
  await page.getByRole('button', { name: 'Online' }).click();
  await page.getByRole('button', { name: 'Join Room' }).click();
  await page.getByRole('textbox', { name: 'Room code' }).fill(code);
  await page.getByRole('button', { name: 'Start Game' }).click();
  // Connected so fast the lobby may already be replaced by the room.
  await expect(page).toHaveURL(/\/(lobby|room)/);
}

function cell(page: Page, index: number) {
  return page.getByRole('button', { name: new RegExp(`^cell ${index + 1}(,|$)`) });
}

test.describe('online multiplayer', () => {
  test('create, join, play to a win, rematch, disconnect', async ({ browser }, testInfo) => {
    const context = await browser.newContext();
    const host = await context.newPage();
    const guest = await context.newPage();

    const code = await createRoom(host, 'Alice');
    await joinRoom(guest, 'Bob', code);

    await expect(host).toHaveURL(/\/room/);
    await expect(guest).toHaveURL(/\/room/);
    await expect(host.getByTestId('score-x')).toHaveText(/ALICE/);
    await expect(host.getByTestId('score-o')).toHaveText(/BOB/);
    await expect(guest.getByTestId('score-x')).toHaveText(/ALICE/);
    expect(await isPageScrollable(host)).toBe(false);
    await host.screenshot({ path: shots(testInfo.project.name, '10-online-room') });

    await expect(cell(guest, 0)).toBeDisabled();
    await cell(host, 0).click();
    await expect(cell(guest, 0)).toHaveText('X');
    await cell(guest, 4).click();
    await expect(cell(host, 4)).toHaveText('O');

    await cell(host, 1).click();
    await cell(guest, 3).click();
    await cell(host, 2).click();

    await expect(host.getByRole('status')).toHaveText('ALICE wins!');
    await expect(guest.getByRole('status')).toHaveText('ALICE wins!');
    await expect(host.getByRole('dialog', { name: 'Game result' })).toBeVisible();
    await expect(guest.getByRole('dialog', { name: 'Game result' })).toBeVisible();
    await expect(host.getByTestId('score-x')).toHaveText(/1$/);
    await host.screenshot({ path: shots(testInfo.project.name, '11-online-win') });

    await host
      .getByRole('dialog', { name: 'Game result' })
      .getByRole('button', { name: 'Rematch' })
      .click();
    await expect(host.getByRole('button', { name: 'Waiting…' })).toBeDisabled();
    await expect(cell(guest, 0)).toHaveText('X');

    await guest
      .getByRole('dialog', { name: 'Game result' })
      .getByRole('button', { name: 'Rematch' })
      .click();
    await expect(host.getByRole('dialog')).toHaveCount(0);
    await expect(guest.getByRole('dialog')).toHaveCount(0);
    await expect(cell(host, 0)).toBeEmpty();
    await expect(cell(guest, 0)).toBeEmpty();
    await expect(host.getByTestId('score-x')).toHaveText(/1$/);

    await guest.getByRole('button', { name: 'Leave Room' }).click();
    await expect(
      host.getByRole('dialog', { name: 'Opponent disconnected' }),
    ).toBeVisible();
    await host.getByRole('button', { name: 'Back to menu' }).click();
    await expect(host).toHaveURL(/\/$/);

    await context.close();
  });

  test('join with an unknown code returns to the menu', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('Enter your name').fill('Bob');
    await page.getByRole('button', { name: 'Online' }).click();
    await page.getByRole('button', { name: 'Join Room' }).click();
    await page.getByRole('textbox', { name: 'Room code' }).fill('ZZZZZZ');
    await page.getByRole('button', { name: 'Start Game' }).click();

    await expect(page).toHaveURL(/\/$/, { timeout: 6000 });
    await expect(page.getByText('Room not found or full')).toBeVisible();
  });
});
