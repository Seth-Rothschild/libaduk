import { getGame, getChat, getNote } from './db.js';

const SENTINEL_NAMES = new Set(['black', 'white']);

export async function loadGameData(gameId, username, guestId = null) {
  const raw = await getGame(gameId);
  if (!raw) return null;

  const blackName = SENTINEL_NAMES.has(raw.blackName) ? null : (raw.blackName ?? null);
  const whiteName = SENTINEL_NAMES.has(raw.whiteName) ? null : (raw.whiteName ?? null);
  const game = { ...raw, blackName, whiteName };

  const identity = username ?? guestId;
  let viewerColor = null;
  if (identity && blackName === identity) {
    viewerColor = 'black';
  } else if (identity && whiteName === identity) {
    viewerColor = 'white';
  }

  const chatEntries = await getChat(gameId);
  const chat = chatEntries.map(({ user, text, t }) => ({ user, text, t }));
  const note = username ? await getNote(gameId, username) : '';

  return { game, viewerColor, chat, note };
}
