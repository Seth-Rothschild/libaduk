import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---- In-memory mock for db.js ----------------------------------------
// vi.mock is hoisted, so the factory runs before any imports below.
// We expose _store so beforeEach can reset it without re-importing.

vi.mock('./db.js', () => {
	const store = { games: {}, sessions: {} };
	return {
		_store: store,
		getGame: (id) => store.games[id] ?? null,
		createGame: ({ id, size, blackName, whiteName, creatorColor, timeControl, komi, gameType }) => {
			const game = {
				id,
				size,
				blackName: blackName ?? null,
				whiteName: whiteName ?? null,
				creatorColor: creatorColor ?? 'black',
				gameType: gameType ?? 'hook',
				moves: [],
				status: 'waiting',
				timeControl: timeControl ?? { type: 'none' },
				komi: komi ?? 6.5,
				createdAt: Date.now(),
				endedAt: null,
				winner: null,
				result: null,
				corrActiveColor: null,
				corrTurnDeadline: null
			};
			store.games[id] = game;
			return game;
		},
		updateGame: (id, patch) => {
			if (store.games[id]) Object.assign(store.games[id], patch);
		},
		appendMove: (id, entry) => {
			if (store.games[id]) store.games[id].moves.push(entry);
		},
		getPendingGames: () =>
			Object.values(store.games)
				.filter((g) => g.status === 'waiting')
				.map((g) => ({
					id: g.id,
					creator: g.blackName || g.whiteName,
					size: g.size,
					timeControl: g.timeControl,
					createdAt: g.createdAt
				})),
		appendChat: () => {},
		getChat: () => [],
		getNote: () => '',
		getSession: (token) => store.sessions[token] ?? null,
		getUserGames: () => [],
		getAllActiveGames: () => Object.values(store.games).filter((g) => g.status === 'playing')
	};
});

import * as dbMock from './db.js';
import { createRoom, handleMessage, handleDisconnect, _reset, _removeRoom } from './rooms.js';

// ---- Helpers -----------------------------------------------------------

function makeSocket(opts = {}) {
	const sent = [];
	const sock = {
		readyState: 1,
		OPEN: 1,
		authenticatedUsername: opts.username ?? null,
		color: null,
		gameId: null,
		username: null,
		sent,
		send(raw) {
			sent.push(JSON.parse(raw));
		},
		lastMsg() {
			return sent.at(-1);
		},
		msgs() {
			return [...sent];
		}
	};
	return sock;
}

function send(socket, data) {
	handleMessage(socket, JSON.stringify(data));
}

function join(socket, gameId, username) {
	send(socket, { type: 'join', gameId, username });
}

beforeEach(() => {
	_reset();
	const s = dbMock._store;
	for (const k of Object.keys(s.games)) delete s.games[k];
	for (const k of Object.keys(s.sessions)) delete s.sessions[k];
});

// ---- Tests -------------------------------------------------------------

describe('ping', () => {
	it('returns pong with lobby stats', () => {
		const sock = makeSocket();
		send(sock, { type: 'ping' });
		// playersOnline is driven by the WS connection handler (lobbyClients set),
		// which isn't invoked in unit tests — just verify the shape.
		expect(sock.lastMsg()).toMatchObject({ type: 'pong', gamesInPlay: 0 });
		expect(typeof sock.lastMsg().playersOnline).toBe('number');
	});
});

