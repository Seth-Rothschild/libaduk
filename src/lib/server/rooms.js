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

function uniqueId() {
	let id = generateId();
	while (rooms.has(id) || db.getGame(id)) id = generateId();
	return id;
}

function send(socket, msg) {
	if (socket && socket.readyState === socket.OPEN) {
		socket.send(JSON.stringify(msg));
	}
}

function sendBoth(room, msg) {
	send(room.black, msg);
	send(room.white, msg);
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
		inByoYomi: false
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
			// Reset period time — stored on the clock as periodMs
			player.byoMs = clock.periodMs;
		}
	} else {
		player.mainMs -= elapsedMs;
		if (player.mainMs <= 0) {
			if (player.byoPeriods > 0) {
				player.inByoYomi = true;
				player.mainMs = 0;
			} else {
				player.mainMs = 0;
				if (clock.increment > 0) {
					// For Fischer, if mainMs hits 0 with no increment saved up, flag timeout
					return 'timeout';
				}
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
		turnStartedAt: clock.turnStartedAt
	};
}

// --- Room management ---

export function createRoom(size = 19, timeControl = { type: 'none' }, color) {
	const id = uniqueId();
	
	const room = {
		id,
		size,
		black: null,
		blackName: null,
		white: null,
		whiteName: null,
		status: 'waiting',
		timeControl,
		consecutivePasses: 0,
		scoring: { active: false, deadStones: [], blackApproved: false, whiteApproved: false, signMap: null },
		clock: initClock(timeControl)
	};
	if (color === 'black') {
		room.blackName = 'black';
	} else if (color === 'white') {
		room.whiteName = 'white';
	}
	rooms.set(id, room);
	db.createGame({ id, size, blackName: null, timeControl });
	return room;
}

export function getRoom(id) {
	return rooms.get(id);
}

export function getPendingGames() {
	return db.getPendingGames();
}

export function getUserGames(username) {
	return db.getUserGames(username);
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

function handleMessage(socket, raw) {
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

		// Try in-memory room first, then reconstruct from DB on reconnect
		let room = rooms.get(roomId);
		if (!room) {
			const game = db.getGame(roomId);
			if (!game) {
				send(socket, { type: 'error', message: 'Game not found' });
				return;
			}
			// Reconstruct skeleton room from DB for reconnection
			room = {
				id: roomId,
				size: game.size,
				black: null,
				blackName: game.blackName,
				white: null,
				whiteName: game.whiteName,
				status: game.status,
				timeControl: game.timeControl,
				consecutivePasses: 0,
				scoring: { active: false, deadStones: [], blackApproved: false, whiteApproved: false, signMap: null },
				clock: initClock(game.timeControl)
			};
			rooms.set(roomId, room);
		}

		const username = socket.authenticatedUsername ?? msg.username ?? 'Anonymous';

		// Reconnection: allow a player to reclaim their color
		const isReturningBlack = room.blackName === username;
		const isReturningWhite = room.whiteName === username;

		if (isReturningBlack && !room.black) {
			socket.color = 'black';
			room.black = socket;
		} else if (isReturningWhite && !room.white) {
			socket.color = 'white';
			room.white = socket;
		} else if (!room.black && !room.white) {
			if (room.blackName === 'black') {
				socket.color = 'black';
				room.black = socket;
				room.blackName = username;
				db.updateGame(roomId, { blackName: username });
			} else if (room.whiteName === 'white') {
				socket.color = 'white';
				room.white = socket;
				room.whiteName = username;
				db.updateGame(roomId, { whiteName: username });
			}
		} else if (!room.black) {
			socket.color = 'black';
			room.black = socket;
			room.blackName = username;
			db.updateGame(roomId, { blackName: username });
		} else if (!room.white) {
			socket.color = 'white';
			room.white = socket;
			room.whiteName = username;
			room.status = 'playing';
			db.updateGame(roomId, { whiteName: username, status: 'playing' });
		} else {
			send(socket, { type: 'error', message: 'Game is full' });
			return;
		}

		if (room.black && room.white) {
			send(room.black, { type: 'opponent_joined', opponent: username, clock: clockSnapshot(room.clock) });
			send(room.white, { type: 'opponent_joined', opponent: username, clock: clockSnapshot(room.clock) });
		}

		socket.gameId = roomId;
		socket.username = username;

		const game = db.getGame(roomId);
		send(socket, {
			type: 'joined',
			gameId: roomId,
			color: socket.color,
			size: room.size,
			opponent: opponent(room, socket)?.username ?? null,
			moves: game?.moves ?? [],
			timeControl: room.timeControl,
			clock: clockSnapshot(room.clock)
		});
		return;
	}

	// All other messages require an active room
	const room = rooms.get(socket.gameId);
	if (!room) return;

	if (msg.type === 'move' || msg.type === 'pass') {
		const opp = opponent(room, socket);
		const color = socket.color;

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
		db.appendMove(socket.gameId, moveEntry);

		// Handle clock
		let clockData = null;
		if (room.clock) {
			if (room.clock.turnStartedAt) {
				const elapsed = Date.now() - room.clock.turnStartedAt;
				const result = deductTime(room.clock, color, elapsed);
				if (result === 'timeout') {
					const winner = opponentColor(color);
					db.updateGame(socket.gameId, {
						status: 'finished',
						winner,
						result: winner === 'black' ? 'B+T' : 'W+T',
						endedAt: Date.now()
					});
					room.status = 'finished';
					sendBoth(room, { type: 'timeout', loser: color });
					return;
				}
			}
			room.clock.activeColor = opponentColor(color);
			room.clock.turnStartedAt = Date.now();
			clockData = clockSnapshot(room.clock);
		}

		if (opp) send(opp, { ...msg, color, clock: clockData });
		if (clockData) send(socket, { type: 'clock_update', clock: clockData });
		return;
	}

	if (msg.type === 'resign') {
		const winner = opponentColor(socket.color);
		const result = winner === 'black' ? 'B+R' : 'W+R';
		db.updateGame(socket.gameId, {
			status: 'finished',
			winner,
			result,
			endedAt: Date.now()
		});
		room.status = 'finished';
		const opp = opponent(room, socket);
		if (opp) send(opp, { type: 'resign', color: socket.color });
		return;
	}

	if (msg.type === 'score_phase') {
		if (room.consecutivePasses < 2) return;
		room.scoring.active = true;
		sendBoth(room, { type: 'score_phase', deadStones: [] });
		return;
	}

	if (msg.type === 'mark_dead') {
		room.scoring.deadStones = msg.stones ?? [];
		room.scoring.blackApproved = false;
		room.scoring.whiteApproved = false;
		sendBoth(room, {
			type: 'dead_stones_update',
			deadStones: room.scoring.deadStones,
			updatedBy: socket.color
		});
		return;
	}

	if (msg.type === 'approve_score') {
		if (socket.color === 'black') room.scoring.blackApproved = true;
		else room.scoring.whiteApproved = true;

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
			finalizeScore(room, socket.gameId);
		}
		return;
	}
}

