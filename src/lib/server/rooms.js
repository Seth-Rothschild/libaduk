import { WebSocketServer } from 'ws';
import * as db from './db.js';
import * as tvRoom from './tvRoom.js';
import { NativeGame } from './games/nativeHost.js';
import { OgsGame } from './games/ogsProxy.js';
import { newNativeGamedata } from './games/gamedata.js';

if (!global.__lobbyClients) global.__lobbyClients = new Set();
const lobbyClients = global.__lobbyClients;

if (!global.__gameClients) global.__gameClients = new Map();
const gameClients = global.__gameClients;

if (!global.__onlinePlayers) global.__onlinePlayers = new Map();
const onlinePlayers = global.__onlinePlayers;

if (!global.__gameConnections) global.__gameConnections = new Map();
const gameConnections = global.__gameConnections;

const ONLINE_TIMEOUT = 15000;

export function getOnlinePlayers() {
  const now = Date.now();
  const users = [];
  const guests = [];
  const knownNames = new Set();
  for (const [name, entry] of onlinePlayers) {
    if (now - entry.lastPing > ONLINE_TIMEOUT) {
      onlinePlayers.delete(name);
      continue;
    }
    if (entry.isAuth) {
      users.push(name);
    } else {
      guests.push(name);
    }
    knownNames.add(name);
  }
  const gameUsers = getConnectedUsers();
  for (const name of gameUsers.users) {
    if (!knownNames.has(name)) {
      users.push(name);
      knownNames.add(name);
    }
  }
  for (const name of gameUsers.guests) {
    if (!knownNames.has(name)) {
      guests.push(name);
      knownNames.add(name);
    }
  }

  const tvUsers = tvRoom.getConnectedUsers();
  for (const name of tvUsers.users) {
    if (!knownNames.has(name)) {
      users.push(name);
      knownNames.add(name);
    }
  }
  for (const name of tvUsers.guests) {
    if (!knownNames.has(name)) {
      guests.push(name);
      knownNames.add(name);
    }
  }
  return { users, guests };
}

function getConnectedUsers() {
  const users = [];
  const guests = [];
  for (const clients of gameClients.values()) {
    for (const socket of clients) {
      const name = socket.playerName ?? socket.spectatorName;
      if (!name) continue;
      name.startsWith('Guest') ? guests.push(name) : users.push(name);
    }
  }
  return { users, guests };
}

export function getConnectedGames() {
  const gameIds = [];
  for (const [gameId, clients] of gameClients) {
    if (clients.size > 0) gameIds.push(gameId);
  }
  return gameIds;
}

export function getLobbyStats() {
  const { users, guests } = getOnlinePlayers();
  return {
    playersOnline: users.length + guests.length,
    gamesInPlay: getConnectedGames().length
  };
}

function generateId() {
  return Math.random().toString(36).slice(2, 8);
}

async function uniqueId() {
  let id = generateId();
  while (await db.getGame(id)) id = generateId();
  return id;
}

export async function createRoom(
  size = 19,
  timeControl = { type: 'none' },
  color,
  gameType = 'hook',
  creatorName = null,
  extra = {}
) {
  const isAi = gameType === 'ai';
  const isOgs = gameType === 'ogs';
  const id = await uniqueId();
  const creatorColor =
    color === 'random' ? (Math.random() > 0.5 ? 'black' : 'white') : (color ?? 'black');

  let blackName = !isOgs && creatorColor === 'black' ? creatorName : null;
  let whiteName = !isOgs && creatorColor === 'white' ? creatorName : null;

  if (isAi) {
    const aiLabel = `AI (strength ${extra.aiDifficulty ?? 5})`;
    if (creatorColor === 'black') {
      whiteName = aiLabel;
    } else {
      blackName = aiLabel;
    }
  }

  const creatorIsAuth = creatorName && /^(?!Guest\d{4}$)/.test(creatorName);
  const owners = creatorIsAuth ? [creatorName] : [];

  const gamedata = isOgs
    ? null
    : newNativeGamedata({
        id,
        size,
        komi: extra.komi ?? 6.5,
        handicap: extra.handicap ?? 0,
        timeControl,
        blackName,
        whiteName
      });

  await db.createGame({
    id,
    gameType,
    owners,
    creatorColor,
    status: isAi ? 'playing' : 'waiting',
    aiDifficulty: extra.aiDifficulty ?? null,
    ogsGameId: extra.ogsGameId ?? null,
    ogsUserId: extra.ogsUserId ?? null,
    gamedata
  });

  return { id };
}