describe('join', () => {
	it('errors on non-existent game', () => {
		const sock = makeSocket();
		join(sock, 'nope', 'Alice');
		expect(sock.lastMsg()).toMatchObject({ type: 'error', message: 'Game not found' });
	});

	it('returns slim joined for aborted game', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		dbMock._store.games[room.id].status = 'aborted';
		room.status = 'aborted';
		const sock = makeSocket();
		join(sock, room.id, 'Alice');
		expect(sock.lastMsg()).toMatchObject({ type: 'joined', status: 'aborted' });
	});

	it('sends slim joined for abandoned game (no moves — HTTP provides those)', () => {
		const room = createRoom(9, { type: 'none' }, 'black');
		const alice = makeSocket();
		const bob = makeSocket();
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		send(alice, { type: 'move', x: 3, y: 3 });
		send(bob, { type: 'move', x: 4, y: 4 });
		handleDisconnect(alice);
		handleDisconnect(bob);

		const viewer = makeSocket();
		join(viewer, room.id, 'Carol');
		const msg = viewer.lastMsg();
		expect(msg.type).toBe('joined');
		expect(msg.status).toBe('abandoned');
		expect(msg.color).toBeNull();
		expect(msg.moves).toBeUndefined();
	});

	it('first player joins and gets waiting status', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket();
		join(alice, room.id, 'Alice');
		expect(alice.lastMsg()).toMatchObject({
			type: 'joined',
			color: 'black',
			status: 'waiting'
		});
	});

	it('second player joins and both get playing status', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket();
		const bob = makeSocket();
		join(alice, room.id, 'Alice');
		alice.sent.length = 0;
		join(bob, room.id, 'Bob');
		expect(bob.lastMsg()).toMatchObject({ type: 'joined', color: 'white', status: 'playing' });
		expect(alice.lastMsg()).toMatchObject({ type: 'opponent_joined', opponent: 'Bob' });
	});

	it('third player is rejected', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket();
		const bob = makeSocket();
		const carol = makeSocket();
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		join(carol, room.id, 'Carol');
		expect(carol.lastMsg()).toMatchObject({ type: 'error', message: 'Game is full' });
	});

	it('same socket rejoining gets a joined response (reconnect)', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket();
		join(alice, room.id, 'Alice');
		alice.sent.length = 0;
		join(alice, room.id, 'Alice');
		expect(alice.lastMsg()).toMatchObject({ type: 'joined', color: 'black' });
	});

	it('authenticated player can rejoin after disconnect', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket({ username: 'Alice' });
		const bob = makeSocket({ username: 'Bob' });
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		// Alice disconnects
		handleDisconnect(alice);
		// Alice reconnects with a new socket
		const alice2 = makeSocket({ username: 'Alice' });
		join(alice2, room.id, 'Alice');
		expect(alice2.lastMsg()).toMatchObject({ type: 'joined', color: 'black' });
	});

	it('lobby sentinel is not stored in DB as creator name', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const game = dbMock._store.games[room.id];
		// Before the player joins via WS, blackName in DB must be null, not 'black'
		expect(game.blackName).toBeNull();
	});

	it('creator name appears in DB after WS join', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket();
		join(alice, room.id, 'Alice');
		expect(dbMock._store.games[room.id].blackName).toBe('Alice');
	});

	it('joined response includes color and status but not game data (HTTP provides that)', () => {
		const room = createRoom(9, { type: 'fischer', initial: 300, increment: 5 }, 'black');
		const alice = makeSocket();
		join(alice, room.id, 'Alice');
		const msg = alice.lastMsg();
		expect(msg).toMatchObject({ type: 'joined', color: 'black', status: 'waiting' });
		expect(msg.size).toBeUndefined();
		expect(msg.timeControl).toBeUndefined();
		expect(msg.moves).toBeUndefined();
	});

	it('sends slim joined for finished game (no moves — HTTP provides those)', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket();
		const bob = makeSocket();
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		send(alice, { type: 'resign' });
		const observer = makeSocket();
		join(observer, room.id, 'Carol');
		const msg = observer.lastMsg();
		expect(msg).toMatchObject({ type: 'joined', status: 'finished' });
		expect(msg.moves).toBeUndefined();
	});

	it('finished game joined includes color for participants', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket({ username: 'Alice' });
		const bob = makeSocket({ username: 'Bob' });
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		send(alice, { type: 'resign' });
		handleDisconnect(alice);
		handleDisconnect(bob);
		const alice2 = makeSocket({ username: 'Alice' });
		join(alice2, room.id, 'Alice');
		const msg = alice2.lastMsg();
		expect(msg).toMatchObject({ type: 'joined', status: 'finished', color: 'black' });
	});
});

describe('move relay', () => {
	function setupGame() {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket();
		const bob = makeSocket();
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		alice.sent.length = 0;
		bob.sent.length = 0;
		return { room, alice, bob };
	}

	it('move is forwarded to opponent', () => {
		const { alice, bob } = setupGame();
		send(alice, { type: 'move', x: 3, y: 3 });
		expect(bob.lastMsg()).toMatchObject({ type: 'move', x: 3, y: 3 });
	});

	it('pass is forwarded to opponent', () => {
		const { alice, bob } = setupGame();
		send(alice, { type: 'pass' });
		expect(bob.lastMsg()).toMatchObject({ type: 'pass' });
	});

	it('move is not sent back to sender (only clock update)', () => {
		const { alice } = setupGame();
		send(alice, { type: 'move', x: 3, y: 3 });
		// Alice should get no message (no clock on unlimited game)
		expect(alice.sent.length).toBe(0);
	});

	it('move appended to DB', () => {
		const { room, alice } = setupGame();
		send(alice, { type: 'move', x: 5, y: 5 });
		expect(dbMock._store.games[room.id].moves).toHaveLength(1);
		expect(dbMock._store.games[room.id].moves[0]).toMatchObject({ type: 'move', x: 5, y: 5 });
	});

	it('messages before joining a game are ignored', () => {
		const sock = makeSocket();
		send(sock, { type: 'move', x: 3, y: 3 });
		expect(sock.sent.length).toBe(0);
	});

	it('malformed JSON is silently ignored', () => {
		const sock = makeSocket();
		handleMessage(sock, 'not json {{');
		expect(sock.sent.length).toBe(0);
	});
});

describe('score phase', () => {
	function setupWithTwoPasses() {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket();
		const bob = makeSocket();
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		send(alice, { type: 'pass' });
		send(bob, { type: 'pass' });
		alice.sent.length = 0;
		bob.sent.length = 0;
		return { room, alice, bob };
	}

	it('score_phase before 2 consecutive passes is ignored', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket();
		const bob = makeSocket();
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		send(alice, { type: 'pass' }); // only 1 pass
		alice.sent.length = 0;
		send(alice, { type: 'score_phase' });
		expect(alice.sent.length).toBe(0);
	});

	it('score_phase after 2 passes is sent to both', () => {
		const { alice, bob } = setupWithTwoPasses();
		send(alice, { type: 'score_phase' });
		expect(alice.lastMsg()).toMatchObject({ type: 'score_phase', deadStones: [] });
		expect(bob.lastMsg()).toMatchObject({ type: 'score_phase', deadStones: [] });
	});

	it('mark_dead resets approvals and notifies both', () => {
		const { alice, bob } = setupWithTwoPasses();
		send(alice, { type: 'score_phase' });
		alice.sent.length = 0;
		bob.sent.length = 0;
		send(alice, { type: 'mark_dead', stones: [[3, 3]] });
		expect(alice.lastMsg()).toMatchObject({ type: 'dead_stones_update', deadStones: [[3, 3]] });
		expect(bob.lastMsg()).toMatchObject({ type: 'dead_stones_update', deadStones: [[3, 3]] });
	});

	it('approve_update is sent to both after one approval', () => {
		const { alice, bob } = setupWithTwoPasses();
		send(alice, { type: 'score_phase' });
		alice.sent.length = 0;
		bob.sent.length = 0;
		send(alice, { type: 'approve_score', signMap: [[]] });
		expect(alice.lastMsg()).toMatchObject({
			type: 'approve_update',
			blackApproved: true,
			whiteApproved: false
		});
		expect(bob.lastMsg()).toMatchObject({
			type: 'approve_update',
			blackApproved: true,
			whiteApproved: false
		});
	});

	it('mark_dead after approval resets approvals', () => {
		const { alice, bob } = setupWithTwoPasses();
		send(alice, { type: 'score_phase' });
		send(alice, { type: 'approve_score', signMap: [[]] });
		alice.sent.length = 0;
		bob.sent.length = 0;
		send(bob, { type: 'mark_dead', stones: [] });
		// dead_stones_update resets both approvals — verify subsequent approve_update reflects reset
		send(alice, { type: 'approve_score', signMap: [[]] });
		const approveMsg = alice.msgs().find((m) => m.type === 'approve_update');
		expect(approveMsg).toMatchObject({ blackApproved: true, whiteApproved: false });
	});
});

