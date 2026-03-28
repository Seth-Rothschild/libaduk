import { json } from '@sveltejs/kit';
import { getDailyPuzzle } from '$lib/server/db.js';

export async function GET() {
  const puzzle = await getDailyPuzzle();
  return json(puzzle);
}
