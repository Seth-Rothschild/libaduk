import { getGame } from '$lib/server/db.js';

export function load({ url }) {
	const gameId = url.searchParams.get('game');
	if (!gameId) return { game: null };

	const game = getGame(gameId);
	if (!game) return { game: null };

	return {
		game: {
			size: game.size,
			moves: game.moves ?? []
		}
	};
}