describe('resign', () => {
	function setupGame() {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket();
		const bob = makeSocket();
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		alice.sent.length = 0;
		bob.sent.length = 0;
		return { room, alice, bob };
	}

	it('black resigning makes white the winner', () => {
		const { room, alice, bob } = setupGame();
		send(alice, { type: 'resign' });
		expect(bob.lastMsg()).toMatchObject({ type: 'resign', color: 'black' });
		expect(dbMock._store.games[room.id]).toMatchObject({
			status: 'finished',
			winner: 'white',
			result: 'W+R'
		});
	});

	it('white resigning makes black the winner', () => {
		const { room, alice, bob } = setupGame();
		send(bob, { type: 'resign' });
		expect(alice.lastMsg()).toMatchObject({ type: 'resign', color: 'white' });
		expect(dbMock._store.games[room.id]).toMatchObject({
			status: 'finished',
			winner: 'black',
			result: 'B+R'
		});
	});

	it('local game: white can resign by sending color field', () => {
		const room = createRoom(19, { type: 'none' }, 'black', 'local');
		const sock = makeSocket();
		join(sock, room.id, 'Player');
		sock.sent.length = 0;
		send(sock, { type: 'resign', color: 'white' });
		expect(dbMock._store.games[room.id]).toMatchObject({ winner: 'black', result: 'B+R' });
	});
});

describe('abort', () => {
	it('aborts a waiting game and notifies both sockets', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket();
		const bob = makeSocket();
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		// manually reset status to waiting for test (second join makes it playing in this test)
		room.status = 'waiting';
		dbMock._store.games[room.id].status = 'waiting';
		alice.sent.length = 0;
		bob.sent.length = 0;
		send(alice, { type: 'abort' });
		expect(alice.lastMsg()).toMatchObject({ type: 'aborted' });
		expect(bob.lastMsg()).toMatchObject({ type: 'aborted' });
		expect(room.status).toBe('aborted');
	});

	it('abort on a playing game is ignored', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket();
		const bob = makeSocket();
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		alice.sent.length = 0;
		send(alice, { type: 'abort' });
		expect(alice.sent.length).toBe(0);
	});
});

describe('flag / timeout', () => {
	it('flag from a player marks them as loser', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket();
		const bob = makeSocket();
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		alice.sent.length = 0;
		bob.sent.length = 0;
		send(alice, { type: 'flag', loser: 'black' });
		expect(alice.lastMsg()).toMatchObject({ type: 'timeout', loser: 'black' });
		expect(bob.lastMsg()).toMatchObject({ type: 'timeout', loser: 'black' });
		expect(dbMock._store.games[room.id]).toMatchObject({ status: 'finished', winner: 'white' });
	});

	it('flag on a finished game is ignored', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket();
		const bob = makeSocket();
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		send(alice, { type: 'resign' });
		alice.sent.length = 0;
		bob.sent.length = 0;
		send(alice, { type: 'flag', loser: 'black' });
		expect(alice.sent.length).toBe(0);
	});
});

describe('disconnect', () => {
	it('anonymous player disconnecting while waiting preserves the room for reconnect', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket(); // anonymous
		join(alice, room.id, 'Guest1234');
		handleDisconnect(alice);
		expect(room.status).toBe('waiting');
		expect(dbMock._store.games[room.id].status).toBe('waiting');
	});

	it('anonymous player disconnecting while playing notifies opponent', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket(); // anonymous
		const bob = makeSocket();
		join(alice, room.id, 'Guest1234');
		join(bob, room.id, 'Bob');
		bob.sent.length = 0;
		handleDisconnect(alice);
		expect(bob.lastMsg()).toMatchObject({ type: 'opponent_left' });
		// Room stays playing — anonymous guest can still reconnect with their guestId
		expect(room.status).toBe('playing');
	});

	it('anonymous player can reconnect using the same guestId', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket(); // anonymous
		const bob = makeSocket();
		join(alice, room.id, 'Guest1234');
		join(bob, room.id, 'Bob');
		handleDisconnect(alice);
		const alice2 = makeSocket(); // new socket, same anonymous identity
		join(alice2, room.id, 'Guest1234');
		expect(alice2.lastMsg()).toMatchObject({ type: 'joined', color: 'black' });
	});

	it('authenticated player disconnecting notifies opponent but preserves room', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket({ username: 'Alice' });
		const bob = makeSocket({ username: 'Bob' });
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		bob.sent.length = 0;
		handleDisconnect(alice);
		expect(bob.lastMsg()).toMatchObject({ type: 'opponent_left' });
		// Room stays playing, not abandoned, because authenticated players can reconnect
		expect(room.status).toBe('playing');
		expect(room.black).toBeNull();
	});

	it('both authenticated players disconnecting marks room abandoned', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket({ username: 'Alice' });
		const bob = makeSocket({ username: 'Bob' });
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		handleDisconnect(alice);
		handleDisconnect(bob);
		expect(room.status).toBe('abandoned');
	});

	it('disconnect on a finished game does not change status', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket({ username: 'Alice' });
		const bob = makeSocket({ username: 'Bob' });
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		send(alice, { type: 'resign' });
		handleDisconnect(alice);
		expect(room.status).toBe('finished');
	});

	it('disconnect when not in any game does nothing', () => {
		const sock = makeSocket();
		// Should not throw
		expect(() => handleDisconnect(sock)).not.toThrow();
	});
});

