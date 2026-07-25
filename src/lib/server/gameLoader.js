import { getGame, getChat, getNote } from './db.js';

export async function loadGameData(gameId, username, guestId = null) {
  const game = await getGame(gameId);
  if (!game) return null;

  const players = game.gamedata?.players;
  const identity = username ?? guestId;
  let viewerColor = null;
  if (identity && players?.black?.username === identity) {
    viewerColor = 'black';
  } else if (identity && players?.white?.username === identity) {
    viewerColor = 'white';
  }

  const chatLines = await getChat(gameId);
  const chat = chatLines.map((line) => ({
    user: line.username,
    text: line.body,
    t: line.date ? line.date * 1000 : null
  }));
  const note = username ? await getNote(gameId, username) : '';

  return { game, viewerColor, chat, note };
}
