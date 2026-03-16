import { json } from '@sveltejs/kit';
import { createRoom, findMatchingGame } from '$lib/server/rooms.js';

export async function POST({ request, locals }) {
  const body = await request.json().catch(() => ({}));
  const size = [9, 13, 19].includes(body.size) ? body.size : 19;
  const color = ['black', 'white', 'random'].includes(body.color) ? body.color : 'random';
  const timeControl = body.timeControl ?? { type: 'none' };
  const gameType = ['hook', 'friend', 'local'].includes(body.gameType) ? body.gameType : 'hook';
  const creatorName = locals.user?.username ?? null;

  if (gameType === 'hook' && timeControl.type !== 'none') {
    const match = await findMatchingGame(size, timeControl, creatorName);
    if (match) {
      return json({ gameId: match.id });
    }
  }

  const room = await createRoom(size, timeControl, color, gameType, creatorName);
  return json({ gameId: room.id });
}
