import { getGame } from './db.js';

export function loadGameData(gameId, username) {
	const game = getGame(gameId);
	if (!game) return null;

	let viewerColor = null;
	if (username && game.blackName === username) {
		viewerColor = 'black';
	} else if (username && game.whiteName === username) {
		viewerColor = 'white';
	}

	return { game, viewerColor };
}
