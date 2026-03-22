import { json } from '@sveltejs/kit';
import * as db from '$lib/server/db.js';

export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const { gameId, winner, result } = body;
  if (!gameId || !winner) return json({ error: 'missing fields' }, { status: 400 });

  await db.updateGame(gameId, {
    status: 'finished',
    winner,
    result,
    endedAt: Date.now()
  });

  return json({ ok: true });
}
