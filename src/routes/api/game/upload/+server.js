import { json } from '@sveltejs/kit';
import { createGame, updateGame } from '$lib/server/db.js';

export async function POST({ request }) {
  const {
    moves,
    analysisTree,
    blackName,
    whiteName,
    size,
    komi,
    result,
    username,
    handicapStones,
    status
  } = await request.json();

  const id = Math.random().toString(36).slice(2, 8);
  const owners = username ? [username] : [];

  await createGame({
    id,
    size,
    blackName: blackName || 'Black',
    whiteName: whiteName || 'White',
    gameType: 'uploaded',
    status: status || 'finished',
    komi: komi ?? 6.5,
    owners,
    handicapStones,
    timeControl: { type: 'none' }
  });

  await updateGame(id, { moves, analysisTree, analysisActive: true, result });

  return json({ id });
}
