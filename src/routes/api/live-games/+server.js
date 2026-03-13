import { json } from '@sveltejs/kit';
import { getAllActiveGames } from '$lib/server/db.js';

export async function GET() {
	const games = getAllActiveGames()
		.slice(0, 5)
		.map((g) => ({
			id: g.id,
			black: g.blackName,
			white: g.whiteName,
			moveCount: g.moves.length
		}));
	return json(games);
}
