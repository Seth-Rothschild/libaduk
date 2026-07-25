import { json } from '@sveltejs/kit';
import { createGame, updateGame } from '$lib/server/db.js';
import { newNativeGamedata, packMoves } from '$lib/server/games/gamedata.js';

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

  const gamedata = newNativeGamedata({
    id,
    size,
    komi: komi ?? 6.5,
    handicap: (handicapStones ?? []).length,
    handicapStones: handicapStones ?? [],
    timeControl: { type: 'none' },
    blackName: blackName || 'Black',
    whiteName: whiteName || 'White',
    moves: packMoves(moves ?? []),
    phase: 'finished'
  });

  await createGame({
    id,
    gameType: 'uploaded',
    status: status || 'finished',
    owners,
    gamedata
  });

  if (analysisTree) {
    await updateGame(id, { analysisTree, analysisActive: true });
  }
  if (result) {
    await updateGame(id, { result });
  }

  return json({ id });
}
