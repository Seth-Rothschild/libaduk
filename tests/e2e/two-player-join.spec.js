import { test, expect } from '@playwright/test';
import { createTestUser, sessionCookie } from './helpers.js';

test('two guests are matched into the same 9x9 game and can chat', async ({ browser }) => {
  const contextOne = await browser.newContext();
  const contextTwo = await browser.newContext();
  const playerOne = await contextOne.newPage();
  const playerTwo = await contextTwo.newPage();

  await playerOne.goto('/');
  await playerTwo.goto('/');

  await expect.poll(() => playerOne.evaluate(() => localStorage.getItem('guest-id'))).toBeTruthy();
  await expect.poll(() => playerTwo.evaluate(() => localStorage.getItem('guest-id'))).toBeTruthy();

  const guestIdOne = await playerOne.evaluate(() => localStorage.getItem('guest-id'));
  const guestIdTwo = await playerTwo.evaluate(() => localStorage.getItem('guest-id'));

  await playerOne.locator('.lpool', { hasText: '9×9' }).first().click();
  await expect(playerOne).toHaveURL(/\/play\//);
  const gameUrl = playerOne.url();

  await expect(playerOne.locator('.ruser name', { hasText: guestIdOne })).toBeVisible();

  await playerTwo.locator('.lpool', { hasText: '9×9' }).first().click();
  await expect(playerTwo).toHaveURL(gameUrl);

  await expect(playerTwo.locator('.ruser name', { hasText: guestIdOne })).toBeVisible();
  await expect(playerTwo.locator('.ruser name', { hasText: guestIdTwo })).toBeVisible();

  // Player one sends a chat message
  const chatInputOne = playerOne.locator('.mchat__say');
  await chatInputOne.fill('hello from player one');
  await chatInputOne.press('Enter');

  await expect(playerOne.locator('.mchat__messages t', { hasText: 'hello from player one' })).toBeVisible();
  await expect(playerTwo.locator('.mchat__messages t', { hasText: 'hello from player one' })).toBeVisible();

  // Player two sends a reply
  const chatInputTwo = playerTwo.locator('.mchat__say');
  await chatInputTwo.fill('hello from player two');
  await chatInputTwo.press('Enter');

  await expect(playerTwo.locator('.mchat__messages t', { hasText: 'hello from player two' })).toBeVisible();
  await expect(playerOne.locator('.mchat__messages t', { hasText: 'hello from player two' })).toBeVisible();

  // A third user navigates directly to the game as a spectator
  const contextThree = await browser.newContext();
  const spectator = await contextThree.newPage();
  await spectator.goto(gameUrl);

  await expect.poll(() => spectator.evaluate(() => localStorage.getItem('guest-id'))).toBeTruthy();
  const guestIdThree = await spectator.evaluate(() => localStorage.getItem('guest-id'));

  await expect(spectator.locator('.ruser name', { hasText: guestIdOne })).toBeVisible();
  await expect(spectator.locator('.ruser name', { hasText: guestIdTwo })).toBeVisible();
  await expect(spectator.locator('.ruser name', { hasText: guestIdThree })).not.toBeVisible();

  // Spectator sends a chat message
  const chatInputThree = spectator.locator('.mchat__say');
  await chatInputThree.fill('hello from spectator');
  await chatInputThree.press('Enter');

  await expect(spectator.locator('.mchat__messages t', { hasText: 'hello from spectator' })).toBeVisible();
  await expect(playerOne.locator('.mchat__messages t', { hasText: 'hello from spectator' })).toBeVisible();
  await expect(playerTwo.locator('.mchat__messages t', { hasText: 'hello from spectator' })).toBeVisible();

  await contextThree.close();
});

test('signed-in user plays against a guest', async ({ browser }) => {
  const baseURL = 'http://localhost:5173';
  const token = await createTestUser('AlphaPlayer');

  const contextOne = await browser.newContext();
  await contextOne.addCookies([sessionCookie(token, baseURL)]);
  const playerOne = await contextOne.newPage();

  const contextTwo = await browser.newContext();
  const playerTwo = await contextTwo.newPage();

  await playerOne.goto('/');
  await playerTwo.goto('/');

  await expect.poll(() => playerTwo.evaluate(() => localStorage.getItem('guest-id'))).toBeTruthy();
  const guestId = await playerTwo.evaluate(() => localStorage.getItem('guest-id'));

  await playerOne.locator('.lpool', { hasText: '9×9' }).first().click();
  await expect(playerOne).toHaveURL(/\/play\//);
  const gameUrl = playerOne.url();

  await expect(playerOne.locator('.ruser name', { hasText: 'AlphaPlayer' })).toBeVisible();

  await playerTwo.locator('.lpool', { hasText: '9×9' }).first().click();
  await expect(playerTwo).toHaveURL(gameUrl);

  await expect(playerTwo.locator('.ruser name', { hasText: 'AlphaPlayer' })).toBeVisible();
  await expect(playerTwo.locator('.ruser name', { hasText: guestId })).toBeVisible();
});

test('presence icon turns red when opponent disconnects, green when they reconnect', async ({ browser }) => {
  const contextOne = await browser.newContext();
  const contextTwo = await browser.newContext();
  const playerOne = await contextOne.newPage();
  const playerTwo = await contextTwo.newPage();

  await playerOne.goto('/');
  await expect.poll(() => playerOne.evaluate(() => localStorage.getItem('guest-id'))).toBeTruthy();
  await playerOne.locator('.lobby__start__button--friend').click();

  const modal = playerOne.locator('dialog.game-setup');
  await modal.locator('.size-choice', { hasText: '9×9' }).click();
  await modal.locator('button', { hasText: 'Unlimited' }).click();
  await modal.locator('.color-choice .black').click();
  await modal.locator('.lobby__start__button--friend').click();

  await expect(playerOne).toHaveURL(/\/play\//);
  const gameUrl = playerOne.url();

  await playerTwo.goto(gameUrl);
  const joinModal = playerTwo.locator('dialog.join-game-modal');
  await joinModal.locator('button', { hasText: 'Join game' }).click();
  await expect(joinModal).not.toBeVisible();

  await expect(playerTwo.locator('[data-testid="presence-black"].online')).toBeVisible();
  await expect(playerTwo.locator('[data-testid="presence-white"].online')).toBeVisible();

  await playerOne.goto('/');

  await expect(playerTwo.locator('[data-testid="presence-black"].offline')).toBeVisible();
  await expect(playerTwo.locator('[data-testid="presence-white"].online')).toBeVisible();

  await playerOne.goto(gameUrl);

  await expect(playerTwo.locator('[data-testid="presence-black"].online')).toBeVisible();
});

test('two signed-in users are matched', async ({ browser }) => {
  const baseURL = 'http://localhost:5173';
  const tokenA = await createTestUser('BetaPlayer');
  const tokenB = await createTestUser('GammaPlayer');

  const contextOne = await browser.newContext();
  await contextOne.addCookies([sessionCookie(tokenA, baseURL)]);
  const playerOne = await contextOne.newPage();

  const contextTwo = await browser.newContext();
  await contextTwo.addCookies([sessionCookie(tokenB, baseURL)]);
  const playerTwo = await contextTwo.newPage();

  await playerOne.goto('/');
  await playerTwo.goto('/');

  const poolOne = playerOne.locator('.lpool', { hasText: '9×9' }).first();
  const poolTwo = playerTwo.locator('.lpool', { hasText: '9×9' }).first();
  await expect(poolOne).toBeVisible();
  await expect(poolTwo).toBeVisible();

  await poolOne.click();
  await expect(playerOne).toHaveURL(/\/play\//);
  const gameUrl = playerOne.url();

  await expect(playerOne.locator('.ruser name', { hasText: 'BetaPlayer' })).toBeVisible();

  await poolTwo.click();
  await expect(playerTwo).toHaveURL(gameUrl);

  await expect(playerTwo.locator('.ruser name', { hasText: 'BetaPlayer' })).toBeVisible();
  await expect(playerTwo.locator('.ruser name', { hasText: 'GammaPlayer' })).toBeVisible();
});

test('creator sees opponent name after opponent joins', async ({ browser }) => {
  const contextOne = await browser.newContext();
  const contextTwo = await browser.newContext();
  const playerOne = await contextOne.newPage();
  const playerTwo = await contextTwo.newPage();

  await playerOne.goto('/');
  await playerTwo.goto('/');

  await expect.poll(() => playerOne.evaluate(() => localStorage.getItem('guest-id'))).toBeTruthy();
  await expect.poll(() => playerTwo.evaluate(() => localStorage.getItem('guest-id'))).toBeTruthy();

  const guestIdOne = await playerOne.evaluate(() => localStorage.getItem('guest-id'));
  const guestIdTwo = await playerTwo.evaluate(() => localStorage.getItem('guest-id'));

  await playerOne.locator('.lpool', { hasText: '9×9' }).first().click();
  await expect(playerOne).toHaveURL(/\/play\//);

  // Wait for player one's own presence dot — this means their WebSocket has connected
  // and the server has added them to the game room. It's now safe for player two to
  // click, because the `joined` broadcast will reach player one's socket.
  await expect(playerOne.locator('.presence.online')).toHaveCount(1);

  await playerTwo.locator('.lpool', { hasText: '9×9' }).first().click();
  await expect(playerTwo).toHaveURL(/\/play\//);

  // Player one's strip should now show both names
  await expect(playerOne.locator('.ruser name', { hasText: guestIdOne })).toBeVisible();
  await expect(playerOne.locator('.ruser name', { hasText: guestIdTwo })).toBeVisible();
});
