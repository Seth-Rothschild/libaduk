import { test, expect } from '@playwright/test';

async function createTimedFriendGame(page, timeControl) {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('guest-id'))).toBeTruthy();
  const guestId = await page.evaluate(() => localStorage.getItem('guest-id'));

  const gameId = await page.evaluate(
    async ({ guestId, timeControl }) => {
      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          size: 9,
          timeControl,
          color: 'black',
          gameType: 'friend',
          creatorName: guestId
        })
      });
      return (await res.json()).gameId;
    },
    { guestId, timeControl }
  );

  return { gameId, guestId };
}

async function joinAsWhite(white, gameId) {
  await white.goto(`/play/${gameId}`);
  await expect.poll(() => white.evaluate(() => localStorage.getItem('guest-id'))).toBeTruthy();
  const joinModal = white.locator('dialog.join-game-modal');
  await expect(joinModal).toBeVisible();
  await joinModal.locator('button', { hasText: 'Join game' }).click();
  await expect(joinModal).not.toBeVisible();
}

test('clock does not start until both players join and first move is played', async ({
  browser
}) => {
  const contextOne = await browser.newContext();
  const contextTwo = await browser.newContext();
  const black = await contextOne.newPage();
  const white = await contextTwo.newPage();

  const timeControl = { type: 'byoyomi', initial: 0, periods: 1, periodTime: 5 };
  const { gameId } = await createTimedFriendGame(black, timeControl);

  await black.goto(`/play/${gameId}`);

  // Clocks should be visible but not running in waiting state
  const topClock = black.locator('.rclock-top');
  const bottomClock = black.locator('.rclock-bottom');
  await expect(topClock).toBeVisible();
  await expect(bottomClock).toBeVisible();
  await expect(topClock).not.toHaveClass(/running/);
  await expect(bottomClock).not.toHaveClass(/running/);

  // White joins
  await joinAsWhite(white, gameId);

  // After join but before first move, clocks should still not be running
  await black.waitForTimeout(300);
  await expect(black.locator('.rclock-top')).not.toHaveClass(/running/);
  await expect(black.locator('.rclock-bottom')).not.toHaveClass(/running/);

  // Black plays first move
  await black.locator('[data-x="2"][data-y="2"]').click();
  await expect(white.locator('[data-x="2"][data-y="2"] .go-stone')).toBeVisible();

  // Now it's white's turn — white's clock should be running
  // On black's screen: top clock is opponent (white) — should be running
  await expect(black.locator('.rclock-top')).toHaveClass(/running/);
  // Black's own clock should NOT be running
  await expect(black.locator('.rclock-bottom')).not.toHaveClass(/running/);
});

test('game ends on time when a player runs out of time', async ({ browser }) => {
  test.setTimeout(15000);

  const contextOne = await browser.newContext();
  const contextTwo = await browser.newContext();
  const black = await contextOne.newPage();
  const white = await contextTwo.newPage();

  const timeControl = { type: 'byoyomi', initial: 0, periods: 1, periodTime: 3 };
  const { gameId } = await createTimedFriendGame(black, timeControl);

  await black.goto(`/play/${gameId}`);
  await joinAsWhite(white, gameId);

  // Black plays first move — starts white's clock
  await black.locator('[data-x="2"][data-y="2"]').click();
  await expect(white.locator('[data-x="2"][data-y="2"] .go-stone')).toBeVisible();

  // White does nothing — wait for timeout
  // Both players should see game over
  await expect(black.locator('.message')).toContainText('You win', { timeout: 6000 });
  await expect(white.locator('.message')).toContainText('You lose');
});
