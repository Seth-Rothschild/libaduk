import { WebSocketServer } from 'ws';
import * as db from './db.js';

// Survive HMR reloads in dev — keep rooms across module re-evaluations
if (!global.__rooms) global.__rooms = new Map();
const rooms = global.__rooms;

// Track all connected WebSocket clients for lobby stats
if (!global.__lobbyClients) global.__lobbyClients = new Set();
const lobbyClients = global.__lobbyClients;

function generateId() {
  return Math.random().toString(36).slice(2, 8);
}

async function uniqueId() {
  let id = generateId();
  while (rooms.has(id) || (await db.getGame(id))) id = generateId();
  return id;
}

function send(socket, msg) {
  if (socket && socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(msg));
  }
}

function sendBoth(room, msg) {
  send(room.black, msg);
  if (room.white !== room.black) send(room.white, msg);
}

// --- Clock helpers ---

function initClock(timeControl) {
  if (!timeControl || timeControl.type === 'none' || timeControl.type === 'correspondence') {
    return null;
  }
  const mainMs = (timeControl.initial ?? 0) * 1000;
  const isByoyomi = timeControl.type === 'byoyomi';
  const playerClock = () => ({
    mainMs,
    byoPeriods: isByoyomi ? (timeControl.periods ?? 5) : 0,
    byoMs: isByoyomi ? (timeControl.periodTime ?? 30) * 1000 : 0,
    inByoYomi: isByoyomi && mainMs === 0
  });
  return {
    black: playerClock(),
    white: playerClock(),
    turnStartedAt: null,
    activeColor: 'black',
    increment: timeControl.type === 'fischer' ? (timeControl.increment ?? 0) * 1000 : 0,
    periodMs: isByoyomi ? (timeControl.periodTime ?? 30) * 1000 : 0
  };
}

function deductTime(clock, color, elapsedMs) {
  const player = clock[color];
  if (player.inByoYomi) {
    player.byoMs -= elapsedMs;
    if (player.byoMs <= 0) {
      player.byoPeriods -= 1;
      if (player.byoPeriods <= 0) {
        player.byoPeriods = 0;
        player.byoMs = 0;
        return 'timeout';
      }
      player.byoMs = clock.periodMs;
    } else {
      // Moved within the period: reset the period timer for the next turn
      player.byoMs = clock.periodMs;
    }
  } else {
    player.mainMs -= elapsedMs;
    if (player.mainMs <= 0) {
      if (player.byoPeriods > 0) {
        const overflow = -player.mainMs;
        player.inByoYomi = true;
        player.mainMs = 0;
        player.byoMs = Math.max(0, clock.periodMs - overflow);
        if (player.byoMs <= 0) {
          player.byoPeriods -= 1;
          if (player.byoPeriods <= 0) {
            player.byoPeriods = 0;
            player.byoMs = 0;
            return 'timeout';
          }
          player.byoMs = clock.periodMs;
        }
      } else {
        player.mainMs = 0;
        return 'timeout';
      }
    } else if (clock.increment > 0) {
      player.mainMs += clock.increment;
    }
  }
  return null;
}

function clockSnapshot(clock) {
  if (!clock) return null;
  return {
    black: { ...clock.black },
    white: { ...clock.white },
    activeColor: clock.activeColor,
    turnStartedAt: clock.turnStartedAt,
    periodMs: clock.periodMs
  };
}

// --- Room helpers ---

