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

// --- Room management ---

export function createRoom(size = 19, timeControl = { type: 'none' }, color, local = false) {
	const id = uniqueId();

	const corrDeadlineMs =
		timeControl.type === 'correspondence' ? (timeControl.days ?? 3) * 86400000 : 0;
	const room = {
		id,
		size,
		black: null,
		blackName: null,
		white: null,
		whiteName: null,
		status: 'waiting',
		timeControl,
		local,
		consecutivePasses: 0,
		scoring: {
			active: false,
			deadStones: [],
			blackApproved: false,
			whiteApproved: false,
			signMap: null
		},
		clock: initClock(timeControl),
		corrState: null,
		corrDeadlineMs
	};
	if (color === 'black') {
		room.blackName = 'black';
	} else if (color === 'white') {
		room.whiteName = 'white';
	} else if (color === 'random') {
		const randomColor = Math.random() > 0.5 ? 'black' : 'white';
		if (randomColor === 'black') {
			room.blackName = 'black';
		} else {
			room.whiteName = 'white';
		}
	}
	rooms.set(id, room);
	db.createGame({ id, size, blackName: room.blackName, whiteName: room.whiteName, timeControl, local });
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

function endGameTimeout(room, gameId, loserColor) {
	const winner = opponentColor(loserColor);
	db.updateGame(gameId, {
		status: 'finished',
		winner,
		result: winner === 'black' ? 'B+T' : 'W+T',
		endedAt: Date.now()
	});
	room.status = 'finished';
	sendBoth(room, { type: 'timeout', loser: loserColor });
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
			const corrDeadlineMs =
				game.timeControl?.type === 'correspondence'
					? (game.timeControl.days ?? 3) * 86400000
					: 0;
			room = {
				id: roomId,
				size: game.size,
				black: null,
				blackName: game.blackName,
				white: null,
				whiteName: game.whiteName,
				status: game.status,
				timeControl: game.timeControl,
				local: game.local ?? false,
				consecutivePasses: 0,
				scoring: {
					active: false,
					deadStones: [],
					blackApproved: false,
					whiteApproved: false,
					signMap: null
				},
				clock: initClock(game.timeControl),
				corrState: game.corrActiveColor
					? { activeColor: game.corrActiveColor, turnDeadline: game.corrTurnDeadline }
					: null,
				corrDeadlineMs
			};
			rooms.set(roomId, room);
		}

		if (['aborted', 'abandoned'].includes(room.status)) {
			send(socket, { type: 'error', message: 'Game is over' });
			return;
		}

		const username = socket.authenticatedUsername ?? msg.username ?? 'Anonymous';
		const isAuthenticated = !!socket.authenticatedUsername;

		// Finished games are read-only: send the full historical state so the board
		// can be replayed, but don't seat the player or modify any room/db state.
		if (room.status === 'finished') {
			const game = db.getGame(roomId);
			const color =
				room.blackName === username ? 'black' : room.whiteName === username ? 'white' : null;
			send(socket, {
				type: 'joined',
				gameId: roomId,
				color,
				size: room.size,
				status: 'finished',
				local: room.local ?? false,
				blackName: room.blackName,
				whiteName: room.whiteName,
				opponent: null,
				winner: game?.winner ?? null,
				result: game?.result ?? null,
				moves: game?.moves ?? [],
				timeControl: room.timeControl,
				clock: null,
				corrState: null
			});
			return;
		}

		if (room.local) {
			// Determine which side is the user from the color sentinel set at room creation.
			// blackName === 'black' means the user chose black; otherwise they chose white.
			const userIsBlack = room.blackName === 'black';
			room.blackName = userIsBlack ? username : 'Guest';
			room.whiteName = userIsBlack ? 'Guest' : username;
			socket.color = 'black'; // single socket handles both sides
			room.black = socket;
			room.white = socket;
			room.status = 'playing';
			db.updateGame(roomId, {
				blackName: room.blackName,
				whiteName: room.whiteName,
				status: 'playing'
			});
		} else {
			// Prevent a currently-connected player from joining their own game as the other color.
			const occupiesBlack = room.blackName === username && room.black !== null;
			const occupiesWhite = room.whiteName === username && room.white !== null;
			if (username !== 'Anonymous' && (occupiesBlack || occupiesWhite)) {
				send(socket, { type: 'error', message: 'You are already in this game' });
				return;
			}

			if (isAuthenticated && room.blackName === username && !room.black) {
				// Authenticated player reconnecting as black
				socket.color = 'black';
				room.black = socket;
			} else if (isAuthenticated && room.whiteName === username && !room.white) {
				// Authenticated player reconnecting as white
				socket.color = 'white';
				room.white = socket;
			} else if (!room.black && !room.white) {
				// First player: seat them in their reserved color slot
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
				} else {
					send(socket, { type: 'error', message: 'Game not available' });
					return;
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
				db.updateGame(roomId, { whiteName: username });
			} else {
				send(socket, { type: 'error', message: 'Game is full' });
				return;
			}

			// Start the game when both seats are first filled
			if (room.black && room.white && room.status === 'waiting') {
				room.status = 'playing';
				db.updateGame(roomId, { status: 'playing' });
			}

			// Initialize correspondence state when game first goes live
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
				db.updateGame(roomId, {
					corrActiveColor: 'black',
					corrTurnDeadline: room.corrState.turnDeadline
				});
			}

			// Notify the already-connected player that their opponent arrived/reconnected
			if (room.black && room.white) {
				const otherSocket = socket.color === 'black' ? room.white : room.black;
				send(otherSocket, {
					type: 'opponent_joined',
					opponent: username,
					clock: clockSnapshot(room.clock),
					corrState: room.corrState ? { ...room.corrState } : null
				});
			}
		}

		socket.gameId = roomId;
		socket.username = username;

		// Check correspondence deadline on join
		let corrTimeoutLoser = null;
		if (
			room.corrState?.turnDeadline &&
			Date.now() > room.corrState.turnDeadline &&
			room.status === 'playing'
		) {
			corrTimeoutLoser = room.corrState.activeColor;
			const winner = opponentColor(corrTimeoutLoser);
			db.updateGame(roomId, {
				status: 'finished',
				winner,
				result: winner === 'black' ? 'B+T' : 'W+T',
				endedAt: Date.now()
			});
			room.status = 'finished';
		}

		const game = db.getGame(roomId);
		const oppSocket = socket.color === 'black' ? room.white : room.black;
		send(socket, {
			type: 'joined',
			gameId: roomId,
			color: socket.color,
			size: room.size,
			status: room.status,
			local: room.local ?? false,
			blackName: room.blackName,
			whiteName: room.whiteName,
			opponent: room.local ? null : (oppSocket?.username ?? null),
			winner: game?.winner ?? null,
			result: game?.result ?? null,
			moves: game?.moves ?? [],
			timeControl: room.timeControl,
			clock: clockSnapshot(room.clock),
			corrState: room.corrState ? { ...room.corrState } : null
		});

		if (corrTimeoutLoser !== null) {
			sendBoth(room, { type: 'timeout', loser: corrTimeoutLoser });
		}
		return;
	}

	// All other messages require an active room
	const room = rooms.get(socket.gameId);
	if (!room) return;

	if (msg.type === 'move' || msg.type === 'pass') {
		const opp = opponent(room, socket);
		const color = room.local ? (msg.color ?? socket.color) : socket.color;

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

		// Handle clock or correspondence deadline
		let clockData = null;
		let newCorrState = null;
		if (room.clock) {
			if (room.clock.turnStartedAt) {
				const elapsed = Date.now() - room.clock.turnStartedAt;
				const result = deductTime(room.clock, color, elapsed);
				if (result === 'timeout') {
					endGameTimeout(room, socket.gameId, color);
					return;
				}
			}
			room.clock.activeColor = opponentColor(color);
			room.clock.turnStartedAt = Date.now();
			clockData = clockSnapshot(room.clock);
		} else if (room.corrState) {
			if (room.corrState.turnDeadline && Date.now() > room.corrState.turnDeadline) {
				endGameTimeout(room, socket.gameId, color);
				return;
			}
			room.corrState.activeColor = opponentColor(color);
			room.corrState.turnDeadline = Date.now() + room.corrDeadlineMs;
			db.updateGame(socket.gameId, {
				corrActiveColor: room.corrState.activeColor,
				corrTurnDeadline: room.corrState.turnDeadline
			});
			newCorrState = { ...room.corrState };
		}

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
		db.updateGame(socket.gameId, {
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
		db.updateGame(socket.gameId, { status: 'aborted', endedAt: Date.now() });
		room.status = 'aborted';
		const opp = opponent(room, socket);
		if (opp) send(opp, { type: 'aborted' });
		send(socket, { type: 'aborted' });
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
		const approvingColor = room.local ? (msg.color ?? socket.color) : socket.color;
		if (approvingColor === 'black') room.scoring.blackApproved = true;
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

	if (room.local) {
		room.black = null;
		room.white = null;
		if (room.status === 'playing' || room.status === 'waiting') {
			room.status = 'aborted';
			db.updateGame(socket.gameId, { status: 'aborted', endedAt: Date.now() });
		}
		return;
	}

	// Anonymous players have no persistent identity and can't meaningfully reconnect.
	// Abort waiting games immediately; abandon playing games so the opponent is notified.
	if (!socket.authenticatedUsername) {
		if (socket.color === 'black') room.black = null;
		else if (socket.color === 'white') room.white = null;
		const opp = opponent(room, socket);
		if (room.status === 'waiting') {
			room.status = 'aborted';
			db.updateGame(socket.gameId, { status: 'aborted', endedAt: Date.now() });
			if (opp) send(opp, { type: 'aborted' });
		} else if (room.status === 'playing') {
			room.status = 'abandoned';
			db.updateGame(socket.gameId, { status: 'abandoned', endedAt: Date.now() });
			if (opp) send(opp, { type: 'opponent_left' });
		}
		return;
	}

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
