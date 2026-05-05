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

test('puzzle miniboard is visible on lobby', async ({ page }) => {
  await page.goto('/');

  const puzzleLink = page.locator('.lobby__puzzle');
  await expect(puzzleLink).toBeVisible();
  await expect(puzzleLink).toContainText('Puzzle of the day');
  await expect(puzzleLink.locator('.go-goban')).toBeVisible();
  await expect(puzzleLink).toContainText('Black to play');

  await puzzleLink.click();
  await page.waitForURL(/\/puzzle\//);
});
