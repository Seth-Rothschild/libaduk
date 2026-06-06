import { json } from '@sveltejs/kit';
import { getOnlinePlayers, getConnectedGames } from '$lib/server/rooms.js';

export async function GET() {
  return json({ ...getOnlinePlayers(), games: getConnectedGames() });
}