async function finalizeScore(room, gameId) {
	try {
		const { default: influence } = await import('@sabaki/influence');
		const game = db.getGame(gameId);
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

		db.updateGame(gameId, { status: 'finished', winner, result, endedAt: Date.now() });
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
	const opp = opponent(room, socket);
	if (opp) send(opp, { type: 'opponent_left' });
	// Null out the socket but keep the room/DB record for reconnection
	if (socket.color === 'black') room.black = null;
	else if (socket.color === 'white') room.white = null;
	// If both players gone, mark abandoned but keep in DB
	if (!room.black && !room.white && room.status === 'playing') {
		room.status = 'abandoned';
		db.updateGame(socket.gameId, { status: 'abandoned' });
	}
}

export function attachWebSocketServer(httpServer) {
	const wss = new WebSocketServer({ noServer: true });

	httpServer.on('upgrade', (req, socket, head) => {
		if (req.url === '/ws') {
			wss.handleUpgrade(req, socket, head, (ws) => {
				// Attach authenticated username from session cookie if present
				const cookieStr = req.headers.cookie ?? '';
				const sessionToken = parseCookieValue(cookieStr, 'session');
				const sessions = global.__sessions;
				const session = sessionToken && sessions ? sessions.get(sessionToken) : null;
				ws.authenticatedUsername = session?.username ?? null;
				wss.emit('connection', ws, req);
			});
		}
	});

	wss.on('connection', (socket) => {
		lobbyClients.add(socket);
		socket.on('message', (raw) => handleMessage(socket, raw.toString()));
		socket.on('close', () => handleDisconnect(socket));
	});
}

function parseCookieValue(cookieStr, name) {
	const match = cookieStr.split(';').find((c) => c.trim().startsWith(name + '='));
	return match ? match.trim().slice(name.length + 1) : null;
}
