import { json } from '@sveltejs/kit';
import { updateGame } from '$lib/server/db.js';
import { encodeMove } from '$lib/goban.js';

export async function POST({ request }) {
  const body = await request.json();
  const { gameId } = body;
  if (!gameId) return json({ error: 'missing gameId' }, { status: 400 });

  const patch = {};
  if ('blackName' in body) patch['gamedata.players.black.username'] = body.blackName;
  if ('whiteName' in body) patch['gamedata.players.white.username'] = body.whiteName;
  if ('komi' in body) patch['gamedata.komi'] = body.komi;
  if ('handicapStones' in body) {
    const handicapStones = body.handicapStones;
    patch['gamedata.initial_state.black'] = handicapStones
      .map(({ x, y }) => encodeMove(x, y))
      .join('');
    patch['gamedata.handicap'] = handicapStones.length;
    patch['gamedata.initial_player'] = handicapStones.length > 0 ? 'white' : 'black';
  }
  for (const field of ['result', 'winner', 'status']) {
    if (field in body) patch[field] = body[field];
  }
  if (body.status === 'finished') patch.endedAt = Date.now();

  await updateGame(gameId, patch);
  return json({ ok: true });
}
