import { json } from '@sveltejs/kit';
import { createRoom, findMatchingGame, joinGame } from '$lib/server/rooms.js';

export async function POST({ request, locals }) {
  const body = await request.json().catch(() => ({}));
  const size = [9, 13, 19].includes(body.size) ? body.size : 19;
  const color = ['black', 'white', 'random'].includes(body.color) ? body.color : 'random';
  const timeControl = body.timeControl ?? { type: 'none' };
  const gameType = ['hook', 'friend', 'local', 'ai'].includes(body.gameType)
    ? body.gameType
    : 'hook';
  const creatorName = locals.user?.username ?? body.creatorName ?? null;
  const aiDifficulty = gameType === 'ai' ? Number(body.aiDifficulty) || 5 : null;
  const handicap =
    Number.isInteger(body.handicap) && body.handicap >= 0 && body.handicap <= 9 ? body.handicap : 0;
  const komi =
    typeof body.komi === 'number' && isFinite(body.komi) ? body.komi : handicap > 0 ? 0.5 : 6.5;

  if (gameType === 'hook') {
    const match = await findMatchingGame(size, timeControl, creatorName);
    if (match) {
      const joined = await joinGame(match.id, creatorName);
      if (joined) {
        return json({ gameId: joined.id });
      }
    }
  }

  const room = await createRoom(size, timeControl, color, gameType, creatorName, {
    aiDifficulty,
    komi,
    handicap
  });
  return json({ gameId: room.id });
}