export async function findMatchingGame(size, timeControl, excludeUsername = null) {
  return await db.findMatchingGame(size, timeControl, excludeUsername);
}

export async function joinGame(gameId, joinerName, joinerIsAuth = false) {
  const game = await db.getGame(gameId);
  if (!game || game.status !== 'waiting') return null;

  const openColor = game.creatorColor === 'black' ? 'white' : 'black';
  await db.updateGame(gameId, {
    status: 'playing',
    [`gamedata.players.${openColor}.username`]: joinerName
  });
  if (joinerIsAuth) await db.addOwner(gameId, joinerName);

  const updated = await db.getGame(gameId);
  emitToGame(gameId, `game/${gameId}/gamedata`, updated.gamedata);

  return { id: gameId, color: openColor };
}

export async function getPendingGames(tcType = null) {
  return await db.getPendingGames(tcType);
}

export async function getUserGames(username) {
  return await db.getUserGames(username);
}

function frame(name, data) {
  return JSON.stringify([name, data]);
}

export function emitToGame(gameId, name, data) {
  const clients = gameClients.get(gameId);
  if (!clients) return;
  const payload = frame(name, data);
  for (const socket of clients) {
    if (socket.readyState === socket.OPEN) {
      socket.send(payload);
    }
  }
}

function emitToOthers(gameId, sender, name, data) {
  const clients = gameClients.get(gameId);
  if (!clients) return;
  const payload = frame(name, data);
  for (const socket of clients) {
    if (socket !== sender && socket.readyState === socket.OPEN) {
      socket.send(payload);
    }
  }
}

function emitTo(socket, name, data) {
  if (socket && socket.readyState === socket.OPEN) {
    socket.send(frame(name, data));
  }
}

function sendLegacy(socket, msg) {
  if (socket && socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(msg));
  }
}

function addToGame(socket, gameId) {
  socket.gameId = gameId;
  if (!gameClients.has(gameId)) {
    gameClients.set(gameId, new Set());
  }
  gameClients.get(gameId).add(socket);
}

function removeFromGame(socket) {
  if (!socket.gameId) return;
  const clients = gameClients.get(socket.gameId);
  if (clients) {
    clients.delete(socket);
    if (clients.size === 0) {
      gameClients.delete(socket.gameId);
    }
  }
  socket.gameId = null;
}

function spectatorNames(gameId) {
  const clients = gameClients.get(gameId);
  if (!clients) return [];
  const names = [];
  for (const c of clients) {
    if (!c.playerColor && c.spectatorName) names.push(c.spectatorName);
  }
  return names;
}

async function connectionForGame(game, ogsToken = null) {
  const existing = gameConnections.get(game.id);
  if (existing) return existing;

  let connection;
  if (game.gameType === 'ogs' || (game.gameType === 'uploaded' && game.ogsGameId)) {
    connection = new OgsGame(game.id, game.ogsGameId, ogsToken, (name, data) =>
      emitToGame(game.id, name, data)
    );
    await connection.connect();
  } else {
    connection = new NativeGame(game.id, (name, data) => emitToGame(game.id, name, data));
  }
  gameConnections.set(game.id, connection);
  return connection;
}

