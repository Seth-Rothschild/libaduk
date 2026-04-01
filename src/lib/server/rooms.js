import { WebSocketServer } from 'ws';
import * as db from './db.js';
import { handicapPoints } from '../game/board/helpers.js';
import { createBoard, placeStones, replayMoves } from '../game/board/board.js';

function createInitialClockState(tc, hasHandicap) {
  if (!tc || (tc.type !== 'byoyomi' && tc.type !== 'fischer')) return null;
  const mainMs = (tc.initial ?? 0) * 1000;
  const isByoyomi = tc.type === 'byoyomi';
  const periodMs = isByoyomi ? (tc.periodTime ?? 30) * 1000 : 0;
  const clockEntry = {
    mainMs,
    byoMs: isByoyomi ? periodMs : 0,
    byoPeriods: isByoyomi ? (tc.periods ?? 5) : 0,
    inByoYomi: isByoyomi && mainMs === 0,
    periodMs
  };
  return {
    black: { ...clockEntry },
    white: { ...clockEntry },
    activeColor: hasHandicap ? 'white' : 'black',
    turnStartedAt: null
  };
}

function tickClockState(clockState) {
  if (!clockState) return null;
  const now = Date.now();
  const movedColor = clockState.activeColor;
  const clock = { ...clockState[movedColor] };
  if (clockState.turnStartedAt) {
    const elapsed = now - clockState.turnStartedAt;
    if (clock.inByoYomi) {
      clock.byoMs = clock.periodMs ?? clock.byoMs;
    } else {
      clock.mainMs = Math.max(0, clock.mainMs - elapsed);
      if (clock.mainMs <= 0 && clock.byoPeriods > 0) {
        clock.inByoYomi = true;
      }
    }
  }
  return {
    ...clockState,
    [movedColor]: clock,
    activeColor: movedColor === 'black' ? 'white' : 'black',
    turnStartedAt: now
  };
}

function buildCurrentBoard(game) {
  const size = game.size ?? 19;
  const moves = game.moves ?? [];
  const handicapStones = game.handicapStones ?? [];

  let initialBoard = null;
  if (handicapStones.length > 0) {
    const stoneList = handicapStones.map(({ x, y }) => ({ x, y, sign: 1 }));
    initialBoard = placeStones(createBoard(size), stoneList);
  }

  const board = replayMoves(moves, size, initialBoard);
  const firstSign = handicapStones.length > 0 ? -1 : 1;
  const currentSign = moves.length % 2 === 0 ? firstSign : -firstSign;

  return { board, currentSign };
}

if (!global.__lobbyClients) global.__lobbyClients = new Set();
const lobbyClients = global.__lobbyClients;

if (!global.__gameClients) global.__gameClients = new Map();
const gameClients = global.__gameClients;

if (!global.__onlinePlayers) global.__onlinePlayers = new Map();
const onlinePlayers = global.__onlinePlayers;

const ONLINE_TIMEOUT = 15000;

export function getOnlinePlayers() {
  const now = Date.now();
  const users = [];
  const guests = [];
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
  }
  return { users, guests };
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
  const id = await uniqueId();
  const creatorColor =
    color === 'random' ? (Math.random() > 0.5 ? 'black' : 'white') : (color ?? 'black');

  const isOgs = gameType === 'ogs';

  let blackName = !isOgs && creatorColor === 'black' && creatorName ? creatorName : null;
  let whiteName = !isOgs && creatorColor === 'white' && creatorName ? creatorName : null;

  if (isAi) {
    const aiLabel = `AI (strength ${extra.aiDifficulty ?? 5})`;
    if (creatorColor === 'black') {
      whiteName = aiLabel;
    } else {
      blackName = aiLabel;
    }
  }

  await db.createGame({
    id,
    size,
    blackName,
    whiteName,
    blackIsAuth: !!blackName && !isAi,
    whiteIsAuth: !!whiteName && !isAi,
    creatorColor,
    timeControl,
    gameType,
    status: isAi ? 'playing' : 'waiting',
    aiDifficulty: extra.aiDifficulty ?? null,
    komi: extra.komi ?? 6.5,
    handicap: extra.handicap ?? 0,
    handicapStones: handicapPoints(size, extra.handicap ?? 0),
    ogsGameId: extra.ogsGameId ?? null,
    ogsUserId: extra.ogsUserId ?? null
  });

  return { id };
}

