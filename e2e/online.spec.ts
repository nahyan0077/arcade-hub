import { expect } from '@playwright/test';
import {
  test,
  newMutedContext,
  createRoom,
  joinRoom,
  cell,
  shots,
  isPageScrollable,
} from './helpers';

test.describe('online multiplayer', () => {
  test('create, join, play to a win, rematch, disconnect', async ({ browser }, testInfo) => {
    const context = await newMutedContext(browser);
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

    await host.getByTestId('chat-toggle').click();
    await guest.getByTestId('chat-toggle').click();
    await host.getByTestId('chat-input').fill('good game');
    await host.getByTestId('chat-send').click();
    await expect(guest.getByTestId('chat-messages')).toContainText('good game');
    await guest.getByRole('button', { name: 'send emoji 🔥' }).click();
    // Quick emojis no longer appear in chat log, only as bursts
    await expect(host.getByTestId('emoji-burst').filter({ hasText: '🔥' })).toBeVisible();
    await expect(guest.getByTestId('emoji-burst').filter({ hasText: '🔥' })).toBeVisible();

    await host.getByTestId('quick-emoji-toggle').click();
    await host.getByRole('button', { name: 'react with 👀' }).click();
    await expect(host.getByTestId('emoji-burst').filter({ hasText: '👀' })).toBeVisible();
    await expect(guest.getByTestId('emoji-burst').filter({ hasText: '👀' })).toBeVisible();

    await host.getByRole('button', { name: 'Close chat panel' }).click();
    await guest.getByRole('button', { name: 'Close chat panel' }).click();

    await cell(host, 1).click();
    await cell(guest, 3).click();
    await cell(host, 2).click();

    await expect(host.getByRole('status')).toHaveText('You win!');
    await expect(guest.getByRole('status')).toHaveText('You lose!');
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
    await page.goto('/start');
    await page.getByPlaceholder('Enter your name').fill('Bob');
    await page.getByRole('button', { name: 'Online' }).click();
    await page.getByRole('button', { name: 'Join Room' }).click();
    await page.getByRole('textbox', { name: 'Room code' }).fill('ZZZZZZ');
    await page.getByRole('button', { name: 'Start Game' }).click();

    await expect(page).toHaveURL(/\/$/, { timeout: 6000 });
    const rejectionMessage = process.env.VITE_WS_URL
      ? 'Room not found or full'
      : "Couldn't reach the host";
    await expect(page.getByText(rejectionMessage)).toBeVisible();
  });

  test('connect-four rooms: create, join, drop to a win, rematch', async ({ browser }, testInfo) => {
    const context = await newMutedContext(browser);
    const host = await context.newPage();
    const guest = await context.newPage();

    const code = await createRoom(host, 'Alice', 'connect-four');
    await joinRoom(guest, 'Bob', code, 'connect-four');

    await expect(host).toHaveURL(/\/room/);
    await expect(guest).toHaveURL(/\/room/);
    await expect(host.getByText('CONNECT')).toBeVisible();
    await expect(host.getByTestId('score-x')).toHaveText(/ALICE/);
    await expect(host.getByTestId('score-o')).toHaveText(/BOB/);
    expect(await isPageScrollable(host)).toBe(false);
    await host.screenshot({ path: shots(testInfo.project.name, 'c4-online-room') });

    const col = (page: typeof host, index: number) => page.getByTestId(`c4-col-${index}`);
    const disc = (page: typeof host, index: number) => page.getByTestId(`c4-disc-${index}`);

    // Guest is locked out while the host holds the turn.
    await expect(col(guest, 0)).toBeDisabled();
    await col(host, 0).click();
    await expect(disc(guest, 0)).toBeVisible();
    await expect(col(guest, 0)).not.toBeDisabled();
    await col(guest, 0).click();
    await expect(disc(host, 7)).toBeVisible(); // gravity stacked the O above the X

    // Host stacks column 0 to four while O fills column 1 (moves 3–8),
    // then host drops the winning disc on move 9.
    for (const c of [0, 1, 0, 1, 0, 1]) {
      const player = c === 0 ? host : guest;
      await col(player, c).click();
    }
    await col(host, 0).click();

    await expect(host.getByRole('status')).toHaveText('You win!');
    await expect(guest.getByRole('status')).toHaveText('You lose!');
    await expect(host.getByRole('dialog', { name: 'Game result' })).toBeVisible();
    await expect(guest.getByRole('dialog', { name: 'Game result' })).toBeVisible();
    await host.screenshot({ path: shots(testInfo.project.name, 'c4-online-win') });

    await host
      .getByRole('dialog', { name: 'Game result' })
      .getByRole('button', { name: 'Rematch' })
      .click();
    await expect(host.getByRole('button', { name: 'Waiting…' })).toBeDisabled();
    await guest
      .getByRole('dialog', { name: 'Game result' })
      .getByRole('button', { name: 'Rematch' })
      .click();
    await expect(host.getByRole('dialog')).toHaveCount(0);
    await expect(guest.getByRole('dialog')).toHaveCount(0);
    // The loser (guest, O) serves on restart.
    await expect(host.getByRole('status')).toHaveText(/^BOB's turn/);
    await expect(col(host, 0)).toBeDisabled();

    await guest.getByRole('button', { name: 'Leave Room' }).click();
    await expect(
      host.getByRole('dialog', { name: 'Opponent disconnected' }),
    ).toBeVisible();
    await host.getByRole('button', { name: 'Back to menu' }).click();
    await expect(host).toHaveURL(/\/$/);

    await context.close();
  });
});
