import { json, error } from '@sveltejs/kit';
import { findGameByOgsId, createGame } from '$lib/server/db.js';

export async function POST({ request }) {
  const { ogsGameId } = await request.json();
  if (!ogsGameId) throw error(400, 'ogsGameId required');

  const ogsId = String(ogsGameId);

  const existing = await findGameByOgsId(ogsId);
  if (existing) return json({ id: existing });

  const id = Math.random().toString(36).slice(2, 8);

  await createGame({
    id,
    size: 19,
    blackName: null,
    whiteName: null,
    gameType: 'uploaded',
    status: 'playing',
    komi: 6.5,
    ogsGameId: ogsId,
    owners: [],
    timeControl: { type: 'none' }
  });

  return json({ id });
}