function reconstructRoom(game) {
  const moves = game.moves ?? [];
  let consecutivePasses = 0;
  for (let i = moves.length - 1; i >= 0; i--) {
    if (moves[i].type === 'pass') consecutivePasses++;
    else break;
  }
  const activeColor = moves.length % 2 === 0 ? 'black' : 'white';
  const clock = initClock(game.timeControl);
  if (clock) {
    if (game.clockBlack) clock.black = { ...game.clockBlack };
    if (game.clockWhite) clock.white = { ...game.clockWhite };
    clock.activeColor = activeColor;
  }
  const corrDeadlineMs =
    game.timeControl?.type === 'correspondence' ? (game.timeControl.days ?? 3) * 86400000 : 0;
  const isSentinel = (name) => name === 'black' || name === 'white';
  const blackName = isSentinel(game.blackName) ? null : (game.blackName ?? null);
  const whiteName = isSentinel(game.whiteName) ? null : (game.whiteName ?? null);
  return {
    id: game.id,
    size: game.size,
    black: null,
    blackName,
    blackClientId: blackName,
    blackIsAuth: game.blackIsAuth ?? false,
    white: null,
    whiteName,
    whiteClientId: whiteName,
    whiteIsAuth: game.whiteIsAuth ?? false,
    creatorColor: game.creatorColor ?? 'black',
    status: game.status,
    timeControl: game.timeControl,
    local: game.gameType === 'local',
    consecutivePasses,
    activeColor,
    scoring: {
      active: game.scoringActive ?? false,
      deadStones: game.scoringDeadStones ?? [],
      blackApproved: game.scoringBlackApproved ?? false,
      whiteApproved: game.scoringWhiteApproved ?? false,
      signMap: null
    },
    clock,
    corrState: game.corrActiveColor
      ? { activeColor: game.corrActiveColor, turnDeadline: game.corrTurnDeadline }
      : null,
    corrDeadlineMs,
    analysisActive: false,
    analysisLog: [],
    analysisClients: new Set()
  };
}

function clientMatchesSeat(room, color, socket, clientId) {
  const seatClientId = color === 'black' ? room.blackClientId : room.whiteClientId;
  const seatIsAuth = color === 'black' ? room.blackIsAuth : room.whiteIsAuth;
  if (seatClientId !== clientId) return false;
  if (seatIsAuth && !socket.authenticatedUsername) return false;
  return true;
}

// --- Room management ---

export async function createRoom(
  size = 19,
  timeControl = { type: 'none' },
  color,
  gameType = 'hook',
  creatorName = null
) {
  const local = gameType === 'local';
  const id = await uniqueId();
  const creatorColor =
    color === 'random' ? (Math.random() > 0.5 ? 'black' : 'white') : (color ?? 'black');
  const blackName = creatorColor === 'black' && creatorName ? creatorName : null;
  const whiteName = creatorColor === 'white' && creatorName ? creatorName : null;
  const corrDeadlineMs =
    timeControl.type === 'correspondence' ? (timeControl.days ?? 3) * 86400000 : 0;
  const room = {
    id,
    size,
    black: null,
    blackName,
    blackClientId: blackName,
    blackIsAuth: !!blackName,
    white: null,
    whiteName,
    whiteClientId: whiteName,
    whiteIsAuth: !!whiteName,
    creatorColor,
    status: 'waiting',
    timeControl,
    local,
    consecutivePasses: 0,
    activeColor: 'black',
    scoring: {
      active: false,
      deadStones: [],
      blackApproved: false,
      whiteApproved: false,
      signMap: null
    },
    clock: initClock(timeControl),
    corrState: null,
    corrDeadlineMs,
    analysisActive: false,
    analysisLog: [],
    analysisClients: new Set()
  };
  rooms.set(id, room);
  const blackIsAuth = !!blackName;
  const whiteIsAuth = !!whiteName;
  await db.createGame({
    id,
    size,
    blackName,
    whiteName,
    blackIsAuth,
    whiteIsAuth,
    creatorColor,
    timeControl,
    local,
    gameType
  });
  return room;
}

export function getRoom(id) {
  return rooms.get(id);
}

export async function getPendingGames(tcType = null) {
  return await db.getPendingGames(tcType);
}

export async function findMatchingGame(size, timeControl, excludeUsername = null) {
  return await db.findMatchingGame(size, timeControl, excludeUsername);
}

export async function getUserGames(username) {
  return await db.getUserGames(username);
}

export function getLobbyStats() {
  return {
    playersOnline: lobbyClients.size,
    gamesInPlay: [...rooms.values()].filter((r) => r.status === 'playing').length
  };
}

function opponent(room, socket) {
  return socket === room.black ? room.white : room.black;
}

function opponentColor(color) {
  return color === 'black' ? 'white' : 'black';
}

async function endGameTimeout(room, gameId, loserColor) {
  const winner = opponentColor(loserColor);
  await db.updateGame(gameId, {
    status: 'finished',
    winner,
    result: winner === 'black' ? 'B+T' : 'W+T',
    endedAt: Date.now()
  });
  room.status = 'finished';
  sendBoth(room, { type: 'timeout', loser: loserColor });
}