describe('clock — byo-yomi', () => {
	const TC = { type: 'byoyomi', initial: 60, periods: 3, periodTime: 30 };

	function setupTimedGame() {
		const room = createRoom(19, TC, 'black');
		const alice = makeSocket();
		const bob = makeSocket();
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		alice.sent.length = 0;
		bob.sent.length = 0;
		return { room, alice, bob };
	}

	it('clock snapshot is included in move relay', () => {
		const { alice, bob } = setupTimedGame();
		send(alice, { type: 'move', x: 3, y: 3 });
		const bobMsg = bob.lastMsg();
		expect(bobMsg.clock).toBeDefined();
		expect(bobMsg.clock.activeColor).toBe('white');
	});

	it('sender gets clock_update after a move', () => {
		const { alice } = setupTimedGame();
		send(alice, { type: 'move', x: 3, y: 3 });
		const clockMsg = alice.msgs().find((m) => m.type === 'clock_update');
		expect(clockMsg).toBeDefined();
		expect(clockMsg.clock.activeColor).toBe('white');
	});

	it('timeout detected when clock expires during move', () => {
		const { room, alice, bob } = setupTimedGame();
		// Simulate clock already in byo-yomi with no periods left
		room.clock.black.mainMs = 0;
		room.clock.black.inByoYomi = true;
		room.clock.black.byoPeriods = 1;
		room.clock.black.byoMs = 0; // fully expired
		room.clock.turnStartedAt = Date.now() - 100000; // way overdue
		bob.sent.length = 0;
		alice.sent.length = 0;
		send(alice, { type: 'move', x: 3, y: 3 });
		expect(alice.lastMsg()).toMatchObject({ type: 'timeout', loser: 'black' });
		expect(bob.lastMsg()).toMatchObject({ type: 'timeout', loser: 'black' });
	});
});

describe('status guards', () => {
	function setupFinishedGame() {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket();
		const bob = makeSocket();
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		send(alice, { type: 'resign' });
		alice.sent.length = 0;
		bob.sent.length = 0;
		return { room, alice, bob };
	}

	it('move on a finished game is ignored and does not corrupt DB', () => {
		const { room, alice } = setupFinishedGame();
		const movesBefore = dbMock._store.games[room.id].moves.length;
		send(alice, { type: 'move', x: 3, y: 3 });
		expect(dbMock._store.games[room.id].moves.length).toBe(movesBefore);
		expect(alice.sent.length).toBe(0);
	});

	it('pass on a finished game is ignored', () => {
		const { alice, bob } = setupFinishedGame();
		send(alice, { type: 'pass' });
		expect(bob.sent.length).toBe(0);
	});

	it('resign on a finished game does not overwrite the result', () => {
		const { room, bob } = setupFinishedGame();
		const originalResult = dbMock._store.games[room.id].result;
		// Bob tries to resign after Alice already resigned
		send(bob, { type: 'resign' });
		expect(dbMock._store.games[room.id].result).toBe(originalResult);
		expect(bob.sent.length).toBe(0);
	});
});

describe('seat stealing', () => {
	it('third party cannot take a disconnected authenticated player seat', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket({ username: 'Alice' });
		const bob = makeSocket({ username: 'Bob' });
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		// Alice disconnects mid-game
		handleDisconnect(alice);
		expect(room.black).toBeNull();
		// Charlie navigates to the game URL
		const charlie = makeSocket({ username: 'Charlie' });
		join(charlie, room.id, 'Charlie');
		expect(charlie.lastMsg()).toMatchObject({ type: 'error' });
		// Alice's name is preserved
		expect(room.blackName).toBe('Alice');
	});

	it('disconnected authenticated player can still reclaim their seat', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket({ username: 'Alice' });
		const bob = makeSocket({ username: 'Bob' });
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		handleDisconnect(alice);
		const alice2 = makeSocket({ username: 'Alice' });
		join(alice2, room.id, 'Alice');
		expect(alice2.lastMsg()).toMatchObject({ type: 'joined', color: 'black' });
	});
});

