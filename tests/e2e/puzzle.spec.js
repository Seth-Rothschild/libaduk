import { test, expect } from '@playwright/test';
import { TEST_PUZZLE_ID } from './helpers.js';

const puzzleUrl = `/puzzle/${TEST_PUZZLE_ID}`;

test('puzzle page loads with board and setup stones', async ({ page }) => {
  await page.goto(puzzleUrl);

  await expect(page.locator('.go-goban')).toBeVisible();
  await expect(page.locator('.puzzle__feedback')).toBeVisible();
  await expect(page.locator('.puzzle__feedback')).toContainText('Your turn');
  await expect(page.locator('.puzzle__feedback')).toContainText('white');

  // AW[je] = white stone at x=9, y=4
  await expect(page.locator('[data-x="9"][data-y="4"] .go-stone')).toBeVisible();
  // AB[nh] = black stone at x=13, y=7
  await expect(page.locator('[data-x="13"][data-y="7"] .go-stone')).toBeVisible();
});

test('wrong move shows failure feedback', async ({ page }) => {
  await page.goto(puzzleUrl);
  await expect(page.locator('.puzzle__feedback')).toContainText('Your turn');

  await page.locator('[data-x="0"][data-y="0"]').click();

  await expect(page.locator('.puzzle__feedback.fail')).toBeVisible();
  await expect(page.locator('.puzzle__feedback')).toContainText('not the move');
});

test('correct move shows success feedback', async ({ page }) => {
  await page.goto(puzzleUrl);
  await expect(page.locator('.puzzle__feedback')).toContainText('Your turn');

  // The solution is W[ke] = x=10, y=4
  await page.locator('[data-x="10"][data-y="4"]').click();

  await expect(page.locator('.puzzle__feedback')).toContainText('Puzzle complete');
});

test('can retry after wrong move', async ({ page }) => {
  await page.goto(puzzleUrl);

  // Wrong move
  await page.locator('[data-x="0"][data-y="0"]').click();
  await expect(page.locator('.puzzle__feedback.fail')).toBeVisible();

  // Correct move
  await page.locator('[data-x="10"][data-y="4"]').click();
  await expect(page.locator('.puzzle__feedback')).toContainText('Puzzle complete');
});

test('puzzle miniboard is visible on lobby', async ({ page }) => {
  await page.goto('/');

  const puzzleLink = page.locator('.lobby__puzzle');
  await expect(puzzleLink).toBeVisible();
  await expect(puzzleLink).toContainText('Puzzle of the day');
  await expect(puzzleLink.locator('.go-goban')).toBeVisible();
  await expect(puzzleLink).toContainText('White to play');

  await puzzleLink.click();
  await page.waitForURL(/\/puzzle\//);
});
