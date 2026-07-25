import { json } from '@sveltejs/kit';
import { updateGame } from '$lib/server/db.js';
import { packMoves } from '$lib/server/games/gamedata.js';

export async function POST({ request }) {
  const { gameId, moves } = await request.json();
  await updateGame(gameId, { 'gamedata.moves': packMoves(moves ?? []) });
  return json({ ok: true });
}
