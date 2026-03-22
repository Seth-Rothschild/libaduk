import { test, expect } from '@playwright/test';
import { createTestUser, sessionCookie } from './helpers.js';

test('two guests are matched into the same 9x9 game and can chat', async ({ browser }) => {
  const contextOne = await browser.newContext();
  const contextTwo = await browser.newContext();
  const playerOne = await contextOne.newPage();
  const playerTwo = await contextTwo.newPage();

  await playerOne.goto('/');
  await playerTwo.goto('/');

  const poolSelectorOne = playerOne.locator('.lpool', { hasText: '9×9' }).first();
  const poolSelectorTwo = playerTwo.locator('.lpool', { hasText: '9×9' }).first();

  await expect.poll(() => playerOne.evaluate(() => localStorage.getItem('guest-id'))).toBeTruthy();
  await expect.poll(() => playerTwo.evaluate(() => localStorage.getItem('guest-id'))).toBeTruthy();

  const guestIdOne = await playerOne.evaluate(() => localStorage.getItem('guest-id'));
  const guestIdTwo = await playerTwo.evaluate(() => localStorage.getItem('guest-id'));

  await poolSelectorOne.click();
  await playerOne.waitForURL(/\/play\//);
  const gameUrl = playerOne.url();

  const namesAfterCreate = await playerOne.locator('.ruser name').allTextContents();
  expect(namesAfterCreate).toContain(guestIdOne);

  await poolSelectorTwo.click();
  await playerTwo.waitForURL(/\/play\//);
  expect(playerTwo.url()).toBe(gameUrl);

  const namesTwo = await playerTwo.locator('.ruser name').allTextContents();
  expect(namesTwo).toContain(guestIdOne);
  expect(namesTwo).toContain(guestIdTwo);

  // Player one sends a chat message
  const chatInputOne = playerOne.locator('.mchat__say');
  await chatInputOne.fill('hello from player one');
  await chatInputOne.press('Enter');

  // Player one should see their own message immediately
  await expect(playerOne.locator('.mchat__messages t', { hasText: 'hello from player one' })).toBeVisible();

  // Player two should see player one's message
  await expect(playerTwo.locator('.mchat__messages t', { hasText: 'hello from player one' })).toBeVisible();

  // Player two sends a reply
  const chatInputTwo = playerTwo.locator('.mchat__say');
  await chatInputTwo.fill('hello from player two');
  await chatInputTwo.press('Enter');

  // Player two sees their own message
  await expect(playerTwo.locator('.mchat__messages t', { hasText: 'hello from player two' })).toBeVisible();

  // Player one sees player two's message
  await expect(playerOne.locator('.mchat__messages t', { hasText: 'hello from player two' })).toBeVisible();

  // A third user navigates directly to the game as a spectator
  const contextThree = await browser.newContext();
  const spectator = await contextThree.newPage();
  await spectator.goto(gameUrl);

  await expect.poll(() => spectator.evaluate(() => localStorage.getItem('guest-id'))).toBeTruthy();
  const guestIdThree = await spectator.evaluate(() => localStorage.getItem('guest-id'));

  // Spectator is not in either player seat
  const spectatorNames = await spectator.locator('.ruser name').allTextContents();
  expect(spectatorNames).not.toContain(guestIdThree);
  expect(spectatorNames).toContain(guestIdOne);
  expect(spectatorNames).toContain(guestIdTwo);

  // Spectator sends a chat message
  const chatInputThree = spectator.locator('.mchat__say');
  await chatInputThree.fill('hello from spectator');
  await chatInputThree.press('Enter');

  // All three see the spectator's message
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

  const poolOne = playerOne.locator('.lpool', { hasText: '9×9' }).first();
  await poolOne.click();
  await playerOne.waitForURL(/\/play\//);
  const gameUrl = playerOne.url();

  const namesAfterCreate = await playerOne.locator('.ruser name').allTextContents();
  expect(namesAfterCreate).toContain('AlphaPlayer');

  const poolTwo = playerTwo.locator('.lpool', { hasText: '9×9' }).first();
  await poolTwo.click();
  await playerTwo.waitForURL(/\/play\//);
  expect(playerTwo.url()).toBe(gameUrl);

  const namesTwo = await playerTwo.locator('.ruser name').allTextContents();
  expect(namesTwo).toContain('AlphaPlayer');
  expect(namesTwo).toContain(guestId);
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

  await playerOne.waitForURL(/\/play\//);
  const gameUrl = playerOne.url();

  await playerTwo.goto(gameUrl);
  const joinModal = playerTwo.locator('dialog.join-game-modal');
  await joinModal.locator('button', { hasText: 'Join game' }).click();
  await expect(joinModal).not.toBeVisible();

  // Both players are online
  await expect(playerTwo.locator('[data-testid="presence-black"].online')).toBeVisible();
  await expect(playerTwo.locator('[data-testid="presence-white"].online')).toBeVisible();

  // Player one (black) navigates away
  await playerOne.goto('/');

  // Player two sees black go offline
  await expect(playerTwo.locator('[data-testid="presence-black"].offline')).toBeVisible();
  await expect(playerTwo.locator('[data-testid="presence-white"].online')).toBeVisible();

  // Player one navigates back
  await playerOne.goto(gameUrl);

  // Player two sees black come back online
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
  await poolOne.click();
  await playerOne.waitForURL(/\/play\//);
  const gameUrl = playerOne.url();

  const namesAfterCreate = await playerOne.locator('.ruser name').allTextContents();
  expect(namesAfterCreate).toContain('BetaPlayer');

  const poolTwo = playerTwo.locator('.lpool', { hasText: '9×9' }).first();
  await poolTwo.click();
  await playerTwo.waitForURL(/\/play\//);
  expect(playerTwo.url()).toBe(gameUrl);

  const namesTwo = await playerTwo.locator('.ruser name').allTextContents();
  expect(namesTwo).toContain('BetaPlayer');
  expect(namesTwo).toContain('GammaPlayer');
});
