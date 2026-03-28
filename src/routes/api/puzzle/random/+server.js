import { json } from '@sveltejs/kit';
import { getRandomPuzzle } from '$lib/server/db.js';

export async function GET() {
  const puzzle = await getRandomPuzzle();
  return json(puzzle);
}
