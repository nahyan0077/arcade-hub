import { test, expect, type Page } from '@playwright/test';
import { createRoom, joinRoom } from './helpers';

test.skip(
  !process.env.VITE_WS_URL,
  'Quick Play requires the WebSocket relay (run test:e2e:ws or test:e2e:cf)',
);

async function startQuickPlay(page: Page, name: string): Promise<void> {
  await page.goto('/start');
  await page.getByPlaceholder('Enter your name').fill(name);
  await page.getByRole('button', { name: 'Quick Play' }).click();
  await page.getByRole('button', { name: 'Start Game' }).click();
}

function cell(page: Page, index: number) {
  return page.getByRole('button', { name: new RegExp(`^cell ${index + 1}(,|$)`) });
}

test.describe('quick play matchmaking', () => {
  test('pairs two players into a live room', async ({ browser }, testInfo) => {
    const context = await browser.newContext();
    const first = await context.newPage();
    const second = await context.newPage();

    await startQuickPlay(first, 'ALICE');
    await expect(first).toHaveURL(/\/queue/);
    await expect(first.getByText('Finding an opponent…')).toBeVisible();

    // The second player matches instantly, so only assert the landing room.
    await startQuickPlay(second, 'BOB');
    await expect(second).toHaveURL(/\/(lobby|room)/, { timeout: 10_000 });
    await expect(first).toHaveURL(/\/(lobby|room)/, { timeout: 10_000 });

    await expect(first.getByTestId('score-x')).toBeVisible();
    await expect(second.getByTestId('score-x')).toBeVisible();

    const firstIsX = (await first.getByTestId('score-x').innerText()).includes('ALICE');
    const xPage = firstIsX ? first : second;
    const oPage = firstIsX ? second : first;
    const xName = firstIsX ? 'ALICE' : 'BOB';
    const oName = firstIsX ? 'BOB' : 'ALICE';

    await expect(xPage.getByTestId('score-x')).toHaveText(new RegExp(xName));
    await expect(xPage.getByTestId('score-o')).toHaveText(new RegExp(oName));

    await expect(cell(oPage, 0)).toBeDisabled();
    await cell(xPage, 0).click();
    await expect(cell(oPage, 0)).toHaveText('X');
    await cell(oPage, 4).click();
    await expect(cell(xPage, 4)).toHaveText('O');

    await cell(xPage, 1).click();
    await cell(oPage, 3).click();
    await cell(xPage, 2).click();

    await expect(xPage.getByRole('status')).toHaveText('You win!');
    await expect(oPage.getByRole('status')).toHaveText('You lose!');
    await xPage.screenshot({ path: `e2e/screenshots/${testInfo.project.name}-20-quickplay-win.png` });

    await context.close();
  });

  test('voice controls appear online and report unavailable without a LiveKit server', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const host = await context.newPage();
    const guest = await context.newPage();

    const code = await createRoom(host, 'ALICE');
    await joinRoom(guest, 'BOB', code);
    await expect(host).toHaveURL(/\/room/);

    const joinVoice = host.getByRole('button', { name: 'Join voice' });
    await expect(joinVoice).toBeVisible();
    await joinVoice.click();
    await expect(host.getByText('Voice unavailable')).toBeVisible();
    await expect(joinVoice).toBeVisible();

    await context.close();
  });
});
