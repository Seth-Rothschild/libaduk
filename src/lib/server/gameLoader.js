import { getGame, getChat, getNote } from './db.js';

const SENTINEL_NAMES = new Set(['black', 'white']);

export async function loadGameData(gameId, username) {
  const raw = await getGame(gameId);
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

  const chatEntries = await getChat(gameId);
  const chat = chatEntries.map(({ user, text }) => ({ user, text }));
  const note = username ? await getNote(gameId, username) : '';

  return { game, viewerColor, chat, note };
}
