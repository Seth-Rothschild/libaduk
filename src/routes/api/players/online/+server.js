import { json } from '@sveltejs/kit';
import { getOnlinePlayers, getConnectedGames } from '$lib/server/rooms.js';
import { hasViewers } from '$lib/server/tvRoom.js';

export async function GET() {
  return json({ ...getOnlinePlayers(), games: getConnectedGames(), tvActive: hasViewers() });
}