async function handleJoin(socket, data) {
  removeFromGame(socket);
  const gameId = data.gameId;
  addToGame(socket, gameId);
  socket.playerColor = data.color ?? null;
  socket.playerName = data.color && data.name ? data.name : null;
  socket.spectatorName = !data.color && data.name ? data.name : null;

  if (socket.playerColor) {
    emitToGame(gameId, 'presence', { color: socket.playerColor, online: true });
  } else {
    emitToGame(gameId, 'spectators', { names: spectatorNames(gameId) });
  }
  const clients = gameClients.get(gameId);
  for (const other of clients) {
    if (other !== socket && other.playerColor) {
      emitTo(socket, 'presence', { color: other.playerColor, online: true });
    }
  }
  emitTo(socket, 'spectators', { names: spectatorNames(gameId) });

  const game = await db.getGame(gameId);
  if (!game) return;

  const needsOgs = game.gameType === 'ogs' || (game.gameType === 'uploaded' && game.ogsGameId);
  if (!needsOgs || data.ogsToken || game.gameType === 'uploaded') {
    const connection = await connectionForGame(game, data.ogsToken ?? null);
    await connection.sendState((name, payload) => emitTo(socket, name, payload));

    const clock = game.gamedata?.clock;
    const clockExpired = clock && Date.now() > clock.expiration;
    if (game.status === 'playing' && clockExpired && connection instanceof NativeGame) {
      await connection.timedOut();
    }
  }

  if (game.analysisActive && game.analysisTree) {
    emitTo(socket, 'analysis-enter', {
      tree: game.analysisTree,
      path: game.currentNodePath ?? null
    });
  }
}

async function handleGameCommand(socket, command, data) {
  const gameId = socket.gameId;
  if (!gameId) return;
  const connection = gameConnections.get(gameId);
  if (!connection) return;
  const game = await db.getGame(gameId);
  if (!game) return;

  if (connection instanceof OgsGame) {
    if (command === 'game/move') connection.move(data.move);
    if (command === 'game/resign') connection.resign();
    if (command === 'game/cancel') connection.cancel();
    if (command === 'game/timed_out') connection.timedOut();
    if (command === 'game/removed_stones/set') connection.setRemoved(data.stones, data.removed);
    if (command === 'game/removed_stones/accept') connection.acceptRemoval(data.stones);
    if (command === 'game/removed_stones/reject') connection.rejectRemoval();
    if (command === 'game/chat') connection.chat(data.body, data.move_number);
    return;
  }

  const color = socket.playerColor;
  const allowAnyColor = game.gameType === 'ai';
  if (command === 'game/move') {
    if (!color) return;
    await connection.move(color, data.move, { allowAnyColor });
  }
  if (command === 'game/resign' && color) await connection.resign(color);
  if (command === 'game/cancel' && color) await connection.cancel(color);
  if (command === 'game/timed_out') await connection.timedOut();
  if (command === 'game/removed_stones/set' && color) {
    await connection.setRemoved(color, data.stones, data.removed);
  }
  if (command === 'game/removed_stones/accept' && color) {
    await connection.acceptRemoval(color, data.stones);
  }
  if (command === 'game/removed_stones/reject' && color) {
    await connection.rejectRemoval(color);
  }
  if (command === 'room/force-resign' && color) {
    const opponent = color === 'black' ? 'white' : 'black';
    await connection.resign(opponent);
  }
  if (command === 'game/chat') {
    const username = socket.playerName ?? socket.spectatorName ?? 'anon';
    const playerId = color === 'black' ? 1 : color === 'white' ? 2 : 0;
    await connection.chat(username, playerId, data.body, data.move_number);
  }
}

async function handleCommand(socket, command, data) {
  if (command === 'net/ping') {
    emitTo(socket, 'net/pong', { client: data.client, server: Date.now() });
    return;
  }
  if (command === 'authenticate') return;

  if (command === 'room/join') {
    await handleJoin(socket, data);
    return;
  }
  if (command.startsWith('game/') || command === 'room/force-resign') {
    await handleGameCommand(socket, command, data);
    return;
  }
  if (command === 'typing' && socket.gameId) {
    const name = socket.playerName ?? socket.spectatorName;
    if (name) {
      emitToGame(socket.gameId, 'typing', { user: name, isTyping: !!data.isTyping });
    }
    return;
  }
  if (command === 'analysis-enter' && socket.gameId) {
    await db.updateGame(socket.gameId, {
      analysisTree: data.tree,
      currentNodePath: data.path ?? null,
      analysisActive: true
    });
    emitToOthers(socket.gameId, socket, 'analysis-enter', {
      tree: data.tree,
      path: data.path ?? null
    });
    return;
  }
  if (command === 'analysis-exit' && socket.gameId) {
    await db.updateGame(socket.gameId, { analysisActive: false });
    emitToOthers(socket.gameId, socket, 'analysis-exit', {});
    return;
  }
  if (command === 'analysis-tree' && socket.gameId) {
    await db.updateGame(socket.gameId, {
      analysisTree: data.tree,
      currentNodePath: data.path ?? null
    });
    emitToOthers(socket.gameId, socket, 'analysis-tree', {
      tree: data.tree,
      path: data.path ?? null
    });
    return;
  }
  if (command === 'request-control' && socket.gameId) {
    emitToGame(socket.gameId, 'request-control', { user: data.user });
    return;
  }
  if (command === 'clear-control' && socket.gameId) {
    emitToGame(socket.gameId, 'clear-control', {});
  }
}

