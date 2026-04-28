const CHAT_CAP = 100;

const room = {
  currentGameId: null,
  chat: [],
  clients: new Set()
};

export function addClient(socket) {
  room.clients.add(socket);
}

export function removeClient(socket) {
  room.clients.delete(socket);
}

export function getState() {
  return { gameId: room.currentGameId, chat: [...room.chat] };
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