async function handleMessage(socket, raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  if (msg.type === 'ping') {
    send(socket, { type: 'pong', ...getLobbyStats() });
    return;
  }

  if (msg.type === 'join') {
    const roomId = msg.gameId;
    const clientId = socket.authenticatedUsername ?? msg.username ?? `anon_${Date.now()}`;

    let room = rooms.get(roomId);
    if (!room) {
      const game = await db.getGame(roomId);
      if (!game) {
        send(socket, { type: 'error', message: 'Game not found' });
        return;
      }
      room = reconstructRoom(game);
      rooms.set(roomId, room);
    }

    if ((room.status === 'finished' || room.status === 'aborted') && !room.local) {
      const color = clientMatchesSeat(room, 'black', socket, clientId)
        ? 'black'
        : clientMatchesSeat(room, 'white', socket, clientId)
          ? 'white'
          : null;
      socket.gameId = roomId;
      socket.color = color;
      socket.username = clientId;
      room.analysisClients.add(socket);
      const joinMsg = { type: 'joined', gameId: roomId, color, status: room.status };
      if (room.analysisActive) {
        joinMsg.analysisActive = true;
        joinMsg.analysisLog = room.analysisLog;
      }
      send(socket, joinMsg);
      return;
    }

    let color;
    if (room.local) {
      color = 'black';
    } else if (clientMatchesSeat(room, 'black', socket, clientId)) {
      color = 'black';
    } else if (clientMatchesSeat(room, 'white', socket, clientId)) {
      color = 'white';
    } else if (room.status === 'abandoned') {
      send(socket, { type: 'joined', gameId: roomId, color: null, status: 'abandoned' });
      return;
    } else if (!room.blackClientId && !room.whiteClientId) {
      if (room.status !== 'waiting') {
        send(socket, { type: 'error', message: 'Game not available' });
        return;
      }
      color = room.creatorColor;
    } else if (!room.blackClientId) {
      if (room.status !== 'waiting') {
        send(socket, { type: 'error', message: 'Game not available' });
        return;
      }
      color = 'black';
    } else if (!room.whiteClientId) {
      if (room.status !== 'waiting') {
        send(socket, { type: 'error', message: 'Game not available' });
        return;
      }
      color = 'white';
    } else {
      const bothConnected = !!room.black && !!room.white;
      const spectatorStatus = bothConnected ? room.status : 'abandoned';
      send(socket, { type: 'joined', gameId: roomId, color: null, status: spectatorStatus });
      return;
    }

    const isAuth = !!socket.authenticatedUsername;
    if (color === 'black') {
      room.black = socket;
      room.blackClientId = clientId;
      room.blackIsAuth = isAuth;
      if (!room.local && !room.blackName) {
        room.blackName = clientId;
        await db.updateGame(roomId, { blackName: clientId, blackIsAuth: isAuth });
      }
    } else {
      room.white = socket;
      room.whiteClientId = clientId;
      room.whiteIsAuth = isAuth;
      if (!room.local && !room.whiteName) {
        room.whiteName = clientId;
        await db.updateGame(roomId, { whiteName: clientId, whiteIsAuth: isAuth });
      }
    }
    if (room.local) {
      room.white = socket;
      room.whiteClientId = clientId;
      room.whiteIsAuth = isAuth;
    }

    socket.color = color;
    socket.gameId = roomId;
    socket.username = clientId;

    if (room.local && (room.status === 'waiting' || room.status === 'aborted')) {
      room.status = 'playing';
      await db.updateGame(roomId, { status: 'playing', endedAt: null });
    } else if (room.blackName && room.whiteName && room.status === 'waiting') {
      room.status = 'playing';
      await db.updateGame(roomId, { status: 'playing' });
    } else if (room.status === 'abandoned') {
      room.status = 'playing';
    }

    if (
      room.timeControl?.type === 'correspondence' &&
      !room.corrState &&
      room.black &&
      room.white
    ) {
      room.corrState = {
        activeColor: 'black',
        turnDeadline: Date.now() + room.corrDeadlineMs
      };
      await db.updateGame(roomId, {
        corrActiveColor: 'black',
        corrTurnDeadline: room.corrState.turnDeadline
      });
    }

    if (room.black && room.white && room.black !== room.white) {
      const otherSocket = color === 'black' ? room.white : room.black;
      send(otherSocket, {
        type: 'opponent_joined',
        opponent: clientId,
        clock: clockSnapshot(room.clock),
        corrState: room.corrState ? { ...room.corrState } : null
      });
    }

    let corrTimeoutLoser = null;
    if (
      room.corrState?.turnDeadline &&
      Date.now() > room.corrState.turnDeadline &&
      room.status === 'playing'
    ) {
      corrTimeoutLoser = room.corrState.activeColor;
      const winner = opponentColor(corrTimeoutLoser);
      await db.updateGame(roomId, {
        status: 'finished',
        winner,
        result: winner === 'black' ? 'B+T' : 'W+T',
        endedAt: Date.now()
      });
      room.status = 'finished';
    }

    const oppSocket = color === 'black' ? room.white : room.black;
    send(socket, {
      type: 'joined',
      gameId: roomId,
      color,
      status: room.scoring.active ? 'scoring' : room.status,
      opponent: room.local ? null : (oppSocket?.username ?? null),
      clock: clockSnapshot(room.clock),
      corrState: room.corrState ? { ...room.corrState } : null
    });

    if (corrTimeoutLoser !== null) {
      sendBoth(room, { type: 'timeout', loser: corrTimeoutLoser });
    }

    if (!room.local && room.status === 'playing') {
      const oppSocket = color === 'black' ? room.white : room.black;
      if (!oppSocket) {
        send(socket, { type: 'opponent_left' });
      }
    }
    return;
  }

  // All other messages require an active room
  const room = rooms.get(socket.gameId);
  if (!room) return;

  if (msg.type === 'move' || msg.type === 'pass') {
    if (room.status !== 'playing') return;
    const opp = opponent(room, socket);
    const color = room.local ? (msg.color ?? socket.color) : socket.color;

    // Reject out-of-turn moves for multiplayer games
    if (!room.local && color !== room.activeColor) return;

    // Track consecutive passes server-side
    if (msg.type === 'pass') {
      room.consecutivePasses += 1;
    } else {
      room.consecutivePasses = 0;
    }

    // Persist the move
    const moveEntry =
      msg.type === 'move'
        ? { type: 'move', x: msg.x, y: msg.y, color, t: Date.now() }
        : { type: 'pass', color, t: Date.now() };
    await db.appendMove(socket.gameId, moveEntry);

    // Handle clock or correspondence deadline
    let clockData = null;
    let newCorrState = null;
    if (room.clock) {
      if (room.clock.turnStartedAt) {
        const elapsed = Date.now() - room.clock.turnStartedAt;
        const result = deductTime(room.clock, color, elapsed);
        if (result === 'timeout') {
          await endGameTimeout(room, socket.gameId, color);
          return;
        }
      }
      room.clock.activeColor = opponentColor(color);
      room.clock.turnStartedAt = Date.now();
      clockData = clockSnapshot(room.clock);
      await db.updateGame(socket.gameId, {
        clockBlack: { ...room.clock.black },
        clockWhite: { ...room.clock.white }
      });
    } else if (room.corrState) {
      if (room.corrState.turnDeadline && Date.now() > room.corrState.turnDeadline) {
        await endGameTimeout(room, socket.gameId, color);
        return;
      }
      room.corrState.activeColor = opponentColor(color);
      room.corrState.turnDeadline = Date.now() + room.corrDeadlineMs;
      await db.updateGame(socket.gameId, {
        corrActiveColor: room.corrState.activeColor,
        corrTurnDeadline: room.corrState.turnDeadline
      });
      newCorrState = { ...room.corrState };
    }

    room.activeColor = opponentColor(color);
    if (opp && opp !== socket)
      send(opp, { ...msg, color, clock: clockData, corrState: newCorrState });
    if (clockData) send(socket, { type: 'clock_update', clock: clockData });
    if (newCorrState) send(socket, { type: 'corr_update', corrState: newCorrState });
    return;
  }

  if (msg.type === 'flag') {
    if (room.status !== 'playing') return;
    const loser = room.local ? (msg.loser ?? socket.color) : socket.color;
    const winner = opponentColor(loser);
    await db.updateGame(socket.gameId, {
      status: 'finished',
      winner,
      result: winner === 'black' ? 'B+T' : 'W+T',
      endedAt: Date.now()
    });
    room.status = 'finished';
    sendBoth(room, { type: 'timeout', loser });
    return;
  }

  if (msg.type === 'abort') {
    if (room.status !== 'waiting') return;
    await db.updateGame(socket.gameId, { status: 'aborted', endedAt: Date.now() });
    room.status = 'aborted';
    sendBoth(room, { type: 'aborted' });
    return;
  }

  if (msg.type === 'resign') {
    if (room.status !== 'playing') return;
    const resigningColor = room.local ? (msg.color ?? socket.color) : socket.color;
    const winner = opponentColor(resigningColor);
    const result = winner === 'black' ? 'B+R' : 'W+R';
    await db.updateGame(socket.gameId, {
      status: 'finished',
      winner,
      result,
      endedAt: Date.now()
    });
    room.status = 'finished';
    const opp = opponent(room, socket);
    if (opp) send(opp, { type: 'resign', color: resigningColor });
    return;
  }

  if (msg.type === 'score_phase') {
    if (room.consecutivePasses < 2) return;
    room.scoring.active = true;
    room.scoring.deadStones = [];
    room.scoring.blackApproved = false;
    room.scoring.whiteApproved = false;
    await db.updateGame(socket.gameId, {
      scoringActive: true,
      scoringDeadStones: [],
      scoringBlackApproved: false,
      scoringWhiteApproved: false
    });
    sendBoth(room, { type: 'score_phase', deadStones: [] });
    return;
  }

  if (msg.type === 'mark_dead') {
    room.scoring.deadStones = msg.stones ?? [];
    room.scoring.blackApproved = false;
    room.scoring.whiteApproved = false;
    await db.updateGame(socket.gameId, {
      scoringDeadStones: room.scoring.deadStones,
      scoringBlackApproved: false,
      scoringWhiteApproved: false
    });
    sendBoth(room, {
      type: 'dead_stones_update',
      deadStones: room.scoring.deadStones,
      updatedBy: socket.color
    });
    return;
  }

  if (msg.type === 'chat') {
    const text = (msg.text ?? '').slice(0, 500);
    if (!text) return;
    const entry = { user: socket.username, text, t: Date.now() };
    await db.appendChat(socket.gameId, entry);
    const chatMsg = { type: 'chat', user: socket.username, text };
    const opp = opponent(room, socket);
    if (opp && opp !== socket) send(opp, chatMsg);
    return;
  }

  if (msg.type === 'approve_score') {
    const approvingColor = room.local ? (msg.color ?? socket.color) : socket.color;
    if (approvingColor === 'black') room.scoring.blackApproved = true;
    else room.scoring.whiteApproved = true;
    await db.updateGame(socket.gameId, {
      scoringBlackApproved: room.scoring.blackApproved,
      scoringWhiteApproved: room.scoring.whiteApproved
    });

    // Store the signMap from the first approver
    if (!room.scoring.signMap && msg.signMap) {
      room.scoring.signMap = msg.signMap;
    }

    sendBoth(room, {
      type: 'approve_update',
      blackApproved: room.scoring.blackApproved,
      whiteApproved: room.scoring.whiteApproved
    });

    if (room.scoring.blackApproved && room.scoring.whiteApproved) {
      await finalizeScore(room, socket.gameId);
    }
    return;
  }

  if (msg.type === 'analysis_start') {
    if (room.status !== 'finished' && room.status !== 'aborted') return;
    room.analysisActive = true;
    room.analysisLog = [];
    for (const client of room.analysisClients) {
      if (client !== socket) send(client, { type: 'analysis_start' });
    }
    return;
  }

  if (msg.type === 'analysis_move') {
    if (!room.analysisActive) return;
    room.analysisLog.push({ type: 'analysis_move', x: msg.x, y: msg.y });
    for (const client of room.analysisClients) {
      if (client !== socket) send(client, { type: 'analysis_move', x: msg.x, y: msg.y });
    }
    return;
  }

  if (msg.type === 'analysis_nav') {
    if (!room.analysisActive) return;
    room.analysisLog.push({ type: 'analysis_nav', action: msg.action });
    for (const client of room.analysisClients) {
      if (client !== socket) send(client, { type: 'analysis_nav', action: msg.action });
    }
    return;
  }

  if (msg.type === 'analysis_marker') {
    if (!room.analysisActive) return;
    room.analysisLog.push({ type: 'analysis_marker', x: msg.x, y: msg.y, tool: msg.tool });
    for (const client of room.analysisClients) {
      if (client !== socket) send(client, { type: 'analysis_marker', x: msg.x, y: msg.y, tool: msg.tool });
    }
    return;
  }
}

