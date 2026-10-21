import { expect } from '@playwright/test';
import { test, newMutedContext, createRoom, joinRoom } from './helpers';

test.skip(!process.env.E2E_VOICE, 'requires a LiveKit server (run test:e2e:voice)');

test('two players join voice and see each other', async ({ browser }) => {
  const context = await newMutedContext(browser);
  const host = await context.newPage();
  const guest = await context.newPage();

    const code = await createRoom(host, 'ALICE');
    await joinRoom(guest, 'BOB', code);
    await expect(host).toHaveURL(/\/room/);

    await host.getByRole('button', { name: 'Join voice' }).click();
  await expect(host.getByTestId('voice-status')).toHaveText('1', {
    timeout: 15_000,
  });

  await guest.getByRole('button', { name: 'Join voice' }).click();
  await expect(guest.getByTestId('voice-status')).toHaveText('1', {
    timeout: 15_000,
  });
  await expect(host.getByTestId('voice-status')).toHaveText('2', {
    timeout: 15_000,
  });

  await host.getByRole('button', { name: 'Leave voice' }).click();
  await expect(host.getByRole('button', { name: 'Join voice' })).toBeVisible();
  await expect(guest.getByTestId('voice-status')).toHaveText('1', {
    timeout: 15_000,
  });

  await context.close();
});
