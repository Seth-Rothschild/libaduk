import { WebSocketServer } from 'ws';
import * as db from './db.js';
import { handicapPoints } from '../game/board/helpers.js';
import { createBoard, placeStones, replayMoves } from '../game/board/board.js';
import { OgsAdapter } from './ogsAdapter.js';

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
  const elapsed = clockState.turnStartedAt ? now - clockState.turnStartedAt : 0;
  if (clock.inByoYomi) {
    const periodStep = clock.periodMs > 0 ? clock.periodMs : clock.byoMs;
    let remaining = clock.byoMs - elapsed;
    let periodsLeft = clock.byoPeriods;
    while (remaining <= 0 && periodsLeft > 1) {
      periodsLeft--;
      remaining += periodStep;
    }
    clock.byoMs = clock.periodMs ?? clock.byoMs;
    clock.byoPeriods = periodsLeft;
  } else if (elapsed > 0) {
    clock.mainMs = Math.max(0, clock.mainMs - elapsed);
    if (clock.mainMs <= 0 && clock.byoPeriods > 0) {
      clock.inByoYomi = true;
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

if (!global.__ogsAdapters) global.__ogsAdapters = new Map();
const ogsAdapters = global.__ogsAdapters;

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

  const creatorIsAuth = creatorName && /^(?!Guest\d{4}$)/.test(creatorName);
  const owners = creatorIsAuth ? [creatorName] : [];

  await db.createGame({
    id,
    size,
    blackName,
    whiteName,
    blackIsAuth: !!blackName && !isAi,
    whiteIsAuth: !!whiteName && !isAi,
    creatorColor,
    owners,
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

export async function joinGame(gameId, joinerName, joinerIsAuth = false) {
  const game = await db.getGame(gameId);
  if (!game || game.status !== 'waiting') return null;

  const openColor = game.creatorColor === 'black' ? 'white' : 'black';
  const patch = { [`${openColor}Name`]: joinerName, status: 'playing' };
  await db.updateGame(gameId, patch);
  if (joinerIsAuth) await db.addOwner(gameId, joinerName);

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

export function getOgsAdapter(gameId) {
  return ogsAdapters.get(gameId) ?? null;
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

        if (msg.ogsToken) {
          const game = await db.getGame(msg.gameId);
          if (game?.gameType === 'ogs' && game.ogsGameId && game.ogsUserId) {
            let adapter = ogsAdapters.get(msg.gameId);
            if (!adapter) {
              adapter = new OgsAdapter(game.ogsGameId, game.ogsUserId, msg.ogsToken, {
                onBroadcast: (m) => {
                  if (m.type === 'move')
                    db.appendMove(msg.gameId, { type: 'move', x: m.x, y: m.y });
                  if (m.type === 'pass') db.appendMove(msg.gameId, { type: 'pass' });
                  if (m.type === 'gameover') {
                    const patch = {
                      status: 'finished',
                      winner: m.winner,
                      result: m.result,
                      deadStones: m.deadStones,
                      endedAt: Date.now()
                    };
                    db.updateGame(msg.gameId, patch);
                  }
                  broadcast(msg.gameId, m);
                },
                onUnicast: (m) => send(socket, m),
                onGameStart: (myColor, blackName, whiteName, handicapStones, timeControl, komi) => {
                  if (game.status !== 'waiting') return;

                  socket.playerColor = myColor;
                  broadcast(msg.gameId, { type: 'presence', color: myColor, online: true });
                  const stones = handicapStones.map(([x, y]) => ({ x, y }));
                  db.updateGame(msg.gameId, {
                    blackName,
                    whiteName,
                    timeControl,
                    status: 'playing',
                    handicapStones: stones,
                    komi
                  });
                },
                onGameData: (gameData) => {
                  let dbMoveCount = game.moves.length;
                  let ogsMoveCount = gameData.moves.length;
                  if (dbMoveCount < ogsMoveCount) {
                    let missingMoves = gameData.moves.slice(dbMoveCount);
                    for (const m of missingMoves) {
                      let [x, y, _] = m;
                      if (x < 0) continue;
                      db.appendMove(msg.gameId, { type: 'move', x, y });
                      broadcast(msg.gameId, { type: 'move', x, y });
                    }
                  }
                }
              });
              ogsAdapters.set(msg.gameId, adapter);
              adapter.connect();
            } else if (adapter.myColor) {
              socket.playerColor = adapter.myColor;
              send(socket, { type: 'my-color', color: adapter.myColor, handicapStones: [] });
            }
          }
        }
      }
      if (msg.type === 'move' && socket.gameId) {
        const game = await db.getGame(socket.gameId);
        if (!game || game.status !== 'playing') return;

        if (game.gameType === 'ogs') {
          const adapter = ogsAdapters.get(socket.gameId);
          if (adapter) {
            adapter.sendMove(msg.x, msg.y);
            await db.appendMove(socket.gameId, { type: 'move', x: msg.x, y: msg.y });
            broadcast(socket.gameId, { type: 'move', x: msg.x, y: msg.y });
          }
          return;
        }
        if (game.gameType === 'ai') {
          await db.appendMove(socket.gameId, { type: 'move', x: msg.x, y: msg.y });
          broadcastToOthers(socket.gameId, socket, { type: 'move', x: msg.x, y: msg.y });
          return;
        }
        const { board, currentSign } = buildCurrentBoard(game);
        const analysis = board.analyzeMove(currentSign, [msg.x, msg.y]);
        if (analysis.overwrite || analysis.suicide || analysis.ko) return;
        const hasHandicap = (game.handicapStones ?? []).length > 0;
        const clockState = tickClockState(
          game.clockState ?? createInitialClockState(game.timeControl, hasHandicap)
        );
        await db.appendMove(socket.gameId, { type: 'move', x: msg.x, y: msg.y });
        const movePatch = { consecutivePasses: 0 };
        if (clockState) movePatch.clockState = clockState;
        if (game.timeControl?.type === 'correspondence') {
          const turnDeadline = Date.now() + (game.timeControl.days ?? 3) * 24 * 60 * 60 * 1000;
          movePatch.corrTurnDeadline = turnDeadline;
          broadcast(socket.gameId, { type: 'move', x: msg.x, y: msg.y, turnDeadline });
          await db.updateGame(socket.gameId, movePatch);
          return;
        }
        await db.updateGame(socket.gameId, movePatch);
        broadcast(socket.gameId, { type: 'move', x: msg.x, y: msg.y, clockState });
      }
      if (msg.type === 'pass' && socket.gameId) {
        const game = await db.getGame(socket.gameId);
        if (!game || game.status !== 'playing') return;

        if (game.gameType === 'ogs') {
          const adapter = ogsAdapters.get(socket.gameId);
          if (adapter) {
            adapter.sendPass();
            await db.appendMove(socket.gameId, { type: 'pass' });
            broadcast(socket.gameId, { type: 'pass' });
          }
          return;
        }
        if (game.gameType === 'ai') {
          await db.appendMove(socket.gameId, { type: 'pass' });
          broadcastToOthers(socket.gameId, socket, { type: 'pass' });
          return;
        }
        const hasHandicap = (game.handicapStones ?? []).length > 0;
        const clockState = tickClockState(
          game.clockState ?? createInitialClockState(game.timeControl, hasHandicap)
        );
        const consecutivePasses = (game.consecutivePasses ?? 0) + 1;
        await db.appendMove(socket.gameId, { type: 'pass' });
        const patch = { consecutivePasses };
        if (clockState) patch.clockState = clockState;
        if (consecutivePasses >= 2) patch.status = 'scoring';
        await db.updateGame(socket.gameId, patch);
        broadcast(socket.gameId, { type: 'pass', clockState });
      }
      if (msg.type === 'approve-score' && socket.gameId) {
        const game = await db.getGame(socket.gameId);
        if (!game) return;
        if (game.gameType === 'ogs') {
          const adapter = ogsAdapters.get(socket.gameId);
          if (adapter) adapter.acceptScoring();
        } else {
          broadcastToOthers(socket.gameId, socket, { type: 'approve-score', color: msg.color });
        }
      }
      if (msg.type === 'scoring-mark' && socket.gameId) {
        const game = await db.getGame(socket.gameId);
        if (!game) return;
        if (game.gameType === 'ogs') {
          const adapter = ogsAdapters.get(socket.gameId);
          if (adapter) adapter.toggleDeadStone(msg.x, msg.y);
        } else {
          broadcast(socket.gameId, { type: 'scoring-mark', x: msg.x, y: msg.y });
        }
      }
      if (msg.type === 'scoring-resume' && socket.gameId) {
        const game = await db.getGame(socket.gameId);
        if (!game) return;
        if (game.gameType === 'ogs') {
          const adapter = ogsAdapters.get(socket.gameId);
          if (adapter) adapter.rejectScoring();
        } else {
          await db.updateGame(socket.gameId, { status: 'playing', consecutivePasses: 0 });
          broadcast(socket.gameId, { type: 'scoring-resume' });
        }
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
          if (game.gameType === 'ogs' && msg.result?.endsWith('+R')) {
            const adapter = ogsAdapters.get(socket.gameId);
            if (adapter) adapter.sendResign();
          }
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
        const adapter = ogsAdapters.get(gameId);
        if (adapter) {
          adapter.destroy();
          ogsAdapters.delete(gameId);
        }
      }
    });
  });
}