async function finalizeScore(room, gameId) {
  try {
    const { default: influence } = await import('@sabaki/influence');
    const game = await db.getGame(gameId);
    const komi = game?.komi ?? 6.5;
    const signMap = room.scoring.signMap;
    const deadStones = room.scoring.deadStones;

    // Build a set of dead stone coords for fast lookup
    const deadSet = new Set(deadStones.map(([x, y]) => `${x},${y}`));

    // Treat dead stones as empty for territory computation
    const boardForScoring = signMap.map((row, y) =>
      row.map((sign, x) => (deadSet.has(`${x},${y}`) ? 0 : sign))
    );

    const areaMap = influence.areaMap(boardForScoring);

    let blackScore = komi === 0 ? 0 : -komi; // komi goes to white
    let whiteScore = komi;

    for (let y = 0; y < areaMap.length; y++) {
      for (let x = 0; x < areaMap[y].length; x++) {
        const area = areaMap[y][x];
        if (area === 1) blackScore += 1;
        else if (area === -1) whiteScore += 1;
      }
    }

    // Add stones on board (area scoring)
    for (let y = 0; y < signMap.length; y++) {
      for (let x = 0; x < signMap[y].length; x++) {
        if (!deadSet.has(`${x},${y}`)) {
          if (signMap[y][x] === 1) blackScore += 1;
          else if (signMap[y][x] === -1) whiteScore += 1;
        }
      }
    }

    const winner = blackScore > whiteScore ? 'black' : 'white';
    const margin = Math.abs(blackScore - whiteScore).toFixed(1);
    const result = winner === 'black' ? `B+${margin}` : `W+${margin}`;

    await db.updateGame(gameId, {
      status: 'finished',
      winner,
      result,
      endedAt: Date.now(),
      scoringActive: false
    });
    room.status = 'finished';

    sendBoth(room, { type: 'score_result', winner, blackScore, whiteScore, result });
  } catch (e) {
    console.error('Score finalization failed:', e);
    sendBoth(room, { type: 'error', message: 'Score calculation failed' });
  }
}

