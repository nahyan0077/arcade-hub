import { expect, type Page } from '@playwright/test';
import { test, shots, newMutedContext, createRoom, joinRoom, isPageScrollable } from './helpers';

/**
 * Broad UI walkthrough: navigation, validation, lobby, all three games,
 * chat/emoji, leave/disconnect — desktop only.
 */
test.describe('UI walkthrough', () => {
  test('hub → all three games → start validation → lobby leave', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await expect(page.getByTestId('hub-card-tictactoe')).toBeVisible();
    await expect(page.getByTestId('hub-card-connect-four')).toBeVisible();
    await expect(page.getByTestId('hub-card-arrow-race')).toBeVisible();
    await expect(page.getByTestId('hub-card-dots-and-boxes')).toBeVisible();
    await expect(page.getByText('Coming soon')).toHaveCount(1);
    await page.screenshot({ path: shots('desktop', 'walk-hub') });

    // Validation: empty name
    await page.getByTestId('hub-card-tictactoe').getByRole('button', { name: 'Play' }).click();
    await expect(page).toHaveURL(/\/start/);
    await page.getByRole('button', { name: 'Start Game' }).click();
    await expect(page.getByText('Please Enter your name')).toBeVisible();

    // Create online room → lobby → leave
    await page.getByPlaceholder('Enter your name').fill('Walk');
    await page.getByRole('button', { name: 'Online' }).click();
    await page.getByRole('button', { name: 'Create Room' }).click();
    await page.getByRole('button', { name: 'Start Game' }).click();
    await expect(page).toHaveURL(/\/lobby/);
    await expect(page.getByTestId('lobby-status')).toHaveText(/Waiting for opponent/);
    await page.screenshot({ path: shots('desktop', 'walk-lobby') });
    await page.getByRole('button', { name: 'Leave' }).click();
    await expect(page).toHaveURL(/\/$/);

    // Direct route redirects
    await page.goto('/room');
    await expect(page).toHaveURL(/\/$/);
  });

  test('tictactoe 2P local: alternate turns, wrong-cell guard, draw board reset', async ({
    page,
  }, testInfo) => {
    await page.goto('/start');
    await page.getByPlaceholder('Enter your name').fill('Ann');
    await page.getByRole('button', { name: 'Play as X' }).click();
    await page.getByRole('button', { name: '2 Players' }).click();
    await page.getByRole('button', { name: 'Start Game' }).click();
    await expect(page).toHaveURL(/\/game/);

    const cell = (i: number) => page.getByRole('button', { name: new RegExp(`^cell ${i + 1}(,|$)`) });
    // X plays 0
    await cell(0).click();
    await expect(page.getByRole('status')).toHaveText("PLAYER 2's turn");
    // O plays 1
    await cell(1).click();
    await expect(page.getByRole('status')).toHaveText("ANN's turn");
    // Occupied cell is disabled
    await expect(cell(0)).toBeDisabled();
    // Hint
    await page.getByRole('button', { name: 'Hint' }).click();
    await expect(page.getByTestId('hint-cell')).toBeVisible();
    await page.getByRole('button', { name: 'Hint' }).click();
    await expect(page.getByTestId('hint-cell')).toHaveCount(0);
    await page.screenshot({ path: shots('desktop', 'walk-ttt-mid') });

    // Play to draw: 0,1,2,4,3,5,7,6,8
    for (const m of [2, 4, 3, 5, 7, 6, 8]) await cell(m).click();
    await expect(page.getByRole('status')).toHaveText("It's a draw!");
    // Result dialog overlays the controls — start a fresh match first
    await page.getByRole('dialog', { name: 'Game result' }).getByRole('button', { name: 'New Game' }).click();
    await expect(page.getByRole('dialog', { name: 'Game result' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Reset Scores' }).click();
    await expect(page.getByTestId('score-draws')).toHaveText('0');
    await expect(cell(0)).toBeEmpty();
  });

  test('connect-four 2P local: gravity, win line, rematch keeps score', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await page.getByTestId('hub-card-connect-four').getByRole('button', { name: 'Play' }).click();
    await page.getByPlaceholder('Enter your name').fill('Cara');
    await page.getByRole('button', { name: 'Start Game' }).click();
    await expect(page).toHaveURL(/\/connect-four/);

    const col = (i: number) => page.getByTestId(`c4-col-${i}`);
    // Vertical win for X in col 0: X O X O X O X
    for (const c of [0, 1, 0, 1, 0, 1, 0]) await col(c).click();
    await expect(page.getByRole('status')).toHaveText('CARA wins!');
    const dialog = page.getByRole('dialog', { name: 'Game result' });
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('score-x')).toHaveText(/1$/);
    await page.screenshot({ path: shots('desktop', 'walk-c4-win') });

    await dialog.getByRole('button', { name: 'Rematch' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByTestId('score-x')).toHaveText(/1$/);
    await expect(page.getByRole('status')).toHaveText("PLAYER 2's turn");
  });

  test('arrow-race vs AI: wrong answer awards AI, correct awards human', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await page.getByTestId('hub-card-arrow-race').getByRole('button', { name: 'Play' }).click();
    await expect(page).toHaveURL(/\/start/);
    // No 2 Players for race
    await expect(page.getByRole('button', { name: '2 Players' })).toHaveCount(0);
    await page.getByPlaceholder('Enter your name').fill('Ria');
    await page.getByRole('button', { name: 'Start Game' }).click();
    await expect(page).toHaveURL(/\/arrow-race/);

    await expect(page.getByTestId('race-arrow')).toBeVisible();
    const label = (await page.getByTestId('race-arrow').getAttribute('aria-label')) ?? '';
    const moving = /moving (up|down|left|right)/.exec(label)?.[1];
    expect(moving).toBeTruthy();
    const dirs = ['up', 'down', 'left', 'right'] as const;
    const wrong = dirs.find((d) => d !== moving)!;
    await page.getByTestId(`answer-${wrong}`).click();
    await expect(page.getByTestId('score-o')).toHaveText(/1/);
    await expect(page.getByRole('status')).toHaveText('Next round…');
    await page.screenshot({ path: shots('desktop', 'walk-race-wrong') });

    await expect(page.getByTestId('answer-up')).toBeEnabled({ timeout: 5000 });
    const label2 = (await page.getByTestId('race-arrow').getAttribute('aria-label')) ?? '';
    const moving2 = /moving (up|down|left|right)/.exec(label2)?.[1]!;
    await page.getByTestId(`answer-${moving2}`).click();
    await expect(page.getByTestId('score-x')).toHaveText(/1/);
  });

  test('online tictactoe: chat, emoji burst, leave → disconnect dialog', async ({
    browser,
  }, testInfo) => {
    const context = await newMutedContext(browser);
    const host = await context.newPage();
    const guest = await context.newPage();

    const code = await createRoom(host, 'Hana');
    await joinRoom(guest, 'Gus', code);

    await expect(host).toHaveURL(/\/room/);
    await expect(guest).toHaveURL(/\/room/);
    await expect(host.getByTestId('score-x')).toHaveText(/HANA/);
    await expect(host.getByTestId('score-o')).toHaveText(/GUS/);

    // Chat
    await host.getByTestId('chat-toggle').click();
    await guest.getByTestId('chat-toggle').click();
    await host.getByTestId('chat-input').fill('hi gus');
    await host.getByTestId('chat-send').click();
    await expect(guest.getByTestId('chat-messages')).toContainText('hi gus');

    // Quick emoji burst
    await host.getByTestId('quick-emoji-toggle').click();
    await host.getByRole('button', { name: 'react with 👀' }).click();
    await expect(host.getByTestId('emoji-burst').filter({ hasText: '👀' })).toBeVisible();
    await expect(guest.getByTestId('emoji-burst').filter({ hasText: '👀' })).toBeVisible();

    await host.getByRole('button', { name: 'Close chat panel' }).click();
    await guest.getByRole('button', { name: 'Close chat panel' }).click();

    // Guest leaves → host sees disconnect
    await guest.getByRole('button', { name: 'Leave Room' }).click();
    await expect(host.getByRole('dialog', { name: 'Opponent disconnected' })).toBeVisible();
    await host.getByRole('button', { name: 'Back to menu' }).click();
    await expect(host).toHaveURL(/\/$/);
    await pageScreenshot(host, testInfo, 'walk-disconnect');
    await context.close();
  });

  test('online arrow-race: wrong host answer scores guest', async ({ browser }, testInfo) => {
    const context = await newMutedContext(browser);
    const host = await context.newPage();
    const guest = await context.newPage();

    const code = await createRoom(host, 'Rae', 'arrow-race');
    await joinRoom(guest, 'Sam', code, 'arrow-race');
    await expect(host).toHaveURL(/\/room/);
    await expect(guest).toHaveURL(/\/room/);

    const label = (await host.getByTestId('race-arrow').getAttribute('aria-label')) ?? '';
    const moving = /moving (up|down|left|right)/.exec(label)?.[1]!;
    const dirs = ['up', 'down', 'left', 'right'] as const;
    const wrong = dirs.find((d) => d !== moving)!;
    await host.getByTestId(`answer-${wrong}`).click();

    await expect(host.getByTestId('score-o')).toHaveText(/1/);
    await expect(guest.getByTestId('score-o')).toHaveText(/1/);
    await host.screenshot({ path: shots('desktop', 'walk-race-online-wrong') });
    await context.close();
  });
});

async function pageScreenshot(page: Page, testInfo: { projectName: string }, step: string) {
  await page.screenshot({ path: shots(testInfo.projectName, step) });
}
