import { getPuzzle } from '$lib/server/db.js';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
  const puzzle = await getPuzzle(params.puzzleId);
  if (!puzzle) throw error(404, 'Puzzle not found');
  return { puzzle };
}
