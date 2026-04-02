import { json } from '@sveltejs/kit';
import { joinGame, broadcast } from '$lib/server/rooms.js';

export async function POST({ request, locals }) {
  const body = await request.json().catch(() => ({}));
  const gameId = body.gameId;
  const joinerName = locals.user?.username ?? body.joinerName ?? null;
  if (!gameId || !joinerName) return json({ error: 'missing fields' }, { status: 400 });

  const result = await joinGame(gameId, joinerName, !!locals.user);
  if (!result) return json({ error: 'cannot join' }, { status: 400 });

  return json({ color: result.color });
}
