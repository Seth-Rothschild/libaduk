import { test, expect } from '@playwright/test';

test('two players take turns placing stones and see each others moves', async ({ browser }) => {
  const contextOne = await browser.newContext();
  const contextTwo = await browser.newContext();
  const playerOne = await contextOne.newPage();
  const playerTwo = await contextTwo.newPage();

  // Player one creates a friend game as black on 9x9 unlimited
  await playerOne.goto('/');
  await expect.poll(() => playerOne.evaluate(() => localStorage.getItem('guest-id'))).toBeTruthy();
  await playerOne.locator('.lobby__start__button--friend').click();

  const modal = playerOne.locator('dialog.game-setup');
  await expect(modal).toBeVisible();

  await modal.locator('.size-choice', { hasText: '9×9' }).click();
  await modal.locator('button', { hasText: 'Unlimited' }).click();
  await modal.locator('.color-choice .black').click();
  await modal.locator('.lobby__start__button--friend').click();

  await playerOne.waitForURL(/\/play\//);
  const gameUrl = playerOne.url();

  // Player two opens the shared link and sees the join modal
  await playerTwo.goto(gameUrl);
  const joinModal = playerTwo.locator('dialog.join-game-modal');
  await expect(joinModal).toBeVisible();
  await expect(joinModal).toContainText('9×9');
  await expect(joinModal).toContainText('white');

  // Player two joins
  await joinModal.locator('button', { hasText: 'Join game' }).click();
  await expect(joinModal).not.toBeVisible();

  // Player one (black) plays at (2, 2)
  await playerOne.locator('[data-x="2"][data-y="2"]').click();
  await expect(playerOne.locator('[data-x="2"][data-y="2"] .go-stone')).toBeVisible();
  await expect(playerTwo.locator('[data-x="2"][data-y="2"] .go-stone')).toBeVisible();

  // Player one (black) tries to play again out of turn — should not work
  await playerOne.locator('[data-x="6"][data-y="6"]').click();
  await expect(playerOne.locator('[data-x="6"][data-y="6"] .go-stone')).not.toBeVisible();

  // Player two (white) plays at (4, 4)
  await playerTwo.locator('[data-x="4"][data-y="4"]').click();
  await expect(playerTwo.locator('[data-x="4"][data-y="4"] .go-stone')).toBeVisible();
  await expect(playerOne.locator('[data-x="4"][data-y="4"] .go-stone')).toBeVisible();

  // Player two (white) tries to play again out of turn — should not work
  await playerTwo.locator('[data-x="5"][data-y="5"]').click();
  await expect(playerTwo.locator('[data-x="5"][data-y="5"] .go-stone')).not.toBeVisible();
});

async function createAndJoinGame(browser) {
  const contextOne = await browser.newContext();
  const contextTwo = await browser.newContext();
  const black = await contextOne.newPage();
  const white = await contextTwo.newPage();

  await black.goto('/');
  await expect.poll(() => black.evaluate(() => localStorage.getItem('guest-id'))).toBeTruthy();
  await black.locator('.lobby__start__button--friend').click();

  const modal = black.locator('dialog.game-setup');
  await expect(modal).toBeVisible();
  await modal.locator('.size-choice', { hasText: '9×9' }).click();
  await modal.locator('button', { hasText: 'Unlimited' }).click();
  await modal.locator('.color-choice .black').click();
  await modal.locator('.lobby__start__button--friend').click();
  await black.waitForURL(/\/play\//);
  const gameUrl = black.url();

  await white.goto(gameUrl);
  const joinModal = white.locator('dialog.join-game-modal');
  await expect(joinModal).toBeVisible();
  await joinModal.locator('button', { hasText: 'Join game' }).click();
  await expect(joinModal).not.toBeVisible();

  return { black, white, gameUrl };
}

test('both players pass and enter scoring', async ({ browser }) => {
  const { black, white } = await createAndJoinGame(browser);

  // Play alternating stones down a column: B(0,3) W(0,4) B(1,3) W(1,4) ...
  for (let x = 0; x < 9; x++) {
    await black.locator(`[data-x="${x}"][data-y="3"]`).click();
    await expect(white.locator(`[data-x="${x}"][data-y="3"] .go-stone`)).toBeVisible();

    await white.locator(`[data-x="${x}"][data-y="4"]`).click();
    await expect(black.locator(`[data-x="${x}"][data-y="4"] .go-stone`)).toBeVisible();
  }

  // It's black's turn — pass button should be visible and enabled
  const blackPass = black.locator('button', { hasText: 'Pass' });
  await expect(blackPass).toBeVisible();
  await expect(blackPass).toBeEnabled();
  await blackPass.click();

  // Now it's white's turn — pass button should be visible and enabled
  const whitePass = white.locator('button', { hasText: 'Pass' });
  await expect(whitePass).toBeVisible();
  await expect(whitePass).toBeEnabled();
  await whitePass.click();

  // Both players should see scoring phase with the score displayed
  await expect(black.locator('.score-breakdown')).toContainText('White leads by 15.5');
  await expect(white.locator('.score-breakdown')).toContainText('White leads by 15.5');

  // Black accepts the score
  const blackAccept = black.locator('button', { hasText: 'Accept score' });
  await expect(blackAccept).toBeVisible();
  await blackAccept.click();

  // White accepts the score
  const whiteAccept = white.locator('button', { hasText: 'Accept score' });
  await expect(whiteAccept).toBeVisible();
  await whiteAccept.click();

  // Both players should see game over — white wins
  await expect(black.locator('.message')).toContainText('You lose');
  await expect(white.locator('.message')).toContainText('You win');

  // Wait for the finish POST to complete before a visitor loads the page
  await black.waitForTimeout(200);

  // A third user visits the completed game and sees the result
  const contextThree = await browser.newContext();
  const visitor = await contextThree.newPage();
  await visitor.goto(black.url());
  await expect(visitor.locator('.message')).toContainText('White wins');
  await expect(visitor.locator('.message')).toContainText('W+15.5');
});

test('black resigns and white wins by resignation', async ({ browser }) => {
  const { black, white } = await createAndJoinGame(browser);

  await black.locator('button', { hasText: 'Resign' }).click();

  await expect(black.locator('.message')).toContainText('You lose');
  await expect(black.locator('.message')).toContainText('by Resignation');
  await expect(white.locator('.message')).toContainText('You win');
  await expect(white.locator('.message')).toContainText('by Resignation');

  await black.waitForTimeout(200);

  const contextThree = await browser.newContext();
  const visitor = await contextThree.newPage();
  await visitor.goto(black.url());
  await expect(visitor.locator('.message')).toContainText('White wins');
  await expect(visitor.locator('.message')).toContainText('by Resignation');
});

async function playMovesAndResign(black, white) {
  await black.locator('[data-x="2"][data-y="2"]').click();
  await expect(white.locator('[data-x="2"][data-y="2"] .go-stone')).toBeVisible();

  await white.locator('[data-x="6"][data-y="6"]').click();
  await expect(black.locator('[data-x="6"][data-y="6"] .go-stone')).toBeVisible();

  await black.locator('[data-x="3"][data-y="3"]').click();
  await expect(white.locator('[data-x="3"][data-y="3"] .go-stone')).toBeVisible();

  await black.locator('button', { hasText: 'Resign' }).click();

  await expect(black.locator('.message')).toContainText('You lose');
  await expect(white.locator('.message')).toContainText('You win');
}

test('analysis board button appears after game ends', async ({ browser }) => {
  const { black, white } = await createAndJoinGame(browser);
  await playMovesAndResign(black, white);

  await expect(black.locator('button', { hasText: 'Analysis board' })).toBeVisible();
  await expect(white.locator('button', { hasText: 'Analysis board' })).toBeVisible();
});

test('analysis mode preserves game moves', async ({ browser }) => {
  const { black, white } = await createAndJoinGame(browser);
  await playMovesAndResign(black, white);

  await black.locator('button', { hasText: 'Analysis board' }).click();

  // The three stones from the game should still be on the board
  await expect(black.locator('[data-x="2"][data-y="2"] .go-stone')).toBeVisible();
  await expect(black.locator('[data-x="6"][data-y="6"] .go-stone')).toBeVisible();
  await expect(black.locator('[data-x="3"][data-y="3"] .go-stone')).toBeVisible();

  // The move list should show the three moves
  await expect(black.locator('.analysis-moves')).toBeVisible();
});

test('one player entering analysis puts both players into analysis', async ({ browser }) => {
  const { black, white } = await createAndJoinGame(browser);
  await playMovesAndResign(black, white);

  // Only black clicks the button
  await black.locator('button', { hasText: 'Analysis board' }).click();

  // Both players should see the analysis board
  await expect(black.locator('.analysis-moves')).toBeVisible();
  await expect(white.locator('.analysis-moves')).toBeVisible();
});

test('analysis moves are synced in real time', async ({ browser }) => {
  const { black, white } = await createAndJoinGame(browser);
  await playMovesAndResign(black, white);

  await black.locator('button', { hasText: 'Analysis board' }).click();
  await expect(white.locator('.analysis-moves')).toBeVisible();

  // White places an analysis move — both see it
  await white.locator('[data-x="4"][data-y="4"]').click();
  await expect(white.locator('[data-x="4"][data-y="4"] .go-stone')).toBeVisible();
  await expect(black.locator('[data-x="4"][data-y="4"] .go-stone')).toBeVisible();

  // Black places an analysis move — both see it
  await black.locator('[data-x="5"][data-y="5"]').click();
  await expect(black.locator('[data-x="5"][data-y="5"] .go-stone')).toBeVisible();
  await expect(white.locator('[data-x="5"][data-y="5"] .go-stone')).toBeVisible();
});

test('player who refreshes returns to analysis if others are in it', async ({ browser }) => {
  const { black, white, gameUrl } = await createAndJoinGame(browser);
  await playMovesAndResign(black, white);

  await black.locator('button', { hasText: 'Analysis board' }).click();
  await expect(white.locator('.analysis-moves')).toBeVisible();

  // Black adds an analysis move
  await black.locator('[data-x="4"][data-y="4"]').click();
  await expect(black.locator('[data-x="4"][data-y="4"] .go-stone')).toBeVisible();

  // Black refreshes — should come back into analysis automatically
  await black.goto(gameUrl);
  await expect(black.locator('.analysis-moves')).toBeVisible();
  await expect(black.locator('[data-x="4"][data-y="4"] .go-stone')).toBeVisible();
});

test('player who navigates away and back returns to analysis', async ({ browser }) => {
  const { black, white, gameUrl } = await createAndJoinGame(browser);
  await playMovesAndResign(black, white);

  await black.locator('button', { hasText: 'Analysis board' }).click();
  await expect(white.locator('.analysis-moves')).toBeVisible();

  // White adds an analysis move
  await white.locator('[data-x="4"][data-y="4"]').click();
  await expect(white.locator('[data-x="4"][data-y="4"] .go-stone')).toBeVisible();

  // White navigates away
  await white.goto('/');

  // White comes back — should be in analysis with the move visible
  await white.goto(gameUrl);
  await expect(white.locator('.analysis-moves')).toBeVisible();
  await expect(white.locator('[data-x="4"][data-y="4"] .go-stone')).toBeVisible();
});

test('clicking move in analysis move list syncs to other player', async ({ browser }) => {
  const { black, white } = await createAndJoinGame(browser);
  await playMovesAndResign(black, white);

  await black.locator('button', { hasText: 'Analysis board' }).click();
  await expect(white.locator('.analysis-moves')).toBeVisible();

  // White adds two analysis moves so there's a move to navigate back to
  await white.locator('[data-x="4"][data-y="4"]').click();
  await expect(black.locator('[data-x="4"][data-y="4"] .go-stone')).toBeVisible();

  await black.locator('[data-x="5"][data-y="5"]').click();
  await expect(white.locator('[data-x="5"][data-y="5"] .go-stone')).toBeVisible();

  // White clicks a move in the move list to navigate back — black should follow
  await white.locator('.move-entry').first().click();
  await expect(white.locator('[data-x="5"][data-y="5"] .go-stone')).not.toBeVisible();
  await expect(black.locator('[data-x="5"][data-y="5"] .go-stone')).not.toBeVisible();
});

test('re-clicking analysis board does not lose analysis state', async ({ browser }) => {
  const { black, white } = await createAndJoinGame(browser);
  await playMovesAndResign(black, white);

  await black.locator('button', { hasText: 'Analysis board' }).click();
  await expect(white.locator('.analysis-moves')).toBeVisible();

  // Add an analysis move
  await white.locator('[data-x="4"][data-y="4"]').click();
  await expect(black.locator('[data-x="4"][data-y="4"] .go-stone')).toBeVisible();

  // Black clicks analysis board again — should reload existing state, not reset
  await black.locator('button', { hasText: 'Analysis board' }).click();
  await expect(black.locator('[data-x="4"][data-y="4"] .go-stone')).toBeVisible();
});

async function createAndJoinTimedGame(browser) {
  const contextOne = await browser.newContext();
  const contextTwo = await browser.newContext();
  const black = await contextOne.newPage();
  const white = await contextTwo.newPage();

  await black.goto('/');
  await expect.poll(() => black.evaluate(() => localStorage.getItem('guest-id'))).toBeTruthy();
  await black.locator('.lobby__start__button--friend').click();

  const modal = black.locator('dialog.game-setup');
  await expect(modal).toBeVisible();
  await modal.locator('.size-choice', { hasText: '9×9' }).click();
  await modal.locator('button', { hasText: 'Byo-yomi' }).click();
  await modal.locator('.color-choice .black').click();
  await modal.locator('.lobby__start__button--friend').click();
  await black.waitForURL(/\/play\//);
  const gameUrl = black.url();

  await white.goto(gameUrl);
  const joinModal = white.locator('dialog.join-game-modal');
  await expect(joinModal).toBeVisible();
  await joinModal.locator('button', { hasText: 'Join game' }).click();
  await expect(joinModal).not.toBeVisible();

  return { black, white, gameUrl };
}

test('finished game clocks show final time on reload', async ({ browser }) => {
  const { black, white, gameUrl } = await createAndJoinTimedGame(browser);

  // Both players should see clocks
  await expect(black.locator('.rclock')).toHaveCount(2);

  // Black plays a move so clocks start ticking
  await black.locator('[data-x="2"][data-y="2"]').click();
  await expect(white.locator('[data-x="2"][data-y="2"] .go-stone')).toBeVisible();

  // White plays a move
  await white.locator('[data-x="4"][data-y="4"]').click();
  await expect(black.locator('[data-x="4"][data-y="4"] .go-stone')).toBeVisible();

  // Read the clock text before resigning
  const blackClockText = await black.locator('.rclock-bottom .time').textContent();

  // Black resigns
  await black.locator('button', { hasText: 'Resign' }).click();
  await expect(black.locator('.message')).toContainText('You lose');

  await black.waitForTimeout(200);

  // A visitor loads the finished game — clocks should not show the initial time
  const contextThree = await browser.newContext();
  const visitor = await contextThree.newPage();
  await visitor.goto(gameUrl);
  await expect(visitor.locator('.message')).toContainText('White wins');

  // The clocks should be visible and show the persisted final time
  await expect(visitor.locator('.rclock')).toHaveCount(2);
  const visitorClockTop = await visitor.locator('.rclock-top .time').textContent();
  const visitorClockBottom = await visitor.locator('.rclock-bottom .time').textContent();

  // At least one clock should differ from the initial time — both started at the same value,
  // but after moves were played, at least one side has elapsed time
  const bothShowInitial = visitorClockTop === visitorClockBottom;
  expect(bothShowInitial).toBe(false);
});

test('force resignation when opponent leaves', async ({ browser }) => {
  const { black, white, gameUrl } = await createAndJoinGame(browser);

  // Black navigates away
  await black.goto('/');

  // White sees the opponent is offline and a Force Resignation button appears
  await expect(white.locator('[data-testid="presence-black"].offline')).toBeVisible();
  await expect(white.locator('button', { hasText: 'Force Resignation' })).toBeVisible();

  await white.locator('button', { hasText: 'Force Resignation' }).click();

  await expect(white.locator('.message')).toContainText('You win');
  await expect(white.locator('.message')).toContainText('by Resignation');

  await white.waitForTimeout(200);

  const contextThree = await browser.newContext();
  const visitor = await contextThree.newPage();
  await visitor.goto(gameUrl);
  await expect(visitor.locator('.message')).toContainText('White wins');
  await expect(visitor.locator('.message')).toContainText('by Resignation');
});
