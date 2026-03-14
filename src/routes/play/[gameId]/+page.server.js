import { error } from '@sveltejs/kit';
import { loadGameData } from '$lib/server/gameLoader.js';

export function load({ locals, params }) {
	const username = locals.user?.username ?? null;
	const result = loadGameData(params.gameId, username);
	if (!result) throw error(404, 'Game not found');
	return {
		user: locals.user,
		game: result.game,
		viewerColor: result.viewerColor,
		chat: result.chat,
		note: result.note
	};
}
