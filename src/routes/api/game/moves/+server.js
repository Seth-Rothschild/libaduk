import { json } from '@sveltejs/kit';
import { updateGame } from '$lib/server/db.js';

export async function POST({ request }) {
  const { gameId, moves } = await request.json();
  await updateGame(gameId, { moves });
  return json({ ok: true });
}