export async function findMatchingGame(size, timeControl, excludeUsername = null) {
  return await db.findMatchingGame(size, timeControl, excludeUsername);
}

export async function joinGame(gameId, joinerName) {
  const game = await db.getGame(gameId);
  if (!game || game.status !== 'waiting') return null;

  const openColor = game.creatorColor === 'black' ? 'white' : 'black';
  const patch = { [`${openColor}Name`]: joinerName, status: 'playing' };
  await db.updateGame(gameId, patch);

  broadcast(gameId, { type: 'joined', color: openColor, name: joinerName });

  return { id: gameId, color: openColor };
}

export async function getPendingGames(tcType = null) {
  return await db.getPendingGames(tcType);
}

export async function getUserGames(username) {
  return await db.getUserGames(username);
}

export function getLobbyStats() {
  const { users, guests } = getOnlinePlayers();
  return {
    playersOnline: users.length + guests.length,
    gamesInPlay: 0
  };
}

export function broadcast(gameId, msg) {
  const clients = gameClients.get(gameId);
  if (!clients) return;
  const payload = JSON.stringify(msg);
  for (const socket of clients) {
    if (socket.readyState === socket.OPEN) {
      socket.send(payload);
    }
  }
}

function broadcastToOthers(gameId, sender, msg) {
  const clients = gameClients.get(gameId);
  if (!clients) return;
  const payload = JSON.stringify(msg);
  for (const socket of clients) {
    if (socket !== sender && socket.readyState === socket.OPEN) {
      socket.send(payload);
    }
  }
}

