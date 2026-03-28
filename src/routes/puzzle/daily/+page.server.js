import { getDailyPuzzle } from '$lib/server/db.js';
import { error, redirect } from '@sveltejs/kit';

export async function load() {
  const puzzle = await getDailyPuzzle();
  if (!puzzle) throw error(404, 'No puzzles available');
  throw redirect(302, `/puzzle/${puzzle.id}`);
}