describe('clock — timing details', () => {
	const TC = { type: 'byoyomi', initial: 60, periods: 3, periodTime: 30 };

	function setupTimedGame2() {
		const room = createRoom(19, TC, 'black');
		const alice = makeSocket();
		const bob = makeSocket();
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		alice.sent.length = 0;
		bob.sent.length = 0;
		return { room, alice, bob };
	}

	it('no clock deduction on the very first move (turnStartedAt is null)', () => {
		const { room, alice } = setupTimedGame2();
		const mainMsBefore = room.clock.black.mainMs;
		// turnStartedAt is null until first move
		expect(room.clock.turnStartedAt).toBeNull();
		send(alice, { type: 'move', x: 3, y: 3 });
		// No deduction — same main time
		expect(room.clock.black.mainMs).toBe(mainMsBefore);
		// But turnStartedAt is now set
		expect(room.clock.turnStartedAt).not.toBeNull();
	});

	it('byo-yomi period resets to full after moving within the period', () => {
		const { room, alice, bob } = setupTimedGame2();
		// First move to set turnStartedAt
		send(alice, { type: 'move', x: 3, y: 3 });
		send(bob, { type: 'move', x: 4, y: 4 });
		alice.sent.length = 0;
		// Drain main time, enter byo-yomi
		room.clock.black.mainMs = 0;
		room.clock.black.inByoYomi = true;
		room.clock.black.byoPeriods = 3;
		room.clock.black.byoMs = 30000;
		// Alice uses 5 seconds of the 30-second period
		room.clock.turnStartedAt = Date.now() - 5000;
		send(alice, { type: 'move', x: 5, y: 5 });
		// Period should reset to full 30s, not reduced to 25s
		expect(room.clock.black.byoMs).toBe(30000);
		expect(room.clock.black.byoPeriods).toBe(3); // no period lost
	});

	it('byo-yomi period is lost when the full period elapses', () => {
		const { room, alice, bob } = setupTimedGame2();
		send(alice, { type: 'move', x: 3, y: 3 });
		send(bob, { type: 'move', x: 4, y: 4 });
		room.clock.black.mainMs = 0;
		room.clock.black.inByoYomi = true;
		room.clock.black.byoPeriods = 3;
		room.clock.black.byoMs = 30000;
		// Alice takes 35 seconds — period fully elapses
		room.clock.turnStartedAt = Date.now() - 35000;
		send(alice, { type: 'move', x: 5, y: 5 });
		expect(room.clock.black.byoPeriods).toBe(2);
		expect(room.clock.black.byoMs).toBe(30000); // reset to full period
	});

	it('fischer increment is added to main time after a move', () => {
		const fischerTC = { type: 'fischer', initial: 300, increment: 10 };
		const room = createRoom(19, fischerTC, 'black');
		const alice = makeSocket();
		const bob = makeSocket();
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		// First move — no deduction, no increment (turnStartedAt was null)
		send(alice, { type: 'move', x: 3, y: 3 });
		const mainAfterFirst = room.clock.black.mainMs;
		expect(mainAfterFirst).toBe(300000); // unchanged on first move
		// Bob moves to advance clock
		room.clock.turnStartedAt = Date.now() - 2000; // 2 seconds elapsed
		send(bob, { type: 'move', x: 4, y: 4 });
		// White's main time: 300000 - 2000 + 10000 increment = 308000
		expect(room.clock.white.mainMs).toBe(308000);
	});

	it('correspondence move after deadline causes timeout', () => {
		const corrTC = { type: 'correspondence', days: 1 };
		const room = createRoom(19, corrTC, 'black');
		const alice = makeSocket();
		const bob = makeSocket();
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		alice.sent.length = 0;
		bob.sent.length = 0;
		// Wind clock back past the deadline
		room.corrState.turnDeadline = Date.now() - 1000;
		send(alice, { type: 'move', x: 3, y: 3 });
		expect(alice.lastMsg()).toMatchObject({ type: 'timeout', loser: 'black' });
		expect(bob.lastMsg()).toMatchObject({ type: 'timeout', loser: 'black' });
		expect(room.status).toBe('finished');
	});
});

describe('lobby stats', () => {
	it('gamesInPlay counts only playing rooms', () => {
		const r1 = createRoom(19, { type: 'none' }, 'black');
		const r2 = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket();
		const bob = makeSocket();
		join(alice, r1.id, 'Alice');
		join(bob, r1.id, 'Bob'); // r1 is now playing
		const s = makeSocket();
		send(s, { type: 'ping' });
		expect(s.lastMsg()).toMatchObject({ gamesInPlay: 1 });
		// r2 is still waiting
		expect(r2.status).toBe('waiting');
	});
});

// ---- Reconnect / resume ------------------------------------------------

describe('reconnect — hot (room still in memory)', () => {
	function setupWithMoves() {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket({ username: 'Alice' });
		const bob = makeSocket({ username: 'Bob' });
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		send(alice, { type: 'move', x: 3, y: 3 });
		send(bob, { type: 'move', x: 4, y: 4 });
		return { room, alice, bob };
	}

	it('joined response has status and color but no moves (HTTP provides those)', () => {
		const { room, alice } = setupWithMoves();
		handleDisconnect(alice);
		const alice2 = makeSocket({ username: 'Alice' });
		join(alice2, room.id, 'Alice');
		const msg = alice2.lastMsg();
		expect(msg).toMatchObject({ type: 'joined', status: 'playing', color: 'black' });
		expect(msg.moves).toBeUndefined();
	});

	it('already-connected opponent gets opponent_joined when player reconnects', () => {
		const { room, alice, bob } = setupWithMoves();
		handleDisconnect(alice);
		bob.sent.length = 0;
		const alice2 = makeSocket({ username: 'Alice' });
		join(alice2, room.id, 'Alice');
		expect(bob.lastMsg()).toMatchObject({ type: 'opponent_joined', opponent: 'Alice' });
	});

	it('reconnecting player gets correct color', () => {
		const { room, alice } = setupWithMoves();
		handleDisconnect(alice);
		const alice2 = makeSocket({ username: 'Alice' });
		join(alice2, room.id, 'Alice');
		expect(alice2.lastMsg()).toMatchObject({ type: 'joined', color: 'black' });
	});

	it('game can continue after reconnect — moves are accepted', () => {
		const { room, alice, bob } = setupWithMoves();
		handleDisconnect(alice);
		const alice2 = makeSocket({ username: 'Alice' });
		join(alice2, room.id, 'Alice');
		alice2.sent.length = 0;
		bob.sent.length = 0;
		send(alice2, { type: 'move', x: 5, y: 5 });
		expect(bob.lastMsg()).toMatchObject({ type: 'move', x: 5, y: 5 });
		expect(dbMock._store.games[room.id].moves).toHaveLength(3);
	});
});

