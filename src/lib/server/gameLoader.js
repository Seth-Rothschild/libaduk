import { getGame, getChat, getNote } from './db.js';

const SENTINEL_NAMES = new Set(['black', 'white']);

export function loadGameData(gameId, username) {
	const raw = getGame(gameId);
	if (!raw) return null;

	const blackName = SENTINEL_NAMES.has(raw.blackName) ? null : (raw.blackName ?? null);
	const whiteName = SENTINEL_NAMES.has(raw.whiteName) ? null : (raw.whiteName ?? null);
	const game = { ...raw, blackName, whiteName };

	let viewerColor = null;
	if (username && blackName === username) {
		viewerColor = 'black';
	} else if (username && whiteName === username) {
		viewerColor = 'white';
	}

	const chat = getChat(gameId).map(({ user, text }) => ({ user, text }));
	const note = username ? getNote(gameId, username) : '';

	return { game, viewerColor, chat, note };
}