function handleDisconnect(socket) {
  lobbyClients.delete(socket);
  const room = rooms.get(socket.gameId);
  if (!room) return;

  room.analysisClients.delete(socket);
  if (room.analysisActive && room.analysisClients.size === 0) {
    room.analysisActive = false;
    room.analysisLog = [];
  }

  if (room.local) {
    room.black = null;
    room.white = null;
    return;
  }

  const opp = opponent(room, socket);
  if (socket.color === 'black') room.black = null;
  else if (socket.color === 'white') room.white = null;
  if (opp && room.status === 'playing') send(opp, { type: 'opponent_left' });
  if (!room.black && !room.white && room.status === 'playing') room.status = 'abandoned';
}

export function attachWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', async (req, socket, head) => {
    if (req.url === '/ws') {
      wss.handleUpgrade(req, socket, head, async (ws) => {
        const cookieStr = req.headers.cookie ?? '';
        const sessionToken = parseCookieValue(cookieStr, 'session');
        const session = await db.getSession(sessionToken);
        ws.authenticatedUsername = session?.username ?? null;
        wss.emit('connection', ws, req);
      });
    }
  });

  wss.on('connection', (socket) => {
    lobbyClients.add(socket);
    socket.on('message', (raw) => {
      handleMessage(socket, raw.toString()).catch((err) => {
        console.error('WebSocket message handler error:', err);
      });
    });
    socket.on('close', () => handleDisconnect(socket));
  });
}

function parseCookieValue(cookieStr, name) {
  const match = cookieStr.split(';').find((c) => c.trim().startsWith(name + '='));
  return match ? match.trim().slice(name.length + 1) : null;
}

// Exported for unit testing only
export { handleMessage, handleDisconnect };
export function _reset() {
  rooms.clear();
  lobbyClients.clear();
}
export function _removeRoom(id) {
  rooms.delete(id);
}