describe('reconnect — both players disconnected', () => {
	function setupBothDisconnected() {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket({ username: 'Alice' });
		const bob = makeSocket({ username: 'Bob' });
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		send(alice, { type: 'move', x: 3, y: 3 });
		handleDisconnect(alice);
		handleDisconnect(bob);
		return { room, alice, bob };
	}

	it('room is marked abandoned in memory after both disconnect', () => {
		const { room } = setupBothDisconnected();
		expect(room.status).toBe('abandoned');
	});

	it('DB is NOT written as abandoned when both players are authenticated (they can cold-reconnect)', () => {
		const { room } = setupBothDisconnected();
		expect(dbMock._store.games[room.id].status).toBe('playing');
	});

	it('first authenticated player can reconnect to in-memory abandoned room', () => {
		const { room } = setupBothDisconnected();
		const alice2 = makeSocket({ username: 'Alice' });
		join(alice2, room.id, 'Alice');
		expect(alice2.lastMsg()).toMatchObject({ type: 'joined', color: 'black' });
		expect(room.status).toBe('playing');
	});

	it('second authenticated player can reconnect after first rejoins', () => {
		const { room } = setupBothDisconnected();
		const alice2 = makeSocket({ username: 'Alice' });
		const bob2 = makeSocket({ username: 'Bob' });
		join(alice2, room.id, 'Alice');
		alice2.sent.length = 0;
		join(bob2, room.id, 'Bob');
		expect(bob2.lastMsg()).toMatchObject({ type: 'joined', color: 'white' });
		// Alice gets opponent_joined
		expect(alice2.lastMsg()).toMatchObject({ type: 'opponent_joined', opponent: 'Bob' });
	});

	it('third party sees read-only view of in-memory abandoned room', () => {
		const { room } = setupBothDisconnected();
		const charlie = makeSocket({ username: 'Charlie' });
		join(charlie, room.id, 'Charlie');
		const msg = charlie.lastMsg();
		expect(msg).toMatchObject({ type: 'joined', status: 'abandoned', color: null });
	});

	it('anonymous player sees read-only view of in-memory abandoned room', () => {
		const { room } = setupBothDisconnected();
		const anon = makeSocket(); // no authenticatedUsername
		join(anon, room.id, 'Alice');
		const msg = anon.lastMsg();
		expect(msg).toMatchObject({ type: 'joined', status: 'abandoned', color: null });
	});
});

describe('cold restart — basic game state', () => {
	// _removeRoom() simulates a server crash: room is gone from memory, DB survives.
	function crash(roomId) {
		_removeRoom(roomId);
	}

	function setupGame() {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket({ username: 'Alice' });
		const bob = makeSocket({ username: 'Bob' });
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		send(alice, { type: 'move', x: 3, y: 3 });
		send(bob, { type: 'move', x: 4, y: 4 });
		return { room, alice, bob };
	}

	it('first player back gets correct color and status', () => {
		const { room } = setupGame();
		crash(room.id);
		const alice2 = makeSocket({ username: 'Alice' });
		join(alice2, room.id, 'Alice');
		expect(alice2.lastMsg()).toMatchObject({
			type: 'joined',
			color: 'black',
			status: 'playing'
		});
	});

	it('both players reconnect and game resumes', () => {
		const { room } = setupGame();
		crash(room.id);
		const alice2 = makeSocket({ username: 'Alice' });
		const bob2 = makeSocket({ username: 'Bob' });
		join(alice2, room.id, 'Alice');
		alice2.sent.length = 0;
		join(bob2, room.id, 'Bob');
		expect(alice2.lastMsg()).toMatchObject({ type: 'opponent_joined' });
		bob2.sent.length = 0;
		send(alice2, { type: 'move', x: 5, y: 5 });
		expect(bob2.lastMsg()).toMatchObject({ type: 'move', x: 5, y: 5 });
	});

	it('move appended to DB after cold restart', () => {
		const { room } = setupGame();
		crash(room.id);
		const alice2 = makeSocket({ username: 'Alice' });
		const bob2 = makeSocket({ username: 'Bob' });
		join(alice2, room.id, 'Alice');
		join(bob2, room.id, 'Bob');
		send(alice2, { type: 'move', x: 5, y: 5 });
		expect(dbMock._store.games[room.id].moves).toHaveLength(3);
	});

	it('third party cannot join after cold restart', () => {
		const { room } = setupGame();
		crash(room.id);
		const charlie = makeSocket({ username: 'Charlie' });
		join(charlie, room.id, 'Charlie');
		expect(charlie.lastMsg()).toMatchObject({ type: 'error', message: 'Game is full' });
	});

	it('unknown game still 404s after cold restart', () => {
		crash('doesnotexist');
		const sock = makeSocket({ username: 'Alice' });
		join(sock, 'doesnotexist', 'Alice');
		expect(sock.lastMsg()).toMatchObject({ type: 'error', message: 'Game not found' });
	});
});

describe('cold restart — clock (timed games)', () => {
	function crash(roomId) {
		_removeRoom(roomId);
	}

	it('clock and corrState not in joined response after cold restart (HTTP provides those)', () => {
		const TC = { type: 'byoyomi', initial: 300, periods: 5, periodTime: 30 };
		const room = createRoom(19, TC, 'black');
		const alice = makeSocket({ username: 'Alice' });
		const bob = makeSocket({ username: 'Bob' });
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		send(alice, { type: 'move', x: 3, y: 3 });
		send(bob, { type: 'move', x: 4, y: 4 });
		crash(room.id);
		const alice2 = makeSocket({ username: 'Alice' });
		join(alice2, room.id, 'Alice');
		const msg = alice2.lastMsg();
		expect(msg).toMatchObject({ type: 'joined', color: 'black', status: 'playing' });
		expect(msg.clock).toBeUndefined();
		expect(msg.moves).toBeUndefined();
	});
});

