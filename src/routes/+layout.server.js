import { getDailyPuzzle } from '$lib/server/db.js';

export async function load({ locals }) {
  let dailyPuzzle = null;
  try {
    dailyPuzzle = await getDailyPuzzle();
  } catch {
    // DB unavailable — lobby will skip the miniboard
  }
  return { user: locals.user, dailyPuzzle };
}
