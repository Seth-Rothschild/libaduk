import * as db from './db.js';

const CHAT_CAP = 1000;

if (!global.__tvRoom) global.__tvRoom = { currentGameId: null, chat: [], clients: new Set() };
const room = global.__tvRoom;

export async function init() {
  room.chat = await db.loadTvChat();
}

export function addClient(socket, name) {
  socket.tvName = name;
  room.clients.add(socket);
  broadcastViewers();
}

export function removeClient(socket) {
  room.clients.delete(socket);
  broadcastViewers();
}

function getViewers() {
  const viewers = [];
  for (const socket of room.clients) {
    if (socket.tvName) viewers.push(socket.tvName);
  }
  return viewers;
}

function broadcastViewers() {
  broadcast({ type: 'tv-viewers', viewers: getViewers() });
}

export function getState() {
  return { gameId: room.currentGameId, chat: [...room.chat], viewers: getViewers() };
}

export function setGame(gameId, names = {}) {
  if (room.currentGameId === gameId) return;
  room.currentGameId = gameId;
  broadcast({ type: 'tv-game', gameId });
  if (gameId) {
    pushChat({
      divider: true,
      gameId,
      blackName: names.blackName ?? null,
      whiteName: names.whiteName ?? null,
      t: Date.now()
    });
  }
}

export function clearGameIfMatches(gameId) {
  if (room.currentGameId !== gameId) return;
  room.currentGameId = null;
  broadcast({ type: 'tv-game', gameId: null });
}

export function addChat(entry) {
  pushChat(entry);
}

function pushChat(entry) {
  room.chat.push(entry);
  if (room.chat.length > CHAT_CAP) room.chat.shift();
  db.pushTvChat(entry, CHAT_CAP).catch(() => {});
  broadcast({ type: 'tv-chat', entry });
}

export function broadcast(msg) {
  const payload = JSON.stringify(msg);
  for (const socket of room.clients) {
    if (socket.readyState === socket.OPEN) {
      socket.send(payload);
    }
  }
}
