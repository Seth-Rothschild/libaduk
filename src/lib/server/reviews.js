import * as db from './db.js';

export async function connectReview(reviewId) {
  const existing = await db.getReview(reviewId);
  if (existing) return existing;

  const game = await db.getGame(reviewId);
  const gameId = game ? reviewId : null;
  try {
    await db.createReview({ id: reviewId, gameId });
  } catch {
    return db.getReview(reviewId);
  }
  return db.getReview(reviewId);
}

export async function appendReviewEntry(reviewId, entry) {
  const { review_id, ...fields } = entry;
  const stored = { ...fields, ts: Date.now() };
  await db.appendReviewEntry(reviewId, stored);
  return stored;
}
