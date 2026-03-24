import { json } from '@sveltejs/kit';
import { getOnlinePlayers } from '$lib/server/rooms.js';

export async function GET() {
  return json(getOnlinePlayers());
}
