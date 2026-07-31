import { json } from '@sveltejs/kit';
import { updateGame } from '$lib/server/db.js';

export async function POST({ request }) {
  const body = await request.json();
  const { gameId } = body;
  if (!gameId) return json({ error: 'missing gameId' }, { status: 400 });

  const patch = {};
  for (const field of ['blackName', 'whiteName', 'komi', 'result', 'winner', 'status']) {
    if (field in body) patch[field] = body[field];
  }
  if (body.status === 'finished') patch.endedAt = Date.now();

  await updateGame(gameId, patch);
  return json({ ok: true });
}