function handleLegacyMessage(socket, msg) {
  if (msg.type === 'ping') {
    if (msg.name) {
      onlinePlayers.set(msg.name, { lastPing: Date.now(), isAuth: !!msg.isAuth });
    }
    sendLegacy(socket, { type: 'pong', ...getLobbyStats() });
  }
  if (msg.type === 'tv-join') {
    socket.tvViewer = true;
    const name = typeof msg.name === 'string' ? msg.name.slice(0, 50) : 'anon';
    tvRoom.addClient(socket, name);
    const state = tvRoom.getState();
    sendLegacy(socket, {
      type: 'tv-state',
      gameId: state.gameId,
      chat: state.chat,
      viewers: state.viewers
    });
  }
  if (msg.type === 'tv-set-game' && socket.tvViewer) {
    if (tvRoom.getState().gameId == null && msg.gameId) {
      tvRoom.setGame(msg.gameId, {
        blackName: msg.blackName ?? null,
        whiteName: msg.whiteName ?? null
      });
    }
  }
  if (msg.type === 'tv-chat' && socket.tvViewer) {
    const text = typeof msg.text === 'string' ? msg.text.slice(0, 500).trim() : '';
    const user = typeof msg.user === 'string' ? msg.user.slice(0, 50) : 'anon';
    const moveNumber = Number.isFinite(msg.moveNumber) ? msg.moveNumber : null;
    if (text) tvRoom.addChat({ user, text, t: Date.now(), moveNumber });
  }
  if (msg.type === 'tv-game-ended' && socket.tvViewer) {
    tvRoom.clearGameIfMatches(msg.gameId);
  }
}

export function attachWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    if (req.url === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
  });

  wss.on('connection', (socket) => {
    lobbyClients.add(socket);
    socket.on('message', async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (Array.isArray(msg)) {
        const [command, data] = msg;
        if (typeof command !== 'string') return;
        try {
          await handleCommand(socket, command, data ?? {});
        } catch (err) {
          console.error(`[rooms] ${command} failed:`, err.message);
        }
        return;
      }
      handleLegacyMessage(socket, msg);
    });

    socket.on('close', async () => {
      lobbyClients.delete(socket);
      if (socket.tvViewer) tvRoom.removeClient(socket);
      const gameId = socket.gameId;
      const color = socket.playerColor;
      const wasSpectator = !color && !!socket.spectatorName;
      removeFromGame(socket);
      if (gameId && color) {
        emitToGame(gameId, 'presence', { color, online: false });
      } else if (gameId && wasSpectator) {
        emitToGame(gameId, 'spectators', { names: spectatorNames(gameId) });
      }
      if (gameId && !gameClients.has(gameId)) {
        const game = await db.getGame(gameId);
        const isCorrespondence = game?.gamedata?.time_control?.speed === 'correspondence';
        const isAbandoned =
          game &&
          !isCorrespondence &&
          ((game.status === 'waiting' && game.gameType === 'hook') ||
            (game.gameType === 'ai' && game.status !== 'finished' && game.status !== 'cancelled'));
        if (isAbandoned) {
          await db.updateGame(gameId, { status: 'cancelled', endedAt: Date.now() });
        }
        const connection = gameConnections.get(gameId);
        if (connection) {
          if (connection instanceof OgsGame) connection.destroy();
          gameConnections.delete(gameId);
        }
      }
    });
  });
}
