import { json } from '@sveltejs/kit';
import { getAllActiveGames } from '$lib/server/db.js';

export async function GET() {
  const games = (await getAllActiveGames()).slice(0, 5).map((g) => ({
    id: g.id,
    black: g.gamedata?.players?.black?.username ?? null,
    white: g.gamedata?.players?.white?.username ?? null,
    moveCount: (g.gamedata?.moves ?? []).length
  }));
  return json(games);
}