function send(socket, msg) {
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
      if (msg.type === 'ping') {
        if (msg.name) {
          onlinePlayers.set(msg.name, { lastPing: Date.now(), isAuth: !!msg.isAuth });
        }
        send(socket, { type: 'pong', ...getLobbyStats() });
      }
      if (msg.type === 'join' && msg.gameId) {
        removeFromGame(socket);
        addToGame(socket, msg.gameId);
        socket.playerColor = msg.color ?? null;
        if (socket.playerColor) {
          broadcast(msg.gameId, { type: 'presence', color: socket.playerColor, online: true });
        }
        const clients = gameClients.get(msg.gameId);
        for (const other of clients) {
          if (other !== socket && other.playerColor) {
            send(socket, { type: 'presence', color: other.playerColor, online: true });
          }
        }
      }
      if (msg.type === 'move' && socket.gameId) {
        const game = await db.getGame(socket.gameId);
        if (!game || game.status !== 'playing') return;

        const isRegularGame = game.gameType !== 'ai' && game.gameType !== 'ogs';
        if (isRegularGame) {
          const { board, currentSign } = buildCurrentBoard(game);
          const analysis = board.analyzeMove(currentSign, [msg.x, msg.y]);
          if (analysis.overwrite || analysis.suicide || analysis.ko) return;
          const hasHandicap = (game.handicapStones ?? []).length > 0;
          const clockState = tickClockState(
            game.clockState ?? createInitialClockState(game.timeControl, hasHandicap)
          );
          await db.appendMove(socket.gameId, { type: 'move', x: msg.x, y: msg.y });
          if (clockState) await db.updateGame(socket.gameId, { clockState });
          broadcast(socket.gameId, { type: 'move', x: msg.x, y: msg.y, clockState });
        } else {
          await db.appendMove(socket.gameId, { type: 'move', x: msg.x, y: msg.y });
          broadcastToOthers(socket.gameId, socket, { type: 'move', x: msg.x, y: msg.y });
        }
      }
      if (msg.type === 'pass' && socket.gameId) {
        const game = await db.getGame(socket.gameId);
        if (!game || game.status !== 'playing') return;

        const isRegularGame = game.gameType !== 'ai' && game.gameType !== 'ogs';
        if (isRegularGame) {
          const hasHandicap = (game.handicapStones ?? []).length > 0;
          const clockState = tickClockState(
            game.clockState ?? createInitialClockState(game.timeControl, hasHandicap)
          );
          await db.appendMove(socket.gameId, { type: 'pass' });
          const patch = {};
          if (clockState) patch.clockState = clockState;
          const allMoves = [...(game.moves ?? []), { type: 'pass' }];
          const lastTwo = allMoves.slice(-2);
          const bothPassed = lastTwo.length === 2 && lastTwo.every((m) => m.type === 'pass');
          if (bothPassed) patch.status = 'scoring';
          if (Object.keys(patch).length > 0) await db.updateGame(socket.gameId, patch);
          broadcast(socket.gameId, { type: 'pass', clockState });
        } else {
          await db.appendMove(socket.gameId, { type: 'pass' });
          broadcastToOthers(socket.gameId, socket, { type: 'pass' });
        }
      }
      if (msg.type === 'approve-score' && socket.gameId) {
        broadcastToOthers(socket.gameId, socket, { type: 'approve-score', color: msg.color });
      }
      if (msg.type === 'analysis-enter' && socket.gameId) {
        await db.updateGame(socket.gameId, { analysisTree: msg.tree, analysisActive: true });
        broadcastToOthers(socket.gameId, socket, { type: 'analysis-enter', tree: msg.tree });
      }
      if (msg.type === 'analysis-navigate' && socket.gameId) {
        broadcastToOthers(socket.gameId, socket, { type: 'analysis-navigate', path: msg.path });
      }
      if (msg.type === 'analysis-move' && socket.gameId) {
        broadcastToOthers(socket.gameId, socket, {
          type: 'analysis-move',
          x: msg.x,
          y: msg.y,
          tool: msg.tool
        });
      }
      if (msg.type === 'analysis-exit' && socket.gameId) {
        await db.updateGame(socket.gameId, { analysisActive: false });
        broadcastToOthers(socket.gameId, socket, { type: 'analysis-exit' });
      }
      if (msg.type === 'analysis-tree' && socket.gameId) {
        await db.updateGame(socket.gameId, { analysisTree: msg.tree });
      }
      if (msg.type === 'cancel' && socket.gameId) {
        const game = await db.getGame(socket.gameId);
        if (game && game.status === 'waiting') {
          await db.updateGame(socket.gameId, { status: 'cancelled', endedAt: Date.now() });
          broadcast(socket.gameId, { type: 'cancel' });
        }
      }
      if (msg.type === 'gameover' && socket.gameId) {
        const game = await db.getGame(socket.gameId);
        if (game && game.status !== 'finished') {
          const winner = msg.winner;
          const result = msg.result ?? null;
          const patch = { status: 'finished', winner, result, endedAt: Date.now() };
          if (msg.clockState) patch.clockState = msg.clockState;
          await db.updateGame(socket.gameId, patch);
          broadcast(socket.gameId, { type: 'gameover', winner, result });
        }
      }
    });
    socket.on('close', async () => {
      lobbyClients.delete(socket);
      const gameId = socket.gameId;
      const color = socket.playerColor;
      removeFromGame(socket);
      if (gameId && color) {
        broadcast(gameId, { type: 'presence', color, online: false });
      }
      if (gameId && !gameClients.has(gameId)) {
        const game = await db.getGame(gameId);
        const isAbandoned =
          (game.status === 'waiting' && game.gameType === 'hook') ||
          (game.gameType === 'ai' && game.status !== 'finished');
        if (game && isAbandoned) {
          await db.updateGame(gameId, { status: 'cancelled', endedAt: Date.now() });
        }
      }
    });
  });
}
