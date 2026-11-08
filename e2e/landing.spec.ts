import { test as baseTest, expect } from '@playwright/test';
import { shots, isPageScrollable } from './helpers';

baseTest.describe('Landing Page & Arcade Boot Experience', () => {
  baseTest('renders animated landing screen on /landing and enters arcade on click', async ({
    page,
  }, testInfo) => {
    await page.goto('/landing');

    const landingScreen = page.getByTestId('landing-screen');
    await expect(landingScreen).toBeVisible();

    // Verify key elements
    await expect(page.getByRole('heading', { name: /ARCADE HUB/i })).toBeVisible();
    await expect(page.getByText('SYS.ID // ARCADE-OS v2.4')).toBeVisible();
    await expect(page.getByText(/BOOT TELEMETRY/i)).toBeVisible();

    const enterBtn = page.getByRole('button', { name: /ENTER ARCADE/i });
    await expect(enterBtn).toBeVisible();

    // Ensure page has no vertical scroll overflow
    await page.waitForTimeout(400);
    expect(await isPageScrollable(page)).toBe(false);

    // Capture screenshot of fully animated landing
    await page.screenshot({ path: shots(testInfo.project.name, 'landing') });

    // Click Enter Arcade
    await enterBtn.click();

    // Navigates to Hub
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('hub-card-tictactoe')).toBeVisible();
  });

  baseTest('shows landing overlay on cold boot of / and can replay via Title Screen button', async ({
    browser,
  }) => {
    // Fresh context without arcade_has_booted in sessionStorage
    const freshContext = await browser.newContext();
    const page = await freshContext.newPage();

    await page.goto('/');

    // Landing screen overlay should be visible
    const landingScreen = page.getByTestId('landing-screen');
    await expect(landingScreen).toBeVisible();

    // Click Skip Intro
    const skipBtn = page.getByRole('button', { name: /Skip to games/i });
    await expect(skipBtn).toBeVisible();
    await skipBtn.click();

    // Overlay is dismissed, Hub is active
    await expect(landingScreen).toBeHidden({ timeout: 2000 });
    await expect(page.getByTestId('hub-card-tictactoe')).toBeVisible();

    // Replay Title Screen via footer button
    const replayBtn = page.getByRole('button', { name: /Title Screen/i });
    await expect(replayBtn).toBeVisible();
    await replayBtn.click();

    // Landing overlay appears again
    await expect(page.getByTestId('landing-screen')).toBeVisible();

    await freshContext.close();
  });
});
