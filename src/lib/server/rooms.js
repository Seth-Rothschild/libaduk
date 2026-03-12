import { WebSocketServer } from 'ws';

// Survive HMR reloads in dev — keep rooms across module re-evaluations
if (!global.__rooms) global.__rooms = new Map();
const rooms = global.__rooms;

function generateId() {
	return Math.random().toString(36).slice(2, 8);
}

function uniqueId() {
	let id = generateId();
	while (rooms.has(id)) id = generateId();
	return id;
}

function send(socket, msg) {
	if (socket.readyState === socket.OPEN) {
		socket.send(JSON.stringify(msg));
	}
}

export function createRoom(size = 19) {
	const id = uniqueId();
	const room = { id, size, black: null, blackName: null, white: null, whiteName: null, status: 'waiting' };
	rooms.set(id, room);
	return room;
}

export function getRoom(id) {
	return rooms.get(id);
}

export function getPendingGames() {
	return [...rooms.values()]
		.filter((r) => r.status === 'waiting' && r.blackName)
		.map((r) => ({ id: r.id, creator: r.blackName }));
}

export function getUserGames(username) {
	return [...rooms.values()]
		.filter((r) => r.blackName === username || r.whiteName === username)
		.map((r) => ({
			id: r.id,
			status: r.status,
			opponent: r.blackName === username ? r.whiteName : r.blackName
		}));
}

function opponent(room, socket) {
	return socket === room.black ? room.white : room.black;
}

function handleMessage(socket, raw) {
	let msg;
	try {
		msg = JSON.parse(raw);
	} catch {
		return;
	}

	if (msg.type === 'ping') {
		send(socket, { type: 'pong' });
		return;
	}

	if (msg.type === 'join') {
		const room = rooms.get(msg.gameId);
		if (!room) {
			send(socket, { type: 'error', message: 'Game not found' });
			return;
		}
		if (room.black && room.white) {
			send(socket, { type: 'error', message: 'Game is full' });
			return;
		}

		socket.gameId = room.id;
		socket.username = msg.username ?? 'Anonymous';

		if (!room.black) {
			socket.color = 'black';
			room.black = socket;
			room.blackName = socket.username;
		} else {
			socket.color = 'white';
			room.white = socket;
			room.whiteName = socket.username;
			room.status = 'playing';
			send(room.black, { type: 'opponent_joined', opponent: socket.username });
		}

		send(socket, {
			type: 'joined',
			gameId: room.id,
			color: socket.color,
			size: room.size,
			opponent: opponent(room, socket)?.username ?? null
		});
		return;
	}

	// All other messages relay to opponent
	const room = rooms.get(socket.gameId);
	if (!room) return;
	const opp = opponent(room, socket);
	if (opp) send(opp, { ...msg, color: socket.color });
}

function handleDisconnect(socket) {
	const room = rooms.get(socket.gameId);
	if (!room) return;
	const opp = opponent(room, socket);
	if (opp) send(opp, { type: 'opponent_left' });
	rooms.delete(socket.gameId);
}

export function attachWebSocketServer(httpServer) {
	const wss = new WebSocketServer({ noServer: true });

	httpServer.on('upgrade', (req, socket, head) => {
		if (req.url === '/ws') {
			wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
		}
	});

	wss.on('connection', (socket) => {
		socket.on('message', (raw) => handleMessage(socket, raw.toString()));
		socket.on('close', () => handleDisconnect(socket));
	});
}