describe('cold restart — consecutive passes and scoring', () => {
	function crash(roomId) {
		_removeRoom(roomId);
	}

	it('server recomputes consecutivePasses from move history so score_phase works immediately', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket({ username: 'Alice' });
		const bob = makeSocket({ username: 'Bob' });
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		send(alice, { type: 'pass' });
		send(bob, { type: 'pass' }); // 2 consecutive passes before crash
		crash(room.id);
		// Both reconnect
		const alice2 = makeSocket({ username: 'Alice' });
		const bob2 = makeSocket({ username: 'Bob' });
		join(alice2, room.id, 'Alice');
		join(bob2, room.id, 'Bob');
		alice2.sent.length = 0;
		bob2.sent.length = 0;
		// score_phase should be accepted because 2 consecutive passes already happened
		send(alice2, { type: 'score_phase' });
		expect(alice2.lastMsg()).toMatchObject({ type: 'score_phase' });
		expect(bob2.lastMsg()).toMatchObject({ type: 'score_phase' });
	});

	it('a non-pass move before crash resets consecutive pass count correctly', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket({ username: 'Alice' });
		const bob = makeSocket({ username: 'Bob' });
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		send(alice, { type: 'pass' });
		send(bob, { type: 'move', x: 3, y: 3 }); // breaks the pass streak
		crash(room.id);
		const alice2 = makeSocket({ username: 'Alice' });
		const bob2 = makeSocket({ username: 'Bob' });
		join(alice2, room.id, 'Alice');
		join(bob2, room.id, 'Bob');
		alice2.sent.length = 0;
		bob2.sent.length = 0;
		// score_phase must be rejected — only 0 consecutive passes post-crash
		send(alice2, { type: 'score_phase' });
		expect(alice2.sent.length).toBe(0);
		expect(bob2.sent.length).toBe(0);
	});

	it('scoring phase in progress at crash time is restored on reconnect', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket({ username: 'Alice' });
		const bob = makeSocket({ username: 'Bob' });
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		send(alice, { type: 'pass' });
		send(bob, { type: 'pass' });
		send(alice, { type: 'score_phase' });
		send(alice, { type: 'mark_dead', stones: [[3, 3]] });
		crash(room.id);
		const alice2 = makeSocket({ username: 'Alice' });
		const bob2 = makeSocket({ username: 'Bob' });
		join(alice2, room.id, 'Alice');
		// Capture alice2's joined message before bob2 joins (which would push opponent_joined)
		const alice2Joined = alice2.lastMsg();
		join(bob2, room.id, 'Bob');
		// Scoring phase was active when the server crashed — status must reflect it
		expect(alice2Joined).toMatchObject({ type: 'joined', status: 'scoring' });
	});
});

describe('reconnect — cold (room evicted from memory)', () => {
	function setupColdReconnect() {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket({ username: 'Alice' });
		const bob = makeSocket({ username: 'Bob' });
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		send(alice, { type: 'move', x: 3, y: 3 });
		send(bob, { type: 'move', x: 4, y: 4 });
		const roomId = room.id;
		// Simulate server restart: evict room from memory
		_removeRoom(roomId);
		return { roomId };
	}

	it('room is reconstructed from DB on join', () => {
		const { roomId } = setupColdReconnect();
		const alice2 = makeSocket({ username: 'Alice' });
		join(alice2, roomId, 'Alice');
		expect(alice2.lastMsg()).toMatchObject({ type: 'joined', color: 'black' });
	});

	it('cold reconnect: status is playing', () => {
		const { roomId } = setupColdReconnect();
		const alice2 = makeSocket({ username: 'Alice' });
		join(alice2, roomId, 'Alice');
		expect(alice2.lastMsg()).toMatchObject({ type: 'joined', status: 'playing', color: 'black' });
	});

	it('cold reconnect: second player can join and both can play', () => {
		const { roomId } = setupColdReconnect();
		const alice2 = makeSocket({ username: 'Alice' });
		const bob2 = makeSocket({ username: 'Bob' });
		join(alice2, roomId, 'Alice');
		alice2.sent.length = 0;
		join(bob2, roomId, 'Bob');
		expect(bob2.lastMsg()).toMatchObject({ type: 'joined', color: 'white' });
		expect(alice2.lastMsg()).toMatchObject({ type: 'opponent_joined' });
		// Game continues
		send(alice2, { type: 'move', x: 5, y: 5 });
		expect(bob2.lastMsg()).toMatchObject({ type: 'move', x: 5, y: 5 });
	});

	it('cold reconnect to a finished game gives slim joined', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket({ username: 'Alice' });
		const bob = makeSocket({ username: 'Bob' });
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		send(alice, { type: 'resign' });
		const roomId = room.id;
		_removeRoom(roomId);
		const alice2 = makeSocket({ username: 'Alice' });
		join(alice2, roomId, 'Alice');
		expect(alice2.lastMsg()).toMatchObject({
			type: 'joined',
			status: 'finished',
			color: 'black'
		});
	});
});

