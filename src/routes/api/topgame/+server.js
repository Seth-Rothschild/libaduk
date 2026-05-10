import { json } from '@sveltejs/kit';
import * as tvRoom from '$lib/server/tvRoom.js';

export function GET() {
  return json({ gameId: tvRoom.getState().gameId });
}

export async function POST({ request }) {
  const { gameId, blackName, whiteName } = await request.json();
  if (gameId) tvRoom.setGame(gameId, { blackName, whiteName });
  return json({ ok: true });
}
