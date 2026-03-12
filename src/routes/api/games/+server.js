import { json } from '@sveltejs/kit';
import { getPendingGames, getUserGames } from '$lib/server/rooms.js';

export async function GET({ url }) {
	const username = url.searchParams.get('username');
	if (username) {
		return json(getUserGames(username));
	}
	return json(getPendingGames());
}