describe('reconnect — scoring phase', () => {
	function setupScoring() {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket({ username: 'Alice' });
		const bob = makeSocket({ username: 'Bob' });
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		send(alice, { type: 'pass' });
		send(bob, { type: 'pass' });
		send(alice, { type: 'score_phase' });
		send(alice, {
			type: 'mark_dead',
			stones: [
				[3, 3],
				[3, 4]
			]
		});
		return { room, alice, bob };
	}

	it('reconnecting player gets status scoring', () => {
		const { room, alice } = setupScoring();
		handleDisconnect(alice);
		const alice2 = makeSocket({ username: 'Alice' });
		join(alice2, room.id, 'Alice');
		expect(alice2.lastMsg()).toMatchObject({ type: 'joined', status: 'scoring' });
	});

	it('reconnecting player does not receive dead stones or approvals in WS (HTTP provides those)', () => {
		const { room, alice } = setupScoring();
		send(alice, { type: 'approve_score', signMap: [[]] });
		handleDisconnect(alice);
		const alice2 = makeSocket({ username: 'Alice' });
		join(alice2, room.id, 'Alice');
		const msg = alice2.lastMsg();
		expect(msg).toMatchObject({ type: 'joined', status: 'scoring' });
		expect(msg.deadStones).toBeUndefined();
		expect(msg.scoringApprovals).toBeUndefined();
	});
});

describe('cold restart — scoring approvals', () => {
	function crash(roomId) {
		_removeRoom(roomId);
	}

	it('scoring status is preserved after cold restart', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket({ username: 'Alice' });
		const bob = makeSocket({ username: 'Bob' });
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		send(alice, { type: 'pass' });
		send(bob, { type: 'pass' });
		send(alice, { type: 'score_phase' });
		send(alice, { type: 'approve_score', signMap: [[]] });
		crash(room.id);
		const alice2 = makeSocket({ username: 'Alice' });
		join(alice2, room.id, 'Alice');
		const msg = alice2.lastMsg();
		expect(msg).toMatchObject({ type: 'joined', status: 'scoring' });
	});
});

describe('cold restart — waiting game', () => {
	function crash(roomId) {
		_removeRoom(roomId);
	}

	it('creator can rejoin a waiting game after cold restart', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket({ username: 'Alice' });
		join(alice, room.id, 'Alice');
		expect(dbMock._store.games[room.id].status).toBe('waiting');
		crash(room.id);
		const alice2 = makeSocket({ username: 'Alice' });
		join(alice2, room.id, 'Alice');
		expect(alice2.lastMsg()).toMatchObject({ type: 'joined', status: 'waiting', color: 'black' });
	});

	it('second player joining a cold-restarted waiting game transitions to playing', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket({ username: 'Alice' });
		join(alice, room.id, 'Alice');
		crash(room.id);
		// Alice is not reconnected; Bob joins as the second player
		const bob = makeSocket({ username: 'Bob' });
		join(bob, room.id, 'Bob');
		expect(bob.lastMsg()).toMatchObject({ type: 'joined', color: 'white', status: 'playing' });
	});

	it('anonymous player can join a cold-restarted waiting game as the second player', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket({ username: 'Alice' });
		join(alice, room.id, 'Alice');
		crash(room.id);
		const guest = makeSocket(); // anonymous
		join(guest, room.id, 'Guest9999');
		expect(guest.lastMsg()).toMatchObject({ type: 'joined', color: 'white', status: 'playing' });
	});
});

describe('cold restart — turn validation', () => {
	function crash(roomId) {
		_removeRoom(roomId);
	}

	it('out-of-turn move from black is ignored after cold restart', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket({ username: 'Alice' });
		const bob = makeSocket({ username: 'Bob' });
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		send(alice, { type: 'move', x: 3, y: 3 }); // black moves; now white's turn
		crash(room.id);
		const alice2 = makeSocket({ username: 'Alice' });
		const bob2 = makeSocket({ username: 'Bob' });
		join(alice2, room.id, 'Alice');
		join(bob2, room.id, 'Bob');
		alice2.sent.length = 0;
		bob2.sent.length = 0;
		send(alice2, { type: 'move', x: 4, y: 4 }); // black moves again — out of turn
		expect(bob2.sent.length).toBe(0);
		expect(dbMock._store.games[room.id].moves).toHaveLength(1);
	});

	it('out-of-turn pass from black is ignored after cold restart', () => {
		const room = createRoom(19, { type: 'none' }, 'black');
		const alice = makeSocket({ username: 'Alice' });
		const bob = makeSocket({ username: 'Bob' });
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		send(alice, { type: 'move', x: 3, y: 3 }); // black moves; now white's turn
		crash(room.id);
		const alice2 = makeSocket({ username: 'Alice' });
		const bob2 = makeSocket({ username: 'Bob' });
		join(alice2, room.id, 'Alice');
		join(bob2, room.id, 'Bob');
		bob2.sent.length = 0;
		send(alice2, { type: 'pass' }); // black passes out of turn
		expect(bob2.sent.length).toBe(0);
	});
});

describe('cold restart — clock time preservation', () => {
	function crash(roomId) {
		_removeRoom(roomId);
	}

	it('clock data is preserved in DB after cold restart (verified via DB, not WS response)', () => {
		const TC = { type: 'byoyomi', initial: 300, periods: 5, periodTime: 30 };
		const room = createRoom(19, TC, 'black');
		const alice = makeSocket({ username: 'Alice' });
		const bob = makeSocket({ username: 'Bob' });
		join(alice, room.id, 'Alice');
		join(bob, room.id, 'Bob');
		send(alice, { type: 'move', x: 3, y: 3 });
		room.clock.turnStartedAt = Date.now() - 60000;
		send(bob, { type: 'move', x: 4, y: 4 });
		// Clock deductions are persisted to DB
		expect(dbMock._store.games[room.id].clockWhite.mainMs).toBeLessThan(300000);
	});
});
