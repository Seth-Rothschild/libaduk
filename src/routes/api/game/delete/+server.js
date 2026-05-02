import { json, error } from '@sveltejs/kit';
import { getGame, deleteGame } from '$lib/server/db.js';

export async function POST({ request, locals }) {
  const username = locals.user?.username;
  if (!username) throw error(401, 'Not logged in');

  const { gameId } = await request.json();

  const game = await getGame(gameId);
  if (!game) throw error(404, 'Game not found');
  if (game.gameType !== 'uploaded') throw error(403, 'Only imported games can be deleted');
  if (!game.owners.includes(username)) throw error(403, 'Not authorized');

  await deleteGame(gameId);
  return json({ ok: true });
}
