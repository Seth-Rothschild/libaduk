import { json, error } from '@sveltejs/kit';
import { getGame } from '$lib/server/db.js';

export async function GET({ params }) {
  const game = await getGame(params.gameId);
  if (!game) throw error(404, 'Game not found');
  return json(game);
}
